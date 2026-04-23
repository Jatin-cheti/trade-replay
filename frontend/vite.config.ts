import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/

/** Resolve the backend API origin from env vars injected by the test runner (e.g. Playwright).
 *  Falls back to the standard dev-server port 4000. */
function resolveApiTarget(): string {
  const fromEnv = process.env.DEV_VITE_API_URL ?? process.env.VITE_DEV_API_URL ?? process.env.VITE_API_URL;
  if (fromEnv) {
    try {
      const u = new URL(fromEnv);
      return `${u.protocol}//${u.hostname}:${u.port}`;
    } catch {
      // invalid URL – fall through to default
    }
  }
  return "http://localhost:4000";
}

export default defineConfig(({ mode }) => ({
  envDir: "..",
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api": {
        target: resolveApiTarget(),
        changeOrigin: true,
      },
    },
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger(), mode !== "production" && visualizer({ open: false, filename: "dist/stats.html" })].filter(Boolean),
  css: {
    postcss: {
      plugins: [tailwindcss(), autoprefixer()],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/date-fns')) return 'vendor-date';
          if (id.includes('node_modules/@tanstack')) return 'vendor-query';
          if (id.includes('node_modules/@radix-ui')) return 'vendor-radix';
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide';
          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom')) return 'vendor-router';
        },
      },
    },
  },
}));
