// Le navigateur demande l'état d'une commande (et on revérifie auprès de GuTouch si elle est encore en attente).
import { SB_URL, env, configured, serviceHeaders, userFromToken, checkStatus, finalize } from './_gutouch.js'

export default async function handler(req, res) {
  const e = env()
  if (!configured(e)) return res.status(503).json({ error: 'Paiement non configuré.' })
  const user = await userFromToken(req)
  if (!user) return res.status(401).json({ error: 'Non connecté.' })
  const ref = String((req.query && req.query.ref) || '')
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return res.status(400).json({ error: 'Référence invalide.' })
  const get = () => fetch(`${SB_URL}/rest/v1/purchases?provider_ref=eq.${ref}&user_id=eq.${user.id}&select=status`, { headers: serviceHeaders(e.service) }).then((r) => r.json()).catch(() => [])
  let rows = await get()
  if (!rows.length) return res.status(404).json({ error: 'Commande introuvable.' })
  if (rows.some((r) => r.status === 'pending')) {
    const st = await checkStatus(ref)
    if (st !== 'pending') { await finalize(ref, st === 'paid'); rows = await get() }
  }
  const status = rows.every((r) => r.status === 'paid') ? 'paid' : rows.some((r) => r.status === 'pending') ? 'pending' : 'failed'
  return res.status(200).json({ status })
}
