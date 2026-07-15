/**
 * @vue-dev-inspector/shared/browser -- 浏览器运行时 host-bridge。
 *
 * 仅 overlay IIFE 与物料库 expand 脚本（均浏览器侧）消费：
 *   - overlay 的 extensibility.ts 调 `installHost` 挂载 window.__VDI_HOST__
 *   - 物料 expand 调 `addToolBtn` / `onInspect` / `onSelect` 注册回调
 *
 * 单独成 entry 是为了让 node 侧包（core/client/uni/pluginkit）只 import 根
 * `@vue-dev-inspector/shared`（常量 + 类型）时不会把 window / setInterval
 * 轮询代码拉进 node 产物。host-bridge 自身仅 import `./extensibility` 的类型。
 */
export * from "./host-bridge";
