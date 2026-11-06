import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { isClip, purchaseMedia, useDb, useUser, createArtist, createRelease, updateArtist, updateRelease, updateTrack, deleteArtist, deleteRelease, deleteTrack, createPromo, setPromoActive, deletePromo, deleteNotification, updateSettings, togglePayment, currentCommission, fcfa, MIN_PRICE, openRequests, purchasesOn, livePayments } from '../lib/store'
import { Empty } from '../components/ui'
import LyricsEditor from '../components/LyricsEditor'
import { trackAudioUrl, announce } from '../lib/store'
import { mmss } from '../lib/store'

const COLORS = ['#8B5CF6', '#22D3C5', '#F472B6', '#F59E0B', '#60A5FA']
const emptyRow = () => ({ title: '', price: 1000, duration: 200, audioName: '', file: null, lyrics: '' })

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

function ReleaseForm({ admin, artists, preset, media = 'sound' }) {
  const db = useDb()
  const clip = media === 'clip'
  const [artistId, setArtistId] = useState(preset || '')
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState(media === 'clip' ? 'single' : 'album')
  const [albumPrice, setAlbumPrice] = useState(3000)
  const [color, setColor] = useState(COLORS[0])
  const [rows, setRows] = useState([emptyRow()])
  const [cover, setCover] = useState(null)
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [coverKey, setCoverKey] = useState(0)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const min = db.settings.minPrice
  const upd = (i, k) => (e) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: e.target.value } : r)))
  const pickAudio = (i) => (e) => {
    const file = e.target.files && e.target.files[0]
    if (file) {
      const vid = /^video\//.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name)
      if (clip && !vid) { setErr('Pour un clip, choisis un fichier vidéo MP4.'); e.target.value = ''; return }
      if (!clip && vid) { setErr('Ceci est une vidéo : publie-la dans l’onglet Clips.'); e.target.value = ''; return }
    }
    setErr('')
    setRows(rows.map((r, j) => (j === i ? { ...r, file: file || null, audioName: file ? file.name : '', title: r.title || (file ? file.name.replace(/\.[^.]+$/, '') : '') } : r)))
  }
  async function submit(e) {
    e.preventDefault()
    setErr(''); setOk('')
    if (!(artistId || preset)) { setErr('Choisis d’abord l’artiste concerné.'); return }
    setBusy(true)
    try {
      await createRelease(admin, { artistId: artistId || preset, title, kind, albumPrice, color, tracks: rows, cover, videoUrl, videoFile, media })
      setTitle(''); setRows([emptyRow()]); setCover(null); setVideoUrl(''); setVideoFile(null); setCoverKey((k) => k + 1)
      setOk((clip ? 'Clip publié' : 'Son publié') + ' pour ' + (artists.find((a) => a.id === (artistId || preset))?.name || 'l’artiste') + '.')
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  const shown = kind === 'single' ? rows.slice(0, 1) : rows
  return (
    <form className="panel form" onSubmit={submit}>
      <h2>{clip ? 'Ajouter un clip pour un artiste' : 'Ajouter un son pour un artiste'}</h2>
      <p className="muted small">{clip ? 'Le clip est publié dans l’espace Clips. Le public écoute gratuitement un extrait de 30 s (le son du clip) ; l’acheteur reçoit le clip complet.' : 'Le son est publié directement dans l’espace Sons, sans étape de validation.'}</p>
      <div className="row wrap">
        <label className="field grow2"><span>Artiste</span>
          <select id="rartist" required value={artistId} onChange={(e) => setArtistId(e.target.value)}>
            <option value="">Choisis un artiste…</option>
            {artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="field grow"><span>Type</span>
          <select id="rkind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="album">{clip ? 'Pack de clips' : 'Album'}</option><option value="single">{clip ? 'Clip seul' : 'Single'}</option></select>
        </label>
      </div>
      <div className="row wrap">
        <label className="field grow2"><span>{clip ? 'Titre du clip ou du pack' : 'Titre de la sortie'}</span><input id="rtitle" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        {kind === 'album' && (
          <label className="field grow"><span>Prix du {clip ? 'pack' : 'album'} (min. {fcfa(min)})</span>
            <input id="aprice" type="number" min={min} step="100" value={albumPrice} onChange={(e) => setAlbumPrice(e.target.value)} />
          </label>
        )}
      </div>
      <label className="field"><span>{clip ? 'Affiche du clip' : 'Pochette'} (image JPG ou PNG){cover ? ` : ${cover.name}` : ''}</span>
        <input key={coverKey} id="rcover" type="file" onChange={(e) => setCover((e.target.files && e.target.files[0]) || null)} />
      </label>
      {!clip && <label className="field"><span>Clip promotionnel gratuit : lien YouTube (facultatif)</span>
        <input id="rvideo" type="url" placeholder="https://youtu.be/…" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />
      </label>}
      {!clip && <label className="field"><span>… ou fichier vidéo promo MP4 (50 Mo max){videoFile ? ` : ${videoFile.name}` : ''}</span>
        <input key={'v' + coverKey} id="rvideofile" type="file" onChange={(e) => setVideoFile((e.target.files && e.target.files[0]) || null)} />
      </label>}
      <div className="field"><span>Couleur de secours si pas d’image</span>
        <div className="row">{COLORS.map((c) => (
          <button key={c} type="button" aria-label={'Couleur ' + c} aria-pressed={color === c} className={'swatch' + (color === c ? ' on' : '')} style={{ background: c }} onClick={() => setColor(c)} />
        ))}</div>
      </div>
      <h3>{clip ? 'Clips' : 'Titres'}</h3>
      {shown.map((r, i) => (
        <div key={i} className="row wrap trow">
          <label className="field grow2"><span>{clip ? 'Clip' : 'Titre'} {i + 1}</span><input id={'tt' + i} value={r.title} onChange={upd(i, 'title')} /></label>
          <label className="field"><span>Prix (FCFA, min. {min})</span><input id={'tp' + i} type="number" min={min} step="100" value={r.price} onChange={upd(i, 'price')} /></label>
          <label className="field"><span>Durée (s, auto avec un fichier)</span><input id={'td' + i} type="number" min="30" value={r.duration} onChange={upd(i, 'duration')} /></label>
          <label className="field grow2"><span>{clip ? 'Fichier vidéo du clip (MP4, 50 Mo max)' : 'Fichier audio (MP3, M4A ou WAV)'}{r.audioName ? ` : ${r.audioName}` : ''}</span>
            <input id={'ta' + i} type="file" accept={clip ? 'video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm' : 'audio/*,.mp3,.m4a,.wav'} onChange={pickAudio(i)} />
          </label>
          {!clip && <div className="grow2" style={{ flexBasis: '100%' }}>
            <LyricsEditor value={r.lyrics} onChange={(v) => setRows((rs) => rs.map((x, j) => (j === i ? { ...x, lyrics: v } : x)))}
              getSrc={async () => (r.file ? URL.createObjectURL(r.file) : null)} />
          </div>}
        </div>
      ))}
      {kind === 'album' && <button className="btn small ghost" type="button" onClick={() => setRows([...rows, emptyRow()])}>+ Ajouter {clip ? 'un clip' : 'un titre'}</button>}
      <p className="muted small">Le fichier complet est stocké en privé (accessible seulement après achat). La durée et l’extrait gratuit de 30 s sont créés automatiquement{clip ? ' à partir du son du clip : le clip complet reste privé et n’est visible que par l’acheteur' : ''}. Sans fichier, un son de test est utilisé. Taille maximum : 50 Mo par titre.</p>
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      <button className="btn buy" type="submit" disabled={busy}>{busy ? 'Envoi en cours…' : clip ? 'Publier le clip' : 'Publier le son'}</button>
    </form>
  )
}


function CatalogManager({ admin, onSheet, mode = 'artists' }) {
  const db = useDb()
  const [edit, setEdit] = useState(null) // { kind, id, f }
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState({})
  const [q, setQ] = useState('')
  const [flt, setFlt] = useState('all')
  async function run(fn) { setMsg(''); try { await fn() ; setEdit(null) } catch (e) { setMsg(e.message) } }
  const hidden = (x) => x.status === 'rejected'
  const st = (x) => (hidden(x) ? 'approved' : 'rejected')
  const ask = (t) => window.confirm(t)
  const field = (k, props = {}) => (
    <input value={edit.f[k] ?? ''} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, [k]: e.target.value } })} {...props} />
  )
  const isEd = (kind, id) => edit && edit.kind === kind && edit.id === id
  const media = mode !== 'artists'
  const inMode = (t) => !media || (mode === 'clip') === isClip(t)
  const tracksOf = (rid) => db.tracks.filter((t) => t.albumId === rid && inMode(t))
  const isEmpty = (r) => !db.tracks.some((t) => t.albumId === r.id)
  const relsOf = (id) => db.albums.filter((r) => r.artistId === id && (!media || tracksOf(r.id).length > 0 || (mode === 'sound' && isEmpty(r))))
  const isOpen = (id) => media && open[id] !== false
  const nSounds = (id) => db.tracks.filter((t) => t.artistId === id && !isClip(t)).length
  const nClips = (id) => db.tracks.filter((t) => t.artistId === id && isClip(t)).length
  const FILTERS = [['all', 'Tous', () => true], ['active', 'Actifs', (a) => a.account === 'active' && !hidden(a)], ['invited', 'Invitations', (a) => a.account !== 'active'], ['hidden', 'Masqués', (a) => hidden(a) || a.status === 'pending']]
  const pass = (a) => (FILTERS.find((x) => x[0] === flt) || FILTERS[0])[2](a) && (!q.trim() || a.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <section>
      <h2>{mode === 'sound' ? 'Sons en ligne' : mode === 'clip' ? 'Clips en ligne' : 'Artistes du catalogue'}</h2>
      {msg && <p className="err" role="alert">{msg}</p>}
      {db.artists.length === 0 && <Empty>Aucun artiste pour le moment. Ajoute le premier dans l’onglet Artistes.</Empty>}
      {media && db.artists.length > 0 && !db.artists.some((a) => relsOf(a.id).length) && <Empty>{mode === 'clip' ? 'Aucun clip pour le moment. Publie le premier ci-dessous.' : 'Aucun son pour le moment. Publie le premier ci-dessous.'}</Empty>}
      {!media && db.artists.length > 3 && (
        <div className="filterbar">
          <input type="search" aria-label="Chercher un artiste" placeholder="Chercher un artiste…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="chips" role="group" aria-label="Filtrer">
            {FILTERS.map(([k, l, fn]) => <button key={k} type="button" className={flt === k ? 'on' : ''} aria-pressed={flt === k} onClick={() => setFlt(k)}>{l} <span>{db.artists.filter(fn).length}</span></button>)}
          </div>
        </div>
      )}
      {!media && db.artists.length > 3 && !db.artists.some(pass) && <Empty>Aucun artiste ne correspond.</Empty>}
      <ul className="tracks">
        {[...db.artists].reverse().filter((a) => (media ? relsOf(a.id).length : pass(a))).map((a) => {
          const rels = relsOf(a.id)
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
                  <div className="tmeta grow"><b>{a.name}{a.verified && <Verified />}{hidden(a) && <span className="badge"> {a.status === 'pending' ? 'Archivé' : 'Suspendu'}</span>}{a.status === 'pending' && !hidden(a) && <span className="badge"> Archivé</span>}</b><span>{a.genre || 'Genre non précisé'} · {nSounds(a.id)} son(s) · {nClips(a.id)} clip(s) · {a.account === 'active' ? 'Compte actif' : 'Invitation en attente'}</span></div>
                  <button className="btn small buy" type="button" onClick={() => onSheet(a.id)}>Fiche</button>
                  {media && <button className="btn small ghost" type="button" onClick={() => setOpen({ ...open, [a.id]: !isOpen(a.id) })}>{isOpen(a.id) ? 'Replier' : 'Déplier'}</button>}
                  {!media && <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'artist', id: a.id, f: { name: a.name, genre: a.genre, bio: a.bio } })}>Modifier</button>}
                  {!media && <button className="btn small ghost" type="button" onClick={() => run(() => updateArtist(admin, a.id, { name: a.name, genre: a.genre, bio: a.bio, status: st(a) }))}>{hidden(a) ? 'Réafficher' : 'Masquer'}</button>}
                  {!media && <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer ${a.name} définitivement ? Ses sorties, ses titres, ses fichiers, ses annonces et ses informations (contrat, versements, demandes) seront effacés. Cette action est irréversible.`) && run(() => deleteArtist(admin, a.id))}>Supprimer</button>}
                </div>
              )}
              {isOpen(a.id) && (
                <ul className="sub">
                  {rels.length === 0 && <li className="muted small">Aucune sortie.</li>}
                  {rels.map((r) => (
                    <li key={r.id}>
                      {isEd('release', r.id) ? (
                        <div className="row wrap">
                          <label className="field grow2"><span>Titre de la sortie</span>{field('title')}</label>
                          <label className="field grow2" style={{ flexBasis: '100%' }}><span>Artiste</span>
                            <select value={edit.f.artistId} onChange={(e) => setEdit({ ...edit, f: { ...edit.f, artistId: e.target.value } })}>{db.artists.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
                          </label>
                          <label className="field"><span>Prix (min. {db.settings.minPrice})</span>{field('price', { type: 'number', min: db.settings.minPrice, step: 100 })}</label>
                          <label className="field grow2" style={{ flexBasis: '100%' }}><span>Clip : lien YouTube ou vidéo</span>{field('videoUrl', { type: 'url', placeholder: 'https://youtu.be/…' })}</label>
                          <button className="btn small buy" type="button" onClick={() => run(() => updateRelease(admin, r.id, { ...edit.f, color: r.color, status: r.status }))}>Enregistrer</button>
                          <button className="btn small ghost" type="button" onClick={() => setEdit(null)}>Annuler</button>
                        </div>
                      ) : (
                        <div className="row wrap mrow">
                          <div className="tmeta grow"><b>{r.title}{hidden(r) && <span className="badge"> Masqué</span>}{isEmpty(r) && <span className="badge"> Vide : à supprimer</span>}</b><span>{r.kind === 'album' ? 'Album' : 'Single'} · {fcfa(r.price)} · {tracksOf(r.id).length} titre(s)</span></div>
                          <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'release', id: r.id, f: { title: r.title, price: r.price, videoUrl: r.videoUrl || '', artistId: r.artistId } })}>Modifier</button>
                          <button className="btn small ghost" type="button" onClick={() => run(() => updateRelease(admin, r.id, { title: r.title, price: r.price, color: r.color, status: st(r), videoUrl: r.videoUrl }))}>{hidden(r) ? 'Réafficher' : 'Masquer'}</button>
                          <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer « ${r.title} » définitivement, avec ses titres, ses fichiers et son annonce ?`) && run(() => deleteRelease(admin, r.id))}>Supprimer</button>
                        </div>
                      )}
                      <ul className="sub">
                        {tracksOf(r.id).map((t) => (
                          <li key={t.id}>
                            {isEd('track', t.id) ? (
                              <div className="row wrap">
                                <label className="field grow2"><span>Titre</span>{field('title')}</label>
                                <label className="field"><span>Prix (min. {db.settings.minPrice})</span>{field('price', { type: 'number', min: db.settings.minPrice, step: 100 })}</label>
                                {!isClip(t) && <div style={{ flexBasis: '100%' }}>
                                  <LyricsEditor value={edit.f.lyrics || ''} onChange={(v) => setEdit({ ...edit, f: { ...edit.f, lyrics: v } })} getSrc={() => trackAudioUrl({ ...t, artist: a }, 'full')} />
                                </div>}
                                <button className="btn small buy" type="button" onClick={() => run(() => updateTrack(admin, t.id, { ...edit.f, status: t.status }))}>Enregistrer</button>
                                <button className="btn small ghost" type="button" onClick={() => setEdit(null)}>Annuler</button>
                              </div>
                            ) : (
                              <div className="row wrap mrow">
                                <div className="tmeta grow"><span>{t.title}{hidden(t) && <span className="badge"> Masqué</span>} · {fcfa(t.price)} · {mmss(t.duration)}{t.audioPath ? '' : isClip(t) ? ' · clip de test' : ' · son de test'}{t.lyrics ? ' · paroles' : ''}</span></div>
                                <button className="btn small ghost" type="button" onClick={() => setEdit({ kind: 'track', id: t.id, f: { title: t.title, price: t.price, lyrics: t.lyrics || '' } })}>Modifier</button>
                                <button className="btn small ghost" type="button" onClick={() => run(() => updateTrack(admin, t.id, { title: t.title, price: t.price, status: st(t), lyrics: t.lyrics }))}>{hidden(t) ? 'Réafficher' : 'Masquer'}</button>
                                <button className="btn small ghost danger" type="button" onClick={() => ask(`Supprimer « ${t.title} » définitivement, avec son fichier et son annonce ?`) && run(() => deleteTrack(admin, t.id))}>Supprimer</button>
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

function AnnounceForm({ admin }) {
  const db = useDb()
  const [f, setF] = useState({ title: '', body: '', url: '/' })
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  async function send(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true)
    try {
      const r = await announce(admin, f)
      setOk(r && r.error ? 'Annonce publiée dans l’app. L’envoi sur les téléphones n’est pas encore configuré.' : `Annonce publiée. Envoyée à ${r.sent || 0} appareil(s).`)
      setF({ title: '', body: '', url: '/' })
    } catch (x) { setErr(x.message) } finally { setBusy(false) }
  }
  return (
    <form className="panel form" onSubmit={send}>
      <h2>Envoyer une annonce</h2>
      <p className="muted small">Elle apparaît dans la cloche de l’app et arrive en notification sur les téléphones qui l’ont activée. Les nouvelles sorties sont annoncées automatiquement.</p>
      <button className="btn small ghost" type="button" onClick={() => setF({ ...f, title: f.title.startsWith('Blue Energy') ? f.title : 'Blue Energy · ' + f.title, url: 'https://blue-energy-store.vercel.app/#collection' })}>Message partenaire Blue Energy</button>
      <label className="field"><span>Titre</span><input id="ntitle" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Nouveau single de …" /></label>
      <label className="field"><span>Message (facultatif)</span><input id="nbody" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></label>
      <label className="field"><span>Page à ouvrir au clic</span><input id="nurl" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="/decouvrir" /></label>
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="ok" role="status">{ok}</p>}
      <button className="btn buy" type="submit" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</button>
      <h3>Annonces publiées</h3>
      {db.notifications.length === 0 && <p className="muted small">Aucune annonce.</p>}
      <ul className="tracks">
        {db.notifications.map((n) => (
          <li key={n.id} className="row wrap mrow">
            <div className="tmeta grow"><b>{n.title}</b><span>{n.body ? n.body + ' · ' : ''}{new Date(n.at).toLocaleDateString('fr-FR')}</span></div>
            <button className="btn small ghost danger" type="button" onClick={() => window.confirm('Supprimer cette annonce ? Elle disparaît de la cloche pour tout le monde.') && deleteNotification(admin, n.id).catch((x) => setErr(x.message))}>Supprimer</button>
          </li>
        ))}
      </ul>
      <p className="muted small">Une notification déjà reçue sur un téléphone ne peut pas être rappelée ; elle disparaît seulement de la cloche de l’app.</p>
    </form>
  )
}

import AdminOverview from './AdminOverview'
import MembersTab from './AdminMembers'
import { ArtistSheet, PayoutsTab, RequestsTab } from './AdminArtists'
import { Icon, Verified } from '../components/Icon'

function exportSales(db) {
  const q = (x) => '"' + String(x).replace(/"/g, '""') + '"'
  const rows = [['Date', 'Titre ou album', 'Artiste', 'Montant FCFA', 'Commission %', 'Moyen']]
  db.purchases.forEach((p) => rows.push([new Date(p.at).toLocaleString('fr-FR'), (p.itemType === 'album' ? db.albums : db.tracks).find((x) => x.id === p.itemId)?.title || '', db.artists.find((a) => a.id === p.artistId)?.name || '', p.amount, p.commissionPct, p.method]))
  const blob = new Blob(['\ufeff' + rows.map((r) => r.map(q).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ventes-vibestore.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}


function PromoManager({ admin, db }) {
  const [f, setF] = useState({ title: '', brand: 'Blue Energy', videoUrl: '', ctaLabel: '', ctaUrl: '' })
  const [file, setFile] = useState(null)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  async function submit(e) {
    e.preventDefault(); setErr(''); setOk(''); setBusy(true)
    try { await createPromo(admin, { ...f, videoFile: file }); setF({ ...f, title: '', videoUrl: '', ctaLabel: '', ctaUrl: '' }); setFile(null); setOk('Publicité ajoutée. Elle apparaît dans Découvrir et dans Clips.') } catch (x) { setErr(x.message) }
    setBusy(false)
  }
  return (
    <>
      <form className="panel form" onSubmit={submit}>
        <h2>Ajouter une publicité</h2>
        <p className="muted small">Vidéo promotionnelle d’une marque partenaire (par exemple Blue Energy). Rien à vendre : elle s’affiche, étiquetée « Publicité », toutes les quatre vidéos environ dans Découvrir et dans Clips.</p>
        <label className="field"><span>Titre</span><input id="ptitle" value={f.title} onChange={set('title')} placeholder="Ex. Blue Energy : nouvelle collection" /></label>
        <label className="field"><span>Marque</span><input id="pbrand" value={f.brand} onChange={set('brand')} /></label>
        <label className="field"><span>Lien YouTube de la vidéo</span><input id="pvideo" type="url" value={f.videoUrl} onChange={set('videoUrl')} placeholder="https://youtu.be/…" /></label>
        <label className="field"><span>… ou fichier vidéo MP4 (50 Mo max){file ? ` : ${file.name}` : ''}</span><input id="pfile" type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
        <div className="row wrap">
          <label className="field grow"><span>Bouton (facultatif)</span><input id="pcta" value={f.ctaLabel} onChange={set('ctaLabel')} placeholder="Découvrir la boutique" /></label>
          <label className="field grow2"><span>Lien du bouton</span><input id="pcturl" type="url" value={f.ctaUrl} onChange={set('ctaUrl')} placeholder="https://…" /></label>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        {ok && <p className="ok" role="status">{ok}</p>}
        <button className="btn buy" type="submit" disabled={busy}>{busy ? 'Envoi en cours…' : 'Publier la publicité'}</button>
      </form>
      <section>
        <h2>Publicités ({(db.promos || []).length})</h2>
        {(db.promos || []).length ? (
          <ul className="tracks">{db.promos.map((p) => (
            <li key={p.id} className="track simple">
              <div className="tmeta grow"><b>{p.title}</b><span>{p.brand} · {p.views} vue(s) · {p.active ? 'Diffusée' : 'En pause'}</span></div>
              <button className="btn small ghost" type="button" onClick={() => setPromoActive(admin, p.id, !p.active)}>{p.active ? 'Mettre en pause' : 'Diffuser'}</button>
              <button className="btn small ghost danger" type="button" onClick={() => window.confirm('Supprimer cette publicité ?') && deletePromo(admin, p.id)}>Supprimer</button>
            </li>
          ))}</ul>
        ) : <Empty>Aucune publicité pour le moment.</Empty>}
      </section>
    </>
  )
}

const ADMIN_GROUPS = [
  { id: 'pilotage', label: 'Aperçu', tabs: [['apercu', 'Aperçu']] },
  { id: 'catalogue', label: 'Catalogue', tabs: [['artistes', 'Artistes'], ['sons', 'Sons'], ['clips', 'Clips'], ['promos', 'Publicités']] },
  { id: 'communaute', label: 'Membres', tabs: [['inscrits', 'Inscrits'], ['demandes', 'Demandes'], ['annonces', 'Annonces']] },
  { id: 'finances', label: 'Finances', tabs: [['ventes', 'Ventes'], ['reversements', 'Reversements']] },
  { id: 'reglages', label: 'Réglages', tabs: [['reglages', 'Réglages']] },
]
// Navigation à deux niveaux : un groupe, puis ses pages. Reste sur une ligne sur téléphone.
function AdminNav({ tab, setTab, pending }) {
  const group = ADMIN_GROUPS.find((g) => g.tabs.some(([k]) => k === tab)) || ADMIN_GROUPS[0]
  return (
    <nav className="adminnav" aria-label="Sections de l’administration">
      <div className="agroups" role="tablist">
        {ADMIN_GROUPS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={g.id === group.id} className={'agroup' + (g.id === group.id ? ' on' : '')} onClick={() => setTab(g.tabs[0][0])}>
            {g.label}{g.id === 'communaute' && pending > 0 && <i className="dot" aria-label={`${pending} demande(s)`}>{pending}</i>}
          </button>
        ))}
      </div>
      {group.tabs.length > 1 && (
        <div className="asubs" role="tablist">
          {group.tabs.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={'asub' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}{k === 'demandes' && pending > 0 ? ` (${pending})` : ''}</button>
          ))}
        </div>
      )}
    </nav>
  )
}

export default function Admin() {
  const db = useDb()
  const user = useUser()
  const [tab, setTab] = useState('apercu')
  const [sheetId, setSheetId] = useState(null)
  const openSheet = (id) => { setSheetId(id); setTab('artistes'); setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 50) }
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
      <AdminNav tab={tab} setTab={setTab} pending={openRequests(db)} />

      {tab === 'apercu' && <AdminOverview db={db} go={setTab} />}

      {tab === 'artistes' && (
        <>
          {sheetId && db.artists.find((a) => a.id === sheetId) && <ArtistSheet key={sheetId} admin={user} artist={db.artists.find((a) => a.id === sheetId)} onClose={() => setSheetId(null)} />}
          <CatalogManager admin={user} onSheet={setSheetId} />
          <ArtistForm admin={user} />
        </>
      )}

      {tab === 'promos' && <PromoManager admin={user} db={db} />}

      {tab === 'sons' && (
        <>
          <CatalogManager admin={user} onSheet={openSheet} mode="sound" />
          {db.artists.length > 0 ? <ReleaseForm key={'s' + db.artists.length} admin={user} artists={db.artists} media="sound" /> : <Empty>Crée d’abord un artiste dans l’onglet Artistes.</Empty>}
        </>
      )}

      {tab === 'clips' && (
        <>
          <CatalogManager admin={user} onSheet={openSheet} mode="clip" />
          {db.artists.length > 0 ? <ReleaseForm key={'c' + db.artists.length} admin={user} artists={db.artists} media="clip" /> : <Empty>Crée d’abord un artiste dans l’onglet Artistes.</Empty>}
        </>
      )}

      {tab === 'inscrits' && <MembersTab db={db} admin={user} />}
      {tab === 'reversements' && <PayoutsTab onOpen={openSheet} />}
      {tab === 'demandes' && <RequestsTab admin={user} />}

      {tab === 'annonces' && <AnnounceForm admin={user} />}

      {tab === 'ventes' && (
        <>
          <div className="stats">
            <div className="stat"><span>Ventes</span><b>{db.purchases.length}</b></div>
            <div className="stat"><span>Chiffre d’affaires</span><b>{fcfa(gross)}</b></div>
            <div className="stat hi"><span>Commission VibeStore</span><b>{fcfa(fee)}</b></div>
          </div>
          {db.purchases.length > 0 && <button className="btn small ghost" type="button" onClick={() => exportSales(db)}>Exporter en CSV</button>}
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
          <section className="panel">
            <h2>Achats</h2>
            <p className="muted">En attendant le branchement des paiements, tu peux fermer les achats : les boutons d’achat et le panier disparaissent, les extraits et les j’aime restent ouverts. Les achats déjà faits ne changent pas.</p>
            <p>État actuel : <b>{purchasesOn(db) ? 'achats ouverts' : 'achats fermés'}</b></p>
            <button className={'btn ' + (purchasesOn(db) ? 'ghost' : 'buy')} type="button" onClick={async () => { try { await updateSettings({ purchasesEnabled: !purchasesOn(db) }) } catch (x) { window.alert(x.message) } }}>{purchasesOn(db) ? 'Fermer les achats' : 'Rouvrir les achats'}</button>
          </section>
          <section className="panel">
            <h2>Mode de paiement</h2>
            <p className="muted">En simulation, personne n’est débité. En réel, le client valide un paiement Mobile Money (MTN ou Orange) sur son téléphone et l’achat n’est débloqué qu’une fois l’opérateur confirmé. Le réel exige que les variables du serveur soient configurées.</p>
            <p>Mode actuel : <b>{livePayments(db) ? 'paiement réel' : 'simulation'}</b></p>
            <button className={'btn ' + (livePayments(db) ? 'ghost' : 'buy')} type="button" onClick={async () => { if (!livePayments(db) && !window.confirm('Passer en paiement RÉEL ? Les clients seront vraiment débités.')) return; try { await updateSettings({ demoPayments: livePayments(db) }) } catch (x) { window.alert(x.message) } }}>{livePayments(db) ? 'Revenir à la simulation' : 'Activer le paiement réel'}</button>
          </section>
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
