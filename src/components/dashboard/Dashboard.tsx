import { useMemo, useState } from 'react'
import { activities } from './dashboardData'
import ActivitiesPanel from './ActivitiesPanel'
import AnalyticsPanels from './AnalyticsPanels'
import DashboardSidebar from './DashboardSidebar'
import DashboardTopbar from './DashboardTopbar'
import SummaryCards from './SummaryCards'
import '../../Dashboard.css'

type DashboardProps = {
  adminEmail: string
  onLogout: () => void
}

type ActivityFilter = 'all' | 'processing' | 'completed'

function Dashboard({ adminEmail, onLogout }: DashboardProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [message, setMessage] = useState('')

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return activities.filter((activity) => {
      const matchesSearch =
        !query ||
        activity.name.toLowerCase().includes(query) ||
        activity.detail.toLowerCase().includes(query)
      const matchesFilter = filter === 'all' || activity.status === filter
      return matchesSearch && matchesFilter
    })
  }, [filter, search])

  const showDemoMessage = (label: string) => {
    setMessage(`${label} เป็นฟังก์ชันตัวอย่าง ยังไม่ได้เชื่อมฐานข้อมูลจริง`)
  }

  return (
    <div className="dashboard-page">
      <DashboardSidebar
        adminEmail={adminEmail}
        onLogout={onLogout}
        onDemoAction={showDemoMessage}
      />

      <div className="dashboard-main">
        <DashboardTopbar
          search={search}
          onSearchChange={setSearch}
          onDemoAction={showDemoMessage}
        />

        <main className="dashboard-content">
          {message && (
            <div className="dashboard-notice" role="status">
              <span>{message}</span>
              <button type="button" onClick={() => setMessage('')} aria-label="ปิดข้อความ">×</button>
            </div>
          )}

          <div className="dashboard-heading">
            <div>
              <h1>แดชบอร์ดสรุปผล</h1>
              <p>ข้อมูลภาพรวมกิจกรรมและผลการประเมินทักษะปัจจุบัน</p>
            </div>
            <button className="create-button" type="button" onClick={() => showDemoMessage('สร้างกิจกรรมใหม่')}>
              <span aria-hidden="true">＋</span> สร้างกิจกรรมใหม่
            </button>
          </div>

          <SummaryCards />
          <ActivitiesPanel
            activities={filteredActivities}
            filter={filter}
            onFilterChange={setFilter}
            onDemoAction={showDemoMessage}
          />
          <AnalyticsPanels onDemoAction={showDemoMessage} />

          <footer className="dashboard-footer">
            © 2024 Skill Analytics Platform. All rights reserved. V2.4.0-stable
          </footer>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
