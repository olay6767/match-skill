import Button from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'
import type { DemoAction } from '../dashboard/types'

export type DashboardNav = 'Dashboard' | 'Activities' | 'Assessments' | 'Participants' | 'Analytics' | 'Reports'

type DashboardSidebarProps = {
  adminEmail: string
  onLogout: () => void
  onDemoAction: DemoAction
  activeNav: DashboardNav
  onNavigate: (item: DashboardNav) => void
}

const navigationItems: Array<[IconName, Exclude<DashboardNav, 'Dashboard'>]> = [
  ['activities', 'Activities'],
  ['assessments', 'Assessments'],
  ['participants', 'Participants'],
  ['analytics', 'Analytics'],
  ['reports', 'Reports'],
]

function DashboardSidebar({ adminEmail, onLogout, onDemoAction, activeNav, onNavigate }: DashboardSidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand">
        <strong>SkillAnalytics</strong>
        <span>Admin Portal</span>
      </div>

      <nav className="sidebar-nav" aria-label="Admin navigation">
        <Button
          className={`sidebar-link${activeNav === 'Dashboard' ? ' sidebar-link--active' : ''}`}
          onClick={() => onNavigate('Dashboard')}
        >
          <Icon name="dashboard" /> Dashboard
        </Button>
        {navigationItems.map(([icon, label]) => (
          <Button
            className={`sidebar-link${activeNav === label ? ' sidebar-link--active' : ''}`}
            key={label}
            onClick={() => (label === 'Activities' ? onNavigate(label) : onDemoAction(label))}
          >
            <Icon name={icon} /> {label}
          </Button>
        ))}
      </nav>

      <div className="sidebar-account">
        <span>{adminEmail}</span>
        <Button onClick={onLogout}>
          <Icon name="logout" /> Logout
        </Button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
