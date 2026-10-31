// Base de données de démonstration (localStorage).
// Elle sera remplacée par Supabase (voir supabase/schema.sql) sans changer les écrans :
// tous les accès passent par les fonctions de ce fichier.
import { useSyncExternalStore } from 'react'

const KEY = 'vibestore.db.v2'
const SESSION = 'vibestore.session'
const DAY = 86400000

export const MIN_PRICE = 500
export const PREVIEW_SECONDS = 30
export const TRIAL_DAYS = 30

const uid = (p) => p + Math.random().toString(36).slice(2, 9)

function seed() {
  const now = Date.now()
  const users = [
    { id: 'u-admin', email: 'admin@vibestore.demo', password: 'admin123', name: 'Admin VibeStore', role: 'admin', artistStatus: 'none', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY },
    { id: 'u-nadege', email: 'artiste@vibestore.demo', password: 'artiste123', name: 'Nadège Ewané', role: 'artist', artistStatus: 'approved', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY },
    { id: 'u-kevin', email: 'kevin@vibestore.demo', password: 'kevin123', name: 'Kévin Mbarga', role: 'artist', artistStatus: 'approved', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY },
    { id: 'u-amina', email: 'amina@vibestore.demo', password: 'amina123', name: 'Amina Fotso', role: 'artist', artistStatus: 'approved', createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY },
  ]
  // Les artistes sont créés uniquement par VibeStore (admin). account : 'active' | 'invited'.
  const artists = [
    { id: 'a-nadege', userId: 'u-nadege', name: 'Nadège Ewané', genre: 'Afro-soul', bio: 'Voix douce de Yaoundé, entre afro-soul et makossa.', status: 'approved', account: 'active', createdAt: now },
    { id: 'a-kevin', userId: 'u-kevin', name: 'Kévin Mbarga', genre: 'Bikutsi urbain', bio: 'Beats de nuit, bikutsi moderne et sons urbains.', status: 'approved', account: 'active', createdAt: now },
    { id: 'a-amina', userId: 'u-amina', name: 'Amina Fotso', genre: 'Gospel, ndolé', bio: 'Chanteuse de l’Ouest, inspirations ndolé et gospel.', status: 'approved', account: 'invited', createdAt: now },
  ]
  const albums = [
    { id: 'al-1', artistId: 'a-nadege', title: 'Matin à Mokolo', kind: 'album', color: '#8B5CF6', status: 'approved', createdAt: now - 3 * DAY },
    { id: 'al-2', artistId: 'a-kevin', title: 'Nuits de Yaoundé', kind: 'album', color: '#22D3C5', status: 'approved', createdAt: now - 2 * DAY },
    { id: 'al-3', artistId: 'a-nadege', title: 'Route de l’Ouest', kind: 'single', color: '#F472B6', status: 'approved', createdAt: now - 1 * DAY },
  ]
  const tracks = [
    { id: 't-1', albumId: 'al-1', artistId: 'a-nadege', title: 'Matin à Mokolo', duration: 214, price: 1000, seed: 1, status: 'approved', plays: 128 },
    { id: 't-2', albumId: 'al-1', artistId: 'a-nadege', title: 'Marché de Mfoundi', duration: 198, price: 1000, seed: 2, status: 'approved', plays: 96 },
    { id: 't-3', albumId: 'al-1', artistId: 'a-nadege', title: 'Pluie de juillet', duration: 241, price: 1000, seed: 3, status: 'approved', plays: 74 },
    { id: 't-4', albumId: 'al-2', artistId: 'a-kevin', title: 'Yaoundé Nuit', duration: 187, price: 1000, seed: 4, status: 'approved', plays: 210 },
    { id: 't-5', albumId: 'al-2', artistId: 'a-kevin', title: 'Bikutsi 237', duration: 242, price: 1200, seed: 5, status: 'approved', plays: 183 },
    { id: 't-6', albumId: 'al-2', artistId: 'a-kevin', title: 'Dernier bus', duration: 205, price: 1000, seed: 6, status: 'approved', plays: 61 },
    { id: 't-7', albumId: 'al-3', artistId: 'a-nadege', title: 'Route de l’Ouest', duration: 226, price: 1500, seed: 7, status: 'approved', plays: 142 },
  ]
  // prix d'album : fixé à l'ajout de la sortie (au moins le prix minimum, 500 FCFA)
  albums[0].price = 2500
  albums[1].price = 3000
  albums[2].price = 1500
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

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return seed()
}

let db = load()
let version = 0
const listeners = new Set()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch {}
  version++
  listeners.forEach((l) => l())
}
function subscribe(l) { listeners.add(l); return () => listeners.delete(l) }

export function useDb() {
  useSyncExternalStore(subscribe, () => version)
  return db
}

export function resetDemo() {
  db = seed()
  try { localStorage.removeItem(SESSION) } catch {}
  save()
}

/* ---------- Session ---------- */
function sessionId() { try { return localStorage.getItem(SESSION) } catch { return null } }
export function useUser() {
  useSyncExternalStore(subscribe, () => version)
  const id = sessionId()
  return db.users.find((u) => u.id === id) || null
}
// L'inscription libre crée toujours un compte auditeur. Les comptes artistes sont créés par VibeStore (createArtist).
export function signUp({ email, password, name }) {
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
export function signOut() { localStorage.removeItem(SESSION); save() }

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
export function createRelease(admin, { artistId, title, kind, albumPrice, color, tracks }) {
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
  Object.assign(db.settings, patch)
  save()
}
export function togglePayment(id) {
  const m = db.settings.paymentMethods.find((x) => x.id === id)
  if (m) m.enabled = !m.enabled
  save()
}

export const fcfa = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA'
export const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
