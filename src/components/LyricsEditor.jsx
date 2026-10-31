import { useEffect, useRef, useState } from 'react'
import { stripTimes, toLrc } from '../lib/lyrics'

// Saisie des paroles + synchronisation « au tapotement » avec la musique.
export default function LyricsEditor({ value, onChange, getSrc }) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState('')
  const [err, setErr] = useState('')
  const [lines, setLines] = useState([])
  const [times, setTimes] = useState([])
  const audio = useRef(null)

  async function start() {
    setErr('')
    const l = stripTimes(value)
    if (!l.length) { setErr('Écris d’abord les paroles, une ligne par phrase.'); return }
    try {
      const u = await getSrc()
      if (!u) throw new Error('Choisis d’abord le fichier audio.')
      setSrc(u); setLines(l); setTimes([]); setOpen(true)
    } catch (e) { setErr(e.message) }
  }
  useEffect(() => { if (open && audio.current) { audio.current.currentTime = 0; audio.current.play().catch(() => {}) } }, [open, src])

  const idx = times.length
  function tap() {
    if (idx >= lines.length) return
    setTimes([...times, audio.current ? audio.current.currentTime : 0])
  }
  function finish() {
    onChange(toLrc(lines, times))
    if (audio.current) audio.current.pause()
    setOpen(false)
  }
  const done = idx >= lines.length

  return (
    <div className="lyr">
      <label className="field"><span>Paroles (une ligne par phrase, ou format LRC déjà synchronisé)</span>
        <textarea rows={5} value={value} onChange={(e) => onChange(e.target.value)} placeholder={'Première phrase\nDeuxième phrase\n…'} />
      </label>
      {!open && <button className="btn small ghost" type="button" onClick={start}>Synchroniser avec la musique</button>}
      {err && <p className="err" role="alert">{err}</p>}
      {open && (
        <div className="sync panel">
          <p className="muted small">La musique joue. Tape sur le gros bouton au moment exact où chaque phrase commence.</p>
          <audio ref={audio} src={src} controls style={{ width: '100%' }} />
          <p className="syncnow" aria-live="polite">{done ? 'Toutes les phrases sont placées.' : <>À taper : <b>{lines[idx]}</b></>}</p>
          <p className="muted small">{idx} / {lines.length} phrases</p>
          <div className="row wrap">
            <button className="btn buy" type="button" onClick={tap} disabled={done}>Maintenant !</button>
            <button className="btn small ghost" type="button" onClick={() => setTimes(times.slice(0, -1))} disabled={!idx}>Annuler la dernière</button>
            <button className="btn small ghost" type="button" onClick={() => { setTimes([]); if (audio.current) { audio.current.currentTime = 0; audio.current.play() } }}>Recommencer</button>
            <button className="btn small buy" type="button" onClick={finish} disabled={!idx}>Terminer</button>
          </div>
        </div>
      )}
    </div>
  )
}
