import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  useDb, fcfa, likeCount, currentCommission, artistBalance, artistCommission, PAYOUT_METHODS, REQUEST_KINDS, PLATFORMS, DISTRIBUTION, photoUrl, isClip,
  updateArtistProfile, removeArtistPhoto, updateArtistPrivate, saveArtistNotes, addPayout, deletePayout, resolveRequest,
  updateInviteEmail, cancelInvite, inviteMessage, changeArtistEmail,
} from '../lib/store'
import { Bars } from './AdminOverview'
import { Empty } from '../components/ui'
import { Icon, Verified } from '../components/Icon'

const DAY = 86400000
const methodLabel = (id) => (PAYOUT_METHODS.find(([k]) => k === id) || [0, id])[1]
const dt = (t) => new Date(t).toLocaleDateString('fr-FR')

function download(name, rows) {
  const q = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"'
  const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

/** Relevé d'un artiste (ventes + versements), exportable pour lui envoyer. */
export function statementCsv(db, a) {
  const nameOf = (p) => (p.itemType === 'album' ? db.albums : db.tracks).find((x) => x.id === p.itemId)?.title || ''
  const rows = [[`Relevé ${a.name}`, '', '', '', ''], ['Date', 'Élément', 'Montant FCFA', 'Commission %', 'Part artiste FCFA']]
  db.purchases.filter((p) => p.artistId === a.id).sort((x, y) => x.at - y.at).forEach((p) => rows.push([dt(p.at), nameOf(p), p.amount, p.commissionPct, Math.round(p.amount * (1 - p.commissionPct / 100))]))
  const b = artistBalance(db, a.id)
  rows.push([], ['Total part artiste', '', '', '', b.net], ['Déjà versé', '', '', '', b.paid], ['Reste dû', '', '', '', b.due], [], ['Versements'], ['Date', 'Moyen', 'Montant FCFA', 'Référence'])
  db.payouts.filter((x) => x.artistId === a.id).forEach((x) => rows.push([dt(x.at), methodLabel(x.method), x.amount, x.reference]))
  return rows
}

const SHEET_TABS = [['apercu', 'Aperçu'], ['profil', 'Profil'], ['contrat', 'Contrat'], ['versements', 'Versements'], ['compte', 'Compte']]

export function ArtistSheet({ admin, artist: a, onClose }) {
  const db = useDb()
  const priv = db.priv[a.id] || {}
  const [f, setF] = useState({ name: a.name, genre: a.genre || '', bio: a.bio || '', city: a.city || '', verified: !!a.verified, status: a.status, links: { instagram: '', tiktok: '', youtube: '', whatsapp: '', spotify: '', apple: '', youtubemusic: '', deezer: '', boomplay: '', audiomack: '', ...(a.links || {}) }, photo: null })
  const [c, setC] = useState({ commissionPct: priv.commissionPct ?? '', contractStart: priv.contractStart || '', payoutMethod: priv.payoutMethod || 'momo', payoutNumber: priv.payoutNumber || '', distribution: priv.distribution || 'none', distributor: priv.distributor || 'Log Music' })
  const [notes, setNotes] = useState(db.notes[a.id] || '')
  const [po, setPo] = useState({ amount: '', method: priv.payoutMethod || 'momo', reference: '', note: '' })
  const [email, setEmail] = useState(db.invites[a.id] || db.members?.find((m) => m.id === a.userId)?.email || db.users.find((u) => u.id === a.userId)?.email || '')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [tab, setTab] = useState('apercu')
  const bal = artistBalance(db, a.id)
  const pct = artistCommission(db, a.id)
  const tracks = db.tracks.filter((t) => t.artistId === a.id)
  const plays = tracks.reduce((s, t) => s + (t.plays || 0), 0)
  const likes = tracks.reduce((s, t) => s + likeCount(db, t.id), 0)
  const series = useMemo(() => {
    const now = Date.now()
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now - (29 - i) * DAY); const st = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
      return { label: d.getDate() + '/' + (d.getMonth() + 1), v: db.purchases.filter((p) => p.artistId === a.id && p.at >= st && p.at < st + DAY).reduce((t, p) => t + p.amount, 0) }
    })
  }, [db.purchases, a.id])
  const payouts = db.payouts.filter((x) => x.artistId === a.id)
  const openReqs = db.requests.filter((r) => r.artistId === a.id && r.status === 'open').length
  const run = (label, fn) => async () => { setErr(''); setMsg(''); try { await fn(); setMsg(label) } catch (e) { setErr(e.message) } }
  const L = (k) => (e) => setF({ ...f, links: { ...f.links, [k]: e.target.value } })
  const photo = photoUrl(a.photoPath)
  const invited = a.account !== 'active'

  return (
    <section className="panel sheet">
      <div className="sheethead">
        <div className="row between">
          <div className="row">
            {photo ? <img className="avatar sm" src={photo} alt="" width="44" height="44" /> : <div className="avatar sm ph">{a.name.slice(0, 1)}</div>}
            <div className="tmeta"><b>{a.name}{a.verified && <Verified />}</b><span>{a.genre || 'Genre non précisé'}{a.city ? ' · ' + a.city : ''} · {a.account === 'active' ? 'Compte actif' : 'Invitation en attente'}</span></div>
          </div>
          <button className="btn small ghost" type="button" onClick={onClose}>Fermer</button>
        </div>
        <div className="tabs2" role="tablist">
          {SHEET_TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); setErr(''); setMsg('') }}>
              {l}{k === 'versements' && bal.due > 0 ? <i className="dot" aria-label="somme due" /> : null}{k === 'apercu' && openReqs > 0 ? <i className="dot" aria-label="demande à traiter" /> : null}
            </button>
          ))}
        </div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {msg && <p className="ok" role="status">{msg}</p>}

      {tab === 'apercu' && <>
      <div className="stats">
        <div className="stat"><span>Écoutes</span><b>{plays}</b></div>
        <div className="stat"><span>J’aime</span><b>{likes}</b></div>
        <div className="stat"><span>Ventes</span><b>{bal.sales}</b></div>
        <div className="stat hi"><span>Reste dû à l’artiste</span><b>{fcfa(bal.due)}</b></div>
      </div>
      <Bars data={series} />
      <div className="stats">
        <div className="stat"><span>Sons</span><b>{tracks.filter((t) => !isClip(t)).length}</b></div>
        <div className="stat"><span>Clips</span><b>{tracks.filter(isClip).length}</b></div>
        <div className="stat"><span>Commission</span><b>{pct} %</b></div>
        <div className="stat"><span>Demandes ouvertes</span><b>{openReqs}</b></div>
      </div>
      <div className="row wrap">
        <Link className="btn small buy" to={`/artiste/${a.id}`}>Voir sa page publique</Link>
        <button className="btn small ghost" type="button" onClick={() => setTab('versements')}>Enregistrer un versement</button>
        <button className="btn small ghost" type="button" onClick={() => download(`releve-${a.name.replace(/\W+/g, '-').toLowerCase()}.csv`, statementCsv(db, a))}>Relevé (CSV)</button>
      </div>
      </>}

      {tab === 'profil' && <>
      <h3>Profil public</h3>
      <div className="row wrap">
        {photo ? <img className="avatar" src={photo} alt="" width="72" height="72" /> : <div className="avatar ph">{a.name.slice(0, 1)}</div>}
        <label className="field grow"><span>Photo (JPG ou PNG)</span><input type="file" accept="image/*" onChange={(e) => setF({ ...f, photo: (e.target.files && e.target.files[0]) || null })} /></label>
        {photo && <button className="btn small ghost" type="button" onClick={run('Photo retirée.', () => removeArtistPhoto(admin, a.id))}>Retirer la photo</button>}
      </div>
      <div className="row wrap">
        <label className="field grow"><span>Nom d’artiste</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field grow"><span>Genre</span><input value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })} /></label>
        <label className="field grow"><span>Ville</span><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="Yaoundé" /></label>
      </div>
      <label className="field"><span>Présentation</span><textarea rows="3" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></label>
      <div className="row wrap">
        <label className="field grow"><span>Instagram</span><input value={f.links.instagram} onChange={L('instagram')} placeholder="https://instagram.com/…" /></label>
        <label className="field grow"><span>TikTok</span><input value={f.links.tiktok} onChange={L('tiktok')} placeholder="https://tiktok.com/@…" /></label>
        <label className="field grow"><span>YouTube</span><input value={f.links.youtube} onChange={L('youtube')} placeholder="https://youtube.com/@…" /></label>
        <label className="field grow"><span>WhatsApp (numéro)</span><input value={f.links.whatsapp} onChange={L('whatsapp')} placeholder="2376…" /></label>
      </div>
      <h3>Autres plateformes</h3>
      <p className="muted small">Liens de l’artiste sur les plateformes de streaming : ils apparaissent sur sa page publique (« Écouter aussi sur »).</p>
      <div className="row wrap">
        {PLATFORMS.map(([k, l]) => <label key={k} className="field grow"><span>{l}</span><input value={f.links[k]} onChange={L(k)} placeholder="https://…" /></label>)}
      </div>
      <div className="row wrap">
        <label className="field grow"><span>Statut</span>
          <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            <option value="approved">Actif (visible)</option><option value="rejected">Suspendu (masqué, titres conservés)</option><option value="pending">Archivé (masqué)</option>
          </select>
        </label>
        <label className="check"><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} /> Artiste vérifié</label>
        <button className="btn buy" type="button" onClick={run('Profil enregistré.', async () => { await updateArtistProfile(admin, a.id, f); setF((x) => ({ ...x, photo: null })) })}>Enregistrer le profil</button>
      </div>
      </>}

      {tab === 'contrat' && <>
      <h3>Contrat et paiement</h3>
      <p className="muted small">Commission générale actuelle : {currentCommission(db)} %. Laisse vide pour appliquer la commission générale à cet artiste. Un nouveau taux ne s’applique qu’aux futures ventes.</p>
      <div className="row wrap">
        <label className="field grow"><span>Commission de cet artiste (%)</span><input type="number" min="0" max="60" value={c.commissionPct} onChange={(e) => setC({ ...c, commissionPct: e.target.value })} placeholder={String(currentCommission(db))} /></label>
        <label className="field grow"><span>Début du contrat</span><input type="date" value={c.contractStart} onChange={(e) => setC({ ...c, contractStart: e.target.value })} /></label>
        <label className="field grow"><span>Moyen de versement</span>
          <select value={c.payoutMethod} onChange={(e) => setC({ ...c, payoutMethod: e.target.value })}>{PAYOUT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field grow"><span>Distribution (autres plateformes)</span>
          <select value={c.distribution} onChange={(e) => setC({ ...c, distribution: e.target.value })}>{DISTRIBUTION.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field grow"><span>Distributeur partenaire</span><input value={c.distributor} onChange={(e) => setC({ ...c, distributor: e.target.value })} placeholder="Log Music" /></label>
        <label className="field grow"><span>Numéro ou compte</span><input value={c.payoutNumber} onChange={(e) => setC({ ...c, payoutNumber: e.target.value })} placeholder="6 99 00 00 00" /></label>
        <button className="btn buy" type="button" onClick={run('Contrat enregistré.', () => updateArtistPrivate(admin, a.id, c))}>Enregistrer</button>
      </div>
      </>}

      {tab === 'versements' && <>
      <h3>Versements</h3>
      <div className="stats">
        <div className="stat"><span>Part de l’artiste ({100 - pct} %)</span><b>{fcfa(bal.net)}</b></div>
        <div className="stat"><span>Déjà versé</span><b>{fcfa(bal.paid)}</b></div>
        <div className="stat hi"><span>Reste dû</span><b>{fcfa(bal.due)}</b></div>
      </div>
      <div className="row wrap">
        <label className="field grow"><span>Montant versé (FCFA)</span><input type="number" min="1" value={po.amount} onChange={(e) => setPo({ ...po, amount: e.target.value })} placeholder={bal.due > 0 ? String(bal.due) : ''} /></label>
        <label className="field grow"><span>Moyen</span><select value={po.method} onChange={(e) => setPo({ ...po, method: e.target.value })}>{PAYOUT_METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label className="field grow"><span>Référence de la transaction</span><input value={po.reference} onChange={(e) => setPo({ ...po, reference: e.target.value })} /></label>
        <button className="btn buy" type="button" onClick={run('Versement enregistré.', async () => { await addPayout(admin, { artistId: a.id, ...po }); setPo({ ...po, amount: '', reference: '', note: '' }) })}>Marquer comme payé</button>
        <button className="btn ghost" type="button" onClick={() => download(`releve-${a.name.replace(/\W+/g, '-').toLowerCase()}.csv`, statementCsv(db, a))}>Relevé (CSV)</button>
      </div>
      {payouts.length ? (
        <ul className="tracks">{payouts.map((x) => (
          <li key={x.id} className="track simple"><div className="tmeta"><b>{fcfa(x.amount)}</b><span>{dt(x.at)} · {methodLabel(x.method)}{x.reference ? ` · réf. ${x.reference}` : ''}</span></div>
            <button className="btn small ghost danger" type="button" onClick={() => window.confirm('Annuler ce versement ?') && run('Versement annulé.', () => deletePayout(admin, x.id))()}>Annuler</button></li>
        ))}</ul>
      ) : <p className="muted small">Aucun versement enregistré.</p>}
      </>}

      {tab === 'compte' && <>
      <h3>Invitation et compte</h3>
      {invited ? (
        <>
          <p className="muted small">Cet artiste n’a pas encore créé son compte. Envoie-lui le message ci-dessous par WhatsApp ou email.</p>
          <div className="row wrap">
            <label className="field grow2"><span>Email d’invitation</span><input value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="btn small ghost" type="button" onClick={run('Email modifié.', () => changeArtistEmail(admin, a.id, email))}>Changer l’email</button>
            <button className="btn small ghost" type="button" onClick={run('Message copié : colle-le dans WhatsApp ou un email.', async () => { await navigator.clipboard.writeText(inviteMessage(a, email || db.invites[a.id] || '')) })}>Copier le message</button>
            <button className="btn small ghost danger" type="button" onClick={() => window.confirm('Annuler l’invitation ? La fiche et les titres restent en ligne.') && run('Invitation annulée.', () => cancelInvite(admin, a.id))()}>Annuler l’invitation</button>
          </div>
        </>
      ) : (
        <>
          <p className="ok">Compte actif : l’artiste a accès à son studio.</p>
          <div className="row wrap">
            <label className="field grow2"><span>Email de connexion</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <button className="btn small ghost" type="button" onClick={() => window.confirm(`Changer l’email de connexion de ${a.name} en ${email} ? Il devra l’utiliser pour se connecter (son mot de passe reste le même).`) && run('Email modifié. Préviens l’artiste.', () => changeArtistEmail(admin, a.id, email))()}>Changer l’email</button>
          </div>
        </>
      )}

      <h3>Notes internes</h3>
      <p className="muted small">Visibles par l’équipe VibeStore uniquement.</p>
      <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes internes" />
      <button className="btn small ghost" type="button" onClick={run('Notes enregistrées.', () => saveArtistNotes(admin, a.id, notes))}>Enregistrer les notes</button>
      </>}
    </section>
  )
}

/** Vue d'ensemble des sommes dues à tous les artistes. */
export function PayoutsTab({ onOpen }) {
  const db = useDb()
  const rows = db.artists.map((a) => ({ a, ...artistBalance(db, a.id) })).sort((x, y) => y.due - x.due)
  const tot = rows.reduce((s, r) => ({ net: s.net + r.net, paid: s.paid + r.paid, due: s.due + r.due }), { net: 0, paid: 0, due: 0 })
  return (
    <>
      <div className="stats">
        <div className="stat"><span>Part des artistes</span><b>{fcfa(tot.net)}</b></div>
        <div className="stat"><span>Déjà versé</span><b>{fcfa(tot.paid)}</b></div>
        <div className="stat hi"><span>À verser</span><b>{fcfa(tot.due)}</b></div>
      </div>
      <button className="btn small ghost" type="button" onClick={() => download('reversements-vibestore.csv', [['Artiste', 'Ventes', 'CA FCFA', 'Part artiste', 'Versé', 'Reste dû', 'Moyen', 'Numéro'], ...rows.map((r) => [r.a.name, r.sales, r.gross, r.net, r.paid, r.due, methodLabel(db.priv[r.a.id]?.payoutMethod || 'momo'), db.priv[r.a.id]?.payoutNumber || ''])])}>Exporter (CSV)</button>
      {rows.length ? (
        <ul className="tracks">{rows.map((r) => (
          <li key={r.a.id} className="track simple">
            <div className="tmeta"><b>{r.a.name}</b><span>{r.sales} vente(s) · part {fcfa(r.net)} · versé {fcfa(r.paid)} · {methodLabel(db.priv[r.a.id]?.payoutMethod || 'momo')} {db.priv[r.a.id]?.payoutNumber || '(numéro manquant)'}</span></div>
            <span className={'price' + (r.due > 0 ? ' due' : '')}>{fcfa(r.due)}</span>
            <button className="btn small ghost" type="button" onClick={() => onOpen(r.a.id)}>Fiche</button>
          </li>
        ))}</ul>
      ) : <Empty>Aucun artiste.</Empty>}
    </>
  )
}

export function RequestsTab({ admin }) {
  const db = useDb()
  const [reply, setReply] = useState({})
  const [err, setErr] = useState('')
  const name = (id) => db.artists.find((a) => a.id === id)?.name || '—'
  const kind = (k) => (REQUEST_KINDS.find(([x]) => x === k) || [0, k])[1]
  const list = [...db.requests].sort((a, b) => (a.status === b.status ? b.at - a.at : a.status === 'open' ? -1 : 1))
  async function act(r, status) { setErr(''); try { await resolveRequest(admin, r.id, { reply: reply[r.id] ?? r.reply, status }) } catch (e) { setErr(e.message) } }
  if (!list.length) return <Empty>Aucune demande d’artiste pour le moment.</Empty>
  return (
    <>
      {err && <p className="err" role="alert">{err}</p>}
      <ul className="tracks">{list.map((r) => (
        <li key={r.id} className="mgr">
          <div className="row wrap mrow">
            <div className="tmeta grow"><b>{name(r.artistId)} · {kind(r.kind)}</b><span>{dt(r.at)} · {r.status === 'open' ? 'À traiter' : 'Traitée'}</span></div>
          </div>
          <p>{r.message}</p>
          <div className="row wrap">
            <label className="field grow2"><span>Réponse (visible par l’artiste)</span><input value={reply[r.id] ?? r.reply} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} /></label>
            {r.status === 'open'
              ? <button className="btn small buy" type="button" onClick={() => act(r, 'done')}>Marquer traitée</button>
              : <button className="btn small ghost" type="button" onClick={() => act(r, 'open')}>Rouvrir</button>}
          </div>
        </li>
      ))}</ul>
    </>
  )
}
