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

// Écran de démarrage, une fois par visite.
export function Splash() {
  const [show, setShow] = useState(() => { try { return !sessionStorage.getItem('vibestore.splash') } catch { return false } })
  const [out, setOut] = useState(false)
  useEffect(() => {
    if (!show) return
    try { sessionStorage.setItem('vibestore.splash', '1') } catch {}
    const a = setTimeout(() => setOut(true), 1500)
    const b = setTimeout(() => setShow(false), 2000)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [show])
  if (!show) return null
  return (
    <div className={'splash' + (out ? ' out' : '')} aria-hidden="true">
      <img src="/logo.jpg" alt="" width="150" height="150" className="s1" />
      <b className="s2">Vibe<span>Store</span></b>
      <div className="s3"><img src="/blue-energy.png" alt="" width="30" height="30" /><span>Powered by <b>Blue Energy</b></span></div>
      <small className="s4">Elevate your standard.</small>
    </div>
  )
}
