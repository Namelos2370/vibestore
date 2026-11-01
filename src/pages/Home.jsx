import { Link } from 'react-router-dom'
import { useDb, useUser, catalog, fcfa, trialDaysLeft, MIN_PRICE } from '../lib/store'
import { AlbumCard, TrackRow, Empty, ClipCard } from '../components/ui'
import { PoweredBy, PartnerBand } from '../components/BlueEnergy'
import Dashboard from './Dashboard'

export default function Home() {
  const db = useDb()
  const user = useUser()
  const { soundAlbums: albums, sounds: tracks, clips } = catalog(db)
  if (user) return <Dashboard user={user} />
  const trending = [...tracks].sort((a, b) => b.plays - a.plays).slice(0, 5)
  const news = [...albums].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6)

  return (
    <>
      <section className="hero">
        <div className="herotext">
          <span className="eyebrow">Streaming et vente de musique</span>
          <h1>La musique d’ici, <em>écoutée et achetée</em> directement.</h1>
          <p className="lead">30 secondes gratuites sur chaque titre pendant 1 mois, puis tu achètes ce que tu aimes à partir de {fcfa(MIN_PRICE)}. Les artistes gardent l’essentiel.</p>
          <div className="row">
            <Link className="btn buy" to="/explorer">Écouter les sons</Link>
            <Link className="btn ghost" to="/clips">Voir les clips</Link>
            <Link className="btn ghost" to="/compte">Créer un compte</Link>
          </div>
          <PoweredBy />
        </div>
        <img className="herologo" src="/logo.jpg" alt="Logo VibeStore : casque audio et panier" width="420" height="420" />
      </section>

      <section>
        <h2>Sons en tendance</h2>
        {trending.length ? <ul className="tracks">{trending.map((t) => <TrackRow key={t.id} t={t} />)}</ul> : <Empty>Les premiers titres arrivent bientôt.</Empty>}
      </section>

      {clips.length > 0 && (
        <section>
          <h2>Clips</h2>
          <div className="clipgrid">{[...clips].sort((a, b) => (b.plays || 0) - (a.plays || 0)).slice(0, 3).map((t) => <ClipCard key={t.id} t={t} />)}</div>
          <p className="muted small"><Link to="/clips">Tous les clips</Link></p>
        </section>
      )}

      <section>
        <h2>Nouveautés</h2>
        {news.length ? <div className="grid">{news.map((al) => <AlbumCard key={al.id} al={al} />)}</div> : <Empty>Les premières sorties arrivent bientôt.</Empty>}
      </section>

      <PartnerBand />

      <section className="band">
        <h2>Tu es artiste ?</h2>
        <ul className="plain">
          <li>VibeStore distribue ta musique : nous créons ton compte et mettons tes titres en ligne.</li>
          <li>Tu fixes tes prix en FCFA, à partir de {fcfa(MIN_PRICE)}.</li>
          <li>Tu suis tes écoutes et tes ventes dans ton studio.</li>
        </ul>
        <p className="muted">Contacte l’équipe VibeStore pour faire distribuer ta musique.</p>
      </section>
    </>
  )
}
