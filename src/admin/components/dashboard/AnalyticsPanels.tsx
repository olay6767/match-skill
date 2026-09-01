import SkillGrowthChart from './SkillGrowthChart'
import TopSkillsCard from './TopSkillsCard'
import type { CompetencyGrowth } from './types'

type AnalyticsPanelsProps = {
  data: CompetencyGrowth[]
}

function AnalyticsPanels({ data }: AnalyticsPanelsProps) {
  return (
    <section className="analytics-grid">
      <SkillGrowthChart data={data} />
      <TopSkillsCard data={data} />
    </section>
  )
}

export default AnalyticsPanels
