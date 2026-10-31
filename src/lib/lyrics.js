// Paroles au format LRC : [mm:ss.xx] ligne. Sans horodatage, les paroles s'affichent en texte simple.
export function parseLyrics(text) {
  const out = []
  let timed = false
  for (const raw of (text || '').split(/\r?\n/)) {
    const m = raw.match(/^\s*((?:\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*)+)(.*)$/)
    if (m) {
      timed = true
      const line = m[2].trim()
      for (const t of m[1].matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
        out.push({ t: Number(t[1]) * 60 + Number(t[2]) + (t[3] ? Number('0.' + t[3]) : 0), text: line })
      }
    } else if (raw.trim()) out.push({ t: null, text: raw.trim() })
  }
  if (timed) return { timed: true, lines: out.filter((l) => l.t !== null).sort((a, b) => a.t - b.t) }
  return { timed: false, lines: out }
}
export const stripTimes = (text) => (text || '').split(/\r?\n/).map((l) => l.replace(/^\s*(\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]\s*)+/, '').trim()).filter(Boolean)
export function toLrc(lines, times) {
  const f = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `[${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}]` }
  return lines.map((l, i) => (times[i] != null ? `${f(times[i])}${l}` : l)).join('\n')
}
// Index de la ligne en cours pour la position pos (secondes), -1 avant la première.
export function currentLine(lines, pos) {
  let idx = -1
  for (let i = 0; i < lines.length; i++) { if (lines[i].t <= pos + 0.15) idx = i; else break }
  return idx
}
