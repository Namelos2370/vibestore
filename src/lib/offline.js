// Écoute hors ligne : les sons achetés sont copiés dans le téléphone (Cache API) et se lisent sans réseau.
import { useSyncExternalStore } from 'react'

const CACHE = 'vibestore-offline-v1'
const keyOf = (id) => `/offline/audio/${id}`
const subs = new Set()
let ids = new Set()
let version = 0
const urls = new Map()
const busy = new Set()
const supported = () => typeof caches !== 'undefined'
const notify = () => { version++; subs.forEach((f) => f()) }

async function reload() {
  if (!supported()) return
  try {
    const c = await caches.open(CACHE)
    const ks = await c.keys()
    ids = new Set(ks.map((r) => new URL(r.url).pathname.split('/').pop()))
    notify()
  } catch {}
}
reload()

export function useOffline() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => version)
  return { ids, busy, supported: supported() }
}

export const isOffline = (id) => ids.has(id)

/** Adresse locale d'un son enregistré (null s'il ne l'est pas). */
export async function offlineUrl(id) {
  if (!supported() || !ids.has(id)) return null
  if (urls.has(id)) return urls.get(id)
  const c = await caches.open(CACHE)
  const r = await c.match(keyOf(id))
  if (!r) return null
  const u = URL.createObjectURL(await r.blob())
  urls.set(id, u)
  return u
}

/** Enregistre un son dans le téléphone. `getUrl` renvoie l'adresse du fichier complet. */
export async function saveOffline(id, getUrl) {
  if (!supported()) throw new Error('Ce navigateur ne permet pas l’écoute hors ligne.')
  if (busy.has(id)) return
  busy.add(id); notify()
  try {
    const res = await fetch(await getUrl())
    if (!res.ok) throw new Error('Téléchargement impossible, vérifie ta connexion.')
    const blob = await res.blob()
    const c = await caches.open(CACHE)
    await c.put(keyOf(id), new Response(blob, { headers: { 'Content-Type': blob.type || 'audio/mpeg' } }))
    ids = new Set(ids).add(id)
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist() } catch {}
  } finally { busy.delete(id); notify() }
}

export async function removeOffline(id) {
  if (!supported()) return
  const c = await caches.open(CACHE)
  await c.delete(keyOf(id))
  if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id) }
  ids = new Set([...ids].filter((x) => x !== id)); notify()
}

/** À la déconnexion : on ne laisse pas les fichiers d'un compte sur un téléphone partagé. */
export async function clearOffline() {
  if (!supported()) return
  try { await caches.delete(CACHE) } catch {}
  urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear()
  ids = new Set(); notify()
}
