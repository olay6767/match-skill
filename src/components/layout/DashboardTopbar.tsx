import IconButton from '../ui/IconButton'
import Icon from '../ui/Icon'
import type { DemoAction } from '../dashboard/types'

type DashboardTopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onDemoAction: DemoAction
}

function DashboardTopbar({ search, onSearchChange, onDemoAction }: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <label className="dashboard-search">
        <Icon name="search" />
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
          <Icon name="bell" />
        </IconButton>
        <IconButton label="Settings" onClick={() => onDemoAction('Settings')}>
          <Icon name="settings" />
        </IconButton>
      </div>
    </header>
  )
}

export default DashboardTopbar
