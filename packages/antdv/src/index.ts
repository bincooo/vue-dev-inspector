/**
 * @vdi/antdv — Ant Design Vue 组件目录扩展。
 *
 * 用法：
 *   import antdv from "@vdi/antdv";
 *   vueDevInspector({ componentConfig: [antdv()] })
 *
 * icon 字段使用 iconify 短串约定：`i-{prefix}:{name}`，由 overlay 运行时
 * fetch api.iconify.design 解析。fetch 失败回退到 tag 前缀字符占位。
 */
import type { ComponentConfigEntry } from "@vdi/shared";
import { loadScript } from "@vdi/utils";

/**
 * 返回 Ant Design Vue 组件目录。
 *
 * 接受一个可选对象留作未来扩展（例如 `prefix`、`enabledGroups`），
 * 当前实现按完整目录返回，参数预留避免破坏性升级。
 */

export default function (): ComponentConfigEntry {
  return {
    name: "antdv",
    /** 物料库自身图标 —— 呈现在抽屉左侧 tab 上 */
    icon: "i-ant-design:ant-design-outlined",
    /**
     * 浏览器侧拓展脚本 —— 物料库自带的 demo / 事件订阅入口。
     *
     * `loadScript('@vdi/antdv', './dist/expand.iife.js')` 用 antdv 包根作锚点
     * （通过 `createRequire(import.meta.url).resolve('@vdi/antdv/package.json')`
     * 走 pnpm 包解析），再解相对路径。
     *
     * 为什么需要 `@vdi/antdv` 锚点：当 antdv 被 Vite 的 esbuild config loader
     * 打进 `demo/node_modules/.vite-temp/vite.config.ts.*.mjs` 时，
     * `import.meta.url` 指向的是临时 mjs（不是 antdv/dist/index.js），
     * 相对 `./expand.iife.js` / `../dist/expand.iife.js` 全部解不到。
     * 走 pnpm 包解析则始终能定位到 antdv/dist/。
     */
    expand: loadScript('@vdi/antdv', './dist/expand.iife.js'),
    groups: [
      {
        group: "antdv/通用",
        items: [
          {
            tag: "a-button",
            label: "Button 按钮",
            icon: "i-vaadin:button",
            snippet: '<a-button type="primary">按钮</a-button>',
          },
          {
            tag: "a-tag",
            label: "Tag 标签",
            icon: "i-ant-design:tag-outlined",
            snippet: '<a-tag color="blue">标签</a-tag>',
          },
        ],
      },
      {
        group: "antdv/布局",
        items: [
          {
            tag: "a-divider",
            label: "Divider 分割线",
            icon: "i-pixel:divider",
            snippet: "<a-divider />",
          },
          {
            tag: "a-space",
            label: "Space 间距",
            icon: "i-ant-design:column-height-outlined",
            snippet: "<a-space><span>项</span></a-space>",
          },
        ],
      },
      {
        group: "antdv/表单",
        items: [
          {
            tag: "a-input",
            label: "Input 输入框",
            icon: "i-vaadin:input",
            snippet: '<a-input placeholder="请输入" />',
          },
          {
            tag: "a-input-password",
            label: "InputPassword 密码框",
            icon: "i-ant-design:lock-outlined",
            snippet: '<a-input-password placeholder="请输入密码" />',
          },
          {
            tag: "a-select",
            label: "Select 选择器",
            icon: "i-ant-design:select-outlined",
            snippet: '<a-select placeholder="请选择" style="width:100%" />',
          },
          {
            tag: "a-date-picker",
            label: "DatePicker 日期",
            icon: "i-ant-design:calendar-outlined",
            snippet: '<a-date-picker style="width:100%" />',
          },
          {
            tag: "a-switch",
            label: "Switch 开关",
            icon: "i-ant-design:switcher-outlined",
            snippet: "<a-switch />",
          },
          {
            tag: "a-checkbox",
            label: "Checkbox 复选",
            icon: "i-ant-design:check-square-outlined",
            snippet: "<a-checkbox>复选框</a-checkbox>",
          },
          {
            tag: "a-radio",
            label: "Radio 单选",
            icon: "i-ci:radio-fill",
            snippet: '<a-radio value="a">选项</a-radio>',
          },
        ],
      },
      {
        group: "antdv/反馈",
        items: [
          {
            tag: "a-alert",
            label: "Alert 提示",
            icon: "i-ant-design:alert-outlined",
            snippet: '<a-alert message="提示信息" type="info" show-icon />',
          },
        ],
      },
      {
        group: "antdv/数据展示",
        items: [
          {
            tag: "a-card",
            label: "Card 卡片",
            icon: "i-ant-design:credit-card-outlined",
            snippet: "<a-card title=\"标题\"><p>内容</p></a-card>",
          },
        ],
      },
    ],
  };
}
