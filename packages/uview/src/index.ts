/**
 * @vue-dev-inspector/uview -- uView Pro (uni-app Vue3 UI 库) 组件目录扩展。
 *
 * 用法：
 *   import uview from "@vue-dev-inspector/uview";
 *   uniDevInspector({ componentConfig: [uview()] })
 *
 * snippet 字段为单行模板字符串，由 overlay 抽屉随 /insert-component
 * 请求透传给服务端，服务端 AST 原样写入 .vue。
 *
 * icon 字段使用 iconify 短串约定：`i-{prefix}:{name}`，由 overlay 运行时
 * fetch api.iconify.design 解析；fetch 失败回退到 tag 前缀字符占位。
 *
 * 组件 tag/props 对齐 uview-pro@0.6.8（`u-*` 由 pages.json easycom 自动引入，
 * 无需声明 imports）。
 */
import type {
  ComponentAttr,
  ComponentConfigEntry,
} from "@vue-dev-inspector/shared";

// ---- 属性快捷构造（与 antdv 目录一致的 helper 模式） ----

/** 布尔属性：options ["true","false"] + defaultValue */
const boolAttr = (
  name: string,
  label: string,
  defaultValue = "false",
): ComponentAttr => ({
  name,
  label,
  group: "属性",
  defaultValue,
  options: ["true", "false"],
});

/** 尺寸属性 */
const sizeAttr = (
  options: string[] = ["default", "mini", "small"],
): ComponentAttr => ({
  name: "size",
  label: "尺寸",
  group: "属性",
  options,
});

/** 禁用属性（布尔，默认 false） */
const disabledAttr = (): ComponentAttr => boolAttr("disabled", "禁用");

/** 事件属性 */
const eventAttr = (name: string, label: string): ComponentAttr => ({
  name,
  label,
  group: "事件",
});

/** 普通属性（可透传 defaultValue/options 等） */
const textAttr = (
  name: string,
  label: string,
  extra: Partial<ComponentAttr> = {},
): ComponentAttr => ({
  name,
  label,
  group: "属性",
  ...extra,
});

/** v-model 双向绑定属性 */
const modelAttr = (label = "双向绑定"): ComponentAttr => ({
  name: "v-model",
  label,
  group: "属性",
});

/** 占位文本属性 */
const placeholderAttr = (defaultValue = "请输入"): ComponentAttr => ({
  name: "placeholder",
  label: "占位文本",
  group: "属性",
  defaultValue,
});

/**
 * 返回 uView Pro 组件目录。
 *
 * 接受一个可选对象留作未来扩展（例如 `prefix`、`enabledGroups`），
 * 当前实现按完整目录返回，参数预留避免破坏性升级。
 */
export default function uview(): ComponentConfigEntry {
  return {
    name: "uview",
    /** 物料库自身图标 -- 呈现在抽屉左侧 tab 上 */
    icon: "i-mdi:alpha-u-circle-outline",
    groups: [
      // ==================== 基础 ====================
      {
        group: "uview/基础",
        items: [
          {
            tag: "u-button",
            label: "Button 按钮",
            icon: "i-vaadin:button",
            snippet: '<u-button type="primary">按钮</u-button>',
            attrs: [
              textAttr("type", "类型", {
                defaultValue: "default",
                options: ["default", "primary", "success", "error", "warning"],
              }),
              sizeAttr(["default", "mini"]),
              textAttr("shape", "形状", {
                options: ["square", "circle"],
              }),
              boolAttr("plain", "朴素"),
              disabledAttr(),
              boolAttr("loading", "加载中"),
              textAttr("text", "按钮文字"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-icon",
            label: "Icon 图标",
            icon: "i-mdi:star-four-points-outline",
            snippet: '<u-icon name="photo" />',
            attrs: [
              textAttr("name", "图标名称"),
              textAttr("color", "颜色"),
              textAttr("size", "大小"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-tag",
            label: "Tag 标签",
            icon: "i-ant-design:tag-outlined",
            snippet: '<u-tag text="标签" type="primary" />',
            attrs: [
              textAttr("text", "文字"),
              textAttr("type", "类型", {
                defaultValue: "primary",
                options: ["default", "primary", "success", "error", "warning"],
              }),
              textAttr("mode", "模式", {
                options: ["light", "dark", "plain"],
              }),
              textAttr("shape", "形状", {
                options: ["square", "circle"],
              }),
              boolAttr("closeable", "可关闭"),
              eventAttr("@click", "点击事件"),
              eventAttr("@close", "关闭事件"),
            ],
          },
          {
            tag: "u-badge",
            label: "Badge 徽标",
            icon: "i-ant-design:badge-outlined",
            snippet: '<u-badge count="9" />',
            attrs: [
              textAttr("count", "数量"),
              textAttr("type", "类型", {
                options: ["error", "success", "warning", "primary"],
              }),
              sizeAttr(["default", "mini"]),
              boolAttr("showZero", "零值显示"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-image",
            label: "Image 图片",
            icon: "i-ant-design:picture-outlined",
            snippet: '<u-image src="" width="100" height="100" />',
            attrs: [
              textAttr("src", "图片地址"),
              textAttr("width", "宽度"),
              textAttr("height", "高度"),
              textAttr("mode", "裁剪模式", {
                options: ["scaleToFill", "aspectFit", "aspectFill", "widthFix"],
              }),
              eventAttr("@click", "点击事件"),
              eventAttr("@error", "错误事件"),
            ],
          },
          {
            tag: "u-text",
            label: "Text 文本",
            icon: "i-ant-design:font-colors-outlined",
            snippet: "<u-text>文本内容</u-text>",
            attrs: [
              textAttr("text", "文本内容"),
              textAttr("type", "类型", {
                options: ["default", "primary", "success", "error", "warning"],
              }),
              textAttr("size", "字体大小"),
              textAttr("color", "颜色"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-link",
            label: "Link 链接",
            icon: "i-ant-design:link-outlined",
            snippet: '<u-link href="https://example.com">链接</u-link>',
            attrs: [
              textAttr("href", "链接地址"),
              textAttr("text", "文字"),
              textAttr("type", "类型", {
                options: ["default", "primary", "success", "error", "warning"],
              }),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-divider",
            label: "Divider 分割线",
            icon: "i-ant-design:divider-outlined",
            snippet: "<u-divider>分割线</u-divider>",
            attrs: [
              textAttr("type", "类型", {
                options: ["solid", "dashed", "dotted"],
              }),
              boolAttr("border", "边框", "true"),
              textAttr("text", "文字"),
              textAttr("orientation", "文字方向", {
                options: ["left", "center", "right"],
              }),
            ],
          },
          {
            tag: "u-line",
            label: "Line 线条",
            icon: "i-ant-design:line-outlined",
            snippet: "<u-line />",
            attrs: [
              textAttr("color", "颜色"),
              textAttr("direction", "方向", {
                options: ["row", "col"],
              }),
              textAttr("type", "类型", {
                options: ["solid", "dashed", "dotted"],
              }),
            ],
          },
          {
            tag: "u-gap",
            label: "Gap 间距",
            icon: "i-ant-design:height-outlined",
            snippet: '<u-gap height="20" />',
            attrs: [
              textAttr("height", "高度"),
              textAttr("bg-color", "背景颜色"),
            ],
          },
          {
            tag: "u-loading",
            label: "Loading 加载",
            icon: "i-ant-design:loading-outlined",
            snippet: "<u-loading />",
            attrs: [
              textAttr("mode", "模式", {
                options: ["circle", "flower"],
              }),
              textAttr("color", "颜色"),
            ],
          },
          {
            tag: "u-mask",
            label: "Mask 遮罩",
            icon: "i-ant-design:eye-invisible-outlined",
            snippet: '<u-mask :show="false" />',
            attrs: [boolAttr("show", "显示"), eventAttr("@click", "点击事件")],
          },
          {
            tag: "u-transition",
            label: "Transition 动画",
            icon: "i-ant-design:swap-outlined",
            snippet:
              '<u-transition :show="true"><view>内容</view></u-transition>',
            attrs: [
              textAttr("mode", "动画模式", {
                options: [
                  "fade",
                  "slide-up",
                  "slide-down",
                  "slide-left",
                  "slide-right",
                  "zoom",
                ],
              }),
              boolAttr("show", "显示"),
              eventAttr("@change", "状态变化"),
            ],
          },
          {
            tag: "u-avatar",
            label: "Avatar 头像",
            icon: "i-ant-design:user-outlined",
            snippet: '<u-avatar src="" />',
            attrs: [
              textAttr("src", "图片地址"),
              textAttr("size", "尺寸"),
              textAttr("shape", "形状", {
                options: ["circle", "square"],
              }),
              textAttr("text", "文字"),
              eventAttr("@click", "点击事件"),
            ],
          },
        ],
      },
      // ==================== 表单 ====================
      {
        group: "uview/表单",
        items: [
          {
            tag: "u-input",
            label: "Input 输入框",
            icon: "i-vaadin:input",
            snippet: '<u-input v-model="value" placeholder="请输入" />',
            attrs: [
              textAttr("type", "类型", {
                defaultValue: "text",
                options: ["text", "number", "password", "textarea"],
              }),
              placeholderAttr(),
              disabledAttr(),
              boolAttr("border", "边框"),
              textAttr("maxlength", "最大长度"),
              modelAttr(),
              eventAttr("@change", "变化事件"),
              eventAttr("@focus", "聚焦事件"),
              eventAttr("@blur", "失焦事件"),
            ],
          },
          {
            tag: "u-textarea",
            label: "Textarea 文本域",
            icon: "i-ant-design:align-left-outlined",
            snippet: '<u-textarea v-model="value" placeholder="请输入" />',
            attrs: [
              placeholderAttr(),
              disabledAttr(),
              boolAttr("border", "边框"),
              textAttr("maxlength", "最大长度"),
              modelAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-switch",
            label: "Switch 开关",
            icon: "i-ant-design:switcher-outlined",
            snippet: '<u-switch v-model="checked" />',
            attrs: [
              disabledAttr(),
              boolAttr("loading", "加载中"),
              textAttr("active-color", "开启颜色"),
              textAttr("inactive-color", "关闭颜色"),
              modelAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-radio",
            label: "Radio 单选",
            icon: "i-ci:radio-fill",
            snippet: '<u-radio name="a">选项</u-radio>',
            attrs: [
              textAttr("name", "标识"),
              disabledAttr(),
              textAttr("label", "标签"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-form-item",
            label: "FormItem 表单项",
            icon: "i-ant-design:form-outlined",
            snippet: '<u-form-item label="名称"><u-input /></u-form-item>',
            attrs: [
              textAttr("label", "标签"),
              textAttr("prop", "字段名"),
              boolAttr("required", "必填"),
              textAttr("label-position", "标签位置", {
                options: ["left", "top"],
              }),
            ],
          },
          {
            tag: "u-form",
            label: "Form 表单",
            icon: "i-ant-design:profile-outlined",
            snippet:
              '<u-form :model="form"><u-form-item label="名称" /></u-form>',
            attrs: [
              textAttr(":model", "表单数据"),
              textAttr(":rules", "校验规则"),
              textAttr("label-position", "标签位置", {
                defaultValue: "left",
                options: ["left", "top"],
              }),
              textAttr("label-width", "标签宽度"),
              boolAttr("border-bottom", "下边框", "true"),
              eventAttr("@submit", "提交事件"),
            ],
          },
          {
            tag: "u-checkbox",
            label: "Checkbox 复选",
            icon: "i-ant-design:check-square-outlined",
            snippet: '<u-checkbox name="a">选项</u-checkbox>',
            attrs: [
              textAttr("name", "标识"),
              disabledAttr(),
              textAttr("label", "标签"),
              boolAttr("checked", "选中"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-checkbox-group",
            label: "CheckboxGroup 复选组",
            icon: "i-ant-design:check-circle-outlined",
            snippet:
              '<u-checkbox-group v-model="checked"><u-checkbox name="a">A</u-checkbox></u-checkbox-group>',
            attrs: [
              modelAttr(),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-radio-group",
            label: "RadioGroup 单选组",
            icon: "i-ant-design:radio-button-checked",
            snippet:
              '<u-radio-group v-model="value"><u-radio name="a">A</u-radio></u-radio-group>',
            attrs: [
              modelAttr(),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-picker",
            label: "Picker 选择器",
            icon: "i-ant-design:bars-outlined",
            snippet: '<u-picker v-model="show" mode="time" />',
            attrs: [
              textAttr("mode", "模式", {
                options: ["time", "region", "selector", "multiSelector"],
              }),
              modelAttr("显示控制"),
              textAttr(":default-selector", "默认选中"),
              eventAttr("@confirm", "确认事件"),
              eventAttr("@cancel", "取消事件"),
            ],
          },
          {
            tag: "u-select",
            label: "Select 列表选择",
            icon: "i-ant-design:select-outlined",
            snippet: '<u-select v-model="show" :list="list" />',
            attrs: [
              textAttr(":list", "选项列表"),
              modelAttr("显示控制"),
              boolAttr("border", "边框", "true"),
              eventAttr("@confirm", "确认事件"),
            ],
          },
          {
            tag: "u-search",
            label: "Search 搜索",
            icon: "i-ant-design:search-outlined",
            snippet: '<u-search v-model="keyword" placeholder="搜索" />',
            attrs: [
              placeholderAttr("搜索"),
              modelAttr("搜索值"),
              boolAttr("disabled", "禁用"),
              boolAttr("show-action", "显示按钮"),
              textAttr("shape", "形状", {
                options: ["square", "round"],
              }),
              eventAttr("@search", "搜索事件"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-number-box",
            label: "NumberBox 步进器",
            icon: "i-ant-design:field-number-outlined",
            snippet: '<u-number-box v-model="value" />',
            attrs: [
              modelAttr(),
              textAttr("min", "最小值"),
              textAttr("max", "最大值"),
              textAttr("step", "步长"),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-rate",
            label: "Rate 评分",
            icon: "i-ant-design:star-outlined",
            snippet: '<u-rate v-model="value" />',
            attrs: [
              modelAttr(),
              textAttr("count", "星星数"),
              disabledAttr(),
              boolAttr("allow-half", "允许半选"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-slider",
            label: "Slider 滑块",
            icon: "i-ant-design:sliders-outlined",
            snippet: '<u-slider v-model="value" />',
            attrs: [
              modelAttr(),
              textAttr("min", "最小值"),
              textAttr("max", "最大值"),
              textAttr("step", "步长"),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-field",
            label: "Field 输入框",
            icon: "i-ant-design:edit-outlined",
            snippet:
              '<u-field v-model="value" label="名称" placeholder="请输入" />',
            attrs: [
              textAttr("label", "标签"),
              placeholderAttr(),
              modelAttr(),
              disabledAttr(),
              boolAttr("border-bottom", "下边框", "true"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-calendar",
            label: "Calendar 日历",
            icon: "i-ant-design:calendar-outlined",
            snippet: '<u-calendar v-model="show" mode="date" />',
            attrs: [
              modelAttr("显示控制"),
              textAttr("mode", "模式", {
                options: ["date", "datetime", "multiple", "range"],
              }),
              textAttr(":default-date", "默认日期"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-upload",
            label: "Upload 上传",
            icon: "i-ant-design:upload-outlined",
            snippet: '<u-upload :action="action" />',
            attrs: [
              textAttr("action", "上传地址"),
              textAttr("max-count", "最大数量"),
              textAttr("accept", "接受类型"),
              boolAttr("disabled", "禁用"),
              boolAttr("auto-upload", "自动上传", "true"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-keyboard",
            label: "Keyboard 键盘",
            icon: "i-ant-design:key-outlined",
            snippet: '<u-keyboard v-model="show" mode="number" />',
            attrs: [
              textAttr("mode", "模式", {
                options: ["number", "card", "random"],
              }),
              modelAttr("显示控制"),
              eventAttr("@change", "变化事件"),
              eventAttr("@backspace", "退格事件"),
            ],
          },
        ],
      },
      // ==================== 布局 ====================
      {
        group: "uview/布局",
        items: [
          {
            tag: "u-cell-item",
            label: "CellItem 单元格",
            icon: "i-ant-design:bars-outlined",
            snippet: '<u-cell-item title="标题" value="内容" />',
            attrs: [
              textAttr("title", "标题"),
              textAttr("value", "内容"),
              textAttr("label", "描述"),
              boolAttr("border", "边框", "true"),
              boolAttr("arrow", "箭头", "true"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-card",
            label: "Card 卡片",
            icon: "i-ant-design:credit-card-outlined",
            snippet: '<u-card title="标题"><view>内容</view></u-card>',
            attrs: [
              textAttr("title", "标题"),
              boolAttr("border", "边框", "true"),
              textAttr("padding", "内边距"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-grid-item",
            label: "GridItem 宫格项",
            icon: "i-ant-design:appstore-outlined",
            snippet: "<u-grid-item>宫格项</u-grid-item>",
            attrs: [eventAttr("@click", "点击事件")],
          },
          {
            tag: "uni-view",
            label: "块级布局",
            icon: "i-uil:vertical-distribution-center",
            snippet: "<uni-view>块级布局</uni-view>",
            attrs: [eventAttr("@click", "点击事件")],
          },
          {
            tag: "u-grid",
            label: "Grid 宫格",
            icon: "i-ant-design:table-outlined",
            snippet: '<u-grid :col="3"><u-grid-item>1</u-grid-item></u-grid>',
            attrs: [
              textAttr("col", "列数"),
              boolAttr("border", "边框", "true"),
            ],
          },
          {
            tag: "u-row",
            label: "Row 行",
            icon: "i-ant-design:table-outlined",
            snippet: '<u-row :gutter="16"><u-col :span="6" /></u-row>',
            attrs: [
              textAttr("gutter", "间距"),
              textAttr("justify", "水平对齐", {
                options: [
                  "start",
                  "center",
                  "end",
                  "space-between",
                  "space-around",
                ],
              }),
            ],
          },
          {
            tag: "u-col",
            label: "Col 列",
            icon: "i-ant-design:border-outer-outlined",
            snippet: '<u-col :span="6" />',
            attrs: [textAttr("span", "跨度"), textAttr("offset", "偏移")],
          },
          {
            tag: "u-collapse",
            label: "Collapse 折叠面板",
            icon: "i-ant-design:folder-open-outlined",
            snippet:
              '<u-collapse v-model="active"><u-collapse-item title="标题">内容</u-collapse-item></u-collapse>',
            attrs: [
              modelAttr("展开项"),
              boolAttr("accordion", "手风琴"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-sticky",
            label: "Sticky 吸顶",
            icon: "i-ant-design:vertical-align-top-outlined",
            snippet: "<u-sticky><u-button>固定</u-button></u-sticky>",
            attrs: [
              textAttr("offset-top", "顶部偏移"),
              textAttr("z-index", "层级"),
            ],
          },
          {
            tag: "u-cell-group",
            label: "CellGroup 单元格组",
            icon: "i-ant-design:unordered-list-outlined",
            snippet: '<u-cell-group><u-cell-item title="项" /></u-cell-group>',
            attrs: [boolAttr("border", "边框", "true")],
          },
          {
            tag: "u-safe-bottom",
            label: "SafeBottom 安全底部",
            icon: "i-ant-design:vertical-align-bottom-outlined",
            snippet: "<u-safe-bottom />",
            attrs: [],
          },
          {
            tag: "u-status-bar",
            label: "StatusBar 状态栏",
            icon: "i-ant-design:border-top-outlined",
            snippet: "<u-status-bar />",
            attrs: [],
          },
        ],
      },
      // ==================== 导航 ====================
      {
        group: "uview/导航",
        items: [
          {
            tag: "u-navbar",
            label: "Navbar 导航栏",
            icon: "i-ant-design:layout-outlined",
            snippet: '<u-navbar title="标题" />',
            attrs: [
              textAttr("title", "标题"),
              boolAttr("back", "返回按钮"),
              textAttr("background", "背景色"),
              eventAttr("@back", "返回事件"),
            ],
          },
          {
            tag: "u-tabs",
            label: "Tabs 标签页",
            icon: "i-ant-design:tabs-outlined",
            snippet: '<u-tabs :list="list" />',
            attrs: [
              textAttr(":list", "标签列表"),
              textAttr("current", "当前项"),
              modelAttr("当前项"),
              boolAttr("is-scroll", "可滚动", "true"),
              textAttr("active-color", "激活颜色"),
              eventAttr("@change", "切换事件"),
            ],
          },
          {
            tag: "u-tabbar",
            label: "Tabbar 底部导航",
            icon: "i-ant-design:menu-outlined",
            snippet: '<u-tabbar :list="list" v-model="current" />',
            attrs: [
              textAttr(":list", "标签列表"),
              modelAttr("当前项"),
              boolAttr("border-top", "顶部边框", "true"),
              eventAttr("@change", "切换事件"),
            ],
          },
          {
            tag: "u-back-top",
            label: "BackTop 返回顶部",
            icon: "i-ant-design:vertical-align-top-outlined",
            snippet: "<u-back-top />",
            attrs: [
              textAttr("offset-top", "触发距离"),
              textAttr("duration", "动画时长"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-dropdown",
            label: "Dropdown 下拉菜单",
            icon: "i-ant-design:caret-down-outlined",
            snippet:
              '<u-dropdown><u-dropdown-item title="选项" /></u-dropdown>',
            attrs: [eventAttr("@change", "变化事件")],
          },
          {
            tag: "u-steps",
            label: "Steps 步骤条",
            icon: "i-ant-design:ordered-list-outlined",
            snippet: '<u-steps :current="1" />',
            attrs: [
              textAttr("current", "当前步骤"),
              textAttr("mode", "模式", {
                options: ["number", "dot"],
              }),
              textAttr("direction", "方向", {
                options: ["column", "row"],
              }),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-pagination",
            label: "Pagination 分页",
            icon: "i-ant-design:right-outlined",
            snippet: '<u-pagination :total="50" />',
            attrs: [
              textAttr("total", "总条数"),
              textAttr("current", "当前页"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-subsection",
            label: "Subsection 分段器",
            icon: "i-ant-design:control-outlined",
            snippet: '<u-subsection :list="list" v-model="current" />',
            attrs: [
              textAttr(":list", "标签列表"),
              modelAttr("当前项"),
              boolAttr("bold", "加粗"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-index-list",
            label: "IndexList 索引列表",
            icon: "i-ant-design:ordered-list-outlined",
            snippet: '<u-index-list :index-list="list" />',
            attrs: [
              textAttr(":index-list", "索引列表"),
              eventAttr("@select", "选择事件"),
            ],
          },
        ],
      },
      // ==================== 反馈 ====================
      {
        group: "uview/反馈",
        items: [
          {
            tag: "u-popup",
            label: "Popup 弹层",
            icon: "i-ant-design:box-plot-outlined",
            snippet: '<u-popup v-model="show">内容</u-popup>',
            attrs: [
              modelAttr("显示控制"),
              textAttr("mode", "弹出模式", {
                options: ["top", "bottom", "left", "right", "center"],
              }),
              boolAttr("mask", "遮罩", "true"),
              boolAttr("mask-close-able", "遮罩可关闭", "true"),
              eventAttr("@change", "状态变化"),
            ],
          },
          {
            tag: "u-empty",
            label: "Empty 空状态",
            icon: "i-ant-design:inbox-outlined",
            snippet: '<u-empty text="暂无数据" />',
            attrs: [
              textAttr("text", "描述文字"),
              textAttr("mode", "模式", {
                options: ["data", "car", "order", "list", "message", "search"],
              }),
              textAttr("icon", "图标"),
            ],
          },
          {
            tag: "u-loadmore",
            label: "Loadmore 加载更多",
            icon: "i-ant-design:loading-outlined",
            snippet: '<u-loadmore status="loading" />',
            attrs: [
              textAttr("status", "状态", {
                defaultValue: "loadmore",
                options: ["loadmore", "loading", "nomore"],
              }),
              boolAttr("dot", "点点动画"),
              eventAttr("@loadmore", "加载更多事件"),
            ],
          },
          {
            tag: "u-modal",
            label: "Modal 模态框",
            icon: "i-ant-design:container-outlined",
            snippet: '<u-modal v-model="show" title="标题">内容</u-modal>',
            attrs: [
              modelAttr("显示控制"),
              textAttr("title", "标题"),
              textAttr("content", "内容"),
              boolAttr("show-cancel-button", "显示取消按钮"),
              eventAttr("@confirm", "确认事件"),
              eventAttr("@cancel", "取消事件"),
            ],
          },
          {
            tag: "u-toast",
            label: "Toast 提示",
            icon: "i-ant-design:message-outlined",
            snippet: "<u-toast />",
            attrs: [textAttr("z-index", "层级")],
          },
          {
            tag: "u-action-sheet",
            label: "ActionSheet 操作菜单",
            icon: "i-ant-design:menu-unfold-outlined",
            snippet: '<u-action-sheet v-model="show" :list="list" />',
            attrs: [
              modelAttr("显示控制"),
              textAttr(":list", "菜单列表"),
              boolAttr("mask-close-able", "遮罩可关闭", "true"),
              eventAttr("@select", "选择事件"),
            ],
          },
          {
            tag: "u-loading-popup",
            label: "LoadingPopup 加载弹窗",
            icon: "i-ant-design:loading-3-quarters-outlined",
            snippet: '<u-loading-popup v-model="show" />',
            attrs: [modelAttr("显示控制"), textAttr("text", "提示文字")],
          },
          {
            tag: "u-top-tips",
            label: "TopTips 顶部提示",
            icon: "i-ant-design:notification-outlined",
            snippet: '<u-top-tips v-model="show" />',
            attrs: [
              modelAttr("显示控制"),
              textAttr("type", "类型", {
                options: ["default", "primary", "success", "error", "warning"],
              }),
              textAttr("duration", "显示时长"),
            ],
          },
          {
            tag: "u-alert-tips",
            label: "AlertTips 警告提示",
            icon: "i-ant-design:alert-outlined",
            snippet: '<u-alert-tips v-model="show" title="标题" />',
            attrs: [
              modelAttr("显示控制"),
              textAttr("title", "标题"),
              textAttr("content", "内容"),
              textAttr("type", "类型", {
                options: ["info", "success", "error", "warning"],
              }),
            ],
          },
          {
            tag: "u-no-network",
            label: "NoNetwork 无网络",
            icon: "i-ant-design:disconnect-outlined",
            snippet: "<u-no-network />",
            attrs: [eventAttr("@retry", "重试事件")],
          },
          {
            tag: "u-full-screen",
            label: "FullScreen 全屏",
            icon: "i-ant-design:fullscreen-outlined",
            snippet: '<u-full-screen v-model="show" />',
            attrs: [modelAttr("显示控制")],
          },
        ],
      },
      // ==================== 数据展示 ====================
      {
        group: "uview/数据展示",
        items: [
          {
            tag: "u-swiper",
            label: "Swiper 轮播",
            icon: "i-ant-design:picture-outlined",
            snippet: '<u-swiper :list="list" mode="round" />',
            attrs: [
              textAttr(":list", "轮播列表"),
              textAttr("mode", "指示器模式", {
                options: ["round", "rect", "number", "none"],
              }),
              boolAttr("autoplay", "自动播放", "true"),
              textAttr("interval", "切换间隔"),
              eventAttr("@change", "切换事件"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-swipe-action",
            label: "SwipeAction 滑动操作",
            icon: "i-ant-design:swap-outlined",
            snippet:
              '<u-swipe-action><u-cell-item title="滑动" /></u-swipe-action>',
            attrs: [
              boolAttr("disabled", "禁用滑动"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-table",
            label: "Table 表格",
            icon: "i-ant-design:table-outlined",
            snippet: "<u-table><u-tr><u-th>标题</u-th></u-tr></u-table>",
            attrs: [
              boolAttr("border", "边框", "true"),
              textAttr("align", "对齐", {
                options: ["left", "center", "right"],
              }),
            ],
          },
          {
            tag: "u-circle-progress",
            label: "CircleProgress 圆形进度",
            icon: "i-ant-design:progress-outlined",
            snippet: '<u-circle-progress :percent="50" />',
            attrs: [
              textAttr("percent", "百分比"),
              textAttr("type", "类型", {
                options: ["default", "animation"],
              }),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-line-progress",
            label: "LineProgress 线形进度",
            icon: "i-ant-design:line-outlined",
            snippet: '<u-line-progress :percent="50" />',
            attrs: [
              textAttr("percent", "百分比"),
              boolAttr("show-percent", "显示百分比", "true"),
              textAttr("active-color", "激活颜色"),
            ],
          },
          {
            tag: "u-count-down",
            label: "CountDown 倒计时",
            icon: "i-ant-design:clock-circle-outlined",
            snippet: '<u-count-down :time="3600" />',
            attrs: [
              textAttr(":time", "倒计时时长"),
              textAttr("format", "格式"),
              boolAttr("auto-start", "自动开始", "true"),
              eventAttr("@change", "变化事件"),
              eventAttr("@end", "结束事件"),
            ],
          },
          {
            tag: "u-count-to",
            label: "CountTo 数字滚动",
            icon: "i-ant-design:number-outlined",
            snippet: '<u-count-to :end="100" />',
            attrs: [
              textAttr("end", "结束值"),
              textAttr("start", "起始值"),
              textAttr("duration", "动画时长"),
              eventAttr("@end", "结束事件"),
            ],
          },
          {
            tag: "u-skeleton",
            label: "Skeleton 骨架屏",
            icon: "i-ant-design:loading-outlined",
            snippet: '<u-skeleton :loading="true" />',
            attrs: [
              boolAttr("loading", "加载中", "true"),
              boolAttr("animate", "动画"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "u-notice-bar",
            label: "NoticeBar 滚动通知",
            icon: "i-ant-design:notification-outlined",
            snippet: '<u-notice-bar text="通知内容" mode="horizontal" />',
            attrs: [
              textAttr("text", "通知内容"),
              textAttr("mode", "模式", {
                options: ["horizontal", "vertical"],
              }),
              boolAttr("autoplay", "自动播放", "true"),
              eventAttr("@click", "点击事件"),
            ],
          },
          {
            tag: "u-section",
            label: "Section 查看更多",
            icon: "i-ant-design:profile-outlined",
            snippet: '<u-section title="标题" />',
            attrs: [
              textAttr("title", "标题"),
              boolAttr("right", "显示右侧", "true"),
              eventAttr("@more", "更多事件"),
            ],
          },
          {
            tag: "u-read-more",
            label: "ReadMore 展开阅读",
            icon: "i-ant-design:expand-outlined",
            snippet: "<u-read-more><view>内容</view></u-read-more>",
            attrs: [
              textAttr("text", "内容"),
              textAttr("toggle", "展开/收起文字"),
              textAttr("show-height", "显示高度"),
            ],
          },
          {
            tag: "u-time-line",
            label: "TimeLine 时间线",
            icon: "i-ant-design:history-outlined",
            snippet:
              "<u-time-line><u-time-line-item>步骤</u-time-line-item></u-time-line>",
            attrs: [],
          },
          {
            tag: "u-lazy-load",
            label: "LazyLoad 懒加载",
            icon: "i-ant-design:cloud-download-outlined",
            snippet: '<u-lazy-load :threshold="100" />',
            attrs: [
              textAttr("threshold", "触发距离"),
              textAttr("duration", "动画时长"),
            ],
          },
          {
            tag: "u-fab",
            label: "Fab 悬浮按钮",
            icon: "i-ant-design:plus-circle-outlined",
            snippet: "<u-fab />",
            attrs: [
              textAttr("position", "位置", {
                options: ["left", "right"],
              }),
              textAttr("bg-color", "背景色"),
              eventAttr("@click", "点击事件"),
            ],
          },
        ],
      },
    ],
  };
}
