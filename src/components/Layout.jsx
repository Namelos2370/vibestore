import { useEffect } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { autoPush, useDb, useUser, useUnread, signOut, trialDaysLeft, mmss, PREVIEW_SECONDS, fcfa } from '../lib/store'
import { Cover } from './ui'
import InstallPrompt from './InstallPrompt'

export function PoweredBy() {
  return <a className="powered" href="https://blue-energy-store.vercel.app/" target="_blank" rel="noopener noreferrer">Powered by <b>Blue Energy</b></a>
}

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
          {notice.type === 'previewEnd' && track && (<><span>Fin de l’aperçu de 30 s.{!user && ' Crée un compte gratuit pour 1 mois d’écoute en extraits.'}</span>{!user && <button className="btn small ghost" type="button" onClick={() => { setNotice(null); nav('/compte') }}>Créer un compte</button>}<button className="btn small buy" type="button" onClick={() => { addToCart('track', track.id); setNotice(null); nav('/panier') }}>Acheter · {fcfa(track.price)}</button><button className="btn small ghost" type="button" onClick={() => setNotice(null)}>Fermer</button></>)}
        </div>
      )}
      <div className="prow">
        {track ? <Cover album={track.album} size={44} /> : <div className="cover mini" />}
        <div className="pinfo">
          <b>{track ? track.title : 'Choisis un titre'}</b>
          <span>{track ? `${track.artist.name} · ${mode === 'preview' ? 'Aperçu 30 s' : 'Écoute complète'}` : user ? `Essai gratuit : ${trialDaysLeft(user)} jour(s) restant(s)` : 'Extrait gratuit de 30 s sur chaque titre'}</span>
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
  useEffect(() => { autoPush() }, [])
  const user = useUser()
  const db = useDb()
  const { cart } = useApp()
  const nav = useNavigate()
  const unread = useUnread()

  return (
    <>
      <header className="top">
        <div className="wrap topin">
          <Link to="/" className="brand"><img src="/favicon.png" alt="" width="34" height="34" /><span>Vibe<b>Store</b></span></Link>
          <nav aria-label="Navigation principale">
            <NavLink to="/" end className="mhide">Accueil</NavLink>
            <NavLink to="/decouvrir" className="mhide">Découvrir</NavLink>
            <NavLink to="/explorer" className="mhide">Explorer</NavLink>
            {user && <NavLink to="/bibliotheque" className="mhide">Ma musique</NavLink>}
            {user && user.role === 'artist' && <NavLink to="/studio">Studio</NavLink>}
            {user && user.role === 'admin' && <NavLink to="/admin">Admin</NavLink>}
            <NavLink to="/notifications" className="bell" aria-label={`Notifications${unread ? ` (${unread} nouvelles)` : ''}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 17V11a6 6 0 1112 0v6l1.5 2h-15L6 17zM10 21h4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {unread > 0 && <b className="dot">{unread > 9 ? '9+' : unread}</b>}
            </NavLink>
            <NavLink to="/panier" className="mhide">Panier ({cart.length})</NavLink>
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
        <PoweredBy />
      </footer>
      <Player />
      <InstallPrompt />
      <nav className="tabbar" aria-label="Navigation mobile">
        {[
          ['/', 'Accueil', 'M4 11l8-7 8 7v9h-5v-6H9v6H4z', true],
          ['/decouvrir', 'Découvrir', 'M5 4h14v16H5zM9 9l6 3-6 3z'],
          ['/explorer', 'Explorer', 'M11 4a7 7 0 100 14 7 7 0 000-14zm5 12l4.5 4.5'],
          [user ? '/bibliotheque' : '/compte', 'Ma musique', 'M9 18V6l10-2v12M9 18a3 3 0 11-6 0 3 3 0 016 0zm10-2a3 3 0 11-6 0 3 3 0 016 0z'],
          ['/panier', `Panier${cart.length ? ` (${cart.length})` : ''}`, 'M3 4h2.5l2 11h10l2-8H7M9 20h.01M17 20h.01'],
        ].map(([to, label, d, end]) => (
          <NavLink key={label} to={to} end={!!end}>
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  )
}
