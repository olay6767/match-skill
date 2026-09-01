import { useEffect, useMemo, useState } from 'react'
import { getActivityAnalysisCatalog, getActivityAnalysisIds, type ActivityAnalysisCard, type ActivityAnalysisFilters } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import ViewModeToggle, { type ViewMode } from '../../../shared/components/ui/ViewModeToggle'
import { readSelectedActivities, saveSelectedActivities, type SelectedActivity } from './activityAnalysisSelection'
import './activityAnalysis.css'

type Props = { adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onRouteNavigate: (path: string) => void; onSettings: () => void }

const initialFilters: ActivityAnalysisFilters = { q: '', from: '', to: '', category: '', organizer: '', status: '', evaluation: '' }
const statusLabel: Record<ActivityAnalysisCard['status'], string> = { draft: 'ยังไม่เริ่ม', active: 'กำลังดำเนินการ', closed: 'เสร็จสิ้น', archived: 'เก็บถาวร' }

function shortDate(value: string | null) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : 'ไม่ระบุวันที่'
}

function selectedShape(activity: ActivityAnalysisCard): SelectedActivity {
  return { id: activity.id, name: activity.name, date: activity.date, category: activity.category, organizer: activity.organizer, status: activity.status, hasEvaluation: activity.hasEvaluation }
}

function paginationItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages]
  if (currentPage >= totalPages - 3) return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages]
}

function ActivityAnalysisSelectionPage({ adminEmail, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [filters, setFilters] = useState<ActivityAnalysisFilters>(initialFilters)
  const [activities, setActivities] = useState<ActivityAnalysisCard[]>([])
  const [options, setOptions] = useState({ categories: [] as string[], organizers: [] as string[] })
  const [pagination, setPagination] = useState({ page: 1, pageSize: 24, total: 0, totalPages: 0 })
  const [selected, setSelected] = useState<Record<number, SelectedActivity>>(readSelectedActivities)
  const [isLoading, setIsLoading] = useState(true)
  const [isSelectingAll, setIsSelectingAll] = useState(false)
  const [notice, setNotice] = useState('')
  const [selectedPanelOpen, setSelectedPanelOpen] = useState(false)
  const [selectedSearch, setSelectedSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  useEffect(() => { saveSelectedActivities(selected) }, [selected])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelectedPanelOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])
  useEffect(() => {
    let cancelled = false
    const loadCatalog = async () => {
      setIsLoading(true)
      try {
        const result = await getActivityAnalysisCatalog(filters, pagination.page, pagination.pageSize)
        if (!cancelled) { setActivities(result.activities); setOptions(result.filters); setPagination(result.pagination) }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายการกิจกรรมได้')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadCatalog()
    return () => { cancelled = true }
  }, [filters, pagination.page, pagination.pageSize])

  const selectedItems = useMemo(() => Object.values(selected).sort((left, right) => left.name.localeCompare(right.name, 'th')), [selected])
  const visibleSelected = useMemo(() => selectedItems.filter((activity) => activity.name.toLocaleLowerCase().includes(selectedSearch.trim().toLocaleLowerCase())), [selectedItems, selectedSearch])
  const updateFilters = (patch: Partial<ActivityAnalysisFilters>) => { setNotice(''); setPagination((current) => ({ ...current, page: 1 })); setFilters((current) => ({ ...current, ...patch })) }
  const toggleSelected = (activity: ActivityAnalysisCard | SelectedActivity) => {
    setSelected((current) => {
      const next = { ...current }
      if (next[activity.id]) delete next[activity.id]
      else next[activity.id] = 'imageData' in activity ? selectedShape(activity) : activity
      return next
    })
  }
  const clearSelection = () => { setSelected({}); setSelectedPanelOpen(false) }
  const selectAllCurrentResults = async () => {
    setIsSelectingAll(true); setNotice('')
    try {
      const allMatches = await getActivityAnalysisIds(filters)
      setSelected((current) => Object.fromEntries([...Object.values(current), ...allMatches].map((activity) => [activity.id, activity])))
      setNotice(`เลือกกิจกรรมตามผลการค้นหาแล้ว ${allMatches.length} รายการ`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'ไม่สามารถเลือกกิจกรรมตามผลการค้นหาได้') }
    finally { setIsSelectingAll(false) }
  }
  const startAnalysis = () => {
    window.sessionStorage.removeItem('seda.activity-analysis.mode')
    onRouteNavigate('/admin/analytics/combined')
  }

  return <DashboardLayout activeNav="Analytics" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings}
    search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <div className="activity-analysis-heading"><p className="activity-analysis-breadcrumb">กิจกรรมทั้งหมด <span aria-hidden="true">›</span> วิเคราะห์กิจกรรม</p><h1>วิเคราะห์กิจกรรม</h1><p>เลือกกิจกรรมที่ต้องการเพื่อนำมาวิเคราะห์ โดยใช้เฉพาะผู้ที่ทำครบทั้ง Pre-test และ Post-test</p></div>
    <section className="activity-analysis-filters" aria-label="ค้นหาและกรองกิจกรรม">
      <label className="activity-analysis-search">ค้นหากิจกรรม<input value={filters.q} placeholder="พิมพ์ชื่อกิจกรรมที่ต้องการค้นหา" onChange={(event) => updateFilters({ q: event.target.value })} /></label>
      <label className="activity-analysis-date activity-analysis-date--from">ตั้งแต่<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => updateFilters({ from: event.target.value })} /></label>
      <label className="activity-analysis-date activity-analysis-date--to">ถึง<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => updateFilters({ to: event.target.value })} /></label>
      <ScrollableSelect className="activity-analysis-category" label="กลุ่มเป้าหมาย" value={filters.category} options={[{ value: '', label: 'ทั้งหมด' }, ...options.categories.map((item) => ({ value: item, label: item }))]} onChange={(category) => updateFilters({ category })} />
      <ScrollableSelect className="activity-analysis-organizer" label="ผู้จัดกิจกรรม" value={filters.organizer} options={[{ value: '', label: 'ทั้งหมด' }, ...options.organizers.map((item) => ({ value: item, label: item }))]} onChange={(organizer) => updateFilters({ organizer })} />
      <ScrollableSelect className="activity-analysis-status-filter" label="สถานะ" value={filters.status} options={[{ value: '', label: 'ทั้งหมด' }, ...Object.entries(statusLabel).map(([value, label]) => ({ value, label }))]} onChange={(status) => updateFilters({ status: status as ActivityAnalysisFilters['status'] })} />
      <ScrollableSelect className="activity-analysis-evaluation" label="ข้อมูลประเมิน" value={filters.evaluation} options={[{ value: '', label: 'ทั้งหมด' }, { value: 'has', label: 'มีข้อมูลแล้ว' }, { value: 'none', label: 'ยังไม่มีผู้ตอบแบบประเมิน' }]} onChange={(evaluation) => updateFilters({ evaluation: evaluation as ActivityAnalysisFilters['evaluation'] })} />
      <div className="activity-analysis-filter-actions"><Button onClick={() => { setFilters(initialFilters); setPagination((current) => ({ ...current, page: 1 })) }}>ล้างตัวกรอง</Button><Button disabled={isSelectingAll || pagination.total === 0} onClick={() => void selectAllCurrentResults()}>{isSelectingAll ? 'กำลังเลือก...' : 'เลือกทั้งหมดตามผลการค้นหา'}</Button></div>
    </section>
    <div className="activity-analysis-list-meta"><span>พบ {pagination.total} กิจกรรม</span><ScrollableSelect className="activity-analysis-page-size" label="แสดงต่อหน้า" value={String(pagination.pageSize)} options={[12, 24, 48].map((value) => ({ value: String(value), label: String(value) }))} onChange={(pageSize) => setPagination((current) => ({ ...current, pageSize: Number(pageSize), page: 1 }))} /><ViewModeToggle value={viewMode} onChange={setViewMode} /></div>
    {isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดกิจกรรม...</div> : activities.length === 0 ? <div className="activity-analysis-empty">ไม่พบกิจกรรมตามตัวกรอง</div> : <div className={`activity-analysis-grid${viewMode === 'list' ? ' is-list-view' : ''}`}>{activities.map((activity) => {
      const isSelected = Boolean(selected[activity.id])
      return <article className={`activity-analysis-card${isSelected ? ' activity-analysis-card--selected' : ''}`} key={activity.id}>
        <a className="activity-analysis-card__open" href={`/admin/analytics/activity/${activity.id}`} onClick={(event) => { event.preventDefault(); onRouteNavigate(`/admin/analytics/activity/${activity.id}`) }} aria-label={`ดูผลวิเคราะห์กิจกรรม ${activity.name}`}>
          <div className="activity-analysis-card__cover">{activity.imageData ? <img src={activity.imageData} alt="" /> : <span aria-hidden="true">{activity.name.slice(0, 1)}</span>}</div>
          <div className="activity-analysis-card__body"><div className="activity-analysis-card__title"><h2>{activity.name}</h2><span className={`activity-analysis-status activity-analysis-status--${activity.status}`}>{statusLabel[activity.status]}</span></div><p className="activity-analysis-card__detail">{activity.detail || 'ไม่มีรายละเอียดกิจกรรม'}</p><dl><div><dt>กลุ่มเป้าหมาย</dt><dd>{activity.category}</dd></div><div><dt>วันที่จัด</dt><dd>{shortDate(activity.date)}</dd></div><div><dt>ผู้จัด</dt><dd>{activity.organizer}</dd></div></dl><div className="activity-analysis-card__summary"><div className="activity-analysis-card__metrics activity-analysis-card__metrics--three"><span><b>{activity.attendeeCount}</b> ทำครบ</span><span><b>{activity.assessmentResponseCount}</b> คำตอบ</span><span><b>{activity.averageScore === null ? '—' : activity.averageScore.toFixed(2)}</b> คะแนนเฉลี่ย</span></div>{!activity.hasEvaluation && <p className="activity-analysis-card__no-data">ยังไม่มีข้อมูลที่ทำครบ Pre/Post</p>}</div></div>
        </a>
        <Button className="activity-analysis-card__select" aria-pressed={isSelected} onClick={() => toggleSelected(activity)}>{isSelected ? '✓ เลือกแล้ว' : 'เลือกกิจกรรม'}</Button>
      </article>
    })}</div>}
    {pagination.totalPages > 0 && <div className="activity-analysis-pagination"><nav aria-label={`หน้าปัจจุบัน ${pagination.page} จาก ${pagination.totalPages}`}><button type="button" aria-label="หน้าก่อนหน้า" disabled={pagination.page <= 1} onClick={() => setPagination((current) => ({ ...current, page: current.page - 1 }))}>‹</button>{paginationItems(pagination.page, pagination.totalPages).map((item, index) => item === 'ellipsis' ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={item} className={item === pagination.page ? 'is-active' : ''} aria-current={item === pagination.page ? 'page' : undefined} aria-label={`หน้า ${item}`} onClick={() => setPagination((current) => ({ ...current, page: item }))}>{item}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((current) => ({ ...current, page: current.page + 1 }))}>›</button></nav></div>}
    {selectedItems.length > 0 && <aside className="activity-analysis-selection-bar" aria-label="กิจกรรมที่เลือก"><div><strong>เลือกแล้ว {selectedItems.length} กิจกรรม</strong><span>{selectedItems.slice(0, 3).map((activity) => activity.name).join(' · ')}{selectedItems.length > 3 ? ` · +${selectedItems.length - 3} กิจกรรม` : ''}</span></div><div><Button onClick={() => setSelectedPanelOpen(true)}>ดูรายการที่เลือก</Button><Button onClick={clearSelection}>ล้างการเลือก</Button><Button disabled={selectedItems.length < 2} title={selectedItems.length < 2 ? 'เลือกอย่างน้อย 2 กิจกรรมเพื่อเปรียบเทียบ' : undefined} onClick={startAnalysis}>เปรียบเทียบกิจกรรม</Button></div></aside>}
    {selectedPanelOpen && <div className="activity-analysis-modal-backdrop" role="presentation" onMouseDown={() => setSelectedPanelOpen(false)}><section className="activity-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="selected-activities-title" onMouseDown={(event) => event.stopPropagation()}><div className="activity-analysis-modal__header"><div><h2 id="selected-activities-title">รายการกิจกรรมที่เลือก</h2><p>{selectedItems.length} กิจกรรม</p></div><Button onClick={clearSelection}>ล้างทั้งหมด</Button></div><label className="activity-analysis-modal__search">ค้นหารายการที่เลือก<input autoFocus value={selectedSearch} onChange={(event) => setSelectedSearch(event.target.value)} /></label><ul className="activity-analysis-selected-list">{visibleSelected.map((activity) => <li key={activity.id}><div><strong>{activity.name}</strong><span>{shortDate(activity.date)} · {activity.category}</span></div><Button onClick={() => toggleSelected(activity)}>นำออก</Button></li>)}</ul><div className="activity-analysis-modal__actions"><Button onClick={() => setSelectedPanelOpen(false)}>ปิด</Button></div></section></div>}
  </DashboardLayout>
}

export default ActivityAnalysisSelectionPage
