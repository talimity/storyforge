import path from "node:path";
import react from "@vitejs/plugin-react";
import visualizer from "rollup-plugin-visualizer";
import { defineConfig, loadEnv } from "vite";
import monacoEditorPlugin from "vite-plugin-monaco-editor";

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
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (/node_modules\/react-icons\//.test(id)) return "icons";
            if (/node_modules\/@?monaco-editor\//.test(id)) return "monaco";
            if (/node_modules\/@dnd-kit\//.test(id)) return "dnd-kit";
            if (/node_modules\/(micromark|@micromark|mdast)\//.test(id)) return "markdown";
            if (/node_modules\/@huggingface\//.test(id)) return "huggingface";

            if (
              /node_modules\/(react|react-router|react-dom|scheduler)\//.test(id) ||
              /node_modules\/@chakra-ui\//.test(id) ||
              /node_modules\/@emotion\//.test(id) ||
              /node_modules\/@zag-js\//.test(id) ||
              /node_modules\/@ark-ui\//.test(id)
            )
              return "framework";
          },
        },
      },
    },
    plugins: [
      react({
        babel: {
          plugins: ["babel-plugin-react-compiler"],
        },
      }),
      visualizer({ open: false, filename: "dist/stats.html" }),
      monacoEditorPlugin({
        languageWorkers: ["json", "editorWorkerService"],
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
