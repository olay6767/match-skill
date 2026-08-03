import Card from '../ui/Card'
import { chartData } from './dashboardData'

function SkillGrowthChart() {
  return (
    <Card as="article" className="panel chart-panel">
      <div className="panel-heading">
        <h2>Skill Growth Trend</h2>
        <div className="chart-legend">
          <span><i className="legend-dot legend-dot--pre" /> Pre-test</span>
          <span><i className="legend-dot legend-dot--post" /> Post-test</span>
        </div>
      </div>
      <div className="bar-chart" aria-label="Skill growth trend from Monday to Sunday">
        {chartData.map((item) => (
          <div className="bar-group" key={item.day}>
            <div className="bar-pair">
              <span className="bar bar--pre" style={{ height: `${item.pre}%` }} />
              <span className="bar bar--post" style={{ height: `${item.post}%` }} />
            </div>
            <span>{item.day}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default SkillGrowthChart
