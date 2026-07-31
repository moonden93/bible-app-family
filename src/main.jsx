import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import PlanApp from './PlanApp.jsx'

// /plan 경로면 DeCA 브랜딩(manifest/title/아이콘)으로 교체
// 홈 화면 추가 시 기존 필사 앱과 구분되도록
function applyRouteMeta(path) {
  if (!path.startsWith('/plan')) return;
  const setLink = (rel, href, type) => {
    let el = document.querySelector(`link[rel="${rel}"]`);
    if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
    el.setAttribute('href', href);
    if (type) el.setAttribute('type', type);
  };
  const setMeta = (name, content) => {
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('name', name); document.head.appendChild(el); }
    el.setAttribute('content', content);
  };
  setLink('manifest', '/plan-manifest.json');
  setLink('apple-touch-icon', '/icons/deca-icon.svg');
  setLink('icon', '/icons/deca-icon.svg', 'image/svg+xml');
  document.title = 'DeCA';
  setMeta('apple-mobile-web-app-title', 'DeCA');
  setMeta('theme-color', '#1a2a3d');
}

function Root() {
  const path = window.location.pathname;
  applyRouteMeta(path);
  if (path.startsWith('/plan')) return <PlanApp />;
  return <App />;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
