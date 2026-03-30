// server/intex.ts
import fs from "fs";
import path from "path";
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import "dotenv/config";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../shared/schema";

// --- 1️⃣ Synchronous logging setup ---
const logPath = path.join(process.cwd(), "uploads", "server.log");

function logSync(message: string) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

logSync("🚀 Starting server...");

// Global error handlers
process.on("unhandledRejection", (reason) => logSync("❌ Unhandled Rejection: " + reason));
process.on("uncaughtException", (err) => logSync("❌ Uncaught Exception: " + (err.stack || err)));

// --- 2️⃣ ES module __dirname alternative ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 3️⃣ Express setup ---
const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- Logger function ---
function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  logSync(`${formattedTime} [${source}] ${message}`);
}

// --- Request logging middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  const pathReq = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (pathReq.startsWith("/api")) {
      let logLine = `${req.method} ${pathReq} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });

  next();
});

// --- Temporary route to download logs ---
app.get("/server-log", (_req, res) => {
  if (fs.existsSync(logPath)) {
    res.download(logPath, "server.log");
  } else {
    res.status(404).send("Log file not found");
  }
});

// --- Async startup ---
(async () => {
  try {
    // --- 1. Check DATABASE_URL ---
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      logSync("❌ DATABASE_URL not set!");
      process.exit(1);
    }

    // --- 2. Setup Drizzle + Postgres ---
    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const db = drizzle(pool, { schema });

    // Test DB connection
    try {
      logSync("🔄 Testing DB connection...");
      await pool.query("SELECT 1");
      logSync("✅ DB connected");
    } catch (err: any) {
      logSync("❌ DB connection failed: " + (err.message || err));
      logSync(err.stack || "");
      process.exit(1);
    }

    // --- 3. Run migrations if folder exists ---
    const migrationsFolder = join(__dirname, "../migrations");
    if (fs.existsSync(migrationsFolder)) {
      try {
        logSync("🔄 Running migrations...");
        await migrate(db, {
          migrationsFolder,
          onMigrationStart: (name) => logSync(`➡ Applying migration: ${name}`),
          onMigrationComplete: (name) => logSync(`✅ Migration applied: ${name}`),
        });
        logSync("✅ All migrations complete");
      } catch (err: any) {
        logSync("❌ Migration failed: " + (err.message || err));
        logSync(err.stack || "");
        process.exit(1);
      }
    } else {
      logSync("⚠ Migrations folder not found, skipping migrations");
    }

    // --- 4. Register routes ---
    const dummyRegisterRoutes = async (_httpServer: any, _app: any) => {};
    try {
      const { registerRoutes } = await import("./routes");
      await registerRoutes(httpServer, app);
    } catch (err) {
      logSync("⚠ registerRoutes failed, using dummy routes");
      await dummyRegisterRoutes(httpServer, app);
    }

    // --- 5. Minimal health check ---
    app.get("/health", (_req, res) => res.json({ status: "ok" }));

    // --- 6. Start server ---
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
      log(`🚀 Server running on port ${port}`)
    );

  } catch (err: any) {
    logSync("❌ Fatal startup error: " + (err.message || err));
    logSync(err.stack || "");
    process.exit(1);
  }
})();
