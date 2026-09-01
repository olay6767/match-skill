import type { AnalyticsCompetency, AnalyticsOverview } from '../../../lib/api'

type Props = {
  primary: AnalyticsCompetency[]
  comparison: AnalyticsCompetency[]
  primaryOverview: AnalyticsOverview
  comparisonOverview: AnalyticsOverview
  primaryActivityName: string
  comparisonActivityName: string
}

const score = (value: number | null) => value === null ? '—' : value.toFixed(2)
const growthDifference = (primary: number | null, comparison: number | null) => {
  if (primary === null || comparison === null) return '—'
  const difference = primary - comparison
  return (difference > 0 ? '+' : '') + difference.toFixed(2)
}

function ActivityComparisonPanel({
  primary,
  comparison,
  primaryOverview,
  comparisonOverview,
  primaryActivityName,
  comparisonActivityName,
}: Props) {
  const comparisonByCode = new Map(comparison.map((item) => [item.code, item]))

  return <section className="analytics-panel analytics-activity-compare" aria-labelledby="activity-comparison-title">
    <div className="analytics-panel__header">
      <div>
        <p className="eyebrow">เปรียบเทียบกิจกรรม</p>
        <h2 id="activity-comparison-title">{primaryActivityName} เทียบกับ {comparisonActivityName}</h2>
        <p>ใช้ช่วงวัน คณะ และระดับการศึกษาเดียวกันทั้งสองกิจกรรม เพื่อให้เทียบผลได้ตรงกัน</p>
      </div>
    </div>

    <div className="activity-comparison-summary" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 20 }}>
      <article style={{ padding: 14, border: '1px solid #dce6f2', borderRadius: 10, background: '#f8fbff' }}>
        <h3>กิจกรรมหลัก</h3>
        <strong>{primaryActivityName}</strong>
        <p>ผู้เรียน {primaryOverview.studentCount} คน · Pre {primaryOverview.preCount} · Post {primaryOverview.postCount} · paired {primaryOverview.pairedCount}</p>
      </article>
      <article style={{ padding: 14, border: '1px solid #dce6f2', borderRadius: 10, background: '#f8fbff' }}>
        <h3>กิจกรรมที่เปรียบเทียบ</h3>
        <strong>{comparisonActivityName}</strong>
        <p>ผู้เรียน {comparisonOverview.studentCount} คน · Pre {comparisonOverview.preCount} · Post {comparisonOverview.postCount} · paired {comparisonOverview.pairedCount}</p>
      </article>
    </div>

    {primary.length === 0 && comparison.length === 0 ? <div className="analytics-empty">ยังไม่มีข้อมูลคำตอบของกิจกรรมที่เลือก</div> : <div className="analytics-values activity-comparison-table">
      <h3>ค่าเฉลี่ยรายสมรรถนะ (1–7)</h3>
      <table>
        <thead>
          <tr>
            <th>สมรรถนะ</th>
            <th>{primaryActivityName} Pre</th>
            <th>{primaryActivityName} Post</th>
            <th>{primaryActivityName} Growth</th>
            <th>{comparisonActivityName} Pre</th>
            <th>{comparisonActivityName} Post</th>
            <th>{comparisonActivityName} Growth</th>
            <th>ต่างกัน (Growth)</th>
          </tr>
        </thead>
        <tbody>
          {primary.map((item) => {
            const compared = comparisonByCode.get(item.code)
            return <tr key={item.code}>
              <td>{item.displayOrder}. {item.name}</td>
              <td>{score(item.preAverage)}</td>
              <td>{score(item.postAverage)}</td>
              <td>{score(item.growth)}</td>
              <td>{score(compared?.preAverage ?? null)}</td>
              <td>{score(compared?.postAverage ?? null)}</td>
              <td>{score(compared?.growth ?? null)}</td>
              <td>{growthDifference(item.growth, compared?.growth ?? null)}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>}
  </section>
}

export default ActivityComparisonPanel
