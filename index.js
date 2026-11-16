// Adapted from @he0119/dsh-tailnet-admin@0.1.0 (MIT); see THIRD_PARTY_NOTICES.md.
export const name = 'dsh-lan-open'

const patches = new WeakMap()
const pageScript = 'if(!globalThis.__DSH_TRANSPORT__){globalThis.__DSH_TRANSPORT__={ownsHost:true}}'

function acquire(auth) {
  if (!auth || typeof auth.isAuthenticated !== 'function') {
    throw new Error('dsh-lan-open: 当前 DSH 不提供 connection.browserAuth.isAuthenticated，未修改认证。')
  }

  let patch = patches.get(auth)
  if (!patch) {
    patch = { original: auth.isAuthenticated, bypass: () => true, refs: 0 }
    auth.isAuthenticated = patch.bypass
    patches.set(auth, patch)
  }
  patch.refs += 1

  let released = false
  return () => {
    if (released) return
    released = true
    if (--patch.refs !== 0) return
    // Do not overwrite a replacement installed by another plugin after us.
    if (auth.isAuthenticated === patch.bypass) auth.isAuthenticated = patch.original
    patches.delete(auth)
  }
}

/** Enabling this plugin disables browser token/cookie authentication. */
export function apply(ctx) {
  ctx.inject(['connection'], (scope) => {
    const release = acquire(scope.connection?.browserAuth)
    scope.effect(() => release, 'dsh-lan-open: restore browser authentication')
  })

  // Equivalent to upstream pageHosts: ['*']; keep an existing Desktop transport.
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'script', placement: 'head', text: pageScript })
  })
}
