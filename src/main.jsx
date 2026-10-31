import React from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/sora/600.css'
import '@fontsource/sora/800.css'
import '@fontsource/nunito-sans/400.css'
import '@fontsource/nunito-sans/600.css'
import './styles.css'
import App from './App'

createRoot(document.getElementById('root')).render(<App />)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
}
