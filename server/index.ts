import fs from "fs";
import path from "path";

// Log everything
const logPath = path.join(process.cwd(), "uploads", "server.log");
fs.mkdirSync(path.dirname(logPath), { recursive: true });
const logFile = fs.createWriteStream(logPath, { flags: "a" });
console.log = (...args: any[]) => logFile.write(args.join(" ") + "\n");
console.error = (...args: any[]) => logFile.write(args.join(" ") + "\n");

console.log("🚀 Starting server...");

// Global error handlers
process.on("unhandledRejection", (reason) => console.error("❌ Unhandled Rejection:", reason));
process.on("uncaughtException", (err) => console.error("❌ Uncaught Exception:", err));

import express from "express";
import { createServer } from "http";
import "dotenv/config";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../shared/schema";

const app = express();
const httpServer = createServer(app);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

(async () => {
  try {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      console.error("❌ DATABASE_URL not set!");
      process.exit(1);
    }

    const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    const db = drizzle(pool, { schema });

    // Test DB connection
    try {
      console.log("🔄 Testing DB connection...");
      await pool.query("SELECT 1");
      console.log("✅ DB connected");
    } catch (err: any) {
      console.error("❌ DB connection failed:", err.message || err);
      process.exit(1);
    }

    // Run migrations only if folder exists
    const migrationsFolder = join(__dirname, "../migrations");
    if (fs.existsSync(migrationsFolder)) {
      try {
        console.log("🔄 Running migrations...");
        await migrate(db, {
          migrationsFolder,
          onMigrationStart: (name) => console.log(`➡ Applying migration: ${name}`),
          onMigrationComplete: (name) => console.log(`✅ Migration applied: ${name}`),
        });
        console.log("✅ Migrations complete");
      } catch (err: any) {
        console.error("❌ Migration failed:", err.message || err);
        process.exit(1);
      }
    } else {
      console.log("⚠ Migrations folder not found, skipping migrations");
    }

    // Minimal route for health check
    app.get("/health", (_req, res) => res.json({ status: "ok" }));

    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () =>
      console.log(`🚀 Server running on port ${port}`)
    );
  } catch (err: any) {
    console.error("❌ Fatal error during startup:", err.message || err);
    process.exit(1);
  }
})();
