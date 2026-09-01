import { useEffect, useState } from 'react'
import { getStudents } from '../../../lib/api'
import type { Student } from '../dashboard/types'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import ParticipantDetailDrawer from './ParticipantDetailDrawer'

type Filters = { q: string; faculty: string; activityId: string; page: number; pageSize: number }
type Access = { canViewPersonalData: boolean; canEdit: boolean }

const fromUrl = (): Filters => {
  const params = new URLSearchParams(location.search)
  return {
    q: params.get('q') ?? '',
    faculty: params.get('faculty') ?? '',
    activityId: params.get('activityId') ?? '',
    page: Math.max(1, Number(params.get('page')) || 1),
    pageSize: [10, 20, 50].includes(Number(params.get('pageSize'))) ? Number(params.get('pageSize')) : 20,
  }
}

function ParticipantsPage({ adminEmail, onLogout, onNavigate, onSettings }: {
  adminEmail: string
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
  onSettings: () => void
}) {
  const [filters, setFilters] = useState<Filters>(fromUrl)
  const [students, setStudents] = useState<Student[]>([])
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 })
  const [options, setOptions] = useState<{ faculties: string[]; activities: Array<{ id: number; name: string }> }>({ faculties: [], activities: [] })
  const [access, setAccess] = useState<Access | null>(null)
  const [selected, setSelected] = useState<Student | null>(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.faculty) params.set('faculty', filters.faculty)
    if (filters.activityId) params.set('activityId', filters.activityId)
    params.set('page', String(filters.page))
    params.set('pageSize', String(filters.pageSize))
    history.replaceState({}, '', `/admin/participants?${params}`)
    getStudents(filters)
      .then((result) => {
        setStudents(result.students)
        setMeta(result.pagination)
        setOptions(result.filters)
        setAccess(result.access)
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : 'โหลดข้อมูลไม่ได้'))
      .finally(() => setLoading(false))
  }, [filters, reload])

  const change = (patch: Partial<Filters>) => {
    setLoading(true)
    setNotice('')
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  }
  const participantNumber = (index: number) => (meta.page - 1) * meta.pageSize + index + 1
  const canViewPersonalData = access?.canViewPersonalData ?? false
  const canEdit = access?.canEdit ?? false
  const activeFilterCount = [filters.q, filters.faculty, filters.activityId].filter(Boolean).length

  return <DashboardLayout activeNav="Participants" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search={filters.q} onSearchChange={(q) => change({ q })} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <section className="participants-hero">
      <div>
        <span>PARTICIPANT MANAGEMENT</span>
        <h1>นักศึกษาและผู้เข้าร่วม</h1>
        <p>{canViewPersonalData ? 'จัดการข้อมูลนักศึกษาและติดตามสถานะการทำแบบประเมินในทุกกิจกรรม' : 'ติดตามการเข้าร่วมและสถานะการทำแบบประเมิน โดยปกปิดข้อมูลส่วนบุคคล'}</p>
      </div>
      <div className="participants-total"><span>ผู้เข้าร่วมทั้งหมด</span><strong>{meta.total.toLocaleString('th-TH')}</strong><small>คน</small></div>
    </section>

    {access && !canViewPersonalData && <div className="participant-privacy-notice" role="status"><i aria-hidden="true">✓</i><div><strong>กำลังแสดงข้อมูลสำหรับ Staff</strong><span>ข้อมูลชื่อ อีเมล รหัสนักศึกษา และเบอร์โทรถูกปกปิด พร้อมปิดการแก้ไขข้อมูลรายบุคคล</span></div></div>}

    <section className="participant-filter-panel" aria-labelledby="participant-filter-title">
      <header><div><h2 id="participant-filter-title">ค้นหาและกรองข้อมูล</h2><p>เลือกเงื่อนไขเพื่อค้นหาผู้เข้าร่วมที่ต้องการ</p></div>{activeFilterCount > 0 && <span>ใช้อยู่ {activeFilterCount} ตัวกรอง</span>}</header>
      <div className="participant-filters">
        <label className="participant-search">ค้นหาผู้เข้าร่วม<input type="search" value={filters.q} placeholder={canViewPersonalData ? 'ค้นหารหัส ชื่อ อีเมล คณะ หรือกิจกรรม...' : 'ค้นหาคณะ สาขา ระดับ หรือกิจกรรม...'} onChange={(event) => change({ q: event.target.value })} /></label>
        <ScrollableSelect label="คณะ" value={filters.faculty} options={[{ value: '', label: 'ทุกคณะ' }, ...options.faculties.map((item) => ({ value: item, label: item }))]} onChange={(faculty) => change({ faculty })} />
        <ScrollableSelect className="participant-activity-select" label="กิจกรรม" value={filters.activityId} options={[{ value: '', label: 'ทุกกิจกรรม' }, ...options.activities.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={(activityId) => change({ activityId })} />
        <Button className="participant-filter-clear" disabled={activeFilterCount === 0} onClick={() => change({ q: '', faculty: '', activityId: '', page: 1 })}>ล้างตัวกรอง</Button>
      </div>
    </section>

    <section className="participant-results" aria-labelledby="participant-results-title">
      <header><div><h2 id="participant-results-title">รายชื่อผู้เข้าร่วม</h2><p>{activeFilterCount ? `พบ ${meta.total.toLocaleString('th-TH')} รายการตามตัวกรอง` : 'ข้อมูลผู้เข้าร่วมทั้งหมดในระบบ'}</p></div><span>{meta.total.toLocaleString('th-TH')} รายการ</span></header>
      {loading ? <div className="participant-result-state" role="status"><i aria-hidden="true" />กำลังโหลดข้อมูลผู้เข้าร่วม...</div> : students.length === 0 ? <div className="participant-result-state participant-result-state--empty"><strong>ไม่พบข้อมูลผู้เข้าร่วม</strong><p>ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองแล้วค้นหาอีกครั้ง</p></div> : <>
        <div className="participant-table-wrap">
          {canViewPersonalData ? <table className="participant-table"><thead><tr><th>รหัสนักศึกษา</th><th>ชื่อ-นามสกุล</th><th>คณะ/สาขา</th><th>กิจกรรม</th><th>Pre</th><th>Post</th><th>PDPA</th><th>จัดการ</th></tr></thead><tbody>{students.map((student) => <tr key={student.id}><td><strong className="participant-code">{student.studentCode}</strong></td><td><strong className="participant-name">{student.firstName} {student.lastName}</strong><small>{student.email}</small></td><td>{student.faculty ?? '—'}<small>{student.major ?? '—'}</small></td><td><span className="participant-count participant-count--activity">{student.activityCount}</span></td><td><span className="participant-count participant-count--pre">{student.preCount}</span></td><td><span className="participant-count participant-count--post">{student.postCount}</span></td><td><span className={`participant-pdpa${student.pdpaConsentedAt ? ' is-approved' : ''}`}>{student.pdpaConsentedAt ? 'ยินยอมแล้ว' : 'ยังไม่มีข้อมูล'}</span></td><td><Button className="participant-detail-button" onClick={() => setSelected(student)}>ดูรายละเอียด</Button></td></tr>)}</tbody></table>
            : <table className="participant-table participant-table--restricted"><thead><tr><th>ผู้เข้าร่วม</th><th>คณะ/สาขา</th><th>ระดับ/ชั้นปี</th><th>กิจกรรม</th><th>Pre</th><th>Post</th></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}><td><strong className="participant-name">ผู้เข้าร่วม {participantNumber(index)}</strong><small>ปกปิดข้อมูลส่วนบุคคล</small></td><td>{student.faculty ?? '—'}<small>{student.major ?? '—'}</small></td><td>{student.educationLevel ?? '—'}<small>{student.studyYear ? `ชั้นปี ${student.studyYear}` : 'ไม่ระบุชั้นปี'}</small></td><td><span className="participant-count participant-count--activity">{student.activityCount}</span></td><td><span className="participant-count participant-count--pre">{student.preCount}</span></td><td><span className="participant-count participant-count--post">{student.postCount}</span></td></tr>)}</tbody></table>}
        </div>
        <div className="participant-cards">{students.map((student, index) => <article key={student.id}>
          <div className="participant-card__top"><div><span>{canViewPersonalData ? student.studentCode : `ผู้เข้าร่วม ${participantNumber(index)}`}</span>{canViewPersonalData && <h2>{student.firstName} {student.lastName}</h2>}</div>{canEdit && <Button onClick={() => setSelected(student)}>ดูรายละเอียด</Button>}</div>
          <p>{student.faculty ?? 'ไม่ระบุคณะ'}<small>{student.major ?? 'ไม่ระบุสาขา'}{student.studyYear ? ` · ชั้นปี ${student.studyYear}` : ''}</small></p>
          {!canViewPersonalData && <div className="participant-card-private"><i aria-hidden="true">✓</i>ปกปิดข้อมูลส่วนบุคคล</div>}
          <dl><div><dt>กิจกรรม</dt><dd>{student.activityCount}</dd></div><div className="is-pre"><dt>Pre</dt><dd>{student.preCount}</dd></div><div className="is-post"><dt>Post</dt><dd>{student.postCount}</dd></div></dl>
        </article>)}</div>
      </>}
      <div className="participant-pagination"><span>หน้า {meta.totalPages ? meta.page : 0} จาก {meta.totalPages}</span><nav aria-label="เปลี่ยนหน้ารายชื่อผู้เข้าร่วม"><Button disabled={meta.page <= 1} onClick={() => change({ page: meta.page - 1 })}>‹ ก่อนหน้า</Button><Button disabled={meta.page >= meta.totalPages} onClick={() => change({ page: meta.page + 1 })}>ถัดไป ›</Button></nav></div>
    </section>
    {canEdit && <ParticipantDetailDrawer student={selected} key={selected?.id ?? 'none'} onClose={() => setSelected(null)} onSaved={(student) => { setSelected(student); setReload((value) => value + 1) }} />}
  </DashboardLayout>
}

export default ParticipantsPage
