import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../lib/AppContext'
import { useDb, useUser, catalog, checkout, owns, fcfa, purchasesOn } from '../lib/store'
import { Empty } from '../components/ui'

export default function Cart() {
  const db = useDb()
  const user = useUser()
  const nav = useNavigate()
  const { cart, removeFromCart, clearCart } = useApp()
  const { albums, tracks } = catalog(db)
  const methods = db.settings.paymentMethods.filter((m) => m.enabled)
  const [method, setMethod] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (!purchasesOn(db)) return <Empty>Les achats ouvrent bientôt. En attendant, écoute les extraits de 30 s et ajoute tes ♥ : tu seras prévenu dès l’ouverture.</Empty>

  const lines = cart
    .map((c) => {
      const src = c.type === 'album' ? albums.find((a) => a.id === c.id) : tracks.find((t) => t.id === c.id)
      return src ? { ...c, title: src.title, by: src.artist.name, price: src.price } : null
    })
    .filter(Boolean)
  const total = lines.reduce((s, l) => s + l.price, 0)
  const chosen = method || methods[0]?.id || ''
  const needsPhone = chosen === 'momo' || chosen === 'om'

  async function pay() {
    setErr('')
    if (!user) { nav('/compte'); return }
    if (needsPhone && !/^(\+?237)?\s?6\d{8}$/.test(phone.replace(/\s/g, ''))) {
      setErr('Entre un numéro camerounais valide, par exemple 6 70 00 00 00.')
      return
    }
    setBusy(true)
    await new Promise((r) => setTimeout(r, 1200)) // simulation de la validation par l'opérateur
    try {
      await checkout(user, lines.map((l) => ({ type: l.type, id: l.id })), chosen)
      clearCart()
      nav('/bibliotheque?achat=ok')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!lines.length) return (<><h1 className="h1">Panier</h1><Empty>Ton panier est vide. <Link to="/explorer">Explorer le catalogue</Link></Empty></>)

  return (
    <>
      <h1 className="h1">Panier</h1>
      <ul className="tracks">
        {lines.map((l) => (
          <li key={l.type + l.id} className="track simple">
            <div className="tmeta"><b>{l.title}</b><span>{l.type === 'album' ? 'Album / single' : 'Titre'} · {l.by}</span></div>
            <span className="price">{fcfa(l.price)}</span>
            <button className="btn small ghost" type="button" onClick={() => removeFromCart(l.type, l.id)}>Retirer</button>
          </li>
        ))}
      </ul>
      <div className="total"><span>Total</span><b>{fcfa(total)}</b></div>

      <section className="panel">
        <h2>Paiement</h2>
        {!methods.length && <p className="err">Aucun moyen de paiement n’est activé pour le moment.</p>}
        <div className="radios" role="radiogroup" aria-label="Moyen de paiement">
          {methods.map((m) => (
            <label key={m.id} className={'radio' + (chosen === m.id ? ' on' : '')}>
              <input type="radio" name="pay" checked={chosen === m.id} onChange={() => setMethod(m.id)} />{m.label}
            </label>
          ))}
        </div>
        {needsPhone && (
          <label className="field"><span>Numéro Mobile Money</span>
            <input id="phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="6 70 00 00 00" />
          </label>
        )}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn buy wide" type="button" disabled={busy || !methods.length} onClick={pay}>
          {busy ? 'Validation en cours…' : user ? `Payer ${fcfa(total)}` : 'Se connecter pour payer'}
        </button>
        <p className="muted small">Démonstration : le paiement est simulé, rien n’est débité.</p>
      </section>
    </>
  )
}
