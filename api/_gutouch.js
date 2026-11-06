// Outils communs pour le paiement GuTouch / TouchPay (fichier interne, pas une route).
// Variables d'environnement Vercel (jamais dans le code) :
//   GT_AGENCE, GT_LOGIN_AGENT, GT_PASSWORD_AGENT, GT_PARTNER_ID, GT_AUTH_USER, GT_AUTH_PASS
//   SUPABASE_SERVICE_ROLE_KEY ; facultatives : SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_URL
import crypto from 'node:crypto'
import https from 'node:https'
import http from 'node:http'

export const SB_URL = process.env.SUPABASE_URL || 'https://vijpixbrxmnslkaiumxm.supabase.co'
export const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W_jvIbb_vRZxd44hZw3h9w_EolmVPJm'
const GT = 'https://apidist.gutouch.net/apidist/sec'

export const SERVICE_CODES = { momo: 'PAIEMENTMARCHAND_MTN_CM', om: 'CM_PAIEMENTMARCHAND_OM_TP' }

// Les noms INTOUCH_* (kit TouchPay) sont acceptés en plus des noms GT_*.
const pick = (a, b) => process.env[a] || process.env[b]
export const env = () => ({
  agence: pick('GT_AGENCE', 'INTOUCH_AGENCE'), login: pick('GT_LOGIN_AGENT', 'INTOUCH_LOGIN_API'), password: pick('GT_PASSWORD_AGENT', 'INTOUCH_PASSWORD_API'),
  partner: pick('GT_PARTNER_ID', 'INTOUCH_PARTNER_ID'), authUser: pick('GT_AUTH_USER', 'INTOUCH_AUTH_USER'), authPass: pick('GT_AUTH_PASS', 'INTOUCH_AUTH_PASS'),
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
export const configured = (e = env()) => !!(e.agence && e.login && e.password && e.partner && e.authUser && e.authPass && e.service)

// Ancienne clé « service_role » (JWT « eyJ… ») : Bearer. Nouvelle clé « sb_secret_… » : en-tête apikey seulement.
export const serviceHeaders = (service) => ({ apikey: service, ...(String(service).startsWith('eyJ') ? { Authorization: `Bearer ${service}` } : {}), 'Content-Type': 'application/json' })

/** Utilisateur connecté à partir du jeton Supabase du navigateur. */
export async function userFromToken(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u && u.id ? u : null
}

/** Requête HTTP(S) en IPv4 forcé (l'API GuTouch expire en IPv6, constaté sur Hostinger). */
// Si GT_RELAY_URL est défini, les appels vers GuTouch passent par un relais à IP fixe (relay/relay.php),
// car GuTouch n'accepte que les adresses IP enregistrées et Vercel n'en a pas de fixe.
async function viaRelay(url, { method, headers, body }) {
  const r = await fetch(process.env.GT_RELAY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Relay-Secret': process.env.GT_RELAY_SECRET || '' }, body: JSON.stringify({ url, method, headers, body: body == null ? null : String(body) }), signal: AbortSignal.timeout(30000) })
  let j = {}
  try { j = await r.json() } catch {}
  if (!r.ok || j.status == null) throw new Error('Relais injoignable ou refusé' + (j.error ? ' : ' + j.error : ` (${r.status})`))
  return { status: j.status, ok: j.status >= 200 && j.status < 300, headers: { get: (k) => (String(k).toLowerCase() === 'www-authenticate' ? j.wwwAuthenticate || null : null) }, text: async () => j.body ?? '' }
}
function rq(url, { method = 'GET', headers = {}, body } = {}) {
  if (process.env.GT_RELAY_URL && /(^|\.)gutouch\.net$/i.test(new URL(url).hostname)) return viaRelay(url, { method, headers, body })
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const lib = u.protocol === 'http:' ? http : https
    const h = { ...headers }
    if (body != null) h['Content-Length'] = Buffer.byteLength(body)
    const req = lib.request({ protocol: u.protocol, hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search, method, headers: h, family: 4, timeout: 25000 }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        resolve({ status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300, headers: { get: (k) => { const v = res.headers[String(k).toLowerCase()]; return Array.isArray(v) ? v[0] : v || null } }, text: async () => text })
      })
    })
    req.on('timeout', () => req.destroy(new Error('Délai dépassé')))
    req.on('error', reject)
    if (body != null) req.write(body)
    req.end()
  })
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
function parseChallenge(h) {
  const out = {}
  String(h || '').replace(/^Digest\s+/i, '').replace(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g, (_, k, a, b) => { out[k.toLowerCase()] = a ?? b })
  return out
}
/** Requête avec authentification Digest (le serveur répond d'abord 401 avec un défi). */
export async function digestFetch(url, { method = 'GET', body, headers = {} }, user, pass) {
  const first = await rq(url, { method, body, headers })
  if (first.status !== 401) return first
  const c = parseChallenge(first.headers.get('www-authenticate'))
  if (!c.nonce) return first
  const u = new URL(url)
  const uri = u.pathname + u.search
  const nc = '00000001'
  const cnonce = crypto.randomBytes(8).toString('hex')
  const ha1 = md5(`${user}:${c.realm}:${pass}`)
  const ha2 = md5(`${method}:${uri}`)
  const qop = c.qop ? c.qop.split(',')[0].trim() : ''
  const response = qop ? md5(`${ha1}:${c.nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${c.nonce}:${ha2}`)
  let auth = `Digest username="${user}", realm="${c.realm}", nonce="${c.nonce}", uri="${uri}", response="${response}"`
  if (c.opaque) auth += `, opaque="${c.opaque}"`
  if (qop) auth += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`
  if (c.algorithm) auth += `, algorithm=${c.algorithm}`
  return rq(url, { method, body, headers: { ...headers, Authorization: auth } })
}

/** Lecture tolérante du statut renvoyé par GuTouch : 'paid' | 'failed' | 'pending'. */
export function readStatus(j) {
  const txt = JSON.stringify(j || {})
  const st = String((j && (j.status ?? j.Status ?? j.transactionStatus ?? j.state)) ?? '')
  const probe = st || txt
  if (/UNSUCCESS/i.test(probe)) return 'failed'
  if (/SUCCESS|SUCCES|PAID|COMPLETED/i.test(probe)) return 'paid'
  if (/FAIL|ECHEC|CANCEL|REJECT|EXPIRE|DECLIN|REFUS|ERROR/i.test(probe)) return 'failed'
  return 'pending'
}

/** Demande à GuTouch l'état réel d'une transaction (on ne se fie jamais au contenu du callback). */
export async function checkStatus(ref) {
  const e = env()
  const r = await rq(`${GT}/${e.agence}/check_status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${e.authUser}:${e.authPass}`).toString('base64') },
    body: JSON.stringify({ partner_id: e.partner, partner_transaction_id: ref, login_api: e.login, password_api: e.password }),
  })
  const t = await r.text()
  let j = {}; try { j = JSON.parse(t) } catch { /* texte brut */ }
  console.log('[gutouch check_status]', r.status, t.slice(0, 300))
  if (!r.ok) return 'pending'
  return readStatus(j)
}

/** Conclut la commande côté base (payée ou échouée). */
export async function finalize(ref, ok) {
  const e = env()
  const r = await fetch(`${SB_URL}/rest/v1/rpc/finalize_order`, { method: 'POST', headers: serviceHeaders(e.service), body: JSON.stringify({ p_ref: ref, p_ok: ok }) })
  return r.ok
}

export async function startTransaction({ ref, amount, phone, method, email, name, callback }) {
  const e = env()
  const [first, ...rest] = String(name || 'Client').trim().split(/\s+/)
  const url = `${GT}/touchpayapi/${e.agence}/transaction?loginAgent=${encodeURIComponent(e.login)}&passwordAgent=${encodeURIComponent(e.password)}`
  const body = JSON.stringify({
    idFromClient: ref,
    additionnalInfos: { recipientEmail: email || '', recipientFirstName: first || 'Client', recipientLastName: rest.join(' ') || first || 'VibeStore', destinataire: phone },
    amount,
    callback,
    recipientNumber: phone,
    serviceCode: SERVICE_CODES[method],
  })
  const r = await digestFetch(url, { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } }, e.authUser, e.authPass)
  const t = await r.text()
  let j = {}; try { j = JSON.parse(t) } catch { /* texte brut */ }
  console.log('[gutouch transaction]', r.status, t.slice(0, 300))
  return { ok: r.ok, http: r.status, json: j, status: r.ok ? readStatus(j) : 'failed' }
}
