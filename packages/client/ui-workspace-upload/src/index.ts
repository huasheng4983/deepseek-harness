/**
 * Workspace upload plugin, node half. Pure UI plugin: the empty apply exists so
 * the plugin appears in the host cordis.yml / Loader; the browser half ships
 * via exports["./client"], discovered through the package.json dsh.client
 * declaration. Upload behavior itself (the composer tool-row button, the
 * [workspace-file] marker protocol, the downloadable card renderer) is owned
 * by this package's browser half, composed independently on the web roster.
 */

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
