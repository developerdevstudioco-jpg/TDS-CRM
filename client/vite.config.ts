import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: ".",             // Treat client/ as root
  base: "./",            // Ensures relative paths in index.html
  publicDir: "public",   // Only copy assets like logos
  build: {
    outDir: "dist",      // Output to client/dist
    emptyOutDir: true,   // Clear old dist folder
    rollupOptions: {
      input: path.resolve(__dirname, "index.html"),
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});