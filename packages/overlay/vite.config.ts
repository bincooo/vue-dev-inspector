import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "VueDevInspectorOverlay",
      formats: ["iife"],
      fileName: () => "overlay.iife.js",
    },
    outDir: "dist",
    minify: false,
    rollupOptions: {
      output: {
        // IIFE 需要一个全局变量名，但实际不需要外部访问
        globals: {},
      },
    },
  },
});
