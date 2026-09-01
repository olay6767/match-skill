import { useEffect, useState } from 'react'
import { getCurrentAdmin } from '../../../lib/api'
import Button from '../../../shared/components/ui/Button'
import Icon, { type IconName } from '../../../shared/components/ui/Icon'

export type DashboardNav = 'Dashboard' | 'Activities' | 'Assessments' | 'Participants' | 'Analytics' | 'Reports' | 'Staff'

type DashboardSidebarProps = {
  adminEmail: string
  onLogout: () => void
  activeNav: DashboardNav
  onNavigate: (item: DashboardNav) => void
  isOpen: boolean
  onClose: () => void
}

const navigationItems: Array<[IconName, Exclude<DashboardNav, 'Dashboard'>, string]> = [
  ['activities', 'Activities', 'กิจกรรม'],
  ['assessments', 'Assessments', 'พรีวิวแบบประเมิน'],
  ['participants', 'Participants', 'นักศึกษาและผู้เข้าร่วม'],
  ['analytics', 'Analytics', 'วิเคราะห์ผล'],
  ['reports', 'Reports', 'รายงาน'],
  ['admin', 'Staff', 'ผู้ดูแลระบบ'],
]

function DashboardSidebar({ adminEmail, onLogout, activeNav, onNavigate, isOpen, onClose }: DashboardSidebarProps) {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getCurrentAdmin().then((admin) => setRole(admin.role)).catch(() => setRole(null))
  }, [])

  const visibleNavigationItems = role === 'super_admin'
    ? navigationItems
    : navigationItems.filter(([, item]) => item !== 'Reports' && item !== 'Staff')

  return (
    <aside id="admin-navigation" className={`dashboard-sidebar${isOpen ? ' dashboard-sidebar--open' : ''}`} aria-label="เมนูผู้ดูแลระบบ">
      <div className="dashboard-brand">
        <img src="/seda-logo.png" alt="SEDA" />
        <span>ระบบผู้ดูแล</span>
        <button type="button" className="dashboard-sidebar-close" onClick={onClose} aria-label="ปิดเมนู"><Icon name="close" /></button>
      </div>

      <nav className="sidebar-nav" aria-label="เมนูผู้ดูแลระบบ">
        <Button
          className={`sidebar-link${activeNav === 'Dashboard' ? ' sidebar-link--active' : ''}`}
          onClick={() => onNavigate('Dashboard')}
        >
          <Icon name="dashboard" /> ภาพรวม
        </Button>
        {visibleNavigationItems.map(([icon, label, displayLabel]) => (
          <Button
            className={`sidebar-link${activeNav === label ? ' sidebar-link--active' : ''}`}
            key={label}
            onClick={() => onNavigate(label)}
          >
            <Icon name={icon} /> {displayLabel}
          </Button>
        ))}
      </nav>

      <div className="sidebar-account">
        <span>{adminEmail}</span>
        <Button onClick={onLogout}>
          <Icon name="logout" /> ออกจากระบบ
        </Button>
      </div>
    </aside>
  )
}

export default DashboardSidebar
