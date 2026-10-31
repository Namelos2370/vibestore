import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDb, useUser, createArtist, createRelease, updateArtist, updateRelease, updateTrack, deleteArtist, deleteRelease, deleteTrack, updateSettings, togglePayment, currentCommission, fcfa, MIN_PRICE } from '../lib/store'
import { Empty } from '../components/ui'
import { mmss } from '../lib/store'

const COLORS = ['#8B5CF6', '#22D3C5', '#F472B6', '#F59E0B', '#60A5FA']
const emptyRow = () => ({ title: '', price: 1000, duration: 200, audioName: '', file: null })

function ArtistForm({ admin }) {
  const [f, setF] = useState({ name: '', contact: '', genre: '', bio: '' })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setErr(''); setDone(null)
    try {
      const r = await createArtist(admin, f)
      setDone(r)
      setF({ name: '', contact: '', genre: '', bio: '' })
    } catch (x) { setErr(x.message) }
  }
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Ajouter un artiste</h2>
      <p className="muted small">L’artiste crée son compte avec l’email indiqué ici : il est alors relié automatiquement à sa fiche et accède à son studio.</p>
      <div className="row wrap">
        <label className="field grow"><span>Nom d’artiste</span><input id="aname" value={f.name} onChange={set('name')} /></label>
        <label className="field grow"><span>Email de l’artiste</span><input id="acontact" value={f.contact} onChange={set('contact')} /></label>
      </div>
      <div className="row wrap">
        <label className="field grow"><span>Genre</span><input id="agenre" value={f.genre} onChange={set('genre')} /></label>
        <label className="field grow2"><span>Présentation</span><input id="abio" value={f.bio} onChange={set('bio')} /></label>
      </div>
      {err && <p className="err" role="alert">{err}</p>}
      {done && (
        <p className="ok" role="status">
          {done.tempPassword
            ? <>Compte créé pour {done.artist.name}. Démonstration : identifiant <b>{done.email}</b>, mot de passe provisoire <b>{done.tempPassword}</b>.</>
            : <>Fiche créée pour {done.artist.name}. Demande-lui d’ouvrir le site, de cliquer sur « Créer un compte » avec l’email <b>{done.email}</b> et de confirmer son email : son studio sera alors activé.</>}
        </p>
      )}
      <button className="btn buy" type="submit">Créer le compte artiste</button>
    </form>
  )
}

function ReleaseForm({ admin, artists, preset }) {
  const db = useDb()
  const [artistId, setArtistId] = useState(preset || artists[0]?.id || '')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('album')
  const [albumPrice, setAlbumPrice] = useState(3000)
  const [color, setColor] = useState(COLORS[0])
  const [rows, setRows] = useState([emptyRow()])
  const [cover, setCover] = useState(null)
  const [coverKey, setCoverKey] = useState(0)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const min = db.settings.minPrice
  const upd = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
  const pickAudio = (i) => (e) => {
    const file = e.target.files && e.target.files[0]
    setRows(rows.map((r, j) => (j === i ? { ...r, file: file || null, audioName: file ? file.name : '', title: r.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') } : r)))
  }
  async function submit(e) {
    e.preventDefault()
    setErr(''); setOk(''); setBusy(true)
    try {
      await createRelease(admin, { artistId: artistId || preset, title, kind, albumPrice, color, tracks: rows, cover })
      setTitle(''); setRows([emptyRow()]); setCover(null); setCoverKey((k) => k + 1)
      setOk('Sortie publiée dans le catalogue.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const shown = kind === 'single' ? rows.slice(0, 1) : rows
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>Ajouter une sortie pour un artiste</h2>
      <p className="muted small">Distribution : la sortie est publiée directement dans le catalogue, sans étape de validation.</p>
      <div className="row wrap">
        <label className="field grow2"><span>Artiste</span>
          <select id="rartist" value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field grow"><span>Type</span>
          <select id="rkind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="album">Album</option><option value="single">Single</option></select>
        </label>
      </div>
      <div className="row wrap">
        <label className="field grow2"><span>Titre de la sortie</span><input id="rtitle" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        {kind === 'album' && (
          <label className="field grow"><span>Prix de l’album (min. {fcfa(min)})</span>
            <input id="aprice" type="number" min={min} step="100" value={albumPrice} onChange={(e) => setAlbumPrice(e.target.value)} />
          </label>
        )}
      </div>
      <label className="field"><span>Pochette (image JPG ou PNG){cover ? ` : ${cover.name}` : ''}</span>
        <input key={coverKey} id="rcover" type="file" onChange={(e) => setCover((e.target.files && e.target.files[0]) || null)} />
      </label>
      <div className="field"><span>Couleur de secours si pas d’image</span>
        <div className="row">{COLORS.map((c) => (
          <button key={c} type="button" aria-label={'Couleur ' + c} aria-pressed={color === c} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
        ))}</div>
      </div>
      <h3>Titres</h3>
      {shown.map((r, i) => (
        <div key={i} className="row wrap trow">
          <label className="field grow2"><span>Titre {i + 1}</span><input id={'tt' + i} value={r.title} onChange={upd(i, 'title')} /></label>
          <label className="field"><span>Prix (FCFA, min. {min})</span><input id={'tp' + i} type="number" min={min} step="100" value={r.price} onChange={upd(i, 'price')} /></label>
          <label className="field"><span>Durée (s, auto avec un fichier)</span><input id={'td' + i} type="number" min="30" value={r.duration} onChange={upd(i, 'duration')} /></label>
          <label className="field grow2"><span>Fichier audio (MP3, M4A ou WAV){r.audioName ? ` : ${r.audioName}` : ''}</span>
            <input id={'ta' + i} type="file" onChange={pickAudio(i)} />
          </label>
        </div>
      ))}
      {kind === 'album' && <button className="btn small ghost" type="button" onClick={() => setRows([...rows, emptyRow()])}>+ Ajouter un titre</button>}
      <p className="muted small">Le fichier complet est stocké en privé (accessible seulement après achat). L’extrait de 30 s et la durée sont créés automatiquement. Sans fichier, un son de test est utilisé. Taille maximum : 50 Mo par titre.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      <button className="btn buy" type="submit" disabled={busy}>{busy ? 'Envoi en cours…' : 'Publier dans le catalogue'}</button>
    </form>
  )
}


function CatalogManager({ admin }) {
  const db = useDb()
  const [edit, setEdit] = useState(null) // { kind, id, f }
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState({})
  async function run(fn) { setMsg(''); try { await fn() ; setEdit(null) } catch (e) { setMsg(e.message) } }
  const hidden = (x) => x.status === 'rejected'
  const st = (x) => (hidden(x) ? 'approved' : 'rejected')
  const ask = (t) => window.confirm(t)
  const field = (k, props = {}) => (
    <input value={edit.f[k] ?? ''} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} {...props} />
  )
  const isEd = (kind, id) => edit && edit.kind === kind && edit.id === id
  const tracksOf = (rid) => db.tracks.filter((t) => t.albumId === rid)
  return (
    <section>
      <h2>Artistes du catalogue</h2>
      {msg && <p className="err" role="alert">{msg}</p>}
      {db.artists.length === 0 && <Empty>Aucun artiste pour le moment. Ajoute le premier ci-dessous.</Empty>}
      <ul className="tracks">
        {[...db.artists].reverse().map((a) => {
          const rels = db.albums.filter((r) => r.artistId === a.id)
          return (
            <li key={a.id} className="mgr">
              {isEd('artist', a.id) ? (
                <div className="row wrap">
                  <label className="field grow"><span>Nom</span>{field('name')}</label>
                  <label className="field grow"><span>Genre</span>{field('genre')}</label>
                  <label className="field grow2"><span>Présentation</span>{field('bio')}</label>
                  <button className="btn small buy" type="button" onClick={() => run(() => updateArtist(admin, a.id, { ...edit.f, status: a.status }))}>Enregistrer</button>
                  <button className="btn small ghost" type="button" onClick={() => setEdit(null)}>Annuler</button>
                </div>
              ) : (
                <div className="row wrap mrow">
                  <div className="tmeta grow"><b>{a.name}{hidden(a) && <span className="badge"> Masqué</span>}</b><span>{a.genre || 'Genre non précisé'} · {rels.length} sortie(s) · {a.account === 'active' ? 'Compte actif' : 'Invitation en attente'}</span></div>
                  <button className="btn small ghost" type="button" onClick={() => setOpen({ ...open, [a.id]: !open[a.id] })}>{open[a.id] ? 'Replier' : 'Sorties'}</button>
                  <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'artist', id: a.id, f: { name: a.name, genre: a.genre, bio: a.bio } })}>Modifier</button>
                  <button className="btn small ghost" type="button" onClick={() => run(() => updateArtist(admin, a.id, { name: a.name, genre: a.genre, bio: a.bio, status: st(a) }))}>{hidden(a) ? 'Réafficher' : 'Masquer'}</button>
                  <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer ${a.name}, ses sorties et ses titres ?`) && run(() => deleteArtist(admin, a.id))}>Supprimer</button>
                </div>
              )}
              {open[a.id] && (
                <ul className="sub">
                  {rels.length === 0 && <li className="muted small">Aucune sortie.</li>}
                  {rels.map((r) => (
                    <li key={r.id}>
                      {isEd('release', r.id) ? (
                        <div className="row wrap">
                          <label className="field grow2"><span>Titre de la sortie</span>{field('title')}</label>
                          <label className="field"><span>Prix (min. {db.settings.minPrice})</span>{field('price', { type: 'number', min: db.settings.minPrice, step: 100 })}</label>
                          <button className="btn small buy" type="button" onClick={() => run(() => updateRelease(admin, r.id, { ...edit.f, color: r.color, status: r.status }))}>Enregistrer</button>
                          <button className="btn small ghost" type="button" onClick={() => setEdit(null)}>Annuler</button>
                        </div>
                      ) : (
                        <div className="row wrap mrow">
                          <div className="tmeta grow"><b>{r.title}{hidden(r) && <span className="badge"> Masqué</span>}</b><span>{r.kind === 'album' ? 'Album' : 'Single'} · {fcfa(r.price)} · {tracksOf(r.id).length} titre(s)</span></div>
                          <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'release', id: r.id, f: { title: r.title, price: r.price } })}>Modifier</button>
                          <button className="btn small ghost" type="button" onClick={() => run(() => updateRelease(admin, r.id, { title: r.title, price: r.price, color: r.color, status: st(r) }))}>{hidden(r) ? 'Réafficher' : 'Masquer'}</button>
                          <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer « ${r.title} » et ses titres ?`) && run(() => deleteRelease(admin, r.id))}>Supprimer</button>
                        </div>
                      )}
                      <ul className="sub">
                        {tracksOf(r.id).map((t) => (
                          <li key={t.id}>
                            {isEd('track', t.id) ? (
                              <div className="row wrap">
                                <label className="field grow2"><span>Titre</span>{field('title')}</label>
                                <label className="field"><span>Prix (min. {db.settings.minPrice})</span>{field('price', { type: 'number', min: db.settings.minPrice, step: 100 })}</label>
                                <button className="btn small buy" type="button" onClick={() => run(() => updateTrack(admin, t.id, { ...edit.f, status: t.status }))}>Enregistrer</button>
                                <button className="btn small ghost" type="button" onClick={() => setEdit(null)}>Annuler</button>
                              </div>
                            ) : (
                              <div className="row wrap mrow">
                                <div className="tmeta grow"><span>{t.title}{hidden(t) && <span className="badge"> Masqué</span>} · {fcfa(t.price)} · {mmss(t.duration)}{t.audioPath ? '' : ' · son de test'}</span></div>
                                <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'track', id: t.id, f: { title: t.title, price: t.price } })}>Modifier</button>
                                <button className="btn small ghost" type="button" onClick={() => run(() => updateTrack(admin, t.id, { title: t.title, price: t.price, status: st(t) }))}>{hidden(t) ? 'Réafficher' : 'Masquer'}</button>
                                <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer « ${t.title} » ?`) && run(() => deleteTrack(admin, t.id))}>Supprimer</button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default function Admin() {
  const db = useDb()
  const user = useUser()
  const [tab, setTab] = useState('artistes')
  const [s, setS] = useState(null)
  if (!user) return <Navigate to="/compte" replace />
  if (user.role !== 'admin') return <Empty>Espace réservé à l’équipe VibeStore.</Empty>

  const form = s || { commissionPct: db.settings.commissionPct, promoCommissionPct: db.settings.promoCommissionPct, promoMonths: db.settings.promoMonths, minPrice: db.settings.minPrice }
  const setF = (k) => (e) => setS({ ...form, [k]: e.target.value })
  const artistName = (id) => db.artists.find((a) => a.id === id)?.name || '—'
  const gross = db.purchases.reduce((t, p) => t + p.amount, 0)
  const fee = db.purchases.reduce((t, p) => t + (p.amount * p.commissionPct) / 100, 0)

  return (
    <>
      <span className="eyebrow">Tableau de bord VibeStore</span>
      <h1 className="h1">Administration</h1>
      <p className="muted">Les comptes artistes et leurs titres sont ajoutés uniquement ici, par l’équipe VibeStore. Les artistes ne s’inscrivent pas seuls et ne publient pas eux-mêmes.</p>
      <div className="tabs" role="tablist">
        {[['artistes', 'Artistes et titres'], ['ventes', 'Ventes'], ['reglages', 'Réglages']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} type="button" onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === 'artistes' && (
        <>
          <CatalogManager admin={user} />
          <ArtistForm admin={user} />
          {db.artists.length > 0 && <ReleaseForm key={db.artists.length} admin={user} artists={db.artists} />}
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
            <button className="btn buy" type="button" onClick={async () => { try { await updateSettings({ commissionPct: Number(form.commissionPct), promoCommissionPct: Number(form.promoCommissionPct), promoMonths: Number(form.promoMonths), minPrice: Number(form.minPrice) || MIN_PRICE }); setS(null) } catch (x) { window.alert(x.message) } }}>Enregistrer</button>
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
