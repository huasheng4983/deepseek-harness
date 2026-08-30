# @deepseek-ai/dsh-client-ui-workspace-upload

Workspace upload plugin for the DSH Web shell. Two slot registrations:

- **`conversation.input.left`** — a paperclip upload button in the composer
  tool row. Picked files are written into the workspace root through the
  `dsh-host-workspace-files` JSON API (`POST /workspace-files/api/upload`,
  same-origin JSON base64), then a `[workspace-file]{json}` marker is
  prepended to the draft so the next sent message carries the files.
- **`conversation.chat.node`** (`key: 'user'`, shadowing priority `-1`) — the
  user-message renderer that turns the `[workspace-file]` marker into
  downloadable file cards (name, size, download link into the
  workspace-files download API). Marker-free messages render exactly like the
  base `ui-chat` user bubble.

The marker survives as the message's wire text (the model sees it verbatim);
this package's renderer is the only presenter that knows how to display it.
Removing the marker line from the draft before sending cancels the
attachment.

## Slot contract

- Requires the `dsh-host-workspace-files` host plugin to be composed in the
  same deployment (it owns `/workspace-files` routes and the workspace root).
- Requires `ui-chat` to be loaded before this package so the base `'user'`
  registration exists at priority `0`; this package shadows it at `-1`.

## Locale

Owns the `workspaceUpload` namespace (zh/en). Card/bubble copy needed by the
user renderer (clock templates, copy label, JSON block labels) ships inside
this namespace so the renderer stays self-contained.

## Security

Uploads are bounded by the host plugin's `maxUploadBytes` (default 100 MB);
files over the limit are listed in a reject dialog and never uploaded.
Paths are validated by the host plugin against its configured root.
