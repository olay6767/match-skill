import { useEffect, useMemo, useState } from 'react'
import { getActivity, getAnalyticsCompetencies, getAnalyticsOverview, type AnalyticsCompetency, type AnalyticsOverview } from '../../../lib/api'
import type { Activity } from '../dashboard/types'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import CompetencyComparisonChart from './CompetencyComparisonChart'
import FinalAnalysisDashboard from './FinalAnalysisDashboard'
import { readSelectedActivities, saveSelectedActivities, type SelectedActivity } from './activityAnalysisSelection'
import './analytics.css'
import './activityAnalysis.css'

type Props = { activityId: number; adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onRouteNavigate: (path: string) => void; onSettings: () => void }

const emptyOverview: AnalyticsOverview = { preCount: 0, postCount: 0, pairedCount: 0, studentCount: 0, completionRate: null }
const statusLabel: Record<Activity['status'], string> = { draft: 'ยังไม่เริ่ม', active: 'กำลังดำเนินการ', closed: 'เสร็จสิ้น', archived: 'เก็บถาวร' }

function date(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }) : 'ไม่ระบุวันที่'
}

function ActivityAnalysisDetailPage({ activityId, adminEmail, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [overview, setOverview] = useState<AnalyticsOverview>(emptyOverview)
  const [competencies, setCompetencies] = useState<AnalyticsCompetency[]>([])
  const [selected, setSelected] = useState<Record<number, SelectedActivity>>(readSelectedActivities)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState('')

  useEffect(() => { saveSelectedActivities(selected) }, [selected])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      try {
        const filters = { from: '', to: '', activityId: String(activityId), compareActivityId: '', faculty: '', educationLevel: '' }
        const [nextActivity, overviewResult, competencyResult] = await Promise.all([getActivity(activityId), getAnalyticsOverview(filters), getAnalyticsCompetencies(filters)])
        if (!cancelled) { setActivity(nextActivity); setOverview(overviewResult.overview); setCompetencies(competencyResult.competencies) }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'ไม่สามารถโหลดผลวิเคราะห์กิจกรรมได้')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [activityId])

  const selectionItem = useMemo<SelectedActivity | null>(() => activity ? {
    id: activity.id, name: activity.name, date: activity.activityDate, category: activity.targetGroup ?? 'ไม่ระบุหมวด',
    organizer: 'ไม่ระบุผู้จัด', status: activity.status, hasEvaluation: overview.studentCount > 0,
  } : null, [activity, overview.studentCount])
  const rawPreCount = activity?.preResponses ?? 0
  const rawPostCount = activity?.postResponses ?? 0
  const completionRate = rawPreCount > 0 ? Number(((overview.pairedCount / rawPreCount) * 100).toFixed(1)) : null
  const isSelected = Boolean(activity && selected[activity.id])
  const toggleSelected = () => {
    if (!selectionItem) return
    setSelected((current) => {
      const next = { ...current }
      if (next[selectionItem.id]) delete next[selectionItem.id]
      else next[selectionItem.id] = selectionItem
      return next
    })
  }

  return <DashboardLayout activeNav="Analytics" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    {isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดผลวิเคราะห์กิจกรรม...</div> : !activity ? <section className="combined-analysis-empty"><h1>ไม่พบกิจกรรม</h1><Button onClick={() => onRouteNavigate('/admin/analytics')}>กลับไปวิเคราะห์กิจกรรม</Button></section> : <>
      <div className="activity-analysis-detail-page-heading"><div><p className="activity-analysis-breadcrumb">วิเคราะห์กิจกรรม <span aria-hidden="true">›</span> {activity.name}</p><span className="activity-analysis-detail-kicker">ACTIVITY INSIGHT</span><h1>ผลวิเคราะห์กิจกรรม</h1><p>คำนวณจากนักศึกษาที่ทำครบทั้ง Pre-test และ Post-test ของกิจกรรมนี้</p></div><div className="activity-analysis-detail-page-heading__actions"><Button className="activity-analysis-detail-button activity-analysis-detail-button--secondary" onClick={() => onRouteNavigate('/admin/analytics')}>← กลับไปเลือกกิจกรรม</Button><Button className="activity-analysis-detail-button activity-analysis-detail-button--primary" aria-pressed={isSelected} onClick={toggleSelected}>{isSelected ? '✓ เลือกกิจกรรมแล้ว' : 'เลือกกิจกรรม'}</Button></div></div>
      <section className="activity-analysis-detail-hero"><div className="activity-analysis-detail-hero__cover">{activity.imageData ? <img src={activity.imageData} alt="" /> : <span aria-hidden="true">{activity.name.slice(0, 1)}</span>}</div><div><div className="activity-analysis-detail-meta"><span>{activity.targetGroup ?? 'ไม่ระบุหมวด'}</span><span>{date(activity.activityDate)}</span><span>{activity.location ?? 'ไม่ระบุสถานที่'}</span><span className={`activity-analysis-status activity-analysis-status--${activity.status}`}>{statusLabel[activity.status]}</span></div><h2>{activity.name}</h2><p>{activity.detail || 'ไม่มีรายละเอียดกิจกรรม'}</p><dl><div><dt>รหัสกิจกรรม</dt><dd>{activity.code || '—'}</dd></div><div><dt>ระยะเวลา Pre-test</dt><dd>{activity.preTestDurationMinutes} นาที</dd></div><div><dt>ระยะเวลา Post-test</dt><dd>{activity.postTestDurationMinutes} นาที</dd></div></dl></div></section>
      <section className="activity-analysis-detail-summary" aria-label="สถิติสำคัญของกิจกรรม"><article><span>ผู้ตอบทั้งหมดในระบบ</span><strong>{activity.participants}</strong></article><article><span>ผู้ตอบที่ใช้วิเคราะห์</span><strong>{overview.studentCount}</strong></article><article><span>Pre-test (ทั้งหมด)</span><strong>{rawPreCount}</strong></article><article><span>Post-test (ทั้งหมด)</span><strong>{rawPostCount}</strong></article><article><span>ทำครบ Pre/Post</span><strong>{overview.pairedCount}</strong></article><article><span>อัตราทำครบ</span><strong>{completionRate === null ? '—' : `${completionRate.toFixed(1)}%`}</strong></article></section>
      <FinalAnalysisDashboard key={activity.id} activityId={activity.id} />
      <CompetencyComparisonChart competencies={competencies} />
    </>}
  </DashboardLayout>
}

export default ActivityAnalysisDetailPage
