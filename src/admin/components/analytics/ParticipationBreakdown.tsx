import type { AnalyticsBreakdown, AnalyticsOverview } from '../../../lib/api'

type Props = { overview: AnalyticsOverview; faculties: AnalyticsBreakdown[]; educationLevels: AnalyticsBreakdown[] }

function BreakdownList({ title, values }: { title: string; values: AnalyticsBreakdown[] }) {
  const maximum = Math.max(...values.map((value) => value.studentCount), 1)
  return <section className="analytics-breakdown-list" aria-labelledby={`breakdown-${title}`}><h3 id={`breakdown-${title}`}>{title}</h3>{values.length === 0 ? <p>ไม่มีข้อมูลที่ตรงกับตัวกรอง</p> : <ul>{values.map((value) => <li key={value.label}><div><strong>{value.label}</strong><span>{value.studentCount} คน · Pre {value.preCount} · Post {value.postCount} · paired {value.pairedCount}</span></div><i className="admin-chart-point admin-chart-point--horizontal" tabIndex={0} aria-label={`${value.label} ${value.studentCount} คน Pre ${value.preCount} Post ${value.postCount} ครบคู่ ${value.pairedCount}`} data-chart-tooltip={`${value.studentCount} คน · Pre ${value.preCount} · Post ${value.postCount} · ครบคู่ ${value.pairedCount}`}><b style={{ width: `${(value.studentCount / maximum) * 100}%` }} /></i></li>)}</ul>}</section>
}

function ParticipationBreakdown({ overview, faculties, educationLevels }: Props) {
  return <section className="analytics-panel" aria-labelledby="analytics-participation-title"><div className="analytics-panel__header"><div><p className="eyebrow">ผู้เข้าร่วม</p><h2 id="analytics-participation-title">สัดส่วนจากข้อมูลที่มีจริง</h2><p>นับผู้เรียนไม่ซ้ำในตัวกรองปัจจุบัน และ paired คือคนที่มีทั้ง Pre และ Post ในกิจกรรมเดียวกัน</p></div></div>
    <div className="analytics-metrics"><div><span>ผู้เรียนไม่ซ้ำ</span><strong>{overview.studentCount}</strong></div><div><span>Pre responses</span><strong>{overview.preCount}</strong></div><div><span>Post responses</span><strong>{overview.postCount}</strong></div><div><span>อัตรา paired / Pre</span><strong>{overview.completionRate === null ? '—' : `${overview.completionRate.toFixed(1)}%`}</strong></div></div>
    <div className="analytics-breakdowns"><BreakdownList title="คณะ" values={faculties} /><BreakdownList title="ระดับการศึกษา" values={educationLevels} /></div>
  </section>
}

export default ParticipationBreakdown
