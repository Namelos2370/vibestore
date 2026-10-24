// Audio de démonstration : une courte mélodie synthétisée par titre.
// Quand Supabase Storage sera branché, track.audioUrl remplacera ce générateur.
const cache = new Map()
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17] // gamme pentatonique mineure

function rng(seed) {
  let s = seed * 9301 + 49297
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
}

export function demoAudioUrl(seed, seconds = 45) {
  const key = seed + ':' + seconds
  if (cache.has(key)) return cache.get(key)
  const rate = 8000
  const n = rate * seconds
  const rand = rng(seed)
  const root = 196 * Math.pow(2, (seed % 5) / 12)
  const step = 0.375 + (seed % 3) * 0.0625
  const melody = Array.from({ length: Math.ceil(seconds / step) }, () => SCALE[Math.floor(rand() * SCALE.length)])
  const data = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / rate
    const idx = Math.floor(t / step)
    const local = t - idx * step
    const f = root * Math.pow(2, melody[idx] / 12)
    const env = Math.min(1, local * 40) * Math.exp(-local * 4)
    const bass = Math.sin(2 * Math.PI * (root / 2) * t) * (0.25 + 0.15 * Math.sin(t * 2))
    const lead = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) * env
    data[i] = Math.max(-1, Math.min(1, (lead * 0.5 + bass) * 0.5)) * 32767
  }
  const buf = new ArrayBuffer(44 + data.length * 2)
  const v = new DataView(buf)
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + data.length * 2, true); w(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, data.length * 2, true)
  new Int16Array(buf, 44).set(data)
  const url = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }))
  cache.set(key, url)
  return url
}
