import type { ReactNode } from 'react'
import Notice from '../ui/Notice'
import type { DemoAction } from '../dashboard/types'
import DashboardFooter from './DashboardFooter'
import DashboardSidebar, { type DashboardNav } from './DashboardSidebar'
import DashboardTopbar from './DashboardTopbar'
import '../../Dashboard.css'

type DashboardLayoutProps = {
  adminEmail: string
  search: string
  notice?: string
  onLogout: () => void
  onSearchChange: (value: string) => void
  onDemoAction: DemoAction
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
  onDemoAction,
  activeNav,
  onNavigate,
  onCloseNotice,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="dashboard-page">
      <DashboardSidebar
        adminEmail={adminEmail}
        onLogout={onLogout}
        onDemoAction={onDemoAction}
        activeNav={activeNav}
        onNavigate={onNavigate}
      />

      <div className="dashboard-main">
        <DashboardTopbar
          search={search}
          onSearchChange={onSearchChange}
          onDemoAction={onDemoAction}
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
