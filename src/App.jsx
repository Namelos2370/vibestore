import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppProvider } from './lib/AppContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import Explore from './pages/Explore'
import Discover from './pages/Discover'
import Notifications from './pages/Notifications'
import Release from './pages/Release'
import Artist from './pages/Artist'
import Cart from './pages/Cart'
import Library from './pages/Library'
import Account from './pages/Account'
import Studio from './pages/Studio'
import Admin from './pages/Admin'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="decouvrir" element={<Discover />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="explorer" element={<Explore />} />
            <Route path="sortie/:id" element={<Release />} />
            <Route path="artiste/:id" element={<Artist />} />
            <Route path="panier" element={<Cart />} />
            <Route path="bibliotheque" element={<Library />} />
            <Route path="compte" element={<Account />} />
            <Route path="studio" element={<Studio />} />
            <Route path="admin" element={<Admin />} />
            <Route path="*" element={<div className="empty">Page introuvable.</div>} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
