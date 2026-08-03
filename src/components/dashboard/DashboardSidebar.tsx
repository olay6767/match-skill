import Button from '../ui/Button'
import type { DemoAction } from './types'

type DashboardSidebarProps = {
  adminEmail: string
  onLogout: () => void
  onDemoAction: DemoAction
}

const navigationItems = [
  ['▣', 'Activities'],
  ['▤', 'Assessments'],
  ['♟', 'Participants'],
  ['▥', 'Analytics'],
  ['▧', 'Reports'],
]

function DashboardSidebar({ adminEmail, onLogout, onDemoAction }: DashboardSidebarProps) {
  return (
    <aside className="dashboard-sidebar">
      <div className="dashboard-brand">
        <strong>SkillAnalytics</strong>
        <span>Admin Portal</span>
      </div>

      <nav className="sidebar-nav" aria-label="Admin navigation">
        <Button className="sidebar-link sidebar-link--active">
          <span aria-hidden="true">▦</span> Dashboard
        </Button>
        {navigationItems.map(([icon, label]) => (
          <Button
            className="sidebar-link"
            key={label}
            onClick={() => onDemoAction(label)}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </Button>
        ))}
      </nav>

      <div className="sidebar-account">
        <span>{adminEmail}</span>
        <Button onClick={onLogout}>
          <span aria-hidden="true">↪</span> Logout
        </Button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
