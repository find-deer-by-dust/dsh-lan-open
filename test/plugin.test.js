import assert from 'node:assert/strict'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'
import { apply } from '../index.js'

function harness(auth) {
  const events = new Map()
  const scopes = []
  let inject
  function connect(nextAuth) {
    const disposers = []
    const scope = {
      connection: { browserAuth: nextAuth },
      effect(factory) { disposers.push(factory()) },
    }
    inject(scope)
    const dispose = () => { for (const fn of [...disposers].reverse()) fn() }
    scopes.push(dispose)
    return dispose
  }
  const ctx = {
    inject(services, callback) {
      assert.deepEqual(services, ['connection'])
      inject = callback
      connect(auth)
    },
    on(event, callback) { events.set(event, callback) },
  }
  return {
    ctx, connect,
    dispose() { for (const fn of [...scopes].reverse()) fn() },
    injectPage(table) { events.get('webserver/index-inject')(table) },
  }
}

test('anonymous browser admission changes only while the plugin is active', () => {
  const original = function () { return this.signedIn }
  const auth = { signedIn: false, isAuthenticated: original }
  const h = harness(auth)
  apply(h.ctx)
  assert.equal(auth.isAuthenticated({ headers: {} }), true)
  h.dispose()
  assert.equal(auth.isAuthenticated, original)
  assert.equal(auth.isAuthenticated(), false)
})

test('overlapping scopes share a patch and release it exactly once', () => {
  const original = () => false
  const auth = { isAuthenticated: original }
  const first = harness(auth)
  const second = harness(auth)
  apply(first.ctx)
  const bypass = auth.isAuthenticated
  apply(second.ctx)
  assert.equal(auth.isAuthenticated, bypass)
  first.dispose()
  first.dispose()
  assert.equal(auth.isAuthenticated(), true)
  second.dispose()
  assert.equal(auth.isAuthenticated, original)
})

test('a rebuilt Connection gets its own patch and restores the retired one', () => {
  const first = { isAuthenticated: () => false }
  const second = { isAuthenticated: () => false }
  const firstOriginal = first.isAuthenticated
  const secondOriginal = second.isAuthenticated
  const h = harness(first)
  apply(h.ctx)
  h.dispose()
  h.connect(second)
  assert.equal(first.isAuthenticated, firstOriginal)
  assert.equal(second.isAuthenticated(), true)
  h.dispose()
  assert.equal(second.isAuthenticated, secondOriginal)
})

test('disposal preserves a later third-party replacement', () => {
  const auth = { isAuthenticated: () => false }
  const h = harness(auth)
  apply(h.ctx)
  const replacement = () => 'another-plugin'
  auth.isAuthenticated = replacement
  h.dispose()
  assert.equal(auth.isAuthenticated, replacement)
})

test('an incompatible host reports the missing API without creating a bypass', () => {
  for (const auth of [undefined, null, {}, { isAuthenticated: 'invalid' }]) {
    const h = harness(auth)
    assert.throws(() => apply(h.ctx), /connection\.browserAuth\.isAuthenticated/)
    if (auth) assert.notEqual(typeof auth.isAuthenticated, 'function')
  }
})

test('the injected script enables host settings for a LAN page', () => {
  const h = harness({ isAuthenticated: () => false })
  apply(h.ctx)
  const table = [{ kind: 'script', placement: 'body', text: 'existing' }]
  h.injectPage(table)
  assert.equal(table.length, 2)
  assert.equal(table[1].placement, 'head')
  const browser = { location: { hostname: '192.168.31.136' } }
  runInNewContext(table[1].text, browser)
  assert.equal(browser.__DSH_TRANSPORT__.ownsHost, true)
  h.dispose()
})

test('injection preserves an existing Desktop transport and its properties', () => {
  const h = harness({ isAuthenticated: () => false })
  apply(h.ctx)
  const table = []
  h.injectPage(table)
  const transport = { ownsHost: false, desktop: true }
  const browser = { __DSH_TRANSPORT__: transport }
  runInNewContext(table[0].text, browser)
  assert.equal(browser.__DSH_TRANSPORT__, transport)
  assert.equal(transport.ownsHost, false)
  assert.equal(transport.desktop, true)
  h.dispose()
})
