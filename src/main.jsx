import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AppRoot from './components/AppRoot.jsx'

// Lock screen orientation to landscape
if (screen.orientation && screen.orientation.lock) {
  screen.orientation.lock('landscape').catch(err => {
    console.log('Orientation lock not supported:', err);
  });
}

createRoot(document.getElementById('root')).render(<StrictMode><AppRoot /></StrictMode>)
