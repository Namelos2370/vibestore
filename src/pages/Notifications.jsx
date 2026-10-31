import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDb, markSeen, enablePush, pushSupport } from '../lib/store'
import { Empty } from '../components/ui'

const ago = (t) => {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'à l’instant'
  if (m < 60) return `il y a ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `il y a ${h} h`
  return new Date(t).toLocaleDateString('fr-FR')
}

export default function Notifications() {
  const db = useDb()
  const nav = useNavigate()
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [state, setState] = useState(pushSupport())
  useEffect(() => { const t = setTimeout(markSeen, 1500); return () => clearTimeout(t) }, [])
  async function enable() {
    setErr(''); setMsg('')
    try { await enablePush(); setState('granted'); setMsg('Notifications activées sur cet appareil.') } catch (e) { setErr(e.message) }
  }
  return (
    <>
      <h1 className="h1">Notifications</h1>
      {state !== 'granted' && state !== 'demo' && (
        <section className="panel">
          <h2>Reçois les nouveautés comme un message</h2>
          <p className="muted">Une notification sur ton téléphone dès qu’une nouvelle sortie arrive, même quand le site est fermé.</p>
          {state === 'denied' ? <p className="err">Les notifications sont bloquées. Autorise-les dans les réglages du navigateur pour ce site.</p> : <button className="btn buy" type="button" onClick={enable}>Activer les notifications</button>}
          {err && <p className="err" role="alert">{err}</p>}
          {msg && <p className="ok" role="status">{msg}</p>}
        </section>
      )}
      {state === 'granted' && <p className="ok" role="status">Les notifications sont activées sur cet appareil.</p>}
      {db.notifications.length ? (
        <ul className="tracks">
          {db.notifications.map((n) => (
            <li key={n.id} className="track simple notif">
              <button className="linkbtn tmeta" type="button" onClick={() => nav(n.url || '/')}>
                <b>{n.title}</b>
                {n.body && <span>{n.body}</span>}
              </button>
              <span className="dur">{ago(n.at)}</span>
            </li>
          ))}
        </ul>
      ) : <Empty>Aucune notification pour le moment. <Link to="/decouvrir">Découvrir de la musique</Link></Empty>}
    </>
  )
}
