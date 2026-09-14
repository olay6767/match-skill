import { useEffect, useState, type ReactNode } from 'react'
import Notice from '../../../shared/components/ui/Notice'
import type { DemoAction } from '../dashboard/types'
import DashboardFooter from './DashboardFooter'
import DashboardSidebar, { type DashboardNav } from './DashboardSidebar'
import DashboardTopbar from './DashboardTopbar'
import '../../styles/Dashboard.css'
import './dashboardChromeEnhancements.css'

type DashboardLayoutProps = {
  adminEmail: string
  search: string
  notice?: string
  onLogout: () => void
  onSearchChange: (value: string) => void
  onDemoAction: DemoAction
  onSettings: () => void
  activeNav: DashboardNav
  onNavigate: (item: DashboardNav) => void
  onCloseNotice: () => void
  children: ReactNode
}

function DashboardLayout({
  adminEmail,
  search,
  notice,
  onLogout,
  onSearchChange,
  activeNav,
  onNavigate,
  onCloseNotice,
  children,
}: DashboardLayoutProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    if (!mobileNavOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileNavOpen])

  const navigateFromMenu = (item: DashboardNav) => {
    setMobileNavOpen(false)
    onNavigate(item)
  }

  return (
    <div className={`dashboard-page${activeNav === 'Dashboard' ? ' dashboard-page--overview' : ''}`}>
      <DashboardSidebar
        adminEmail={adminEmail}
        onLogout={onLogout}
        activeNav={activeNav}
        onNavigate={navigateFromMenu}
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      {mobileNavOpen && <button type="button" className="dashboard-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-label="ปิดเมนูผู้ดูแลระบบ" />}

      <div className="dashboard-main">
        <DashboardTopbar
          search={search}
          onSearchChange={onSearchChange}
          onOpenMenu={() => setMobileNavOpen(true)}
          menuOpen={mobileNavOpen}
          activeNav={activeNav}
        />

        <main className="dashboard-content">
          {notice && <Notice message={notice} onClose={onCloseNotice} />}
          {children}
          <DashboardFooter />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout
