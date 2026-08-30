# @deepseek-ai/dsh-client-ui-workspace-upload

DSH Web 工作区上传插件。两个 slot 注册：

- **`conversation.input.left`** — composer 工具行内的回形针上传按钮。选中的
  文件通过 `dsh-host-workspace-files` JSON API（`POST /workspace-files/api/upload`，
  同源 JSON base64）写入工作区根目录，随后在 draft 前置
  `[workspace-file]{json}` 标记，使下一条发送的消息携带这些文件。
- **`conversation.chat.node`**（`key: 'user'`，shadowing priority `-1`）—
  用户消息渲染器，把 `[workspace-file]` 标记渲染为可下载的文件卡片（名称、
  大小、指向 workspace-files 下载 API 的下载链接）。无标记的消息与基础
  `ui-chat` 用户气泡渲染完全一致。

标记作为消息的 wire 文本保留（模型原样可见）；本包的渲染器是唯一知道如何
展示它的呈现者。发送前删除 draft 中的标记行即取消附带。

## Slot 契约

- 部署中需组合 `dsh-host-workspace-files` 宿主插件（它拥有
  `/workspace-files` 路由与工作区根目录）。
- 需在 `ui-chat` 之后加载本包，使基础 `'user'` 注册先以 `priority 0` 存在；
  本包以 `-1` 覆盖。

## Locale

拥有 `workspaceUpload` 命名空间（zh/en）。用户渲染器所需的卡片/气泡文案
（时钟模板、复制文案、JSON 块标签）内置于该命名空间，渲染器保持自包含。

## 安全

上传受宿主插件 `maxUploadBytes`（默认 100 MB）约束；超限文件在拒绝弹窗中
列出且绝不发起上传。路径由宿主插件校验并限定在配置的 root 内。
