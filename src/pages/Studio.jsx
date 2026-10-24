import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useDb, useUser, myArtist, updateArtist, createRelease, currentCommission, fcfa, MIN_PRICE } from '../lib/store'
import { Empty } from '../components/ui'

const COLORS = ['#8B5CF6', '#22D3C5', '#F472B6', '#F59E0B', '#60A5FA']

export default function Studio() {
  const db = useDb()
  const user = useUser()
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState('album')
  const [albumPrice, setAlbumPrice] = useState(3000)
  const [color, setColor] = useState(COLORS[0])
  const [rows, setRows] = useState([{ title: '', price: 1000, duration: 200 }])
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [bio, setBio] = useState(null)

  if (!user) return <Navigate to="/compte" replace />
  if (user.role !== 'artist') return <Empty>Cet espace est réservé aux artistes. Crée un compte artiste depuis la page Connexion.</Empty>
  const artist = myArtist(db, user)
  if (!artist) return <Empty>Profil artiste introuvable.</Empty>
  if (artist.status !== 'approved') {
    return (
      <>
        <h1 className="h1">Studio</h1>
        <div className="panel"><p><b>Ton profil est en attente de validation.</b></p><p className="muted">Un administrateur VibeStore vérifie ton profil. Tu pourras ensuite publier tes titres.</p></div>
      </>
    )
  }

  const pct = currentCommission(db)
  const mine = db.albums.filter((a) => a.artistId === artist.id)
  const myTracks = db.tracks.filter((t) => t.artistId === artist.id)
  const sales = db.purchases.filter((p) => p.artistId === artist.id)
  const gross = sales.reduce((s, p) => s + p.amount, 0)
  const net = sales.reduce((s, p) => s + p.amount * (1 - p.commissionPct / 100), 0)
  const plays = myTracks.reduce((s, t) => s + (t.plays || 0), 0)
  const upd = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))

  function publish(e) {
    e.preventDefault()
    setErr(''); setOk('')
    try {
      createRelease(user, { title, kind, albumPrice, color, tracks: kind === 'single' ? rows.slice(0, 1) : rows })
      setTitle(''); setRows([{ title: '', price: 1000, duration: 200 }])
      setOk('Sortie envoyée. Elle sera visible après validation par VibeStore.')
    } catch (x) { setErr(x.message) }
  }

  return (
    <>
      <h1 className="h1">Studio</h1>
      <div className="stats">
        <div className="stat"><span>Écoutes</span><b>{plays}</b></div>
        <div className="stat"><span>Ventes</span><b>{sales.length}</b></div>
        <div className="stat"><span>Chiffre d’affaires</span><b>{fcfa(gross)}</b></div>
        <div className="stat hi"><span>Ta part ({100 - pct} %)</span><b>{fcfa(net)}</b></div>
      </div>
      <p className="muted small">Commission VibeStore actuelle : {pct} %. Le retrait Mobile Money arrive en phase 2.</p>

      <section className="panel">
        <h2>Mon profil</h2>
        <label className="field"><span>Présentation</span>
          <textarea id="bio" rows="3" value={bio ?? artist.bio} onChange={(e) => setBio(e.target.value)} />
        </label>
        <button className="btn small ghost" type="button" onClick={() => { updateArtist(artist.id, { bio: bio ?? artist.bio }); setBio(null) }}>Enregistrer</button>
      </section>

      <form className="panel form" onSubmit={publish}>
        <h2>Publier une sortie</h2>
        <label className="field"><span>Titre de la sortie</span><input id="rtitle" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="row wrap">
          <label className="field grow"><span>Type</span>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="album">Album</option><option value="single">Single</option></select>
          </label>
          {kind === 'album' && (
            <label className="field grow"><span>Prix de l’album (FCFA, min. {MIN_PRICE})</span>
              <input id="aprice" type="number" min={MIN_PRICE} step="100" value={albumPrice} onChange={(e) => setAlbumPrice(e.target.value)} />
            </label>
          )}
        </div>
        <div className="field"><span>Couleur de la pochette</span>
          <div className="row">{COLORS.map((c) => (
            <button key={c} type="button" aria-label={'Couleur ' + c} aria-pressed={color === c} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
          ))}</div>
        </div>
        <h3>Titres</h3>
        {(kind === 'single' ? rows.slice(0, 1) : rows).map((r, i) => (
          <div key={i} className="row wrap trow">
            <label className="field grow2"><span>Titre {i + 1}</span><input id={'tt' + i} value={r.title} onChange={upd(i, 'title')} /></label>
            <label className="field"><span>Prix (FCFA)</span><input id={'tp' + i} type="number" min={MIN_PRICE} step="100" value={r.price} onChange={upd(i, 'price')} /></label>
            <label className="field"><span>Durée (s)</span><input id={'td' + i} type="number" min="30" value={r.duration} onChange={upd(i, 'duration')} /></label>
          </div>
        ))}
        {kind === 'album' && <button className="btn small ghost" type="button" onClick={() => setRows([...rows, { title: '', price: 1000, duration: 200 }])}>+ Ajouter un titre</button>}
        <p className="muted small">Démonstration : l’envoi du fichier audio sera branché avec le stockage Supabase. Pour l’instant, un son de test est utilisé.</p>
        {err && <p className="err" role="alert">{err}</p>}
        {ok && <p className="ok" role="status">{ok}</p>}
        <button className="btn buy wide" type="submit">Envoyer pour validation</button>
      </form>

      <section>
        <h2>Mes sorties</h2>
        {mine.length ? (
          <ul className="tracks">
            {mine.map((a) => (
              <li key={a.id} className="track simple">
                <div className="tmeta"><b>{a.title}</b><span>{a.kind === 'album' ? 'Album' : 'Single'} · {fcfa(a.price)} · {db.tracks.filter((t) => t.albumId === a.id).length} titre(s)</span></div>
                <span className={'badge ' + (a.status === 'approved' ? 'ok' : a.status === 'rejected' ? 'no' : '')}>{a.status === 'approved' ? 'Publié' : a.status === 'rejected' ? 'Refusé' : 'En validation'}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucune sortie pour l’instant.</Empty>}
      </section>
    </>
  )
}
