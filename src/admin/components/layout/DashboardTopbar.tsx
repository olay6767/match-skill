import { useRef, useState } from 'react'
import Icon from '../../../shared/components/ui/Icon'
import type { DashboardNav } from './DashboardSidebar'

type DashboardTopbarProps = {
  search: string
  onSearchChange: (value: string) => void
  onOpenMenu: () => void
  menuOpen: boolean
  activeNav: DashboardNav
}

const sectionLabels: Record<DashboardNav, string> = {
  Dashboard: 'ภาพรวม',
  Activities: 'กิจกรรม',
  Assessments: 'พรีวิวแบบประเมิน',
  Participants: 'นักศึกษาและผู้เข้าร่วม',
  Analytics: 'วิเคราะห์ผล',
  Reports: 'รายงาน',
  Staff: 'ผู้ดูแลระบบ',
}

function DashboardTopbar({ search, onSearchChange, onOpenMenu, menuOpen, activeNav }: DashboardTopbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const expanded = searchOpen || search.length > 0

  const openSearch = () => {
    setSearchOpen(true)
    window.requestAnimationFrame(() => searchInputRef.current?.focus())
  }

  return (
    <header className="dashboard-topbar">
      <button type="button" className="dashboard-mobile-menu" onClick={onOpenMenu} aria-label="เปิดเมนูผู้ดูแลระบบ" aria-controls="admin-navigation" aria-expanded={menuOpen}><Icon name="menu" /></button>
      <div className="dashboard-topbar__context">
        <span>พื้นที่จัดการ</span>
        <strong>{sectionLabels[activeNav]}</strong>
      </div>
      <div
        className={`dashboard-search${expanded ? ' is-expanded' : ''}`}
        role="search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node) && search.length === 0) setSearchOpen(false)
        }}
      >
        <button type="button" className="dashboard-search__trigger" onClick={openSearch} aria-label="เปิดช่องค้นหา" aria-expanded={expanded}>
          <Icon name="search" />
        </button>
        <input
          ref={searchInputRef}
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            if (search) onSearchChange('')
            setSearchOpen(false)
            searchInputRef.current?.blur()
          }}
          placeholder="ค้นหาที่นี่"
          aria-label="ค้นหากิจกรรมและนักศึกษา"
          tabIndex={0}
        />
        {search && (
          <button type="button" className="dashboard-search__clear" onClick={() => { onSearchChange(''); searchInputRef.current?.focus() }} aria-label="ล้างคำค้นหา">
            <Icon name="close" />
          </button>
        )}
      </div>
    </header>
  )
}

export default DashboardTopbar
