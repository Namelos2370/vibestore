import { useMemo, useState } from 'react'
import { catalog, fcfa, likeCount, currentCommission, livePayments, isClip, purchaseMedia } from '../lib/store'
import { Icon, Verified } from '../components/Icon'

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

const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
function Delta({ cur, prev }) {
  const d = pct(cur, prev)
  if (d === null) return <small className="delta flat">{prev === 0 && cur > 0 ? 'nouveau' : '—'}</small>
  return <small className={'delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : 'flat')}>{d > 0 ? <Icon name="arrowUp" size={12} /> : d < 0 ? <Icon name="arrowDown" size={12} /> : null}{d > 0 ? '+' : ''}{d} %</small>
}
function Kpi({ label, value, cur, prev, hi }) {
  return (
    <div className={'stat kpi' + (hi ? ' hi' : '')}>
      <span>{label}</span>
      <b>{value}</b>
      {prev !== undefined ? <Delta cur={cur} prev={prev} /> : <small className="delta flat">&nbsp;</small>}
    </div>
  )
}

export default function AdminOverview({ db, go }) {
  const [days, setDays] = useState(30)
  const { albums } = catalog(db)
  const now = Date.now()
  const since = days ? now - days * DAY : 0
  const prevSince = days ? since - days * DAY : 0

  const v = useMemo(() => {
    const inP = (p) => p.at >= since
    const inPrev = (p) => days && p.at >= prevSince && p.at < since
    const sales = db.purchases.filter(inP)
    const prevSales = db.purchases.filter(inPrev)
    const sum = (arr) => arr.reduce((t, p) => t + p.amount, 0)
    const feeOf = (arr) => arr.reduce((t, p) => t + (p.amount * p.commissionPct) / 100, 0)
    const gross = sum(sales), prevGross = sum(prevSales)
    const fee = feeOf(sales), prevFee = feeOf(prevSales)
    const members = db.members?.length ? db.members : db.users
    const newMembers = members.filter((m) => m.createdAt >= since).length
    const prevNew = days ? members.filter((m) => m.createdAt >= prevSince && m.createdAt < since).length : 0
    const totalMembers = members.filter((m) => m.role === 'listener').length
    const n = days || 30
    const series = Array.from({ length: n }, (_, i) => {
      const d = new Date(now - (n - 1 - i) * DAY)
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return { label: d.getDate() + '/' + (d.getMonth() + 1), v: db.purchases.filter((p) => p.at >= start && p.at < start + DAY).reduce((t, p) => t + p.amount, 0) }
    })
    // sons / clips
    const split = ['sound', 'clip'].map((m) => {
      const ts = db.tracks.filter((t) => (m === 'clip') === isClip(t))
      const ps = sales.filter((p) => purchaseMedia(db, p) === m)
      return { m, titles: ts.length, plays: ts.reduce((t, x) => t + (x.plays || 0), 0), likes: ts.reduce((t, x) => t + likeCount(db, x.id), 0), sales: ps.length, rev: sum(ps) }
    })
    const artistRows = db.artists.map((a) => {
      const ts = db.tracks.filter((t) => t.artistId === a.id)
      const as = sales.filter((p) => p.artistId === a.id)
      return { a, plays: ts.reduce((t, x) => t + (x.plays || 0), 0), likes: ts.reduce((t, x) => t + likeCount(db, x.id), 0), sales: as.length, rev: sum(as) }
    }).sort((x, y) => (y.plays + 3 * y.likes + y.sales * 10) - (x.plays + 3 * x.likes + x.sales * 10)).slice(0, 5)
    const trackRows = [...db.tracks].map((t) => ({ t, likes: likeCount(db, t.id), sales: db.purchases.filter((p) => p.itemType === 'track' && p.itemId === t.id).length }))
      .sort((x, y) => ((y.t.plays || 0) + 3 * y.likes) - ((x.t.plays || 0) + 3 * x.likes)).slice(0, 5)
    return { sales, gross, prevGross, fee, prevFee, prevSalesN: prevSales.length, newMembers, prevNew, totalMembers, series, split, artistRows, trackRows }
  }, [db, since, prevSince, days]) // eslint-disable-line

  const [sounds, clips] = v.split
  const totalRev = Math.max(1, sounds.rev + clips.rev)
  const todo = []
  const noAudio = db.tracks.filter((t) => !t.audioPath && !t.audioName)
  if (noAudio.length) todo.push({ k: 'a', text: `${noAudio.length} titre(s) sans fichier : ils jouent un son de test.`, tab: 'sons' })
  const invited = db.artists.filter((a) => a.account === 'invited')
  if (invited.length) todo.push({ k: 'i', text: `${invited.length} artiste(s) invité(s) ne se sont pas encore connectés : ${invited.slice(0, 3).map((a) => a.name).join(', ')}${invited.length > 3 ? '…' : ''}.`, tab: 'artistes' })
  const hidden = albums.length !== db.albums.length ? db.albums.length - albums.length : 0
  if (hidden > 0) todo.push({ k: 'h', text: `${hidden} sortie(s) masquée(s) du catalogue.`, tab: 'sons' })
  if (!clips.titles) todo.push({ k: 'c', text: 'Aucun clip en ligne : l’espace Clips est vide.', tab: 'clips' })
  if (!sounds.titles) todo.push({ k: 's', text: 'Aucun son en ligne : publie le premier.', tab: 'sons' })
  if (!db.artists.length) todo.push({ k: 'z', text: 'Aucun artiste : commence par créer un compte artiste.', tab: 'artistes' })
  const open = db.requests.filter((r) => r.status === 'open').length
  if (open) todo.push({ k: 'r', text: `${open} demande(s) d’artiste à traiter.`, tab: 'demandes' })
  if (!livePayments(db) && db.settings.paymentMethods.some((m) => m.enabled)) todo.push({ k: 'p', text: 'Le paiement est encore simulé : active le paiement réel avant d’ouvrir au public.', tab: 'reglages' })

  const nameOf = (p) => (p.itemType === 'album' ? db.albums : db.tracks).find((x) => x.id === p.itemId)?.title || '—'
  const artistOf = (id) => db.artists.find((a) => a.id === id)?.name || '—'
  const recent = [...db.purchases].sort((a, b) => b.at - a.at).slice(0, 5)
  const label = days ? `${days} derniers jours` : 'depuis le début'

  return (
    <>
      <header className="ovhead">
        <div>
          <span className="eyebrow">Vue d’ensemble</span>
          <p className="muted small">Chiffres {label}{days ? ', comparés aux ' + days + ' jours précédents' : ''}.</p>
        </div>
        <div className="seg" role="group" aria-label="Période">
          {PERIODS.map(([d, l]) => <button key={d} type="button" aria-pressed={days === d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}
        </div>
      </header>
      <div className="quick" role="group" aria-label="Actions rapides">
        <button type="button" className="qa main" onClick={() => go('sons')}><b>+ Son</b><small>Publier un son</small></button>
        <button type="button" className="qa main" onClick={() => go('clips')}><b>+ Clip</b><small>Publier un clip</small></button>
        <button type="button" className="qa" onClick={() => go('artistes')}><b>+ Artiste</b><small>Créer un compte</small></button>
        <button type="button" className="qa" onClick={() => go('annonces')}><b>Annonce</b><small>Notifier les fans</small></button>
      </div>

      <div className="stats">
        <Kpi hi label="Chiffre d’affaires" value={fcfa(v.gross)} cur={v.gross} prev={days ? v.prevGross : undefined} />
        <Kpi label="Commission VibeStore" value={fcfa(Math.round(v.fee))} cur={v.fee} prev={days ? v.prevFee : undefined} />
        <Kpi label="Ventes" value={v.sales.length} cur={v.sales.length} prev={days ? v.prevSalesN : undefined} />
        <Kpi label="Nouveaux inscrits" value={v.newMembers} cur={v.newMembers} prev={days ? v.prevNew : undefined} />
      </div>
      <div className="stats">
        <Kpi label="Artistes" value={db.artists.length} />
        <Kpi label="Sons en ligne" value={sounds.titles} />
        <Kpi label="Clips en ligne" value={clips.titles} />
        <Kpi label="Auditeurs inscrits" value={v.totalMembers} />
      </div>
      <p className="muted small">Commission appliquée aujourd’hui : {currentCommission(db)} %. Les écoutes et j’aime sont des totaux ; les ventes suivent la période choisie.</p>

      <section className="panel">
        <h2>Ventes par jour</h2>
        <Bars data={v.series} />
      </section>

      <section className="panel">
        <h2>Sons et clips</h2>
        <div className="splitbar" role="img" aria-label={`Part du chiffre d’affaires : sons ${Math.round((sounds.rev / totalRev) * 100)} %, clips ${Math.round((clips.rev / totalRev) * 100)} %`}>
          <i className="s" style={{ width: (sounds.rev / totalRev) * 100 + '%' }} /><i className="c" style={{ width: (clips.rev / totalRev) * 100 + '%' }} />
        </div>
        <div className="twocol">
          {[[sounds, 'Sons', 's'], [clips, 'Clips', 'c']].map(([x, name, cls]) => (
            <div key={x.m} className={'mediacard ' + cls}>
              <h3>{name}</h3>
              <b className="big">{fcfa(x.rev)}</b>
              <span className="muted small">{x.sales} vente(s) {days ? 'sur la période' : 'au total'}</span>
              <ul className="plain mini">
                <li>{x.titles} en ligne</li><li>{x.plays} écoutes</li><li>{x.likes} j’aime</li>
              </ul>
              <button className="btn small ghost" type="button" onClick={() => go(x.m === 'clip' ? 'clips' : 'sons')}>Gérer</button>
            </div>
          ))}
        </div>
      </section>

      <div className="twocol">
        <section className="panel">
          <h2>À traiter</h2>
          {todo.length ? <ul className="plain todo">{todo.map((x) => <li key={x.k}><button className="linkbtn" type="button" onClick={() => go(x.tab)}>{x.text}</button></li>)}</ul> : <p className="ok">Tout est en ordre.</p>}
        </section>
        <section className="panel">
          <h2>Dernières ventes</h2>
          {recent.length ? <ul className="tracks">{recent.map((p) => (
            <li key={p.id} className="track simple"><div className="tmeta"><b>{purchaseMedia(db, p) === 'clip' ? '' : ''}{nameOf(p)}</b><span>{artistOf(p.artistId)} · {new Date(p.at).toLocaleDateString('fr-FR')}</span></div><span className="price">{fcfa(p.amount)}</span></li>
          ))}</ul> : <p className="muted">Aucune vente pour le moment.</p>}
        </section>
      </div>

      <div className="twocol">
        <section className="panel">
          <h2>Top artistes</h2>
          {v.artistRows.length ? <ol className="rank">{v.artistRows.map((r) => <li key={r.a.id}><b>{r.a.name}</b><span>{r.plays} écoutes · {r.likes} j’aime · {r.sales} vente(s) · {fcfa(r.rev)}</span></li>)}</ol> : <p className="muted">Pas encore d’artiste.</p>}
        </section>
        <section className="panel">
          <h2>Top titres</h2>
          {v.trackRows.length ? <ol className="rank">{v.trackRows.map((r) => <li key={r.t.id}><b>{r.t.title}</b><span>{artistOf(r.t.artistId)} · {r.t.plays || 0} écoutes · {r.likes} j’aime · {r.sales} vente(s)</span></li>)}</ol> : <p className="muted">Pas encore de titre.</p>}
        </section>
      </div>
    </>
  )
}
