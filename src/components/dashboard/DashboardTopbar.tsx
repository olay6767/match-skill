import IconButton from '../ui/IconButton'
import type { DemoAction } from './types'

type DashboardTopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onDemoAction: DemoAction
}

function DashboardTopbar({ search, onSearchChange, onDemoAction }: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <label className="dashboard-search">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search activities, students..."
          aria-label="Search activities and students"
        />
      </label>
      <div className="topbar-actions">
        <IconButton label="Notifications" onClick={() => onDemoAction('Notifications')}>
          ♧
        </IconButton>
        <IconButton label="Settings" onClick={() => onDemoAction('Settings')}>
          ⚙
        </IconButton>
      </div>
    </header>
  )
}

export default DashboardTopbar
