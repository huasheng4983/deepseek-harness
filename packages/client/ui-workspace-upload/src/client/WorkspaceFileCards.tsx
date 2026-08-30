/** File-card renderer for the `[workspace-file]` message marker: one card per
 * uploaded file with name, size, and a download link into the
 * dsh-host-workspace-files download API. The marker is the message's wire
 * text (the model sees it verbatim); this presentation turns it into cards. */

import type { ReactNode } from 'react'
import { IconDownloadOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { Translate } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { WorkspaceUploadKey } from './locales.ts'
import css from './WorkspaceFileCards.module.css'

/** 工作区文件上传消息标记（上传按钮发送的用户消息前缀）。 */
export const WORKSPACE_FILE_MARKER = '[workspace-file]'

/** 工作区文件气泡负载。 */
export interface WorkspaceFilePayload {
  name: string
  size?: number
  path?: string
}

/** 人类可读大小。 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 解析后的 marker：文件列表 + 用户随消息输入的文本（换行之后的部分）。 */
export interface WorkspaceFileMarker {
  files: readonly WorkspaceFilePayload[]
  /** 用户文本；marker 后无换行时为空串。 */
  userText: string
}

/**
 * 解析 `[workspace-file]{json}` 前缀。json 形如 `{"files":[{name,size,path}]}`；
 * 解析失败或文件列表为空时返回 null（回落普通文本）。
 * @param text - 消息文本。
 * @returns 解析结果或 null。
 */
export function parseWorkspaceFileMarker(text: string): WorkspaceFileMarker | null {
  if (!text.startsWith(WORKSPACE_FILE_MARKER)) return null
  const rest = text.slice(WORKSPACE_FILE_MARKER.length)
  const newline = rest.indexOf('\n')
  const jsonPart = newline === -1 ? rest : rest.slice(0, newline)
  const userText = newline === -1 ? '' : rest.slice(newline + 1)
  try {
    const parsed: unknown = JSON.parse(jsonPart)
    const files = (parsed as { files?: unknown }).files ?? parsed
    if (Array.isArray(files) && files.length > 0) {
      return { files: files as WorkspaceFilePayload[], userText }
    }
  } catch {
    // 负载解析失败：回落普通文本
  }
  return null
}

/** 文件卡片：图标 + 名称/大小 + 下载链接（指向工作区下载 API）。 */
export function WorkspaceFileCard({ file, t }: {
  file: WorkspaceFilePayload
  t: Translate<WorkspaceUploadKey>
}): ReactNode {
  const name = file.name || 'file'
  const path = file.path ?? name
  return (
    <div className={css.card}>
      <span className={css.icon} aria-hidden>📄</span>
      <div className={css.meta}>
        <span className={css.name} title={path}>{name}</span>
        <span className={css.size}>{formatFileSize(file.size ?? 0)}</span>
      </div>
      <a
        className={css.download}
        href={`/workspace-files/api/download?path=${encodeURIComponent(path)}`}
        download={name}
      >
        <IconDownloadOutline16 size={14} />
        {t('card.download')}
      </a>
    </div>
  )
}

/** 文件卡片列表。 */
export function WorkspaceFileCards({ files, t }: {
  files: readonly WorkspaceFilePayload[]
  t: Translate<WorkspaceUploadKey>
}): ReactNode {
  return (
    <div className={css.cards}>
      {files.map((file, index) => (
        <WorkspaceFileCard key={`${file.path ?? file.name}-${index}`} file={file} t={t} />
      ))}
    </div>
  )
}
