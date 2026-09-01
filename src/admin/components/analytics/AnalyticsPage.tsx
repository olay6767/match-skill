import { useEffect, useState } from 'react'
import { getAnalyticsCompetencies, getAnalyticsOverview, getAnalyticsParticipants, getAnalyticsStudents, type AnalyticsBreakdown, type AnalyticsCompetency, type AnalyticsFilterOptions, type AnalyticsFilters, type AnalyticsOverview, type AnalyticsStudent } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import ActivityComparisonPanel from './ActivityComparisonPanel'
import CompetencyComparisonChart from './CompetencyComparisonChart'
import ParticipationBreakdown from './ParticipationBreakdown'
import StudentGrowthTable from './StudentGrowthTable'
import './analytics.css'

type Props = { adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onSettings: () => void }

const emptyFilters: AnalyticsFilters = { from: '', to: '', activityId: '', compareActivityId: '', faculty: '', educationLevel: '' }
const emptyOverview: AnalyticsOverview = { preCount: 0, postCount: 0, pairedCount: 0, studentCount: 0, completionRate: null }
const emptyOptions: AnalyticsFilterOptions = { activities: [], faculties: [], educationLevels: [] }

function filtersFromUrl(): AnalyticsFilters {
  const params = new URLSearchParams(window.location.search)
  return { from: params.get('from') ?? '', to: params.get('to') ?? '', activityId: params.get('activityId') ?? '', compareActivityId: params.get('compareActivityId') ?? '', faculty: params.get('faculty') ?? '', educationLevel: params.get('educationLevel') ?? '' }
}

function pageFromUrl() {
  const page = Number(new URLSearchParams(window.location.search).get('page'))
  return Number.isInteger(page) && page > 0 ? page : 1
}

function queryFor(filters: AnalyticsFilters, page: number) {
  const params = new URLSearchParams()
  if (filters.from) params.set('from', filters.from)
  if (filters.to) params.set('to', filters.to)
  if (filters.activityId) params.set('activityId', filters.activityId)
  if (filters.compareActivityId) params.set('compareActivityId', filters.compareActivityId)
  if (filters.faculty) params.set('faculty', filters.faculty)
  if (filters.educationLevel) params.set('educationLevel', filters.educationLevel)
  params.set('page', String(page))
  return params.toString()
}

function AnalyticsPage({ adminEmail, onLogout, onNavigate, onSettings }: Props) {
  const [filters, setFilters] = useState<AnalyticsFilters>(filtersFromUrl)
  const [page, setPage] = useState(pageFromUrl)
  const [overview, setOverview] = useState<AnalyticsOverview>(emptyOverview)
  const [comparisonOverview, setComparisonOverview] = useState<AnalyticsOverview>(emptyOverview)
  const [options, setOptions] = useState<AnalyticsFilterOptions>(emptyOptions)
  const [competencies, setCompetencies] = useState<AnalyticsCompetency[]>([])
  const [comparisonCompetencies, setComparisonCompetencies] = useState<AnalyticsCompetency[]>([])
  const [faculties, setFaculties] = useState<AnalyticsBreakdown[]>([])
  const [educationLevels, setEducationLevels] = useState<AnalyticsBreakdown[]>([])
  const [students, setStudents] = useState<AnalyticsStudent[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    window.history.replaceState({}, '', `/admin/analytics?${queryFor(filters, page)}`)
    const comparisonFilters = filters.compareActivityId ? { ...filters, activityId: filters.compareActivityId, compareActivityId: '' } : null
    const comparisonRequest = comparisonFilters
      ? Promise.all([getAnalyticsOverview(comparisonFilters), getAnalyticsCompetencies(comparisonFilters)])
      : Promise.resolve(null)
    Promise.all([getAnalyticsOverview(filters), getAnalyticsCompetencies(filters), getAnalyticsParticipants(filters), getAnalyticsStudents(filters, page), comparisonRequest])
      .then(([overviewResult, competencyResult, participantResult, studentResult, comparisonResult]) => {
        setOverview(overviewResult.overview); setOptions(overviewResult.filters); setCompetencies(competencyResult.competencies)
        setFaculties(participantResult.faculties); setEducationLevels(participantResult.educationLevels)
        setStudents(studentResult.students); setPagination(studentResult.pagination)
        setComparisonOverview(comparisonResult?.[0].overview ?? emptyOverview)
        setComparisonCompetencies(comparisonResult?.[1].competencies ?? [])
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูล Analytics ได้'))
      .finally(() => setIsLoading(false))
  }, [filters, page, reloadKey])

  const changeFilters = (patch: Partial<AnalyticsFilters>) => {
    setIsLoading(true); setNotice(''); setPage(1); setFilters((current) => {
      const next = { ...current, ...patch }
      if (next.activityId === next.compareActivityId) next.compareActivityId = ''
      return next
    })
  }
  const changePage = (nextPage: number) => { setIsLoading(true); setNotice(''); setPage(nextPage) }
  const resetFilters = () => { setIsLoading(true); setNotice(''); setPage(1); setFilters(emptyFilters) }
  const refresh = () => { setIsLoading(true); setNotice(''); setReloadKey((current) => current + 1) }
  const primaryActivityName = options.activities.find((activity) => String(activity.id) === filters.activityId)?.name ?? 'กิจกรรมหลัก'
  const comparisonActivityName = options.activities.find((activity) => String(activity.id) === filters.compareActivityId)?.name ?? 'กิจกรรมที่เปรียบเทียบ'

  return <DashboardLayout activeNav="Analytics" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings}
    search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={(label) => setNotice(`${label} จะพร้อมใช้งานในขั้นถัดไป`)}>
    <div className="analytics-page-heading"><div><p className="eyebrow">ANALYTICS</p><h1>ภาพรวมผลการประเมิน</h1><p>คำนวณเฉพาะนักศึกษาที่ทำครบทั้ง Pre-test และ Post-test ค่าเฉลี่ยใช้ทศนิยม 2 ตำแหน่ง</p></div><Button onClick={refresh}>รีเฟรชข้อมูล</Button></div>
    <section className="analytics-filters" aria-label="ตัวกรอง Analytics"><label>ตั้งแต่<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => changeFilters({ from: event.target.value })} /></label><label>ถึง<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => changeFilters({ to: event.target.value })} /></label><ScrollableSelect label="กิจกรรมหลัก" value={filters.activityId} options={[{value:'',label:'ทั้งหมด'},...options.activities.map((activity)=>({value:String(activity.id),label:activity.name}))]} onChange={(activityId)=>changeFilters({activityId})}/><ScrollableSelect label="เปรียบเทียบกับ" value={filters.compareActivityId} disabled={!filters.activityId} options={[{value:'',label:'ไม่เปรียบเทียบ'},...options.activities.filter((activity)=>String(activity.id)!==filters.activityId).map((activity)=>({value:String(activity.id),label:activity.name}))]} onChange={(compareActivityId)=>changeFilters({compareActivityId})}/><ScrollableSelect label="คณะ" value={filters.faculty} options={[{ value: '', label: 'ทั้งหมด' }, ...options.faculties.map((faculty) => ({ value: faculty, label: faculty }))]} onChange={(faculty) => changeFilters({ faculty })} /><ScrollableSelect label="ระดับการศึกษา" value={filters.educationLevel} options={[{ value: '', label: 'ทั้งหมด' }, ...options.educationLevels.map((level) => ({ value: level, label: level }))]} onChange={(educationLevel) => changeFilters({ educationLevel })} /><Button onClick={resetFilters}>ล้างตัวกรอง</Button></section>
    {isLoading ? <div className="dashboard-loading" role="status">กำลังคำนวณข้อมูล Analytics...</div> : <div className="analytics-content"><CompetencyComparisonChart competencies={competencies} />{filters.activityId && filters.compareActivityId && <ActivityComparisonPanel primary={competencies} comparison={comparisonCompetencies} primaryOverview={overview} comparisonOverview={comparisonOverview} primaryActivityName={primaryActivityName} comparisonActivityName={comparisonActivityName} />}<ParticipationBreakdown overview={overview} faculties={faculties} educationLevels={educationLevels} /><section className="analytics-formula"><h2>เกณฑ์ข้อมูลที่ใช้</h2><p>คำนวณจากนักศึกษาคนเดียวกันที่ทำครบทั้ง Pre-test และ Post-test ในกิจกรรมเดียวกันเท่านั้น</p><p><strong>Pre/Post average</strong> = ผลรวมระดับคำตอบของสมรรถนะ ÷ จำนวนคำตอบของผู้ที่ทำครบ</p><p><strong>Growth</strong> = ค่าเฉลี่ย Post − ค่าเฉลี่ย Pre</p></section><StudentGrowthTable students={students} pagination={pagination} onPageChange={changePage} /></div>}
  </DashboardLayout>
}

export default AnalyticsPage
