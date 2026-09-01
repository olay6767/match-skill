import { lazy, Suspense } from 'react'

const loadPortalApp = import.meta.env.VITE_PORTAL_MODE === 'user'
  ? () => import('./user/UserApp')
  : () => import('./admin/AdminApp')
const PortalApp = lazy(loadPortalApp)

function App() {
  return <Suspense fallback={<main role="status">กำลังโหลดระบบ...</main>}><PortalApp /></Suspense>
}

export default App
