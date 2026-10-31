import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, signOut, trialDaysLeft, mmss, PREVIEW_SECONDS, fcfa } from '../lib/store'
import { Cover } from './ui'

function Player() {
  const { track, playing, pos, mode, notice, setNotice, toggle, seek, addToCart, audioDuration } = useApp()
  const user = useUser()
  const nav = useNavigate()
  const total = track ? (mode === 'preview' ? PREVIEW_SECONDS : audioDuration()) : 0
  const pct = total ? Math.min(100, (pos / total) * 100) : 0

  return (
    <div className="player" role="region" aria-label="Lecteur">
      {notice && (
        <div className="notice">
          {notice.type === 'signup' && (<><span>Crée un compte pour écouter 30 secondes gratuites de chaque musique.</span><button className="btn small buy" type="button" onClick={() => { setNotice(null); nav('/compte') }}>Créer un compte</button></>)}
          {notice.type === 'error' && (<><span>{notice.message}</span><button className="btn small ghost" type="button" onClick={() => setNotice(null)}>Fermer</button></>)}
          {notice.type === 'expired' && (<><span>Ton mois d’essai est terminé. Achète ce titre pour l’écouter en entier.</span><button className="btn small ghost" type="button" onClick={() => setNotice(null)}>Fermer</button></>)}
          {notice.type === 'previewEnd' && track && (<><span>Fin de l’aperçu de 30 s.</span><button className="btn small buy" type="button" onClick={() => { addToCart('track', track.id); setNotice(null); nav('/panier') }}>Acheter · {fcfa(track.price)}</button><button className="btn small ghost" type="button" onClick={() => setNotice(null)}>Fermer</button></>)}
        </div>
      )}
      <div className="prow">
        {track ? <Cover album={track.album} size={44} /> : <div className="cover mini" />}
        <div className="pinfo">
          <b>{track ? track.title : 'Choisis un titre'}</b>
          <span>{track ? `${track.artist.name} · ${mode === 'preview' ? 'Aperçu 30 s' : 'Écoute complète'}` : user ? `Essai gratuit : ${trialDaysLeft(user)} jour(s) restant(s)` : 'Connecte-toi pour écouter'}</span>
          <input
            type="range" min="0" max={total || 1} step="0.1" value={Math.min(pos, total || 1)} disabled={!track}
            onChange={(e) => seek(Number(e.target.value))} aria-label="Position de lecture"
            style={{ '--p': pct + '%' }}
          />
        </div>
        <span className="dur">{mmss(pos)}</span>
        <button className="pp" type="button" onClick={toggle} disabled={!track} aria-label={playing ? 'Pause' : 'Lecture'}>{playing ? '❚❚' : '▶'}</button>
      </div>
    </div>
  )
}

export default function Layout() {
  const user = useUser()
  const db = useDb()
  const { cart } = useApp()
  const nav = useNavigate()

  return (
    <>
      <header className="top">
        <div className="wrap topin">
          <Link to="/" className="brand"><img src="/favicon.png" alt="" width="34" height="34" /><span>Vibe<b>Store</b></span></Link>
          <nav aria-label="Navigation principale">
            <NavLink to="/" end>Accueil</NavLink>
            <NavLink to="/decouvrir">Découvrir</NavLink>
            <NavLink to="/explorer">Explorer</NavLink>
            {user && <NavLink to="/bibliotheque">Ma musique</NavLink>}
            {user && user.role === 'artist' && <NavLink to="/studio">Studio</NavLink>}
            {user && user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            <NavLink to="/panier">Panier ({cart.length})</NavLink>
            {user ? (
              <button className="linkbtn" type="button" onClick={() => { signOut(); nav('/') }}>Sortir</button>
            ) : (
              <NavLink to="/compte" className="signin">Connexion</NavLink>
            )}
          </nav>
        </div>
      </header>
      <main className="wrap page"><Outlet /></main>
      <footer className="wrap foot">
        <span>© ETS VibeStore · Yaoundé, Cameroun</span>
        <span>Mode démonstration : données d’exemple, paiement simulé.</span>
      </footer>
      <Player />
    </>
  )
}
