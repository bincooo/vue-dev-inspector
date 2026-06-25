/**
 * overlay 入口。
 *
 * 编译为单个 IIFE JS 文件，由 vite-plugin-vue-dev-inspector
 * 读取并注入到 dev 模式的 HTML 中。
 *
 * 配置由插件设置 window.__DEV_INSPECTOR_CFG__。
 */
import { init } from './events'

init()