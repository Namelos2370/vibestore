import { Link, useParams } from 'react-router-dom'
import { useDb, catalog } from '../lib/store'
import { AlbumCard, TrackRow, Empty } from '../components/ui'

export default function Artist() {
  const { id } = useParams()
  const db = useDb()
  const { albums, tracks, artists } = catalog(db)
  const a = artists.find((x) => x.id === id)
  if (!a) return <Empty>Artiste introuvable. <Link to="/explorer">Retour au catalogue</Link></Empty>
  const als = albums.filter((x) => x.artistId === a.id)
  const ts = tracks.filter((t) => t.artistId === a.id)
  return (
    <>
      <span className="eyebrow">Artiste</span>
      <h1 className="h1">{a.name}</h1>
      {a.bio && <p className="lead">{a.bio}</p>}
      <section><h2>Sorties</h2><div className="grid">{als.map((al) => <AlbumCard key={al.id} al={al} />)}</div></section>
      <section><h2>Titres</h2><ul className="tracks">{ts.map((t) => <TrackRow key={t.id} t={t} showArtist={false} />)}</ul></section>
    </>
  )
}
