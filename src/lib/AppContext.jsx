import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useDb, useUser, listenRight, countPlay, trackAudioUrl, coverUrl, PREVIEW_SECONDS } from './store'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const CART_KEY = 'vibestore.cart.v1'
const DEMO_SECONDS = 60

export function AppProvider({ children }) {
  const db = useDb()
  const user = useUser()
  const audioRef = useRef(null)
  if (!audioRef.current && typeof Audio !== 'undefined') audioRef.current = new Audio()

  const [track, setTrack] = useState(null)
  const [mode, setMode] = useState('preview')
  const [playing, setPlaying] = useState(false)
  const [pos, setPos] = useState(0)
  const [notice, setNotice] = useState(null)
  const [ended, setEnded] = useState(0)
  const modeRef = useRef('preview')
  const reqRef = useRef(0)

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || [] } catch { return [] }
  })
  useEffect(() => { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)) } catch {} }, [cart])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = () => {
      setPos(a.currentTime)
      if (modeRef.current === 'preview' && a.currentTime >= PREVIEW_SECONDS) {
        a.pause()
        setPlaying(false)
        setNotice({ type: 'previewEnd' })
      }
    }
    const onEnd = () => { setPlaying(false); setEnded((n) => n + 1) }
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd) }
  }, [])

  const play = useCallback((t) => {
    const a = audioRef.current
    if (!a) return
    const right = listenRight(db, user, t)
    if (right === 'signup') { setNotice({ type: 'signup' }); return }
    if (right === 'expired') { setNotice({ type: 'expired' }); return }
    setNotice(null)
    if (track && track.id === t.id && right === modeRef.current) {
      if (a.paused) { if (modeRef.current === 'preview' && a.currentTime >= PREVIEW_SECONDS) a.currentTime = 0; a.play(); setPlaying(true) }
      else { a.pause(); setPlaying(false) }
      return
    }
    modeRef.current = right
    setMode(right)
    setTrack(t)
    setPos(0)
    countPlay(t.id)
    const req = ++reqRef.current
    trackAudioUrl(t, right).then((url) => {
      if (req !== reqRef.current) return
      a.src = url
      a.currentTime = 0
      if ('mediaSession' in navigator && window.MediaMetadata) {
        const img = coverUrl(t.album?.coverPath)
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: t.title, artist: t.artist?.name || 'VibeStore', album: t.album?.title || '',
          artwork: [{ src: img || '/icon-512.png', sizes: '512x512', type: img ? 'image/jpeg' : 'image/png' }],
        })
        navigator.mediaSession.setActionHandler('play', () => { a.play(); setPlaying(true) })
        navigator.mediaSession.setActionHandler('pause', () => { a.pause(); setPlaying(false) })
      }
      return a.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
    }).catch((e) => { setPlaying(false); setNotice({ type: 'error', message: e.message }) })
  }, [db, user, track])

  const toggle = useCallback(() => { if (track) play(track) }, [track, play])
  const seek = useCallback((s) => {
    const a = audioRef.current
    if (!a || !track) return
    const max = modeRef.current === 'preview' ? PREVIEW_SECONDS - 0.1 : (a.duration || DEMO_SECONDS)
    a.currentTime = Math.max(0, Math.min(max, s))
    setPos(a.currentTime)
  }, [track])

  // Si l'utilisateur se déconnecte, on coupe le son.
  useEffect(() => {
    if (!user && audioRef.current && track && modeRef.current === 'full') { audioRef.current.pause(); setPlaying(false); setTrack(null) }
  }, [user, track])

  const addToCart = useCallback((type, id) => {
    setCart((c) => (c.some((x) => x.type === type && x.id === id) ? c : [...c, { type, id }]))
  }, [])
  const removeFromCart = useCallback((type, id) => setCart((c) => c.filter((x) => !(x.type === type && x.id === id))), [])
  const clearCart = useCallback(() => setCart([]), [])

  const value = useMemo(() => ({
    track, mode, playing, pos, notice, setNotice, play, toggle, seek, ended,
    cart, addToCart, removeFromCart, clearCart,
    audioDuration: () => (audioRef.current && audioRef.current.duration) || DEMO_SECONDS,
  }), [track, mode, playing, pos, notice, ended, play, toggle, seek, cart, addToCart, removeFromCart, clearCart])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
