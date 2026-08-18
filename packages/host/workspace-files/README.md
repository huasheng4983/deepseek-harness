# @deepseek-ai/dsh-host-workspace-files

工作区文件管理插件：在 DSH Web 服务上注册 `/workspace-files` 页面与
`/workspace-files/api/*` JSON 接口，提供工作区文件的**浏览 / 上传 / 下载 /
删除 / 新建目录**能力。

## 功能

- `GET /workspace-files` — 自包含的工作区文件管理页面（无构建依赖，暗色主题，
  中文界面；通过同源 JSON API 操作文件系统）。
- `GET /workspace-files/api/list?path=rel` — 列目录（文件/目录、大小、修改时间，
  面包屑由页面按 rel 路径自行构造）。
- `GET /workspace-files/api/download?path=rel` — 下载单个文件（`Content-Disposition`）。
- `POST /workspace-files/api/upload` — 上传文件（JSON：`{path, name, content(base64)}`，
  默认上限 100MB，可配置）。
- `POST /workspace-files/api/mkdir` — 递归新建目录（`{path}`）。
- `POST /workspace-files/api/delete` — 递归删除（`{path}`；禁止删除根目录）。

所有路径解析都限定在配置的 `root` 目录之内：`resolve` 后校验前缀，越界
（`..` 逃逸、绝对路径）统一返回 400 `路径越界`。

## 默认工作区

插件树就绪后，插件会把 `root` 目录自动注册为 DSH 默认工作区
（`ctx.workspaceRegistry.create(root, 'workspace')`，幂等）：DSH Web 的
侧边栏直接显示该工作区、新会话自动连接，**无需用户手工选择目录**
（平台部署时 root 即用户工作区卷 `/workspace`）。

## 发送按钮旁的上传入口（fork 增强）

`@deepseek-ai/dsh-client-ui-conversation` 的输入栏（`InputBar`）在发送按钮旁
新增上传按钮（`IconUploadOutline16`）：点击后选择文件（可多选），以
base64 JSON 直接上传到工作区**根目录**（`/workspace-files/api/upload`，
`path: ''`），完成后显示 toast 汇总，与会话状态无关（无会话的英雄页也可用）。

## 配置

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `root` | `process.cwd()` | 工作区根目录（平台部署时为实例工作区卷 `/workspace`） |
| `maxUploadBytes` | 104857600 | 单文件上传上限（字节） |

web-app bundle 已内置本插件（`cordis.patch.yml` 的 `workspace-files` 行），
`dsh --profile web` 即开即用；侧边栏底栏的「工作区文件」按钮（fork 增强，
`@deepseek-ai/dsh-client-ui-sidebar`）以新标签页打开该页面。

## 实现说明

- 页面以纯 HTML/CSS/JS 字符串内嵌（`src/page.ts`），不依赖 React 应用构建链，
  随插件包发布；页面 JS 刻意避免模板字面量以避免与外围模板字符串嵌套转义。
- 上传走 base64 JSON（无需 multipart 解析依赖），由服务端限制解码后大小。
- 路由通过 `ctx.webServer.register({ kind: 'exact', ... })` 注册，与
  `frontend-static` 的 fallback 互不冲突。
