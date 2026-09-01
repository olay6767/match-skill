type ResultCompetency = {
  competencyId: number
  name: string
  levelValue: number
}

type Phase = 'pre' | 'post'

type PersonalSkillChartProps = {
  competencies: ResultCompetency[]
  comparison: { pre: ResultCompetency[]; post: ResultCompetency[] } | null
  phase: Phase
}

type LikertScale = {
  min: number
  max: number
  interpretation: string
}

const likertScales: LikertScale[] = [
  { min: 1.00, max: 1.85, interpretation: 'ตระหนักรู้' },
  { min: 1.86, max: 2.71, interpretation: 'เริ่มลอง' },
  { min: 2.72, max: 3.57, interpretation: 'พัฒนา' },
  { min: 3.58, max: 4.43, interpretation: 'ชำนาญ' },
  { min: 4.44, max: 5.29, interpretation: 'ก้าวหน้า' },
  { min: 5.30, max: 6.15, interpretation: 'ผู้เชี่ยวชาญ' },
  { min: 6.16, max: 7.00, interpretation: 'ผู้มีวิสัยทัศน์' },
]

function mean(competencies: ResultCompetency[] | null) {
  if (!competencies?.length) return null
  return competencies.reduce((total, item) => total + item.levelValue, 0) / competencies.length
}

function interpret(value: number | null) {
  if (value === null) return '-'
  return likertScales.find((scale) => value >= scale.min && value <= scale.max)?.interpretation ?? '-'
}

function point(index: number, value: number, total: number, radius = 108) {
  const angle = ((Math.PI * 2 * index) / total) - Math.PI / 2
  const distance = (value / 7) * radius
  return `${(160 + Math.cos(angle) * distance).toFixed(1)},${(160 + Math.sin(angle) * distance).toFixed(1)}`
}

function axisPoint(index: number, total: number, radius = 114) {
  const angle = ((Math.PI * 2 * index) / total) - Math.PI / 2
  return { x: 160 + Math.cos(angle) * radius, y: 160 + Math.sin(angle) * radius }
}

function seriesPoints(axes: ResultCompetency[], values: ResultCompetency[] | null) {
  if (!values || axes.length < 3) return null
  const scores = new Map(values.map((item) => [item.competencyId, item.levelValue]))
  if (axes.some((axis) => scores.get(axis.competencyId) === undefined)) return null
  return axes.map((axis, index) => point(index, scores.get(axis.competencyId)!, axes.length)).join(' ')
}

function phaseLabel(phase: Phase) {
  return phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'
}

function PersonalSkillChart({ competencies, comparison, phase }: PersonalSkillChartProps) {
  const pre = comparison?.pre ?? (phase === 'pre' ? competencies : null)
  const post = comparison?.post ?? (phase === 'post' ? competencies : null)
  const prePoints = seriesPoints(competencies, pre)
  const postPoints = seriesPoints(competencies, post)
  const preMean = mean(pre)
  const postMean = mean(post)
  const showComparison = pre !== null && post !== null

  return (
    <section className="student-result-chart" aria-labelledby="personal-radar-heading">
      <div className="student-result-section-heading">
        <h2 id="personal-radar-heading">Radar chart ผลการประเมิน</h2>
        <span>คะแนนระดับ 1–7</span>
      </div>
      {(prePoints || postPoints) && <figure className="student-radar-chart">
        {showComparison && <div className="student-chart-legend" aria-label="คำอธิบายสี"><span><i className="student-chart-legend-pre" />Pre-test</span><span><i className="student-chart-legend-post" />Post-test</span></div>}
        <svg viewBox="0 0 320 320" role="img" aria-label={showComparison ? 'Radar chart เปรียบเทียบผล Pre-test และ Post-test' : `Radar chart ผล ${phaseLabel(phase)}`}>
          {[1, 2, 3, 4, 5, 6, 7].map((level) => <circle key={level} cx="160" cy="160" r={(level / 7) * 108} className="student-radar-ring" />)}
          {competencies.map((competency, index) => {
            const end = axisPoint(index, competencies.length)
            const label = axisPoint(index, competencies.length, 133)
            return <g key={competency.competencyId}><line x1="160" y1="160" x2={end.x} y2={end.y} className="student-radar-axis" /><text x={label.x} y={label.y} className="student-radar-label"><title>{competency.name}</title>{index + 1}</text></g>
          })}
          {prePoints && <polygon points={prePoints} className="student-radar-shape student-radar-shape--pre" />}
          {postPoints && <polygon points={postPoints} className="student-radar-shape student-radar-shape--post" />}
          <g className="student-radar-scale" aria-hidden="true">
            {[1, 2, 3, 4, 5, 6, 7].map((level) => <text key={level} x="165" y={160 - (level / 7) * 108 + 4}>{level}</text>)}
          </g>
        </svg>
        <figcaption>ตัวเลข 1–9 รอบกราฟแทนสมรรถนะตามลำดับในแบบประเมิน</figcaption>
      </figure>}

      <div className="student-likert-summary" aria-label="สรุปค่าเฉลี่ยและการแปลผล">
        {preMean !== null && <Summary phase="pre" value={preMean} />}
        {postMean !== null && <Summary phase="post" value={postMean} />}
      </div>
    </section>
  )
}

function Summary({ phase, value }: { phase: Phase; value: number }) {
  return <div><span>{phaseLabel(phase)}</span><strong>{value.toFixed(2)}</strong><small>{interpret(value)}</small></div>
}

export default PersonalSkillChart
