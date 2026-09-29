import type { AnalyticsCompetency } from "../../../lib/api"

type Props = { competencies: AnalyticsCompetency[] }

const score = (value: number | null) => value === null ? "—" : value.toFixed(2)
const growth = (value: number | null) => value === null ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}`
const compactName = (value: string) => value.replace(/\s*[(（][^)）]*[)）]\s*$/u, "").trim() || value
const growthTone = (value: number | null) => value === null || Math.abs(value) < 0.005
  ? "is-neutral"
  : value > 0 ? "is-positive" : "is-negative"

function CompetencyComparisonChart({ competencies }: Props) {
  return <section className="analytics-panel analytics-comparison analytics-comparison--compact" aria-labelledby="analytics-comparison-title">
    <div className="analytics-panel__header">
      <h2 id="analytics-comparison-title">คะแนนรายสมรรถนะ</h2>
      <div className="analytics-legend" aria-label="คำอธิบายสี"><span className="is-pre"><i className="analytics-legend__pre" />Pre-test</span><span className="is-post"><i className="analytics-legend__post" />Post-test</span></div>
    </div>
    {competencies.length === 0 ? <div className="analytics-empty">ยังไม่มีข้อมูลคะแนน</div> : <div className="analytics-bars" aria-label="กราฟคะแนน Pre-test และ Post-test รายสมรรถนะ">
      {competencies.map((item) => <article className="analytics-bar-row" key={item.id}>
        <div className="analytics-bar-row__title">
          <em>{item.displayOrder}</em>
          <strong>{compactName(item.name)}</strong>
          <span className={growthTone(item.growth)} title="ผลต่าง Post-test และ Pre-test">{growth(item.growth)}</span>
        </div>
        <div className="analytics-bar-row__scores">
          <div className="analytics-bar" aria-label={`Pre-test ${score(item.preAverage)} คะแนนจาก 7`}><b className="analytics-bar__label">PRE</b><div className={`analytics-bar__track${item.preAverage === null ? '' : ' admin-chart-point admin-chart-point--horizontal'}`} tabIndex={item.preAverage === null ? undefined : 0} aria-label={item.preAverage === null ? undefined : `${item.name} Pre-test ${score(item.preAverage)} จาก 7`} data-chart-tooltip={item.preAverage === null ? undefined : `Pre-test ${score(item.preAverage)} / 7`}>{item.preAverage !== null && <i className="analytics-bar__fill analytics-bar__fill--pre" style={{ width: `${(item.preAverage / 7) * 100}%` }} />}</div><span className="analytics-bar__value"><strong>{score(item.preAverage)}</strong><small>/7</small></span></div>
          <div className="analytics-bar" aria-label={`Post-test ${score(item.postAverage)} คะแนนจาก 7`}><b className="analytics-bar__label">POST</b><div className={`analytics-bar__track${item.postAverage === null ? '' : ' admin-chart-point admin-chart-point--horizontal'}`} tabIndex={item.postAverage === null ? undefined : 0} aria-label={item.postAverage === null ? undefined : `${item.name} Post-test ${score(item.postAverage)} จาก 7`} data-chart-tooltip={item.postAverage === null ? undefined : `Post-test ${score(item.postAverage)} / 7`}>{item.postAverage !== null && <i className="analytics-bar__fill analytics-bar__fill--post" style={{ width: `${(item.postAverage / 7) * 100}%` }} />}</div><span className="analytics-bar__value"><strong>{score(item.postAverage)}</strong><small>/7</small></span></div>
        </div>
      </article>)}
    </div>}
  </section>
}

export default CompetencyComparisonChart
