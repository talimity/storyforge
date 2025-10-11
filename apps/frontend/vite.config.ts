import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

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
          manualChunks: {
            chakra: ["@chakra-ui/react", "@emotion/react", "@ark-ui/react"],
            // Code editor and related packages
            cm: [
              "@uiw/react-codemirror",
              "@codemirror/lang-json",
              "@codemirror/lint",
              "@codemirror/view",
              "@uiw/codemirror-theme-vscode",
            ],
            icons: ["react-icons/fa6", "react-icons/lu", "react-icons/ri", "react-icons/tb"],
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
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
