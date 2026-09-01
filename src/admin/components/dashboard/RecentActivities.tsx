import Card from '../../../shared/components/ui/Card'
import Button from '../../../shared/components/ui/Button'
import type { RecentActivity } from './types'

type RecentActivitiesProps = {
  activities: RecentActivity[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  isLoading: boolean
  onPageChange: (page: number) => void
  onCreate: () => void
}

type PageItem = number | 'ellipsis'

function visiblePages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [...new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total))].sort((a, b) => a - b)
  return pages.flatMap<PageItem>((page, index) => index > 0 && page - pages[index - 1] > 1 ? ['ellipsis', page] : [page])
}

function RecentActivities({ activities, pagination, isLoading, onPageChange, onCreate }: RecentActivitiesProps) {
  const pages = visiblePages(pagination.page, pagination.totalPages)

  return (
    <Card as="section" className="panel activities-panel">
      <div className="panel-heading panel-heading--activities"><div><h2>กิจกรรมล่าสุด</h2><p>รายการกิจกรรมที่สร้างหรือมีการตอบแบบประเมินล่าสุด</p></div><span>ทั้งหมด {pagination.total} กิจกรรม</span></div>
      {isLoading ? (
        <div className="recent-activities-loading" role="status">กำลังโหลดกิจกรรม...</div>
      ) : activities.length === 0 ? (
        <div className="empty-state"><p>ยังไม่มีกิจกรรม</p><button type="button" onClick={onCreate}>สร้างกิจกรรมแรก</button></div>
      ) : (
        <>
          <div className="activity-table-wrap"><table className="activity-table">
            <thead><tr><th>กิจกรรม</th><th>วันที่</th><th>ผู้เข้าร่วม</th><th>Pre</th><th>Post</th><th>สถานะ</th></tr></thead>
            <tbody>{activities.map((activity) => <tr key={activity.id}>
              <td><strong>{activity.name}</strong><small className="recent-activity-detail">{activity.detail}</small></td>
              <td>{activity.activityDate ?? '—'}</td>
              <td>{activity.participantCount} / {activity.participantLimit}</td>
              <td>{activity.preCount}</td><td>{activity.postCount}</td><td>{activity.status}</td>
            </tr>)}</tbody>
          </table></div>
          {pagination.totalPages > 1 && <div className="recent-activities-pagination">
            <span>หน้า {pagination.page} จาก {pagination.totalPages}</span>
            <nav aria-label="เปลี่ยนหน้ากิจกรรมล่าสุด">
              <Button aria-label="หน้าก่อนหน้า" disabled={pagination.page <= 1} onClick={() => onPageChange(pagination.page - 1)}>‹</Button>
              {pages.map((page, index) => page === 'ellipsis'
                ? <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
                : <Button key={page} className={page === pagination.page ? 'active' : ''} aria-current={page === pagination.page ? 'page' : undefined} onClick={() => onPageChange(page)}>{page}</Button>)}
              <Button aria-label="หน้าถัดไป" disabled={pagination.page >= pagination.totalPages} onClick={() => onPageChange(pagination.page + 1)}>›</Button>
            </nav>
          </div>}
        </>
      )}
    </Card>
  )
}

export default RecentActivities
