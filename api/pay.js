// Démarre un paiement Mobile Money réel : crée la commande « en attente » puis demande le paiement au client.
import crypto from 'node:crypto'
import { SB_URL, env, configured, serviceHeaders, userFromToken, startTransaction, finalize } from './_gutouch.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST seulement' })
  const e = env()
  if (!configured(e)) return res.status(503).json({ error: 'Le paiement n’est pas encore configuré sur le serveur.' })
  const user = await userFromToken(req)
  if (!user) return res.status(401).json({ error: 'Connecte-toi pour acheter.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const method = body.method === 'om' ? 'om' : body.method === 'momo' ? 'momo' : ''
  const phone = String(body.phone || '').replace(/[\s+]/g, '').replace(/^237/, '')
  if (!method) return res.status(400).json({ error: 'Choisis MTN Mobile Money ou Orange Money.' })
  if (!/^6\d{8}$/.test(phone)) return res.status(400).json({ error: 'Numéro Mobile Money invalide (9 chiffres, par exemple 670000000).' })
  const items = (Array.isArray(body.items) ? body.items : []).slice(0, 50).filter((i) => i && (i.type === 'track' || i.type === 'album') && /^[0-9a-f-]{36}$/i.test(String(i.id)))
  if (!items.length) return res.status(400).json({ error: 'Panier vide.' })

  const ref = crypto.randomUUID()
  // 1) commande en attente (les prix viennent de la base, jamais du navigateur)
  const rpc = await fetch(`${SB_URL}/rest/v1/rpc/create_pending_order`, { method: 'POST', headers: serviceHeaders(e.service), body: JSON.stringify({ p_user: user.id, p_items: items, p_method: method, p_ref: ref }) })
  const rows = await rpc.json().catch(() => null)
  if (!rpc.ok) {
    const m = (rows && rows.message) || ''
    if (/permission denied/i.test(m)) return res.status(500).json({ error: 'Configuration serveur : la variable SUPABASE_SERVICE_ROLE_KEY de Vercel n’est pas la clé secrète (service_role / sb_secret_…) de Supabase, ou le schéma v1.4 n’a pas été exécuté.' })
    return res.status(400).json({ error: m || 'Commande impossible.' })
  }
  const total = (rows || []).reduce((t, r) => t + r.amount, 0)
  if (!rows || !rows.length || total <= 0) return res.status(400).json({ error: 'Rien à payer : tu possèdes déjà ces titres.' })

  // 2) demande de paiement à l'opérateur
  const prof = await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${user.id}&select=name`, { headers: serviceHeaders(e.service) }).then((r) => r.json()).catch(() => [])
  const origin = process.env.PUBLIC_URL || `https://${req.headers['x-forwarded-host'] || req.headers.host}`
  let tx
  try {
    tx = await startTransaction({ ref, amount: total, phone, method, email: user.email, name: prof?.[0]?.name, callback: `${origin}/api/pay-callback` })
  } catch (err) {
    console.error('[pay] réseau', err)
    await finalize(ref, false)
    return res.status(502).json({ error: 'L’opérateur de paiement est injoignable pour le moment. Réessaie dans un instant.' })
  }
  if (!tx.ok || tx.status === 'failed') {
    await finalize(ref, false)
    return res.status(502).json({ error: (tx.json && (tx.json.message || tx.json.detail)) || 'Le paiement a été refusé par l’opérateur.' })
  }
  if (tx.status === 'paid') await finalize(ref, true)
  return res.status(200).json({ ref, status: tx.status, total })
}
