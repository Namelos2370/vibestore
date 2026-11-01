import { useEffect, useState } from 'react'
import { Icon, Verified } from './Icon'

const KEY = 'vibestore.install.dismissed'
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const recentlyDismissed = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < 3 * 86400000 } catch { return false } }

// Invite chaque visiteur à installer VibeStore sur l'écran d'accueil (Android : bouton direct ; iPhone : mode d'emploi).
export default function InstallPrompt() {
  const [evt, setEvt] = useState(null)
  const [show, setShow] = useState(false)
  const ios = isIos()

  useEffect(() => {
    if (standalone() || recentlyDismissed()) return
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); setShow(true) }
    const onInstalled = () => setShow(false)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    let t
    if (ios) t = setTimeout(() => setShow(true), 1800)
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled) }
  }, [ios])

  function close() { try { localStorage.setItem(KEY, String(Date.now())) } catch {} setShow(false) }
  async function install() {
    if (!evt) return
    evt.prompt()
    try { await evt.userChoice } catch {}
    setEvt(null); close()
  }
  if (!show) return null
  return (
    <div className="install" role="dialog" aria-label="Installer VibeStore">
      <img src="/icon-192.png" alt="" width="44" height="44" />
      <div className="itext">
        <b>Installe VibeStore sur ton écran d’accueil</b>
        {ios
          ? <span>Touche <Icon name="share" size={16} className="inl" /> <b>Partager</b>, puis <b>« Sur l’écran d’accueil »</b>. Tu auras l’app et les notifications.</span>
          : <span>Ouvre-la comme une vraie app, plus vite et avec les notifications.</span>}
      </div>
      {!ios && evt && <button className="btn small buy" type="button" onClick={install}>Installer</button>}
      <button className="iconbtn" type="button" onClick={close} aria-label="Plus tard"><Icon name="close" size={18} /></button>
    </div>
  )
}
