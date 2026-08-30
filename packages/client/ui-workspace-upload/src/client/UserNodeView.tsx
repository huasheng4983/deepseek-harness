/**
 * User-message renderer override (keyed 'user', shadowing priority -1):
 * renders the `[workspace-file]` marker as downloadable file cards, and
 * otherwise reproduces the upstream user bubble (text projection, images,
 * reference summary, copy/clock actions). The override exists because the
 * marker is wire text (the model sees it verbatim) that only this renderer
 * knows how to present; keeping the ordinary branch identical to upstream
 * means a marker-free message looks exactly as before.
 */

import { memo, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  IconCheckOutline16, IconCopyOutline16, JsonBlock, Tooltip, writeClipboard,
  projectUserText,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { UserMessageNode } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { formatMessageClock } from './message-chrome.ts'
import { useCalendarDay } from './use-calendar-day.ts'
import { parseWorkspaceFileMarker, WorkspaceFileCards } from './WorkspaceFileCards.tsx'
import css from './UserNodeView.module.css'

type UserImage = Extract<UserMessageNode['content'][number], { type: 'image' }>

/** Split message content into text, images, and everything else. */
function contentParts(content: readonly unknown[]): {
  text: string
  images: { attachment: UserImage['attachment'] }[]
  rest: unknown[]
} {
  const texts: string[] = []
  const images: { attachment: UserImage['attachment'] }[] = []
  const rest: unknown[] = []
  for (const block of content) {
    const b = block as { type?: string; text?: string; attachment?: unknown }
    if (b.type === 'text' && typeof b.text === 'string') texts.push(b.text)
    else if (b.type === 'image' && b.attachment !== undefined) {
      images.push({ attachment: (b as UserImage).attachment })
    }
    else rest.push(block)
  }
  return { text: texts.join(''), images, rest }
}

/** Full props of the workspace-upload user renderer. */
export type WorkspaceUploadUserNodeViewProps =
  PropsRuntime<'conversation.chat.node', 'user'> & PropsLocale<'workspaceUpload'>

/** Minimal copy action row (copy + clock), mirroring upstream user chrome. */
function UserActions({ text, time, t }: {
  text: string
  time: number
  t: WorkspaceUploadUserNodeViewProps['t']
}): ReactNode {
  const day = useCalendarDay()
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (copyTimer.current !== null) clearTimeout(copyTimer.current)
  }, [])
  const onCopy = (): void => {
    if (copied) return
    void writeClipboard(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      copyTimer.current = window.setTimeout(() => {
        copyTimer.current = null
        setCopied(false)
      }, 1000)
    })
  }
  return (
    <div className={css.actions}>
      <span className={css.timeStart}>{formatMessageClock(time, t, day)}</span>
      <Tooltip label={copied ? t('copied') : t('copy')} side="bottom">
        <button type="button" className={css.action} aria-label={copied ? t('copied') : t('copy')} onClick={onCopy}>
          {copied ? <IconCheckOutline16 /> : <IconCopyOutline16 />}
        </button>
      </Tooltip>
    </div>
  )
}

/** User message row: file cards for marker text, else the ordinary bubble. */
export const WorkspaceUploadUserNodeView = memo(function WorkspaceUploadUserNodeView({
  node, renderMessageImages, t,
}: WorkspaceUploadUserNodeViewProps) {
  const data = node.data
  const { text, images, rest } = contentParts(data.content)
  const referenceLabels = data.referenceLabels ?? []
  const truncated = (total: number): string => t('json.truncated', { total })
  const marker = parseWorkspaceFileMarker(text)
  const showBubble = text !== '' || rest.length > 0
  return (
    <div className={css.userRow} data-time-hover-root>
      <div className={css.userStack}>
        {renderMessageImages({ images, align: 'end' })}
        {showBubble && (
          <div className={css.bubble}>
            {marker !== null ? (
              <>
                <WorkspaceFileCards files={marker.files} t={t} />
                {marker.userText.trim() !== '' && (
                  <div className={css.wfUserText}>{projectUserText(marker.userText, referenceLabels)}</div>
                )}
              </>
            ) : (
              projectUserText(text, referenceLabels)
            )}
            {rest.map((block, i) => (
              <JsonBlock key={i} label={t('message.extraBlock')} payload={block} truncatedLabel={truncated} />
            ))}
          </div>
        )}
        {referenceLabels.length > 0 && (
          <div className={css.referenceSummary}>
            {t('message.referenceSummary', { labels: referenceLabels.join(t('message.referenceSeparator')) })}
          </div>
        )}
      </div>
      <UserActions text={text} time={data.time} t={t} />
    </div>
  )
})
