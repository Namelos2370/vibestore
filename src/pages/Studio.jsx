import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useDb, useUser, myArtist, fcfa, likeCount, artistBalance, artistCommission, photoUrl, sendRequest, REQUEST_KINDS, PAYOUT_METHODS, DISTRIBUTION, isClip } from '../lib/store'
import { Bars } from './AdminOverview'
import { Empty } from '../components/ui'
import { Icon, Verified } from '../components/Icon'

const DAY = 86400000
const dt = (t) => new Date(t).toLocaleDateString('fr-FR')
const methodLabel = (id) => (PAYOUT_METHODS.find(([k]) => k === id) || [0, id])[1]

function RequestForm({ user }) {
  const [f, setF] = useState({ kind: 'track', message: '' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  async function submit(e) {
    e.preventDefault(); setErr(''); setOk('')
    try { await sendRequest(user, f); setF({ ...f, message: '' }); setOk('Demande envoyée à l’équipe VibeStore.') } catch (x) { setErr(x.message) }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Écrire à l’équipe VibeStore</h2>
      <p className="muted small">Nouveau titre, correction d’une information, question sur un versement : nous répondons ici.</p>
      <label className="field"><span>Sujet</span>
        <select id="rqkind" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{REQUEST_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <label className="field"><span>Ta demande</span><textarea id="rqmsg" rows="3" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></label>
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      <button className="btn buy" type="submit">Envoyer la demande</button>
    </form>
  )
}

const STUDIO_TABS = [['resume', 'Résumé'], ['catalogue', 'Catalogue'], ['revenus', 'Revenus'], ['messages', 'Messages']]

// Studio artiste en lecture seule : le compte et les titres sont ajoutés par VibeStore.
export default function Studio() {
  const db = useDb()
  const user = useUser()
  const [tab, setTab] = useState('resume')
  if (!user) return <Navigate to="/compte" replace />
  if (user.role !== 'artist') return <Empty>Cet espace est réservé aux artistes. Les comptes artistes sont créés par l’équipe VibeStore.</Empty>
  const artist = myArtist(db, user)
  if (!artist) return <Empty>Profil artiste introuvable. Contacte VibeStore.</Empty>

  const pct = artistCommission(db, artist.id)
  const bal = artistBalance(db, artist.id)
  const photo = photoUrl(artist.photoPath)
  const priv = db.priv[artist.id]
  const payouts = db.payouts.filter((x) => x.artistId === artist.id)
  const reqs = db.requests.filter((r) => r.artistId === artist.id)
  const releases = db.albums.filter((a) => a.artistId === artist.id)
  const tracks = db.tracks.filter((t) => t.artistId === artist.id)
  const sales = db.purchases.filter((p) => p.artistId === artist.id)
  const plays = tracks.reduce((s, t) => s + (t.plays || 0), 0)
  const likes = tracks.reduce((s, t) => s + likeCount(db, t.id), 0)
  const salesOf = (t) => sales.filter((p) => p.itemType === 'track' && p.itemId === t.id).length
  const now = Date.now()
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now - (29 - i) * DAY); const st = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    return { label: d.getDate() + '/' + (d.getMonth() + 1), v: sales.filter((p) => p.at >= st && p.at < st + DAY).reduce((t, p) => t + p.amount, 0) }
  })

  return (
    <>
      <span className="eyebrow">Espace artiste</span>
      <div className="artisthead">
        {photo && <img className="avatar" src={photo} alt="" width="72" height="72" />}
        <h1 className="h1">Studio de {artist.name}{artist.verified && <Verified />}</h1>
      </div>

      <div className="tabs2" role="tablist">
        {STUDIO_TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
            {l}{k === 'messages' && reqs.some((r) => r.status === 'open') ? <i className="dot" aria-label="demande en cours" /> : null}
          </button>
        ))}
      </div>

      {tab === 'resume' && <>
      <div className="infobox">
        <div>
          <b>VibeStore gère ton catalogue.</b>
          <p>Pour ajouter ou modifier un titre, écris-nous dans l’onglet Messages : nous le publions pour toi.</p>
        </div>
      </div>

      <div className="stats">
        <div className="stat"><span>Écoutes</span><b>{plays}</b></div>
        <div className="stat"><span>J’aime</span><b>{likes}</b></div>
        <div className="stat"><span>Ventes</span><b>{sales.length}</b></div>
        <div className="stat"><span>Chiffre d’affaires</span><b>{fcfa(bal.gross)}</b></div>
      </div>

      <section className="panel">
        <h2>Ta page publique</h2>
        <p className="muted">Partage-la sur WhatsApp et tes réseaux pour vendre directement à tes fans.</p>
        <Link className="btn buy" to={`/artiste/${artist.id}`}>Voir ma page</Link>
      </section>
      </>}

      {tab === 'revenus' && (
      <section className="panel">
        <h2>Mes revenus</h2>
        <div className="stats">
          <div className="stat"><span>Ta part ({100 - pct} %)</span><b>{fcfa(bal.net)}</b></div>
          <div className="stat"><span>Déjà versé</span><b>{fcfa(bal.paid)}</b></div>
          <div className="stat hi"><span>Reste à recevoir</span><b>{fcfa(bal.due)}</b></div>
        </div>
        <p className="muted small">Commission VibeStore : {pct} %.{priv?.payoutNumber ? ` Versement sur ${methodLabel(priv.payoutMethod)} · ${priv.payoutNumber}.` : ' Ton numéro de versement n’est pas encore enregistré : écris-le-nous ci-dessous.'}</p>
        <h3>Ventes sur 30 jours</h3>
        <Bars data={series} />
        {payouts.length > 0 && (
          <>
            <h3>Mes versements</h3>
            <ul className="tracks">{payouts.map((x) => (
              <li key={x.id} className="track simple"><div className="tmeta"><b>{fcfa(x.amount)}</b><span>{dt(x.at)} · {methodLabel(x.method)}{x.reference ? ` · réf. ${x.reference}` : ''}</span></div></li>
            ))}</ul>
          </>
        )}
      </section>
      )}

      {tab === 'catalogue' && <>
      <section>
        <h2>Mes sons</h2>
        {tracks.filter((t) => !isClip(t)).length ? (
          <ul className="tracks">
            {tracks.filter((t) => !isClip(t)).map((t) => (
              <li key={t.id} className="track simple">
                <div className="tmeta"><b>{t.title}</b><span>{fcfa(t.price)} · {t.plays || 0} écoutes · {likeCount(db, t.id)} j’aime · {salesOf(t)} ventes</span></div>
                <span className="badge ok">En ligne</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucun son en ligne pour l’instant. L’équipe VibeStore ajoutera tes sorties.</Empty>}
      </section>

      <section>
        <h2>Mes clips</h2>
        {tracks.filter(isClip).length ? (
          <ul className="tracks">
            {tracks.filter(isClip).map((t) => (
              <li key={t.id} className="track simple">
                <div className="tmeta"><b>{t.title}<span className="badge clip">Clip</span></b><span>{fcfa(t.price)} · {t.plays || 0} écoutes · {likeCount(db, t.id)} j’aime · {salesOf(t)} ventes</span></div>
                <span className="badge ok">En ligne</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucun clip en ligne pour l’instant. Envoie ton clip à l’équipe VibeStore avec une demande « Nouveau titre ».</Empty>}
      </section>

      <section>
        <h2>Mes sorties</h2>
        {releases.length ? (
          <ul className="tracks">
            {releases.map((a) => (
              <li key={a.id} className="track simple">
                <div className="tmeta"><b>{a.title}</b><span>{a.kind === 'album' ? 'Album' : 'Single'} · {fcfa(a.price)} · {tracks.filter((t) => t.albumId === a.id).length} titre(s)</span></div>
                <Link className="btn small ghost" to={`/sortie/${a.id}`}>Voir</Link>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucune sortie.</Empty>}
      </section>
      </>}

      {tab === 'messages' && <>
      <section className="panel">
        <h2>Distribution sur les autres plateformes</h2>
        <p className="muted">Statut : <b>{(DISTRIBUTION.find(([k]) => k === (priv?.distribution || 'none')) || [0, ''])[1]}</b>{priv?.distributor ? ` · distributeur : ${priv.distributor}` : ''}</p>
        <p className="muted small">VibeStore peut aussi faire distribuer vos titres sur Spotify, Apple Music, YouTube Music, Deezer, Boomplay ou Audiomack, via un distributeur partenaire. Faites la demande ci-dessous (sujet « Distribution »).</p>
      </section>

      <RequestForm user={user} />
      {reqs.length > 0 && (
        <section>
          <h2>Mes demandes</h2>
          <ul className="tracks">{reqs.map((r) => (
            <li key={r.id} className="track simple">
              <div className="tmeta"><b>{(REQUEST_KINDS.find(([k]) => k === r.kind) || [0, r.kind])[1]}</b><span>{dt(r.at)} · {r.message}</span>{r.reply && <span className="ok">Réponse de VibeStore : {r.reply}</span>}</div>
              <span className={'badge' + (r.status === 'done' ? ' ok' : '')}>{r.status === 'done' ? 'Traitée' : 'En cours'}</span>
            </li>
          ))}</ul>
        </section>
      )}
      </>}
    </>
  )
}
