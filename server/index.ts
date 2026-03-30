// server/intex.ts

import fs from "fs";
import path from "path";

// --- 1️⃣ Setup synchronous logging at startup ---
const logPath = path.join(process.cwd(), "uploads", "server.log");

function logSync(message: string) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
}

// Immediate startup log
logSync("🚀 Starting server...");

// Global error handlers
process.on("unhandledRejection", (reason) => logSync("❌ Unhandled Rejection: " + reason));
process.on("uncaughtException", (err) => logSync("❌ Uncaught Exception: " + (err.stack || err)));

// --- 2️⃣ Imports ---
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import "dotenv/config";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../shared/schema";

// Minimal placeholder routes if registerRoutes or serveStatic fails
const dummyRegisterRoutes = async (_httpServer: any, _app: any) => {};

// --- 3️⃣ ES module __dirname alternative ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// --- 4️⃣ Express setup ---
const app = express();
const httpServer = createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- 5️⃣ Async startup ---
(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      logSync("❌ DATABASE_URL is not set!");
      process.exit(1);
    }

    // --- 5a. Setup Drizzle + Postgres ---
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

    // --- 5b. Run migrations if folder exists ---
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

    // --- 5c. Register routes (fallback if registerRoutes fails) ---
    try {
      const { registerRoutes } = await import("./routes");
      await registerRoutes(httpServer, app);
    } catch (err) {
      logSync("⚠ registerRoutes failed, using dummy routes");
      await dummyRegisterRoutes(httpServer, app);
    }

    // --- 5d. Minimal health check ---
    app.get("/health", (_req, res) => res.json({ status: "ok" }));

    // --- 5e. Start server ---
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
      logSync(`🚀 Server running on port ${port}`)
    );
  } catch (err: any) {
    logSync("❌ Fatal startup error: " + (err.message || err));
    logSync(err.stack || "");
    process.exit(1);
  }
})();
