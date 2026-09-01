type SkillBarProps = {
  name: string
  value: number | null
}

function SkillBar({ name, value }: SkillBarProps) {
  const normalizedValue = value === null ? null : Math.min(7, Math.max(0, value))
  const scoreLabel = normalizedValue === null ? '—' : normalizedValue.toFixed(1)
  return (
    <div className="skill-row">
      <div><span>{name}</span><strong>{scoreLabel} / 7</strong></div>
      <span className="skill-track" aria-label={`${name} ${scoreLabel} จาก 7`}><span style={{ width: `${normalizedValue === null ? 0 : (normalizedValue / 7) * 100}%` }} /></span>
    </div>
  )
}

export default SkillBar
