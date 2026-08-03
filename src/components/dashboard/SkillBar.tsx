type SkillBarProps = {
  name: string
  value: number
}

function SkillBar({ name, value }: SkillBarProps) {
  return (
    <div className="skill-row">
      <div><span>{name}</span><strong>{value}%</strong></div>
      <span className="skill-track"><span style={{ width: `${value}%` }} /></span>
    </div>
  )
}

export default SkillBar
