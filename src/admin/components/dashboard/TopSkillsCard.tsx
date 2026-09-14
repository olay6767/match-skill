import { useState } from 'react'
import Card from '../../../shared/components/ui/Card'
import SkillBar from './SkillBar'
import type { CompetencyGrowth } from './types'

type TopSkillsCardProps = {
  data: CompetencyGrowth[]
}

function TopSkillsCard({ data }: TopSkillsCardProps) {
  const [expanded, setExpanded] = useState(false)
  const ranked = data
    .slice()
    .sort((a, b) => (b.postAverage ?? -1) - (a.postAverage ?? -1))
    .slice(0, 9)
  const visibleSkills = expanded ? ranked : ranked.slice(0, 4)
  const hiddenCount = Math.max(0, ranked.length - 4)
  return (
    <Card as="article" className="panel skills-panel">
      <div className="panel-heading"><div><h2>สมรรถนะเด่นหลังประเมิน</h2><p>เรียงจากคะแนน Post-test สูงสุด</p></div></div>
      <div className="skill-list">
        {visibleSkills.map((skill) => <SkillBar key={skill.id} name={skill.name} value={skill.postAverage} />)}
      </div>
      {ranked.length === 0 && <div className="empty-state">ยังไม่มีคะแนน Post-test</div>}
      {hiddenCount > 0 && <button className="skill-list-toggle" type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>{expanded ? 'แสดงน้อยลง' : `ดูทั้งหมด (${hiddenCount})`}</button>}
      {ranked.length > 0 && <p className="chart-caption">แสดงคะแนนเฉลี่ย Post-test ครบทั้ง 9 สมรรถนะ · คะแนนเต็ม 7</p>}
    </Card>
  )
}

export default TopSkillsCard
