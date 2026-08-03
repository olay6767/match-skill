import { chartData, topSkills } from './dashboardData'
import type { DemoAction } from './types'

type AnalyticsPanelsProps = {
  onDemoAction: DemoAction
}

function SkillGrowthChart() {
  return (
    <article className="panel chart-panel">
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
    </article>
  )
}

function TopSkills({ onDemoAction }: AnalyticsPanelsProps) {
  return (
    <article className="panel skills-panel">
      <div className="panel-heading"><h2>Top Skills Assessed</h2></div>
      <div className="skill-list">
        {topSkills.map((skill) => (
          <div className="skill-row" key={skill.name}>
            <div><span>{skill.name}</span><strong>{skill.value}%</strong></div>
            <span className="skill-track"><span style={{ width: `${skill.value}%` }} /></span>
          </div>
        ))}
      </div>
      <button className="analytics-button" type="button" onClick={() => onDemoAction('Detailed Analytics')}>
        View Detailed Analytics
      </button>
    </article>
  )
}

function AnalyticsPanels({ onDemoAction }: AnalyticsPanelsProps) {
  return (
    <section className="analytics-grid">
      <SkillGrowthChart />
      <TopSkills onDemoAction={onDemoAction} />
    </section>
  )
}

export default AnalyticsPanels
