import { useState } from 'react'
import { updateCompetency, updateCompetencyLevel } from '../../../lib/api'
import type { SurveyCompetency } from '../dashboard/types'
import Button from '../../../shared/components/ui/Button'

function CompetencyEditModal({competency,onClose,onSaved}:{competency:SurveyCompetency|null;onClose:()=>void;onSaved:()=>void}){
  const [draft,setDraft]=useState(competency);const [error,setError]=useState('');const [saving,setSaving]=useState(false)
  if(!draft)return null
  const save=async()=>{setSaving(true);setError('');try{await updateCompetency(draft.id,{name:draft.name,definition:draft.definition});await Promise.all(draft.levels.map(level=>updateCompetencyLevel(draft.id,level)));onSaved();onClose()}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่ได้')}finally{setSaving(false)}}
  return <div className="modal-overlay" onMouseDown={onClose}><section className="modal-card competency-edit-modal" role="dialog" aria-modal="true" aria-labelledby="competency-edit-title" onMouseDown={e=>e.stopPropagation()}><div className="modal-header"><h2 id="competency-edit-title">แก้ไขสมรรถนะ</h2><Button onClick={onClose}>×</Button></div><div className="competency-edit-body"><label>ชื่อ<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label><label>คำจำกัดความ<textarea value={draft.definition} onChange={e=>setDraft({...draft,definition:e.target.value})}/></label>{draft.levels.map((level,index)=><section key={level.level}><h3>ระดับ {level.level}</h3><label>ชื่อระดับ<input value={level.title} onChange={e=>setDraft({...draft,levels:draft.levels.map((x,i)=>i===index?{...x,title:e.target.value}:x)})}/></label><label>คำอธิบาย<textarea value={level.description} onChange={e=>setDraft({...draft,levels:draft.levels.map((x,i)=>i===index?{...x,description:e.target.value}:x)})}/></label><label>ตัวอย่าง<textarea value={level.example??''} onChange={e=>setDraft({...draft,levels:draft.levels.map((x,i)=>i===index?{...x,example:e.target.value||null}:x)})}/></label></section>)}</div>{error&&<p role="alert">{error}</p>}<div className="modal-actions"><Button onClick={onClose}>ยกเลิก</Button><Button disabled={saving} onClick={save}>{saving?'กำลังบันทึก...':'บันทึก'}</Button></div></section></div>
}
export default CompetencyEditModal
