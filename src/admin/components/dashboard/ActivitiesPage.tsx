import { useEffect, useState } from 'react'
import { deleteActivity, getActivityList } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import Icon from '../../../shared/components/ui/Icon'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { statusLabels } from './dashboardData'
import type { Activity, ActivityListFilters } from './types'

type Props = {
  adminEmail: string
  canDelete: boolean
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
  onRouteNavigate: (path: string) => void
  onSettings: () => void
}

function ActivityActions({ activity, canDelete, deleting, onNavigate, onDelete }: {
  activity: Activity
  canDelete: boolean
  deleting: boolean
  onNavigate: (path: string) => void
  onDelete: (activity: Activity) => void
}) {
  return <div className="activity-list-actions">
    <Button className="activity-list-action activity-list-action--participants" onClick={() => onNavigate(`/admin/participants?activityId=${activity.id}`)}><Icon name="participants" /><span>ดูผู้เข้าร่วม</span></Button>
    <Button className="activity-list-action activity-list-action--manage" onClick={() => onNavigate(`/admin/activities/${activity.id}`)}><Icon name="settings" /><span>จัดการ Pre/Post</span></Button>
    <Button className="activity-list-action activity-list-action--edit" disabled={activity.status === 'archived'} onClick={() => onNavigate(`/admin/activities/${activity.id}/edit`)}><Icon name="edit" /><span>แก้ไข</span></Button>
    {canDelete && <Button className="activity-list-action activity-list-action--danger" disabled={deleting} onClick={() => onDelete(activity)}><Icon name="trash" /><span>{deleting ? 'กำลังลบ...' : 'ลบถาวร'}</span></Button>}
  </div>
}

function filtersFromUrl(): ActivityListFilters {
  const params = new URLSearchParams(window.location.search)
  const page = Number(params.get('page'))
  const pageSize = Number(params.get('pageSize'))
  return {
    q: params.get('q') ?? '', status: (params.get('status') as ActivityListFilters['status']) ?? 'all',
    from: params.get('from') ?? '', to: params.get('to') ?? '', targetGroup: params.get('targetGroup') ?? '',
    page: Number.isInteger(page) && page > 0 ? page : 1,
    pageSize: [10, 20, 50].includes(pageSize) ? pageSize : 10,
  }
}

type PageItem = number | 'ellipsis'

function visiblePages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [...new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total))].sort((left, right) => left - right)
  return pages.flatMap<PageItem>((page, index) => index > 0 && page - pages[index - 1] > 1 ? ['ellipsis', page] : [page])
}

function ActivitiesPage({ adminEmail, canDelete, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [filters, setFilters] = useState<ActivityListFilters>(filtersFromUrl)
  const [activities, setActivities] = useState<Activity[]>([])
  const [targetGroups, setTargetGroups] = useState<string[]>([])
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 0 })
  const [notice, setNotice] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    const params = new URLSearchParams()
    if (filters.q) params.set('q', filters.q)
    if (filters.status !== 'all') params.set('status', filters.status)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.targetGroup) params.set('targetGroup', filters.targetGroup)
    params.set('page', String(filters.page)); params.set('pageSize', String(filters.pageSize))
    window.history.replaceState({}, '', `/admin/activities?${params}`)
    getActivityList(filters).then((result) => {
      setActivities(result.activities); setPagination(result.pagination); setTargetGroups(result.targetGroups)
    }).catch((error) => setNotice(error instanceof Error ? error.message : 'ไม่สามารถโหลดกิจกรรมได้'))
      .finally(() => setIsLoading(false))
  }, [filters, reloadKey])

  const changeFilters = (patch: Partial<ActivityListFilters>) => {
    setIsLoading(true); setNotice(''); setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))
  }
  const refresh = () => { setIsLoading(true); setReloadKey((key) => key + 1) }
  const handleDelete = async (activity: Activity) => {
    if (!window.confirm(`ลบกิจกรรม “${activity.name}” อย่างถาวรใช่หรือไม่?\n\nการดำเนินการนี้ย้อนกลับไม่ได้ และจะลบคำตอบแบบประเมิน, QR Code และประวัติของกิจกรรมนี้ด้วย (ข้อมูลนักศึกษาจะยังคงอยู่)`)) return
    setDeletingId(activity.id)
    try { await deleteActivity(activity.id); setNotice('ลบกิจกรรมและข้อมูลที่เกี่ยวข้องแล้ว'); refresh() }
    catch (error) { setNotice(error instanceof Error ? error.message : 'ไม่สามารถลบกิจกรรมได้') }
    finally { setDeletingId(null) }
  }

  return <DashboardLayout activeNav="Activities" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate}
    onSettings={onSettings} search={filters.q} onSearchChange={(q) => changeFilters({ q })} notice={notice}
    onCloseNotice={() => setNotice('')} onDemoAction={(label) => setNotice(`${label} จะพร้อมใช้งานในขั้นถัดไป`)}>
    <div className="activities-page-heading"><div><h1>กิจกรรมทั้งหมด</h1><p>จัดการการเปิด–ปิด Pre-test และ Post-test แยกกันได้จากหน้ารายละเอียดกิจกรรม</p></div><Button className="create-button" onClick={() => onRouteNavigate('/admin/activities/new')}>+ สร้างกิจกรรม</Button></div>
    <section className="activity-list-filters" aria-label="ตัวกรองกิจกรรม">
      <ScrollableSelect label="สถานะ" value={filters.status} options={[{ value: 'all', label: 'ทั้งหมด' }, { value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'closed', label: 'Closed' }]} onChange={(status) => changeFilters({ status: status as ActivityListFilters['status'] })} />
      <label>ตั้งแต่<input type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => changeFilters({ from: event.target.value })} /></label>
      <label>ถึง<input type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => changeFilters({ to: event.target.value })} /></label>
      <ScrollableSelect label="กลุ่มเป้าหมาย" value={filters.targetGroup} options={[{ value: '', label: 'ทั้งหมด' }, ...targetGroups.map((group) => ({ value: group, label: group }))]} onChange={(targetGroup) => changeFilters({ targetGroup })} />
      <Button onClick={() => changeFilters({ q: '', status: 'all', from: '', to: '', targetGroup: '', page: 1 })}>ล้างตัวกรอง</Button>
    </section>
    {isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดรายการกิจกรรม...</div> : activities.length === 0 ? <div className="empty-state activity-list-empty"><p>ไม่พบกิจกรรมตามตัวกรอง</p><Button onClick={() => onRouteNavigate('/admin/activities/new')}>สร้างกิจกรรม</Button></div> : <>
      <div className="activity-list-desktop"><table className="activity-table activity-list-table"><thead><tr><th>กิจกรรม</th><th>วันที่/กลุ่ม</th><th>ผู้เข้าร่วม</th><th>Pre</th><th>Post</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{activities.map((activity) => <tr key={activity.id}>
        <td><strong>{activity.name}</strong><small className="recent-activity-detail">{activity.detail}</small></td><td>{activity.date}<small className="recent-activity-detail">{activity.targetGroup ?? '—'}</small></td><td><button className="activity-participant-link" type="button" onClick={() => onRouteNavigate(`/admin/participants?activityId=${activity.id}`)} aria-label={`ดูผู้เข้าร่วมกิจกรรม ${activity.name}`}>{activity.participants}</button></td>
        <td>{activity.preResponses ?? 0} ({activity.preTest}%)</td><td>{activity.postResponses ?? 0} ({activity.postTest}%)</td><td><StatusBadge status={activity.status}>{statusLabels[activity.status]}</StatusBadge></td>
        <td><ActivityActions activity={activity} canDelete={canDelete} deleting={deletingId === activity.id} onNavigate={onRouteNavigate} onDelete={(item) => void handleDelete(item)} /></td>
      </tr>)}</tbody></table></div>
      <div className="activity-list-mobile">{activities.map((activity) => <article key={activity.id}><div><h2>{activity.name}</h2><StatusBadge status={activity.status}>{statusLabels[activity.status]}</StatusBadge></div><p>{activity.date} · {activity.targetGroup ?? 'ไม่ระบุกลุ่ม'}</p><dl><div><dt>ผู้เข้าร่วม</dt><dd><button className="activity-participant-link" type="button" onClick={() => onRouteNavigate(`/admin/participants?activityId=${activity.id}`)}>{activity.participants}</button></dd></div><div><dt>Pre</dt><dd>{activity.preResponses ?? 0} ({activity.preTest}%)</dd></div><div><dt>Post</dt><dd>{activity.postResponses ?? 0} ({activity.postTest}%)</dd></div></dl><ActivityActions activity={activity} canDelete={canDelete} deleting={deletingId === activity.id} onNavigate={onRouteNavigate} onDelete={(item) => void handleDelete(item)} /></article>)}</div>
    </>}
    {pagination.totalPages > 0 && <div className="activity-list-pagination"><nav aria-label={`หน้าปัจจุบัน ${pagination.page} จาก ${pagination.totalPages}`}><button type="button" aria-label="หน้าก่อนหน้า" disabled={pagination.page <= 1} onClick={() => changeFilters({ page: pagination.page - 1 })}>‹</button>{visiblePages(pagination.page, pagination.totalPages).map((page, index) => page === 'ellipsis' ? <span className="activity-list-pagination__ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={page} className={page === pagination.page ? 'is-active' : ''} aria-current={page === pagination.page ? 'page' : undefined} aria-label={`หน้า ${page}`} onClick={() => changeFilters({ page })}>{page}</button>)}<button type="button" aria-label="หน้าถัดไป" disabled={pagination.page >= pagination.totalPages} onClick={() => changeFilters({ page: pagination.page + 1 })}>›</button></nav></div>}
  </DashboardLayout>
}

export default ActivitiesPage
