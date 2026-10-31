import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUser, signIn, signUp, resetDemo, trialDaysLeft } from '../lib/store'

export default function Account() {
  const user = useUser()
  const nav = useNavigate()
    const [mode, setMode] = useState('in')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
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

  function submit(e) {
    e.preventDefault()
    setErr('')
    try {
      if (mode === 'in') signIn(f.email, f.password)
      else signUp(f)
      nav('/explorer')
    } catch (x) { setErr(x.message) }
  }
  function quick(email, password) { try { signIn(email, password); nav('/') } catch (x) { setErr(x.message) } }

  return (
    <>
      <h1 className="h1">{mode === 'in' ? 'Connexion' : 'Créer un compte'}</h1>
      <form className="panel form" onSubmit={submit}>
        {mode === 'up' && <label className="field"><span>Nom</span><input id="name" value={f.name} onChange={set('name')} autoComplete="name" /></label>}
        <label className="field"><span>Email</span><input id="email" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
        <label className="field"><span>Mot de passe</span><input id="password" type="password" value={f.password} onChange={set('password')} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></label>
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn buy wide" type="submit">{mode === 'in' ? 'Se connecter' : 'Créer mon compte'}</button>
        <button className="linkbtn" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr('') }}>
          {mode === 'in' ? 'Pas encore de compte ? Inscris-toi' : 'J’ai déjà un compte'}
        </button>
      </form>

      <section className="panel demo">
        <h2>Comptes de démonstration</h2>
        <div className="row wrap">
          <button className="btn small ghost" type="button" onClick={() => quick('admin@vibestore.demo', 'admin123')}>Admin</button>
          <button className="btn small ghost" type="button" onClick={() => quick('artiste@vibestore.demo', 'artiste123')}>Artiste (Nadège)</button>
          <button className="btn small ghost" type="button" onClick={() => quick('amina@vibestore.demo', 'amina123')}>Artiste invitée (Amina)</button>
          <button className="btn small ghost" type="button" onClick={() => { resetDemo(); setErr('') }}>Réinitialiser la démo</button>
        </div>
      </section>
    </>
  )
}
