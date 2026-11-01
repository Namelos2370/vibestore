import { useMemo, useState } from 'react'
import { catalog, fcfa, likeCount, currentCommission } from '../lib/store'

const DAY = 86400000
const PERIODS = [[7, '7 jours'], [30, '30 jours'], [0, 'Tout']]

export function Bars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.v))
  return (
    <div className="bars" role="img" aria-label="Chiffre d’affaires par jour">
      {data.map((d, i) => (
        <div key={i} className="barcol" title={`${d.label} : ${fcfa(d.v)}`}>
          <i style={{ height: Math.max(d.v ? 6 : 2, (d.v / max) * 100) + '%' }} className={d.v ? 'on' : ''} />
          {(i === 0 || i === data.length - 1 || data.length <= 8) && <small>{d.label}</small>}
        </div>
      ))}
    </div>
  )
}

export default function AdminOverview({ db, go }) {
  const [days, setDays] = useState(30)
  const { tracks, albums } = catalog(db)
  const now = Date.now()
  const since = days ? now - days * DAY : 0

  const v = useMemo(() => {
    const sales = db.purchases.filter((p) => p.at >= since)
    const gross = sales.reduce((t, p) => t + p.amount, 0)
    const fee = sales.reduce((t, p) => t + (p.amount * p.commissionPct) / 100, 0)
    const members = db.members?.length ? db.members : db.users
    const newMembers = members.filter((m) => m.createdAt >= since).length
    const listeners = members.filter((m) => m.role === 'listener').length
    const plays = db.tracks.reduce((t, x) => t + (x.plays || 0), 0)
    const likes = db.tracks.reduce((t, x) => t + likeCount(db, x.id), 0)
    // ventes par jour
    const n = days || 30
    const series = Array.from({ length: n }, (_, i) => {
      const d = new Date(now - (n - 1 - i) * DAY)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return { label: d.getDate() + '/' + (d.getMonth() + 1), v: db.purchases.filter((p) => p.at >= start && p.at < start + DAY).reduce((t, p) => t + p.amount, 0) }
    })
    const artistRows = db.artists.map((a) => {
      const ts = db.tracks.filter((t) => t.artistId === a.id)
      const as = db.purchases.filter((p) => p.artistId === a.id && p.at >= since)
      return { a, plays: ts.reduce((t, x) => t + (x.plays || 0), 0), likes: ts.reduce((t, x) => t + likeCount(db, x.id), 0), sales: as.length, rev: as.reduce((t, p) => t + p.amount, 0) }
    }).sort((x, y) => (y.plays + 3 * y.likes + y.sales * 10) - (x.plays + 3 * x.likes + x.sales * 10)).slice(0, 5)
    const trackRows = [...db.tracks].map((t) => ({ t, likes: likeCount(db, t.id), sales: db.purchases.filter((p) => p.itemType === 'track' && p.itemId === t.id).length }))
      .sort((x, y) => ((y.t.plays || 0) + 3 * y.likes) - ((x.t.plays || 0) + 3 * x.likes)).slice(0, 5)
    return { sales, gross, fee, newMembers, listeners, plays, likes, series, artistRows, trackRows }
  }, [db, since, days]) // eslint-disable-line

  const todo = []
  const noAudio = db.tracks.filter((t) => !t.audioPath && !t.audioName)
  if (noAudio.length) todo.push({ k: 'a', text: `${noAudio.length} titre(s) sans fichier audio : ils jouent un son de test.`, tab: 'artistes' })
  const invited = db.artists.filter((a) => a.account === 'invited')
  if (invited.length) todo.push({ k: 'i', text: `${invited.length} artiste(s) invité(s) ne se sont pas encore connectés : ${invited.slice(0, 3).map((a) => a.name).join(', ')}${invited.length > 3 ? '…' : ''}.`, tab: 'artistes' })
  const hidden = albums.length !== db.albums.length ? db.albums.length - albums.length : 0
  if (hidden > 0) todo.push({ k: 'h', text: `${hidden} sortie(s) masquée(s) du catalogue.`, tab: 'artistes' })
  if (!db.albums.some((a) => a.videoUrl)) todo.push({ k: 'c', text: 'Aucun clip ajouté : la page Blue Energy Sessions est vide.', tab: 'artistes' })
  if (!db.artists.length) todo.push({ k: 'z', text: 'Aucun artiste : commence par créer un compte artiste.', tab: 'artistes' })
  if (db.settings.paymentMethods.some((m) => m.enabled)) todo.push({ k: 'p', text: 'Le paiement est encore simulé : branche un vrai opérateur avant d’ouvrir au public.', tab: 'reglages' })

  const nameOf = (p) => (p.itemType === 'album' ? db.albums : db.tracks).find((x) => x.id === p.itemId)?.title || '—'
  const artistOf = (id) => db.artists.find((a) => a.id === id)?.name || '—'
  const recent = [...db.purchases].sort((a, b) => b.at - a.at).slice(0, 5)

  return (
    <>
      <div className="row wrap between">
        <div className="tabs small" role="group" aria-label="Période">
          {PERIODS.map(([d, l]) => <button key={d} type="button" className={'tab' + (days === d ? ' on' : '')} onClick={() => setDays(d)}>{l}</button>)}
        </div>
        <div className="row">
          <button className="btn small buy" type="button" onClick={() => go('artistes')}>+ Artiste ou sortie</button>
          <button className="btn small ghost" type="button" onClick={() => go('annonces')}>Annonce</button>
        </div>
      </div>

      <div className="stats">
        <div className="stat hi"><span>Chiffre d’affaires</span><b>{fcfa(v.gross)}</b></div>
        <div className="stat"><span>Commission VibeStore</span><b>{fcfa(Math.round(v.fee))}</b></div>
        <div className="stat"><span>Ventes</span><b>{v.sales.length}</b></div>
        <div className="stat"><span>Nouveaux inscrits</span><b>{v.newMembers}</b></div>
      </div>
      <div className="stats">
        <div className="stat"><span>Auditeurs inscrits</span><b>{v.listeners}</b></div>
        <div className="stat"><span>Artistes</span><b>{db.artists.length}</b></div>
        <div className="stat"><span>Titres en ligne</span><b>{db.tracks.length}</b></div>
        <div className="stat"><span>Écoutes · ♥</span><b>{v.plays} · {v.likes}</b></div>
      </div>
      <p className="muted small">Commission appliquée aujourd’hui : {currentCommission(db)} %. Les chiffres de ventes suivent la période choisie ; les écoutes et ♥ sont des totaux.</p>

      <section className="panel">
        <h2>Ventes par jour</h2>
        <Bars data={v.series} />
      </section>

      <div className="twocol">
        <section className="panel">
          <h2>À traiter</h2>
          {todo.length ? <ul className="plain todo">{todo.map((x) => <li key={x.k}><button className="linkbtn" type="button" onClick={() => go(x.tab)}>{x.text}</button></li>)}</ul> : <p className="ok">Tout est en ordre.</p>}
        </section>
        <section className="panel">
          <h2>Dernières ventes</h2>
          {recent.length ? <ul className="tracks">{recent.map((p) => (
            <li key={p.id} className="track simple"><div className="tmeta"><b>{nameOf(p)}</b><span>{artistOf(p.artistId)} · {new Date(p.at).toLocaleDateString('fr-FR')}</span></div><span className="price">{fcfa(p.amount)}</span></li>
          ))}</ul> : <p className="muted">Aucune vente pour le moment.</p>}
        </section>
      </div>

      <div className="twocol">
        <section className="panel">
          <h2>Top artistes</h2>
          {v.artistRows.length ? <ol className="rank">{v.artistRows.map((r) => <li key={r.a.id}><b>{r.a.name}</b><span>{r.plays} écoutes · ♥ {r.likes} · {r.sales} vente(s) · {fcfa(r.rev)}</span></li>)}</ol> : <p className="muted">Pas encore d’artiste.</p>}
        </section>
        <section className="panel">
          <h2>Top titres</h2>
          {v.trackRows.length ? <ol className="rank">{v.trackRows.map((r) => <li key={r.t.id}><b>{r.t.title}</b><span>{artistOf(r.t.artistId)} · {r.t.plays || 0} écoutes · ♥ {r.likes} · {r.sales} vente(s)</span></li>)}</ol> : <p className="muted">Pas encore de titre.</p>}
        </section>
      </div>
    </>
  )
}
