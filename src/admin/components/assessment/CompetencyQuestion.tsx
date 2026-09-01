import type { SurveyCompetency } from '../dashboard/types'

function CompetencyQuestion({ competency, value, onChange, preview=false }: { competency:SurveyCompetency; value?:number; onChange?:(level:number)=>void; preview?:boolean }) {
  return <fieldset className="competency-question"><legend><strong>{competency.displayOrder}. {competency.name}</strong><span>{competency.definition}</span></legend><div className="competency-level-options">{competency.levels.map(level=><label key={level.level}><input type="radio" name={`competency-${competency.id}`} value={level.level} checked={value===level.level} onChange={()=>onChange?.(level.level)} disabled={preview}/><span><b>{level.level}. {level.title}</b><small>{level.description}</small>{level.example&&<em>ตัวอย่าง: {level.example}</em>}</span></label>)}</div></fieldset>
}
export default CompetencyQuestion
