import { useState } from 'react'
import type { AnalyticsCompetency } from '../../../lib/api'

type Props = { competencies: AnalyticsCompetency[] }

const score = (value: number | null) => value === null ? '—' : value.toFixed(2)

function radarPoint(index: number, value: number, total: number) {
  const angle = ((Math.PI * 2 * index) / total) - Math.PI / 2
  const radius = (value / 7) * 116
  return `${(165 + Math.cos(angle) * radius).toFixed(1)},${(165 + Math.sin(angle) * radius).toFixed(1)}`
}

function axisPoint(index: number, total: number, radius = 122) {
  const angle = ((Math.PI * 2 * index) / total) - Math.PI / 2
  return { x: 165 + Math.cos(angle) * radius, y: 165 + Math.sin(angle) * radius }
}

function CompetencyComparisonChart({ competencies }: Props) {
  const [activeRadarLabel, setActiveRadarLabel] = useState<AnalyticsCompetency | null>(null)
  const canDrawPre = competencies.length > 2 && competencies.every((item) => item.preAverage !== null)
  const canDrawPost = competencies.length > 2 && competencies.every((item) => item.postAverage !== null)
  const count = competencies.length
  const prePoints = canDrawPre ? competencies.map((item, index) => radarPoint(index, item.preAverage!, count)).join(' ') : ''
  const postPoints = canDrawPost ? competencies.map((item, index) => radarPoint(index, item.postAverage!, count)).join(' ') : ''

  return <section className="analytics-panel analytics-comparison" aria-labelledby="analytics-comparison-title">
    <div className="analytics-panel__header"><div><p className="eyebrow">ค่าเฉลี่ยรายสมรรถนะ</p><h2 id="analytics-comparison-title">เปรียบเทียบ Pre และ Post</h2><p>ค่าเฉลี่ยระดับ 1–7 ต่อสมรรถนะ โดยแสดง n ของ response ในแต่ละ phase</p></div><div className="analytics-legend" aria-label="คำอธิบายสี"><span><i className="analytics-legend__pre" />Pre</span><span><i className="analytics-legend__post" />Post</span></div></div>
    {competencies.length === 0 ? <div className="analytics-empty">ยังไม่มีคำตอบที่ตรงกับตัวกรอง</div> : <>
      <div className="analytics-chart-grid">
        <div className="analytics-bars" aria-label="กราฟแท่งเปรียบเทียบค่าเฉลี่ย Pre และ Post">
          {competencies.map((item) => <article className="analytics-bar-row" key={item.id}>
            <div className="analytics-bar-row__title"><strong>{item.displayOrder}. {item.name}</strong><span>Pre n={item.preCount} · Post n={item.postCount} · paired n={item.pairedCount}</span></div>
            <div className="analytics-bar"><span className="analytics-bar__label">Pre {score(item.preAverage)}</span><div className="analytics-bar__track">{item.preAverage !== null && <i className="analytics-bar__fill analytics-bar__fill--pre" style={{ width: `${(item.preAverage / 7) * 100}%` }} />}</div></div>
            <div className="analytics-bar"><span className="analytics-bar__label">Post {score(item.postAverage)}</span><div className="analytics-bar__track">{item.postAverage !== null && <i className="analytics-bar__fill analytics-bar__fill--post" style={{ width: `${(item.postAverage / 7) * 100}%` }} />}</div></div>
            <p className="analytics-growth">Growth: {score(item.growth)}</p>
          </article>)}
        </div>
        <figure className="analytics-radar"><figcaption>Radar chart: ค่าเฉลี่ย Pre และ Post (1–7)</figcaption>
          {activeRadarLabel && <div className="analytics-radar__tooltip" role="tooltip"><strong>{activeRadarLabel.displayOrder}</strong><span>{activeRadarLabel.name}</span></div>}
          {canDrawPre || canDrawPost ? <svg viewBox="0 0 330 330" role="img" aria-label="Radar chart เปรียบเทียบค่าเฉลี่ย Pre และ Post">
            {[1, 2, 3, 4, 5, 6, 7].map((level) => <circle key={level} cx="165" cy="165" r={(level / 7) * 116} className="analytics-radar__ring" />)}
            {competencies.map((item, index) => {
              const point = axisPoint(index, count)
              const labelPoint = axisPoint(index, count, 140)
              const isActive = activeRadarLabel?.id === item.id
              return <g
                key={item.id}
                className={`analytics-radar__label-target${isActive ? ' is-active' : ''}`}
                role="button"
                aria-label={`${item.displayOrder}. ${item.name}`}
                aria-pressed={isActive}
                tabIndex={0}
                onClick={() => setActiveRadarLabel((current) => current?.id === item.id ? null : item)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  setActiveRadarLabel((current) => current?.id === item.id ? null : item)
                }}
              >
                <line x1="165" y1="165" x2={point.x} y2={point.y} className="analytics-radar__axis" />
                <circle cx={labelPoint.x} cy={labelPoint.y} r="15" className="analytics-radar__label-hit" />
                <text x={labelPoint.x} y={labelPoint.y} className="analytics-radar__label">{item.displayOrder}</text>
              </g>
            })}
            {canDrawPre && <polygon points={prePoints} className="analytics-radar__shape analytics-radar__shape--pre" />}
            {canDrawPost && <polygon points={postPoints} className="analytics-radar__shape analytics-radar__shape--post" />}
            <g className="analytics-radar__scale" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6, 7].map((level) => <text key={level} x="170" y={165 - (level / 7) * 116 + 4}>{level}</text>)}
            </g>
          </svg> : <div className="analytics-empty">ต้องมีค่าเฉลี่ยครบทุกสมรรถนะใน phase เดียวกันก่อนจึงจะแสดง Radar chart</div>}
        </figure>
      </div>
      <div className="analytics-values" aria-label="ค่าตัวเลขของกราฟ">
        <h3>ค่าตัวเลขของกราฟ</h3><table><thead><tr><th>สมรรถนะ</th><th>Pre</th><th>Post</th><th>Growth</th><th>n (Pre/Post/paired)</th></tr></thead><tbody>{competencies.map((item) => <tr key={item.id}><td>{item.displayOrder}. {item.name}</td><td>{score(item.preAverage)}</td><td>{score(item.postAverage)}</td><td>{score(item.growth)}</td><td>{item.preCount}/{item.postCount}/{item.pairedCount}</td></tr>)}</tbody></table>
      </div>
    </>}
  </section>
}

export default CompetencyComparisonChart
