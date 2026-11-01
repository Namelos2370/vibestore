import { useEffect, useState } from 'react'

export const BE_URL = 'https://blue-energy-store.vercel.app/'
export const BE_COLLECTION = BE_URL + '#collection'

export function PoweredBy() {
  return (
    <a className="powered" href={BE_URL} target="_blank" rel="noopener noreferrer">
      <img src="/blue-energy.png" alt="" width="20" height="20" />
      <span>Powered by <b>Blue Energy</b></span>
    </a>
  )
}

// Bandeau partenaire : logo + texte ensemble.
export function PartnerBand() {
  return (
    <section className="partner">
      <img src="/blue-energy.png" alt="Logo Blue Energy" width="72" height="72" />
      <div>
        <span className="eyebrow">Notre partenaire</span>
        <h2>Blue Energy</h2>
        <p className="muted">Streetwear premium conçu au Cameroun. <i>Elevate your standard.</i> VibeStore est propulsé par Blue Energy pour faire rayonner la musique et le style d’ici.</p>
        <a className="btn ghost" href={BE_COLLECTION} target="_blank" rel="noopener noreferrer">Découvrir la collection</a>
      </div>
    </section>
  )
}

// Écran de démarrage : 10 s à chaque ouverture (page fermée, ou absence d'au moins 1 h).
const SPLASH_MS = 10000
const AWAY_MS = 3600000
const SEEN = 'vibestore.lastseen'
const lastSeen = () => { try { return Number(localStorage.getItem(SEEN) || 0) } catch { return 0 } }
const touch = () => { try { localStorage.setItem(SEEN, String(Date.now())) } catch {} }
export function Splash() {
  const [show, setShow] = useState(() => {
    let fresh = true
    try { fresh = !sessionStorage.getItem('vibestore.splash'); sessionStorage.setItem('vibestore.splash', '1') } catch {}
    return fresh || Date.now() - lastSeen() > AWAY_MS
  })
  const [out, setOut] = useState(false)
  const close = () => { setOut(true); setTimeout(() => setShow(false), 500) }

  useEffect(() => {
    touch()
    const beat = setInterval(touch, 30000)
    const vis = () => {
      if (document.visibilityState === 'hidden') { touch(); return }
      if (Date.now() - lastSeen() > AWAY_MS) { setOut(false); setShow(true) }
      touch()
    }
    document.addEventListener('visibilitychange', vis)
    return () => { clearInterval(beat); document.removeEventListener('visibilitychange', vis) }
  }, [])

  useEffect(() => {
    if (!show) return
    const t = setTimeout(close, SPLASH_MS)
    return () => clearTimeout(t)
  }, [show])

  if (!show) return null
  return (
    <div className={'splash' + (out ? ' out' : '')} role="presentation" onClick={close}>
      <img src="/logo.jpg" alt="" width="150" height="150" className="s1" />
      <b className="s2">Vibe<span>Store</span></b>
      <div className="s3"><img src="/blue-energy.png" alt="" width="34" height="34" /><span>Powered by <b>Blue Energy</b></span></div>
      <small className="s4">Elevate your standard.</small>
      <div className="sbar" aria-hidden="true"><i style={{ animationDuration: SPLASH_MS + 'ms' }} /></div>
      <button className="linkbtn skip" type="button" onClick={close}>Passer</button>
    </div>
  )
}
