import { useEffect, useMemo, useState } from 'react'
import {
  downloadCombinedActivityAnalysis,
  getCombinedActivityAnalysis,
  type ActivityAnalysisCard,
  type CombinedAnalysisInput,
  type CombinedAnalysisReport,
  type CombinedParticipantFilters,
  type CombinedParticipantFiltersByActivity,
} from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import Icon from '../../../shared/components/ui/Icon'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import { readSelectedActivities, saveSelectedActivities, type SelectedActivity } from './activityAnalysisSelection'
import './activityAnalysis.css'
import './combinedAnalysisEnhancements.css'

type Props = {
  adminEmail: string
  canExport: boolean
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
  onRouteNavigate: (path: string) => void
  onSettings: () => void
}

type ScoreMetric = 'average' | 'maximum' | 'minimum'

const scoreMetricLabel: Record<ScoreMetric, string> = {
  average: 'คะแนนเฉลี่ย',
  maximum: 'คะแนนสูงสุด',
  minimum: 'คะแนนต่ำสุด',
}

function displayScore(value: number | null) {
  return value === null ? '—' : value.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function scoreValue(item: ActivityAnalysisCard, metric: ScoreMetric) {
  if (metric === 'maximum') return item.maximumScore
  if (metric === 'minimum') return item.minimumScore
  return item.averageScore
}

function selectionAsRecord(report: CombinedAnalysisReport | null, fallback: Record<number, SelectedActivity>) {
  if (!report) return fallback
  return Object.fromEntries(report.selectedActivities.map((activity) => [activity.id, fallback[activity.id] ?? {
    ...activity,
    date: null,
    category: 'ไม่ระบุหมวด',
    organizer: 'ไม่ระบุผู้จัด',
    status: 'closed' as const,
    hasEvaluation: false,
  }]))
}

function CombinedActivityAnalysisPage({ adminEmail, canExport, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [selected, setSelected] = useState<Record<number, SelectedActivity>>(readSelectedActivities)
  const [participantFiltersByActivity, setParticipantFiltersByActivity] = useState<CombinedParticipantFiltersByActivity>({})
  const [scoreMetric, setScoreMetric] = useState<ScoreMetric>('average')
  const [report, setReport] = useState<CombinedAnalysisReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [notice, setNotice] = useState('')
  const [manageOpen, setManageOpen] = useState(false)

  const activityIds = useMemo(() => Object.keys(selected).map(Number), [selected])
  const requestInput = useMemo<CombinedAnalysisInput>(() => ({
    activityIds,
    mode: 'comparison',
    metric: 'score',
    chartLimit: 0,
    page: 1,
    pageSize: 100,
    sort: 'name',
    direction: 'asc',
    participantFiltersByActivity,
  }), [activityIds, participantFiltersByActivity])

  useEffect(() => { saveSelectedActivities(selected) }, [selected])
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setManageOpen(false) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])
  useEffect(() => {
    let cancelled = false
    const loadAnalysis = async () => {
      window.history.replaceState({}, '', '/admin/analytics/combined')
      if (requestInput.activityIds.length < 2) {
        if (!cancelled) { setReport(null); setIsLoading(false) }
        return
      }
      setIsLoading(true)
      setNotice('')
      try {
        const nextReport = await getCombinedActivityAnalysis(requestInput)
        if (!cancelled) setReport(nextReport)
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : 'ไม่สามารถเปรียบเทียบกิจกรรมที่เลือกได้')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadAnalysis()
    return () => { cancelled = true }
  }, [requestInput])

  const updateParticipantFilters = (activityId: number, patch: Partial<CombinedParticipantFilters>) => {
    setParticipantFiltersByActivity((current) => {
      const next = { ...current }
      const nextFilter = { ...next[String(activityId)], ...patch }
      if (nextFilter.major || nextFilter.educationLevel || nextFilter.studyYear !== undefined) next[String(activityId)] = nextFilter
      else delete next[String(activityId)]
      return next
    })
  }
  const removeSelection = (id: number) => setSelected((current) => {
    const next = { ...current }
    delete next[id]
    return next
  })
  const exportReport = async () => {
    setIsExporting(true)
    setNotice('')
    try {
      const result = await downloadCombinedActivityAnalysis(requestInput)
      const url = URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = url
      link.download = result.filename
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถส่งออกรายงานได้')
    } finally {
      setIsExporting(false)
    }
  }

  const hasParticipantFilter = Object.keys(participantFiltersByActivity).length > 0
  const filterActivities = report?.selectedActivities ?? Object.values(selected).map(({ id, name }) => ({ id, name }))

  return <DashboardLayout activeNav="Analytics" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings}
    search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <div className="combined-analysis-heading">
      <div>
        <p className="activity-analysis-breadcrumb">วิเคราะห์กิจกรรม <span aria-hidden="true">›</span> เปรียบเทียบกิจกรรม</p>
        <h1>เปรียบเทียบกิจกรรม</h1>
        <p>เปรียบเทียบคะแนนของผู้ที่ทำครบทั้ง Pre-test และ Post-test ในกิจกรรมที่เลือก</p>
      </div>
      <div className="combined-analysis-heading__actions">
        <Button className="combined-analysis-action combined-analysis-action--secondary" onClick={() => onRouteNavigate('/admin/analytics')}><Icon name="chevronLeft" />กลับไปเลือกกิจกรรม</Button>
        <Button className="combined-analysis-action combined-analysis-action--manage" onClick={() => setManageOpen(true)}><Icon name="settings" />จัดการรายการที่เลือก</Button>
        {canExport && <Button className="combined-analysis-action combined-analysis-action--primary" aria-busy={isExporting} disabled={isExporting || activityIds.length < 2} onClick={() => void exportReport()}><Icon name="download" />{isExporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลดรายงาน (.xlsx)'}</Button>}
      </div>
    </div>

    {activityIds.length < 2 ? <section className="combined-analysis-empty">
      <h2>เลือกกิจกรรมอย่างน้อย 2 รายการ</h2>
      <p>การเปรียบเทียบต้องใช้กิจกรรมอย่างน้อย 2 รายการ</p>
      <Button onClick={() => onRouteNavigate('/admin/analytics')}>ไปเลือกกิจกรรม</Button>
    </section> : <>
      <section className="combined-analysis-selected" aria-label="กิจกรรมที่กำลังเปรียบเทียบ">
        <strong>กิจกรรมที่เลือก</strong>
        <div>{Object.values(selected).slice(0, 8).map((activity) => <span key={activity.id}>{activity.name}</span>)}{activityIds.length > 8 && <span>+{activityIds.length - 8} กิจกรรม</span>}</div>
      </section>

      <section className="comparison-score-filters" aria-label="ตัวกรองกลุ่มนักศึกษา">
        <div className="comparison-score-filters__heading">
          <div><p className="eyebrow">FILTER EACH ACTIVITY</p><h2>กรองกลุ่มนักศึกษาแยกตามกิจกรรม</h2><p>แต่ละกิจกรรมเลือกสาขาวิชา ระดับการศึกษา และชั้นปี/กลุ่มรุ่นต่างกันได้</p></div>
          <Button disabled={!hasParticipantFilter} onClick={() => setParticipantFiltersByActivity({})}>ล้างตัวกรองทั้งหมด</Button>
        </div>
        <div className="comparison-activity-filter-grid">{filterActivities.map((activity) => {
          const activityFilter = participantFiltersByActivity[String(activity.id)] ?? {}
          const options = report?.participantFilters.optionsByActivity[String(activity.id)]
          const activityResult = report?.comparison.items.find((item) => item.id === activity.id)
          const hasFilter = Boolean(activityFilter.major || activityFilter.educationLevel || activityFilter.studyYear)
          return <article className="comparison-activity-filter-card" key={activity.id}>
            <div className="comparison-activity-filter-card__heading"><div><span>กิจกรรม</span><h3>{activity.name}</h3></div>{activityResult && <small>ครบคู่ {activityResult.pairedCount.toLocaleString('th-TH')} คน</small>}</div>
            <div className="comparison-score-filters__controls">
              <ScrollableSelect label="สาขาวิชา" value={activityFilter.major ?? ''} options={[{ value: '', label: 'ทุกสาขาวิชา' }, ...(options?.majors ?? []).map((major) => ({ value: major, label: major }))]} onChange={(major) => updateParticipantFilters(activity.id, { major: major || undefined })} />
              <ScrollableSelect label="ระดับการศึกษา" value={activityFilter.educationLevel ?? ''} options={[{ value: '', label: 'ทุกระดับ' }, ...(options?.educationLevels ?? []).map((level) => ({ value: level, label: level }))]} onChange={(educationLevel) => updateParticipantFilters(activity.id, { educationLevel: educationLevel || undefined })} />
              <ScrollableSelect label="ชั้นปี / กลุ่มรุ่น" value={activityFilter.studyYear ? String(activityFilter.studyYear) : ''} options={[{ value: '', label: 'ทุกชั้นปี / กลุ่มรุ่น' }, ...(options?.studyYears ?? []).map((year) => ({ value: String(year), label: `ชั้นปี ${year}` }))]} onChange={(studyYear) => updateParticipantFilters(activity.id, { studyYear: studyYear ? Number(studyYear) : undefined })} />
              <Button disabled={!hasFilter} onClick={() => setParticipantFiltersByActivity((current) => { const next = { ...current }; delete next[String(activity.id)]; return next })}>ล้าง</Button>
            </div>
          </article>
        })}</div>
      </section>

      {isLoading ? <div className="dashboard-loading" role="status">กำลังคำนวณคะแนนตามตัวกรอง...</div> : report && <section className="comparison-score-panel">
        <div className="comparison-score-panel__heading">
          <div><p className="eyebrow">SCORE COMPARISON</p><h2>{scoreMetricLabel[scoreMetric]}ของแต่ละกิจกรรม</h2><p>คำนวณจากคะแนนเฉลี่ยรายคนของนักศึกษาที่ทำครบทั้ง Pre-test และ Post-test · คะแนนเต็ม 7</p></div>
          <div className="comparison-score-metric" role="group" aria-label="เลือกคะแนนที่ต้องการดู">
            {(Object.keys(scoreMetricLabel) as ScoreMetric[]).map((metric) => <button key={metric} type="button" className={scoreMetric === metric ? 'is-active' : ''} aria-pressed={scoreMetric === metric} onClick={() => setScoreMetric(metric)}>{scoreMetricLabel[metric]}</button>)}
          </div>
        </div>
        <ComparisonScoreChart items={report.comparison.items} metric={scoreMetric} onOpenActivity={(id) => onRouteNavigate(`/admin/analytics/activity/${id}`)} />
      </section>}
    </>}

    {manageOpen && <div className="activity-analysis-modal-backdrop" role="presentation" onMouseDown={() => setManageOpen(false)}>
      <section className="activity-analysis-modal" role="dialog" aria-modal="true" aria-labelledby="manage-analysis-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="activity-analysis-modal__header"><div><h2 id="manage-analysis-title">จัดการรายการที่เลือก</h2><p>{activityIds.length} กิจกรรม</p></div><Button onClick={() => { setSelected({}); setManageOpen(false) }}>ล้างทั้งหมด</Button></div>
        <ul className="activity-analysis-selected-list">{Object.values(selectionAsRecord(report, selected)).map((activity) => <li key={activity.id}><div><strong>{activity.name}</strong></div><Button onClick={() => removeSelection(activity.id)}>นำออก</Button></li>)}</ul>
        <div className="activity-analysis-modal__actions"><Button onClick={() => setManageOpen(false)}>ปิด</Button></div>
      </section>
    </div>}
  </DashboardLayout>
}

function ComparisonScoreChart({ items, metric, onOpenActivity }: { items: ActivityAnalysisCard[]; metric: ScoreMetric; onOpenActivity: (id: number) => void }) {
  const hasScore = items.some((item) => scoreValue(item, metric) !== null)
  if (!hasScore) return <div className="comparison-score-empty"><strong>ไม่พบคะแนนตามตัวกรองนี้</strong><span>ลองเลือกสาขาวิชา ระดับการศึกษา หรือชั้นปีอื่น</span></div>

  return <div className="comparison-score-chart">
    <div className="comparison-score-scale" aria-hidden="true">{Array.from({ length: 8 }, (_, value) => <span key={value}>{value}</span>)}</div>
    <div className="comparison-score-chart__rows">{items.map((item) => {
      const value = scoreValue(item, metric)
      const width = value === null ? 0 : Math.max(0, Math.min(100, (value / 7) * 100))
      return <div className="comparison-score-row" key={item.id}>
        <button type="button" title={`เปิดผลวิเคราะห์ ${item.name}`} onClick={() => onOpenActivity(item.id)}>{item.name}</button>
        <div className="comparison-score-track" title={`${item.name}: ${scoreMetricLabel[metric]} ${displayScore(value)}`}><i className={value === null ? 'is-empty' : ''} style={{ width: `${width}%` }} /></div>
        <strong>{displayScore(value)}</strong>
      </div>
    })}</div>
  </div>
}

export default CombinedActivityAnalysisPage
