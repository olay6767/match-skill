import Card from '../../../shared/components/ui/Card'
import Button from '../../../shared/components/ui/Button'
import type { RecentActivity } from './types'
import { richTextToPlainText } from '../../../shared/richText'

type RecentActivitiesProps = {
  activities: RecentActivity[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
  isLoading: boolean
  onPageChange: (page: number) => void
  onCreate: () => void
}

type PageItem = number | 'ellipsis'

const statusPresentation = {
  draft: { label: 'ฉบับร่าง', className: 'is-draft' },
  active: { label: 'กำลังเปิด', className: 'is-active' },
  closed: { label: 'ปิดแล้ว', className: 'is-closed' },
  archived: { label: 'เก็บถาวร', className: 'is-archived' },
} satisfies Record<RecentActivity['status'], { label: string; className: string }>

function formatActivityDate(value: string | null) {
  if (!value) return 'ไม่ระบุวันที่'
  const date = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function participationPercent(activity: RecentActivity) {
  if (activity.participantLimit <= 0) return 0
  return Math.min(100, Math.round((activity.participantCount / activity.participantLimit) * 100))
}

function visiblePages(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [...new Set([1, total, current - 1, current, current + 1].filter((page) => page >= 1 && page <= total))].sort((a, b) => a - b)
  return pages.flatMap<PageItem>((page, index) => index > 0 && page - pages[index - 1] > 1 ? ['ellipsis', page] : [page])
}

function RecentActivities({ activities, pagination, isLoading, onPageChange, onCreate }: RecentActivitiesProps) {
  const pages = visiblePages(pagination.page, pagination.totalPages)

  return (
    <Card as="section" className="panel activities-panel">
      <div className="panel-heading panel-heading--activities">
        <div><h2>กิจกรรมล่าสุด</h2><p>สรุปกิจกรรมและผลตอบรับล่าสุดในมุมมองที่อ่านง่าย</p></div>
        <span>ทั้งหมด {pagination.total} กิจกรรม</span>
      </div>
      {isLoading ? (
        <div className="recent-activities-loading" role="status">กำลังโหลดกิจกรรม...</div>
      ) : activities.length === 0 ? (
        <div className="empty-state"><p>ยังไม่มีกิจกรรม</p><button type="button" onClick={onCreate}>สร้างกิจกรรมแรก</button></div>
      ) : (
        <>
          <div className="activity-table-wrap"><table className="activity-table activity-table--recent">
            <thead><tr><th>กิจกรรม</th><th>วันที่</th><th>ผู้เข้าร่วม</th><th>PRE</th><th>POST</th><th>สถานะ</th></tr></thead>
            <tbody>{activities.map((activity) => {
              const status = statusPresentation[activity.status]
              return <tr key={activity.id}>
                <td>
                  <div className="recent-activity-name-cell">
                    <span className="recent-activity-color" aria-hidden="true" />
                    <div>
                      <strong title={activity.name}>{activity.name}</strong>
                      <small className="recent-activity-detail" title={richTextToPlainText(activity.detail)}>{richTextToPlainText(activity.detail) || 'ไม่มีรายละเอียดเพิ่มเติม'}</small>
                    </div>
                  </div>
                </td>
                <td><time dateTime={activity.activityDate ?? undefined}>{formatActivityDate(activity.activityDate)}</time></td>
                <td>
                  <div className="recent-participants">
                    <strong>{activity.participantCount}<small> / {activity.participantLimit}</small></strong>
                    <span aria-hidden="true"><i style={{ width: `${participationPercent(activity)}%` }} /></span>
                  </div>
                </td>
                <td><span className="recent-score recent-score--pre">{activity.preCount}</span></td>
                <td><span className="recent-score recent-score--post">{activity.postCount}</span></td>
                <td><span className={`recent-status ${status.className}`}><i aria-hidden="true" />{status.label}</span></td>
              </tr>
            })}</tbody>
          </table></div>
          <div className="recent-activity-cards">
            {activities.map((activity) => {
              const status = statusPresentation[activity.status]
              return <article key={activity.id}>
                <header>
                  <div>
                    <h3 title={activity.name}>{activity.name}</h3>
                    <p title={richTextToPlainText(activity.detail)}>{richTextToPlainText(activity.detail) || 'ไม่มีรายละเอียดเพิ่มเติม'}</p>
                  </div>
                  <span className={`recent-status ${status.className}`}><i aria-hidden="true" />{status.label}</span>
                </header>
                <dl>
                  <div><dt>วันที่</dt><dd>{formatActivityDate(activity.activityDate)}</dd></div>
                  <div><dt>ผู้เข้าร่วม</dt><dd>{activity.participantCount} / {activity.participantLimit}</dd></div>
                  <div><dt>Pre-test</dt><dd>{activity.preCount}</dd></div>
                  <div><dt>Post-test</dt><dd>{activity.postCount}</dd></div>
                </dl>
              </article>
            })}
          </div>
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
