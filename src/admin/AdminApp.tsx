import { useEffect, useState } from 'react'
import AdminLogin from './components/AdminLogin'
import AdminPasswordPage from './components/AdminPasswordPage'
import Dashboard from './components/dashboard/Dashboard'
import ActivityCreatePage from './components/dashboard/ActivityCreatePage'
import AssessmentSetupPage from './components/assessment/AssessmentSetupPage'
import AssessmentPreviewPage from './components/assessment/AssessmentPreviewPage'
import ActivitiesPage from './components/dashboard/ActivitiesPage'
import ActivityDetailPage from './components/activities/ActivityDetailPage'
import ParticipantsPage from './components/participants/ParticipantsPage'
import ActivityAnalysisSelectionPage from './components/analytics/ActivityAnalysisSelectionPage'
import ActivityAnalysisDetailPage from './components/analytics/ActivityAnalysisDetailPage'
import CombinedActivityAnalysisPage from './components/analytics/CombinedActivityAnalysisPage'
import ReportsPage from './components/reports/ReportsPage'
import StaffPage from './components/staff/StaffPage'
import type { DashboardNav } from './components/layout/DashboardSidebar'
import { getCurrentAdmin, loginAdmin, logoutAdmin, setUnauthorizedHandler } from '../lib/api'
import RouteRedirect from '../shared/RouteRedirect'
import { usePathname } from '../shared/usePathname'

function adminPageTitle(path: string) {
  if (path === '/admin/login') return 'เข้าสู่ระบบผู้ดูแล | SEDA Admin'
  if (path.startsWith('/admin/dashboard') || path === '/admin' || path === '/') return 'ภาพรวมกิจกรรม | SEDA Admin'
  if (path.startsWith('/admin/activities/new')) return 'สร้างกิจกรรม | SEDA Admin'
  if (/^\/admin\/activities\/\d+\/edit$/.test(path)) return 'แก้ไขกิจกรรม | SEDA Admin'
  if (/^\/admin\/activities\/\d+$/.test(path)) return 'รายละเอียดกิจกรรม | SEDA Admin'
  if (path.startsWith('/admin/activities')) return 'กิจกรรม | SEDA Admin'
  if (path === '/admin/assessments/preview') return 'ตัวอย่างแบบสอบถาม | SEDA Admin'
  if (path.startsWith('/admin/assessments')) return 'พรีวิวแบบประเมิน | SEDA Admin'
  if (path.startsWith('/admin/participants')) return 'นักศึกษาและผู้เข้าร่วม | SEDA Admin'
  if (path.startsWith('/admin/analytics')) return 'วิเคราะห์กิจกรรม | SEDA Admin'
  if (path.startsWith('/admin/reports')) return 'รายงาน | SEDA Admin'
  if (path.startsWith('/admin/staff')) return 'จัดการผู้ดูแล | SEDA Admin'
  return 'SEDA Admin'
}

const navRoutes: Partial<Record<DashboardNav, string>> = {
  Dashboard: '/admin/dashboard', Activities: '/admin/activities', Assessments: '/admin/assessments', Participants: '/admin/participants', Analytics: '/admin/analytics', Reports: '/admin/reports', Staff: '/admin/staff',
}

function AdminApp() {
  const [path, navigate] = usePathname()
  const [adminSession, setAdminSession] = useState<{ email: string; role: string } | null>(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)

  useEffect(() => { document.title = adminPageTitle(path) }, [path])
  useEffect(() => {
    getCurrentAdmin()
      .then((admin) => setAdminSession({ email: admin.email, role: admin.role }))
      .catch(() => setAdminSession(null))
      .finally(() => setIsCheckingSession(false))
  }, [])
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAdminSession(null)
      window.history.replaceState({}, '', '/admin/login')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    return () => setUnauthorizedHandler(undefined)
  }, [])
  useEffect(() => {
    if (isCheckingSession) return
    if (adminSession && ['/admin/login', '/admin/forgot-password', '/admin/reset-password'].includes(path)) navigate('/admin/dashboard', true)
    else if (!adminSession && path.startsWith('/admin/') && !['/admin/login', '/admin/forgot-password', '/admin/reset-password'].includes(path)) navigate('/admin/login', true)
  }, [adminSession, isCheckingSession, navigate, path])

  if (path === '/') return <RouteRedirect to="/admin/login" navigate={navigate} />
  if (!path.startsWith('/admin')) return <RouteRedirect to="/admin/login" navigate={navigate} />

  const handleLogin = async (email: string, password: string, remember: boolean) => {
    const admin = await loginAdmin(email, password, remember)
    setAdminSession({ email: admin.email, role: admin.role })
    navigate('/admin/dashboard', true)
  }
  const handleLogout = async () => {
    try { await logoutAdmin() } finally { setAdminSession(null); navigate('/admin/login', true) }
  }
  const handleNavigate = (item: DashboardNav) => navigate(navRoutes[item] ?? '/admin/dashboard')

  if (isCheckingSession) return <main className="admin-shell" role="status">กำลังตรวจสอบการเข้าสู่ระบบ...</main>
  if (path === '/admin/forgot-password') return <AdminPasswordPage mode="forgot" onNavigate={navigate} />
  if (path === '/admin/reset-password') return <AdminPasswordPage mode="reset" onNavigate={navigate} />
  if (!adminSession) return <AdminLogin onLogin={handleLogin} />

  const adminEmail = adminSession.email
  const isSuperAdmin = adminSession.role === 'super_admin'
  const settings = () => navigate('/admin/change-password')
  if (path === '/admin/change-password') return <AdminPasswordPage mode="change" onNavigate={navigate} onPasswordChanged={() => { setAdminSession(null); navigate('/admin/login', true) }} />
  if (path === '/admin/activities/new') return <ActivityCreatePage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  const activityEditMatch = path.match(/^\/admin\/activities\/(\d+)\/edit$/)
  if (activityEditMatch) return <ActivityCreatePage activityId={Number(activityEditMatch[1])} adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  const activityDetailMatch = path.match(/^\/admin\/activities\/(\d+)$/)
  if (activityDetailMatch) return <ActivityDetailPage activityId={Number(activityDetailMatch[1])} adminEmail={adminEmail} canDelete={isSuperAdmin} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/activities') return <ActivitiesPage adminEmail={adminEmail} canDelete={isSuperAdmin} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/assessments/preview') return <AssessmentPreviewPage onNavigate={navigate} />
  if (path === '/admin/assessments') return <AssessmentSetupPage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/participants') return <ParticipantsPage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onSettings={settings} />
  const analysisDetailMatch = path.match(/^\/admin\/analytics\/activity\/(\d+)$/)
  if (analysisDetailMatch) return <ActivityAnalysisDetailPage activityId={Number(analysisDetailMatch[1])} adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/analytics/combined') return <CombinedActivityAnalysisPage adminEmail={adminEmail} canExport={isSuperAdmin} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/analytics') return <ActivityAnalysisSelectionPage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onRouteNavigate={navigate} onSettings={settings} />
  if (path === '/admin/reports') return isSuperAdmin ? <ReportsPage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onSettings={settings} /> : <main className="admin-shell"><section><h1>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p>การส่งออกรายงานอนุญาตเฉพาะ Super Admin</p><button onClick={() => navigate('/admin/dashboard')}>กลับ Dashboard</button></section></main>
  if (path === '/admin/staff') return isSuperAdmin ? <StaffPage adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onSettings={settings} /> : <main className="admin-shell"><section><h1>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1><p>การจัดการบัญชี Staff อนุญาตเฉพาะ Super Admin</p><button onClick={() => navigate('/admin/dashboard')}>กลับ Dashboard</button></section></main>
  if (path === '/admin') return <RouteRedirect to="/admin/dashboard" navigate={navigate} />
  if (path !== '/admin/dashboard') return <main className="admin-shell"><section><h1>ไม่พบหน้าที่ต้องการ</h1><button onClick={() => navigate('/admin/dashboard')}>กลับ Dashboard</button></section></main>
  return <Dashboard adminEmail={adminEmail} onLogout={handleLogout} onNavigate={handleNavigate} onOpenCreateActivity={() => navigate('/admin/activities/new')} onSettings={settings} />
}

export default AdminApp
