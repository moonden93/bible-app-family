import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PlanApp from './PlanApp.jsx'

function Root() {
  const path = window.location.pathname;
  if (path.startsWith('/plan')) return <PlanApp />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
