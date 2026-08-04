import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../layout/DashboardLayout'
import DashboardPageHeader from '../layout/DashboardPageHeader'
import type { DashboardNav } from '../layout/DashboardSidebar'
import { deleteActivity, getActivities, getDashboardSummary, updateActivity } from '../../lib/api'
import ActivitiesPanel from './ActivitiesPanel'
import AnalyticsPanels from './AnalyticsPanels'
import EditActivityModal from './EditActivityModal'
import SummaryCards from './SummaryCards'
import type {
  Activity,
  ActivityFilter,
  DashboardSummary,
  UpdateActivityInput,
} from './types'

type DashboardProps = {
  adminEmail: string
  onLogout: () => void
  onOpenCreateActivity: () => void
  onNavigate: (item: DashboardNav) => void
}

function Dashboard({ adminEmail, onLogout, onOpenCreateActivity, onNavigate }: DashboardProps) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [message, setMessage] = useState('')
  const [activities, setActivities] = useState<Activity[]>([])
  const [summary, setSummary] = useState<DashboardSummary>({
    totalActivities: 0,
    activeActivities: 0,
    participatingStudents: 0,
    completedAssessments: 0,
  })
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)

  useEffect(() => {
    Promise.all([getActivities(), getDashboardSummary()])
      .then(([activityRows, dashboardSummary]) => {
        setActivities(activityRows)
        setSummary(dashboardSummary)
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้')
      })
  }, [])

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
  }, [activities, filter, search])

  const showDemoMessage = (label: string) => {
    setMessage(`${label} จะเพิ่มการเชื่อมต่อฐานข้อมูลในขั้นถัดไป`)
  }

  const handleUpdateActivity = async (input: UpdateActivityInput) => {
    if (!editingActivity) return
    const updatedActivity = await updateActivity(editingActivity.id, input)
    setActivities((current) => current.map((activity) => (
      activity.id === updatedActivity.id ? updatedActivity : activity
    )))
    setSummary(await getDashboardSummary())
    setMessage('แก้ไขกิจกรรมและบันทึกลง MariaDB เรียบร้อยแล้ว')
  }

  const handleDeleteActivity = async (activity: Activity) => {
    const shouldDelete = window.confirm(`ต้องการลบกิจกรรม “${activity.name}” ใช่หรือไม่?`)
    if (!shouldDelete) return

    try {
      await deleteActivity(activity.id)
      setActivities((current) => current.filter((item) => item.id !== activity.id))
      setSummary(await getDashboardSummary())
      setMessage('ลบกิจกรรมเรียบร้อยแล้ว')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ไม่สามารถลบกิจกรรมได้')
    }
  }

  const handleToggleActivity = async (activity: Activity) => {
    const nextStatus = activity.status === 'open' ? 'closed' : 'open'
    const actionLabel = nextStatus === 'open' ? 'เปิด' : 'ปิด'

    try {
      const updatedActivity = await updateActivity(activity.id, { status: nextStatus })
      setActivities((current) => current.map((item) => (
        item.id === updatedActivity.id ? updatedActivity : item
      )))
      setSummary(await getDashboardSummary())
      setMessage(`${actionLabel}กิจกรรม “${activity.name}” เรียบร้อยแล้ว`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `ไม่สามารถ${actionLabel}กิจกรรมได้`)
    }
  }

  return (
    <DashboardLayout
      adminEmail={adminEmail}
      onLogout={onLogout}
      search={search}
      notice={message}
      onSearchChange={setSearch}
      onDemoAction={showDemoMessage}
      activeNav="Dashboard"
      onNavigate={onNavigate}
      onCloseNotice={() => setMessage('')}
    >
      <DashboardPageHeader onCreate={onOpenCreateActivity} />

      <SummaryCards summary={summary} />
      <ActivitiesPanel
        activities={filteredActivities}
        filter={filter}
        onFilterChange={setFilter}
        onDemoAction={showDemoMessage}
        onEdit={setEditingActivity}
        onDelete={handleDeleteActivity}
        onToggle={handleToggleActivity}
      />
      <AnalyticsPanels onDemoAction={showDemoMessage} />
      <EditActivityModal
        activity={editingActivity}
        key={editingActivity?.id ?? 'no-activity'}
        onClose={() => setEditingActivity(null)}
        onSave={handleUpdateActivity}
      />
    </DashboardLayout>
  )
}

export default Dashboard
