// ============================================================
// 使用配置
// ============================================================
export const usageCode = [
  "// vite.config.ts",
  "import { defineConfig } from 'vite'",
  "import vue from '@vitejs/plugin-vue'",
  "import vueDevInspector from '@vdi/core'",
  "",
  "export default defineConfig({",
  "  plugins: [",
  "    vueDevInspector({",
  "      enabled: true,",
  "      exclude: [/node_modules/, /\\.d\\.ts$/],",
  "      attrName: 'data-source-file',",
  "      editor: 'vscode',",
  "      toggleBtn: true,  // 右下角⚙齿轮按钮 (默认 true)",
  "      wrapComponents: ['a-date-picker'],  // inheritAttrs 覆盖",
  "    }),",
  "    vue(),",
  "  ],",
  "})",
].join('\n');

// ============================================================
// 安装
// ============================================================
export const installCode = [
  "# pnpm (推荐)",
  "pnpm add -D @vdi/core",
  "",
  "# npm",
  "npm install -D @vdi/core",
  "",
  "# yarn",
  "yarn add -D @vdi/core",
].join('\n');
