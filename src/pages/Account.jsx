import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, signIn, signUp, trialDaysLeft } from '../lib/store'

export default function Account() {
  const user = useUser()
  const nav = useNavigate()
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  if (user) {
    return (
      <>
        <h1 className="h1">Mon compte</h1>
        <div className="panel">
          <p><b>{user.name}</b><br /><span className="muted">{user.email}</span></p>
          <p>Statut : {user.role === 'admin' ? 'Administrateur' : user.role === 'artist' ? 'Artiste (compte créé par VibeStore)' : 'Auditeur'}</p>
          <p>Essai gratuit des aperçus de 30 s : <b>{trialDaysLeft(user)} jour(s) restant(s)</b></p>
          <button className="btn buy" type="button" onClick={() => nav('/explorer')}>Écouter de la musique</button>
        </div>
      </>
    )
  }

  async function submit(e) {
    e.preventDefault()
    setErr(''); setInfo('')
    try {
      const u = mode === 'in' ? await signIn(f.email, f.password) : await signUp(f)
      if (u && u.pendingConfirmation) { setInfo(`Un email de confirmation a été envoyé à ${u.email}. Clique sur le lien, puis connecte-toi.`); setMode('in'); return }
      nav(u.role === 'admin' ? '/admin' : u.role === 'artist' ? '/studio' : '/decouvrir')
    } catch (x) { setErr(x.message) }
  }

  return (
    <>
      <h1 className="h1">{mode === 'in' ? 'Connexion' : 'Créer un compte'}</h1>
      <form className="panel form" onSubmit={submit}>
        {mode === 'up' && <label className="field"><span>Nom</span><input id="name" value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label className="field"><span>Email</span><input id="email" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="field"><span>Mot de passe</span><input id="password" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        {info && <p className="ok" role="status">{info}</p>}
        <button className="btn buy wide" type="submit">{mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button className="linkbtn" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr('') }}>
          {mode === 'in' ? 'Pas encore de compte ? Inscris-toi' : 'J’ai déjà un compte'}
        </button>
      </form>

      <p className="muted small">Équipe VibeStore : connecte-toi avec le compte administrateur pour ouvrir le tableau de bord.</p>
    </>
  )
}
