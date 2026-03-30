// server/index.ts

// --- Global error handlers ---
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import "dotenv/config";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";

// --- Drizzle imports ---
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../shared/schema";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const app = express();
const httpServer = createServer(app);

// --- ES module alternative to __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// --- Middleware to capture raw JSON body ---
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: false }));

// --- Logger function ---
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// --- Request logging middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      log(logLine);
    }
  });

  next();
});

// --- Async IIFE for setup ---
(async () => {
  try {
    // --- 1️⃣ Setup Drizzle + Postgres ---
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const db = drizzle(pool, { schema });

    // TEMP: test connection
    try {
      console.log("🔄 Initializing DB...");
      await pool.query("SELECT 1");
      console.log("✅ DB connected");
    } catch (err: any) {
      console.error("❌ DB connection failed:", err.message || err);
      console.error(err.stack || "");
      process.exit(1);
    }

    // REAL: run migrations
    try {
      console.log("🔄 Running migrations...");
      await migrate(db, { migrationsFolder: join(__dirname, "../migrations") });
      console.log("✅ Migrations complete");
    } catch (err: any) {
      console.error("❌ Migration failed:", err.message || err);
      console.error(err.stack || "");
      process.exit(1);
    }

    // --- 2️⃣ Register API routes ---
    await registerRoutes(httpServer, app);

    // --- 3️⃣ Error handler ---
    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      console.error("Internal Server Error:", err);

      if (res.headersSent) {
        return next(err);
      }

      return res.status(status).json({ message });
    });

    // --- 4️⃣ Serve static files or dev Vite ---
    if (process.env.NODE_ENV === "production") {
      serveStatic(app);
    } else {
      const { setupVite } = await import("./vite");
      await setupVite(httpServer, app);
    }

    // --- 5️⃣ Start server ---
    const port = parseInt(process.env.PORT || "5000", 10);
    httpServer.listen(
      { port, host: "0.0.0.0", reusePort: true },
      () => log(`🚀 Server running on port ${port}`),
    );
  } catch (err: any) {
    console.error("❌ Unexpected error in server startup:", err.message || err);
    console.error(err.stack || "");
    process.exit(1);
  }
})();
