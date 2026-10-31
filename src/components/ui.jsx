import { Link } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, owns, fcfa, mmss, coverUrl } from '../lib/store'

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
  const inCart = cart.some((x) => x.type === type && x.id === id)
  return inCart ? (
    <button className="btn small ghost" type="button" onClick={() => removeFromCart(type, id)}>Dans le panier ✓</button>
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
        {on && playing ? '❚❚' : '▶'}
      </button>
      <div className="tmeta">
        <b>{t.title}</b>
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
