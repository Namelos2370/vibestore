// Outils communs pour le paiement GuTouch / TouchPay (fichier interne, pas une route).
// Variables d'environnement Vercel (jamais dans le code) :
//   GT_AGENCE, GT_LOGIN_AGENT, GT_PASSWORD_AGENT, GT_PARTNER_ID, GT_AUTH_USER, GT_AUTH_PASS
//   SUPABASE_SERVICE_ROLE_KEY ; facultatives : SUPABASE_URL, SUPABASE_ANON_KEY, PUBLIC_URL
import crypto from 'node:crypto'

export const SB_URL = process.env.SUPABASE_URL || 'https://vijpixbrxmnslkaiumxm.supabase.co'
export const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W_jvIbb_vRZxd44hZw3h9w_EolmVPJm'
const GT = 'https://apidist.gutouch.net/apidist/sec'

export const SERVICE_CODES = { momo: 'PAIEMENTMARCHAND_MTN_CM', om: 'CM_PAIEMENTMARCHAND_OM_TP' }

export const env = () => ({
  agence: process.env.GT_AGENCE, login: process.env.GT_LOGIN_AGENT, password: process.env.GT_PASSWORD_AGENT,
  partner: process.env.GT_PARTNER_ID, authUser: process.env.GT_AUTH_USER, authPass: process.env.GT_AUTH_PASS,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
})
export const configured = (e = env()) => !!(e.agence && e.login && e.password && e.partner && e.authUser && e.authPass && e.service)

export const serviceHeaders = (service) => ({ apikey: service, Authorization: `Bearer ${service}`, 'Content-Type': 'application/json' })

/** Utilisateur connecté à partir du jeton Supabase du navigateur. */
export async function userFromToken(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const r = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SB_ANON, Authorization: `Bearer ${token}` } })
  if (!r.ok) return null
  const u = await r.json()
  return u && u.id ? u : null
}

const md5 = (s) => crypto.createHash('md5').update(s).digest('hex')
function parseChallenge(h) {
  const out = {}
  String(h || '').replace(/^Digest\s+/i, '').replace(/(\w+)=(?:"([^"]*)"|([^,\s]+))/g, (_, k, a, b) => { out[k.toLowerCase()] = a ?? b })
  return out
}
/** Requête avec authentification Digest (le serveur répond d'abord 401 avec un défi). */
export async function digestFetch(url, { method = 'GET', body, headers = {} }, user, pass) {
  const first = await fetch(url, { method, body, headers })
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
  return fetch(url, { method, body, headers: { ...headers, Authorization: auth } })
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
  const r = await fetch(`${GT}/${e.agence}/check_status`, {
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
