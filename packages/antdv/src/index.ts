/**
 * @vue-dev-inspector/antdv — Ant Design Vue 组件目录扩展。
 *
 * 用法：
 *   import antdv from "@vue-dev-inspector/antdv";
 *   vueDevInspector({ componentConfig: [antdv()] })
 *
 * icon 字段使用 iconify 短串约定：`i-{prefix}:{name}`，由 overlay 运行时
 * fetch api.iconify.design 解析。fetch 失败回退到 tag 前缀字符占位。
 */
import type { ComponentConfigEntry } from "@vue-dev-inspector/shared";
import { loadScriptSpecifier } from "@vue-dev-inspector/utils";

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
     * 1. 用 `loadScript('cdn:@vue-dev-inspector/antdv:0.0.1')`
     * 走 cdn scheme：返回的是 CDN 上的 URL 字符串，core 插件在
     *
     * 2. 用 `loadScriptSpecifier('./dist/expand.iife.js')`
     * 走本地包文件字符全量注入body
     */
    // expand: loadScript('cdn:@vue-dev-inspector/antdv:0.1.0'),
    expand: loadScriptSpecifier(import.meta.resolve, "./dist/expand.iife.js"),
    groups: [
      {
        group: "antdv/通用",
        items: [
          {
            tag: "a-button",
            label: "Button 按钮",
            icon: "i-vaadin:button",
            snippet: '<a-button type="primary">按钮</a-button>',
            attrs: [
              {
                name: "type",
                label: "类型",
                group: "属性",
                defaultValue: "primary",
                options: ["primary", "default", "dashed", "link", "text"],
              },
              {
                name: "size",
                label: "尺寸",
                group: "属性",
                options: ["large", "middle", "small"],
              },
              {
                name: "loading",
                label: "加载中",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "danger",
                label: "危险按钮",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "ghost",
                label: "幽灵属性",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "@click",
                label: "点击事件",
                group: "事件",
              },
              {
                name: "@focus",
                label: "聚焦事件",
                group: "事件",
              },
              {
                name: "@blur",
                label: "失焦事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-tag",
            label: "Tag 标签",
            icon: "i-ant-design:tag-outlined",
            snippet: '<a-tag color="blue">标签</a-tag>',
            attrs: [
              {
                name: "color",
                label: "颜色",
                group: "属性",
                defaultValue: "blue",
                options: [
                  "blue",
                  "green",
                  "red",
                  "orange",
                  "purple",
                  "cyan",
                  "gold",
                ],
              },
              {
                name: "closable",
                label: "可关闭",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "@click",
                label: "点击事件",
                group: "事件",
              },
              {
                name: "@close",
                label: "关闭事件",
                group: "事件",
              },
            ],
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
            attrs: [
              {
                name: "type",
                label: "类型",
                group: "属性",
                defaultValue: "horizontal",
                options: ["horizontal", "vertical"],
              },
              {
                name: "dashed",
                label: "虚线",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "orientation",
                label: "文字方向",
                group: "属性",
                options: ["left", "center", "right"],
              },
            ],
          },
          {
            tag: "a-space",
            label: "Space 间距",
            icon: "i-ant-design:column-height-outlined",
            snippet: "<a-space><span>项</span></a-space>",
            attrs: [
              {
                name: "direction",
                label: "方向",
                group: "属性",
                defaultValue: "horizontal",
                options: ["horizontal", "vertical"],
              },
              {
                name: "size",
                label: "间距",
                group: "属性",
                options: ["small", "middle", "large"],
              },
              {
                name: "wrap",
                label: "换行",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
            ],
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
            attrs: [
              {
                name: "placeholder",
                label: "占位文本",
                group: "属性",
                defaultValue: "请输入",
              },
              {
                name: "size",
                label: "尺寸",
                group: "属性",
                options: ["large", "middle", "small"],
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "allow-clear",
                label: "允许清除",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: ":value",
                label: "绑定值",
                group: "属性",
              },
              {
                name: "v-model:value",
                label: "双向绑定",
                group: "属性",
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
              {
                name: "@pressEnter",
                label: "回车事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-input-password",
            label: "InputPassword 密码框",
            icon: "i-ant-design:lock-outlined",
            snippet: '<a-input-password placeholder="请输入密码" />',
            attrs: [
              {
                name: "placeholder",
                label: "占位文本",
                group: "属性",
                defaultValue: "请输入密码",
              },
              {
                name: "visibility-toggle",
                label: "显示切换按钮",
                group: "属性",
                defaultValue: "true",
                options: ["true", "false"],
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-select",
            label: "Select 选择器",
            icon: "i-ant-design:select-outlined",
            snippet: '<a-select placeholder="请选择" style="width:100%" />',
            attrs: [
              {
                name: "placeholder",
                label: "占位文本",
                group: "属性",
                defaultValue: "请选择",
              },
              {
                name: "size",
                label: "尺寸",
                group: "属性",
                options: ["large", "middle", "small"],
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "allow-clear",
                label: "允许清除",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "mode",
                label: "模式",
                group: "属性",
                options: ["multiple", "tags"],
              },
              {
                name: "v-model:value",
                label: "双向绑定",
                group: "属性",
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
              {
                name: "@select",
                label: "选中事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-date-picker",
            label: "DatePicker 日期",
            icon: "i-ant-design:calendar-outlined",
            snippet: '<a-date-picker style="width:100%" />',
            attrs: [
              {
                name: "size",
                label: "尺寸",
                group: "属性",
                options: ["large", "middle", "small"],
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "allow-clear",
                label: "允许清除",
                group: "属性",
                defaultValue: "true",
                options: ["true", "false"],
              },
              {
                name: "v-model:value",
                label: "双向绑定",
                group: "属性",
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-switch",
            label: "Switch 开关",
            icon: "i-ant-design:switcher-outlined",
            snippet: "<a-switch />",
            attrs: [
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "loading",
                label: "加载中",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "v-model:checked",
                label: "双向绑定",
                group: "属性",
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-checkbox",
            label: "Checkbox 复选",
            icon: "i-ant-design:check-square-outlined",
            snippet: "<a-checkbox>复选框</a-checkbox>",
            attrs: [
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "v-model:checked",
                label: "双向绑定",
                group: "属性",
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
            ],
          },
          {
            tag: "a-radio",
            label: "Radio 单选",
            icon: "i-ci:radio-fill",
            snippet: '<a-radio value="a">选项</a-radio>',
            attrs: [
              {
                name: "value",
                label: "值",
                group: "属性",
                defaultValue: "a",
              },
              {
                name: "disabled",
                label: "禁用",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "@change",
                label: "变化事件",
                group: "事件",
              },
            ],
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
            attrs: [
              {
                name: "message",
                label: "主要内容",
                group: "属性",
                defaultValue: "提示信息",
              },
              {
                name: "description",
                label: "辅助内容",
                group: "属性",
              },
              {
                name: "type",
                label: "类型",
                group: "属性",
                defaultValue: "info",
                options: ["success", "info", "warning", "error"],
              },
              {
                name: "show-icon",
                label: "显示图标",
                group: "属性",
                defaultValue: "true",
                options: ["true", "false"],
              },
              {
                name: "closable",
                label: "可关闭",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "@close",
                label: "关闭事件",
                group: "事件",
              },
            ],
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
            snippet: '<a-card title="标题"><p>内容</p></a-card>',
            attrs: [
              {
                name: "title",
                label: "标题",
                group: "属性",
                defaultValue: "标题",
              },
              {
                name: "bordered",
                label: "边框",
                group: "属性",
                defaultValue: "true",
                options: ["true", "false"],
              },
              {
                name: "hoverable",
                label: "悬浮效果",
                group: "属性",
                defaultValue: "false",
                options: ["true", "false"],
              },
              {
                name: "size",
                label: "尺寸",
                group: "属性",
                options: ["default", "small"],
              },
            ],
          },
        ],
      },
    ],
  };
}
