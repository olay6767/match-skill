import { useCallback, useEffect, useState } from 'react'
import { getActivityList, getSurveyTemplate, getSurveyTemplates } from '../../../lib/api'
import type { Activity, SurveyCompetency, SurveyTemplate } from '../dashboard/types'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import Icon from '../../../shared/components/ui/Icon'
import ViewModeToggle, { type ViewMode } from '../../../shared/components/ui/ViewModeToggle'
import CompetencyEditModal from './CompetencyEditModal'
import CompetencyQuestion from './CompetencyQuestion'

type Props = { adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onRouteNavigate: (path: string) => void; onSettings: () => void }

const activityStatusLabel: Record<Activity['status'], string> = {
  draft: 'ฉบับร่าง', active: 'กำลังดำเนินการ', closed: 'เสร็จสิ้น', archived: 'เก็บถาวร',
}

const assessmentCatalogPageSize = 8

type PageItem = number | 'ellipsis'

function visiblePages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [...new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total))].sort((left, right) => left - right)
  return pages.flatMap<PageItem>((page, index) => index > 0 && page - pages[index - 1] > 1 ? ['ellipsis', page] : [page])
}

async function fetchAssessmentCatalog(page: number, query: string) {
  const [activityResult, templates] = await Promise.all([
    getActivityList({ q: query, status: 'all', from: '', to: '', targetGroup: '', page, pageSize: assessmentCatalogPageSize }),
    getSurveyTemplates(),
  ])
  const templateId = templates[0]?.id
  return {
    activities: activityResult.activities,
    pagination: activityResult.pagination,
    template: templateId ? await getSurveyTemplate(templateId) : null,
  }
}

function AssessmentSetupPage({ adminEmail, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: assessmentCatalogPageSize, total: 0, totalPages: 0 })
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<SurveyTemplate | null>(null)
  const [editing, setEditing] = useState<SurveyCompetency | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const catalog = await fetchAssessmentCatalog(page, query.trim())
      setActivities(catalog.activities)
      setPagination(catalog.pagination)
      setSelected(catalog.template)
      setNotice('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'โหลดข้อมูล Preview ไม่ได้')
    } finally {
      setLoading(false)
    }
  }, [page, query])

  useEffect(() => {
    let active = true
    fetchAssessmentCatalog(page, query.trim())
      .then((catalog) => {
        if (!active) return
        setActivities(catalog.activities)
        setPagination(catalog.pagination)
        setSelected(catalog.template)
      })
      .catch((error) => {
        if (active) setNotice(error instanceof Error ? error.message : 'โหลดข้อมูล Preview ไม่ได้')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [page, query])

  const openPreview = (activity: Activity, phase: 'pre' | 'post') => {
    if (!activity.surveyTemplateId) return
    onRouteNavigate(`/admin/assessments/preview?activityId=${activity.id}&phase=${phase}`)
  }

  return <DashboardLayout activeNav="Assessments" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <div className="assessment-library-heading assessment-preview-catalog-heading"><div><span>ACTIVITY PREVIEW</span><h1>พรีวิวแบบประเมินรายกิจกรรม</h1><p>เลือกทดลองหน้าแบบประเมินของแต่ละกิจกรรมได้ทั้ง Pre-test และ Post-test โดยไม่บันทึกข้อมูล</p></div><strong>{pagination.total} กิจกรรม</strong></div>
    <details className="assessment-template-management assessment-template-management--top panel"><summary><span><strong>จัดการคำถามมาตรฐาน</strong><small>เปิดเพื่อดูหรือแก้ไขสมรรถนะและระดับ 1–7</small></span><Icon name="chevronRight" /></summary>{!selected ? <div className="empty-state">ไม่พบแบบประเมินมาตรฐาน</div> : <div className="assessment-template-management__body"><section className="template-meta"><div><strong>Standard 9-Skill Assessment</strong></div><p>9 สมรรถนะ · {selected.competencies.reduce((total, competency) => total + competency.levels.length, 0)} ระดับ · แก้ไขล่าสุดโดย {selected.updatedBy ?? 'ระบบ'}</p>{selected.responseCount > 0 && <p>มีคำตอบแล้ว {selected.responseCount} รายการ — แบบประเมินมาตรฐานจะไม่แก้ไขโดยตรง</p>}</section><div className="competency-admin-list">{selected.competencies.map((competency) => <article className="competency-admin-card panel" key={competency.id}><div><span>{competency.displayOrder}</span><div><h2>{competency.name}</h2><p>{competency.definition}</p></div><Button disabled={selected.status === 'archived' || (selected.status === 'published' && selected.responseCount > 0)} onClick={() => setEditing(competency)}>แก้ไข</Button></div><details><summary>ดูระดับ 1–7</summary><CompetencyQuestion competency={competency} preview /></details></article>)}</div></div>}</details>
    <section className="assessment-preview-catalog-toolbar panel"><label><Icon name="search" /><input value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value); setPage(1) }} placeholder="ค้นหาชื่อหรือรหัสกิจกรรม" /></label><div className="assessment-preview-phase-legend" aria-label="คำอธิบายสีของแบบประเมิน"><span><i className="is-pre" aria-hidden="true" />ก่อนเข้าร่วม (PRE)</span><span><i className="is-post" aria-hidden="true" />หลังเข้าร่วม (POST)</span></div><ViewModeToggle value={viewMode} onChange={setViewMode} /><p>Preview จะแสดงชื่อ รูปภาพ และระยะเวลาตามที่กำหนดในกิจกรรมนั้น</p></section>
    {loading ? <div className="dashboard-loading">กำลังโหลดกิจกรรม...</div> : activities.length === 0 ? <div className="empty-state">{query ? 'ไม่พบกิจกรรมที่ค้นหา' : 'ยังไม่มีกิจกรรมสำหรับ Preview'}</div> : <section className={`assessment-preview-catalog-grid${viewMode === 'list' ? ' is-list-view' : ''}`}>{activities.map((activity) => <article className="assessment-preview-activity-card panel" key={activity.id}>
      <div className="assessment-preview-activity-image">{activity.imageData ? <img src={activity.imageData} alt={`โปสเตอร์ ${activity.name}`} /> : <img className="is-logo" src="/seda-logo.png" alt="SEDA" />}<span className={`assessment-preview-activity-status assessment-preview-activity-status--${activity.status}`}>{activityStatusLabel[activity.status]}</span></div>
      <div className="assessment-preview-activity-body"><small>{activity.code || 'ยังไม่มีรหัสกิจกรรม'}</small><h2>{activity.name}</h2><p>{activity.detail || 'ไม่มีรายละเอียดกิจกรรม'}</p><div className="assessment-preview-activity-meta"><span>Pre-test {activity.preTestDurationMinutes} นาที</span><span>Post-test {activity.postTestDurationMinutes} นาที</span></div>{activity.surveyTemplateId ? <div className="assessment-preview-activity-actions"><Button onClick={() => openPreview(activity, 'pre')}>Preview Pre-test</Button><Button onClick={() => openPreview(activity, 'post')}>Preview Post-test</Button></div> : <p className="assessment-preview-missing-template">กิจกรรมนี้ยังไม่ได้เลือกแบบประเมิน</p>}</div>
    </article>)}</section>}
    {pagination.totalPages > 0 && <div className="assessment-catalog-pagination"><nav aria-label={`หน้าปัจจุบัน ${pagination.page} จาก ${pagination.totalPages}`}><button type="button" aria-label="หน้าก่อนหน้า" disabled={pagination.page <= 1} onClick={() => { setLoading(true); setPage(pagination.page - 1) }}>‹</button>{visiblePages(pagination.page, pagination.totalPages).map((item, index) => item === 'ellipsis' ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={item} className={item === pagination.page ? 'is-active' : ''} aria-current={item === pagination.page ? 'page' : undefined} aria-label={`หน้า ${item}`} onClick={() => { if (item === pagination.page) return; setLoading(true); setPage(item) }}>{item}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={pagination.page >= pagination.totalPages} onClick={() => { setLoading(true); setPage(pagination.page + 1) }}>›</button></nav></div>}
    <CompetencyEditModal competency={editing} key={editing?.id ?? 'none'} onClose={() => setEditing(null)} onSaved={() => void load()} />
  </DashboardLayout>
}

export default AssessmentSetupPage
