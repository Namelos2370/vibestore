// Changement d'email d'un artiste ayant déjà un compte (fonction serverless Vercel).
// Utilise SUPABASE_SERVICE_ROLE_KEY (déjà défini pour les notifications). Réservé aux admins.
const SB_URL = process.env.SUPABASE_URL || 'https://vijpixbrxmnslkaiumxm.supabase.co'
const SB_ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_W_jvIbb_vRZxd44hZw3h9w_EolmVPJm'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST seulement' })
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!service) return res.status(503).json({ error: 'Serveur non configuré (clé service manquante).' })

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  if (!token) return res.status(401).json({ error: 'Non connecté.' })
  const chk = await fetch(`${SB_URL}/rest/v1/rpc/is_admin`, {
    method: 'POST', headers: { apikey: SB_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
  })
  if (!chk.ok || (await chk.json()) !== true) return res.status(403).json({ error: 'Réservé à l’équipe VibeStore.' })

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
  const email = String(body.email || '').trim().toLowerCase()
  const artistId = String(body.artistId || '')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Email invalide.' })
  if (!/^[0-9a-f-]{36}$/i.test(artistId)) return res.status(400).json({ error: 'Artiste invalide.' })

  // Anciennes clés (JWT « eyJ… ») : Bearer. Nouvelles clés « sb_secret_… » : en-tête apikey seulement.
  const H = { apikey: service, 'Content-Type': 'application/json', ...(service.startsWith('eyJ') ? { Authorization: `Bearer ${service}` } : {}) }
  const why = async (r) => { try { const t = await r.text(); const j = JSON.parse(t); return String(j.msg || j.message || j.error_description || j.error || t).slice(0, 160) } catch { return `HTTP ${r.status}` } }
  const ar = await fetch(`${SB_URL}/rest/v1/artists?id=eq.${artistId}&select=user_id`, { headers: H })
  if (!ar.ok) return res.status(502).json({ error: `Lecture de l’artiste refusée (${ar.status}) : ${await why(ar)}. Vérifie la variable SUPABASE_SERVICE_ROLE_KEY sur Vercel.` })
  const rows = await ar.json()
  const userId = rows[0]?.user_id
  if (!userId) return res.status(404).json({ error: 'Cet artiste n’a pas encore de compte : change son email d’invitation.' })

  // 1) email de connexion (confirmé d'office : c'est l'équipe qui le fixe)
  const up = await fetch(`${SB_URL}/auth/v1/admin/users/${userId}`, { method: 'PUT', headers: H, body: JSON.stringify({ email, email_confirm: true }) })
  if (!up.ok) {
    const t = await why(up)
    const dup = /already|registered|exists|duplicate/i.test(t)
    return res.status(dup ? 409 : 502).json({ error: dup ? 'Cet email est déjà utilisé par un autre compte.' : `Changement refusé (${up.status}) : ${t}` })
  }
  // 2) profil et invitation restent alignés
  await fetch(`${SB_URL}/rest/v1/profiles?id=eq.${userId}`, { method: 'PATCH', headers: { ...H, Prefer: 'return=minimal' }, body: JSON.stringify({ email }) })
  await fetch(`${SB_URL}/rest/v1/artist_invites?on_conflict=artist_id`, { method: 'POST', headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ artist_id: artistId, email }) })
  return res.status(200).json({ ok: true })
}
