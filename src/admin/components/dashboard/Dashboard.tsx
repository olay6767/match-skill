import { useEffect, useMemo, useState } from 'react'
import DashboardLayout from '../layout/DashboardLayout'
import DashboardPageHeader from '../layout/DashboardPageHeader'
import type { DashboardNav } from '../layout/DashboardSidebar'
import {
  getCompetencyGrowth,
  getDashboardActivityOptions,
  getDashboardSummary,
  getRecentActivities,
} from '../../../lib/api'
import AnalyticsPanels from './AnalyticsPanels'
import DashboardFilters from './DashboardFilters'
import RecentActivities from './RecentActivities'
import SummaryCards from './SummaryCards'
import type { ActivityOption, CompetencyGrowth, DashboardFilters as FilterValues, DashboardSummary, RecentActivity } from './types'
import { richTextToPlainText } from '../../../shared/richText'

type DashboardProps = {
  adminEmail: string
  onLogout: () => void
  onOpenCreateActivity: () => void
  onNavigate: (item: DashboardNav) => void
  onSettings: () => void
}

const emptySummary: DashboardSummary = { preCount: 0, postCount: 0, pairedCount: 0, completionRate: null }

function filtersFromUrl(): FilterValues {
  const params = new URLSearchParams(window.location.search)
  const activityIds = (params.get('activityIds') ?? params.get('activityId') ?? '').split(',').filter((value) => /^\d+$/.test(value))
  return { from: params.get('from') ?? '', to: params.get('to') ?? '', activityIds }
}

function Dashboard({ adminEmail, onLogout, onOpenCreateActivity, onNavigate, onSettings }: DashboardProps) {
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>(filtersFromUrl)
  const [summary, setSummary] = useState<DashboardSummary>(emptySummary)
  const [competencies, setCompetencies] = useState<CompetencyGrowth[]>([])
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [recentPage, setRecentPage] = useState(1)
  const [recentPagination, setRecentPagination] = useState({ page: 1, pageSize: 5, total: 0, totalPages: 0 })
  const [isRecentLoading, setIsRecentLoading] = useState(true)
  const [activityOptions, setActivityOptions] = useState<ActivityOption[]>([])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    getDashboardActivityOptions().then(setActivityOptions).catch(() => undefined)
  }, [])

  useEffect(() => {
    let cancelled = false
    getRecentActivities(recentPage, 5, filters)
      .then((result) => {
        if (cancelled) return
        setActivities(result.activities)
        setRecentPagination(result.pagination)
      })
      .catch((error) => {
        if (cancelled) return
        setActivities([])
        setMessage(error instanceof Error ? error.message : 'ไม่สามารถโหลดกิจกรรมล่าสุดได้')
      })
      .finally(() => { if (!cancelled) setIsRecentLoading(false) })
    return () => { cancelled = true }
  }, [filters, recentPage])

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.activityIds.length) params.set('activityIds', filters.activityIds.join(','))
    const query = params.toString()
    window.history.replaceState({}, '', `/admin/dashboard${query ? `?${query}` : ''}`)

    Promise.all([getDashboardSummary(filters), getCompetencyGrowth(filters)])
      .then(([nextSummary, nextCompetencies]) => {
        setSummary(nextSummary)
        setCompetencies(nextCompetencies)
      })
      .catch((error) => {
        setSummary(emptySummary)
        setCompetencies([])
        setMessage(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูล Dashboard ได้')
      })
      .finally(() => setIsLoading(false))
  }, [filters])

  const visibleActivities = useMemo(() => {
    const query = search.trim().toLowerCase()
    return query ? activities.filter((activity) => `${activity.name} ${richTextToPlainText(activity.detail)}`.toLowerCase().includes(query)) : activities
  }, [activities, search])

  const showDemoMessage = (label: string) => setMessage(`${label} จะพร้อมใช้งานในขั้นถัดไป`)
  const handleFiltersChange = (nextFilters: FilterValues) => {
    setIsLoading(true)
    setIsRecentLoading(true)
    setMessage('')
    setFilters(nextFilters)
    setRecentPage(1)
  }
  const handleRecentPageChange = (page: number) => {
    if (page === recentPage) return
    setIsRecentLoading(true)
    setRecentPage(page)
  }

  return (
    <DashboardLayout
      adminEmail={adminEmail} onLogout={onLogout} search={search} notice={message}
      onSearchChange={setSearch} onDemoAction={showDemoMessage} onSettings={onSettings}
      activeNav="Dashboard" onNavigate={onNavigate} onCloseNotice={() => setMessage('')}
    >
      <DashboardPageHeader onCreate={onOpenCreateActivity} />
      <DashboardFilters value={filters} activities={activityOptions} onChange={handleFiltersChange} />
      {isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดข้อมูล Dashboard...</div> : <>
        <SummaryCards summary={summary} />
        <RecentActivities
          activities={visibleActivities}
          pagination={recentPagination}
          isLoading={isRecentLoading}
          onPageChange={handleRecentPageChange}
          onCreate={onOpenCreateActivity}
        />
        <AnalyticsPanels data={competencies} />
      </>}
    </DashboardLayout>
  )
}

export default Dashboard
