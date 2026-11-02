import { Link, NavLink } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, owns, fcfa, mmss, coverUrl, purchasesOn, isClip } from '../lib/store'
import { Icon, Verified } from './Icon'

export function Cover({ album, size }) {
  const c = album?.color || '#8B5CF6'
  const img = coverUrl(album?.coverPath)
  return (
    <div className="cover" style={{ '--c': c, ...(size ? { width: size, height: size } : {}) }} aria-hidden="true">
      {img ? <img src={img} alt="" loading="lazy" /> : <span>{(album?.title || '?').charAt(0)}</span>}
    </div>
  )
}

export function AddButton({ type, id, price, compact }) {
  const db = useDb()
  const user = useUser()
  const { cart, addToCart, removeFromCart } = useApp()
  if (owns(db, user, { type, id })) return <span className="badge ok">Acheté</span>
  if (!purchasesOn(db)) return <span className="badge soon" title="Les achats ouvrent bientôt">Achat bientôt</span>
  const inCart = cart.some((x) => x.type === type && x.id === id)
  return inCart ? (
    <button className="btn small ghost" type="button" onClick={() => removeFromCart(type, id)}>Dans le panier</button>
  ) : (
    <button className="btn small buy" type="button" onClick={() => addToCart(type, id)}>
      {compact ? fcfa(price) : `Ajouter · ${fcfa(price)}`}
    </button>
  )
}

export function TrackRow({ t, showArtist = true }) {
  const { track, playing, play } = useApp()
  const on = track && track.id === t.id
  return (
    <li className={'track' + (on ? ' on' : '')}>
      <button className="playbtn" type="button" onClick={() => play(t)} aria-label={(on && playing ? 'Pause ' : 'Écouter ') + t.title}>
        <Icon name={on && playing ? 'pause' : 'play'} size={22} />
      </button>
      <div className="tmeta">
        <b>{t.title}{isClip(t) && <span className="badge clip" title="Titre disponible en clip vidéo">Clip</span>}</b>
        <span>
          {showArtist && <Link to={`/artiste/${t.artist.id}`}>{t.artist.name}</Link>}
          {showArtist && ' · '}
          <Link to={`/sortie/${t.album.id}`}>{t.album.title}</Link>
        </span>
      </div>
      <span className="dur">{mmss(t.duration)}</span>
      <AddButton type="track" id={t.id} price={t.price} compact />
    </li>
  )
}

export function AlbumCard({ al }) {
  return (
    <Link to={`/sortie/${al.id}`} className="card albumcard">
      <Cover album={al} />
      <div className="cbody">
        <h3>{al.title}</h3>
        <span className="by">{al.artist.name}</span>
        <span className="kind">{al.kind === 'album' ? 'Album' : 'Single'} · {fcfa(al.price)}</span>
      </div>
    </Link>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

function youtubeId(u) {
  const m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
  return m ? m[1] : null
}
/** Clip vidéo : lien YouTube (intégré) ou fichier vidéo. */
export function Clip({ url }) {
  if (!url) return null
  const yt = youtubeId(url)
  return (
    <div className="clip">
      {yt ? (
        <iframe title="Clip" src={`https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1`} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" />
      ) : (
        <video src={url} controls playsInline preload="metadata" />
      )}
    </div>
  )
}

/** Bascule claire entre l'espace des sons et celui des clips. */
export function MediaSwitch() {
  return (
    <div className="mediaswitch" role="tablist" aria-label="Type de contenu">
      <NavLink to="/explorer" role="tab">Sons</NavLink>
      <NavLink to="/clips" role="tab">Clips</NavLink>
    </div>
  )
}

/** Carte d'un clip : affiche de la sortie, extrait de 30 s à l'écoute, achat. */
export function ClipCard({ t }) {
  const { track, playing, play } = useApp()
  const on = track && track.id === t.id
  return (
    <article className={'clipcard' + (on ? ' on' : '')}>
      <button className="clipart" type="button" onClick={() => play(t)} aria-label={(on && playing ? 'Pause ' : 'Écouter l’extrait de ') + t.title}>
        <Cover album={t.album} />
        <span className="clipplay"><Icon name={on && playing ? 'pause' : 'play'} size={22} /></span>
        <span className="cliptag">Clip · {mmss(t.duration)}</span>
      </button>
      <div className="clipbody">
        <b>{t.title}</b>
        <Link to={`/artiste/${t.artist.id}`}>{t.artist.name}</Link>
        <AddButton type="track" id={t.id} price={t.price} />
      </div>
    </article>
  )
}

/** Vidéo promotionnelle : lecture automatique sans son (YouTube ou MP4), l'utilisateur peut activer le son. */
export function PromoMedia({ url, onPlay }) {
  const yt = youtubeId(url || '')
  return (
    <div className="clip promomedia">
      {yt ? (
        <iframe title="Publicité" src={`https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&mute=1&loop=1&playlist=${yt}&rel=0&playsinline=1&controls=1`} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" onLoad={onPlay} />
      ) : (
        <video src={url} autoPlay muted loop controls playsInline preload="metadata" onPlay={onPlay} />
      )}
    </div>
  )
}
/** Libellé légal et lien d'une promo. */
export function PromoTag({ p }) {
  return <span className="promotag">Publicité · {p.brand}</span>
}
export function PromoCta({ p }) {
  if (!p.ctaUrl) return null
  return <a className="btn small ghost" href={p.ctaUrl} target="_blank" rel="noopener noreferrer sponsored">{p.ctaLabel || 'En savoir plus'}</a>
}
/** Carte promo dans la grille des clips (non vendue, sans prix). */
export function PromoCard({ p, onView }) {
  return (
    <article className="clipcard promocard">
      <PromoMedia url={p.videoUrl} onPlay={() => onView && onView(p.id)} />
      <div className="clipbody"><PromoTag p={p} /><b>{p.title}</b><PromoCta p={p} /></div>
    </article>
  )
}
