import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { crx } from "@crxjs/vite-plugin";
import autoprefixer from "autoprefixer";
import prefixSelector from "postcss-prefix-selector";

import manifest from "./manifest.json";

export const $prefix = ".nono-gpt-extension__";

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        autoprefixer(),
        // @ts-ignore
        prefixSelector({
          prefix: $prefix,
          exclude: ["button"],
          includeFiles: ["/src/content/index.css"],
          transform(prefix, selector, prefixedSelector, file) {
            // return `${prefix}${selector.slice(1)}`;
            if (selector && !selector.includes("nono-gpt-extension")) {
              console.log(`${prefix}${selector.slice(1)}`);
              return `${prefix}${selector.slice(1)}`;
            } else {
              return selector;
            }
          },
        }),
      ],
    },
  },

  resolve: {
    alias: {
      "~/": path.join(__dirname, "/src/"),
    },
  },

  plugins: [react(), crx({ manifest })],
});
