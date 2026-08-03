import { useState } from 'react'
import AdminLogin from './components/AdminLogin'
import Dashboard from './components/dashboard/Dashboard'

function App() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  if (adminEmail) {
    return <Dashboard adminEmail={adminEmail} onLogout={() => setAdminEmail(null)} />
  }

  return <AdminLogin onLogin={setAdminEmail} />
}

export default App
