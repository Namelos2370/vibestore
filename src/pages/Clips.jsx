import { useMemo, useState } from 'react'
import { useDb, catalog, likeCount, activePromos, trackPromoView } from '../lib/store'
import { ClipCard, Empty, MediaSwitch, PromoCard } from '../components/ui'

// Espace des clips : séparé des sons (page Explorer).
export default function Clips() {
  const db = useDb()
  const { clips } = catalog(db)
  const [q, setQ] = useState('')
  const s = q.trim().toLowerCase()
  const score = (t) => (t.plays || 0) + 3 * likeCount(db, t.id)
  const list = useMemo(() => clips.filter((t) => !s || (t.title + ' ' + t.artist.name).toLowerCase().includes(s)), [clips, s])
  const promos = activePromos(db)
  const withPromos = (arr) => { if (s || !promos.length) return arr.map((t) => ({ t })); const o = []; let k = 0; arr.forEach((t, i) => { o.push({ t }); if ((i + 1) % 4 === 0) o.push({ p: promos[k++ % promos.length] }) }); if (arr.length && arr.length < 4) o.push({ p: promos[0] }); return o }
  const popular = [...list].sort((a, b) => score(b) - score(a))
  const fresh = [...list].sort((a, b) => (b.album.createdAt || 0) - (a.album.createdAt || 0))
  return (
    <>
      <h1 className="h1">Clips</h1>
      <MediaSwitch />
      <p className="muted">Les clips des artistes. Écoute gratuitement un extrait de 30 s, puis achète le clip pour le regarder en entier et le télécharger.</p>
      <label className="field">
        <span>Rechercher un clip ou un artiste</span>
        <input id="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex. nom du clip, artiste…" />
      </label>
      {list.length === 0 ? <Empty>{clips.length ? 'Aucun clip trouvé.' : 'Les premiers clips arrivent bientôt.'}</Empty> : (
        <>
          <section><h2>{s ? 'Résultats' : 'Clips populaires'}</h2><div className="clipgrid">{withPromos(popular).map((x, i) => x.p ? <PromoCard key={'p' + i} p={x.p} onView={trackPromoView} /> : <ClipCard key={x.t.id} t={x.t} />)}</div></section>
          {!s && fresh.length > 3 && <section><h2>Nouveautés</h2><div className="clipgrid">{fresh.slice(0, 6).map((t) => <ClipCard key={t.id} t={t} />)}</div></section>}
        </>
      )}
    </>
  )
}
