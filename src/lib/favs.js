// Favoris : enregistrés dans l'appareil (localStorage) pour l'instant.
import { useSyncExternalStore } from 'react'
const KEY = 'vibestore.favs.v1'
let favs = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } })()
const subs = new Set()
export function toggleFav(id) {
  favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]
  try { localStorage.setItem(KEY, JSON.stringify(favs)) } catch {}
  subs.forEach((f) => f())
}
export function useFavs() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => favs)
}
