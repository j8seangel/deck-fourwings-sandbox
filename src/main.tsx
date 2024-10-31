import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import '@globalfishingwatch/ui-components/base.css'
import '@globalfishingwatch/timebar/index.esm.css'
import '@globalfishingwatch/timebar/timebar-settings.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
