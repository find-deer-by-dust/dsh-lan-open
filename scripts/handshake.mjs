import { randomBytes } from 'node:crypto'
import { createConnection } from 'node:net'

/** Read one upgrade response, with a deadline covering connection and all reads. */
export function handshake(origin, port, extra = {}, { timeoutMs = 5000 } = {}) {
  const url = new URL(origin)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const headers = {
    Host: url.host, Upgrade: 'websocket', Connection: 'Upgrade',
    'Sec-WebSocket-Key': randomBytes(16).toString('base64'),
    'Sec-WebSocket-Version': '13', Origin: origin, ...extra,
  }

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port })
    let response = ''
    let settled = false
    // A socket inactivity timeout can be postponed indefinitely by partial data.
    const deadline = setTimeout(() => finish(new Error('WebSocket handshake timed out.')), timeoutMs)

    function finish(error, status) {
      if (settled) return
      settled = true
      clearTimeout(deadline)
      socket.destroy()
      if (error) reject(error)
      else resolve(status)
    }

    // Keep the error handler through destruction to consume late socket errors.
    socket.on('error', (error) => finish(error))
    socket.once('end', () => finish(new Error('WebSocket handshake ended before complete response headers.')))
    socket.once('close', () => finish(new Error('WebSocket handshake closed before complete response headers.')))
    socket.once('connect', () => socket.write('GET /api/remote.mux HTTP/1.1\r\n'
      + Object.entries(headers).map(([key, value]) => `${key}: ${value}\r\n`).join('') + '\r\n'))
    socket.on('data', (chunk) => {
      response += chunk.toString('latin1')
      if (!response.includes('\r\n\r\n')) return
      const match = /^HTTP\/1\.[01] ([1-5]\d{2})(?:\s|$)/.exec(response)
      if (!match) finish(new Error('Invalid WebSocket handshake response status.'))
      else finish(undefined, Number(match[1]))
    })
  })
}
