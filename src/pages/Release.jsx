import { Link, useParams } from 'react-router-dom'
import { useDb, catalog, fcfa, mmss } from '../lib/store'
import { AddButton, Cover, TrackRow, Empty, Clip } from '../components/ui'
import { Icon, Verified } from '../components/Icon'

export default function Release() {
  const { id } = useParams()
  const db = useDb()
  const { albums, tracks } = catalog(db)
  const al = albums.find((a) => a.id === id)
  if (!al) return <Empty>Cette sortie n’existe pas ou n’est pas encore publiée. <Link to="/explorer">Retour au catalogue</Link></Empty>
  const list = tracks.filter((t) => t.albumId === al.id)
  const total = list.reduce((s, t) => s + t.duration, 0)

  return (
    <>
      <div className="relhead">
        <Cover album={al} size={180} />
        <div>
          <span className="eyebrow">{al.kind === 'album' ? 'Album' : 'Single'}</span>
          <h1 className="h1">{al.title}</h1>
          <p className="lead"><Link to={`/artiste/${al.artist.id}`}>{al.artist.name}</Link>{al.artist.verified && <Verified />} · {list.length} titre(s) · {mmss(total)}</p>
          <div className="row">
            <AddButton type="album" id={al.id} price={al.price} />
            <span className="muted">{al.kind === 'album' ? 'Album complet' : 'Single'} · {fcfa(al.price)}</span>
          </div>
        </div>
      </div>
      <ul className="tracks">{list.map((t) => <TrackRow key={t.id} t={t} showArtist={false} />)}</ul>
      {al.videoUrl && (
        <section>
          <h2>Clip</h2>
          <Clip url={al.videoUrl} />
        </section>
      )}
    </>
  )
}
