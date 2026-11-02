import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, catalog, listenRight, activePromos, trackPromoView, mmss, PREVIEW_SECONDS, myLikes, likeCount, toggleLike } from '../lib/store'
import { AddButton, Cover, Empty, Clip, PromoMedia, PromoTag, PromoCta } from '../components/ui'
import { parseLyrics, currentLine } from '../lib/lyrics'
import { Icon, Verified } from '../components/Icon'

function Lyrics({ t, on, pos, onClose }) {
  const { lines, timed } = useMemo(() => parseLyrics(t.lyrics), [t.lyrics])
  const cur = timed && on ? currentLine(lines, pos) : -1
  const ref = useRef(null)
  useEffect(() => {
    const box = ref.current
    if (cur < 0 || !box || !box.children[cur]) return
    const el = box.children[cur]
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: 'smooth' })
  }, [cur])
  return (
    <div className="lyrics" role="dialog" aria-label={`Paroles de ${t.title}`}>
      <header><b>{t.title}</b><button className="iconbtn" type="button" onClick={onClose} aria-label="Fermer les paroles"><Icon name="close" size={18} /></button></header>
      <div className="lines" ref={ref}>{lines.map((l, i) => <p key={i} className={'ln' + (i === cur ? ' now' : '')}>{l.text}</p>)}</div>
    </div>
  )
}

// Flux vertical façon « TikTok » : un titre par écran, l'aperçu se lance au défilement.
export default function Discover() {
  const db = useDb()
  const user = useUser()
  const nav = useNavigate()
  const { track, playing, pos, mode, play, toggle, ended } = useApp()
  const [lyr, setLyr] = useState(null)
  const [clip, setClip] = useState(null)
  const favs = myLikes(db, user)
  function openLyrics(t, on) {
    const r = listenRight(db, user, t)
    if (!user) { setToast('Les paroles sont réservées aux inscrits : crée ton compte gratuit.'); setTimeout(() => nav('/compte'), 1400); return }
    if (r === 'expired') { setToast('Ton essai est terminé : achète ce titre pour lire les paroles.'); return }
    setLyr(t.id); if (!on || !playing) play(t)
  }
  async function like(t) {
    const was = favs.includes(t.id)
    try { await toggleLike(t.id); if (!user && !was) setToast('Crée un compte pour retrouver tes coups de cœur dans Ma musique.') } catch (e) { setToast(e.message) }
  }
  const [toast, setToast] = useState('')
  const { sounds: tracks } = catalog(db)
  const items = useMemo(() => [...tracks].sort((a, b) => b.plays - a.plays || a.title.localeCompare(b.title)), [tracks.length]) // eslint-disable-line
  const promos = activePromos(db)
  const slides = useMemo(() => {
    if (!promos.length) return items.map((t) => ({ t }))
    const out = []; let k = 0
    items.forEach((t, i) => { out.push({ t }); if ((i + 1) % 4 === 0 && i < items.length - 1) out.push({ promo: promos[k++ % promos.length] }) })
    if (items.length > 1 && items.length < 4) out.push({ promo: promos[0] })
    return out
  }, [items, promos.map((p) => p.id).join(',')]) // eslint-disable-line
  const feedRef = useRef(null)
  useEffect(() => { document.body.classList.add('immersive'); return () => document.body.classList.remove('immersive') }, [])
  const [active, setActive] = useState(0)
  const live = useRef({ track, play, playing, toggle })
  live.current = { track, play, playing, toggle }

  useEffect(() => {
    const root = feedRef.current
    if (!root || !slides.length) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(Number(e.target.dataset.i)) })
    }, { root, threshold: 0.7 })
    root.querySelectorAll('[data-i]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [slides.length])

  // Lancement automatique du titre affiché (si le navigateur l'autorise après un premier geste).
  useEffect(() => {
    const cur = slides[active]
    if (!cur) return
    if (cur.promo) { trackPromoView(cur.promo.id); if (live.current.playing) live.current.toggle(); return }
    const t = cur.t
    if (listenRight(db, user, t) === 'expired') return
    if (!live.current.track || live.current.track.id !== t.id) live.current.play(t)
  }, [active, slides, user]) // eslint-disable-line

  // Fin d'un titre complet : on passe au suivant, comme dans un flux.
  const lastEnded = useRef(ended)
  useEffect(() => {
    if (ended === lastEnded.current) return
    lastEnded.current = ended
    const root = feedRef.current
    if (root && active < slides.length - 1) root.scrollTo({ top: (active + 1) * root.clientHeight, behavior: 'smooth' })
  }, [ended]) // eslint-disable-line

  async function share(t) {
    const url = `${window.location.origin}/sortie/${t.album.id}`
    const text = `Écoute « ${t.title} » de ${t.artist.name} sur VibeStore`
    try {
      if (navigator.share) { await navigator.share({ title: t.title, text, url }); return }
      await navigator.clipboard.writeText(`${text} ${url}`)
      setToast('Lien copié')
    } catch { setToast(`${text} ${url}`) }
    setTimeout(() => setToast(''), 2500)
  }

  if (!items.length) return <Empty>Aucun titre pour le moment.</Empty>

  return (
    <div className="feedwrap">
    <div className="feed" ref={feedRef} aria-label="Découvrir de la musique">
      {slides.map((sl, i) => {
        if (sl.promo) {
          const p = sl.promo
          return (
            <section key={'p' + p.id + i} data-i={i} className="slide promoslide" aria-roledescription="publicité">
              <div className="promowrap">
                <PromoTag p={p} />
                {Math.abs(active - i) <= 1 && <PromoMedia url={p.videoUrl} onPlay={() => trackPromoView(p.id)} />}
                <h2>{p.title}</h2>
                <PromoCta p={p} />
              </div>
            </section>
          )
        }
        const t = sl.t
        const on = track && track.id === t.id
        const right = listenRight(db, user, t)
        const total = on && mode === 'full' ? Math.max(t.duration, 1) : PREVIEW_SECONDS
        const pct = on ? Math.min(100, (pos / total) * 100) : 0
        return (
          <section key={t.id} data-i={i} className="slide" aria-roledescription="titre">
            <div className={'slidecover' + (on && playing ? ' live' : '')}><Cover album={t.album} /></div>
            <div className="slidemeta">
              <h2>{t.title}</h2>
              <p><Link to={`/artiste/${t.artist.id}`}>{t.artist.name}</Link>{t.artist.verified && <Verified />} · <Link to={`/sortie/${t.album.id}`}>{t.album.title}</Link></p>
              <span className="badge">{right === 'full' ? 'Écoute complète' : 'Aperçu 30 s'}</span>
              {on && playing && <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>}
            </div>
            {on && <div className="slidebar" aria-hidden="true"><i style={{ width: pct + '%' }} /><span>{mmss(pos)}</span></div>}
            <div className="slideact">
              {user ? (
                <button className="bigplay" type="button" onClick={() => play(t)} aria-label={(on && playing ? 'Pause ' : 'Écouter ') + t.title}><Icon name={on && playing ? 'pause' : 'play'} size={26} /></button>
              ) : (
                <button className="btn buy" type="button" onClick={() => nav('/compte')}>Crée un compte pour écouter</button>
              )}
              <AddButton type="track" id={t.id} price={t.price} />
            </div>
            {lyr === t.id && user && listenRight(db, user, t) !== 'expired' && <Lyrics t={t} on={on} pos={pos} onClose={() => setLyr(null)} />}
            {clip === t.id && (
              <div className="modal">
                <Clip url={t.album.videoUrl} />
                <button className="btn small ghost" type="button" onClick={() => setClip(null)}>Fermer le clip</button>
              </div>
            )}
            <div className="slidetools">
              {t.lyrics && <button className="iconbtn" type="button" onClick={() => openLyrics(t, on)} aria-label="Paroles"><Icon name="lyrics" /></button>}
              {t.album.videoUrl && <button className="iconbtn" type="button" onClick={() => { if (on && playing) toggle(); setClip(t.id) }} aria-label="Voir le clip"><Icon name="clip" /></button>}
              <button className={'iconbtn' + (favs.includes(t.id) ? ' on' : '')} type="button" onClick={() => like(t)} aria-pressed={favs.includes(t.id)} aria-label={favs.includes(t.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'}><Icon name="heart" fill={favs.includes(t.id)} /><small className="cnt">{likeCount(db, t.id) || ''}</small></button>
              <button className="iconbtn" type="button" onClick={() => share(t)} aria-label="Partager"><Icon name="share" /></button>
            </div>
            {i === 0 && items.length > 1 && <span className="swipe" aria-hidden="true">Fais défiler</span>}
          </section>
        )
      })}
    </div>
    {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}
