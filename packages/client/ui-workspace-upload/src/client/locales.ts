/** `workspaceUpload` namespace dictionaries (the upload button and card copy). */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'button.uploadToWorkspace': '上传到工作区',
  'toast.uploaded': '已上传 {n} 个文件到工作区，将随下一条消息发送',
  'toast.uploadedNoDraft': '已上传 {n} 个文件到工作区',
  'reject.title': '文件过大',
  'reject.message': '单文件不能超过 {max}，以下文件未上传：',
  'reject.ok': '知道了',
  'reject.close': '关闭',
  'card.download': '下载',
  'card.remove': '移除（文件仍保留在工作区）',
  'card.removed': '已移除（文件仍在工作区）',
  // 消息渲染复刻所需（与 chat 字典同文案，自包含避免跨 NS 依赖）。
  'message.extraBlock': '附加内容块',
  'json.truncated': '… 已截断，共 {total} 字符',
  'message.referenceSummary': '引用会话 · {labels}',
  'message.referenceSeparator': '、',
  'copied': '已复制',
  'copy': '复制',
  'clock.md': '{m}月{d}日',
  'clock.ymd': '{y}年{m}月{d}日',
} satisfies Record<string, string>

/** The workspace-upload namespace key union. */
export type WorkspaceUploadKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'button.uploadToWorkspace': 'Upload to workspace',
  'toast.uploaded': 'Uploaded {n} file(s) to workspace; they will go out with the next message',
  'toast.uploadedNoDraft': 'Uploaded {n} file(s) to workspace',
  'reject.title': 'File too large',
  'reject.message': 'Each file must be under {max}; these were not uploaded:',
  'reject.ok': 'Got it',
  'reject.close': 'Close',
  'card.download': 'Download',
  'card.remove': 'Remove (file stays in workspace)',
  'card.removed': 'Removed (file stays in workspace)',
  'message.extraBlock': 'Extra content block',
  'json.truncated': '… truncated, {total} characters total',
  'message.referenceSummary': 'Referenced session · {labels}',
  'message.referenceSeparator': ', ',
  'copied': 'Copied',
  'copy': 'Copy',
  'clock.md': '{m}/{d}',
  'clock.ymd': '{y}-{m}-{d}',
} satisfies Record<WorkspaceUploadKey, string>
