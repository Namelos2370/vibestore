import { Link } from 'react-router-dom'
import { useDb, catalog, likeCount } from '../lib/store'
import { AlbumCard, Clip, Empty } from '../components/ui'
import { PoweredBy } from '../components/BlueEnergy'

// « Blue Energy Sessions » : les clips et les artistes les plus suivis, mis en avant par la marque partenaire.
export default function Sessions() {
  const db = useDb()
  const { albums, tracks, artists } = catalog(db)
  const score = (t) => (t.plays || 0) + 3 * likeCount(db, t.id)
  const aScore = (al) => tracks.filter((t) => t.albumId === al.id).reduce((n, t) => n + score(t), 0)
  const clips = albums.filter((a) => a.videoUrl).sort((a, b) => aScore(b) - aScore(a))
  const top = [...artists].map((a) => ({ a, n: tracks.filter((t) => t.artistId === a.id).reduce((s, t) => s + score(t), 0) })).filter((x) => x.n > 0).sort((x, y) => y.n - x.n).slice(0, 6)
  const best = [...albums].sort((a, b) => aScore(b) - aScore(a)).slice(0, 6)
  return (
    <>
      <span className="eyebrow">Avec Blue Energy</span>
      <h1 className="h1">Blue Energy Sessions</h1>
      <p className="lead">La scène d’ici, ses clips et ses artistes les plus écoutés, propulsés par Blue Energy.</p>
      <PoweredBy />
      <section>
        <h2>Clips à voir</h2>
        {clips.length ? clips.slice(0, 4).map((al) => (
          <div key={al.id} className="sess">
            <Clip url={al.videoUrl} />
            <p><b>{al.title}</b> · <Link to={`/artiste/${al.artist.id}`}>{al.artist.name}</Link> · <Link to={`/sortie/${al.id}`}>Écouter</Link></p>
          </div>
        )) : <Empty>Les premiers clips arrivent bientôt.</Empty>}
      </section>
      {top.length > 0 && (
        <section>
          <h2>Artistes à suivre</h2>
          <div className="chips">{top.map(({ a }, i) => <Link key={a.id} className="chip" to={`/artiste/${a.id}`}>{i === 0 ? '🏆 ' : ''}{a.name}</Link>)}</div>
        </section>
      )}
      {best.length > 0 && <section><h2>Sorties du moment</h2><div className="grid">{best.map((al) => <AlbumCard key={al.id} al={al} />)}</div></section>}
    </>
  )
}
