// Relais à IP fixe pour GuTouch / TouchPay, version Node (à lancer sur le VPS avec pm2).
// Vercel envoie ici ses appels vers GuTouch ; GuTouch voit l'adresse IP du VPS.
// Variables : RELAY_SECRET (obligatoire, la même que GT_RELAY_SECRET sur Vercel), PORT (défaut 8787).
// Écoute seulement en local : Caddy (https) est placé devant.
import http from 'node:http'
import https from 'node:https'

const SECRET = process.env.RELAY_SECRET || ''
const PORT = Number(process.env.PORT || 8787)
const ALLOWED_HOST = 'apidist.gutouch.net'
if (SECRET.length < 16) { console.error('RELAY_SECRET manquant ou trop court (16 caractères minimum).'); process.exit(1) }

const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)) }

http.createServer((req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'method' })
  if (req.headers['x-relay-secret'] !== SECRET) return send(res, 403, { error: 'forbidden' })
  let raw = ''
  req.on('data', (c) => { raw += c; if (raw.length > 100000) req.destroy() })
  req.on('end', () => {
    let inp
    try { inp = JSON.parse(raw) } catch { return send(res, 400, { error: 'json' }) }
    let u
    try { u = new URL(String(inp.url || '')) } catch { return send(res, 400, { error: 'url' }) }
    if (u.protocol !== 'https:' || u.hostname !== ALLOWED_HOST) return send(res, 400, { error: 'host refused' })
    const method = String(inp.method || 'GET').toUpperCase()
    if (!['GET', 'POST', 'PUT'].includes(method)) return send(res, 400, { error: 'method refused' })
    const headers = {}
    for (const [k, v] of Object.entries(inp.headers || {})) if (!['host', 'content-length', 'connection'].includes(k.toLowerCase())) headers[k] = v
    const body = inp.body == null ? null : String(inp.body)
    if (body != null) headers['Content-Length'] = Buffer.byteLength(body)
    const out = https.request({ hostname: u.hostname, port: u.port || 443, path: u.pathname + u.search, method, headers, family: 4, timeout: 25000 }, (r) => {
      const chunks = []
      r.on('data', (c) => chunks.push(c))
      r.on('end', () => {
        const wa = r.headers['www-authenticate']
        send(res, 200, { status: r.statusCode, wwwAuthenticate: Array.isArray(wa) ? wa[0] : wa || null, body: Buffer.concat(chunks).toString('utf8') })
      })
    })
    out.on('timeout', () => out.destroy(new Error('timeout')))
    out.on('error', (e) => send(res, 502, { error: 'upstream: ' + e.message }))
    if (body != null) out.write(body)
    out.end()
  })
}).listen(PORT, '127.0.0.1', () => console.log('relais prêt sur 127.0.0.1:' + PORT))
