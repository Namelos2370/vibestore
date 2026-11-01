import { Link, useParams } from 'react-router-dom'
import { useDb, catalog, photoUrl, likeCount, PLATFORMS } from '../lib/store'
import { AlbumCard, TrackRow, Empty, ClipCard } from '../components/ui'

export default function Artist() {
  const { id } = useParams()
  const db = useDb()
  const { soundAlbums: albums, sounds: tracks, clips: allClips, tracks: allTracks, artists } = catalog(db)
  const a = artists.find((x) => x.id === id)
  if (!a) return <Empty>Artiste introuvable. <Link to="/explorer">Retour au catalogue</Link></Empty>
  const als = albums.filter((x) => x.artistId === a.id)
  const ts = tracks.filter((t) => t.artistId === a.id)
  const cs = allClips.filter((t) => t.artistId === a.id)
  const all = allTracks.filter((t) => t.artistId === a.id)
  return (
    <>
      <span className="eyebrow">Artiste{a.city ? ` · ${a.city}` : ''}{a.genre ? ` · ${a.genre}` : ''}</span>
      <div className="artisthead">
        {photoUrl(a.photoPath) && <img className="avatar big" src={photoUrl(a.photoPath)} alt={a.name} width="96" height="96" />}
        <h1 className="h1">{a.name}{a.verified && <span className="vbadge" title="Artiste vérifié">✔</span>}</h1>
      </div>
      {a.bio && <p className="lead">{a.bio}</p>}
      <p className="muted small">{all.reduce((n, t) => n + (t.plays || 0), 0)} écoutes · ♥ {all.reduce((n, t) => n + likeCount(db, t.id), 0)} · {ts.length} son(s) · {cs.length} clip(s)</p>
      <div className="links">
        {a.links?.instagram && <a className="btn small ghost" href={a.links.instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
        {a.links?.tiktok && <a className="btn small ghost" href={a.links.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a>}
        {a.links?.youtube && <a className="btn small ghost" href={a.links.youtube} target="_blank" rel="noopener noreferrer">YouTube</a>}
        {a.links?.whatsapp && <a className="btn small ghost" href={`https://wa.me/${a.links.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
      </div>
      {PLATFORMS.some(([k]) => a.links?.[k]) && (
        <div className="links"><span className="muted small">Écouter aussi sur</span>{PLATFORMS.filter(([k]) => a.links?.[k]).map(([k, l]) => <a key={k} className="btn small ghost" href={a.links[k]} target="_blank" rel="noopener noreferrer">{l}</a>)}</div>
      )}
      {(als.length > 0 || ts.length > 0) && <section><h2>Sons · sorties</h2><div className="grid">{als.map((al) => <AlbumCard key={al.id} al={al} />)}</div></section>}
      {ts.length > 0 && <section><h2>Sons</h2><ul className="tracks">{ts.map((t) => <TrackRow key={t.id} t={t} showArtist={false} />)}</ul></section>}
      {cs.length > 0 && <section><h2>Clips</h2><div className="clipgrid">{cs.map((t) => <ClipCard key={t.id} t={t} />)}</div></section>}
    </>
  )
}
