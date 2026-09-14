import { useEffect, useState } from 'react'
import { getCurrentAdmin } from '../../../lib/api'
import Button from '../../../shared/components/ui/Button'
import Icon, { type IconName } from '../../../shared/components/ui/Icon'
import dashboardArtwork from '../../../assets/1.png'
import assessmentArtwork from '../../../assets/2.png'
import participantArtwork from '../../../assets/4.png'
import reportArtwork from '../../../assets/5.png'
import activityArtwork from '../../../assets/20.png'
import administratorIcon from '../../../assets/741.png'
import analyticsArtwork from '../../../assets/7778.png'

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
  ['participants', 'Participants', 'ผู้เข้าร่วม'],
  ['analytics', 'Analytics', 'วิเคราะห์ผล'],
  ['reports', 'Reports', 'รายงาน'],
  ['admin', 'Staff', 'ผู้ดูแลระบบ'],
]

const navigationArtwork: Partial<Record<DashboardNav, string>> = {
  Dashboard: dashboardArtwork,
  Activities: activityArtwork,
  Assessments: assessmentArtwork,
  Participants: participantArtwork,
  Analytics: analyticsArtwork,
  Reports: reportArtwork,
  Staff: administratorIcon,
}

function DashboardSidebar({ adminEmail, onLogout, activeNav, onNavigate, isOpen, onClose }: DashboardSidebarProps) {
  const [role, setRole] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    getCurrentAdmin().then((admin) => setRole(admin.role)).catch(() => setRole(null))
  }, [])

  const visibleNavigationItems = role === 'super_admin' || role === undefined
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
          <img className="sidebar-link__image sidebar-link__image--dashboard" src={navigationArtwork.Dashboard} alt="" aria-hidden="true" />
          <span className="sidebar-link__label">ภาพรวม</span>
        </Button>
        {visibleNavigationItems.map(([icon, label, displayLabel]) => (
          <Button
            className={`sidebar-link${activeNav === label ? ' sidebar-link--active' : ''}`}
            key={label}
            onClick={() => onNavigate(label)}
          >
            {navigationArtwork[label]
              ? <img className={`sidebar-link__image sidebar-link__image--${label.toLowerCase()}`} src={navigationArtwork[label]} alt="" aria-hidden="true" />
              : <Icon name={icon} />}
            <span className="sidebar-link__label">{displayLabel}</span>
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
