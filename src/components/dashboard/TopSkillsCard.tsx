import Button from '../ui/Button'
import Card from '../ui/Card'
import { topSkills } from './dashboardData'
import SkillBar from './SkillBar'
import type { DemoAction } from './types'

type TopSkillsCardProps = {
  onDemoAction: DemoAction
}

function TopSkillsCard({ onDemoAction }: TopSkillsCardProps) {
  return (
    <Card as="article" className="panel skills-panel">
      <div className="panel-heading"><h2>Top Skills Assessed</h2></div>
      <div className="skill-list">
        {topSkills.map((skill) => <SkillBar key={skill.name} {...skill} />)}
      </div>
      <Button className="analytics-button" onClick={() => onDemoAction('Detailed Analytics')}>
        View Detailed Analytics
      </Button>
    </Card>
  )
}

export default TopSkillsCard
