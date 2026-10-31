import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, catalog, listenRight, mmss, PREVIEW_SECONDS } from '../lib/store'
import { AddButton, Cover, Empty } from '../components/ui'

// Flux vertical façon « TikTok » : un titre par écran, l'aperçu se lance au défilement.
export default function Discover() {
  const db = useDb()
  const user = useUser()
  const nav = useNavigate()
  const { track, playing, pos, mode, play } = useApp()
  const { tracks } = catalog(db)
  const items = useMemo(() => [...tracks].sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title)), [tracks.length]) // eslint-disable-line
  const feedRef = useRef(null)
  const [active, setActive] = useState(0)
  const live = useRef({ track, play })
  live.current = { track, play }

  useEffect(() => {
    const root = feedRef.current
    if (!root || !items.length) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)) })
    }, { root, threshold: 0.7 })
    root.querySelectorAll('[data-i]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [items.length])

  // Lancement automatique du titre affiché (si le navigateur l'autorise après un premier geste).
  useEffect(() => {
    const t = items[active]
    if (!t || !user) return
    if (listenRight(db, user, t) === 'expired') return
    if (!live.current.track || live.current.track.id !== t.id) live.current.play(t)
  }, [active, items, user]) // eslint-disable-line

  if (!items.length) return <Empty>Aucun titre pour le moment.</Empty>

  return (
    <div className="feed" ref={feedRef} aria-label="Découvrir de la musique">
      {items.map((t, i) => {
        const on = track && track.id === t.id
        const right = listenRight(db, user, t)
        const total = on && mode === 'full' ? Math.max(t.duration, 1) : PREVIEW_SECONDS
        const pct = on ? Math.min(100, (pos / total) * 100) : 0
        return (
          <section key={t.id} data-i={i} className="slide" aria-roledescription="titre">
            <div className="slidecover"><Cover album={t.album} /></div>
            <div className="slidemeta">
              <h2>{t.title}</h2>
              <p><Link to={`/artiste/${t.artist.id}`}>{t.artist.name}</Link> · <Link to={`/sortie/${t.album.id}`}>{t.album.title}</Link></p>
              <span className="badge">{right === 'full' ? 'Écoute complète' : 'Aperçu 30 s'}</span>
            </div>
            {on && <div className="slidebar" aria-hidden="true"><i style={{ width: pct + '%' }} /><span>{mmss(pos)}</span></div>}
            <div className="slideact">
              {user ? (
                <button className="bigplay" type="button" onClick={() => play(t)} aria-label={(on && playing ? 'Pause ' : 'Écouter ') + t.title}>{on && playing ? '❚❚' : '▶'}</button>
              ) : (
                <button className="btn buy" type="button" onClick={() => nav('/compte')}>Crée un compte pour écouter</button>
              )}
              <AddButton type="track" id={t.id} price={t.price} />
            </div>
            {i === 0 && items.length > 1 && <span className="swipe" aria-hidden="true">Fais défiler ↑</span>}
          </section>
        )
      })}
    </div>
  )
}
