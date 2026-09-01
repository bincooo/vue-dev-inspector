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
 * antdv 组件通过 `app.use(Antd)` 全局注册，`a-*` 标签无需声明 imports；
 * 走按需引入（`import { X } from "antdv-next"`）的项目传 capitalLetters: true，
 * 条目输出 PascalCase tag 并附带对应 import 声明。
 */
import type {
  ComponentAttr,
  ComponentConfigEntry,
} from '@vue-dev-inspector/shared';
import { loadScriptSpecifier } from '@vue-dev-inspector/utils';

// ---- 属性快捷构造（减少重复、保证命名/分组一致） ----

/** 布尔属性：options ["true","false"] + defaultValue */
const boolAttr = (
  name: string,
  label: string,
  defaultValue?: string,
): ComponentAttr => ({
  name,
  label,
  group: '属性',
  defaultValue,
  options: ['true', 'false'],
  setter: ['BoolSetter', 'CodeSetter'],
});

/** 尺寸属性（large/middle/small） */
const sizeAttr = (
  options: string[] = ['large', 'middle', 'small'],
): ComponentAttr => ({
  name: 'size',
  label: '尺寸',
  group: '属性',
  options,
});

/** 禁用属性（布尔，默认 false） */
const disabledAttr = (): ComponentAttr => boolAttr('disabled', '禁用');

/** 允许清除属性（布尔） */
const allowClearAttr = (defaultValue?: string): ComponentAttr =>
  boolAttr('allow-clear', '允许清除', defaultValue);

/** 事件属性 */
const eventAttr = (
  name: string,
  label: string,
  defaultValue: string = '(event) => { }',
): ComponentAttr => ({
  name,
  label,
  group: '事件',
  defaultValue,
});

/** 普通属性（可透传 defaultValue/options 等） */
const textAttr = (
  name: string,
  label: string,
  extra: Partial<ComponentAttr> = {},
): ComponentAttr => ({
  name,
  label,
  group: '属性',
  ...extra,
});

/** v-model 双向绑定属性 */
const modelAttr = (name: string, label = '双向绑定'): ComponentAttr => ({
  name,
  label,
  group: '属性',
});

/** 占位文本属性 */
const placeholderAttr = (defaultValue = '请输入'): ComponentAttr => ({
  name: 'placeholder',
  label: '占位文本',
  group: '属性',
  defaultValue,
});

/**
 * 返回 Ant Design Vue 组件目录。
 *
 * @param capitalLetters true 时条目输出 PascalCase tag / snippet 并附带
 *   `import { X } from "antdv-next";` 声明（按需引入项目用）；缺省 false
 *   输出 `a-*` kebab-case 且不带 imports（app.use(Antd) 全局注册项目用）。
 */
export default function (
  capitalLetters: boolean = false,
): ComponentConfigEntry {
  return {
    name: 'antdv',
    /** 物料库自身图标 -- 呈现在抽屉左侧 tab 上 */
    icon: 'i-ant-design:ant-design-outlined',
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
    expand: loadScriptSpecifier(import.meta.resolve, './dist/expand.iife.js'),
    groups: [
      // ==================== 通用 ====================
      {
        group: 'antdv/通用',
        items: [
          {
            tag: capitalLetters ? 'Button' : 'a-button',
            imports: capitalLetters
              ? ['import { Button } from "antdv-next";']
              : undefined,
            label: 'Button 按钮',
            icon: 'i-vaadin:button',
            snippet: capitalLetters
              ? '<Button type="primary">按钮</Button>'
              : '<a-button type="primary">按钮</a-button>',
            attrs: [
              textAttr('type', '类型', {
                defaultValue: 'primary',
                options: ['primary', 'default', 'dashed', 'link', 'text'],
              }),
              sizeAttr(),
              boolAttr('loading', '加载中'),
              disabledAttr(),
              boolAttr('danger', '危险按钮'),
              boolAttr('ghost', '幽灵属性'),
              boolAttr('block', '宽度撑满'),
              textAttr('href', '链接地址'),
              eventAttr('@click', '点击事件'),
              eventAttr('@focus', '聚焦事件'),
              eventAttr('@blur', '失焦事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Tag' : 'a-tag',
            imports: capitalLetters
              ? ['import { Tag } from "antdv-next";']
              : undefined,
            label: 'Tag 标签',
            icon: 'i-ant-design:tag-outlined',
            snippet: capitalLetters
              ? '<Tag color="blue">标签</Tag>'
              : '<a-tag color="blue">标签</a-tag>',
            attrs: [
              textAttr('color', '颜色', {
                defaultValue: 'blue',
                options: [
                  'blue',
                  'green',
                  'red',
                  'orange',
                  'purple',
                  'cyan',
                  'gold',
                ],
              }),
              boolAttr('closable', '可关闭'),
              boolAttr('bordered', '边框'),
              eventAttr('@click', '点击事件'),
              eventAttr('@close', '关闭事件'),
            ],
          },
          {
            tag: capitalLetters ? 'TypographyText' : 'a-typography-text',
            imports: capitalLetters
              ? ['import { TypographyText } from "antdv-next";']
              : undefined,
            label: 'TypographyText 文本',
            icon: 'i-ant-design:font-colors-outlined',
            snippet: capitalLetters
              ? '<TypographyText>文本内容</TypographyText>'
              : '<a-typography-text>文本内容</a-typography-text>',
            attrs: [
              textAttr('type', '类型', {
                options: ['secondary', 'success', 'warning', 'danger'],
              }),
              boolAttr('strong', '加粗'),
              boolAttr('italic', '斜体'),
              boolAttr('underline', '下划线'),
              boolAttr('delete', '删除线'),
              boolAttr('copyable', '可复制'),
              boolAttr('mark', '标记'),
              eventAttr('@copy', '复制事件'),
            ],
          },
          {
            tag: capitalLetters ? 'TypographyTitle' : 'a-typography-title',
            imports: capitalLetters
              ? ['import { TypographyTitle } from "antdv-next";']
              : undefined,
            label: 'TypographyTitle 标题',
            icon: 'i-ant-design:format-painter-outlined',
            snippet: capitalLetters
              ? '<TypographyTitle :level="3">标题</TypographyTitle>'
              : '<a-typography-title :level="3">标题</a-typography-title>',
            attrs: [
              textAttr('level', '层级', {
                defaultValue: '1',
                options: ['1', '2', '3', '4', '5'],
              }),
              textAttr('type', '类型', {
                options: ['secondary', 'success', 'warning', 'danger'],
              }),
              boolAttr('copyable', '可复制'),
              boolAttr('ellipsis', '省略'),
              eventAttr('@copy', '复制事件'),
            ],
          },
          {
            tag: capitalLetters
              ? 'TypographyParagraph'
              : 'a-typography-paragraph',
            imports: capitalLetters
              ? ['import { TypographyParagraph } from "antdv-next";']
              : undefined,
            label: 'TypographyParagraph 段落',
            icon: 'i-ant-design:align-left-outlined',
            snippet: capitalLetters
              ? '<TypographyParagraph>段落内容</TypographyParagraph>'
              : '<a-typography-paragraph>段落内容</a-typography-paragraph>',
            attrs: [
              textAttr('type', '类型', {
                options: ['secondary', 'success', 'warning', 'danger'],
              }),
              boolAttr('copyable', '可复制'),
              boolAttr('editable', '可编辑'),
              boolAttr('ellipsis', '省略'),
              eventAttr('@copy', '复制事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Flex' : 'a-flex',
            imports: capitalLetters
              ? ['import { Flex } from "antdv-next";']
              : undefined,
            label: 'Flex 弹性布局',
            icon: 'i-ant-design:appstore-outlined',
            snippet: capitalLetters
              ? '<Flex gap="small"><span>项</span></Flex>'
              : '<a-flex gap="small"><span>项</span></a-flex>',
            attrs: [
              textAttr('gap', '间距', {
                options: ['small', 'middle', 'large'],
              }),
              textAttr('vertical', '垂直方向', {
                options: ['true', 'false'],
              }),
              textAttr('justify', '主轴对齐', {
                options: [
                  'start',
                  'center',
                  'end',
                  'space-between',
                  'space-around',
                ],
              }),
              textAttr('align', '交叉轴对齐', {
                options: ['start', 'center', 'end', 'stretch'],
              }),
              boolAttr('wrap', '换行'),
            ],
          },
        ],
      },
      // ==================== 布局 ====================
      {
        group: 'antdv/布局',
        items: [
          {
            tag: capitalLetters ? 'Divider' : 'a-divider',
            imports: capitalLetters
              ? ['import { Divider } from "antdv-next";']
              : undefined,
            label: 'Divider 分割线',
            icon: 'i-pixel:divider',
            snippet: capitalLetters
              ? '<Divider plain>标题</Divider>'
              : '<a-divider plain>标题</a-divider>',
            attrs: [
              textAttr('type', '类型', {
                defaultValue: 'horizontal',
                options: ['horizontal', 'vertical'],
              }),
              boolAttr('dashed', '虚线'),
              textAttr('orientation', '文字方向', {
                options: ['left', 'center', 'right'],
              }),
              textAttr('size', '间距大小，仅对水平布局有效', {
                options: ['small', 'middle', 'large'],
              }),
              boolAttr('plain', '普通文字'),
              textAttr('title-placement', '分割线标题的位置', {
                options: ['start', 'center', 'end'],
              }),
            ],
          },
          {
            tag: capitalLetters ? 'Space' : 'a-space',
            imports: capitalLetters
              ? ['import { Space } from "antdv-next";']
              : undefined,
            label: 'Space 间距',
            icon: 'i-ant-design:column-height-outlined',
            snippet: capitalLetters
              ? '<Space><span>Space项</span></Space>'
              : '<a-space><span>Space项</span></a-space>',
            attrs: [
              textAttr('direction', '方向', {
                defaultValue: 'horizontal',
                options: ['horizontal', 'vertical'],
              }),
              textAttr('size', '间距', {
                options: ['small', 'middle', 'large'],
              }),
              boolAttr('wrap', '换行'),
              textAttr('align', '对齐', {
                options: ['start', 'center', 'end', 'baseline'],
              }),
            ],
          },
          {
            tag: capitalLetters ? 'Layout' : 'a-layout',
            imports: capitalLetters
              ? ['import { Layout, LayoutSider } from "antdv-next";']
              : undefined,
            label: 'Layout 布局',
            icon: 'i-ant-design:layout-outlined',
            snippet: capitalLetters
              ? '<Layout><LayoutSider /><Layout /></Layout>'
              : '<a-layout><a-layout-sider /><a-layout /></a-layout>',
            attrs: [boolAttr('has-sider', '包含侧边栏')],
          },
          {
            tag: capitalLetters ? 'LayoutSider' : 'a-layout-sider',
            imports: capitalLetters
              ? ['import { LayoutSider } from "antdv-next";']
              : undefined,
            label: 'LayoutSider 侧边栏',
            icon: 'i-ant-design:menu-fold-outlined',
            snippet: capitalLetters
              ? '<LayoutSider collapsible />'
              : '<a-layout-sider collapsible />',
            attrs: [
              boolAttr('collapsed', '折叠'),
              boolAttr('collapsible', '可折叠'),
              boolAttr('reverse-arrow', '反向箭头'),
              textAttr('width', '宽度'),
              textAttr('theme', '主题', {
                options: ['light', 'dark'],
              }),
            ],
          },
          {
            tag: capitalLetters ? 'Row' : 'a-row',
            imports: capitalLetters
              ? ['import { Row, Col } from "antdv-next";']
              : undefined,
            label: 'Row 行',
            icon: 'i-ant-design:table-outlined',
            snippet: capitalLetters
              ? '<Row :gutter="8"><Col :span="11">COL1</Col><Col :span="11">COL2</Col></Row>'
              : '<a-row :gutter="8"><a-col :span="11">COL1</a-col><a-col :span="11">COL2</a-col></a-row>',
            attrs: [
              textAttr('gutter', '间距'),
              textAttr('justify', '水平对齐', {
                options: [
                  'start',
                  'center',
                  'end',
                  'space-between',
                  'space-around',
                ],
              }),
              textAttr('align', '垂直对齐', {
                options: ['top', 'middle', 'bottom'],
              }),
              boolAttr('wrap', '换行'),
            ],
          },
          {
            tag: capitalLetters ? 'Col' : 'a-col',
            imports: capitalLetters
              ? ['import { Col } from "antdv-next";']
              : undefined,
            label: 'Col 列',
            icon: 'i-ant-design:border-outer-outlined',
            snippet: capitalLetters
              ? '<Col :span="11">COL1</Col>'
              : '<a-col :span="11">COL1</a-col>',
            attrs: [
              textAttr('span', '跨度'),
              textAttr('offset', '偏移'),
              textAttr('push', '右移'),
              textAttr('pull', '左移'),
            ],
          },
          {
            tag: capitalLetters ? 'Affix' : 'a-affix',
            imports: capitalLetters
              ? ['import { Affix, Button } from "antdv-next";']
              : undefined,
            label: 'Affix 固钉',
            icon: 'i-ant-design:vertical-align-top-outlined',
            snippet: capitalLetters
              ? '<Affix :offset-top="10"><Button>固定</Button></Affix>'
              : '<a-affix :offset-top="10"><a-button>固定</a-button></a-affix>',
            attrs: [
              textAttr('offset-top', '顶部偏移'),
              textAttr('offset-bottom', '底部偏移'),
              eventAttr('@change', '固定状态变化'),
            ],
          },
          {
            tag: capitalLetters ? 'SpaceCompact' : 'a-space-compact',
            imports: capitalLetters
              ? ['import { SpaceCompact, Button } from "antdv-next";']
              : undefined,
            label: 'SpaceCompact 紧凑布局',
            icon: 'i-ant-design:compress-outlined',
            snippet: capitalLetters
              ? '<SpaceCompact><Button>按钮</Button></SpaceCompact>'
              : '<a-space-compact><a-button>按钮</a-button></a-space-compact>',
            attrs: [
              textAttr('direction', '方向', {
                defaultValue: 'horizontal',
                options: ['horizontal', 'vertical'],
              }),
              boolAttr('block', '宽度撑满'),
              sizeAttr(),
            ],
          },
        ],
      },
      // ==================== 导航 ====================
      {
        group: 'antdv/导航',
        items: [
          {
            tag: capitalLetters ? 'Breadcrumb' : 'a-breadcrumb',
            imports: capitalLetters
              ? ['import { Breadcrumb, BreadcrumbItem } from "antdv-next";']
              : undefined,
            label: 'Breadcrumb 面包屑',
            icon: 'i-mdi:breadcrumb',
            snippet: capitalLetters
              ? '<Breadcrumb><BreadcrumbItem>首页</BreadcrumbItem></Breadcrumb>'
              : '<a-breadcrumb><a-breadcrumb-item>首页</a-breadcrumb-item></a-breadcrumb>',
            attrs: [textAttr('separator', '分隔符')],
          },
          {
            tag: capitalLetters ? 'Dropdown' : 'a-dropdown',
            imports: capitalLetters
              ? ['import { Dropdown, Button } from "antdv-next";']
              : undefined,
            label: 'Dropdown 下拉菜单',
            icon: 'i-ant-design:caret-down-outlined',
            snippet: capitalLetters
              ? '<Dropdown><Button>菜单</Button></Dropdown>'
              : '<a-dropdown><a-button>菜单</a-button></a-dropdown>',
            attrs: [
              textAttr('trigger', '触发方式', {
                options: ['click', 'hover', 'contextmenu'],
              }),
              textAttr('placement', '弹出位置', {
                options: ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'],
              }),
              eventAttr('@visible-change', '显示状态变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Menu' : 'a-menu',
            imports: capitalLetters
              ? ['import { Menu } from "antdv-next";']
              : undefined,
            label: 'Menu 菜单',
            icon: 'i-ant-design:menu-outlined',
            snippet: capitalLetters
              ? '<Menu mode="horizontal" />'
              : '<a-menu mode="horizontal" />',
            attrs: [
              textAttr('mode', '模式', {
                options: ['vertical', 'horizontal', 'inline'],
              }),
              textAttr('theme', '主题', {
                options: ['light', 'dark'],
              }),
              boolAttr('selectable', '可选中'),
              eventAttr('@click', '点击事件'),
              eventAttr('@open-change', '展开变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Pagination' : 'a-pagination',
            imports: capitalLetters
              ? ['import { Pagination } from "antdv-next";']
              : undefined,
            label: 'Pagination 分页',
            icon: 'i-ant-design:right-outlined',
            snippet: capitalLetters
              ? '<Pagination :total="50" />'
              : '<a-pagination :total="50" />',
            attrs: [
              textAttr('current', '当前页'),
              textAttr('page-size', '每页条数'),
              textAttr('total', '总条数'),
              boolAttr('show-size-changer', '显示条数切换'),
              boolAttr('show-quick-jumper', '显示快速跳转'),
              eventAttr('@change', '页码变化'),
              eventAttr('@show-size-change', '条数变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Steps' : 'a-steps',
            imports: capitalLetters
              ? ['import { Steps } from "antdv-next";']
              : undefined,
            label: 'Steps 步骤条',
            icon: 'i-ant-design:ordered-list-outlined',
            snippet: capitalLetters
              ? '<Steps :current="1" />'
              : '<a-steps :current="1" />',
            attrs: [
              textAttr('current', '当前步骤'),
              textAttr('direction', '方向', {
                options: ['horizontal', 'vertical'],
              }),
              textAttr('status', '状态', {
                options: ['wait', 'process', 'finish', 'error'],
              }),
              eventAttr('@change', '步骤变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Tabs' : 'a-tabs',
            imports: capitalLetters
              ? ['import { Tabs, TabPane } from "antdv-next";']
              : undefined,
            label: 'Tabs 标签页',
            icon: 'i-mdi:tab',
            snippet: capitalLetters
              ? '<Tabs><TabPane key="1" tab="标签1" /></Tabs>'
              : '<a-tabs><a-tab-pane key="1" tab="标签1" /></a-tabs>',
            attrs: [
              textAttr('active-key', '当前激活'),
              textAttr('type', '类型', {
                options: ['line', 'card', 'editable-card'],
              }),
              textAttr('tab-position', '页签位置', {
                options: ['top', 'right', 'bottom', 'left'],
              }),
              eventAttr('@change', '切换事件'),
              eventAttr('@edit', '编辑事件'),
            ],
          },
        ],
      },
      // ==================== 表单 ====================
      {
        group: 'antdv/表单',
        items: [
          {
            tag: capitalLetters ? 'Input' : 'a-input',
            imports: capitalLetters
              ? ['import { Input } from "antdv-next";']
              : undefined,
            label: 'Input 输入框',
            icon: 'i-vaadin:input',
            snippet: capitalLetters
              ? '<Input placeholder="请输入" />'
              : '<a-input placeholder="请输入" />',
            attrs: [
              placeholderAttr(),
              sizeAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr('max-length', '最大长度'),
              textAttr('addon-before', '前缀标签'),
              textAttr('addon-after', '后缀标签'),
              textAttr(':value', '绑定值'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@pressEnter', '回车事件'),
            ],
          },
          {
            tag: capitalLetters ? 'InputPassword' : 'a-input-password',
            imports: capitalLetters
              ? ['import { InputPassword } from "antdv-next";']
              : undefined,
            label: 'InputPassword 密码框',
            icon: 'i-ant-design:lock-outlined',
            snippet: capitalLetters
              ? '<InputPassword placeholder="请输入密码" />'
              : '<a-input-password placeholder="请输入密码" />',
            attrs: [
              placeholderAttr('请输入密码'),
              boolAttr('visibility-toggle', '显示切换按钮', 'true'),
              disabledAttr(),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Select' : 'a-select',
            imports: capitalLetters
              ? ['import { Select } from "antdv-next";']
              : undefined,
            label: 'Select 选择器',
            icon: 'i-ant-design:select-outlined',
            snippet: capitalLetters
              ? '<Select placeholder="请选择" style="width:100%" />'
              : '<a-select placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr('请选择'),
              sizeAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr('mode', '模式', {
                options: ['multiple', 'tags'],
              }),
              boolAttr('show-search', '可搜索'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@select', '选中事件'),
            ],
          },
          {
            tag: capitalLetters ? 'DatePicker' : 'a-date-picker',
            imports: capitalLetters
              ? ['import { DatePicker } from "antdv-next";']
              : undefined,
            label: 'DatePicker 日期',
            icon: 'i-ant-design:calendar-outlined',
            snippet: capitalLetters
              ? '<DatePicker style="width:100%" />'
              : '<a-date-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr('true'),
              textAttr('format', '格式'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@ok', '确定事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Switch' : 'a-switch',
            imports: capitalLetters
              ? ['import { Switch } from "antdv-next";']
              : undefined,
            label: 'Switch 开关',
            icon: 'i-ant-design:switcher-outlined',
            snippet: capitalLetters ? '<Switch />' : '<a-switch />',
            attrs: [
              disabledAttr(),
              boolAttr('loading', '加载中'),
              modelAttr('v-model:checked'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Checkbox' : 'a-checkbox',
            imports: capitalLetters
              ? ['import { Checkbox } from "antdv-next";']
              : undefined,
            label: 'Checkbox 复选',
            icon: 'i-ant-design:check-square-outlined',
            snippet: capitalLetters
              ? '<Checkbox>复选框</Checkbox>'
              : '<a-checkbox>复选框</a-checkbox>',
            attrs: [
              disabledAttr(),
              modelAttr('v-model:checked'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Radio' : 'a-radio',
            imports: capitalLetters
              ? ['import { Radio } from "antdv-next";']
              : undefined,
            label: 'Radio 单选',
            icon: 'i-ci:radio-fill',
            snippet: capitalLetters
              ? '<Radio value="a">选项</Radio>'
              : '<a-radio value="a">选项</a-radio>',
            attrs: [
              textAttr('value', '值', { defaultValue: 'a' }),
              disabledAttr(),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'RadioGroup' : 'a-radio-group',
            imports: capitalLetters
              ? ['import { RadioGroup, Radio } from "antdv-next";']
              : undefined,
            label: 'RadioGroup 单选组',
            icon: 'i-ant-design:radio-button-checked',
            snippet: capitalLetters
              ? '<RadioGroup><Radio value="a">A</Radio></RadioGroup>'
              : '<a-radio-group><a-radio value="a">A</a-radio></a-radio-group>',
            attrs: [
              modelAttr('v-model:value'),
              disabledAttr(),
              sizeAttr(),
              textAttr('option-type', '选项类型', {
                options: ['default', 'button'],
              }),
              textAttr('button-style', '按钮样式', {
                options: ['outline', 'solid'],
              }),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'CheckboxGroup' : 'a-checkbox-group',
            imports: capitalLetters
              ? ['import { CheckboxGroup, Checkbox } from "antdv-next";']
              : undefined,
            label: 'CheckboxGroup 复选组',
            icon: 'i-ant-design:check-circle-outlined',
            snippet: capitalLetters
              ? '<CheckboxGroup><Checkbox value="a">A</Checkbox></CheckboxGroup>'
              : '<a-checkbox-group><a-checkbox value="a">A</a-checkbox></a-checkbox-group>',
            attrs: [
              modelAttr('v-model:value'),
              disabledAttr(),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'AutoComplete' : 'a-auto-complete',
            imports: capitalLetters
              ? ['import { AutoComplete } from "antdv-next";']
              : undefined,
            label: 'AutoComplete 自动完成',
            icon: 'i-ant-design:enter-outlined',
            snippet: capitalLetters
              ? '<AutoComplete placeholder="请输入" />'
              : '<a-auto-complete placeholder="请输入" />',
            attrs: [
              placeholderAttr(),
              disabledAttr(),
              allowClearAttr(),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@select', '选中事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Cascader' : 'a-cascader',
            imports: capitalLetters
              ? ['import { Cascader } from "antdv-next";']
              : undefined,
            label: 'Cascader 级联选择',
            icon: 'i-ant-design:bars-outlined',
            snippet: capitalLetters
              ? '<Cascader placeholder="请选择" style="width:100%" />'
              : '<a-cascader placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr('请选择'),
              disabledAttr(),
              allowClearAttr(),
              boolAttr('change-on-select', '选择即改变'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'ColorPicker' : 'a-color-picker',
            imports: capitalLetters
              ? ['import { ColorPicker } from "antdv-next";']
              : undefined,
            label: 'ColorPicker 颜色选择器',
            icon: 'i-ant-design:bg-colors-outlined',
            snippet: capitalLetters ? '<ColorPicker />' : '<a-color-picker />',
            attrs: [
              disabledAttr(),
              allowClearAttr(),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'DateRangePicker' : 'a-range-picker',
            imports: capitalLetters
              ? ['import { DateRangePicker } from "antdv-next";']
              : undefined,
            label: 'RangePicker 日期范围',
            icon: 'i-ant-design:calendar-two-tone-outlined',
            snippet: capitalLetters
              ? '<DateRangePicker style="width:100%" />'
              : '<a-range-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr('format', '格式'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'TextArea' : 'a-text-area',
            imports: capitalLetters
              ? ['import { TextArea } from "antdv-next";']
              : undefined,
            label: 'TextArea 文本域',
            icon: 'i-ant-design:align-left-outlined',
            snippet: capitalLetters
              ? '<TextArea placeholder="请输入" :rows="4" />'
              : '<a-text-area placeholder="请输入" :rows="4" />',
            attrs: [
              placeholderAttr(),
              disabledAttr(),
              allowClearAttr(),
              textAttr('max-length', '最大长度'),
              boolAttr('show-count', '显示字数'),
              textAttr('auto-size', '自适应高度'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'InputSearch' : 'a-input-search',
            imports: capitalLetters
              ? ['import { InputSearch } from "antdv-next";']
              : undefined,
            label: 'InputSearch 搜索框',
            icon: 'i-ant-design:search-outlined',
            snippet: capitalLetters
              ? '<InputSearch placeholder="搜索" enter-button />'
              : '<a-input-search placeholder="搜索" enter-button />',
            attrs: [
              placeholderAttr('搜索'),
              sizeAttr(),
              disabledAttr(),
              boolAttr('enter-button', '搜索按钮'),
              modelAttr('v-model:value'),
              eventAttr('@search', '搜索事件'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'InputNumber' : 'a-input-number',
            imports: capitalLetters
              ? ['import { InputNumber } from "antdv-next";']
              : undefined,
            label: 'InputNumber 数字输入',
            icon: 'i-ant-design:field-number-outlined',
            snippet: capitalLetters
              ? '<InputNumber :min="0" :max="10" />'
              : '<a-input-number :min="0" :max="10" />',
            attrs: [
              placeholderAttr(),
              sizeAttr(),
              disabledAttr(),
              textAttr('min', '最小值'),
              textAttr('max', '最大值'),
              textAttr('step', '步长'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Mentions' : 'a-mentions',
            imports: capitalLetters
              ? ['import { Mentions } from "antdv-next";']
              : undefined,
            label: 'Mentions 提及',
            icon: 'i-ant-design:at-outlined',
            snippet: capitalLetters
              ? '<Mentions placeholder="请输入 @" />'
              : '<a-mentions placeholder="请输入 @" />',
            attrs: [
              placeholderAttr('请输入 @'),
              disabledAttr(),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@select', '选中事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Rate' : 'a-rate',
            imports: capitalLetters
              ? ['import { Rate } from "antdv-next";']
              : undefined,
            label: 'Rate 评分',
            icon: 'i-ant-design:star-outlined',
            snippet: capitalLetters ? '<Rate />' : '<a-rate />',
            attrs: [
              textAttr('count', '星星总数'),
              boolAttr('allow-half', '允许半选'),
              disabledAttr(),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Slider' : 'a-slider',
            imports: capitalLetters
              ? ['import { Slider } from "antdv-next";']
              : undefined,
            label: 'Slider 滑动输入',
            icon: 'i-ant-design:sliders-outlined',
            snippet: capitalLetters ? '<Slider />' : '<a-slider />',
            attrs: [
              textAttr('min', '最小值'),
              textAttr('max', '最大值'),
              textAttr('step', '步长'),
              disabledAttr(),
              boolAttr('range', '双滑块'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'TimePicker' : 'a-time-picker',
            imports: capitalLetters
              ? ['import { TimePicker } from "antdv-next";']
              : undefined,
            label: 'TimePicker 时间',
            icon: 'i-ant-design:clock-circle-outlined',
            snippet: capitalLetters
              ? '<TimePicker style="width:100%" />'
              : '<a-time-picker style="width:100%" />',
            attrs: [
              sizeAttr(),
              disabledAttr(),
              allowClearAttr('true'),
              textAttr('format', '格式'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Transfer' : 'a-transfer',
            imports: capitalLetters
              ? ['import { Transfer } from "antdv-next";']
              : undefined,
            label: 'Transfer 穿梭框',
            icon: 'i-ant-design:swap-outlined',
            snippet: capitalLetters
              ? '<Transfer :data-source="[]" />'
              : '<a-transfer :data-source="[]" />',
            attrs: [
              disabledAttr(),
              boolAttr('show-search', '可搜索'),
              modelAttr('v-model:target-keys'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'TreeSelect' : 'a-tree-select',
            imports: capitalLetters
              ? ['import { TreeSelect } from "antdv-next";']
              : undefined,
            label: 'TreeSelect 树选择',
            icon: 'i-ant-design:tree-structure-outlined',
            snippet: capitalLetters
              ? '<TreeSelect placeholder="请选择" style="width:100%" />'
              : '<a-tree-select placeholder="请选择" style="width:100%" />',
            attrs: [
              placeholderAttr('请选择'),
              disabledAttr(),
              allowClearAttr(),
              boolAttr('show-search', '可搜索'),
              boolAttr('tree-checkable', '可勾选'),
              modelAttr('v-model:value'),
              eventAttr('@change', '变化事件'),
              eventAttr('@select', '选中事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Upload' : 'a-upload',
            imports: capitalLetters
              ? ['import { Upload, Button } from "antdv-next";']
              : undefined,
            label: 'Upload 上传',
            icon: 'i-ant-design:upload-outlined',
            snippet: capitalLetters
              ? '<Upload action="https://api.example.com/upload"><Button>上传</Button></Upload>'
              : '<a-upload action="https://api.example.com/upload"><a-button>上传</a-button></a-upload>',
            attrs: [
              textAttr('action', '上传地址'),
              boolAttr('multiple', '多选'),
              disabledAttr(),
              textAttr('accept', '接受文件类型'),
              textAttr('list-type', '列表样式', {
                options: ['text', 'picture', 'picture-card'],
              }),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Form' : 'a-form',
            imports: capitalLetters
              ? ['import { Form } from "antdv-next";']
              : undefined,
            label: 'Form 表单',
            icon: 'i-ant-design:form-outlined',
            snippet: capitalLetters
              ? '<Form layout="horizontal" />'
              : '<a-form layout="horizontal" />',
            attrs: [
              textAttr('layout', '布局', {
                defaultValue: 'horizontal',
                options: ['horizontal', 'vertical', 'inline'],
              }),
              textAttr('label-col', '标签布局'),
              textAttr('wrapper-col', '控件布局'),
              eventAttr('@finish', '提交成功'),
              eventAttr('@finish-failed', '提交失败'),
            ],
          },
          {
            tag: capitalLetters ? 'FormItem' : 'a-form-item',
            imports: capitalLetters
              ? ['import { FormItem, Input } from "antdv-next";']
              : undefined,
            label: 'FormItem 表单项',
            icon: 'i-ant-design:border-inner-outlined',
            snippet: capitalLetters
              ? '<FormItem label="标签" name="field"><Input /></FormItem>'
              : '<a-form-item label="标签" name="field"><a-input /></a-form-item>',
            attrs: [
              textAttr('label', '标签'),
              textAttr('name', '字段名'),
              textAttr('rules', '校验规则'),
              boolAttr('required', '必填'),
            ],
          },
        ],
      },
      // ==================== 反馈 ====================
      {
        group: 'antdv/反馈',
        items: [
          {
            tag: capitalLetters ? 'Alert' : 'a-alert',
            imports: capitalLetters
              ? ['import { Alert } from "antdv-next";']
              : undefined,
            label: 'Alert 提示',
            icon: 'i-ant-design:alert-outlined',
            snippet: capitalLetters
              ? '<Alert message="提示信息" type="info" show-icon />'
              : '<a-alert message="提示信息" type="info" show-icon />',
            attrs: [
              textAttr('message', '主要内容', { defaultValue: '提示信息' }),
              textAttr('description', '辅助内容'),
              textAttr('type', '类型', {
                defaultValue: 'info',
                options: ['success', 'info', 'warning', 'error'],
              }),
              boolAttr('show-icon', '显示图标', 'true'),
              boolAttr('closable', '可关闭'),
              boolAttr('banner', '边框模式'),
              eventAttr('@close', '关闭事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Drawer' : 'a-drawer',
            imports: capitalLetters
              ? ['import { Drawer } from "antdv-next";']
              : undefined,
            label: 'Drawer 抽屉',
            icon: 'i-ant-design:menu-unfold-outlined',
            snippet: capitalLetters
              ? '<Drawer :open="false" title="标题">内容</Drawer>'
              : '<a-drawer :open="false" title="标题">内容</a-drawer>',
            attrs: [
              textAttr(':open', '是否打开'),
              textAttr('placement', '位置', {
                defaultValue: 'right',
                options: ['top', 'right', 'bottom', 'left'],
              }),
              textAttr('width', '宽度'),
              boolAttr('mask', '显示遮罩'),
              boolAttr('mask-closable', '点击遮罩关闭', 'true'),
              eventAttr('@close', '关闭事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Modal' : 'a-modal',
            imports: capitalLetters
              ? ['import { Modal } from "antdv-next";']
              : undefined,
            label: 'Modal 对话框',
            icon: 'i-ant-design:container-outlined',
            snippet: capitalLetters
              ? '<Modal :open="false" title="标题">内容</Modal>'
              : '<a-modal :open="false" title="标题">内容</a-modal>',
            attrs: [
              textAttr(':open', '是否打开'),
              textAttr('title', '标题'),
              boolAttr('centered', '垂直居中'),
              boolAttr('mask-closable', '点击遮罩关闭', 'true'),
              textAttr('width', '宽度'),
              eventAttr('@ok', '确定事件'),
              eventAttr('@cancel', '取消事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Popconfirm' : 'a-popconfirm',
            imports: capitalLetters
              ? ['import { Popconfirm, Button } from "antdv-next";']
              : undefined,
            label: 'Popconfirm 气泡确认',
            icon: 'i-ant-design:question-circle-outlined',
            snippet: capitalLetters
              ? '<Popconfirm title="确认？" @confirm=""><Button>删除</Button></Popconfirm>'
              : '<a-popconfirm title="确认？" @confirm=""><a-button>删除</a-button></a-popconfirm>',
            attrs: [
              textAttr('title', '标题'),
              textAttr('ok-text', '确认按钮文字'),
              textAttr('cancel-text', '取消按钮文字'),
              disabledAttr(),
              eventAttr('@confirm', '确认事件'),
              eventAttr('@cancel', '取消事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Progress' : 'a-progress',
            imports: capitalLetters
              ? ['import { Progress } from "antdv-next";']
              : undefined,
            label: 'Progress 进度条',
            icon: 'i-ant-design:progress-outlined',
            snippet: capitalLetters
              ? '<Progress :percent="50" />'
              : '<a-progress :percent="50" />',
            attrs: [
              textAttr('percent', '百分比'),
              textAttr('type', '类型', {
                options: ['line', 'circle', 'dashboard'],
              }),
              textAttr('status', '状态', {
                options: ['success', 'exception', 'normal', 'active'],
              }),
              boolAttr('show-info', '显示信息', 'true'),
            ],
          },
          {
            tag: capitalLetters ? 'Result' : 'a-result',
            imports: capitalLetters
              ? ['import { Result } from "antdv-next";']
              : undefined,
            label: 'Result 结果',
            icon: 'i-ant-design:check-circle-outlined',
            snippet: capitalLetters
              ? '<Result status="success" title="成功" />'
              : '<a-result status="success" title="成功" />',
            attrs: [
              textAttr('status', '状态', {
                defaultValue: 'info',
                options: [
                  'success',
                  'error',
                  'info',
                  'warning',
                  '404',
                  '403',
                  '500',
                ],
              }),
              textAttr('title', '标题'),
              textAttr('sub-title', '副标题'),
            ],
          },
          {
            tag: capitalLetters ? 'Skeleton' : 'a-skeleton',
            imports: capitalLetters
              ? ['import { Skeleton } from "antdv-next";']
              : undefined,
            label: 'Skeleton 骨架屏',
            icon: 'i-ant-design:loading-outlined',
            snippet: capitalLetters
              ? '<Skeleton active />'
              : '<a-skeleton active />',
            attrs: [
              boolAttr('active', '动画效果'),
              boolAttr('loading', '加载中'),
              boolAttr('avatar', '显示头像'),
              boolAttr('paragraph', '显示段落', 'true'),
              boolAttr('title', '显示标题', 'true'),
            ],
          },
          {
            tag: capitalLetters ? 'Spin' : 'a-spin',
            imports: capitalLetters
              ? ['import { Spin } from "antdv-next";']
              : undefined,
            label: 'Spin 加载中',
            icon: 'i-ant-design:loading-3-quarters-outlined',
            snippet: capitalLetters ? '<Spin />' : '<a-spin />',
            attrs: [
              boolAttr('spinning', '旋转中', 'true'),
              sizeAttr(['small', 'default', 'large']),
              textAttr('tip', '提示文字'),
              textAttr('delay', '延迟时间'),
            ],
          },
        ],
      },
      // ==================== 数据展示 ====================
      {
        group: 'antdv/数据展示',
        items: [
          {
            tag: capitalLetters ? 'Card' : 'a-card',
            imports: capitalLetters
              ? ['import { Card } from "antdv-next";']
              : undefined,
            label: 'Card 卡片',
            icon: 'i-ant-design:credit-card-outlined',
            snippet: capitalLetters
              ? '<Card title="标题"><p>内容</p></Card>'
              : '<a-card title="标题"><p>内容</p></a-card>',
            attrs: [
              textAttr('title', '标题', { defaultValue: '标题' }),
              boolAttr('bordered', '边框', 'true'),
              boolAttr('hoverable', '悬浮效果'),
              textAttr('size', '尺寸', {
                options: ['default', 'small'],
              }),
            ],
          },
          {
            tag: capitalLetters ? 'Avatar' : 'a-avatar',
            imports: capitalLetters
              ? ['import { Avatar } from "antdv-next";']
              : undefined,
            label: 'Avatar 头像',
            icon: 'i-ant-design:user-outlined',
            snippet: capitalLetters
              ? '<Avatar src="https://example.com/avatar.png" />'
              : '<a-avatar src="https://example.com/avatar.png" />',
            attrs: [
              textAttr('size', '尺寸', {
                options: ['large', 'default', 'small'],
              }),
              textAttr('shape', '形状', {
                options: ['circle', 'square'],
              }),
              textAttr('src', '图片地址'),
              textAttr('icon', '图标'),
            ],
          },
          {
            tag: capitalLetters ? 'Badge' : 'a-badge',
            imports: capitalLetters
              ? ['import { Badge, Button } from "antdv-next";']
              : undefined,
            label: 'Badge 徽标',
            icon: 'i-ant-design:badge-outlined',
            snippet: capitalLetters
              ? '<Badge count="9"><Button>消息</Button></Badge>'
              : '<a-badge count="9"><a-button>消息</a-button></a-badge>',
            attrs: [
              textAttr('count', '数量'),
              boolAttr('dot', '圆点'),
              textAttr('status', '状态', {
                options: [
                  'success',
                  'processing',
                  'default',
                  'error',
                  'warning',
                ],
              }),
              textAttr('color', '颜色'),
              textAttr('overflow-count', '溢出计数'),
            ],
          },
          {
            tag: capitalLetters ? 'Calendar' : 'a-calendar',
            imports: capitalLetters
              ? ['import { Calendar } from "antdv-next";']
              : undefined,
            label: 'Calendar 日历',
            icon: 'i-ant-design:calendar-outlined',
            snippet: capitalLetters ? '<Calendar />' : '<a-calendar />',
            attrs: [
              textAttr(':value', '当前日期'),
              textAttr('mode', '模式', {
                options: ['month', 'year'],
              }),
              eventAttr('@change', '日期变化'),
              eventAttr('@select', '选择日期'),
            ],
          },
          {
            tag: capitalLetters ? 'Carousel' : 'a-carousel',
            imports: capitalLetters
              ? ['import { Carousel } from "antdv-next";']
              : undefined,
            label: 'Carousel 走马灯',
            icon: 'i-ant-design:picture-outlined',
            snippet: capitalLetters
              ? `
            <Carousel autoplay>
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
            </Carousel>
            `
              : `
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
              boolAttr('autoplay', '自动切换'),
              boolAttr('dots', '显示指示点', 'true'),
              textAttr('effect', '效果', {
                options: ['scrollx', 'fade'],
              }),
              eventAttr('@change', '切换事件'),
              eventAttr('@after-change', '切换后事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Collapse' : 'a-collapse',
            imports: capitalLetters
              ? ['import { Collapse, CollapsePanel } from "antdv-next";']
              : undefined,
            label: 'Collapse 折叠面板',
            icon: 'i-ant-design:folder-open-outlined',
            snippet: capitalLetters
              ? '<Collapse><CollapsePanel key="1" header="标题">内容</CollapsePanel></Collapse>'
              : '<a-collapse><a-collapse-panel key="1" header="标题">内容</a-collapse-panel></a-collapse>',
            attrs: [
              boolAttr('accordion', '手风琴'),
              boolAttr('bordered', '边框', 'true'),
              boolAttr('ghost', '透明'),
              modelAttr('v-model:active-key'),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Descriptions' : 'a-descriptions',
            imports: capitalLetters
              ? ['import { Descriptions } from "antdv-next";']
              : undefined,
            label: 'Descriptions 描述列表',
            icon: 'i-ant-design:profile-outlined',
            snippet: capitalLetters
              ? '<Descriptions title="标题" :column="2" />'
              : '<a-descriptions title="标题" :column="2" />',
            attrs: [
              textAttr('title', '标题'),
              boolAttr('bordered', '边框'),
              textAttr('column', '列数'),
              textAttr('size', '尺寸', {
                options: ['default', 'middle', 'small'],
              }),
              textAttr('layout', '布局', {
                options: ['horizontal', 'vertical'],
              }),
            ],
          },
          {
            tag: capitalLetters ? 'Empty' : 'a-empty',
            imports: capitalLetters
              ? ['import { Empty } from "antdv-next";']
              : undefined,
            label: 'Empty 空状态',
            icon: 'i-ant-design:inbox-outlined',
            snippet: capitalLetters
              ? '<Empty description="暂无数据" />'
              : '<a-empty description="暂无数据" />',
            attrs: [
              textAttr('description', '描述文字'),
              textAttr('image', '图片地址'),
            ],
          },
          {
            tag: capitalLetters ? 'Image' : 'a-image',
            imports: capitalLetters
              ? ['import { Image } from "antdv-next";']
              : undefined,
            label: 'Image 图片',
            icon: 'i-ant-design:file-image-outlined',
            snippet: capitalLetters
              ? '<Image src="https://example.com/image.png" />'
              : '<a-image src="https://example.com/image.png" />',
            attrs: [
              textAttr('src', '图片地址'),
              textAttr('width', '宽度'),
              textAttr('height', '高度'),
              boolAttr('preview', '预览', 'true'),
              textAttr('fallback', '失败占位图'),
            ],
          },
          {
            tag: capitalLetters ? 'Popover' : 'a-popover',
            imports: capitalLetters
              ? ['import { Popover, Button } from "antdv-next";']
              : undefined,
            label: 'Popover 气泡卡片',
            icon: 'i-ant-design:message-outlined',
            snippet: capitalLetters
              ? '<Popover title="标题" content="内容"><Button>触发</Button></Popover>'
              : '<a-popover title="标题" content="内容"><a-button>触发</a-button></a-popover>',
            attrs: [
              textAttr('title', '标题'),
              textAttr('trigger', '触发方式', {
                options: ['click', 'hover', 'focus'],
              }),
              textAttr('placement', '弹出位置', {
                options: ['top', 'bottom', 'left', 'right'],
              }),
              eventAttr('@visible-change', '显示状态变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Segmented' : 'a-segmented',
            imports: capitalLetters
              ? ['import { Segmented } from "antdv-next";']
              : undefined,
            label: 'Segmented 分段控制器',
            icon: 'i-ant-design:control-outlined',
            snippet: capitalLetters
              ? "<Segmented :options=\"['日', '周', '月']\" />"
              : "<a-segmented :options=\"['日', '周', '月']\" />",
            attrs: [
              modelAttr('v-model:value'),
              disabledAttr(),
              boolAttr('block', '宽度撑满'),
              sizeAttr(),
              eventAttr('@change', '变化事件'),
            ],
          },
          {
            tag: capitalLetters ? 'Statistic' : 'a-statistic',
            imports: capitalLetters
              ? ['import { Statistic } from "antdv-next";']
              : undefined,
            label: 'Statistic 统计数值',
            icon: 'i-ant-design:number-outlined',
            snippet: capitalLetters
              ? '<Statistic title="标题" :value="1000" />'
              : '<a-statistic title="标题" :value="1000" />',
            attrs: [
              textAttr('title', '标题'),
              textAttr('value', '数值'),
              textAttr('precision', '小数位数'),
              textAttr('suffix', '后缀'),
              textAttr('prefix', '前缀'),
            ],
          },
          {
            tag: capitalLetters ? 'Table' : 'a-table',
            imports: capitalLetters
              ? ['import { Table } from "antdv-next";']
              : undefined,
            label: 'Table 表格',
            icon: 'i-ant-design:table-outlined',
            snippet: capitalLetters
              ? '<Table :columns="[]" :data-source="[]" row-key="id" />'
              : '<a-table :columns="[]" :data-source="[]" row-key="id" />',
            attrs: [
              textAttr(':columns', '列配置'),
              textAttr(':data-source', '数据源'),
              textAttr('row-key', '行 key'),
              boolAttr('bordered', '边框'),
              textAttr('size', '尺寸', {
                options: ['default', 'middle', 'small'],
              }),
              eventAttr('@change', '分页/排序变化'),
            ],
          },
          {
            tag: capitalLetters ? 'Timeline' : 'a-timeline',
            imports: capitalLetters
              ? ['import { Timeline, TimelineItem } from "antdv-next";']
              : undefined,
            label: 'Timeline 时间线',
            icon: 'i-ant-design:history-outlined',
            snippet: capitalLetters
              ? '<Timeline><TimelineItem>步骤</TimelineItem></Timeline>'
              : '<a-timeline><a-timeline-item>步骤</a-timeline-item></a-timeline>',
            attrs: [
              textAttr('mode', '模式', {
                options: ['left', 'alternate', 'right'],
              }),
              boolAttr('pending', '最后一项'),
              boolAttr('reverse', '倒序'),
            ],
          },
          {
            tag: capitalLetters ? 'Tooltip' : 'a-tooltip',
            imports: capitalLetters
              ? ['import { Tooltip } from "antdv-next";']
              : undefined,
            label: 'Tooltip 文字提示',
            icon: 'i-ant-design:info-circle-outlined',
            snippet: capitalLetters
              ? '<Tooltip title="提示"><span>文字</span></Tooltip>'
              : '<a-tooltip title="提示"><span>文字</span></a-tooltip>',
            attrs: [
              textAttr('title', '提示文字'),
              textAttr('trigger', '触发方式', {
                options: ['click', 'hover', 'focus'],
              }),
              textAttr('placement', '弹出位置', {
                options: ['top', 'bottom', 'left', 'right'],
              }),
              textAttr('color', '颜色'),
            ],
          },
          {
            tag: capitalLetters ? 'Tree' : 'a-tree',
            imports: capitalLetters
              ? ['import { Tree } from "antdv-next";']
              : undefined,
            label: 'Tree 树形',
            icon: 'i-ant-design:tree-outlined',
            snippet: capitalLetters
              ? '<Tree :tree-data="[]" />'
              : '<a-tree :tree-data="[]" />',
            attrs: [
              textAttr(':tree-data', '树数据'),
              boolAttr('checkable', '可勾选'),
              boolAttr('selectable', '可选中'),
              boolAttr('default-expand-all', '默认展开全部'),
              eventAttr('@select', '选中事件'),
              eventAttr('@check', '勾选事件'),
            ],
          },
          {
            tag: capitalLetters ? 'QRCode' : 'a-qrcode',
            imports: capitalLetters
              ? ['import { QRCode } from "antdv-next";']
              : undefined,
            label: 'QRCode 二维码',
            icon: 'i-ant-design:qrcode-outlined',
            snippet: capitalLetters
              ? '<QRCode value="https://example.com" />'
              : '<a-qrcode value="https://example.com" />',
            attrs: [
              textAttr('value', '二维码内容'),
              textAttr('size', '尺寸'),
              textAttr('color', '前景色'),
              textAttr('background-color', '背景色'),
            ],
          },
          {
            tag: capitalLetters ? 'Watermark' : 'a-watermark',
            imports: capitalLetters
              ? ['import { Watermark } from "antdv-next";']
              : undefined,
            label: 'Watermark 水印',
            icon: 'i-ant-design:watermark-outlined',
            snippet: capitalLetters
              ? '<Watermark content="水印"><div style="height:200px" /></Watermark>'
              : '<a-watermark content="水印"><div style="height:200px" /></a-watermark>',
            attrs: [
              textAttr('content', '水印内容'),
              textAttr('gap', '间距'),
              textAttr('offset', '偏移'),
              textAttr('rotate', '旋转角度'),
            ],
          },
        ],
      },
    ],
  };
}
