import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integratsion testlar bitta PGlite bazasini bo'lishadi — fayllar ketma-ket
    pool: "forks",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
