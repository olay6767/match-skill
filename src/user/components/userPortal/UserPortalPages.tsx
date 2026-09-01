import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { StudentPortalApiError, getStudentPortalActivities, getStudentPortalActivity, getStudentPortalProfile, getStudentPortalProgress, loginStudentPortal } from './api'
import { isValidStudentCode, normalizeStudentCode } from '../../../lib/studentCode'
import { clearStudentPortalSession, getStudentPortalSession, saveStudentPortalSession } from './session'
import type { CompetencyResult, JoinedActivity, StudentResult, UserActivityDetail, UserProfile, UserProgressActivity } from './types'
import Icon, { type IconName } from '../../../shared/components/ui/Icon'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import ViewModeToggle, { type ViewMode } from '../../../shared/components/ui/ViewModeToggle'
import { trackUserEvent } from '../../usage/tracker'
import './userPortal.css'

type Navigate = (path: string, replace?: boolean) => void
type PortalPageProps = { onNavigate: Navigate }

function formatDate(value: string | null) {
  if (!value) return 'ไม่ระบุวันที่'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุวันที่' : date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'ไม่ระบุเวลา' : date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function isSessionError(error: unknown) {
  return error instanceof StudentPortalApiError && error.status === 401
}

function PortalShell({ title, eyebrow, active, onNavigate, children }: PortalPageProps & { title: string; eyebrow: string; active: 'activities' | 'progress' | 'profile'; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const logout = () => {
    trackUserEvent('interaction', 'logout')
    clearStudentPortalSession()
    onNavigate('/user/login', true)
  }
  const move = (path: string) => {
    setMenuOpen(false)
    onNavigate(path)
  }
  return <div className="user-portal-shell">
    <aside className={`user-portal-sidebar${menuOpen ? ' is-open' : ''}`}>
      <div className="user-portal-brand"><img src="/seda-logo.png" alt="SEDA" /><span>Student Portal</span><button type="button" className="user-portal-close" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู"><Icon name="close" /></button></div>
      <nav><button type="button" className={active === 'activities' ? 'is-active' : ''} aria-current={active === 'activities' ? 'page' : undefined} onClick={() => move('/user/activities')}><Icon name="activities" />กิจกรรมของฉัน</button><button type="button" className={active === 'progress' ? 'is-active' : ''} aria-current={active === 'progress' ? 'page' : undefined} onClick={() => move('/user/progress')}><Icon name="analytics" />พัฒนาการ</button><button type="button" className={active === 'profile' ? 'is-active' : ''} aria-current={active === 'profile' ? 'page' : undefined} onClick={() => move('/user/profile')}><Icon name="person" />โปรไฟล์</button></nav>
      <button type="button" className="user-portal-logout" onClick={logout}><Icon name="logout" />ออกจากระบบ</button>
    </aside>
    {menuOpen && <button type="button" className="user-portal-backdrop" onClick={() => setMenuOpen(false)} aria-label="ปิดเมนู" />}
    <main className="user-portal-main"><header><button type="button" className="user-portal-menu" onClick={() => setMenuOpen(true)} aria-label="เปิดเมนู"><Icon name="menu" /></button><div><span>{eyebrow}</span><h1>{title}</h1></div></header><div className="user-portal-content">{children}</div></main>
  </div>
}

function LoadingState({ label = 'กำลังโหลดข้อมูล...' }: { label?: string }) {
  return <div className="user-portal-state" role="status"><span className="user-portal-spinner" /><p>{label}</p></div>
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="user-portal-state user-portal-state--error" role="alert"><strong>ไม่สามารถแสดงข้อมูลได้</strong><p>{message}</p>{retry && <button type="button" onClick={retry}>ลองอีกครั้ง</button>}</div>
}

export function UserPortalLogin({ onNavigate, returnTo }: PortalPageProps & { returnTo?: string }) {
  const [studentCode, setStudentCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (getStudentPortalSession()) onNavigate('/user/activities', true) }, [onNavigate])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeStudentCode(studentCode)
    if (!isValidStudentCode(normalized)) { trackUserEvent('interaction', 'form_validation_error:student_portal_login'); setError('กรุณากรอกรหัสนักศึกษาที่ถูกต้อง เช่น B6728070'); return }
    setBusy(true); setError('')
    try {
      saveStudentPortalSession(await loginStudentPortal(normalized))
      trackUserEvent('interaction', 'login_success')
      trackUserEvent('interaction', 'form_success:student_portal_login')
      onNavigate(returnTo?.startsWith('/user/') && returnTo !== '/user/login' ? returnTo : '/user/activities', true)
    } catch (requestError) {
      trackUserEvent('interaction', 'form_error:student_portal_login')
      setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถเข้าสู่ระบบได้')
    } finally { setBusy(false) }
  }
  return <main className="user-portal-login"><section className="user-portal-login__visual"><img src="/seda-logo.png" alt="SEDA" /><div><span>STUDENT DEVELOPMENT</span><h1>ทุกกิจกรรม<br />คือการเติบโต</h1><p>ติดตามกิจกรรมและผลการพัฒนาสมรรถนะของคุณได้ในที่เดียว</p></div></section><section className="user-portal-login__panel"><form data-usage-form="student_portal_login" onSubmit={submit}><span className="user-portal-login__icon"><Icon name="check" /></span><small>เข้าสู่ระบบนักศึกษา</small><h1>ยินดีต้อนรับกลับมา</h1><p>กรอกรหัสนักศึกษาเพื่อดูกิจกรรมและผลการประเมินของคุณ</p><label htmlFor="portal-student-code">รหัสนักศึกษา<input id="portal-student-code" autoFocus autoComplete="username" value={studentCode} onChange={(event) => { setStudentCode(normalizeStudentCode(event.target.value)); setError('') }} placeholder="เช่น B6728070" maxLength={8} /></label>{error && <p className="user-portal-form-error">{error}</p>}<button type="submit" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ...' : <>เข้าสู่ระบบ <Icon name="chevronRight" /></>}</button><em>ข้อมูลของคุณได้รับการดูแลตามนโยบาย PDPA</em></form></section></main>
}

type UserActivityComparisonMetric = 'average' | 'maximum' | 'minimum'

const userActivityComparisonMetricLabel: Record<UserActivityComparisonMetric, string> = {
  average: 'คะแนนเฉลี่ย',
  maximum: 'คะแนนสูงสุด',
  minimum: 'คะแนนต่ำสุด',
}

function ActivityCard({ activity, onNavigate, selectionMode = false, selected = false, comparisonEligible = false, onToggleSelection }: {
  activity: JoinedActivity
  onNavigate: Navigate
  selectionMode?: boolean
  selected?: boolean
  comparisonEligible?: boolean
  onToggleSelection?: () => void
}) {
  return <article className={`user-portal-activity-card${selected ? ' is-selected' : ''}`}><div className="user-portal-activity-card__image">{activity.imageData ? <img src={activity.imageData} alt="" /> : <span>SEDA</span>}{selectionMode && <button type="button" className={`user-portal-activity-card__select${selected ? ' is-selected' : ''}`} disabled={!comparisonEligible} aria-pressed={selected} title={comparisonEligible ? undefined : 'ต้องทำ PRE-TEST และ POST-TEST ให้ครบก่อน'} onClick={onToggleSelection}><i aria-hidden="true">{selected ? '✓' : '+'}</i>{comparisonEligible ? selected ? 'เลือกแล้ว' : 'เลือกเปรียบเทียบ' : 'ข้อมูลไม่ครบ'}</button>}<b className={`user-portal-status user-portal-status--${activity.activityStatus}`}>{activity.activityStatus === 'active' ? 'กำลังดำเนินการ' : activity.activityStatus === 'closed' ? 'เสร็จสิ้น' : activity.activityStatus === 'draft' ? 'ฉบับร่าง' : 'เก็บถาวร'}</b></div><div className="user-portal-activity-card__body"><small>{activity.activityCode ?? 'กิจกรรมนักศึกษา'}</small><h2>{activity.name}</h2><p><Icon name="calendar" />{formatDate(activity.startDate)}</p><p><Icon name="location" />{activity.location ?? 'ไม่ระบุสถานที่'}</p><div className="user-portal-phase"><span className={activity.preResponse ? 'done' : ''}>PRE {activity.preResponse && <Icon name="check" />}</span><span className={activity.postResponse ? 'done' : ''}>POST {activity.postResponse && <Icon name="check" />}</span></div><button type="button" onClick={() => onNavigate(`/user/activities/${activity.activityId}`)}>ดูรายละเอียด <Icon name="chevronRight" /></button></div></article>
}

function UserActivityComparison({ activities, onEditSelection }: { activities: UserProgressActivity[]; onEditSelection: () => void }) {
  const [metric, setMetric] = useState<UserActivityComparisonMetric>('average')
  const metricValue = (activity: UserProgressActivity) => {
    const scores = activity.competencies.flatMap((competency) => [competency.pre, competency.post].filter((score): score is number => score !== null))
    if (!scores.length) return (activity.preAverage + activity.postAverage) / 2
    if (metric === 'maximum') return Math.max(...scores)
    if (metric === 'minimum') return Math.min(...scores)
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  return <section className="user-activity-comparison" id="user-activity-comparison" aria-labelledby="user-activity-comparison-title">
    <header><div><span>ACTIVITY COMPARISON</span><h2 id="user-activity-comparison-title">เปรียบเทียบกิจกรรม</h2><p>เปรียบเทียบคะแนนของคุณจากกิจกรรมที่ทำครบทั้ง PRE-TEST และ POST-TEST</p></div><button type="button" onClick={onEditSelection}><Icon name="chevronLeft" />กลับไปเลือกกิจกรรม</button></header>
    <div className="user-activity-comparison__selected" aria-label="กิจกรรมที่เลือก"><strong>กิจกรรมที่เลือก</strong><div>{activities.map((activity) => <span key={activity.activityId}>{activity.name}</span>)}</div></div>
    <div className="user-activity-comparison__toolbar"><div><strong>{userActivityComparisonMetricLabel[metric]}ของแต่ละกิจกรรม</strong><small>คำนวณจากคะแนน PRE-TEST และ POST-TEST ของคุณ · คะแนนเต็ม 7</small></div><div role="group" aria-label="เลือกข้อมูลที่ต้องการเปรียบเทียบ">{(Object.keys(userActivityComparisonMetricLabel) as UserActivityComparisonMetric[]).map((item) => <button type="button" key={item} className={metric === item ? 'is-active' : ''} aria-pressed={metric === item} onClick={() => setMetric(item)}>{userActivityComparisonMetricLabel[item]}</button>)}</div></div>
    <div className="user-activity-comparison__chart">
      <div className="user-activity-comparison__scale" aria-hidden="true">{Array.from({ length: 8 }, (_, value) => <span key={value}>{value}</span>)}</div>
      <div className="user-activity-comparison__rows">{activities.map((activity) => {
        const value = metricValue(activity)
        const width = Math.min(100, Math.max(0, value / 7 * 100))
        return <article key={activity.activityId}><div><b>{activity.name}</b><small>{activity.activityCode ?? 'กิจกรรมนักศึกษา'}</small></div><div className="user-activity-comparison__track"><i className="is-post" style={{ width: `${width}%`, left: 0 }} /></div><strong>{progressScore(value)}</strong></article>
      })}</div>
    </div>
  </section>
}

export function UserPortalActivities({ onNavigate }: PortalPageProps) {
  const [activities, setActivities] = useState<JoinedActivity[] | null>(null)
  const [progressActivities, setProgressActivities] = useState<UserProgressActivity[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [activityResult, progressResult] = await Promise.all([getStudentPortalActivities(), getStudentPortalProgress()])
      setError('')
      setActivities(activityResult.activities)
      setProgressActivities(progressResult.activities)
      setSelectedActivityIds((current) => current.filter((activityId) => progressResult.activities.some((activity) => activity.activityId === activityId)))
    }
    catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(requestError instanceof Error ? requestError.message : 'โหลดกิจกรรมไม่สำเร็จ')
    }
  }, [onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const visibleActivities = activities ?? []
  const comparisonEligibleIds = useMemo(() => new Set(progressActivities.map((activity) => activity.activityId)), [progressActivities])
  const selectedActivities = useMemo(() => progressActivities.filter((activity) => selectedActivityIds.includes(activity.activityId)), [progressActivities, selectedActivityIds])
  const toggleSelection = (activityId: number) => setSelectedActivityIds((current) => current.includes(activityId) ? current.filter((id) => id !== activityId) : [...current, activityId])
  const cancelSelection = () => { setSelectionMode(false); setComparisonOpen(false); setSelectedActivityIds([]) }
  const startComparison = () => { setSelectionMode(true); setComparisonOpen(false) }
  const openComparison = () => {
    if (selectedActivities.length < 2) return
    trackUserEvent('interaction', 'student_activity_comparison')
    setSelectionMode(false)
    setComparisonOpen(true)
    window.setTimeout(() => document.getElementById('user-activity-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return <PortalShell title="กิจกรรมของฉัน" eyebrow="MY ACTIVITIES" active="activities" onNavigate={onNavigate}><section className="user-portal-intro"><div><h2>เส้นทางการเรียนรู้ของคุณ</h2><p>รวมกิจกรรมและแบบประเมิน PRE/POST ที่คุณทำไว้</p></div>{activities && <div className="user-portal-intro__actions"><strong>{activities.length} กิจกรรม</strong><ViewModeToggle value={viewMode} onChange={setViewMode} />{progressActivities.length >= 2 && <button type="button" className={selectionMode || comparisonOpen ? 'is-active' : ''} onClick={selectionMode || comparisonOpen ? cancelSelection : startComparison}>{selectionMode || comparisonOpen ? 'ยกเลิกการเปรียบเทียบ' : 'เปรียบเทียบกิจกรรม'}</button>}</div>}</section>{activities === null && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : visibleActivities.length ? <>{comparisonOpen && <UserActivityComparison activities={selectedActivities} onEditSelection={() => { setComparisonOpen(false); setSelectionMode(true) }} />}<section className={`user-portal-activity-grid${viewMode === 'list' ? ' is-list-view' : ''}${selectionMode ? ' is-selecting' : ''}`}>{visibleActivities.map((activity) => <ActivityCard key={activity.activityId} activity={activity} onNavigate={onNavigate} selectionMode={selectionMode} selected={selectedActivityIds.includes(activity.activityId)} comparisonEligible={comparisonEligibleIds.has(activity.activityId)} onToggleSelection={() => toggleSelection(activity.activityId)} />)}</section>{selectionMode && <aside className="user-activity-selection-bar" aria-live="polite"><div><strong>เลือกแล้ว {selectedActivities.length} กิจกรรม</strong><span>{selectedActivities.length ? selectedActivities.slice(0, 3).map((activity) => activity.name).join(', ') : 'เลือกอย่างน้อย 2 กิจกรรมที่ต้องการเปรียบเทียบ'}{selectedActivities.length > 3 ? ` และอีก ${selectedActivities.length - 3} กิจกรรม` : ''}</span></div><div><button type="button" className="is-clear" disabled={!selectedActivities.length} onClick={() => setSelectedActivityIds([])}>ล้างการเลือก</button><button type="button" className="is-compare" disabled={selectedActivities.length < 2} onClick={openComparison}>เปรียบเทียบกิจกรรม ({selectedActivities.length})</button></div></aside>}</> : <div className="user-portal-state"><strong>ยังไม่มีกิจกรรม</strong><p>กิจกรรมที่ทำแบบประเมินแล้วจะแสดงที่นี่</p></div>}</PortalShell>
}

function progressScore(value: number | null) {
  return value === null ? '—' : value.toFixed(2)
}

function progressChange(value: number | null) {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function progressDirection(value: number): { icon: IconName; label: string; className: string } {
  if (value > 0) return { icon: 'trendUp', label: 'ดีขึ้น', className: 'is-positive' }
  if (value < 0) return { icon: 'trendDown', label: 'ลดลง', className: 'is-negative' }
  return { icon: 'trendFlat', label: 'คงที่', className: 'is-neutral' }
}

function averageProgressValues(values: number[]) {
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100
}

function aggregateProgressActivities(activities: UserProgressActivity[]) {
  if (!activities.length) return null
  const competencyGroups = new Map<number, UserProgressActivity['competencies'][number][]>()
  for (const activity of activities) {
    for (const competency of activity.competencies) {
      const group = competencyGroups.get(competency.competencyId) ?? []
      group.push(competency)
      competencyGroups.set(competency.competencyId, group)
    }
  }
  const competencies = [...competencyGroups.values()].map((group) => {
    const first = group[0]
    const pre = averageProgressValues(group.flatMap((item) => item.pre === null ? [] : [item.pre]))
    const post = averageProgressValues(group.flatMap((item) => item.post === null ? [] : [item.post]))
    return {
      competencyId: first.competencyId,
      name: first.name,
      displayOrder: first.displayOrder,
      pre,
      post,
      change: pre === null || post === null ? null : Math.round((post - pre) * 100) / 100,
    }
  }).sort((left, right) => left.displayOrder - right.displayOrder)
  const preAverage = averageProgressValues(competencies.flatMap((item) => item.pre === null ? [] : [item.pre])) ?? 0
  const postAverage = averageProgressValues(competencies.flatMap((item) => item.post === null ? [] : [item.post])) ?? 0
  return {
    activityId: 0,
    activityCode: '',
    name: `ทุกกิจกรรม (${activities.length} กิจกรรม)`,
    activityDate: null,
    preAverage,
    postAverage,
    change: Math.round((postAverage - preAverage) * 100) / 100,
    competencies,
  } satisfies UserProgressActivity
}

function ProgressPrePostChart({ pre, post }: { pre: number; post: number }) {
  const average = Math.round((pre + post) / 2 * 100) / 100
  const percentage = Math.min(100, Math.max(0, average / 7 * 100))

  return <div className="user-progress-average-bar" role="progressbar" aria-label="คะแนนเฉลี่ยรวม PRE และ POST" aria-valuemin={0} aria-valuemax={7} aria-valuenow={average}>
    <div className="user-progress-average-bar__caption"><span>คะแนนเฉลี่ย PRE + POST</span><small>เต็ม 7 คะแนน</small></div>
    <div className="user-progress-average-bar__row"><div><i style={{ width: `${percentage}%` }} /></div><strong>{progressScore(average)}</strong></div>
    <p>คำนวณจากค่าเฉลี่ยรวมของคะแนนก่อนและหลังเข้าร่วม</p>
  </div>
}

function ProgressPrePostBars({ pre, post }: { pre: number; post: number }) {
  const rows = [
    { key: 'pre', label: 'PRE-TEST', value: pre },
    { key: 'post', label: 'POST-TEST', value: post },
  ] as const

  return <div className="user-progress-phase-bars" aria-label="เปรียบเทียบคะแนน PRE และ POST">
    {rows.map((row) => <div className={`user-progress-phase-bars__row is-${row.key}`} key={row.key} role="progressbar" aria-label={`คะแนน ${row.label}`} aria-valuemin={0} aria-valuemax={7} aria-valuenow={row.value}>
      <span>{row.label}</span><div><i style={{ width: `${Math.min(100, Math.max(0, row.value / 7 * 100))}%` }} /></div><strong>{progressScore(row.value)}</strong>
    </div>)}
    <p>เปรียบเทียบคะแนนเฉลี่ยก่อนและหลังเข้าร่วมกิจกรรมนี้</p>
  </div>
}

export function UserPortalProgress({ onNavigate }: PortalPageProps) {
  const [activities, setActivities] = useState<UserProgressActivity[] | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<number | 'all'>('all')
  const [showAllStrengths, setShowAllStrengths] = useState(false)
  const [showAllDevelopments, setShowAllDevelopments] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const result = await getStudentPortalProgress()
      setError('')
      setActivities(result.activities)
      setSelectedActivityId((current) => current === 'all' || result.activities.some((activity) => activity.activityId === current) ? current : 'all')
    } catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(requestError instanceof Error ? requestError.message : 'โหลดข้อมูลพัฒนาการไม่สำเร็จ')
    }
  }, [onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const allActivities = useMemo(() => aggregateProgressActivities(activities ?? []), [activities])
  const activity = selectedActivityId === 'all' ? allActivities : activities?.find((item) => item.activityId === selectedActivityId) ?? null
  const completedCompetencies = activity?.competencies.filter((item) => item.pre !== null && item.post !== null) ?? []
  const highestPostScore = completedCompetencies.length ? Math.max(...completedCompetencies.map((item) => item.post ?? 0)) : null
  const strengths = completedCompetencies
    .filter((item) => highestPostScore !== null && item.post === highestPostScore)
    .sort((left, right) => left.displayOrder - right.displayOrder)
  const visibleStrengths = showAllStrengths ? strengths : strengths.slice(0, 1)
  const developments = completedCompetencies
    .filter((item) => (item.post ?? 0) <= 3.57)
    .sort((left, right) => (left.post ?? 0) - (right.post ?? 0) || left.displayOrder - right.displayOrder)
  const visibleDevelopments = showAllDevelopments ? developments : developments.slice(0, 1)
  const direction = activity ? progressDirection(activity.change) : null
  const showingAllActivities = selectedActivityId === 'all'

  return <PortalShell title="พัฒนาการของฉัน" eyebrow="MY PROGRESS" active="progress" onNavigate={onNavigate}>
    {activities === null && !error ? <LoadingState label="กำลังคำนวณพัฒนาการของคุณ..." /> : error ? <ErrorState message={error} retry={() => void load()} /> : !activities?.length ? <div className="user-portal-state"><strong>ยังไม่มีข้อมูลพัฒนาการ</strong><p>เมื่อทำครบทั้ง Pre-test และ Post-test แล้ว ผลพัฒนาการจะแสดงที่นี่</p></div> : activity && direction && <div className="user-progress-dashboard">
      <section className="user-progress-toolbar"><div><span>PERSONAL DEVELOPMENT</span><h2>ภาพรวมการเปลี่ยนแปลงของคุณ</h2><p>เลือกดูภาพรวมทุกกิจกรรม หรือเจาะดูคะแนนก่อน–หลังของกิจกรรมเดียว</p></div><ScrollableSelect id="progress-activity" className="user-progress-activity-select" label="กิจกรรม" value={String(selectedActivityId)} options={[{value:'all',label:'ทุกกิจกรรม'},...activities.map((item)=>({value:String(item.activityId),label:item.name}))]} onChange={(activityId)=>{ setSelectedActivityId(activityId==='all'?'all':Number(activityId)); setShowAllStrengths(false); setShowAllDevelopments(false) }}/></section>

      <section className="user-progress-kpis" aria-label="คะแนนสรุป"><article className="is-pre"><span>ก่อนเข้าร่วม</span><strong>{progressScore(activity.preAverage)}</strong><small>PRE-TEST</small></article><article className="is-post"><span>หลังเข้าร่วม</span><strong>{progressScore(activity.postAverage)}</strong><small>POST-TEST</small></article><article className={direction.className}><span>คะแนนเปลี่ยนแปลง</span><strong>{progressChange(activity.change)}</strong><small>POST − PRE</small></article><article className={direction.className}><span>แนวโน้ม</span><strong className="user-progress-direction"><b><Icon name={direction.icon} /></b>{direction.label}</strong><small>เทียบก่อนเข้าร่วม</small></article></section>

      <section className="user-progress-panel user-progress-prepost"><header><div><span>{showingAllActivities ? 'PRE + POST AVERAGE' : 'PRE + POST'}</span><h2>{showingAllActivities ? 'การเปลี่ยนแปลงของคุณ' : 'เปรียบเทียบคะแนนก่อนและหลัง'}</h2><p>{showingAllActivities ? 'เปรียบเทียบค่าเฉลี่ยรวม PRE และ POST บนสเกล 1–7' : 'คะแนนเฉลี่ย PRE และ POST ของกิจกรรมที่เลือก บนสเกล 1–7'}</p></div><strong className={direction.className}><Icon name={direction.icon} /> {progressChange(activity.change)}</strong></header>{showingAllActivities ? <ProgressPrePostChart pre={activity.preAverage} post={activity.postAverage} /> : <ProgressPrePostBars pre={activity.preAverage} post={activity.postAverage} />}</section>

      <section className="user-progress-panel"><header><div><span>COMPETENCY GROWTH</span><h2>พัฒนาการรายด้าน</h2><p>คะแนนหลังเข้าร่วมและผลต่างจากก่อนเข้าร่วม</p></div></header><div className="user-progress-competencies">{completedCompetencies.map((competency) => { const competencyDirection = progressDirection(competency.change ?? 0); return <article key={competency.competencyId}><div><b>{competency.name}</b><small>PRE {progressScore(competency.pre)} → POST {progressScore(competency.post)}</small></div><i><em style={{ width: `${Math.min(100, (competency.post ?? 0) / 7 * 100)}%` }} /></i><strong className={competencyDirection.className}><Icon name={competencyDirection.icon} /> {progressChange(competency.change)}</strong></article> })}</div></section>

      <section className="user-progress-insights"><article className="is-strength"><span>จุดเด่นของคุณ</span>{strengths.length ? <><ul className="user-progress-strength-list">{visibleStrengths.map((strength) => <li key={strength.competencyId}><b>{strength.name}</b><small>คะแนนหลังเข้าร่วม {progressScore(strength.post)}</small></li>)}</ul>{strengths.length > 1 && <button type="button" className="user-progress-strength-toggle" aria-expanded={showAllStrengths} onClick={() => setShowAllStrengths((current) => !current)}><i aria-hidden="true">{showAllStrengths ? '−' : '+'}</i>{showAllStrengths ? 'แสดงน้อยลง' : `ดูจุดเด่นเพิ่มเติม (${strengths.length - 1})`}</button>}</> : <strong>ยังไม่มีข้อมูลคะแนน</strong>}</article>{developments.length > 0 && <article className="is-development"><span>ด้านที่ควรพัฒนาต่อ</span><ul className="user-progress-development-list">{visibleDevelopments.map((development) => <li key={development.competencyId}><b>{development.name}</b><small>คะแนนหลังเข้าร่วม {progressScore(development.post)}</small></li>)}</ul>{developments.length > 1 && <button type="button" className="user-progress-strength-toggle is-orange" aria-expanded={showAllDevelopments} onClick={() => setShowAllDevelopments((current) => !current)}><i aria-hidden="true">{showAllDevelopments ? '−' : '+'}</i>{showAllDevelopments ? 'แสดงน้อยลง' : `ดูด้านที่ควรพัฒนาเพิ่มเติม (${developments.length - 1})`}</button>}</article>}</section>

      <section className="user-progress-panel user-progress-timeline"><header><div><span>MY JOURNEY</span><h2>เส้นทางพัฒนาการของฉัน</h2><p>แสดงเฉพาะกิจกรรมที่ทำครบทั้ง Pre-test และ Post-test</p></div></header><div>{[...activities].sort((left, right) => String(left.activityDate ?? '').localeCompare(String(right.activityDate ?? ''))).map((item) => { const itemDirection = progressDirection(item.change); return <button type="button" className={item.activityId === selectedActivityId ? 'is-active' : ''} key={item.activityId} onClick={() => { setSelectedActivityId(item.activityId); setShowAllStrengths(false); setShowAllDevelopments(false) }}><i /><span><b>{item.name}</b><small>{formatDate(item.activityDate)}</small></span><strong>{progressScore(item.preAverage)} → {progressScore(item.postAverage)}</strong><em className={itemDirection.className}><Icon name={itemDirection.icon} /> {progressChange(item.change)}</em></button> })}</div></section>
    </div>}
  </PortalShell>
}

function SkillRadar({ results }: { results: StudentResult[] }) {
  const [activeCompetency, setActiveCompetency] = useState<CompetencyResult | null>(null)
  const latest = new Map<'pre' | 'post', StudentResult>()
  for (const result of results) {
    const previous = latest.get(result.phase)
    if (!previous || new Date(result.submittedAt) > new Date(previous.submittedAt)) latest.set(result.phase, result)
  }
  const reference = latest.get('post') ?? latest.get('pre')
  if (!reference || reference.competencies.length < 3) return null
  const competencies = [...reference.competencies].sort((left, right) => left.displayOrder - right.displayOrder)
  const width = 360
  const height = 360
  const centerX = width / 2
  const centerY = height / 2
  const radius = 122
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / competencies.length
    return {
      x: centerX + Math.cos(angle) * radius * value / 7,
      y: centerY + Math.sin(angle) * radius * value / 7,
    }
  }
  const points = (values: Map<number, number>) => competencies
    .map((item, index) => point(index, values.get(item.competencyId) ?? 0))
    .map((item) => `${item.x},${item.y}`)
    .join(' ')
  const series = (['pre', 'post'] as const).flatMap((phase) => { const result = latest.get(phase); return result ? [{ phase, values: new Map(result.competencies.map((item) => [item.competencyId, item.levelValue])) }] : [] })
  return (
    <section className="user-portal-radar">
      <div>
        <small>SKILL RADAR</small>
        <h2>ภาพรวมทักษะ</h2>
        <p>เปรียบเทียบคะแนนแต่ละสมรรถนะบนสเกล 1–7</p>
      </div>
      <div className="user-portal-radar__legend">
        {series.map((item) => (
          <span key={item.phase} className={item.phase}>
            {item.phase === 'pre' ? 'ก่อนเข้าร่วม (PRE)' : 'หลังเข้าร่วม (POST)'}
          </span>
        ))}
      </div>
      <div className="user-portal-radar__chart">
        {activeCompetency && (
          <div className="user-portal-radar__tooltip" role="tooltip">
            <strong>{activeCompetency.displayOrder}</strong>
            <span>{activeCompetency.name}</span>
          </div>
        )}
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="กราฟเรดาร์แสดงคะแนนทักษะ PRE และ POST">
          {[1, 2, 3, 4, 5, 6, 7].map((level) => (
            <circle
              key={level}
              className="user-portal-radar__ring"
              cx={centerX}
              cy={centerY}
              r={radius * level / 7}
            />
          ))}
          {competencies.map((item, index) => {
            const end = point(index, 7)
            const label = point(index, 8.25)
            const isActive = activeCompetency?.competencyId === item.competencyId
            return (
              <g
                key={item.competencyId}
                className={`user-portal-radar__label-target${isActive ? ' is-active' : ''}`}
                role="button"
                aria-label={`${item.displayOrder}. ${item.name}`}
                aria-pressed={isActive}
                tabIndex={0}
                onClick={() => setActiveCompetency((current) => current?.competencyId === item.competencyId ? null : item)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setActiveCompetency((current) => current?.competencyId === item.competencyId ? null : item)
                }}
              >
                <line x1={centerX} y1={centerY} x2={end.x} y2={end.y} />
                <circle className="user-portal-radar__label-hit" cx={label.x} cy={label.y} r="15" />
                <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">
                  {item.displayOrder}
                </text>
              </g>
            )
          })}
          {series.map((item) => (
            <g className={`user-portal-radar__series ${item.phase}`} key={item.phase}>
              <polygon points={points(item.values)} />
            </g>
          ))}
          <g className="user-portal-radar__scale" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7].map((level) => (
              <text key={level} x={centerX + 6} y={centerY - radius * level / 7 + 4}>{level}</text>
            ))}
          </g>
        </svg>
      </div>
    </section>
  )
}

function ResultCard({ result }: { result: StudentResult }) {
  const competencies = [...result.competencies].sort((left, right) => left.displayOrder - right.displayOrder)
  return <section className={`user-portal-result is-${result.phase}`}><header><div><small>{result.phase === 'pre' ? 'ก่อนเข้าร่วม (PRE)' : 'หลังเข้าร่วม (POST)'}</small><h2>คะแนนรายสมรรถนะ</h2></div><time>{formatDateTime(result.submittedAt)}</time></header><div>{competencies.map((item: CompetencyResult) => <article key={item.competencyId}><p><b>{item.name}</b><span><strong>{item.levelValue.toFixed(1)}</strong><small>/ 7</small></span></p><i><em style={{ width: `${Math.min(100, item.levelValue / 7 * 100)}%` }} /></i></article>)}</div></section>
}

export function UserPortalActivityDetail({ activityId, onNavigate }: PortalPageProps & { activityId: number }) {
  const [activity, setActivity] = useState<UserActivityDetail | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const result = await getStudentPortalActivity(activityId); setError(''); setActivity(result.activity) }
    catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(requestError instanceof StudentPortalApiError && requestError.status === 404 ? 'ไม่พบกิจกรรมนี้ หรือคุณไม่มีสิทธิ์ดูข้อมูล' : requestError instanceof Error ? requestError.message : 'โหลดข้อมูลไม่สำเร็จ')
    }
  }, [activityId, onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  return <PortalShell title="รายละเอียดกิจกรรม" eyebrow="ACTIVITY DETAIL" active="activities" onNavigate={onNavigate}><button type="button" className="user-portal-back" onClick={() => onNavigate('/user/activities')}><Icon name="chevronLeft" />กลับไปกิจกรรมทั้งหมด</button>{!activity && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : activity && <><section className="user-portal-hero"><div>{activity.imageData ? <img src={activity.imageData} alt="" /> : <span>SEDA</span>}</div><article><small>{activity.activityCode ?? 'กิจกรรมนักศึกษา'}</small><h2>{activity.name}</h2><p>{activity.detail ?? 'ไม่มีรายละเอียดเพิ่มเติม'}</p><dl><div><dt>วันที่จัด</dt><dd>{formatDate(activity.startDate)}</dd></div><div><dt>สถานที่</dt><dd>{activity.location ?? 'ไม่ระบุสถานที่'}</dd></div></dl><div className="user-portal-phase"><span className={activity.preResponse ? 'done' : ''}>PRE {activity.preResponse ? 'เสร็จแล้ว' : 'ไม่มีข้อมูล'}</span><span className={activity.postResponse ? 'done' : ''}>POST {activity.postResponse ? 'เสร็จแล้ว' : 'ไม่มีข้อมูล'}</span></div></article></section>{activity.results.length > 0 && <SkillRadar results={activity.results} />}<div className="user-portal-result-list">{activity.results.length ? activity.results.map((result) => <ResultCard key={result.responseId} result={result} />) : <div className="user-portal-state"><p>กิจกรรมนี้ยังไม่มีผลการประเมิน</p></div>}</div></>}</PortalShell>
}

function maskEmail(value: string) { const [name, domain] = value.split('@'); return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : 'ไม่ระบุ' }
function maskPhone(value: string | null) { return value && value.length >= 4 ? `${value.slice(0, 3)}-•••-${value.slice(-4)}` : 'ไม่ระบุ' }
function maskName(value: string) {
  const normalized = value.trim()
  if (!normalized) return 'ไม่ระบุ'
  return normalized.split(/\s+/).map((part) => {
    const visibleLength = Math.min(2, Math.max(1, part.length - 1))
    return `${part.slice(0, visibleLength)}${'•'.repeat(Math.max(2, part.length - visibleLength))}`
  }).join(' ')
}

export function UserPortalProfile({ onNavigate }: PortalPageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try { const result = await getStudentPortalProfile(); setError(''); setProfile(result.profile) }
    catch (requestError) { if (isSessionError(requestError)) { onNavigate('/user/login', true); return }; setError(requestError instanceof Error ? requestError.message : 'โหลดโปรไฟล์ไม่สำเร็จ') }
  }, [onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  return <PortalShell title="โปรไฟล์ของฉัน" eyebrow="MY PROFILE" active="profile" onNavigate={onNavigate}>{!profile && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : profile && <div className="user-portal-profile"><section><div className="user-portal-avatar"><Icon name="person" /></div><b><Icon name="check" /> ยืนยันตัวตนแล้ว</b><h2>{maskName(profile.firstName)} {maskName(profile.lastName)}</h2><p>{profile.studentCode}</p></section><article><header><div><small>ข้อมูลส่วนตัว</small><h2>ข้อมูลที่ลงทะเบียนไว้</h2></div><b>อ่านอย่างเดียว</b></header><dl><div><dt>อีเมล</dt><dd>{maskEmail(profile.email)}</dd></div><div><dt>เบอร์โทร</dt><dd>{maskPhone(profile.phone)}</dd></div><div><dt>สำนักวิชา</dt><dd>{profile.faculty ?? 'ไม่ระบุ'}</dd></div><div><dt>สาขา</dt><dd>{profile.major ?? 'ไม่ระบุ'}</dd></div><div><dt>ระดับการศึกษา</dt><dd>{profile.educationLevel ?? 'ไม่ระบุ'}</dd></div><div><dt>ชั้นปี</dt><dd>{profile.studyYear ? `ปี ${profile.studyYear}` : 'ไม่ระบุ'}</dd></div></dl><aside><strong>การคุ้มครองข้อมูลส่วนบุคคล</strong><p>ระบบแสดงเฉพาะข้อมูลที่จำเป็น หากข้อมูลไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ</p></aside></article></div>}</PortalShell>
}
