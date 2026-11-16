import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { handshake } from './handshake.mjs'

const dsh = process.env.DSH_BIN
if (!dsh) throw new Error('Set DSH_BIN to the installed DSH JavaScript entry point.')
const project = fileURLToPath(new URL('../', import.meta.url))
const host = process.env.DSH_TEST_HOST || '127.0.0.1'
const tempParent = realpathSync(tmpdir())
const home = mkdtempSync(join(tempParent, 'dsh-lan-open-'))
const profile = join(home, 'profiles', 'web')
const plugin = join(home, 'packages', 'dsh-lan-open')
const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'))
const bundles = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app']
let child
let childExit
let output = ''

async function stop() {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  const pid = child.pid
  const signal = (value) => {
    try {
      if (process.platform === 'win32') child.kill(value)
      else process.kill(-pid, value)
    } catch (error) { if (error.code !== 'ESRCH') throw error }
  }
  signal('SIGTERM')
  const timer = setTimeout(() => signal('SIGKILL'), 5000)
  try { await childExit } finally { clearTimeout(timer) }
}

async function boot(expectedStatus) {
  const reserve = createServer()
  reserve.listen(0, host)
  await once(reserve, 'listening')
  const port = reserve.address().port
  await new Promise((resolve) => reserve.close(resolve))
  const origin = `http://${host}:${port}`
  child = spawn(process.execPath, [
    '--report-exclude-network', dsh, 'web', '--host', host, '--port', String(port),
    '--trusted-host', `${host}:${port}`, '--no-open',
  ], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
    detached: process.platform !== 'win32',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  childExit = once(child, 'exit')
  output = ''
  const collect = (chunk) => { output = (output + chunk).slice(-12000) }
  child.stdout.on('data', collect)
  child.stderr.on('data', collect)
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error('DSH exited during startup.')
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1000) })
      const html = await response.text()
      if (response.status === expectedStatus) return { origin, port, html }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error(`DSH did not return the expected ${expectedStatus}.`)
}

try {
  mkdirSync(join(profile, 'node_modules'), { recursive: true })
  mkdirSync(plugin, { recursive: true })
  for (const file of ['package.json', ...manifest.files]) copyFileSync(join(project, file), join(plugin, file))
  symlinkSync(plugin, join(profile, 'node_modules', 'dsh-lan-open'), 'junction')
  writeFileSync(join(profile, 'cordis.yml'), '[]\n')
  writeFileSync(join(profile, 'cordis.patch.yml'), '[]\n')
  const configure = (enabled) => writeFileSync(join(profile, 'package.json'), JSON.stringify({
    name: 'dsh-lan-open-integration', private: true,
    dependencies: { 'dsh-lan-open': `file:${plugin}` },
    dsh: { profile: { bundles: enabled ? [...bundles, 'dsh-lan-open'] : bundles } },
  }, null, 2))

  configure(false)
  const baseline = await boot(401)
  assert.match(baseline.html, /dsh web authentication required/)
  console.log('PASS: isolated DSH requires authentication without the plugin (401).')
  await stop()

  configure(true)
  const { origin, port, html } = await boot(200)
  assert.match(html, /<html/i)
  assert.ok(html.includes('globalThis.__DSH_TRANSPORT__={ownsHost:true}'))
  console.log('PASS: LAN page loads without token/cookie; host-settings script is present (200).')
  assert.equal(await handshake(origin, port), 101)
  console.log('PASS: API WebSocket connects without token/cookie (101).')
  for (const headers of [
    { Origin: 'http://untrusted.invalid' },
    { Host: 'untrusted.invalid' },
    { 'Sec-Fetch-Site': 'cross-site' },
  ]) assert.equal(await handshake(origin, port, headers), 403)
  console.log('PASS: untrusted Origin, Host, and cross-site API requests remain forbidden (403).')
} catch (error) {
  console.error(output.replace(/([?&]token=)[^\s"'<>]+/g, '$1[REDACTED]'))
  throw error
} finally {
  await stop()
  // Only remove the temporary directory created above, never the user's DSH_HOME.
  const resolved = realpathSync(home)
  assert.equal(dirname(resolved), tempParent)
  assert.ok(basename(resolved).startsWith('dsh-lan-open-'))
  rmSync(resolved, { recursive: true, force: true })
}
