/**
 * @vue-dev-inspector/antdv - Ant Design Vue 组件目录扩展。
 *
 * 用法：
 *   import antdv from "@vue-dev-inspector/antdv";
 *   vueDevInspector({ componentConfig: [antdv()] })
 *
 * icon 字段使用 iconify 短串约定：`i-{prefix}:{name}`，由 overlay 运行时
 * fetch api.iconify.design 解析。fetch 失败回退到 tag 前缀字符占位。
 *
 * antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签无需声明 imports。
 */
import type {
  ComponentAttr,
  ComponentConfigEntry,
} from "@vue-dev-inspector/shared";
import { loadScriptSpecifier } from "@vue-dev-inspector/utils";

// ---- 属性快捷构造（减少重复、保证命名/分组一致） ----

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
  setter: ["BoolSetter", "CodeSetter"],
});

/** 尺寸属性（large/middle/small） */
const sizeAttr = (
  options: string[] = ["large", "middle", "small"],
): ComponentAttr => ({
  name: "size",
  label: "尺寸",
  group: "属性",
  options,
});

/** 禁用属性（布尔，默认 false） */
const disabledAttr = (): ComponentAttr => boolAttr("disabled", "禁用");

/** 允许清除属性（布尔） */
const allowClearAttr = (defaultValue = "false"): ComponentAttr =>
  boolAttr("allow-clear", "允许清除", defaultValue);

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
const modelAttr = (name: string, label = "双向绑定"): ComponentAttr => ({
  name,
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
 * 返回 Ant Design Vue 组件目录。
 *
 * 接受一个可选对象留作未来扩展（例如 `prefix`、`enabledGroups`），
 * 当前实现按完整目录返回，参数预留避免破坏性升级。
 */
export default function (): ComponentConfigEntry {
  return {
    name: "antdv",
    /** 物料库自身图标 -- 呈现在抽屉左侧 tab 上 */
    icon: "i-ant-design:ant-design-outlined",
    /**
     * 浏览器侧拓展脚本 -- 物料库自带的 demo / 事件订阅入口。
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
      // ==================== 通用 ====================
      {
        group: "antdv/通用",
        items: [
          {
            tag: "a-button",
            label: "Button 按钮",
            icon: "i-vaadin:button",
            snippet: '<a-button type="primary">按钮</a-button>',
            attrs: [
              textAttr("type", "类型", {
                defaultValue: "primary",
                options: ["primary", "default", "dashed", "link", "text"],
              }),
              sizeAttr(),
              boolAttr("loading", "加载中"),
              disabledAttr(),
              boolAttr("danger", "危险按钮"),
              boolAttr("ghost", "幽灵属性"),
              boolAttr("block", "宽度撑满"),
              textAttr("href", "链接地址"),
              eventAttr("@click", "点击事件"),
              eventAttr("@focus", "聚焦事件"),
              eventAttr("@blur", "失焦事件"),
            ],
          },
          {
            tag: "a-tag",
            label: "Tag 标签",
            icon: "i-ant-design:tag-outlined",
            snippet: '<a-tag color="blue">标签</a-tag>',
            attrs: [
              textAttr("color", "颜色", {
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
              }),
              boolAttr("closable", "可关闭"),
              boolAttr("bordered", "边框"),
              eventAttr("@click", "点击事件"),
              eventAttr("@close", "关闭事件"),
            ],
          },
          {
            tag: "a-typography-text",
            label: "TypographyText 文本",
            icon: "i-ant-design:font-colors-outlined",
            snippet: "<a-typography-text>文本内容</a-typography-text>",
            attrs: [
              textAttr("type", "类型", {
                options: ["secondary", "success", "warning", "danger"],
              }),
              boolAttr("strong", "加粗"),
              boolAttr("italic", "斜体"),
              boolAttr("underline", "下划线"),
              boolAttr("delete", "删除线"),
              boolAttr("copyable", "可复制"),
              boolAttr("mark", "标记"),
              eventAttr("@copy", "复制事件"),
            ],
          },
          {
            tag: "a-typography-title",
            label: "TypographyTitle 标题",
            icon: "i-ant-design:format-painter-outlined",
            snippet: '<a-typography-title :level="3">标题</a-typography-title>',
            attrs: [
              textAttr("level", "层级", {
                defaultValue: "1",
                options: ["1", "2", "3", "4", "5"],
              }),
              textAttr("type", "类型", {
                options: ["secondary", "success", "warning", "danger"],
              }),
              boolAttr("copyable", "可复制"),
              boolAttr("ellipsis", "省略"),
              eventAttr("@copy", "复制事件"),
            ],
          },
          {
            tag: "a-typography-paragraph",
            label: "TypographyParagraph 段落",
            icon: "i-ant-design:align-left-outlined",
            snippet:
              "<a-typography-paragraph>段落内容</a-typography-paragraph>",
            attrs: [
              textAttr("type", "类型", {
                options: ["secondary", "success", "warning", "danger"],
              }),
              boolAttr("copyable", "可复制"),
              boolAttr("editable", "可编辑"),
              boolAttr("ellipsis", "省略"),
              eventAttr("@copy", "复制事件"),
            ],
          },
          {
            tag: "a-flex",
            label: "Flex 弹性布局",
            icon: "i-ant-design:appstore-outlined",
            snippet: '<a-flex gap="small"><span>项</span></a-flex>',
            attrs: [
              textAttr("gap", "间距", {
                options: ["small", "middle", "large"],
              }),
              textAttr("vertical", "垂直方向", {
                options: ["true", "false"],
              }),
              textAttr("justify", "主轴对齐", {
                options: [
                  "start",
                  "center",
                  "end",
                  "space-between",
                  "space-around",
                ],
              }),
              textAttr("align", "交叉轴对齐", {
                options: ["start", "center", "end", "stretch"],
              }),
              boolAttr("wrap", "换行"),
            ],
          },
        ],
      },
      // ==================== 布局 ====================
      {
        group: "antdv/布局",
        items: [
          {
            tag: "a-divider",
            label: "Divider 分割线",
            icon: "i-pixel:divider",
            snippet: "<a-divider />",
            attrs: [
              textAttr("type", "类型", {
                defaultValue: "horizontal",
                options: ["horizontal", "vertical"],
              }),
              boolAttr("dashed", "虚线"),
              textAttr("orientation", "文字方向", {
                options: ["left", "center", "right"],
              }),
              boolAttr("plain", "普通文字"),
            ],
          },
          {
            tag: "a-space",
            label: "Space 间距",
            icon: "i-ant-design:column-height-outlined",
            snippet: "<a-space><span>项</span></a-space>",
            attrs: [
              textAttr("direction", "方向", {
                defaultValue: "horizontal",
                options: ["horizontal", "vertical"],
              }),
              textAttr("size", "间距", {
                options: ["small", "middle", "large"],
              }),
              boolAttr("wrap", "换行"),
              textAttr("align", "对齐", {
                options: ["start", "center", "end", "baseline"],
              }),
            ],
          },
          {
            tag: "a-layout",
            label: "Layout 布局",
            icon: "i-ant-design:layout-outlined",
            snippet: "<a-layout><a-layout-sider /><a-layout /></a-layout>",
            attrs: [boolAttr("has-sider", "包含侧边栏")],
          },
          {
            tag: "a-layout-sider",
            label: "LayoutSider 侧边栏",
            icon: "i-ant-design:menu-fold-outlined",
            snippet: "<a-layout-sider collapsible />",
            attrs: [
              boolAttr("collapsed", "折叠"),
              boolAttr("collapsible", "可折叠"),
              boolAttr("reverse-arrow", "反向箭头"),
              textAttr("width", "宽度"),
              textAttr("theme", "主题", {
                options: ["light", "dark"],
              }),
            ],
          },
          {
            tag: "a-row",
            label: "Row 行",
            icon: "i-ant-design:table-outlined",
            snippet: '<a-row :gutter="16"><a-col :span="12" /></a-row>',
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
              textAttr("align", "垂直对齐", {
                options: ["top", "middle", "bottom"],
              }),
              boolAttr("wrap", "换行"),
            ],
          },
          {
            tag: "a-col",
            label: "Col 列",
            icon: "i-ant-design:border-outer-outlined",
            snippet: '<a-col :span="12" />',
            attrs: [
              textAttr("span", "跨度"),
              textAttr("offset", "偏移"),
              textAttr("push", "右移"),
              textAttr("pull", "左移"),
            ],
          },
          {
            tag: "a-affix",
            label: "Affix 固钉",
            icon: "i-ant-design:vertical-align-top-outlined",
            snippet:
              '<a-affix :offset-top="10"><a-button>固定</a-button></a-affix>',
            attrs: [
              textAttr("offset-top", "顶部偏移"),
              textAttr("offset-bottom", "底部偏移"),
              eventAttr("@change", "固定状态变化"),
            ],
          },
          {
            tag: "a-space-compact",
            label: "SpaceCompact 紧凑布局",
            icon: "i-ant-design:compress-outlined",
            snippet:
              "<a-space-compact><a-button>按钮</a-button></a-space-compact>",
            attrs: [
              textAttr("direction", "方向", {
                defaultValue: "horizontal",
                options: ["horizontal", "vertical"],
              }),
              boolAttr("block", "宽度撑满"),
              sizeAttr(),
            ],
          },
        ],
      },
      // ==================== 导航 ====================
      {
        group: "antdv/导航",
        items: [
          {
            tag: "a-breadcrumb",
            label: "Breadcrumb 面包屑",
            icon: "i-mdi:breadcrumb",
            snippet:
              "<a-breadcrumb><a-breadcrumb-item>首页</a-breadcrumb-item></a-breadcrumb>",
            attrs: [textAttr("separator", "分隔符")],
          },
          {
            tag: "a-dropdown",
            label: "Dropdown 下拉菜单",
            icon: "i-ant-design:caret-down-outlined",
            snippet: "<a-dropdown><a-button>菜单</a-button></a-dropdown>",
            attrs: [
              textAttr("trigger", "触发方式", {
                options: ["click", "hover", "contextmenu"],
              }),
              textAttr("placement", "弹出位置", {
                options: ["topLeft", "topRight", "bottomLeft", "bottomRight"],
              }),
              eventAttr("@visible-change", "显示状态变化"),
            ],
          },
          {
            tag: "a-menu",
            label: "Menu 菜单",
            icon: "i-ant-design:menu-outlined",
            snippet: '<a-menu mode="horizontal" />',
            attrs: [
              textAttr("mode", "模式", {
                options: ["vertical", "horizontal", "inline"],
              }),
              textAttr("theme", "主题", {
                options: ["light", "dark"],
              }),
              boolAttr("selectable", "可选中"),
              eventAttr("@click", "点击事件"),
              eventAttr("@open-change", "展开变化"),
            ],
          },
          {
            tag: "a-pagination",
            label: "Pagination 分页",
            icon: "i-ant-design:right-outlined",
            snippet: '<a-pagination :total="50" />',
            attrs: [
              textAttr("current", "当前页"),
              textAttr("page-size", "每页条数"),
              textAttr("total", "总条数"),
              boolAttr("show-size-changer", "显示条数切换"),
              boolAttr("show-quick-jumper", "显示快速跳转"),
              eventAttr("@change", "页码变化"),
              eventAttr("@show-size-change", "条数变化"),
            ],
          },
          {
            tag: "a-steps",
            label: "Steps 步骤条",
            icon: "i-ant-design:ordered-list-outlined",
            snippet: '<a-steps :current="1" />',
            attrs: [
              textAttr("current", "当前步骤"),
              textAttr("direction", "方向", {
                options: ["horizontal", "vertical"],
              }),
              textAttr("status", "状态", {
                options: ["wait", "process", "finish", "error"],
              }),
              eventAttr("@change", "步骤变化"),
            ],
          },
          {
            tag: "a-tabs",
            label: "Tabs 标签页",
            icon: "i-mdi:tab",
            snippet: '<a-tabs><a-tab-pane key="1" tab="标签1" /></a-tabs>',
            attrs: [
              textAttr("active-key", "当前激活"),
              textAttr("type", "类型", {
                options: ["line", "card", "editable-card"],
              }),
              textAttr("tab-position", "页签位置", {
                options: ["top", "right", "bottom", "left"],
              }),
              eventAttr("@change", "切换事件"),
              eventAttr("@edit", "编辑事件"),
            ],
          },
        ],
      },
      // ==================== 表单 ====================
      {
        group: "antdv/表单",
        items: [
          {
            tag: "a-input",
            label: "Input 输入框",
            icon: "i-vaadin:input",
            snippet: '<a-input placeholder="请输入" />',
            attrs: [
              placeholderAttr(),
              sizeAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr("max-length", "最大长度"),
              textAttr("addon-before", "前缀标签"),
              textAttr("addon-after", "后缀标签"),
              textAttr(":value", "绑定值"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@pressEnter", "回车事件"),
            ],
          },
          {
            tag: "a-input-password",
            label: "InputPassword 密码框",
            icon: "i-ant-design:lock-outlined",
            snippet: '<a-input-password placeholder="请输入密码" />',
            attrs: [
              placeholderAttr("请输入密码"),
              boolAttr("visibility-toggle", "显示切换按钮", "true"),
              disabledAttr(),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-select",
            label: "Select 选择器",
            icon: "i-ant-design:select-outlined",
            snippet: '<a-select placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr("请选择"),
              sizeAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr("mode", "模式", {
                options: ["multiple", "tags"],
              }),
              boolAttr("show-search", "可搜索"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@select", "选中事件"),
            ],
          },
          {
            tag: "a-date-picker",
            label: "DatePicker 日期",
            icon: "i-ant-design:calendar-outlined",
            snippet: '<a-date-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr("true"),
              textAttr("format", "格式"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@ok", "确定事件"),
            ],
          },
          {
            tag: "a-switch",
            label: "Switch 开关",
            icon: "i-ant-design:switcher-outlined",
            snippet: "<a-switch />",
            attrs: [
              disabledAttr(),
              boolAttr("loading", "加载中"),
              modelAttr("v-model:checked"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-checkbox",
            label: "Checkbox 复选",
            icon: "i-ant-design:check-square-outlined",
            snippet: "<a-checkbox>复选框</a-checkbox>",
            attrs: [
              disabledAttr(),
              modelAttr("v-model:checked"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-radio",
            label: "Radio 单选",
            icon: "i-ci:radio-fill",
            snippet: '<a-radio value="a">选项</a-radio>',
            attrs: [
              textAttr("value", "值", { defaultValue: "a" }),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-radio-group",
            label: "RadioGroup 单选组",
            icon: "i-ant-design:radio-button-checked",
            snippet:
              '<a-radio-group><a-radio value="a">A</a-radio></a-radio-group>',
            attrs: [
              modelAttr("v-model:value"),
              disabledAttr(),
              sizeAttr(),
              textAttr("option-type", "选项类型", {
                options: ["default", "button"],
              }),
              textAttr("button-style", "按钮样式", {
                options: ["outline", "solid"],
              }),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-checkbox-group",
            label: "CheckboxGroup 复选组",
            icon: "i-ant-design:check-circle-outlined",
            snippet:
              '<a-checkbox-group><a-checkbox value="a">A</a-checkbox></a-checkbox-group>',
            attrs: [
              modelAttr("v-model:value"),
              disabledAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-auto-complete",
            label: "AutoComplete 自动完成",
            icon: "i-ant-design:enter-outlined",
            snippet: '<a-auto-complete placeholder="请输入" />',
            attrs: [
              placeholderAttr(),
              disabledAttr(),
              allowClearAttr(),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@select", "选中事件"),
            ],
          },
          {
            tag: "a-cascader",
            label: "Cascader 级联选择",
            icon: "i-ant-design:bars-outlined",
            snippet: '<a-cascader placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr("请选择"),
              disabledAttr(),
              allowClearAttr(),
              boolAttr("change-on-select", "选择即改变"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-color-picker",
            label: "ColorPicker 颜色选择器",
            icon: "i-ant-design:bg-colors-outlined",
            snippet: "<a-color-picker />",
            attrs: [
              disabledAttr(),
              allowClearAttr(),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-range-picker",
            label: "RangePicker 日期范围",
            icon: "i-ant-design:calendar-two-tone-outlined",
            snippet: '<a-range-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr("true"),
              textAttr("format", "格式"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-text-area",
            label: "TextArea 文本域",
            icon: "i-ant-design:align-left-outlined",
            snippet: '<a-text-area placeholder="请输入" :rows="4" />',
            attrs: [
              placeholderAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr("max-length", "最大长度"),
              boolAttr("show-count", "显示字数"),
              textAttr("auto-size", "自适应高度"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-input-search",
            label: "InputSearch 搜索框",
            icon: "i-ant-design:search-outlined",
            snippet: '<a-input-search placeholder="搜索" enter-button />',
            attrs: [
              placeholderAttr("搜索"),
              sizeAttr(),
              disabledAttr(),
              boolAttr("enter-button", "搜索按钮"),
              modelAttr("v-model:value"),
              eventAttr("@search", "搜索事件"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-input-number",
            label: "InputNumber 数字输入",
            icon: "i-ant-design:field-number-outlined",
            snippet: '<a-input-number :min="0" :max="10" />',
            attrs: [
              placeholderAttr(),
              sizeAttr(),
              disabledAttr(),
              textAttr("min", "最小值"),
              textAttr("max", "最大值"),
              textAttr("step", "步长"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-mentions",
            label: "Mentions 提及",
            icon: "i-ant-design:at-outlined",
            snippet: '<a-mentions placeholder="请输入 @" />',
            attrs: [
              placeholderAttr("请输入 @"),
              disabledAttr(),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@select", "选中事件"),
            ],
          },
          {
            tag: "a-rate",
            label: "Rate 评分",
            icon: "i-ant-design:star-outlined",
            snippet: "<a-rate />",
            attrs: [
              textAttr("count", "星星总数"),
              boolAttr("allow-half", "允许半选"),
              disabledAttr(),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-slider",
            label: "Slider 滑动输入",
            icon: "i-ant-design:sliders-outlined",
            snippet: "<a-slider />",
            attrs: [
              textAttr("min", "最小值"),
              textAttr("max", "最大值"),
              textAttr("step", "步长"),
              disabledAttr(),
              boolAttr("range", "双滑块"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-time-picker",
            label: "TimePicker 时间",
            icon: "i-ant-design:clock-circle-outlined",
            snippet: '<a-time-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr("true"),
              textAttr("format", "格式"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-transfer",
            label: "Transfer 穿梭框",
            icon: "i-ant-design:swap-outlined",
            snippet: '<a-transfer :data-source="[]" />',
            attrs: [
              disabledAttr(),
              boolAttr("show-search", "可搜索"),
              modelAttr("v-model:target-keys"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-tree-select",
            label: "TreeSelect 树选择",
            icon: "i-ant-design:tree-structure-outlined",
            snippet:
              '<a-tree-select placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr("请选择"),
              disabledAttr(),
              allowClearAttr(),
              boolAttr("show-search", "可搜索"),
              boolAttr("tree-checkable", "可勾选"),
              modelAttr("v-model:value"),
              eventAttr("@change", "变化事件"),
              eventAttr("@select", "选中事件"),
            ],
          },
          {
            tag: "a-upload",
            label: "Upload 上传",
            icon: "i-ant-design:upload-outlined",
            snippet:
              '<a-upload action="https://api.example.com/upload"><a-button>上传</a-button></a-upload>',
            attrs: [
              textAttr("action", "上传地址"),
              boolAttr("multiple", "多选"),
              disabledAttr(),
              textAttr("accept", "接受文件类型"),
              textAttr("list-type", "列表样式", {
                options: ["text", "picture", "picture-card"],
              }),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-form",
            label: "Form 表单",
            icon: "i-ant-design:form-outlined",
            snippet: '<a-form layout="horizontal" />',
            attrs: [
              textAttr("layout", "布局", {
                defaultValue: "horizontal",
                options: ["horizontal", "vertical", "inline"],
              }),
              textAttr("label-col", "标签布局"),
              textAttr("wrapper-col", "控件布局"),
              eventAttr("@finish", "提交成功"),
              eventAttr("@finish-failed", "提交失败"),
            ],
          },
          {
            tag: "a-form-item",
            label: "FormItem 表单项",
            icon: "i-ant-design:border-inner-outlined",
            snippet:
              '<a-form-item label="标签" name="field"><a-input /></a-form-item>',
            attrs: [
              textAttr("label", "标签"),
              textAttr("name", "字段名"),
              textAttr("rules", "校验规则"),
              boolAttr("required", "必填"),
            ],
          },
        ],
      },
      // ==================== 反馈 ====================
      {
        group: "antdv/反馈",
        items: [
          {
            tag: "a-alert",
            label: "Alert 提示",
            icon: "i-ant-design:alert-outlined",
            snippet: '<a-alert message="提示信息" type="info" show-icon />',
            attrs: [
              textAttr("message", "主要内容", { defaultValue: "提示信息" }),
              textAttr("description", "辅助内容"),
              textAttr("type", "类型", {
                defaultValue: "info",
                options: ["success", "info", "warning", "error"],
              }),
              boolAttr("show-icon", "显示图标", "true"),
              boolAttr("closable", "可关闭"),
              boolAttr("banner", "边框模式"),
              eventAttr("@close", "关闭事件"),
            ],
          },
          {
            tag: "a-drawer",
            label: "Drawer 抽屉",
            icon: "i-ant-design:menu-unfold-outlined",
            snippet: '<a-drawer :open="false" title="标题">内容</a-drawer>',
            attrs: [
              textAttr(":open", "是否打开"),
              textAttr("placement", "位置", {
                defaultValue: "right",
                options: ["top", "right", "bottom", "left"],
              }),
              textAttr("width", "宽度"),
              boolAttr("mask", "显示遮罩"),
              boolAttr("mask-closable", "点击遮罩关闭", "true"),
              eventAttr("@close", "关闭事件"),
            ],
          },
          {
            tag: "a-modal",
            label: "Modal 对话框",
            icon: "i-ant-design:container-outlined",
            snippet: '<a-modal :open="false" title="标题">内容</a-modal>',
            attrs: [
              textAttr(":open", "是否打开"),
              textAttr("title", "标题"),
              boolAttr("centered", "垂直居中"),
              boolAttr("mask-closable", "点击遮罩关闭", "true"),
              textAttr("width", "宽度"),
              eventAttr("@ok", "确定事件"),
              eventAttr("@cancel", "取消事件"),
            ],
          },
          {
            tag: "a-popconfirm",
            label: "Popconfirm 气泡确认",
            icon: "i-ant-design:question-circle-outlined",
            snippet:
              '<a-popconfirm title="确认？" @confirm=""><a-button>删除</a-button></a-popconfirm>',
            attrs: [
              textAttr("title", "标题"),
              textAttr("ok-text", "确认按钮文字"),
              textAttr("cancel-text", "取消按钮文字"),
              disabledAttr(),
              eventAttr("@confirm", "确认事件"),
              eventAttr("@cancel", "取消事件"),
            ],
          },
          {
            tag: "a-progress",
            label: "Progress 进度条",
            icon: "i-ant-design:progress-outlined",
            snippet: '<a-progress :percent="50" />',
            attrs: [
              textAttr("percent", "百分比"),
              textAttr("type", "类型", {
                options: ["line", "circle", "dashboard"],
              }),
              textAttr("status", "状态", {
                options: ["success", "exception", "normal", "active"],
              }),
              boolAttr("show-info", "显示信息", "true"),
            ],
          },
          {
            tag: "a-result",
            label: "Result 结果",
            icon: "i-ant-design:check-circle-outlined",
            snippet: '<a-result status="success" title="成功" />',
            attrs: [
              textAttr("status", "状态", {
                defaultValue: "info",
                options: [
                  "success",
                  "error",
                  "info",
                  "warning",
                  "404",
                  "403",
                  "500",
                ],
              }),
              textAttr("title", "标题"),
              textAttr("sub-title", "副标题"),
            ],
          },
          {
            tag: "a-skeleton",
            label: "Skeleton 骨架屏",
            icon: "i-ant-design:loading-outlined",
            snippet: "<a-skeleton active />",
            attrs: [
              boolAttr("active", "动画效果"),
              boolAttr("loading", "加载中"),
              boolAttr("avatar", "显示头像"),
              boolAttr("paragraph", "显示段落", "true"),
              boolAttr("title", "显示标题", "true"),
            ],
          },
          {
            tag: "a-spin",
            label: "Spin 加载中",
            icon: "i-ant-design:loading-3-quarters-outlined",
            snippet: "<a-spin />",
            attrs: [
              boolAttr("spinning", "旋转中", "true"),
              sizeAttr(["small", "default", "large"]),
              textAttr("tip", "提示文字"),
              textAttr("delay", "延迟时间"),
            ],
          },
        ],
      },
      // ==================== 数据展示 ====================
      {
        group: "antdv/数据展示",
        items: [
          {
            tag: "a-card",
            label: "Card 卡片",
            icon: "i-ant-design:credit-card-outlined",
            snippet: '<a-card title="标题"><p>内容</p></a-card>',
            attrs: [
              textAttr("title", "标题", { defaultValue: "标题" }),
              boolAttr("bordered", "边框", "true"),
              boolAttr("hoverable", "悬浮效果"),
              textAttr("size", "尺寸", {
                options: ["default", "small"],
              }),
            ],
          },
          {
            tag: "a-avatar",
            label: "Avatar 头像",
            icon: "i-ant-design:user-outlined",
            snippet: '<a-avatar src="https://example.com/avatar.png" />',
            attrs: [
              textAttr("size", "尺寸", {
                options: ["large", "default", "small"],
              }),
              textAttr("shape", "形状", {
                options: ["circle", "square"],
              }),
              textAttr("src", "图片地址"),
              textAttr("icon", "图标"),
            ],
          },
          {
            tag: "a-badge",
            label: "Badge 徽标",
            icon: "i-ant-design:badge-outlined",
            snippet: '<a-badge count="9"><a-button>消息</a-button></a-badge>',
            attrs: [
              textAttr("count", "数量"),
              boolAttr("dot", "圆点"),
              textAttr("status", "状态", {
                options: [
                  "success",
                  "processing",
                  "default",
                  "error",
                  "warning",
                ],
              }),
              textAttr("color", "颜色"),
              textAttr("overflow-count", "溢出计数"),
            ],
          },
          {
            tag: "a-calendar",
            label: "Calendar 日历",
            icon: "i-ant-design:calendar-outlined",
            snippet: "<a-calendar />",
            attrs: [
              textAttr(":value", "当前日期"),
              textAttr("mode", "模式", {
                options: ["month", "year"],
              }),
              eventAttr("@change", "日期变化"),
              eventAttr("@select", "选择日期"),
            ],
          },
          {
            tag: "a-carousel",
            label: "Carousel 走马灯",
            icon: "i-ant-design:picture-outlined",
            snippet: `
            <a-carousel autoplay>
              <div>
                <h3 style="color:#fff; text-align:center;background:#364d79;height:160px;margin:0;line-height:160px">
                  1
                </h3>
              </div>
              <div>
                <h3 style="color:#fff; text-align:center;background:#364d79;height:160px;margin:0;line-height:160px">
                  2
                </h3>
              </div>
              <div>
                <h3 style="color:#fff; text-align:center;background:#364d79;height:160px;margin:0;line-height:160px">
                  3
                </h3>
              </div>
              <div>
                <h3 style="color:#fff; text-align:center;background:#364d79;height:160px;margin:0;line-height:160px">
                  4
                </h3>
              </div>
            </a-carousel>
            `,
            attrs: [
              boolAttr("autoplay", "自动切换"),
              boolAttr("dots", "显示指示点", "true"),
              textAttr("effect", "效果", {
                options: ["scrollx", "fade"],
              }),
              eventAttr("@change", "切换事件"),
              eventAttr("@after-change", "切换后事件"),
            ],
          },
          {
            tag: "a-collapse",
            label: "Collapse 折叠面板",
            icon: "i-ant-design:folder-open-outlined",
            snippet:
              '<a-collapse><a-collapse-panel key="1" header="标题">内容</a-collapse-panel></a-collapse>',
            attrs: [
              boolAttr("accordion", "手风琴"),
              boolAttr("bordered", "边框", "true"),
              boolAttr("ghost", "透明"),
              modelAttr("v-model:active-key"),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-descriptions",
            label: "Descriptions 描述列表",
            icon: "i-ant-design:profile-outlined",
            snippet: '<a-descriptions title="标题" :column="2" />',
            attrs: [
              textAttr("title", "标题"),
              boolAttr("bordered", "边框"),
              textAttr("column", "列数"),
              textAttr("size", "尺寸", {
                options: ["default", "middle", "small"],
              }),
              textAttr("layout", "布局", {
                options: ["horizontal", "vertical"],
              }),
            ],
          },
          {
            tag: "a-empty",
            label: "Empty 空状态",
            icon: "i-ant-design:inbox-outlined",
            snippet: '<a-empty description="暂无数据" />',
            attrs: [
              textAttr("description", "描述文字"),
              textAttr("image", "图片地址"),
            ],
          },
          {
            tag: "a-image",
            label: "Image 图片",
            icon: "i-ant-design:file-image-outlined",
            snippet: '<a-image src="https://example.com/image.png" />',
            attrs: [
              textAttr("src", "图片地址"),
              textAttr("width", "宽度"),
              textAttr("height", "高度"),
              boolAttr("preview", "预览", "true"),
              textAttr("fallback", "失败占位图"),
            ],
          },
          {
            tag: "a-popover",
            label: "Popover 气泡卡片",
            icon: "i-ant-design:message-outlined",
            snippet:
              '<a-popover title="标题" content="内容"><a-button>触发</a-button></a-popover>',
            attrs: [
              textAttr("title", "标题"),
              textAttr("trigger", "触发方式", {
                options: ["click", "hover", "focus"],
              }),
              textAttr("placement", "弹出位置", {
                options: ["top", "bottom", "left", "right"],
              }),
              eventAttr("@visible-change", "显示状态变化"),
            ],
          },
          {
            tag: "a-segmented",
            label: "Segmented 分段控制器",
            icon: "i-ant-design:control-outlined",
            snippet: "<a-segmented :options=\"['日', '周', '月']\" />",
            attrs: [
              modelAttr("v-model:value"),
              disabledAttr(),
              boolAttr("block", "宽度撑满"),
              sizeAttr(),
              eventAttr("@change", "变化事件"),
            ],
          },
          {
            tag: "a-statistic",
            label: "Statistic 统计数值",
            icon: "i-ant-design:number-outlined",
            snippet: '<a-statistic title="标题" :value="1000" />',
            attrs: [
              textAttr("title", "标题"),
              textAttr("value", "数值"),
              textAttr("precision", "小数位数"),
              textAttr("suffix", "后缀"),
              textAttr("prefix", "前缀"),
            ],
          },
          {
            tag: "a-table",
            label: "Table 表格",
            icon: "i-ant-design:table-outlined",
            snippet: '<a-table :columns="[]" :data-source="[]" row-key="id" />',
            attrs: [
              textAttr(":columns", "列配置"),
              textAttr(":data-source", "数据源"),
              textAttr("row-key", "行 key"),
              boolAttr("bordered", "边框"),
              textAttr("size", "尺寸", {
                options: ["default", "middle", "small"],
              }),
              eventAttr("@change", "分页/排序变化"),
            ],
          },
          {
            tag: "a-timeline",
            label: "Timeline 时间线",
            icon: "i-ant-design:history-outlined",
            snippet:
              "<a-timeline><a-timeline-item>步骤</a-timeline-item></a-timeline>",
            attrs: [
              textAttr("mode", "模式", {
                options: ["left", "alternate", "right"],
              }),
              boolAttr("pending", "最后一项"),
              boolAttr("reverse", "倒序"),
            ],
          },
          {
            tag: "a-tooltip",
            label: "Tooltip 文字提示",
            icon: "i-ant-design:info-circle-outlined",
            snippet: '<a-tooltip title="提示"><span>文字</span></a-tooltip>',
            attrs: [
              textAttr("title", "提示文字"),
              textAttr("trigger", "触发方式", {
                options: ["click", "hover", "focus"],
              }),
              textAttr("placement", "弹出位置", {
                options: ["top", "bottom", "left", "right"],
              }),
              textAttr("color", "颜色"),
            ],
          },
          {
            tag: "a-tree",
            label: "Tree 树形",
            icon: "i-ant-design:tree-outlined",
            snippet: '<a-tree :tree-data="[]" />',
            attrs: [
              textAttr(":tree-data", "树数据"),
              boolAttr("checkable", "可勾选"),
              boolAttr("selectable", "可选中"),
              boolAttr("default-expand-all", "默认展开全部"),
              eventAttr("@select", "选中事件"),
              eventAttr("@check", "勾选事件"),
            ],
          },
          {
            tag: "a-qrcode",
            label: "QRCode 二维码",
            icon: "i-ant-design:qrcode-outlined",
            snippet: '<a-qrcode value="https://example.com" />',
            attrs: [
              textAttr("value", "二维码内容"),
              textAttr("size", "尺寸"),
              textAttr("color", "前景色"),
              textAttr("background-color", "背景色"),
            ],
          },
          {
            tag: "a-watermark",
            label: "Watermark 水印",
            icon: "i-ant-design:watermark-outlined",
            snippet:
              '<a-watermark content="水印"><div style="height:200px" /></a-watermark>',
            attrs: [
              textAttr("content", "水印内容"),
              textAttr("gap", "间距"),
              textAttr("offset", "偏移"),
              textAttr("rotate", "旋转角度"),
            ],
          },
        ],
      },
    ],
  };
}
