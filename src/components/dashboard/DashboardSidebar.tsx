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
        <button className="sidebar-link sidebar-link--active" type="button">
          <span aria-hidden="true">▦</span> Dashboard
        </button>
        {navigationItems.map(([icon, label]) => (
          <button
            className="sidebar-link"
            type="button"
            key={label}
            onClick={() => onDemoAction(label)}
          >
            <span aria-hidden="true">{icon}</span> {label}
          </button>
        ))}
      </nav>

      <div className="sidebar-account">
        <span>{adminEmail}</span>
        <button type="button" onClick={onLogout}>
          <span aria-hidden="true">↪</span> Logout
        </button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
