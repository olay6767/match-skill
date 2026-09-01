import { pool } from './pool.js'
import { assessmentCompetencies, assessmentLevelTitles } from './assessmentData.js'

export async function ensureAssessmentSeed() {
  const templateRows = await pool.query<Array<{ id: number }>>("SELECT id FROM survey_templates WHERE status='active' ORDER BY version DESC LIMIT 1")
  const templateId = Number(templateRows[0]?.id)
  if (!templateId) return
  for (let index = 0; index < assessmentCompetencies.length; index++) {
    const item = assessmentCompetencies[index]!
    const existing = await pool.query<Array<{ id: number }>>('SELECT id FROM competencies WHERE code=? AND template_id=? LIMIT 1', [item.code, templateId])
    const unassigned = existing[0] ? [] : await pool.query<Array<{ id: number }>>('SELECT id FROM competencies WHERE code=? AND template_id IS NULL LIMIT 1', [item.code])
    let competencyId = Number(existing[0]?.id ?? unassigned[0]?.id)
    if (competencyId) {
      await pool.query('UPDATE competencies SET template_id=?, name=?, definition=?, display_order=? WHERE id=?', [templateId, item.name, item.definition, index + 1, competencyId])
    } else {
      const result = await pool.query('INSERT INTO competencies (template_id,code,name,definition,display_order) VALUES (?,?,?,?,?)', [templateId, item.code, item.name, item.definition, index + 1])
      competencyId = Number(result.insertId)
    }
    await pool.query(`INSERT INTO questions (template_id,competency_id,display_order,is_required) VALUES (?,?,?,TRUE)
      ON DUPLICATE KEY UPDATE display_order=VALUES(display_order),is_required=TRUE`, [templateId, competencyId, index + 1])
    for (let level = 1; level <= 7; level++) {
      const example = level === 3 ? item.examples[3] : level === 5 ? item.examples[5] : null
      await pool.query(`INSERT INTO competency_levels (competency_id,level,title,description,example) VALUES (?,?,?,?,?)
        ON DUPLICATE KEY UPDATE title=VALUES(title),description=VALUES(description),example=VALUES(example)`,
      [competencyId, level, assessmentLevelTitles[level - 1]!, item.levels[level - 1]!, example])
    }
  }
}
