import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDb, catalog, likeCount } from '../lib/store'
import { AlbumCard, TrackRow, Empty, MediaSwitch } from '../components/ui'
import { Icon, Verified } from '../components/Icon'

export default function Explore() {
  const db = useDb()
  const { soundAlbums: albums, sounds: tracks, artists } = catalog(db)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const score = (t) => (t.plays || 0) + 3 * likeCount(db, t.id) // popularité : écoutes + j’aime (pondérés)
  const stats = useMemo(() => {
    const m = {}
    tracks.forEach((t) => { const x = m[t.artistId] || (m[t.artistId] = { plays: 0, likes: 0, score: 0 }); x.plays += t.plays || 0; x.likes += likeCount(db, t.id); x.score += score(t) })
    return m
  }, [tracks, db.likeCounts]) // eslint-disable-line
  const artistScore = (a) => stats[a.id]?.score || 0
  const albumScore = (al) => tracks.filter((t) => t.albumId === al.id).reduce((n, t) => n + score(t), 0)
  const f = useMemo(() => ({
    tracks: tracks.filter((t) => !s || (t.title + ' ' + t.artist.name + ' ' + t.album.title).toLowerCase().includes(s)),
    albums: albums.filter((a) => !s || (a.title + ' ' + a.artist.name).toLowerCase().includes(s)),
    artists: artists.filter((a) => !s || a.name.toLowerCase().includes(s)),
  }), [s, tracks, albums, artists])
  f.tracks = [...f.tracks].sort((a, b) => score(b) - score(a))
  f.albums = [...f.albums].sort((a, b) => albumScore(b) - albumScore(a))
  f.artists = [...f.artists].sort((a, b) => artistScore(b) - artistScore(a) || a.name.localeCompare(b.name))

  return (
    <>
      <h1 className="h1">Sons</h1>
      <MediaSwitch />
      <label className="field">
        <span>Rechercher un titre, un album ou un artiste</span>
        <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. Bikutsi, Nadège…" />
      </label>

      <section>
        <h2>{s ? 'Artistes' : 'Top artistes'}</h2>
        {f.artists.length ? (
          <div className="chips">{f.artists.map((a, i) => <Link key={a.id} className="chip" to={`/artiste/${a.id}`}>{a.name}{a.verified && <Verified />}{stats[a.id] && <small className="cs"> · {stats[a.id].plays} écoutes · {stats[a.id].likes} j’aime</small>}</Link>)}</div>
        ) : <Empty>Aucun artiste trouvé.</Empty>}
      </section>
      <section>
        <h2>{s ? 'Albums et singles' : 'Albums et singles populaires'}</h2>
        {f.albums.length ? <div className="grid">{f.albums.map((al) => <AlbumCard key={al.id} al={al} />)}</div> : <Empty>Aucune sortie trouvée.</Empty>}
      </section>
      <section>
        <h2>{s ? 'Titres' : 'Titres les plus aimés'}</h2>
        {f.tracks.length ? <ul className="tracks">{f.tracks.map((t) => <TrackRow key={t.id} t={t} />)}</ul> : <Empty>Aucun titre trouvé.</Empty>}
      </section>
    </>
  )
}
