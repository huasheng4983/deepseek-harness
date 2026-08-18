/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-host-workspace-files`.
 * @module @deepseek-ai/dsh-host-workspace-files/invariant
 */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-workspace-files'

/** Cordis companion plugin name. */
export const name = 'host-workspace-files-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/**
 * No runtime invariant: every route is registered through the webserver's
 * named-route table, whose duplicate-path contract is enforced by the
 * webserver service itself and covered by its real-composition tests.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
