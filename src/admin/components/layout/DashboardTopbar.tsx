import Icon from '../../../shared/components/ui/Icon'

type DashboardTopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onOpenMenu: () => void
  menuOpen: boolean
}

function DashboardTopbar({ search, onSearchChange, onOpenMenu, menuOpen }: DashboardTopbarProps) {
  return (
    <header className="dashboard-topbar">
      <button type="button" className="dashboard-mobile-menu" onClick={onOpenMenu} aria-label="เปิดเมนูผู้ดูแลระบบ" aria-controls="admin-navigation" aria-expanded={menuOpen}><Icon name="menu" /></button>
      <label className="dashboard-search">
        <Icon name="search" />
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="ค้นหากิจกรรมหรือนักศึกษา..."
          aria-label="ค้นหากิจกรรมและนักศึกษา"
        />
      </label>
    </header>
  )
}

export default DashboardTopbar
