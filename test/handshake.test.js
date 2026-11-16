import assert from 'node:assert/strict'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { test } from 'node:test'
import { handshake } from '../scripts/handshake.mjs'

async function serve(t, respond) {
  const sockets = new Set()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('error', () => {})
    socket.once('close', () => sockets.delete(socket))
    socket.once('data', () => respond(socket))
  })
  t.after(async () => {
    for (const socket of sockets) socket.destroy()
    await new Promise((resolve) => server.close(resolve))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  return { origin: `http://127.0.0.1:${port}`, port }
}

test('handshake accepts a complete response split across chunks', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\n')
    setImmediate(() => socket.end('Upgrade: websocket\r\n\r\n'))
  })
  assert.equal(await handshake(origin, port), 101)
})

test('handshake returns an HTTP rejection status', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'))
  assert.equal(await handshake(origin, port), 403)
})

test('handshake rejects a clean EOF without headers', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => socket.end())
  await assert.rejects(handshake(origin, port), /before complete response headers/)
})

test('handshake rejects clean EOF after incomplete headers', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => socket.end('HTTP/1.1 101 Switching Protocols\r\n'))
  await assert.rejects(handshake(origin, port), /before complete response headers/)
})

test('handshake rejects an abruptly reset connection', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => socket.resetAndDestroy())
  await assert.rejects(handshake(origin, port), /ECONNRESET|before complete response headers/)
})

test('handshake has a deadline when the peer never responds', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, () => {})
  await assert.rejects(handshake(origin, port, {}, { timeoutMs: 80 }), /handshake timed out/)
})

test('partial data does not extend the total handshake deadline', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => {
    const timer = setInterval(() => { if (!socket.destroyed) socket.write('H') }, 10)
    socket.once('close', () => clearInterval(timer))
    t.after(() => clearInterval(timer))
  })
  await assert.rejects(handshake(origin, port, {}, { timeoutMs: 80 }), /handshake timed out/)
})

test('handshake rejects a complete response without a valid HTTP status', { timeout: 2000 }, async (t) => {
  const { origin, port } = await serve(t, (socket) => socket.end('not HTTP\r\n\r\n'))
  await assert.rejects(handshake(origin, port), /Invalid WebSocket handshake response status/)
})
