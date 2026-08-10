import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the same build works from a file:// Electron load
  // and from an itch.io subdirectory without a rebuild.
  base: "./",
  server: { port: 5173 },
  build: { target: "es2022" },
});
