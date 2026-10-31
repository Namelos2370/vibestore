import { Link, Navigate } from 'react-router-dom'
import { useDb, useUser, myArtist, currentCommission, fcfa } from '../lib/store'
import { Empty } from '../components/ui'

// Studio artiste en lecture seule : le compte et les titres sont ajoutés par VibeStore.
export default function Studio() {
  const db = useDb()
  const user = useUser()
  if (!user) return <Navigate to="/compte" replace />
  if (user.role !== 'artist') return <Empty>Cet espace est réservé aux artistes. Les comptes artistes sont créés par l’équipe VibeStore.</Empty>
  const artist = myArtist(db, user)
  if (!artist) return <Empty>Profil artiste introuvable. Contacte VibeStore.</Empty>

  const pct = currentCommission(db)
  const releases = db.albums.filter((a) => a.artistId === artist.id)
  const tracks = db.tracks.filter((t) => t.artistId === artist.id)
  const sales = db.purchases.filter((p) => p.artistId === artist.id)
  const gross = sales.reduce((s, p) => s + p.amount, 0)
  const net = sales.reduce((s, p) => s + p.amount * (1 - p.commissionPct / 100), 0)
  const plays = tracks.reduce((s, t) => s + (t.plays || 0), 0)
  const salesOf = (t) => sales.filter((p) => p.itemType === 'track' && p.itemId === t.id).length

  return (
    <>
      <span className="eyebrow">Espace artiste</span>
      <h1 className="h1">Studio de {artist.name}</h1>

      <div className="infobox">
        <div>
          <b>VibeStore gère ton catalogue.</b>
          <p>Ton compte et tes titres sont ajoutés par l’équipe VibeStore. Pour ajouter ou modifier un titre, écris-nous : nous le publions pour toi.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Écoutes</span><b>{plays}</b></div>
        <div className="stat"><span>Ventes</span><b>{sales.length}</b></div>
        <div className="stat"><span>Chiffre d’affaires</span><b>{fcfa(gross)}</b></div>
        <div className="stat hi"><span>Ta part ({100 - pct} %)</span><b>{fcfa(net)}</b></div>
      </div>
      <p className="muted small">Commission VibeStore actuelle : {pct} %. Le retrait Mobile Money arrive en phase 2.</p>

      <section>
        <h2>Mes titres</h2>
        {tracks.length ? (
          <ul className="tracks">
            {tracks.map((t) => (
              <li key={t.id} className="track simple">
                <div className="tmeta"><b>{t.title}</b><span>{fcfa(t.price)} · {t.plays || 0} écoutes · {salesOf(t)} ventes</span></div>
                <span className="badge ok">En ligne</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucun titre en ligne pour l’instant. L’équipe VibeStore ajoutera tes sorties.</Empty>}
      </section>

      <section>
        <h2>Mes sorties</h2>
        {releases.length ? (
          <ul className="tracks">
            {releases.map((a) => (
              <li key={a.id} className="track simple">
                <div className="tmeta"><b>{a.title}</b><span>{a.kind === 'album' ? 'Album' : 'Single'} · {fcfa(a.price)} · {tracks.filter((t) => t.albumId === a.id).length} titre(s)</span></div>
                <Link className="btn small ghost" to={`/sortie/${a.id}`}>Voir</Link>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucune sortie.</Empty>}
      </section>

      <section className="panel">
        <h2>Ta page publique</h2>
        <p className="muted">Partage-la sur WhatsApp et tes réseaux pour vendre directement à tes fans.</p>
        <Link className="btn buy" to={`/artiste/${artist.id}`}>Voir ma page</Link>
      </section>
    </>
  )
}
