import { Link } from 'react-router-dom'
import { useDb, catalog, fcfa, trialDaysLeft, myLikes, myArtist, likeCount, owns } from '../lib/store'
import { PartnerBand } from '../components/BlueEnergy'
import { AlbumCard, TrackRow, Empty, ClipCard } from '../components/ui'

// Accueil des personnes connectées (la page publique reste pour les visiteurs).
export default function Dashboard({ user }) {
  const db = useDb()
  const { soundAlbums: albums, sounds: tracks, clips, tracks: allTracks } = catalog(db)
  const first = (user.name || '').trim().split(/\s+/)[0] || 'toi'
  const news = [...albums].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)
  const trending = [...tracks].sort((a, b) => b.plays - a.plays).slice(0, 5)
  const liked = myLikes(db, user).map((id) => allTracks.find((t) => t.id === id)).filter(Boolean).slice(0, 4)
  const mine = tracks.filter((t) => owns(db, user, { type: 'track', id: t.id })).slice(0, 4)
  const myClips = clips.filter((t) => owns(db, user, { type: 'track', id: t.id })).slice(0, 3)
  const notifs = db.notifications.slice(0, 3)
  const days = trialDaysLeft(user)
  const artist = user.role === 'artist' ? myArtist(db, user) : null
  const artistTracks = artist ? allTracks.filter((t) => t.artistId === artist.id) : []
  const artistClips = artistTracks.filter((t) => clips.includes(t)).length
  const artistLikes = artistTracks.reduce((s, t) => s + likeCount(db, t.id), 0)
  const artistPlays = artistTracks.reduce((s, t) => s + (t.plays || 0), 0)

  return (
    <>
      <span className="eyebrow">{user.role === 'admin' ? 'Équipe VibeStore' : user.role === 'artist' ? 'Espace artiste' : 'Pour toi'}</span>
      <h1 className="h1">Salut {first}</h1>
      <div className="row">
        <Link className="btn buy" to="/decouvrir">Découvrir</Link>
        <Link className="btn ghost" to="/clips">Clips</Link>
        {user.role === 'artist' && <Link className="btn ghost" to="/studio">Mon studio</Link>}
        {user.role === 'admin' && <Link className="btn ghost" to="/admin">Tableau de bord</Link>}
        {user.role === 'listener' && days > 0 && <span className="badge">Essai gratuit : {days} jour(s) restant(s)</span>}
        {user.role === 'listener' && days <= 0 && <span className="badge">Essai terminé : achète pour écouter en entier</span>}
      </div>

      {artist && (
        <div className="stats">
          <div className="stat"><span>Écoutes</span><b>{artistPlays}</b></div>
          <div className="stat"><span>J’aime</span><b>{artistLikes}</b></div>
          <div className="stat"><span>Sons en ligne</span><b>{artistTracks.length - artistClips}</b></div>
          <div className="stat"><span>Clips en ligne</span><b>{artistClips}</b></div>
        </div>
      )}

      {notifs.length > 0 && (
        <section>
          <h2>Dernières nouvelles</h2>
          <ul className="tracks">
            {notifs.map((n) => (
              <li key={n.id} className="track simple notif">
                {/^https?:/.test(n.url || '') ? <a className="tmeta" href={n.url} target="_blank" rel="noopener noreferrer"><b>{n.title}</b>{n.body && <span>{n.body}</span>}</a> : <Link className="tmeta" to={n.url || '/'}><b>{n.title}</b>{n.body && <span>{n.body}</span>}</Link>}
              </li>
            ))}
          </ul>
          <p className="muted small"><Link to="/notifications">Toutes les notifications</Link></p>
        </section>
      )}

      {mine.length > 0 && (
        <section>
          <h2>Ma musique</h2>
          <ul className="tracks">{mine.map((t) => <TrackRow key={t.id} t={t} />)}</ul>
          <p className="muted small"><Link to="/bibliotheque">Voir toute ma musique</Link></p>
        </section>
      )}

      {liked.length > 0 && (
        <section>
          <h2>{user.role === 'artist' ? 'Titres appréciés' : 'Mes coups de cœur'}</h2>
          <ul className="tracks">{liked.map((t) => <TrackRow key={t.id} t={t} />)}</ul>
        </section>
      )}

      {myClips.length > 0 && (
        <section>
          <h2>Mes clips</h2>
          <div className="clipgrid">{myClips.map((t) => <ClipCard key={t.id} t={t} />)}</div>
        </section>
      )}

      <section>
        <h2>Nouveautés sons</h2>
        {news.length ? <div className="grid">{news.map((al) => <AlbumCard key={al.id} al={al} />)}</div> : <Empty>Les premières sorties arrivent bientôt.</Empty>}
      </section>

      <section>
        <h2>Sons en tendance</h2>
        {trending.length ? <ul className="tracks">{trending.map((t) => <TrackRow key={t.id} t={t} />)}</ul> : <Empty>Les premiers titres arrivent bientôt.</Empty>}
      </section>

      <section>
        <h2>Clips à voir</h2>
        {clips.length ? <div className="clipgrid">{[...clips].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 3).map((t) => <ClipCard key={t.id} t={t} />)}</div> : <Empty>Les premiers clips arrivent bientôt.</Empty>}
        {clips.length > 0 && <p className="muted small"><Link to="/clips">Tous les clips</Link></p>}
      </section>
      <PartnerBand />
    </>
  )
}
