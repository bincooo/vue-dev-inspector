/**
 * @vue-dev-inspector/uview —— uView Pro (uni-app Vue3 UI 库) 组件目录扩展。
 *
 * 用法：
 *   import uview from "@vue-dev-inspector/uview";
 *   uniDevInspector({ componentConfig: [uview()] })
 *
 * 仅声明组件面板描述（tag/label/icon/snippet），不含浏览器侧拓展脚本。
 * snippet 字段为单行模板字符串，由 overlay 抽屉随 /insert-component
 * 请求透传给服务端，服务端 AST 原样写入 .vue。
 *
 * icon 字段使用 iconify 短串约定：`i-{prefix}:{name}`，由 overlay 运行时
 * fetch api.iconify.design 解析；fetch 失败回退到 tag 前缀字符占位。
 *
 * 组件 tag/props 对齐 uview-pro@0.6.8（`u-*` 由 pages.json easycom 自动引入）。
 */
import type { ComponentConfigEntry } from "@vue-dev-inspector/shared";

/**
 * 返回 uView Pro 组件目录。
 *
 * 接受一个可选对象留作未来扩展（例如 `prefix`、`enabledGroups`），
 * 当前实现按完整目录返回，参数预留避免破坏性升级。
 */
export default function uview(): ComponentConfigEntry {
  return {
    name: "uview",
    /** 物料库自身图标 —— 呈现在抽屉左侧 tab 上 */
    icon: "i-mdi:alpha-u-circle-outline",
    groups: [
      {
        group: "uview/基础",
        items: [
          {
            tag: "u-button",
            label: "Button 按钮",
            icon: "i-vaadin:button",
            snippet: '<u-button type="primary">按钮</u-button>',
          },
          {
            tag: "u-icon",
            label: "Icon 图标",
            icon: "i-mdi:star-four-points-outline",
            snippet: '<u-icon name="photo" />',
          },
          {
            tag: "u-tag",
            label: "Tag 标签",
            icon: "i-ant-design:tag-outlined",
            snippet: '<u-tag text="标签" type="primary" />',
          },
          {
            tag: "u-badge",
            label: "Badge 徽标",
            icon: "i-ant-design:badge-outlined",
            snippet: '<u-badge count="9" />',
          },
          {
            tag: "u-image",
            label: "Image 图片",
            icon: "i-ant-design:picture-outlined",
            snippet: '<u-image src="" width="100" height="100" />',
          },
        ],
      },
      {
        group: "uview/表单",
        items: [
          {
            tag: "u-input",
            label: "Input 输入框",
            icon: "i-vaadin:input",
            snippet: '<u-input v-model="value" placeholder="请输入" />',
          },
          {
            tag: "u-textarea",
            label: "Textarea 文本域",
            icon: "i-ant-design:align-left-outlined",
            snippet: '<u-textarea v-model="value" placeholder="请输入" />',
          },
          {
            tag: "u-switch",
            label: "Switch 开关",
            icon: "i-ant-design:switcher-outlined",
            snippet: '<u-switch v-model="checked" />',
          },
          {
            tag: "u-radio",
            label: "Radio 单选",
            icon: "i-ci:radio-fill",
            snippet: '<u-radio name="a">选项</u-radio>',
          },
          {
            tag: "u-form-item",
            label: "FormItem 表单项",
            icon: "i-ant-design:form-outlined",
            snippet: '<u-form-item label="名称"><u-input /></u-form-item>',
          },
        ],
      },
      {
        group: "uview/布局",
        items: [
          {
            tag: "u-cell-item",
            label: "CellItem 单元格",
            icon: "i-ant-design:bars-outlined",
            snippet: '<u-cell-item title="标题" value="内容" />',
          },
          {
            tag: "u-card",
            label: "Card 卡片",
            icon: "i-ant-design:credit-card-outlined",
            snippet: '<u-card title="标题"><view>内容</view></u-card>',
          },
          {
            tag: "u-grid-item",
            label: "GridItem 宫格项",
            icon: "i-ant-design:appstore-outlined",
            snippet: "<u-grid-item>宫格项</u-grid-item>",
          },
          {
            tag: "uni-view",
            label: "块级布局",
            icon: "i-uil:vertical-distribution-center",
            snippet: "<uni-view>块级布局</uni-view>",
          },
        ],
      },
      {
        group: "uview/反馈",
        items: [
          {
            tag: "u-popup",
            label: "Popup 弹层",
            icon: "i-ant-design:box-plot-outlined",
            snippet: '<u-popup v-model="show">内容</u-popup>',
          },
          {
            tag: "u-empty",
            label: "Empty 空状态",
            icon: "i-ant-design:inbox-outlined",
            snippet: '<u-empty text="暂无数据" />',
          },
          {
            tag: "u-loadmore",
            label: "Loadmore 加载更多",
            icon: "i-ant-design:loading-outlined",
            snippet: '<u-loadmore status="loading" />',
          },
        ],
      },
      {
        group: "uview/导航",
        items: [
          {
            tag: "u-navbar",
            label: "Navbar 导航栏",
            icon: "i-ant-design:layout-outlined",
            snippet: '<u-navbar title="标题" />',
          },
          {
            tag: "u-tabs",
            label: "Tabs 标签页",
            icon: "i-ant-design:tabs-outlined",
            snippet: '<u-tabs :list="list" />',
          },
        ],
      },
    ],
  };
}
