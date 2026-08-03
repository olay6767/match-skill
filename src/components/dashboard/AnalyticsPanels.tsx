import SkillGrowthChart from './SkillGrowthChart'
import TopSkillsCard from './TopSkillsCard'
import type { DemoAction } from './types'

type AnalyticsPanelsProps = {
  onDemoAction: DemoAction
}

function AnalyticsPanels({ onDemoAction }: AnalyticsPanelsProps) {
  return (
    <section className="analytics-grid">
      <SkillGrowthChart />
      <TopSkillsCard onDemoAction={onDemoAction} />
    </section>
  )
}

export default AnalyticsPanels
