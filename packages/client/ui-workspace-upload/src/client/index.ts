/**
 * Workspace upload plugin, browser half: occupies the composer's
 * `conversation.input.right` seat (rendered after the send button, fork 增强)
 * with an upload button that writes picked files into the workspace root
 * through the dsh-host-workspace-files JSON API and prepends a
 * `[workspace-file]` marker to the draft, and shadows the
 * `conversation.chat.node` 'user' renderer so the marker renders as
 * downloadable file cards. Everything rides slot registrations; zero
 * host-side state.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
import { UploadButton } from './UploadButton.tsx'
import { WorkspaceUploadUserNodeView } from './UserNodeView.tsx'
import { en, zh, type WorkspaceUploadKey } from './locales.ts'

/** Dictionary namespace owned by this plugin. */
const NS = 'workspaceUpload'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace upload button, reject dialog, and card copy. */
    workspaceUpload: WorkspaceUploadKey
  }
}

/**
 * Services required by the workspace-upload client plugin: `locale` for
 * dictionary registration, `slots` for the composer/user-node seats.
 */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the upload button and the user-node renderer.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-workspace-upload: dictionaries')

  // Composer tool row: the upload button (list slot; one id per deployment).
  // 注册在 input.right —— InputBar（fork 增强）在发送按钮之后渲染该槽，
  // 使上传按钮位于发送按钮右侧。
  ctx.slots.inject('conversation.input.right', () => ctx.slots.register({
    name: 'conversation.input.right',
    id: 'workspace-upload',
    locale: NS,
  }, UploadButton))

  // User message renderer: shadow the default 'user' node so the
  // [workspace-file] marker renders as cards (priority -1 wins over the
  // base ui-chat registration at priority 0).
  ctx.slots.inject('conversation.chat.node', () => ctx.slots.register({
    name: 'conversation.chat.node',
    key: 'user',
    locale: NS,
    priority: -1,
  }, WorkspaceUploadUserNodeView))
}
