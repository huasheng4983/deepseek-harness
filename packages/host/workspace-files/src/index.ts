/**
 * @deepseek-ai/dsh-host-workspace-files — 工作区文件管理（DSH Web 页面）。
 *
 * 在 DSH Web 服务上注册两条命名路由：
 * - `GET /workspace-files`：自包含的工作区文件管理页面（浏览/上传/下载/
 *   删除/新建目录），页面通过同源 JSON API 操作文件系统；
 * - `/workspace-files/api/*`：文件 JSON API（list / download / upload /
 *   mkdir / delete），所有路径限定在配置的 root 目录之内（拒绝越界）。
 *
 * root 默认取进程工作目录（平台部署时为实例的工作区卷挂载点 /workspace），
 * 可通过插件配置 `root` 覆盖。
 * @module @deepseek-ai/dsh-host-workspace-files
 */

import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename, join, resolve, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
// Side-effect type imports: resolve `ctx.loader` / `ctx.workspaceRegistry` to services.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-workspace'
import { workspaceFilesPage } from './page.ts'

/** Stable Cordis plugin name. */
export const name = 'workspace-files'

/** Service required before the named routes can be claimed. */
export const inject = ['webServer', 'workspaceRegistry']

/** Plugin config. */
export interface Config {
  /** 工作区根目录（绝对路径）；默认进程工作目录。 */
  root: string
  /** 单文件上传大小上限（字节）。 */
  maxUploadBytes: number
}

export const Config: z<Config> = z.object({
  root: z.string().default(process.cwd()),
  maxUploadBytes: z.natural().min(1).default(100 * 1024 * 1024),
})

/** 工作区文件操作错误（越界/不存在/非法名），映射为 HTTP 400。 */
export class WorkspaceFilesError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceFilesError'
  }
}

/** 相对路径转绝对路径并校验仍在 root 内；rel 为空表示根目录。 */
function resolveWithin(root: string, rel: string): string {
  const cleaned = rel.replaceAll('\\', '/').replace(/^\/+/, '')
  const target = resolve(root, cleaned)
  if (target !== root && !target.startsWith(root + sep)) {
    throw new WorkspaceFilesError(`路径越界: ${rel}`)
  }
  return target
}

/** 绝对路径转相对 root 的 wire 路径（空串表示根目录）。 */
function toRel(root: string, target: string): string {
  if (target === root) return ''
  const rel = target.slice(root.length + sep.length)
  return rel.replaceAll('\\', '/')
}

/** 校验单个文件名段（禁止分隔符与特殊字符）。 */
function validSegment(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '' || trimmed === '.' || trimmed === '..' || /[/\\]/.test(trimmed)) {
    throw new WorkspaceFilesError(`非法文件名: ${name}`)
  }
  if (/['"`$&|;<>*?]/.test(trimmed)) {
    throw new WorkspaceFilesError(`文件名包含非法字符: ${name}`)
  }
  return trimmed
}

/** 读取 JSON 请求体（带大小上限）。 */
async function readJsonBody(req: IncomingMessage, limit: number): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    total += (chunk as Buffer).length
    if (total > limit) throw new WorkspaceFilesError('请求体过大')
    chunks.push(chunk as Buffer)
  }
  if (chunks.length === 0) throw new WorkspaceFilesError('缺少请求体')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new WorkspaceFilesError('请求体不是合法 JSON')
  }
}

/** 写 JSON 响应。 */
function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/** 包装处理器：异常统一映射为 JSON 错误响应。 */
function guarded(handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    try {
      await handler(req, res)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      const status = error instanceof WorkspaceFilesError ? 400 : 500
      json(res, status, { ok: false, error: message })
    }
  }
}

/** 页面路由：GET /workspace-files。 */
function servePage(_req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(workspaceFilesPage)
}

/** 列表路由：GET /workspace-files/api/list?path=rel。 */
function listHandler(root: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') { methodNotAllowed(res); return }
    const url = new URL(req.url ?? '/', 'http://x')
    const rel = url.searchParams.get('path') ?? ''
    const target = resolveWithin(root, rel)
    const st = await stat(target)
    if (!st.isDirectory()) throw new WorkspaceFilesError('目标不是目录')
    const dirents = await readdir(target, { withFileTypes: true })
    const entries: Array<{ name: string; path: string; is_dir: boolean; size: number; mtime: number }> = []
    for (const dirent of dirents) {
      const full = join(target, dirent.name)
      let size = 0
      let mtime = 0
      try {
        const info = await stat(full)
        size = info.size
        mtime = Math.floor(info.mtimeMs / 1000)
      } catch {
        // 悬空符号链接等：以 0 大小展示，仍允许操作
      }
      entries.push({
        name: dirent.name,
        path: toRel(root, full),
        is_dir: dirent.isDirectory(),
        size,
        mtime,
      })
    }
    entries.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    json(res, 200, { ok: true, root, path: toRel(root, target), entries })
  }
}

/** 下载路由：GET /workspace-files/api/download?path=rel。 */
function downloadHandler(root: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') { methodNotAllowed(res); return }
    const url = new URL(req.url ?? '/', 'http://x')
    const rel = url.searchParams.get('path') ?? ''
    const target = resolveWithin(root, rel)
    const st = await stat(target)
    if (st.isDirectory()) throw new WorkspaceFilesError('不能下载目录')
    const body = await readFile(target)
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(basename(target))}"`,
      'Content-Length': String(body.length),
    })
    res.end(body)
  }
}

/** 上传路由：POST /workspace-files/api/upload {path, name, content(base64)}。 */
function uploadHandler(root: string, maxUploadBytes: number) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') { methodNotAllowed(res); return }
    const body = (await readJsonBody(req, Math.ceil(maxUploadBytes * 1.4) + 65536)) as {
      path?: string
      name?: string
      content?: string
    }
    const name = validSegment(body.name ?? '')
    const content = (body.content ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
    if (content === '') throw new WorkspaceFilesError('文件内容为空')
    const data = Buffer.from(content, 'base64')
    if (data.length === 0) throw new WorkspaceFilesError('文件内容为空')
    if (data.length > maxUploadBytes) {
      throw new WorkspaceFilesError(`文件超过大小上限（${Math.floor(maxUploadBytes / 1024 / 1024)}MB）`)
    }
    const dir = (body.path ?? '').replaceAll('\\', '/').replace(/^\/+/, '')
    const target = resolveWithin(root, dir === '' ? name : `${dir}/${name}`)
    await writeFile(target, data)
    json(res, 200, { ok: true, path: toRel(root, target), size: data.length })
  }
}

/** 新建目录路由：POST /workspace-files/api/mkdir {path}。 */
function mkdirHandler(root: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') { methodNotAllowed(res); return }
    const body = (await readJsonBody(req, 65536)) as { path?: string }
    const rel = (body.path ?? '').trim()
    if (rel === '') throw new WorkspaceFilesError('缺少目录路径')
    const target = resolveWithin(root, rel)
    await mkdir(target, { recursive: true })
    json(res, 200, { ok: true, path: toRel(root, target) })
  }
}

/** 删除路由：POST /workspace-files/api/delete {path}。 */
function deleteHandler(root: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') { methodNotAllowed(res); return }
    const body = (await readJsonBody(req, 65536)) as { path?: string }
    const rel = (body.path ?? '').trim()
    if (rel === '') throw new WorkspaceFilesError('不能删除根目录')
    const target = resolveWithin(root, rel)
    await rm(target, { recursive: true, force: true })
    json(res, 200, { ok: true })
  }
}

function methodNotAllowed(res: ServerResponse): void {
  json(res, 405, { ok: false, error: 'method not allowed' })
}

/**
 * 注册工作区文件页面与 API 路由；并在插件树就绪后把 root 目录注册为默认
 * 工作区（幂等），使 DSH Web 的新会话/英雄页直接使用该目录，无需用户手工
 * 选择目录（平台部署时 root 即用户工作区卷 /workspace）。
 * @param ctx - 插件上下文（注入 webServer）。
 * @param config - 校验后的配置。
 */
export function apply(ctx: Context, config: Config): void {
  const root = resolve(config.root)
  const register = (path: string, handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void): void => {
    const wrapped = guarded(handler)
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path,
      handler: (req, res) => wrapped(req, res),
    }), `workspace-files: route ${path}`)
  }
  register('/workspace-files', servePage)
  register('/workspace-files/api/list', listHandler(root))
  register('/workspace-files/api/download', downloadHandler(root))
  register('/workspace-files/api/upload', uploadHandler(root, config.maxUploadBytes))
  register('/workspace-files/api/mkdir', mkdirHandler(root))
  register('/workspace-files/api/delete', deleteHandler(root))

  // 默认工作区：树就绪后（所有服务已启动）确保 root 已是工作区记录。
  // workspaceRegistry.create 对同一 canonical 路径幂等；缺少该服务
  // （非 web 组合）时静默跳过（create 幂等，重复调用无副作用）。
  const ensureWorkspace = async (): Promise<void> => {
    try {
      await ctx.workspaceRegistry.create(root, 'workspace')
      ctx.logger.info(`workspace-files: 默认工作区已就绪 ${root}`)
    } catch (error: unknown) {
      ctx.logger.warn(`workspace-files: 默认工作区注册失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  // 树就绪后（所有服务已启动）确保 root 已是工作区记录；loader 缺失
  // （非 web 组合）时直接注册。workspaceRegistry.create 对同一 canonical
  // 路径幂等；缺少该服务或引导失败时静默跳过。
  const settled = ctx.get('loader')?.await()
  if (settled === undefined) {
    void ensureWorkspace()
  } else {
    void settled.then(() => void ensureWorkspace(), () => { /* 引导失败：保持静默 */ })
  }
}
