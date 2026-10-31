// Accès aux données. Deux modes, mêmes fonctions pour les écrans :
//  - Supabase (par défaut) : comptes, catalogue et achats dans la base (voir supabase/schema.sql)
//  - démonstration locale (VITE_SUPABASE_DISABLED=1) : tout dans le navigateur (localStorage)
// Les écrans lisent un cache en mémoire (db) ; les actions qui modifient les données sont asynchrones.
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { analyseAudio, resizeImage } from './audioTools'
import { demoAudioUrl } from './audio'

const REMOTE = !!supabase

const KEY = 'vibestore.db.v3'
const SESSION = 'vibestore.session'
const DAY = 86400000

export const MIN_PRICE = 500
export const PREVIEW_SECONDS = 30
export const TRIAL_DAYS = 30

const uid = (p) => p + Math.random().toString(36).slice(2, 9)

function seed() {
  const now = Date.now()
  // Catalogue vide : les artistes et leurs titres sont ajoutés par VibeStore depuis l'admin.
  // Compte équipe (démonstration, stocké dans le navigateur) : admin@vibestore.demo / admin123
  const users = [
    { id: 'u-admin', email: 'admin@vibestore.demo', password: 'admin123', name: 'Admin VibeStore', role: 'admin', artistStatus: 'none', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY },
  ]
  const artists = []
  const albums = []
  const tracks = []
  return {
    users, artists, albums, tracks,
    purchases: [],
    settings: {
      commissionPct: 20,
      promoCommissionPct: 15,
      promoMonths: 6,
      launchAt: now,
      minPrice: MIN_PRICE,
      paymentMethods: [
        { id: 'momo', label: 'MTN Mobile Money', enabled: true },
        { id: 'om', label: 'Orange Money', enabled: true },
        { id: 'card', label: 'Carte bancaire', enabled: false },
      ],
    },
  }
}

function emptyDb() {
  return {
    users: [], artists: [], albums: [], tracks: [], purchases: [],
    settings: {
      commissionPct: 20, promoCommissionPct: 15, promoMonths: 6, launchAt: Date.now(), minPrice: MIN_PRICE,
      paymentMethods: [
        { id: 'momo', label: 'MTN Mobile Money', enabled: true },
        { id: 'om', label: 'Orange Money', enabled: true },
        { id: 'card', label: 'Carte bancaire', enabled: false },
      ],
    },
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return seed()
}

let db = REMOTE ? emptyDb() : load()
let me = null // utilisateur connecté (mode Supabase)
let version = 0
const listeners = new Set()

function save() {
  if (!REMOTE) { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch {} }
  version++
  listeners.forEach((l) => l())
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }

export function useDb() {
  useSyncExternalStore(subscribe, () => version)
  return db
}

export function resetDemo() {
  if (REMOTE) return
  db = seed()
  try { localStorage.removeItem(SESSION) } catch {}
  save()
}

/* ---------- Session ---------- */
function sessionId() { try { return localStorage.getItem(SESSION) } catch { return null } }
export function useUser() {
  useSyncExternalStore(subscribe, () => version)
  if (REMOTE) return me
  const id = sessionId()
  return db.users.find((u) => u.id === id) || null
}
// L'inscription libre crée toujours un compte auditeur. Les comptes artistes sont créés par VibeStore (createArtist).
export function signUp({ email, password, name }) {
  if (REMOTE) return remoteSignUp({ email, password, name })
  email = email.trim().toLowerCase()
  if (!email || !password || !name.trim()) throw new Error('Remplis tous les champs.')
  if (password.length < 6) throw new Error('Le mot de passe doit avoir au moins 6 caractères.')
  if (db.users.some((u) => u.email === email)) throw new Error('Un compte existe déjà avec cet email.')
  const now = Date.now()
  const user = {
    id: uid('u-'), email, password, name: name.trim(),
    role: 'listener', artistStatus: 'none',
    createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY,
  }
  db.users.push(user)
  localStorage.setItem(SESSION, user.id)
  save()
  return user
}
export function signIn(email, password) {
  if (REMOTE) return remoteSignIn(email, password)
  const u = db.users.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
  if (!u) throw new Error('Email ou mot de passe incorrect.')
  if (u.role === 'artist') {
    const a = db.artists.find((x) => x.userId === u.id)
    if (a && a.account === 'invited') a.account = 'active' // première connexion : le compte devient actif
  }
  localStorage.setItem(SESSION, u.id)
  save()
  return u
}
export function signOut() {
  if (REMOTE) return remoteSignOut()
  localStorage.removeItem(SESSION); save()
}

/* ---------- Lecture du catalogue ---------- */
export const approvedArtist = (a) => a && a.status === 'approved'
export function catalog(d) {
  const artistById = Object.fromEntries(d.artists.map((a) => [a.id, a]))
  const albums = d.albums
    .filter((al) => al.status === 'approved' && approvedArtist(artistById[al.artistId]))
    .map((al) => ({ ...al, artist: artistById[al.artistId] }))
  const albumById = Object.fromEntries(albums.map((a) => [a.id, a]))
  const tracks = d.tracks
    .filter((t) => t.status === 'approved' && albumById[t.albumId])
    .map((t) => ({ ...t, album: albumById[t.albumId], artist: artistById[t.artistId] }))
  return { albums, tracks, artists: d.artists.filter(approvedArtist) }
}

/* ---------- Droits d'écoute ---------- */
export function owns(d, user, item) {
  if (!user) return false
  if (user.role === 'admin') return true
  const ps = d.purchases.filter((p) => p.userId === user.id)
  if (item.type === 'album') return ps.some((p) => p.itemType === 'album' && p.itemId === item.id)
  const track = d.tracks.find((t) => t.id === item.id)
  return ps.some((p) => (p.itemType === 'track' && p.itemId === item.id) || (p.itemType === 'album' && track && p.itemId === track.albumId))
}
/** 'full' | 'preview' | 'signup' | 'expired' */
export function listenRight(d, user, track) {
  if (!user) return 'signup'
  if (owns(d, user, { type: 'track', id: track.id })) return 'full'
  if (user.role === 'artist' && d.artists.some((a) => a.userId === user.id && a.id === track.artistId)) return 'full'
  if (Date.now() <= user.trialEndsAt) return 'preview'
  return 'expired'
}
export function trialDaysLeft(user) {
  if (!user) return 0
  return Math.max(0, Math.ceil((user.trialEndsAt - Date.now()) / DAY))
}
export function countPlay(trackId) {
  if (REMOTE) return remoteCountPlay(trackId)
  const t = db.tracks.find((x) => x.id === trackId)
  if (t) { t.plays = (t.plays || 0) + 1; save() }
}

/* ---------- Achats ---------- */
export function currentCommission(d = db) {
  const s = d.settings
  const months = (Date.now() - s.launchAt) / (30 * DAY)
  return months < s.promoMonths ? s.promoCommissionPct : s.commissionPct
}
export function checkout(user, cartItems, methodId) {
  if (REMOTE) return remoteCheckout(user, cartItems, methodId)
  if (!user) throw new Error('Connecte-toi pour acheter.')
  const method = db.settings.paymentMethods.find((m) => m.id === methodId && m.enabled)
  if (!method) throw new Error('Choisis un moyen de paiement disponible.')
  const pct = currentCommission()
  const created = []
  cartItems.forEach((it) => {
    if (owns(db, user, it)) return
    const src = it.type === 'album' ? db.albums.find((a) => a.id === it.id) : db.tracks.find((t) => t.id === it.id)
    if (!src) return
    const artistId = src.artistId
    const p = {
      id: uid('p-'), userId: user.id, itemType: it.type, itemId: it.id, artistId,
      amount: src.price, commissionPct: pct, method: method.id, at: Date.now(),
    }
    db.purchases.push(p)
    created.push(p)
  })
  save()
  return created
}

/* ---------- Espace artiste (lecture seule : VibeStore gère le catalogue) ---------- */
export function myArtist(d, user) {
  return user ? d.artists.find((a) => a.userId === user.id) || null : null
}

/* ---------- Administration (VibeStore uniquement) ---------- */
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '')
function requireAdmin(user) {
  if (!user || user.role !== 'admin') throw new Error('Action réservée à l’équipe VibeStore.')
}

/** Crée le compte d'un artiste. En production : invitation par Supabase Auth (lien pour choisir un mot de passe). */
export function createArtist(admin, { name, contact, genre, bio }) {
  if (REMOTE) return remoteCreateArtist(admin, { name, contact, genre, bio })
  requireAdmin(admin)
  name = (name || '').trim()
  contact = (contact || '').trim()
  if (!name) throw new Error('Indique le nom de l’artiste.')
  if (!contact) throw new Error('Indique un email ou un numéro de téléphone pour envoyer l’invitation.')
  if (db.artists.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new Error('Un artiste porte déjà ce nom.')
  const email = contact.includes('@') ? contact.toLowerCase() : `${slug(name)}@artistes.vibestore`
  if (db.users.some((u) => u.email === email)) throw new Error('Un compte existe déjà avec ce contact.')
  const tempPassword = Math.random().toString(36).slice(2, 10)
  const now = Date.now()
  const user = { id: uid('u-'), email, password: tempPassword, name, role: 'artist', artistStatus: 'approved', contact, createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY }
  const artist = { id: uid('a-'), userId: user.id, name, genre: (genre || '').trim(), bio: (bio || '').trim(), status: 'approved', account: 'invited', createdAt: now }
  db.users.push(user)
  db.artists.push(artist)
  save()
  return { artist, email, tempPassword }
}

/** Ajoute une sortie (album ou single) et ses titres pour un artiste. Publiée tout de suite, sans validation. */
export function createRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover }) {
  if (REMOTE) return remoteCreateRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover })
  requireAdmin(admin)
  const artist = db.artists.find((a) => a.id === artistId)
  if (!artist) throw new Error('Choisis un artiste.')
  if (!title.trim()) throw new Error('Donne un titre à la sortie.')
  const list = tracks.filter((t) => t.title.trim())
  if (!list.length) throw new Error('Ajoute au moins un titre.')
  const min = db.settings.minPrice
  for (const t of list) if (!(Number(t.price) >= min)) throw new Error(`Le prix minimum est de ${min} FCFA par titre.`)
  if (kind === 'album' && !(Number(albumPrice) >= min)) throw new Error(`Le prix minimum est de ${min} FCFA pour l’album.`)
  const alId = uid('al-')
  const final = kind === 'single' ? list.slice(0, 1) : list
  const price = kind === 'album' ? Number(albumPrice) : Number(final[0].price)
  db.albums.push({ id: alId, artistId: artist.id, title: title.trim(), kind, color, price, status: 'approved', createdAt: Date.now() })
  final.forEach((t, i) =>
    db.tracks.push({
      id: uid('t-'), albumId: alId, artistId: artist.id, title: t.title.trim(),
      duration: Number(t.duration) || 180, price: Number(t.price), seed: Math.floor(Math.random() * 90) + 10 + i,
      audioName: t.audioName || '', status: 'approved', plays: 0,
    })
  )
  save()
  return alId
}
export function updateSettings(patch) {
  if (REMOTE) return remoteUpdateSettings(patch)
  Object.assign(db.settings, patch)
  save()
}
export function togglePayment(id) {
  if (REMOTE) return remoteTogglePayment(id)
  const m = db.settings.paymentMethods.find((x) => x.id === id)
  if (m) m.enabled = !m.enabled
  save()
}

export const fcfa = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`


/* ======================= Mode Supabase ======================= */
const ms = (v) => (v ? new Date(v).getTime() : Date.now())
const frError = (m = '') => {
  if (/already registered|already been registered/i.test(m)) return 'Un compte existe déjà avec cet email.'
  if (/invalid login/i.test(m)) return 'Email ou mot de passe incorrect.'
  if (/not confirmed/i.test(m)) return 'Confirme d’abord ton email avec le lien reçu par mail.'
  if (/rate limit|too many/i.test(m)) return 'Trop de tentatives. Réessaie dans quelques minutes.'
  if (/row-level security|permission denied/i.test(m)) return 'Action réservée à l’équipe VibeStore.'
  if (/password/i.test(m) && /least|short|weak/i.test(m)) return 'Le mot de passe doit avoir au moins 6 caractères.'
  return m
}
const must = ({ data, error }) => { if (error) throw new Error(frError(error.message)); return data }

const mapArtist = (a) => ({ id: a.id, userId: a.user_id, name: a.name, genre: a.genre, bio: a.bio, status: a.status, account: a.account, createdAt: ms(a.created_at) })
const mapAlbum = (r) => ({ coverPath: r.cover_path, id: r.id, artistId: r.artist_id, title: r.title, kind: r.kind, color: r.color, price: r.price, status: r.status, createdAt: ms(r.created_at) })
const mapTrack = (t) => ({ id: t.id, albumId: t.release_id, artistId: t.artist_id, title: t.title, duration: t.duration, price: t.price, seed: t.seed, audioName: t.audio_name, audioPath: t.audio_path, previewPath: t.preview_path, status: t.status, plays: t.plays })
const mapPurchase = (p) => ({ id: p.id, userId: p.user_id, itemType: p.item_type === 'release' ? 'album' : 'track', itemId: p.item_id, artistId: p.artist_id, amount: p.amount, commissionPct: Number(p.commission_pct), method: p.method, at: ms(p.created_at) })
const mapSettings = (s) => ({
  commissionPct: Number(s.commission_pct), promoCommissionPct: Number(s.promo_commission_pct), promoMonths: s.promo_months,
  launchAt: ms(s.launch_at), minPrice: s.min_price, paymentMethods: s.payment_methods,
})
const mapProfile = (p, email) => ({
  id: p.id, email: p.email || email, name: p.name, role: p.role, artistStatus: p.role === 'artist' ? 'approved' : 'none',
  createdAt: ms(p.created_at), trialEndsAt: ms(p.trial_ends_at),
})

let refreshing = null
function notify() { version++; listeners.forEach((l) => l()) }
export function refresh() {
  if (!REMOTE) return Promise.resolve()
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const [st, ar, re, tr, pu, pr] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('artists').select('*').order('created_at'),
        supabase.from('releases').select('*').order('created_at'),
        supabase.from('tracks').select('*').order('created_at'),
        session ? supabase.from('purchases').select('*').eq('status', 'paid').order('created_at') : Promise.resolve({ data: [] }),
        session ? supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const next = emptyDb()
      if (st.data) next.settings = mapSettings(st.data)
      next.artists = (ar.data || []).map(mapArtist)
      next.albums = (re.data || []).map(mapAlbum)
      next.tracks = (tr.data || []).map(mapTrack)
      next.purchases = (pu.data || []).map(mapPurchase)
      me = pr.data ? mapProfile(pr.data, session.user.email) : null
      next.users = me ? [me] : []
      db = next
    } catch (e) {
      console.error('Chargement Supabase impossible', e)
    } finally {
      refreshing = null
      notify()
    }
  })()
  return refreshing
}
if (REMOTE) {
  refresh()
  supabase.auth.onAuthStateChange((event) => { if (event !== 'TOKEN_REFRESHED') setTimeout(refresh, 0) })
}

async function remoteSignUp({ email, password, name }) {
  email = (email || '').trim().toLowerCase()
  if (!email || !password || !(name || '').trim()) throw new Error('Remplis tous les champs.')
  if (password.length < 6) throw new Error('Le mot de passe doit avoir au moins 6 caractères.')
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
  if (error) throw new Error(frError(error.message))
  // Email déjà utilisé : Supabase renvoie un utilisateur sans identité, sans erreur.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) throw new Error('Un compte existe déjà avec cet email.')
  if (!data.session) return { pendingConfirmation: true, email }
  await refresh()
  return me
}
async function remoteSignIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email: (email || '').trim().toLowerCase(), password })
  if (error) throw new Error(frError(error.message))
  await refresh()
  return me
}
async function remoteSignOut() {
  await supabase.auth.signOut()
  me = null
  await refresh()
}
function remoteCountPlay(trackId) {
  const t = db.tracks.find((x) => x.id === trackId)
  if (t) t.plays = (t.plays || 0) + 1
  supabase.rpc('count_play', { p_track: trackId }).then(() => {}, () => {})
}
async function remoteCheckout(user, cartItems, methodId) {
  if (!user) throw new Error('Connecte-toi pour acheter.')
  const rows = must(await supabase.rpc('simulate_checkout', { p_items: cartItems, p_method: methodId }))
  await refresh()
  return (rows || []).map(mapPurchase)
}
async function remoteCreateArtist(admin, { name, contact, genre, bio }) {
  requireAdmin(admin)
  name = (name || '').trim()
  const email = (contact || '').trim().toLowerCase()
  if (!name) throw new Error('Indique le nom de l’artiste.')
  if (!email.includes('@')) throw new Error('Indique l’email de l’artiste : il sert à relier son compte à sa fiche.')
  if (db.artists.some((a) => a.name.toLowerCase() === name.toLowerCase())) throw new Error('Un artiste porte déjà ce nom.')
  const row = must(await supabase.from('artists').insert({ name, genre: (genre || '').trim(), bio: (bio || '').trim() }).select().single())
  const inv = await supabase.from('artist_invites').insert({ artist_id: row.id, email })
  if (inv.error) {
    await supabase.from('artists').delete().eq('id', row.id)
    throw new Error(/duplicate|unique/i.test(inv.error.message) ? 'Cet email est déjà utilisé par un autre artiste.' : frError(inv.error.message))
  }
  await refresh()
  return { artist: mapArtist(row), email, tempPassword: null }
}
async function remoteCreateRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover }) {
  requireAdmin(admin)
  if (!db.artists.some((a) => a.id === artistId)) throw new Error('Choisis un artiste.')
  if (!title.trim()) throw new Error('Donne un titre à la sortie.')
  const list = tracks.filter((t) => t.title.trim())
  if (!list.length) throw new Error('Ajoute au moins un titre.')
  const min = db.settings.minPrice
  for (const t of list) if (!(Number(t.price) >= min)) throw new Error(`Le prix minimum est de ${min} FCFA par titre.`)
  if (kind === 'album' && !(Number(albumPrice) >= min)) throw new Error(`Le prix minimum est de ${min} FCFA pour l’album.`)
  const final = kind === 'single' ? list.slice(0, 1) : list
  const price = kind === 'album' ? Number(albumPrice) : Number(final[0].price)
  // 1) Fichiers audio : analyse (durée + extrait de 30 s) puis envoi, avant de créer la sortie.
  const prepared = []
  for (const t of final) {
    const id = crypto.randomUUID()
    const row = { id, title: t.title.trim(), price: Number(t.price), duration: Number(t.duration) || 180, audio_name: t.audioName || '', audio_path: null, preview_path: null }
    if (t.file) {
      const { duration, preview } = await analyseAudio(t.file)
      const ext = (t.file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3'
      const previewPath = `${id}/preview.wav`
      const audioPath = `${id}/full.${ext}`
      const up1 = await supabase.storage.from('previews').upload(previewPath, preview, { contentType: 'audio/wav', upsert: true })
      if (up1.error) throw new Error('Envoi de l’extrait impossible : ' + frError(up1.error.message))
      const up2 = await supabase.storage.from('audio').upload(audioPath, t.file, { contentType: t.file.type || 'audio/mpeg', upsert: true })
      if (up2.error) throw new Error(/exceeded|too large|size/i.test(up2.error.message) ? 'Fichier trop lourd (50 Mo maximum).' : 'Envoi du fichier impossible : ' + frError(up2.error.message))
      Object.assign(row, { duration, audio_path: audioPath, preview_path: previewPath })
    }
    prepared.push(row)
  }
  // 2) Sortie et titres
  const relId = crypto.randomUUID()
  let coverPath = null
  if (cover) {
    const img = await resizeImage(cover)
    coverPath = `${relId}.jpg`
    const upc = await supabase.storage.from('covers').upload(coverPath, img, { contentType: 'image/jpeg', upsert: true })
    if (upc.error) throw new Error('Envoi de la pochette impossible : ' + frError(upc.error.message))
  }
  const rel = must(await supabase.from('releases').insert({ id: relId, artist_id: artistId, title: title.trim(), kind, color, price, cover_path: coverPath }).select().single())
  const ins = await supabase.from('tracks').insert(prepared.map((r, i) => ({
    ...r, release_id: rel.id, artist_id: artistId, seed: Math.floor(Math.random() * 90) + 10 + i,
  })))
  if (ins.error) {
    await supabase.from('releases').delete().eq('id', rel.id)
    throw new Error(frError(ins.error.message))
  }
  await refresh()
  return rel.id
}
async function remoteUpdateSettings(patch) {
  const m = { commissionPct: 'commission_pct', promoCommissionPct: 'promo_commission_pct', promoMonths: 'promo_months', minPrice: 'min_price' }
  const row = {}
  Object.entries(patch).forEach(([k, v]) => { if (m[k]) row[m[k]] = v })
  must(await supabase.from('settings').update(row).eq('id', 1).select())
  await refresh()
}
async function remoteTogglePayment(id) {
  const methods = db.settings.paymentMethods.map((x) => (x.id === id ? { ...x, enabled: !x.enabled } : x))
  must(await supabase.from('settings').update({ payment_methods: methods }).eq('id', 1).select())
  await refresh()
}

/** Adresse du son d'un titre : extrait public (30 s), fichier complet signé (acheteurs) ou son de démonstration. */
export async function trackAudioUrl(t, mode, { download = false } = {}) {
  if (REMOTE && t.audioPath) {
    if (mode === 'full') {
      const { data, error } = await supabase.storage.from('audio').createSignedUrl(t.audioPath, 3600, download ? { download: `${t.artist?.name || 'VibeStore'} - ${t.title}.${t.audioPath.split('.').pop()}` } : undefined)
      if (error) throw new Error('Écoute impossible : ' + frError(error.message))
      return data.signedUrl
    }
    return supabase.storage.from('previews').getPublicUrl(t.previewPath).data.publicUrl
  }
  return demoAudioUrl(t.seed, download ? 60 : 60)
}

export function coverUrl(path) {
  return REMOTE && path ? supabase.storage.from('covers').getPublicUrl(path).data.publicUrl : null
}


/* ---------- Modifier, masquer, supprimer (admin) ---------- */
function hasSales(kind, id) {
  const ps = db.purchases
  if (kind === 'artist') return ps.some((p) => p.artistId === id)
  if (kind === 'release') {
    const ids = db.tracks.filter((t) => t.albumId === id).map((t) => t.id)
    return ps.some((p) => (p.itemType === 'album' && p.itemId === id) || (p.itemType === 'track' && ids.includes(p.itemId)))
  }
  const t = db.tracks.find((x) => x.id === id)
  return ps.some((p) => (p.itemType === 'track' && p.itemId === id) || (p.itemType === 'album' && t && p.itemId === t.albumId))
}
const cleanStatus = (st) => (st === 'rejected' ? 'rejected' : 'approved')
function checkPrice(n, label) {
  if (!(Number(n) >= db.settings.minPrice)) throw new Error(`Le prix minimum est de ${db.settings.minPrice} FCFA ${label}.`)
}

export async function updateArtist(admin, id, { name, genre, bio, status }) {
  requireAdmin(admin)
  if (!(name || '').trim()) throw new Error('Le nom ne peut pas être vide.')
  if (db.artists.some((a) => a.id !== id && a.name.toLowerCase() === name.trim().toLowerCase())) throw new Error('Un artiste porte déjà ce nom.')
  const row = { name: name.trim(), genre: (genre || '').trim(), bio: (bio || '').trim(), status: cleanStatus(status) }
  if (REMOTE) { must(await supabase.from('artists').update(row).eq('id', id).select()); return refresh() }
  Object.assign(db.artists.find((a) => a.id === id), row); save()
}
export async function updateRelease(admin, id, { title, price, color, status }) {
  requireAdmin(admin)
  if (!(title || '').trim()) throw new Error('Le titre ne peut pas être vide.')
  checkPrice(price, 'pour une sortie')
  const row = { title: title.trim(), price: Number(price), color, status: cleanStatus(status) }
  if (REMOTE) { must(await supabase.from('releases').update(row).eq('id', id).select()); return refresh() }
  Object.assign(db.albums.find((a) => a.id === id), row); save()
}
export async function updateTrack(admin, id, { title, price, status }) {
  requireAdmin(admin)
  if (!(title || '').trim()) throw new Error('Le titre ne peut pas être vide.')
  checkPrice(price, 'par titre')
  const row = { title: title.trim(), price: Number(price), status: cleanStatus(status) }
  if (REMOTE) { must(await supabase.from('tracks').update(row).eq('id', id).select()); return refresh() }
  Object.assign(db.tracks.find((t) => t.id === id), row); save()
}
const SOLD = 'Des ventes existent : masque-le plutôt que de le supprimer, pour que les acheteurs gardent leur musique.'
async function removeFiles(tracks, releases = []) {
  if (!REMOTE) return
  const audio = tracks.map((t) => t.audioPath).filter(Boolean)
  const prev = tracks.map((t) => t.previewPath).filter(Boolean)
  const covers = releases.map((r) => r.coverPath).filter(Boolean)
  if (audio.length) await supabase.storage.from('audio').remove(audio)
  if (prev.length) await supabase.storage.from('previews').remove(prev)
  if (covers.length) await supabase.storage.from('covers').remove(covers)
}
export async function deleteTrack(admin, id) {
  requireAdmin(admin)
  if (hasSales('track', id)) throw new Error(SOLD)
  const t = db.tracks.find((x) => x.id === id)
  if (REMOTE) { must(await supabase.from('tracks').delete().eq('id', id).select()); await removeFiles([t]); return refresh() }
  db.tracks = db.tracks.filter((x) => x.id !== id); save()
}
export async function deleteRelease(admin, id) {
  requireAdmin(admin)
  if (hasSales('release', id)) throw new Error(SOLD)
  const ts = db.tracks.filter((t) => t.albumId === id)
  const r = db.albums.find((x) => x.id === id)
  if (REMOTE) { must(await supabase.from('releases').delete().eq('id', id).select()); await removeFiles(ts, [r]); return refresh() }
  db.tracks = db.tracks.filter((t) => t.albumId !== id); db.albums = db.albums.filter((a) => a.id !== id); save()
}
export async function deleteArtist(admin, id) {
  requireAdmin(admin)
  if (hasSales('artist', id)) throw new Error(SOLD)
  const rs = db.albums.filter((a) => a.artistId === id)
  const ts = db.tracks.filter((t) => t.artistId === id)
  if (REMOTE) { must(await supabase.from('artists').delete().eq('id', id).select()); await removeFiles(ts, rs); return refresh() }
  db.tracks = db.tracks.filter((t) => t.artistId !== id); db.albums = db.albums.filter((a) => a.artistId !== id); db.artists = db.artists.filter((a) => a.id !== id); save()
}

/* ---------- Mot de passe oublié ---------- */
let recovery = false
export function useRecovery() { useSyncExternalStore(subscribe, () => version); return recovery }
export async function sendPasswordReset(email) {
  if (!REMOTE) throw new Error('Disponible seulement avec la vraie base.')
  email = (email || '').trim().toLowerCase()
  if (!email.includes('@')) throw new Error('Entre ton adresse email.')
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/compte` })
  if (error) throw new Error(frError(error.message))
}
export async function setNewPassword(password) {
  if (!password || password.length < 6) throw new Error('Le mot de passe doit avoir au moins 6 caractères.')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new Error(frError(error.message))
  recovery = false
  await refresh()
}
if (REMOTE) supabase.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') { recovery = true; notify() } })
