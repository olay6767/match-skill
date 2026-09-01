import type { PublicSurveyQuestion } from '../../../lib/api'
import LevelOptionCard from './LevelOptionCard'

type CompetencyQuestionProps = {
  question: PublicSurveyQuestion
  value?: number
  onChange: (levelValue: number) => void
}

function CompetencyQuestion({ question, value, onChange }: CompetencyQuestionProps) {
  const examples = question.levels.filter((level) => level.example)
  return (
    <fieldset className="student-question">
      <legend>{question.name}</legend>
      <p className="student-question-definition">{question.definition}</p>
      {examples.length > 0 && <aside className="student-question-example" aria-label="ตัวอย่างเพื่อประกอบการประเมิน"><strong>ตัวอย่างเพื่อประกอบการประเมิน</strong><ul>{examples.map((level) => <li key={level.levelValue}><b>ระดับ {level.levelValue}:</b> {level.example}</li>)}</ul></aside>}
      <p className="student-question-instruction">เลือก 1 ระดับที่ใกล้เคียงกับตัวคุณมากที่สุด</p>
      <div className="student-level-options">
        {question.levels.map((level) => (
          <LevelOptionCard
            key={level.levelValue}
            questionId={question.questionId}
            level={level}
            selected={value === level.levelValue}
            onChange={onChange}
          />
        ))}
      </div>
    </fieldset>
  )
}

export default CompetencyQuestion
