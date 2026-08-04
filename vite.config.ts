import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isGitHubPages = process.env.VITE_DEPLOY_TARGET === "github-pages";

export default defineConfig({
  // GitHub Pages serves this repository beneath its name, while Vercel uses
  // the domain root. The deployment workflow sets this target explicitly.
  base: isGitHubPages ? "/Srimalli_Delivery_Tracking/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
});
