import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb, catalog } from '../lib/store'
import { AlbumCard, TrackRow, Empty } from '../components/ui'

export default function Explore() {
  const db = useDb()
  const { albums, tracks, artists } = catalog(db)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const f = useMemo(() => ({
    tracks: tracks.filter((t) => !s || (t.title + ' ' + t.artist.name + ' ' + t.album.title).toLowerCase().includes(s)),
    albums: albums.filter((a) => !s || (a.title + ' ' + a.artist.name).toLowerCase().includes(s)),
    artists: artists.filter((a) => !s || a.name.toLowerCase().includes(s)),
  }), [s, tracks, albums, artists])

  return (
    <>
      <h1 className="h1">Explorer</h1>
      <label className="field">
        <span>Rechercher un titre, un album ou un artiste</span>
        <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Bikutsi, Nadège…" />
      </label>

      <section>
        <h2>Artistes</h2>
        {f.artists.length ? (
          <div className="chips">{f.artists.map((a) => <Link key={a.id} className="chip" to={`/artiste/${a.id}`}>{a.name}</Link>)}</div>
        ) : <Empty>Aucun artiste trouvé.</Empty>}
      </section>
      <section>
        <h2>Albums et singles</h2>
        {f.albums.length ? <div className="grid">{f.albums.map((al) => <AlbumCard key={al.id} al={al} />)}</div> : <Empty>Aucune sortie trouvée.</Empty>}
      </section>
      <section>
        <h2>Titres</h2>
        {f.tracks.length ? <ul className="tracks">{f.tracks.map((t) => <TrackRow key={t.id} t={t} />)}</ul> : <Empty>Aucun titre trouvé.</Empty>}
      </section>
    </>
  )
}
