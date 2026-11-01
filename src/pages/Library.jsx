import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useDb, useUser, catalog, owns, fcfa, myLikes } from '../lib/store'
import { trackAudioUrl, isClip } from '../lib/store'
import { useState } from 'react'
import { AlbumCard, TrackRow, Empty } from '../components/ui'

export default function Library() {
  const db = useDb()
  const user = useUser()
  const [sp] = useSearchParams()
  const [clip, setClip] = useState(null)
    if (!user) return <Navigate to="/compte" replace />
  const { albums, tracks } = catalog(db)
  const myTracks = tracks.filter((t) => owns(db, user, { type: 'track', id: t.id }))
  const favs = myLikes(db, user)
  const favTracks = favs.map((id) => tracks.find((t) => t.id === id)).filter(Boolean)
  const myAlbums = albums.filter((a) => owns(db, user, { type: 'album', id: a.id }))
  const history = db.purchases.filter((p) => p.userId === user.id).sort((a, b) => b.at - a.at)
  const nameOf = (p) => (p.itemType === 'album' ? db.albums.find((a) => a.id === p.itemId)?.title : db.tracks.find((t) => t.id === p.itemId)?.title) || '—'

  return (
    <>
      <h1 className="h1">Ma musique</h1>
      {sp.get('achat') === 'ok' && <p className="ok" role="status">Merci pour ton achat ! Tes titres sont disponibles en écoute complète et en téléchargement.</p>}

      {favTracks.length > 0 && (
        <section>
          <h2>{user.role === 'artist' ? 'Titres appréciés' : 'Favoris'}</h2>
          <ul className="tracks">{favTracks.map((t) => <TrackRow key={t.id} t={t} />)}</ul>
        </section>
      )}
      <section>
        <h2>Albums achetés</h2>
        {myAlbums.length ? <div className="grid">{myAlbums.map((al) => <AlbumCard key={al.id} al={al} />)}</div> : <Empty>Aucun album pour l’instant.</Empty>}
      </section>
      <section>
        <h2>Titres achetés</h2>
        {myTracks.length ? (
          <ul className="tracks">
            {myTracks.map((t) => (
              <div key={t.id} className="withdl">
                <TrackRow t={t} />
                {isClip(t) && <button className="btn small buy" type="button" onClick={async () => { try { setClip({ title: t.title, url: await trackAudioUrl(t, 'full') }) } catch (e) { window.alert(e.message) } }}>Regarder le clip</button>}
                <button className="btn small ghost" type="button" onClick={async () => { try { const u = await trackAudioUrl(t, 'full', { download: true }); const a = document.createElement('a'); a.href = u; a.download = `${t.artist.name} - ${t.title}`; document.body.appendChild(a); a.click(); a.remove() } catch (e) { window.alert(e.message) } }}>Télécharger</button>
              </div>
            ))}
          </ul>
        ) : <Empty>Tu n’as pas encore acheté de titre. <Link to="/explorer">Explorer le catalogue</Link></Empty>}
        <p className="muted small">Les titres sans fichier audio envoyé jouent un son de test.</p>
      </section>
      <section>
        <h2>Historique des achats</h2>
        {history.length ? (
          <ul className="tracks">
            {history.map((p) => (
              <li key={p.id} className="track simple">
                <div className="tmeta"><b>{nameOf(p)}</b><span>{new Date(p.at).toLocaleDateString('fr-FR')} · {p.method === 'momo' ? 'MTN Mobile Money' : p.method === 'om' ? 'Orange Money' : 'Carte'}</span></div>
                <span className="price">{fcfa(p.amount)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>Aucun achat.</Empty>}
      </section>
      {clip && (
        <div className="clipmodal" role="dialog" aria-label={`Clip : ${clip.title}`} onClick={() => setClip(null)}>
          <div className="cbox" onClick={(e) => e.stopPropagation()}>
            <video src={clip.url} controls autoPlay playsInline />
            <button className="btn ghost" type="button" onClick={() => setClip(null)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  )
}
