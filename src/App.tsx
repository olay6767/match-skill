import { useEffect, useState } from 'react'
import AdminLogin from './components/AdminLogin'
import Dashboard from './components/dashboard/Dashboard'
import ActivityCreatePage from './components/dashboard/ActivityCreatePage'
import AssessmentSetupPage from './components/assessment/AssessmentSetupPage'
import type { DashboardNav } from './components/layout/DashboardSidebar'
import { getCurrentAdmin, loginAdmin, logoutAdmin } from './lib/api'

function App() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [activePage, setActivePage] = useState<'dashboard' | 'activity-create' | 'assessment-setup'>('dashboard')
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => {
    getCurrentAdmin()
      .then((admin) => setAdminEmail(admin.email))
      .catch(() => setAdminEmail(null))
      .finally(() => setIsCheckingSession(false))
  }, [])

  const handleLogin = async (email: string, password: string, remember: boolean) => {
    const admin = await loginAdmin(email, password, remember)
    setAdminEmail(admin.email)
  }

  const handleLogout = async () => {
    try {
      await logoutAdmin()
    } finally {
      setAdminEmail(null)
    }
  }

  if (isCheckingSession) {
    return <main className="admin-shell">กำลังตรวจสอบการเข้าสู่ระบบ...</main>
  }

  if (adminEmail) {
    const handleNavigate = (item: DashboardNav) => {
      if (item === 'Activities') {
        setActivePage('activity-create')
      } else if (item === 'Assessments') {
        setActivePage('assessment-setup')
      } else if (item === 'Dashboard') {
        setActivePage('dashboard')
      }
    }

    if (activePage === 'activity-create') {
      return (
        <ActivityCreatePage
          adminEmail={adminEmail}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      )
    }

    if (activePage === 'assessment-setup') {
      return (
        <AssessmentSetupPage
          adminEmail={adminEmail}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      )
    }

    return (
      <Dashboard
        adminEmail={adminEmail}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenCreateActivity={() => setActivePage('activity-create')}
      />
    )
  }

  return <AdminLogin onLogin={handleLogin} />
}

export default App
