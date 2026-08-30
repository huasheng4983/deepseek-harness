/** Workspace upload button: the composer tool-row control that writes picked
 * files into the workspace root through the dsh-host-workspace-files JSON API
 * and prepends a `[workspace-file]` marker to the draft so the next sent
 * message carries the uploaded files (the marker survives as the message's
 * wire text; the conversation target's renderer turns it into download cards).
 *
 * The marker is prepended immediately on success (not deferred to submit):
 * this is a surface plugin, so it cannot hook the composer's own submit
 * gesture; prepending keeps the semantics — files go out with the next
 * message — while staying fully composable. Removing the marker line from the
 * draft cancels the attachment. */

import { useCallback, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import {
  IconPaperclipOutline16, Modal, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import css from './UploadButton.module.css'

/** 单文件上传上限（与服务端 dsh-host-workspace-files maxUploadBytes 一致）。 */
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/** 人类可读文件大小。 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** 待发送的工作区上传文件（marker 载荷）。 */
export interface PendingUploadFile {
  name: string
  size: number
  path: string
}

/** Full props of the tool-row upload control. */
export type UploadButtonProps =
  PropsRuntime<'conversation.input.left'> & PropsLocale<'workspaceUpload'>

/**
 * Composer tool-row upload control.
 * @param props - runtime share (session standard props) and the locale seat.
 */
export function UploadButton({ useInput, inputActions, t }: UploadButtonProps) {
  const draft = useInput(s => s.draft)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const uploadSeqRef = useRef(0)
  // 超限文件弹窗（fork 增强）：单文件超过 100MB 时列出并拒绝上传。
  const [rejected, setRejected] = useState<string[] | null>(null)
  // 瞬时报文（上传结果提示）。
  const [toast, setToast] = useState<{ seq: number; text: string } | null>(null)
  const toastSeq = useRef(0)
  const showToast = useCallback((text: string) => {
    toastSeq.current += 1
    setToast({ seq: toastSeq.current, text })
  }, [])

  // 上传文件到工作区：直接把所选文件写入工作区根目录
  // （/workspace-files/api/upload，同源 JSON base64），与会话状态无关。
  const onUploadPick = (event: ChangeEvent<HTMLInputElement>): void => {
    const picked = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (picked.length === 0) return
    // 单文件上限拦截：超限文件弹窗报错，不发起上传。
    const tooLarge: string[] = []
    const files = picked.filter((file) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        tooLarge.push(file.name)
        return false
      }
      return true
    })
    if (tooLarge.length > 0) setRejected(tooLarge)
    if (files.length === 0) return
    const seq = uploadSeqRef.current + 1
    uploadSeqRef.current = seq
    const uploaded: Array<{ name: string; size: number; path: string }> = []
    let done = 0
    const remaining = [...files]
    const next = (): void => {
      if (seq !== uploadSeqRef.current) return // a newer pick superseded this batch
      if (remaining.length === 0) {
        if (done > 0) {
          // 前置 marker：随下一条消息提交（发送后由消息渲染器解析成卡片）。
          const marker = `[workspace-file]${JSON.stringify({ files: uploaded })}`
          const userText = draft.trim()
          inputActions?.setDraft(userText === '' ? marker : `${marker}\n${userText}`)
          showToast(t('toast.uploaded', { n: String(done) }))
        }
        return
      }
      const current = remaining.shift()
      if (current === undefined) return
      const file = current
      const reader = new FileReader()
      reader.onload = () => {
        const content = typeof reader.result === 'string' ? reader.result.split(',')[1] ?? '' : ''
        void fetch('/workspace-files/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: '', name: file.name, content }),
        }).then(r => r.json()).then((data: { ok?: boolean; error?: string; path?: string }) => {
          if (data.ok) {
            done++
            uploaded.push({ name: file.name, size: file.size, path: data.path ?? file.name })
          } else {
            showToast(`${file.name}: ${data.error ?? '上传失败'}`)
          }
          next()
        }).catch((reason: unknown) => {
          showToast(`${file.name}: 上传失败（${reason instanceof Error ? reason.message : String(reason)}）`)
          next()
        })
      }
      reader.onerror = () => { showToast(`${file.name}: 读取失败`); next() }
      reader.readAsDataURL(file)
    }
    next()
  }

  return (
    <>
      {toast !== null && (
        <div className={css.toast} role="status" data-upload-toast>
          {toast.text}
        </div>
      )}
      <Tooltip label={t('button.uploadToWorkspace')} side="top" delayMs={500}>
        <button
          type="button"
          className={css.upload}
          aria-label={t('button.uploadToWorkspace')}
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
        >
          <IconPaperclipOutline16 size={14} />
        </button>
      </Tooltip>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={css.hiddenInput}
        data-upload-input
        onChange={onUploadPick}
      />
      {rejected !== null && (
        <Modal
          open
          title={t('reject.title')}
          closeLabel={t('reject.close')}
          onClose={() => { setRejected(null) }}
        >
          <div className={css.rejectBody}>
            <p className={css.rejectMessage}>
              {t('reject.message', { max: formatFileSize(MAX_UPLOAD_BYTES) })}
            </p>
            <ul className={css.rejectList}>
              {rejected.map(name => <li key={name}>{name}</li>)}
            </ul>
            <div className={css.rejectActions}>
              <button type="button" className={css.rejectOk} onClick={() => { setRejected(null) }}>
                {t('reject.ok')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
