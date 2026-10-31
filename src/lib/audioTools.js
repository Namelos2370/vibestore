// Outils audio côté navigateur : lit un fichier, en déduit la durée et fabrique l'extrait de 30 s (WAV mono 16 bits).
export async function analyseAudio(file, previewSeconds = 30) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) throw new Error('Ce navigateur ne sait pas lire les fichiers audio.')
  const ctx = new Ctx()
  try {
    const buf = await ctx.decodeAudioData(await file.arrayBuffer())
    const rate = buf.sampleRate
    const n = Math.min(buf.length, Math.floor(previewSeconds * rate))
    const mono = new Float32Array(n)
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c)
      for (let i = 0; i < n; i++) mono[i] += ch[i] / buf.numberOfChannels
    }
    // fondu de sortie de 0,5 s pour éviter une coupure sèche
    const fade = Math.min(n, Math.floor(rate * 0.5))
    for (let i = 0; i < fade; i++) mono[n - 1 - i] *= i / fade
    return { duration: Math.round(buf.duration), preview: encodeWav(mono, rate) }
  } catch (e) {
    throw new Error('Fichier audio illisible. Utilise un MP3 ou un WAV.')
  } finally {
    ctx.close && ctx.close()
  }
}

function encodeWav(samples, rate) {
  const out = new DataView(new ArrayBuffer(44 + samples.length * 2))
  const str = (o, s) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); out.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true)
  out.setUint32(24, rate, true); out.setUint32(28, rate * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true)
  str(36, 'data'); out.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    out.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7fff, true)
  }
  return new Blob([out], { type: 'audio/wav' })
}

// Réduit une image (pochette) à 800 px max et la convertit en JPEG léger.
export async function resizeImage(file, max = 800) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Image illisible. Utilise un JPG ou un PNG.')); i.src = url })
    const k = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image illisible.'))), 'image/jpeg', 0.85))
  } finally { URL.revokeObjectURL(url) }
}
