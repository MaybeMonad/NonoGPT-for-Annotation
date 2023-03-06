import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json";

export default defineConfig({
  resolve: {
    alias: {
      "~/": path.join(__dirname, "/src/"),
    },
  },

  plugins: [react(), crx({ manifest })],
});
