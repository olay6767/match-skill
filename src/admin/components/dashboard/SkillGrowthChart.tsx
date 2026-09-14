import { useState } from 'react'
import Card from '../../../shared/components/ui/Card'
import type { CompetencyGrowth } from './types'

type ScoreMode = 'average' | 'maximum' | 'minimum'
type ChartMode = 'combined' | 'comparison'

const chartModes: Array<{ value: ChartMode; label: string; ariaLabel: string }> = [
  { value: 'combined', label: 'คะแนนรวม', ariaLabel: 'ดูคะแนนรวม Pre-test และ Post-test' },
  { value: 'comparison', label: 'ก่อน / หลัง', ariaLabel: 'เปรียบเทียบคะแนน Pre-test และ Post-test' },
]

const scoreModes: Array<{ value: ScoreMode; label: string; ariaLabel: string }> = [
  { value: 'average', label: 'เฉลี่ย', ariaLabel: 'คะแนนเฉลี่ย' },
  { value: 'maximum', label: 'สูงสุด', ariaLabel: 'คะแนนสูงสุด' },
  { value: 'minimum', label: 'ต่ำสุด', ariaLabel: 'คะแนนต่ำสุด' },
]

function scoreFor(item: CompetencyGrowth, phase: 'pre' | 'post', mode: ScoreMode) {
  if (mode === 'maximum') return (phase === 'pre' ? item.preMaximum : item.postMaximum) ?? null
  if (mode === 'minimum') return (phase === 'pre' ? item.preMinimum : item.postMinimum) ?? null
  return (phase === 'pre' ? item.preAverage : item.postAverage) ?? null
}

function combinedAverageFor(item: CompetencyGrowth) {
  if (item.combinedAverage !== undefined) return item.combinedAverage

  const scores = [
    { value: item.preAverage, count: item.preCount },
    { value: item.postAverage, count: item.postCount },
  ].filter((entry): entry is { value: number; count: number } => entry.value !== null && entry.count > 0)

  const count = scores.reduce((total, entry) => total + entry.count, 0)
  return count > 0
    ? scores.reduce((total, entry) => total + (entry.value * entry.count), 0) / count
    : null
}

function combinedScoreFor(item: CompetencyGrowth, mode: ScoreMode) {
  if (mode === 'average') return combinedAverageFor(item)

  const values = mode === 'maximum'
    ? [item.preMaximum, item.postMaximum]
    : [item.preMinimum, item.postMinimum]
  const available = values.filter((value): value is number => value !== null && value !== undefined)

  if (available.length === 0) return null
  return mode === 'maximum' ? Math.max(...available) : Math.min(...available)
}

function SkillGrowthChart({ data }: { data: CompetencyGrowth[] }) {
  const [chartMode, setChartMode] = useState<ChartMode>('comparison')
  const [scoreMode, setScoreMode] = useState<ScoreMode>('average')
  const modeLabel = scoreModes.find((mode) => mode.value === scoreMode)?.ariaLabel ?? 'คะแนนเฉลี่ย'
  const isCombined = chartMode === 'combined'
  const hasScores = data.some((item) => isCombined
    ? combinedScoreFor(item, scoreMode) !== null
    : scoreFor(item, 'pre', scoreMode) !== null || scoreFor(item, 'post', scoreMode) !== null)
  const levels = [7, 6, 5, 4, 3, 2, 1]
  return (
    <Card as="article" className="panel chart-panel">
      <div className="panel-heading chart-panel-heading">
        <div>
          <h2>ภาพรวมคะแนนสมรรถนะ</h2>
          <p>คะแนนเต็ม 7 แยกตามสมรรถนะ</p>
        </div>
        <div className="chart-heading-actions">
          <div className="chart-control-row">
            <div className="chart-view-mode" role="group" aria-label="เลือกรูปแบบกราฟ">
              {chartModes.map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  className={chartMode === mode.value ? 'is-active' : ''}
                  aria-pressed={chartMode === mode.value}
                  aria-label={mode.ariaLabel}
                  onClick={() => setChartMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <div className="chart-score-mode" role="group" aria-label="เลือกประเภทคะแนนในกราฟ">
              {scoreModes.map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  className={scoreMode === mode.value ? 'is-active' : ''}
                  aria-pressed={scoreMode === mode.value}
                  aria-label={mode.ariaLabel}
                  onClick={() => setScoreMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            {isCombined
              ? <span><i className="legend-dot legend-dot--combined" /> รวม PRE + POST</span>
              : <><span><i className="legend-dot legend-dot--pre" /> Pre-test</span><span><i className="legend-dot legend-dot--post" /> Post-test</span></>}
          </div>
        </div>
      </div>
      {!hasScores ? <div className="empty-state">ยังไม่มีผล Pre-test หรือ Post-test สำหรับตัวกรองนี้</div> : (
        <div className="bar-chart" aria-label={isCombined ? `${modeLabel}รวม Pre-test และ Post-test แยกตามสมรรถนะ คะแนนเต็ม 7` : `${modeLabel} Pre-test และ Post-test แยกตามสมรรถนะ คะแนนเต็ม 7`}>
          <div className="bar-chart__y-axis" aria-hidden="true">
            {levels.map((level) => <span key={level} style={{ bottom: `${(level / 7) * 100}%` }}>{level}</span>)}
          </div>
          <div className="bar-chart__plot">
            <div className="bar-chart__grid" aria-hidden="true">
              {levels.map((level) => <i key={level} style={{ bottom: `${(level / 7) * 100}%` }} />)}
            </div>
            {data.map((item) => {
              const combinedScore = combinedScoreFor(item, scoreMode)
              const preScore = scoreFor(item, 'pre', scoreMode)
              const postScore = scoreFor(item, 'post', scoreMode)
              return (
                <div className="bar-group" key={item.id} title={isCombined ? `${item.name}: PRE + POST ${modeLabel} ${combinedScore?.toFixed(2) ?? 'ไม่มีข้อมูล'}` : `${item.name}: Pre ${preScore ?? 'ไม่มีข้อมูล'}, Post ${postScore ?? 'ไม่มีข้อมูล'}`}>
                  <div key={`${chartMode}-${scoreMode}-${item.id}`} className={`bar-pair${isCombined ? ' bar-pair--single' : ''}`}>
                    {isCombined
                      ? <span className="bar bar--combined" style={{ height: `${((combinedScore ?? 0) / 7) * 100}%` }} />
                      : <><span className="bar bar--pre" style={{ height: `${((preScore ?? 0) / 7) * 100}%` }} /><span className="bar bar--post" style={{ height: `${((postScore ?? 0) / 7) * 100}%` }} /></>}
                  </div>
                  <span>{item.code.slice(0, 3).toUpperCase()}</span>
                  <span className="sr-only">{isCombined
                    ? `${item.name}: ${modeLabel}รวม Pre-test และ Post-test ${combinedScore?.toFixed(2) ?? 'ไม่มีข้อมูล'} จาก 7 จำนวน ${item.preCount + item.postCount} คำตอบ`
                    : `${item.name}: ${modeLabel} Pre-test ${preScore ?? 'ไม่มีข้อมูล'} จาก 7 จำนวน ${item.preCount}, Post-test ${postScore ?? 'ไม่มีข้อมูล'} จาก 7 จำนวน ${item.postCount}`}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Card>
  )
}

export default SkillGrowthChart
