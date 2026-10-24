import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDb, useUser, setArtistStatus, setReleaseStatus, updateSettings, togglePayment, currentCommission, fcfa } from '../lib/store'
import { Empty } from '../components/ui'

export default function Admin() {
  const db = useDb()
  const user = useUser()
  const [tab, setTab] = useState('valider')
  const [s, setS] = useState(null)
  if (!user) return <Navigate to="/compte" replace />
  if (user.role !== 'admin') return <Empty>Espace réservé à l’administrateur.</Empty>

  const form = s || { commissionPct: db.settings.commissionPct, promoCommissionPct: db.settings.promoCommissionPct, promoMonths: db.settings.promoMonths, minPrice: db.settings.minPrice }
  const setF = (k) => (e) => setS({ ...form, [k]: e.target.value })
  const pendingArtists = db.artists.filter((a) => a.status === 'pending')
  const pendingReleases = db.albums.filter((a) => a.status === 'pending')
  const artistName = (id) => db.artists.find((a) => a.id === id)?.name || '—'
  const gross = db.purchases.reduce((t, p) => t + p.amount, 0)
  const fee = db.purchases.reduce((t, p) => t + (p.amount * p.commissionPct) / 100, 0)

  return (
    <>
      <h1 className="h1">Administration</h1>
      <div className="tabs" role="tablist">
        {[['valider', `À valider (${pendingArtists.length + pendingReleases.length})`], ['ventes', 'Ventes'], ['reglages', 'Réglages']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} type="button" onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'valider' && (
        <>
          <section>
            <h2>Artistes</h2>
            {pendingArtists.length ? (
              <ul className="tracks">{pendingArtists.map((a) => (
                <li key={a.id} className="track simple">
                  <div className="tmeta"><b>{a.name}</b><span>{a.bio || 'Pas de présentation'}</span></div>
                  <button className="btn small buy" type="button" onClick={() => setArtistStatus(a.id, 'approved')}>Valider</button>
                  <button className="btn small ghost" type="button" onClick={() => setArtistStatus(a.id, 'rejected')}>Refuser</button>
                </li>
              ))}</ul>
            ) : <Empty>Aucun artiste en attente.</Empty>}
          </section>
          <section>
            <h2>Sorties</h2>
            {pendingReleases.length ? (
              <ul className="tracks">{pendingReleases.map((a) => (
                <li key={a.id} className="track simple">
                  <div className="tmeta"><b>{a.title}</b><span>{artistName(a.artistId)} · {a.kind === 'album' ? 'Album' : 'Single'} · {fcfa(a.price)} · {db.tracks.filter((t) => t.albumId === a.id).length} titre(s)</span></div>
                  <button className="btn small buy" type="button" onClick={() => setReleaseStatus(a.id, 'approved')}>Publier</button>
                  <button className="btn small ghost" type="button" onClick={() => setReleaseStatus(a.id, 'rejected')}>Refuser</button>
                </li>
              ))}</ul>
            ) : <Empty>Aucune sortie en attente.</Empty>}
          </section>
        </>
      )}

      {tab === 'ventes' && (
        <>
          <div className="stats">
            <div className="stat"><span>Ventes</span><b>{db.purchases.length}</b></div>
            <div className="stat"><span>Chiffre d’affaires</span><b>{fcfa(gross)}</b></div>
            <div className="stat hi"><span>Commission VibeStore</span><b>{fcfa(fee)}</b></div>
          </div>
          {db.purchases.length ? (
            <ul className="tracks">{[...db.purchases].reverse().map((p) => (
              <li key={p.id} className="track simple">
                <div className="tmeta"><b>{(p.itemType === 'album' ? db.albums : db.tracks).find((x) => x.id === p.itemId)?.title || '—'}</b><span>{artistName(p.artistId)} · {new Date(p.at).toLocaleDateString('fr-FR')} · commission {p.commissionPct} %</span></div>
                <span className="price">{fcfa(p.amount)}</span>
              </li>
            ))}</ul>
          ) : <Empty>Aucune vente pour le moment.</Empty>}
        </>
      )}

      {tab === 'reglages' && (
        <>
          <section className="panel form">
            <h2>Commission et prix</h2>
            <p className="muted">Commission appliquée aujourd’hui : <b>{currentCommission(db)} %</b></p>
            <div className="row wrap">
              <label className="field grow"><span>Commission normale (%)</span><input id="c1" type="number" min="0" max="60" value={form.commissionPct} onChange={setF('commissionPct')} /></label>
              <label className="field grow"><span>Commission de lancement (%)</span><input id="c2" type="number" min="0" max="60" value={form.promoCommissionPct} onChange={setF('promoCommissionPct')} /></label>
              <label className="field grow"><span>Durée du lancement (mois)</span><input id="c3" type="number" min="0" max="36" value={form.promoMonths} onChange={setF('promoMonths')} /></label>
              <label className="field grow"><span>Prix minimum (FCFA)</span><input id="c4" type="number" min="0" step="100" value={form.minPrice} onChange={setF('minPrice')} /></label>
            </div>
            <button className="btn buy" type="button" onClick={() => { updateSettings({ commissionPct: Number(form.commissionPct), promoCommissionPct: Number(form.promoCommissionPct), promoMonths: Number(form.promoMonths), minPrice: Number(form.minPrice) }); setS(null) }}>Enregistrer</button>
          </section>
          <section className="panel">
            <h2>Moyens de paiement</h2>
            <p className="muted">Active seulement ceux qui sont branchés. Les autres restent invisibles pour les clients.</p>
            <ul className="tracks">{db.settings.paymentMethods.map((m) => (
              <li key={m.id} className="track simple">
                <div className="tmeta"><b>{m.label}</b><span>{m.enabled ? 'Activé (simulation en démo)' : 'Désactivé'}</span></div>
                <button className={'btn small ' + (m.enabled ? 'ghost' : 'buy')} type="button" onClick={() => togglePayment(m.id)}>{m.enabled ? 'Désactiver' : 'Activer'}</button>
              </li>
            ))}</ul>
          </section>
        </>
      )}
    </>
  )
}
