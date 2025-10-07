import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import path = require("node:path");

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ""); // don't filter by VITE_ here
  const devServerTarget = `${env.FASTIFY_PROTOCOL ?? "http"}://${env.FASTIFY_HOST ?? "localhost"}:${env.FASTIFY_PORT ?? "3001"}`;
  return {
    server: {
      allowedHosts: true,
      port: 3000,
      proxy: {
        // everything under /api goes to Fastify
        "/api": {
          target: devServerTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
    plugins: [
      react({
        babel: {
          plugins: ["babel-plugin-react-compiler"],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
