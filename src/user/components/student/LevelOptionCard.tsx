type LevelOptionCardProps = {
  questionId: number
  level: { levelValue: number; title: string; description: string }
  selected: boolean
  onChange: (value: number) => void
}

function LevelOptionCard({ questionId, level, selected, onChange }: LevelOptionCardProps) {
  const id = `question-${questionId}-level-${level.levelValue}`
  return (
    <label className={`student-level-card${selected ? ' student-level-card--selected' : ''}`} htmlFor={id}>
      <input
        id={id}
        type="radio"
        name={`question-${questionId}`}
        value={level.levelValue}
        checked={selected}
        onChange={() => onChange(level.levelValue)}
      />
      <span className="student-level-number" aria-hidden="true">{level.levelValue}</span>
      <span className="student-level-content">
        <strong>{level.title}</strong>
        <span>{level.description}</span>
      </span>
    </label>
  )
}

export default LevelOptionCard
