// Appelé par GuTouch quand le client a validé (ou refusé). On ne croit pas le contenu : on revérifie auprès de GuTouch.
import { configured, checkStatus, finalize } from './_gutouch.js'

export default async function handler(req, res) {
  if (!configured()) return res.status(503).json({ ok: false })
  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body) } catch { return {} } })() : req.body || {}
  const q = req.query || {}
  const ref = String(body.partner_transaction_id || body.idFromClient || body.partnerTransactionId || q.ref || '')
  console.log('[pay-callback]', JSON.stringify(body).slice(0, 300))
  if (!/^[0-9a-f-]{36}$/i.test(ref)) return res.status(200).json({ ok: true, ignored: true })
  const st = await checkStatus(ref)
  if (st !== 'pending') await finalize(ref, st === 'paid')
  return res.status(200).json({ ok: true })
}
