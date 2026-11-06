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
    users: [], artists: [], albums: [], tracks: [], purchases: [], notifications: [], likes: [], likeCounts: {}, members: [], priv: {}, notes: {}, invites: {}, payouts: [], requests: [], promos: [],
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
if (!db.notifications) db.notifications = []
if (!db.likes) db.likes = []
if (!db.likeCounts) db.likeCounts = {}
if (!db.priv) db.priv = {}
if (!db.notes) db.notes = {}
if (!db.invites) db.invites = {}
if (!db.payouts) db.payouts = []
if (!db.requests) db.requests = []
if (!db.promos) db.promos = []
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
export function signUp({ email, password, name, city }) {
  if (REMOTE) return remoteSignUp({ email, password, name, city })
  email = email.trim().toLowerCase()
  if (!email || !password || !name.trim()) throw new Error('Remplis tous les champs.')
  if (password.length < 6) throw new Error('Le mot de passe doit avoir au moins 6 caractères.')
  if (db.users.some((u) => u.email === email)) throw new Error('Un compte existe déjà avec cet email.')
  const now = Date.now()
  const user = {
    id: uid('u-'), email, password, name: name.trim(),
    role: 'listener', artistStatus: 'none', city: (city || '').trim(), blocked: false, blockedReason: '',
    createdAt: now, trialEndsAt: now + TRIAL_DAYS * DAY,
  }
  db.users.push(user)
  localStorage.setItem(SESSION, user.id)
  syncGuestLikesDemo(user.id)
  save()
  return user
}
export function signIn(email, password) {
  if (REMOTE) return remoteSignIn(email, password)
  const u = db.users.find((x) => x.email === email.trim().toLowerCase() && x.password === password)
  if (!u) throw new Error('Email ou mot de passe incorrect.')
  if (u.blocked) throw new Error('Ce compte est suspendu. Contacte l’équipe VibeStore.')
  if (u.role === 'artist') {
    const a = db.artists.find((x) => x.userId === u.id)
    if (a && a.account === 'invited') a.account = 'active' // première connexion : le compte devient actif
  }
  localStorage.setItem(SESSION, u.id)
  syncGuestLikesDemo(u.id)
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
  const clips = tracks.filter(isClip)
  const sounds = tracks.filter((t) => !isClip(t))
  // une sortie est « de sons » si elle contient au moins un son, « de clips » si tous ses titres sont des clips
  const soundAlbums = albums.filter((al) => sounds.some((t) => t.albumId === al.id) || !tracks.some((t) => t.albumId === al.id))
  const clipAlbums = albums.filter((al) => clips.some((t) => t.albumId === al.id))
  return { albums, tracks, sounds, clips, soundAlbums, clipAlbums, artists: d.artists.filter(approvedArtist) }
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
  if (!user) return 'preview' // visiteur : extrait de 30 s sans compte
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
  if (user.blocked) throw new Error('Ce compte est suspendu.')
  if (!purchasesOn(db)) throw new Error('Les achats ne sont pas encore ouverts.')
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
      amount: src.price, commissionPct: db.priv?.[artistId]?.commissionPct ?? pct, method: method.id, at: Date.now(),
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
export function createRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover, videoUrl, videoFile, media = 'sound' }) {
  if (REMOTE) return remoteCreateRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover, videoUrl, videoFile, media })
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
  db.albums.push({ id: alId, artistId: artist.id, title: title.trim(), kind, color, price, videoUrl: (videoUrl || '').trim(), status: 'approved', createdAt: Date.now() })
  final.forEach((t, i) =>
    db.tracks.push({
      id: uid('t-'), albumId: alId, artistId: artist.id, title: t.title.trim(),
      duration: Number(t.duration) || 180, price: Number(t.price), seed: Math.floor(Math.random() * 90) + 10 + i,
      audioName: t.audioName || (media === 'clip' ? 'clip.mp4' : ''), media: media === 'clip' ? 'clip' : 'sound', lyrics: media === 'clip' ? '' : t.lyrics || '', status: 'approved', plays: 0,
    })
  )
  addNotification({ title: `Nouvelle sortie : ${title.trim()}`, body: artist.name, url: `/sortie/${alId}` })
  save()
  return alId
}
export function updateSettings(patch) {
  if (REMOTE) return remoteUpdateSettings(patch)
  Object.assign(db.settings, patch)
  save()
}
/** Les achats sont-ils ouverts ? (interrupteur admin, en attendant les API de paiement) */
export const purchasesOn = (d) => d.settings.purchasesEnabled !== false
/** Paiement réel (Mobile Money) actif ? Sinon : simulation. */
export const livePayments = (d) => REMOTE && d.settings.demoPayments === false
export function togglePayment(id) {
  if (REMOTE) return remoteTogglePayment(id)
  const m = db.settings.paymentMethods.find((x) => x.id === id)
  if (m) m.enabled = !m.enabled
  save()
}

/** Le fichier du titre est-il un clip vidéo (au lieu d'un MP3) ? */
export const isClip = (t) => !!t && (t.media === 'clip' || (t.media !== 'sound' && /\.(mp4|m4v|mov|webm)$/i.test(t.audioPath || t.audioName || '')))
/** Média d'un achat : 'clip' si le titre (ou tout l'album) est un clip, sinon 'sound'. */
export function purchaseMedia(d, p) {
  if (p.itemType === 'album') { const ts = d.tracks.filter((t) => t.albumId === p.itemId); return ts.length && ts.every(isClip) ? 'clip' : 'sound' }
  return isClip(d.tracks.find((t) => t.id === p.itemId)) ? 'clip' : 'sound'
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

const mapArtist = (a) => ({ photoPath: a.photo_path || '', city: a.city || '', links: a.links || {}, verified: !!a.verified, id: a.id, userId: a.user_id, name: a.name, genre: a.genre, bio: a.bio, status: a.status, account: a.account, createdAt: ms(a.created_at) })
const mapAlbum = (r) => ({ coverPath: r.cover_path, videoUrl: r.video_url || '', id: r.id, artistId: r.artist_id, title: r.title, kind: r.kind, color: r.color, price: r.price, status: r.status, createdAt: ms(r.created_at) })
const mapTrack = (t) => ({ media: t.media === 'clip' ? 'clip' : 'sound', lyrics: t.lyrics || '', id: t.id, albumId: t.release_id, artistId: t.artist_id, title: t.title, duration: t.duration, price: t.price, seed: t.seed, audioName: t.audio_name, audioPath: t.audio_path, previewPath: t.preview_path, status: t.status, plays: t.plays })
const mapPurchase = (p) => ({ id: p.id, userId: p.user_id, itemType: p.item_type === 'release' ? 'album' : 'track', itemId: p.item_id, artistId: p.artist_id, amount: p.amount, commissionPct: Number(p.commission_pct), method: p.method, at: ms(p.created_at) })
const mapSettings = (s) => ({
  commissionPct: Number(s.commission_pct), promoCommissionPct: Number(s.promo_commission_pct), promoMonths: s.promo_months,
  launchAt: ms(s.launch_at), minPrice: s.min_price, paymentMethods: s.payment_methods, purchasesEnabled: s.purchases_enabled !== false, demoPayments: s.demo_payments !== false,
})
const mapProfile = (p, email) => ({
  id: p.id, email: p.email || email, name: p.name, role: p.role, artistStatus: p.role === 'artist' ? 'approved' : 'none',
  createdAt: ms(p.created_at), trialEndsAt: ms(p.trial_ends_at), city: p.city || '', blocked: !!p.blocked, blockedReason: p.blocked_reason || '',
})

let refreshing = null
let suspendedNotice = false
function notify() { version++; listeners.forEach((l) => l()) }
export function refresh() {
  if (!REMOTE) return Promise.resolve()
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const g = session ? guestLikes() : []
      if (g.length) {
        await supabase.from('likes').upsert(g.map((id) => ({ user_id: session.user.id, track_id: id })), { onConflict: 'user_id,track_id', ignoreDuplicates: true })
        setGuestLikes([])
      }
      const [st, ar, re, tr, pu, pr, no, lk, lc, ap, an, po, rq, iv, pm] = await Promise.all([
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('artists').select('*').order('created_at'),
        supabase.from('releases').select('*').order('created_at'),
        supabase.from('tracks').select('*').order('created_at'),
        session ? supabase.from('purchases').select('*').eq('status', 'paid').order('created_at') : Promise.resolve({ data: [] }),
        session ? supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50),
        session ? supabase.from('likes').select('track_id').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        supabase.rpc('track_like_counts'),
        session ? supabase.from('artist_private').select('*') : Promise.resolve({ data: [] }),
        session ? supabase.from('artist_notes').select('*') : Promise.resolve({ data: [] }),
        session ? supabase.from('payouts').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        session ? supabase.from('artist_requests').select('*').order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        session ? supabase.from('artist_invites').select('*') : Promise.resolve({ data: [] }),
        supabase.from('promos').select('*').order('created_at', { ascending: false }),
      ])
      const next = emptyDb()
      if (st.data) next.settings = mapSettings(st.data)
      next.artists = (ar.data || []).map(mapArtist)
      next.albums = (re.data || []).map(mapAlbum)
      next.tracks = (tr.data || []).map(mapTrack)
      next.purchases = (pu.data || []).map(mapPurchase)
      next.notifications = (no.data || []).map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.url, at: ms(n.created_at) }))
      next.priv = Object.fromEntries((ap.data || []).map((r) => [r.artist_id, { payoutMethod: r.payout_method, payoutNumber: r.payout_number, commissionPct: r.commission_pct == null ? null : Number(r.commission_pct), contractStart: r.contract_start || '', distribution: r.distribution || 'none', distributor: r.distributor || '' }]))
      next.notes = Object.fromEntries((an.data || []).map((r) => [r.artist_id, r.notes]))
      next.payouts = (po.data || []).map((r) => ({ id: r.id, artistId: r.artist_id, amount: r.amount, method: r.method, reference: r.reference, note: r.note, at: ms(r.created_at) }))
      next.requests = (rq.data || []).map((r) => ({ id: r.id, artistId: r.artist_id, kind: r.kind, message: r.message, status: r.status, reply: r.reply, at: ms(r.created_at) }))
      next.promos = (pm.data || []).map(mapPromo)
      next.invites = Object.fromEntries((iv.data || []).map((r) => [r.artist_id, r.email]))
      next.likes = (lk.data || []).map((r) => ({ userId: session.user.id, trackId: r.track_id }))
      next.likeCounts = Object.fromEntries((lc.data || []).map((r) => [r.track_id, Number(r.n)]))
      me = pr.data ? mapProfile(pr.data, session.user.email) : null
      if (me && me.blocked) { supabase.auth.signOut(); me = null; suspendedNotice = true }
      if (me && me.role === 'admin') {
        const mb = await supabase.from('profiles').select('id,name,email,city,role,blocked,blocked_reason,created_at').order('created_at', { ascending: false }).limit(5000)
        next.members = (mb.data || []).map((m) => ({ id: m.id, name: m.name, email: m.email, city: m.city || '', role: m.role, blocked: !!m.blocked, blockedReason: m.blocked_reason || '', createdAt: ms(m.created_at) }))
      }
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

async function remoteSignUp({ email, password, name, city }) {
  email = (email || '').trim().toLowerCase()
  if (!email || !password || !(name || '').trim()) throw new Error('Remplis tous les champs.')
  if (password.length < 6) throw new Error('Le mot de passe doit avoir au moins 6 caractères.')
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim(), city: (city || '').trim() } } })
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
  suspendedNotice = false
  await refresh()
  if (suspendedNotice) throw new Error('Ce compte est suspendu. Contacte l’équipe VibeStore.')
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
  if (!purchasesOn(db)) throw new Error('Les achats ne sont pas encore ouverts.')
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
async function remoteCreateRelease(admin, { artistId, title, kind, albumPrice, color, tracks, cover, videoUrl, videoFile, media = 'sound' }) {
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
  for (const t of final) {
    if (media === 'clip' && !t.file) throw new Error(`Ajoute le fichier vidéo (MP4) du clip « ${t.title.trim()} ».`)
    if (t.file) {
      const vid = /^video\//.test(t.file.type) || /\.(mp4|m4v|mov|webm)$/i.test(t.file.name)
      if (media === 'clip' && !vid) throw new Error(`« ${t.file.name} » n’est pas une vidéo. Les clips demandent un fichier MP4.`)
      if (media !== 'clip' && vid) throw new Error(`« ${t.file.name} » est une vidéo : publie-la dans l’espace Clips.`)
    }
  }
  // 1) Fichiers audio : analyse (durée + extrait de 30 s) puis envoi, avant de créer la sortie.
  const prepared = []
  for (const t of final) {
    const id = crypto.randomUUID()
    const row = { id, media: media === 'clip' ? 'clip' : 'sound', title: t.title.trim(), price: Number(t.price), duration: Number(t.duration) || 180, audio_name: t.audioName || '', lyrics: media === 'clip' ? '' : t.lyrics || '', audio_path: null, preview_path: null }
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
  let video = (videoUrl || '').trim() || null
  if (videoFile) {
    const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    const upv = await supabase.storage.from('videos').upload(`${relId}.${ext}`, videoFile, { contentType: videoFile.type || 'video/mp4', upsert: true })
    if (upv.error) throw new Error(/exceeded|too large|size/i.test(upv.error.message) ? 'Clip trop lourd (50 Mo maximum). Utilise plutôt un lien YouTube.' : 'Envoi du clip impossible : ' + frError(upv.error.message))
    video = supabase.storage.from('videos').getPublicUrl(`${relId}.${ext}`).data.publicUrl
  }
  const rel = must(await supabase.from('releases').insert({ id: relId, artist_id: artistId, title: title.trim(), kind, color, price, cover_path: coverPath, video_url: video }).select().single())
  const ins = await supabase.from('tracks').insert(prepared.map((r, i) => ({
    ...r, release_id: rel.id, artist_id: artistId, seed: Math.floor(Math.random() * 90) + 10 + i,
  })))
  if (ins.error) {
    await supabase.from('releases').delete().eq('id', rel.id)
    throw new Error(frError(ins.error.message))
  }
  await refresh()
  const art = db.artists.find((a) => a.id === artistId)
  announce(admin, { title: `Nouvelle sortie : ${title.trim()}`, body: art ? art.name : '', url: `/sortie/${rel.id}` }).catch(() => {})
  return rel.id
}
async function remoteUpdateSettings(patch) {
  const m = { commissionPct: 'commission_pct', promoCommissionPct: 'promo_commission_pct', promoMonths: 'promo_months', minPrice: 'min_price', purchasesEnabled: 'purchases_enabled', demoPayments: 'demo_payments' }
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
  const row = { name: name.trim(), genre: (genre || '').trim(), bio: (bio || '').trim(), status: ['approved', 'rejected', 'pending'].includes(status) ? status : 'approved' }
  if (REMOTE) { must(await supabase.from('artists').update(row).eq('id', id).select()); return refresh() }
  Object.assign(db.artists.find((a) => a.id === id), row); save()
}
export async function updateRelease(admin, id, { title, price, color, status, videoUrl }) {
  requireAdmin(admin)
  if (!(title || '').trim()) throw new Error('Le titre ne peut pas être vide.')
  checkPrice(price, 'pour une sortie')
  const row = { title: title.trim(), price: Number(price), color, status: cleanStatus(status), video_url: (videoUrl || '').trim() || null }
  if (REMOTE) { must(await supabase.from('releases').update(row).eq('id', id).select()); return refresh() }
  Object.assign(db.albums.find((a) => a.id === id), { ...row, videoUrl: row.video_url || '' }); save()
}
export async function updateTrack(admin, id, { title, price, status, lyrics }) {
  requireAdmin(admin)
  if (!(title || '').trim()) throw new Error('Le titre ne peut pas être vide.')
  checkPrice(price, 'par titre')
  const row = { title: title.trim(), price: Number(price), status: cleanStatus(status), lyrics: lyrics || '' }
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


/* ---------- Notifications ---------- */
const SEEN = 'vibestore.seen'
const seenAt = () => { try { return Number(localStorage.getItem(SEEN)) || 0 } catch { return 0 } }
let seen = seenAt()
function addNotification({ title, body, url }) {
  db.notifications.unshift({ id: uid('n-'), title, body: body || '', url: url || '/', at: Date.now() })
}
export function useUnread() {
  useSyncExternalStore(subscribe, () => version)
  return db.notifications.filter((n) => n.at > seen).length
}
export function markSeen() {
  seen = Date.now()
  try { localStorage.setItem(SEEN, String(seen)) } catch {}
  notify()
}
/** Annonce de l'équipe : visible dans l'app, et envoyée en notification aux appareils abonnés. */
export async function announce(admin, { title, body, url }) {
  requireAdmin(admin)
  if (!(title || '').trim()) throw new Error('Écris un titre pour l’annonce.')
  const n = { title: title.trim(), body: (body || '').trim(), url: (url || '/').trim() || '/' }
  if (!REMOTE) { addNotification(n); save(); return { sent: 0 } }
  must(await supabase.from('notifications').insert(n).select())
  await refresh()
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/notify', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify(n) })
    return r.ok ? await r.json() : { sent: 0, error: true }
  } catch { return { sent: 0, error: true } }
}
export const VAPID_PUBLIC_KEY = 'BCmCrRonL3_YMbMa3KGQkahICOR1TuUMzGfTJYT498zgydEOznPfYMqWg0amsoqOn1S3msfLPM8rufxzCSWIMgQ'
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)) }
export function pushSupport() {
  if (!REMOTE) return 'demo'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}
export async function enablePush() {
  const st = pushSupport()
  if (st === 'demo') throw new Error('Disponible avec la vraie base.')
  if (st === 'unsupported') throw new Error('Sur iPhone, ajoute d’abord VibeStore à l’écran d’accueil (Partager > Sur l’écran d’accueil), puis rouvre l’app depuis l’icône.')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error('Notifications refusées. Tu peux les autoriser dans les réglages du navigateur.')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC_KEY) }))
  const j = sub.toJSON()
  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: session ? session.user.id : null },
    { onConflict: 'endpoint', ignoreDuplicates: true })
  if (error) throw new Error(frError(error.message))
  return true
}

/* ---------- Coups de cœur (♥) ---------- */
// Sans compte, les ♥ restent sur l'appareil et rejoignent le compte à la connexion. Connecté : enregistrés dans la base.
const GKEY = 'vibestore.guestlikes'
const guestLikes = () => { try { return JSON.parse(localStorage.getItem(GKEY)) || [] } catch { return [] } }
const setGuestLikes = (a) => { try { localStorage.setItem(GKEY, JSON.stringify(a)) } catch {} }
export function myLikes(d, user) { return user ? d.likes.filter((l) => l.userId === user.id).map((l) => l.trackId) : guestLikes() }
export function likeCount(d, trackId) { return d.likeCounts[trackId] || 0 }
function syncGuestLikesDemo(userId) {
  const g = guestLikes()
  if (!g.length) return
  g.forEach((id) => { if (!db.likes.some((l) => l.userId === userId && l.trackId === id)) { db.likes.push({ userId, trackId: id }) } })
  setGuestLikes([])
}
export async function toggleLike(trackId) {
  const user = REMOTE ? me : db.users.find((u) => u.id === sessionId())
  const n = db.likeCounts[trackId] || 0
  if (!user) {
    const g = guestLikes(); const had = g.includes(trackId)
    setGuestLikes(had ? g.filter((x) => x !== trackId) : [trackId, ...g])
    db.likeCounts = { ...db.likeCounts, [trackId]: Math.max(0, n + (had ? -1 : 1)) }
    save()
    return true
  }
  const had = db.likes.some((l) => l.userId === user.id && l.trackId === trackId)
  if (had) { db.likes = db.likes.filter((l) => !(l.userId === user.id && l.trackId === trackId)); db.likeCounts = { ...db.likeCounts, [trackId]: Math.max(0, n - 1) } }
  else { db.likes = [{ userId: user.id, trackId }, ...db.likes]; db.likeCounts = { ...db.likeCounts, [trackId]: n + 1 } }
  save()
  if (REMOTE) {
    const r = had
      ? await supabase.from('likes').delete().eq('user_id', user.id).eq('track_id', trackId)
      : await supabase.from('likes').insert({ user_id: user.id, track_id: trackId })
    if (r.error) { await refresh(); throw new Error(frError(r.error.message)) }
  }
  return true
}

/** Activation par défaut : au premier geste de la personne (obligatoire sur mobile), on demande l'autorisation
 *  puis on enregistre l'appareil. Si c'est déjà accordé, on vérifie juste l'abonnement. */
export function autoPush() {
  const st = pushSupport()
  if (st !== 'default' && st !== 'granted') return
  let done = false
  const go = () => {
    if (done) return
    done = true
    window.removeEventListener('pointerdown', go)
    setTimeout(() => { enablePush().catch(() => {}) }, st === 'granted' ? 0 : 2500)
  }
  window.addEventListener('pointerdown', go, { once: true })
}


/* ---------- Gestion des artistes : fiche, contrat, versements, demandes ---------- */
export const LINK_KEYS = ['instagram', 'tiktok', 'youtube', 'whatsapp', 'spotify', 'apple', 'youtubemusic', 'deezer', 'boomplay', 'audiomack']
export const PLATFORMS = [['spotify', 'Spotify'], ['apple', 'Apple Music'], ['youtubemusic', 'YouTube Music'], ['deezer', 'Deezer'], ['boomplay', 'Boomplay'], ['audiomack', 'Audiomack']]
export const DISTRIBUTION = [['none', 'Pas de distribution'], ['requested', 'Demandée'], ['progress', 'En cours chez le distributeur'], ['active', 'En ligne sur les plateformes']]
export const PAYOUT_METHODS = [['momo', 'MTN Mobile Money'], ['om', 'Orange Money'], ['virement', 'Virement bancaire'], ['especes', 'Espèces']]
export const REQUEST_KINDS = [['track', 'Ajouter un titre ou une sortie'], ['edit', 'Modifier une information'], ['payout', 'Question sur un versement'], ['distribution', 'Distribution sur les autres plateformes'], ['other', 'Autre demande']]
export function photoUrl(path) {
  if (!path) return null
  if (path.startsWith('data:')) return path
  return REMOTE ? supabase.storage.from('covers').getPublicUrl(path).data.publicUrl : null
}
const fileToDataUrl = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob) })

/** Montants d'un artiste : ventes brutes, part de l'artiste (après commission), déjà versé, reste dû. */
export function artistBalance(d, artistId) {
  const sales = d.purchases.filter((p) => p.artistId === artistId)
  const gross = sales.reduce((t, p) => t + p.amount, 0)
  const net = Math.round(sales.reduce((t, p) => t + p.amount * (1 - p.commissionPct / 100), 0))
  const paid = d.payouts.filter((x) => x.artistId === artistId).reduce((t, x) => t + x.amount, 0)
  return { sales: sales.length, gross, net, paid, due: net - paid }
}
export function artistCommission(d, artistId) {
  const v = d.priv?.[artistId]?.commissionPct
  return v == null ? currentCommission(d) : v
}
export const openRequests = (d) => d.requests.filter((r) => r.status === 'open').length

export async function updateArtistProfile(admin, id, f) {
  requireAdmin(admin)
  const name = (f.name || '').trim()
  if (!name) throw new Error('Le nom ne peut pas être vide.')
  if (db.artists.some((a) => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) throw new Error('Un artiste porte déjà ce nom.')
  const status = ['approved', 'rejected', 'pending'].includes(f.status) ? f.status : 'approved'
  const links = {}
  ;LINK_KEYS.forEach((k) => { const v = (f.links?.[k] || '').trim(); if (v) links[k] = v })
  const row = { name, genre: (f.genre || '').trim(), bio: (f.bio || '').trim(), city: (f.city || '').trim(), links, verified: !!f.verified, status }
  let photoPath
  if (f.photo) {
    const blob = await resizeImage(f.photo)
    if (REMOTE) {
      photoPath = `artists/${id}-${Date.now()}.jpg`
      const up = await supabase.storage.from('covers').upload(photoPath, blob, { contentType: 'image/jpeg', upsert: true })
      if (up.error) throw new Error('Photo non envoyée : ' + frError(up.error.message))
    } else photoPath = await fileToDataUrl(blob)
    row.photo_path = photoPath
  }
  if (REMOTE) { must(await supabase.from('artists').update(row).eq('id', id).select()); return refresh() }
  const a = db.artists.find((x) => x.id === id)
  const { photo_path, ...rest } = row
  Object.assign(a, rest, photo_path ? { photoPath: photo_path } : {}); save()
}
export async function removeArtistPhoto(admin, id) {
  requireAdmin(admin)
  if (REMOTE) { must(await supabase.from('artists').update({ photo_path: null }).eq('id', id).select()); return refresh() }
  db.artists.find((x) => x.id === id).photoPath = ''; save()
}
export async function updateArtistPrivate(admin, id, f) {
  requireAdmin(admin)
  const c = f.commissionPct === '' || f.commissionPct == null ? null : Number(f.commissionPct)
  if (c != null && !(c >= 0 && c <= 60)) throw new Error('La commission doit être comprise entre 0 et 60 %.')
  const row = { payoutMethod: f.payoutMethod || 'momo', payoutNumber: (f.payoutNumber || '').trim(), commissionPct: c, contractStart: f.contractStart || '', distribution: DISTRIBUTION.some(([k]) => k === f.distribution) ? f.distribution : 'none', distributor: (f.distributor || '').trim() }
  if (REMOTE) {
    must(await supabase.from('artist_private').upsert({ artist_id: id, payout_method: row.payoutMethod, payout_number: row.payoutNumber, commission_pct: c, contract_start: row.contractStart || null, distribution: row.distribution, distributor: row.distributor }, { onConflict: 'artist_id' }).select())
    return refresh()
  }
  db.priv[id] = row; save()
}
export async function saveArtistNotes(admin, id, notes) {
  requireAdmin(admin)
  if (REMOTE) { must(await supabase.from('artist_notes').upsert({ artist_id: id, notes: notes || '' }, { onConflict: 'artist_id' }).select()); return refresh() }
  db.notes[id] = notes || ''; save()
}
export async function addPayout(admin, { artistId, amount, method, reference, note }) {
  requireAdmin(admin)
  const n = Math.round(Number(amount))
  if (!(n > 0)) throw new Error('Indique un montant positif.')
  const bal = artistBalance(db, artistId)
  if (n > bal.due && !window.confirm(`Ce versement (${n} FCFA) dépasse le solde dû (${bal.due} FCFA). Continuer ?`)) return
  const row = { artist_id: artistId, amount: n, method: method || 'momo', reference: (reference || '').trim(), note: (note || '').trim() }
  if (REMOTE) { must(await supabase.from('payouts').insert(row).select()); return refresh() }
  db.payouts.unshift({ id: uid('po-'), artistId, amount: n, method: row.method, reference: row.reference, note: row.note, at: Date.now() }); save()
}
export async function deletePayout(admin, id) {
  requireAdmin(admin)
  if (REMOTE) { must(await supabase.from('payouts').delete().eq('id', id).select()); return refresh() }
  db.payouts = db.payouts.filter((x) => x.id !== id); save()
}
export async function sendRequest(user, { kind, message }) {
  const a = myArtist(db, user)
  if (!a) throw new Error('Réservé aux artistes.')
  const text = (message || '').trim()
  if (text.length < 3) throw new Error('Écris ta demande.')
  const k = REQUEST_KINDS.some(([x]) => x === kind) ? kind : 'other'
  if (REMOTE) { must(await supabase.from('artist_requests').insert({ artist_id: a.id, kind: k, message: text }).select()); return refresh() }
  db.requests.unshift({ id: uid('rq-'), artistId: a.id, kind: k, message: text, status: 'open', reply: '', at: Date.now() }); save()
}
export async function resolveRequest(admin, id, { reply, status }) {
  requireAdmin(admin)
  const st = status === 'open' ? 'open' : 'done'
  if (REMOTE) { must(await supabase.from('artist_requests').update({ status: st, reply: (reply || '').trim() }).eq('id', id).select()); return refresh() }
  Object.assign(db.requests.find((r) => r.id === id), { status: st, reply: (reply || '').trim() }); save()
}
/** Modifier l'email d'invitation d'un artiste qui n'a pas encore créé son compte. */
export async function updateInviteEmail(admin, artistId, email) {
  requireAdmin(admin)
  const e = (email || '').trim().toLowerCase()
  if (!e.includes('@')) throw new Error('Entre un email valide.')
  if (!REMOTE) throw new Error('Disponible avec la vraie base.')
  const r = await supabase.from('artist_invites').upsert({ artist_id: artistId, email: e }, { onConflict: 'artist_id' }).select()
  if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Cet email est déjà utilisé par un autre artiste.' : frError(r.error.message))
  return refresh()
}
export async function cancelInvite(admin, artistId) {
  requireAdmin(admin)
  if (!REMOTE) throw new Error('Disponible avec la vraie base.')
  must(await supabase.from('artist_invites').delete().eq('artist_id', artistId).select())
  return refresh()
}
export function inviteMessage(artist, email) {
  const url = typeof window !== 'undefined' ? window.location.origin : 'https://vibestore-distr.store'
  return `Bonjour ${artist.name},\nVibeStore a préparé ta fiche d’artiste. Pour activer ton studio :\n1. Ouvre ${url}/compte\n2. Clique sur « Pas encore de compte ? Inscris-toi »\n3. Utilise exactement cet email : ${email}\n4. Confirme ton email, puis connecte-toi.\nTu y suivras tes écoutes, tes ♥ et tes ventes. À très vite !`
}

/* ---------- Inscrits : liste et moderation (admin) ---------- */
export function memberList(d) {
  const src = d.members?.length ? d.members : d.users
  return src.map((m) => ({ id: m.id, name: m.name || '—', email: m.email || '', city: m.city || '', role: m.role, blocked: !!m.blocked, blockedReason: m.blockedReason || '', createdAt: m.createdAt }))
}
export async function setMemberBlocked(admin, id, blocked, reason = '') {
  requireAdmin(admin)
  if (id === admin.id) throw new Error('Tu ne peux pas suspendre ton propre compte.')
  const target = memberList(db).find((m) => m.id === id)
  if (!target) throw new Error('Compte introuvable.')
  if (target.role === 'admin') throw new Error('Un compte équipe ne peut pas être suspendu.')
  reason = (reason || '').trim().slice(0, 200)
  if (REMOTE) {
    must(await supabase.from('profiles').update({ blocked: !!blocked, blocked_reason: blocked ? reason : '' }).eq('id', id).select())
    await refresh()
    return
  }
  const u = db.users.find((x) => x.id === id)
  if (u) { u.blocked = !!blocked; u.blockedReason = blocked ? reason : '' }
  save()
}

/** Changer l'email d'un artiste : invitation (avant inscription) ou compte actif (via le serveur). */
export async function changeArtistEmail(admin, artistId, email) {
  requireAdmin(admin)
  const e = (email || '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('Entre un email valide.')
  const a = db.artists.find((x) => x.id === artistId)
  if (!a) throw new Error('Artiste introuvable.')
  if (!REMOTE) {
    if (db.users.some((u) => u.email === e && u.id !== a.userId)) throw new Error('Cet email est déjà utilisé.')
    const u = db.users.find((x) => x.id === a.userId)
    if (u) u.email = e
    save()
    return
  }
  if (a.account !== 'active') return updateInviteEmail(admin, artistId, e)
  const r = await supabase.rpc('admin_set_artist_email', { p_artist: artistId, p_email: e })
  if (r.error) throw new Error(/duplicate|unique/i.test(r.error.message) ? 'Cet email est déjà utilisé par un autre compte.' : frError(r.error.message))
  await refresh()
}

/** Paiement réel : lance la demande sur le téléphone du client puis attend la validation (jusqu'à ~3 min). */
export async function payLive(user, cartItems, methodId, phone, onStatus = () => {}) {
  if (!user) throw new Error('Connecte-toi pour acheter.')
  const { data: { session } } = await supabase.auth.getSession()
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
  let r
  try { r = await fetch('/api/pay', { method: 'POST', headers: H, body: JSON.stringify({ items: cartItems, method: methodId, phone }) }) } catch { throw new Error('Connexion impossible. Vérifie ton réseau.') }
  const raw = await r.text().catch(() => '')
  let j = {}
  try { j = JSON.parse(raw) } catch {}
  if (!r.ok) throw new Error(j.error || `Le paiement n’a pas pu démarrer (erreur ${r.status}${raw && !j.error ? ' : ' + raw.replace(/<[^>]+>/g, ' ').trim().slice(0, 120) : ''}).`)
  onStatus('pending', j.total)
  let status = j.status
  for (let i = 0; i < 60 && status === 'pending'; i++) {
    await new Promise((res) => setTimeout(res, 3000))
    try {
      const s = await fetch(`/api/pay-status?ref=${encodeURIComponent(j.ref)}`, { headers: H })
      if (s.ok) status = (await s.json()).status
    } catch { /* on réessaie */ }
  }
  if (status === 'paid') { await refresh(); return true }
  if (status === 'failed') throw new Error('Paiement refusé ou annulé. Aucun montant n’a été débité.')
  throw new Error('Pas de validation reçue. Si ton compte a été débité, écris-nous : la commande sera vérifiée.')
}


/* ---------- Promos (publicités de marque, ex. Blue Energy) : rien à vendre ---------- */
const mapPromo = (r) => ({ id: r.id, title: r.title, brand: r.brand || 'Blue Energy', videoUrl: r.video_url, ctaLabel: r.cta_label || '', ctaUrl: r.cta_url || '', active: !!r.active, views: Number(r.views) || 0, createdAt: ms(r.created_at) })
export const activePromos = (d) => (d.promos || []).filter((p) => p.active)
const seenPromo = new Set()
/** Compte une vue par promo et par visite (anonyme). */
export function trackPromoView(id) {
  if (!id || seenPromo.has(id)) return
  seenPromo.add(id)
  if (REMOTE) { supabase.rpc('promo_view', { p_id: id }).then(() => {}, () => {}); return }
  const p = db.promos.find((x) => x.id === id); if (p) { p.views = (p.views || 0) + 1; save() }
}
export async function createPromo(admin, { title, brand, videoUrl, videoFile, ctaLabel, ctaUrl }) {
  requireAdmin(admin)
  if (!title || !title.trim()) throw new Error('Donne un titre à la publicité.')
  let video = (videoUrl || '').trim()
  const id = uid('pr-')
  if (REMOTE && videoFile) {
    const ext = (videoFile.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4'
    const up = await supabase.storage.from('videos').upload(`promo-${id}.${ext}`, videoFile, { contentType: videoFile.type || 'video/mp4', upsert: true })
    if (up.error) throw new Error(/exceeded|too large|size/i.test(up.error.message) ? 'Vidéo trop lourde (50 Mo maximum). Utilise plutôt un lien YouTube.' : 'Envoi de la vidéo impossible : ' + frError(up.error.message))
    video = supabase.storage.from('videos').getPublicUrl(`promo-${id}.${ext}`).data.publicUrl
  } else if (videoFile) video = URL.createObjectURL(videoFile)
  if (!video) throw new Error('Ajoute une vidéo : lien YouTube ou fichier MP4.')
  const row = { title: title.trim(), brand: (brand || 'Blue Energy').trim(), video_url: video, cta_label: (ctaLabel || '').trim() || null, cta_url: (ctaUrl || '').trim() || null, active: true }
  if (REMOTE) { must(await supabase.from('promos').insert(row).select()); return refresh() }
  db.promos.unshift(mapPromo({ id, ...row, views: 0, created_at: new Date().toISOString() })); save()
}
export async function setPromoActive(admin, id, active) {
  requireAdmin(admin)
  if (REMOTE) { must(await supabase.from('promos').update({ active }).eq('id', id).select()); return refresh() }
  Object.assign(db.promos.find((x) => x.id === id), { active }); save()
}
export async function deletePromo(admin, id) {
  requireAdmin(admin)
  if (REMOTE) { must(await supabase.from('promos').delete().eq('id', id).select()); return refresh() }
  db.promos = db.promos.filter((x) => x.id !== id); save()
}
