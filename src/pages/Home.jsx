import { Link } from 'react-router-dom'
import { useDb, useUser, catalog, fcfa, trialDaysLeft, MIN_PRICE } from '../lib/store'
import { AlbumCard, TrackRow } from '../components/ui'

export default function Home() {
  const db = useDb()
  const user = useUser()
  const { albums, tracks } = catalog(db)
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
            <Link className="btn buy" to="/explorer">Explorer le catalogue</Link>
            {!user && <Link className="btn ghost" to="/compte">Créer un compte</Link>}
            {user && <span className="badge">Essai gratuit : {trialDaysLeft(user)} jour(s) restant(s)</span>}
          </div>
        </div>
        <img className="herologo" src="/logo.jpg" alt="Logo VibeStore : casque audio et panier" width="420" height="420" />
      </section>

      <section>
        <h2>Tendances</h2>
        <ul className="tracks">{trending.map((t) => <TrackRow key={t.id} t={t} />)}</ul>
      </section>

      <section>
        <h2>Nouveautés</h2>
        <div className="grid">{news.map((al) => <AlbumCard key={al.id} al={al} />)}</div>
      </section>

      <section className="band">
        <h2>Tu es artiste ?</h2>
        <ul className="plain">
          <li>Publie tes titres et albums après validation de ton profil.</li>
          <li>Fixe tes prix en FCFA, à partir de {fcfa(MIN_PRICE)}.</li>
          <li>Suis tes écoutes et tes ventes dans ton studio.</li>
        </ul>
        <Link className="btn buy" to="/compte?artiste=1">Devenir artiste VibeStore</Link>
      </section>
    </>
  )
}
