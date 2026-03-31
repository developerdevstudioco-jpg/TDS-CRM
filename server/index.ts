// server/index.ts
import fs from "fs";
import path, { dirname, join } from "path";
import express from "express";
import { createServer } from "http";
import "dotenv/config";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../shared/schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- Logging setup ---
const logFolder = join(process.cwd(), "uploads");
const logFilePath = join(logFolder, "server.log");
if (!fs.existsSync(logFolder)) fs.mkdirSync(logFolder, { recursive: true });

function log(message: string, source = "server") {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${source}] ${message}`;
  console.log(line);
  fs.appendFileSync(logFilePath, line + "\n");
}

// Global error handlers
process.on("unhandledRejection", (reason) => log("❌ Unhandled Rejection: " + reason));
process.on("uncaughtException", (err) => log("❌ Uncaught Exception: " + (err.stack || err)));

// --- Express setup ---
const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Request logging middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  let capturedJsonResponse: Record<string, any> | undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      let line = `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (capturedJsonResponse) line += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(line, "express");
    }
  });
  next();
});

// --- Temporary route to download logs ---
app.get("/server-log", (_req, res) => {
  if (fs.existsSync(logFilePath)) res.download(logFilePath, "server.log");
  else res.status(404).send("Log file not found");
});

// --- Health check ---
app.get("/api/test", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Serve React frontend (from client/dist) ---
const clientDistPath = join(__dirname, "../dist/public");

// Serve static files (JS, CSS, assets)
app.use(express.static(clientDistPath));
log(`ℹ React frontend will be served from ${clientDistPath}`);

// --- Async startup: DB, migrations, API routes ---
(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      log("❌ DATABASE_URL not set!");
      return;
    }

    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const db = drizzle(pool, { schema });

    try {
      log("🔄 Testing DB connection...");
      await pool.query("SELECT 1");
      log("✅ DB connected");
    } catch (err: any) {
      log("❌ DB connection failed: " + (err.message || err));
      return;
    }

    // --- Migrations ---
    const migrationsFolder = join(__dirname, "../migrations");
    if (fs.existsSync(migrationsFolder)) {
      const metaFolder = join(migrationsFolder, "meta");
      const journalFile = join(metaFolder, "_journal.json");
      if (!fs.existsSync(metaFolder)) fs.mkdirSync(metaFolder, { recursive: true });
      if (!fs.existsSync(journalFile))
        fs.writeFileSync(journalFile, JSON.stringify({ entries: [] }, null, 2));
      log(`ℹ _journal.json ensured at ${journalFile}`);

      try {
        log("🔄 Running migrations...");
        await migrate(db, {
          migrationsFolder,
          onMigrationStart: (name) => log(`➡ Applying migration: ${name}`),
          onMigrationComplete: (name) => log(`✅ Migration applied: ${name}`),
        });
        log("✅ All migrations complete");
      } catch (err: any) {
        log("❌ Migration failed: " + (err.message || err));
      }
    } else {
      log("⚠ Migrations folder not found, skipping migrations");
    }

    // --- Register backend API routes ---
    try {
      const { registerRoutes } = await import("./routes");
      await registerRoutes(httpServer, app);
      log("✅ API Routes registered");
    } catch (err) {
      log("⚠ registerRoutes failed, using dummy routes: " + err);
    }

    // --- Catch-all for SPA routes (MUST be after all API routes) ---
    app.get("/{*path}", (_req, res) => {
      res.sendFile(join(clientDistPath, "index.html"));
    });

    // --- Start server (MUST be after all routes are registered) ---
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(port, "0.0.0.0", () => log(`🚀 Server listening on port ${port}`));

  } catch (err: any) {
    log("❌ Fatal startup error: " + (err.message || err));
  }
})();