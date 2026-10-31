// Envoi des notifications push (fonction serverless Vercel).
// Variables d'environnement à définir sur Vercel :
//   VAPID_PRIVATE_KEY         clé privée de signature (jamais dans le code)
//   SUPABASE_SERVICE_ROLE_KEY clé « service_role » de Supabase (jamais dans le code)
// Facultatives : VAPID_PUBLIC_KEY, VAPID_SUBJECT, SUPABASE_URL, SUPABASE_ANON_KEY
import webpush from 'web-push'

const SB_URL = process.env.SUPABASE_URL || 'https://vijpixbrxmnslkaiumxm.supabase.co'
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W_jvIbb_vRZxd44hZw3h9w_EolmVPJm'
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || 'BCmCrRonL3_YMbMa3KGQkahICOR1TuUMzGfTJYT498zgydEOznPfYMqWg0amsoqOn1S3msfLPM8rufxzCSWIMgQ'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST seulement' })
  const priv = process.env.VAPID_PRIVATE_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!priv || !service) return res.status(503).json({ error: 'Notifications push non configurées sur le serveur.' })

  // 1) Seul un admin connecté peut déclencher un envoi.
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Non connecté.' })
  const chk = await fetch(`${SB_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST', headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  if (!chk.ok || (await chk.json()) !== true) return res.status(403).json({ error: 'Réservé à l’équipe VibeStore.' })

  // 2) Message
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const title = String(body.title || '').slice(0, 120)
  if (!title) return res.status(400).json({ error: 'Titre manquant.' })
  const payload = JSON.stringify({ title, body: String(body.body || '').slice(0, 300), url: String(body.url || '/').slice(0, 300) })

  // 3) Appareils abonnés (lus avec la clé serveur : la table n'est lisible par personne d'autre)
  const subsRes = await fetch(`${SB_URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth`, {
    headers: { apikey: service, Authorization: `Bearer ${service}` },
  })
  if (!subsRes.ok) return res.status(502).json({ error: 'Lecture des abonnés impossible.' })
  const subs = await subsRes.json()

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@vibestore.cm', VAPID_PUBLIC, priv)
  let sent = 0
  const dead = []
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })
      sent++
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(s.id)
    }
  }))
  if (dead.length) {
    await fetch(`${SB_URL}/rest/v1/push_subscriptions?id=in.(${dead.join(',')})`, {
      method: 'DELETE', headers: { apikey: service, Authorization: `Bearer ${service}` },
    })
  }
  return res.status(200).json({ sent, total: subs.length, removed: dead.length })
}
