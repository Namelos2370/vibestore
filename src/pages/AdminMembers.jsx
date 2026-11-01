import { useState } from 'react'
import { memberList, setMemberBlocked } from '../lib/store'

const ROLES = { listener: 'Auditeur', artist: 'Artiste', admin: 'Équipe' }

function exportMembers(list) {
  const q = (x) => '"' + String(x ?? '').replace(/"/g, '""') + '"'
  const rows = [['Nom', 'Email', 'Ville', 'Type', 'Inscrit le', 'Statut']]
  list.forEach((m) => rows.push([m.name, m.email, m.city, ROLES[m.role] || m.role, m.createdAt ? new Date(m.createdAt).toLocaleDateString('fr-FR') : '', m.blocked ? 'Suspendu' : 'Actif']))
  const blob = new Blob(['﻿' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inscrits-vibestore.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

export default function MembersTab({ db, admin }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const all = memberList(db)
  const list = all.filter((m) => {
    if (filter === 'listener' && m.role !== 'listener') return false
    if (filter === 'artist' && m.role !== 'artist') return false
    if (filter === 'blocked' && !m.blocked) return false
    const t = q.trim().toLowerCase()
    return !t || `${m.name} ${m.email} ${m.city}`.toLowerCase().includes(t)
  })

  async function toggle(m) {
    setErr('')
    let reason = ''
    if (!m.blocked) {
      reason = window.prompt(`Suspendre ${m.name} ? Motif (facultatif) :`, '')
      if (reason === null) return
    }
    setBusy(m.id)
    try { await setMemberBlocked(admin, m.id, !m.blocked, reason) } catch (x) { setErr(x.message) }
    setBusy('')
  }

  return (
    <section className="panel">
      <div className="row between wrap" style={{ gap: 10 }}>
        <h2 className="h2">Inscrits ({all.length})</h2>
        {all.length > 0 && <button className="btn small ghost" type="button" onClick={() => exportMembers(list)}>Exporter en CSV</button>}
      </div>
      <p className="muted">Chaque inscrit donne son nom, son email et, s’il le souhaite, sa ville. Un compte suspendu ne peut plus se connecter ni acheter ; tu peux le rétablir à tout moment.</p>
      <div className="row wrap" style={{ gap: 10, margin: '12px 0' }}>
        <input aria-label="Rechercher un inscrit" placeholder="Rechercher un nom, un email, une ville…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 220px' }} />
        <div className="chips">
          {[['all', 'Tous'], ['listener', 'Auditeurs'], ['artist', 'Artistes'], ['blocked', 'Suspendus']].map(([k, l]) => (
            <button key={k} type="button" className={'chip' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {list.length === 0 && <p className="muted">Aucun inscrit pour cette recherche.</p>}
      <div className="members">
        {list.map((m) => (
          <div className={'member' + (m.blocked ? ' blocked' : '')} key={m.id}>
            <div className="grow">
              <b>{m.name}</b> <span className="chip cs">{ROLES[m.role] || m.role}</span> {m.blocked && <span className="chip cs warn">Suspendu</span>}
              <div className="muted">{m.email}{m.city ? ` · ${m.city}` : ''}{m.createdAt ? ` · inscrit le ${new Date(m.createdAt).toLocaleDateString('fr-FR')}` : ''}</div>
              {m.blocked && m.blockedReason && <div className="muted">Motif : {m.blockedReason}</div>}
            </div>
            {m.role !== 'admin' && m.id !== admin.id && (
              <button className={'btn small ' + (m.blocked ? 'buy' : 'ghost')} type="button" disabled={busy === m.id} onClick={() => toggle(m)}>{m.blocked ? 'Rétablir' : 'Suspendre'}</button>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
