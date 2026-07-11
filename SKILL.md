---
name: vue-dev-inspector
description: Vue SFC 可视化编辑 Agent 技能，基于 Vite dev 中间件 /__dev-inspector-api__，支持选中/props/子节点/块编辑、组件增删改移、编辑器调起，写盘触发 HMR。
license: MIT
requires: 需用户启动 pnpm dev，Agent 禁止自启动；.env 持久化 DEV_INSPECTOR_HOST
api_base: ${DEV_INSPECTOR_HOST}/__dev-inspector-api__
tags: [vue, vite, inspector, hmr, sfc]
---

# vue-dev-inspector 交互规范

## 1. 初始化 (必做)

**优先级 L1→L4 命中即停:**
L1 `.env` (SKILL同级) `DEV_INSPECTOR_HOST` → L2 `vite.config.{ts,js,mts}` 解析 `server.host/port` (0.0.0.0→localhost, 默认5173) → L3 嗅探 5173-5183/3000 → L4 `AskUserQuestion` 让用户提供地址

**探测:**
`curl -X POST ${HOST}/__dev-inspector-api__/get-selection -d '{}'` 返回200即在线

**写入:** `DEV_INSPECTOR_HOST=http://localhost:5173` 到 `.env`

**自愈:** 后续全部从 `.env` 读 Host，连续3次失败重走L1-L4，指数退避500/1000/2000ms

## 2. 请求基线

`POST ${DEV_INSPECTOR_HOST}/__dev-inspector-api__/<route>` JSON, CORS *, 仅POST (OPTIONS 204)
读: 200+数据, 写: 200 {success:true}+HMR, 500 {error}

模板:
```bash
source .env; curl -sS -X POST "$HOST/__dev-inspector-api__/get-props" -H'Content-Type:application/json' -d '{"file":"r0:src/App.vue:10:2","line":10,"col":2}'
```

## 3. 坐标

格式 `r<N>:<path>:<line>:<col>` N=0单根, line 1-based, col 0-based, 例 `r0:src/App.vue:12:3`
**禁止自拼**, 必须来自 DOM `data-source-file` 或 `/get-selection` 的 `source`, 可直接传给其他接口 `file` 字段

安全: 空→400, 绝对路径/逃逸→403, N越界→400, 无rN前缀→400 (旧格式废弃)

## 4. 路由总览 (14个)

| 路由 | 功能 | 写 |
|---|---|---|
| get-selection | 当前选中快照 {selection:{source,tag,at}/null} at过期>30s重选 | 否 |
| list-components | 扫描.vue 排除node_modules/dist | 否 |
| resolve-path | 解析坐标→{absolutePath,line,col} | 否 |
| get-props | 读属性 {tag,selfClosing,props:[{key,value}]} key保留:class :src @click v-if | 否 |
| update-props | **全量覆盖** props[] 先get再改再传 | 是 |
| get-child-text | 读子节点 {content,start,end} 自闭合start==end | 否 |
| update-child-text | 替换子节点 自闭合+非空自动转配对 | 是 |
| get-block | 读SFC块 {script?,style? {kind,content,start,end}} line/col占位 | 否 |
| update-block | 替/新建块 {kind:script/style,content,scoped} scoped仅新建style生效 | 是 |
| insert-component | 插入 {file,line,col,componentTag/tag,direction:before/inside/after,snippet,imports[]} snippet优先 否则CATALOG Custom必须传snippet imports幂等 | 是 |
| delete-element | 删除完整区间 | 是 |
| duplicate-element | 同级复制 | 是 |
| move-element | 移动 {file,target{file},direction} **仅同文件** v1 跨文件用get+insert+delete替代, 禁止移到后代 | 是 |
| open-in-editor | 调编辑器 {file,line,col,editor:vscode/webstorm/idea/atom/sublime} 需授权 | 否 |

HMR: 所有写接口成功自动热更新
串行: 禁止并行写，每次写后行号偏移，需重取坐标

## 5. 错误码

| 码 | 场景 | 新提示 |
|---|---|---|
| 400 | 格式/空/N越界/target缺 | Bad Request: 期望 rN:path:line:col 或 Missing target |
| 400 | 跨文件/后代 | Cross-file not supported in v1 / Move rejected: target是后代 |
| 403 | 绝对/越权 | Forbidden: 绝对路径或超出projectRoot |
| 404 | 元素/块未找到 | Element not found: HMR后行号偏移，请重get-selection; Block not found |
| 500 | IO/AST/exec | {error: msg} |

统一 `{error: 可操作建议}`

