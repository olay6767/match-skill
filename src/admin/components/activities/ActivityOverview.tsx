import type { Activity, ActivityQrData } from '../dashboard/types'
import StatusBadge from '../../../shared/components/ui/StatusBadge'
import { statusLabels } from '../dashboard/dashboardData'
import RichTextContent from '../../../shared/components/ui/RichTextContent'

function ActivityOverview({ activity, stats }: { activity: Activity; stats: ActivityQrData['stats'] }) {
  return <>
    <section className="activity-detail-overview panel">
      <div><small>{activity.code || 'ยังไม่มีรหัส'}</small><h1>{activity.name}</h1>{activity.detail ? <RichTextContent value={activity.detail} /> : <p>ไม่มีรายละเอียด</p>}</div>
      <StatusBadge status={activity.status}>{statusLabels[activity.status]}</StatusBadge>
      <dl><div><dt>วันที่สร้างกิจกรรม</dt><dd>{new Date(activity.createdAt).toLocaleDateString('th-TH')}</dd></div><div><dt>วันที่เริ่มกิจกรรม</dt><dd>{activity.startDate || '—'}</dd></div><div><dt>กลุ่มเป้าหมาย</dt><dd>{activity.targetGroup || '—'}</dd></div><div><dt>จำนวนรองรับ</dt><dd>{activity.participantLimit}</dd></div></dl>
    </section>
    <section className="activity-duration-grid"><article className="panel"><span>ระยะเวลาทำ Pre-test</span><strong>{activity.preTestDurationMinutes} นาที</strong></article><article className="panel"><span>ระยะเวลาทำ Post-test</span><strong>{activity.postTestDurationMinutes} นาที</strong></article></section>
    <section className="activity-stat-grid"><article><span>Pre responses</span><strong>{stats.preCount}</strong></article><article><span>Post responses</span><strong>{stats.postCount}</strong></article><article><span>Paired</span><strong>{stats.pairedCount}</strong></article></section>
  </>
}

export default ActivityOverview
