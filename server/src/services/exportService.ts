import ExcelJS from 'exceljs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from '../db/pool.js'
import { ApiError } from '../lib/http.js'

export type ReportFilters = { activityId: number }
type ActivityRow = { id: number; code: string | null; name: string }
type RawAnswerRow = { student_code: string; first_name: string | null; last_name: string | null; email: string | null; faculty: string | null; major: string | null; study_year: number | string | null; education_level: string | null; phone: string | null; activity_code: string | null; activity_name: string; phase: 'pre' | 'post'; submitted_at: Date | string; competency_code: string; competency_name: string; score: number | string }
type FinalAnswerRow = { student_id: number | string; student_code: string; first_name: string | null; last_name: string | null; faculty: string | null; major: string | null; study_year: number | string | null; phase: 'pre' | 'post'; display_order: number | string; score: number | string }
export type FinalSheetStudent = { studentCode: string; name: string; faculty: string; major: string; studyYear: number | string | null; preScores: Map<number, number>; postScores: Map<number, number> }
type FinalQuestionRow = { display_order: number | string }

const finalTemplatePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets/Final-template.xlsx')
const finalDataStartRow = 3
const finalTemplateDataEndRow = 88
const finalTemplateStatsRow = 90
const finalTemplateSummaryRow = 106
const finalOriginalLastColumn = 23
const finalLastColumn = 26
const finalCompetencyCount = 9
const finalPreStartColumn = 6
const finalPreAverageColumn = 15
const finalPostStartColumn = 17
const finalPostAverageColumn = 26

function safeText(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text
}

function timestamp(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? safeText(value) : date.toISOString()
}

function filePart(value: string) {
  return value.replace(/[^a-zA-Z0-9ก-๙_-]/g, '_').replace(/_+/g, '_').slice(0, 60) || 'activity'
}

export function activityReportFilename(activityName: string) {
  const forbiddenCharacters = new Set(['<', '>', ':', '"', '/', '\\', '|', '?', '*'])
  const safeName = Array.from(activityName.trim(), (character) => character.charCodeAt(0) < 32 || forbiddenCharacters.has(character) ? '_' : character).join('')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .slice(0, 100)
  return `${safeName || 'กิจกรรม'}.xlsx`
}

function round(value: number | null, decimals: number) {
  return value === null ? null : Number(value.toFixed(decimals))
}

function average(values: number[]) {
  if (!values.length) return null
  return values.reduce((total, value) => total + value, 0) / values.length
}

function sampleStdev(values: number[]) {
  if (values.length < 2) return null
  const mean = average(values)
  if (mean === null) return null
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1))
}

function interpretation(value: number | null) {
  if (value === null || Number.isNaN(value)) return '—'
  if (value <= 1.85) return '1. ตระหนักรู้'
  if (value <= 2.71) return '2. เริ่มลอง'
  if (value <= 3.57) return '3. พัฒนา'
  if (value <= 4.43) return '4. ชำนาญ'
  if (value <= 5.29) return '5. ก้าวหน้า'
  if (value <= 6.15) return '6. ผู้เชี่ยวชาญ'
  return '7. ผู้มีวิสัยทัศน์'
}

function columnLetter(column: number) {
  let value = column
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function normalizeSharedFormulas(sheet: ExcelJS.Worksheet) {
  sheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.formula) cell.value = { formula: cell.formula, result: cell.result }
    })
  })
}

function prepareFinalStudentColumns(sheet: ExcelJS.Worksheet) {
  if (sheet.getCell('C2').value === 'คณะ' && sheet.getCell('D2').value === 'สาขา' && sheet.getCell('E2').value === 'ชั้นปี') return
  sheet.unMergeCells('C1:K1')
  sheet.unMergeCells('N1:V1')
  const sourceWidths = Array.from({ length: finalOriginalLastColumn - 2 }, (_, index) => sheet.getColumn(index + 3).width)
  for (let rowNumber = 1; rowNumber <= finalTemplateStatsRow + 3; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    for (let column = finalOriginalLastColumn; column >= 3; column -= 1) {
      const source = row.getCell(column)
      const target = row.getCell(column + 3)
      target.value = source.value
      target.style = structuredClone(source.style)
    }
    for (let column = 3; column <= 5; column += 1) {
      const cell = row.getCell(column)
      cell.value = null
      cell.style = structuredClone(row.getCell(2).style)
    }
  }
  sourceWidths.forEach((width, index) => { sheet.getColumn(index + 6).width = width })
  sheet.getColumn(3).width = 20
  sheet.getColumn(4).width = 22
  sheet.getColumn(5).width = 11
  sheet.getCell('C2').value = 'คณะ'
  sheet.getCell('D2').value = 'สาขา'
  sheet.getCell('E2').value = 'ชั้นปี'
  sheet.mergeCells('F1:N1')
  sheet.mergeCells('Q1:Y1')
}

function setFormula(cell: ExcelJS.Cell, formula: string, result: number | string | null) {
  cell.value = { formula, result: result ?? undefined }
}

function clearValues(sheet: ExcelJS.Worksheet, startRow: number, endRow: number, startColumn = 1, endColumn = finalLastColumn) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) sheet.getCell(row, column).value = null
  }
}

function copyDataRowStyle(sheet: ExcelJS.Worksheet, rowNumber: number) {
  const sourceRow = sheet.getRow(finalDataStartRow)
  const targetRow = sheet.getRow(rowNumber)
  targetRow.height = sourceRow.height
  for (let column = 1; column <= finalLastColumn; column += 1) {
    targetRow.getCell(column).style = structuredClone(sourceRow.getCell(column).style)
  }
}

function summaryHeaderMerges(summaryRow: number) {
  return [
    `C${summaryRow}:C${summaryRow + 1}`,
    `D${summaryRow}:F${summaryRow}`,
    `G${summaryRow}:I${summaryRow}`,
    `J${summaryRow}:J${summaryRow + 1}`,
    `K${summaryRow}:K${summaryRow + 1}`,
  ]
}

function clearTrailingRows(sheet: ExcelJS.Worksheet, startRow: number) {
  const endRow = sheet.rowCount
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    for (let column = 1; column <= finalLastColumn; column += 1) {
      const cell = row.getCell(column)
      cell.value = null
      cell.style = {}
    }
  }
}

function finalStudents(rows: FinalAnswerRow[]) {
  const students = new Map<string, FinalSheetStudent>()
  for (const answer of rows) {
    const studentKey = String(answer.student_id)
    let student = students.get(studentKey)
    if (!student) {
      const name = [answer.first_name, answer.last_name].filter(Boolean).join(' ').trim() || answer.student_code
      student = { studentCode: answer.student_code, name, faculty: answer.faculty ?? '', major: answer.major ?? '', studyYear: answer.study_year, preScores: new Map(), postScores: new Map() }
      students.set(studentKey, student)
    }
    const score = Number(answer.score)
    if (Number.isFinite(score)) (answer.phase === 'pre' ? student.preScores : student.postScores).set(Number(answer.display_order), score)
  }
  return Array.from(students.values()).sort((left, right) => left.studentCode.localeCompare(right.studentCode, 'th'))
}

function formulaForAverage(column: string, startRow: number, endRow: number, rounded = false) {
  const averageFormula = `AVERAGE(${column}${startRow}:${column}${endRow})`
  return rounded ? `ROUND(${averageFormula},2)` : averageFormula
}

function formulaForStdev(column: string, startRow: number, endRow: number) {
  return `STDEV(${column}${startRow}:${column}${endRow})`
}

export function writeFinalTemplateSheet(sheet: ExcelJS.Worksheet, students: FinalSheetStudent[]) {
  prepareFinalStudentColumns(sheet)
  const templateCapacity = finalTemplateDataEndRow - finalDataStartRow + 1
  const rowDelta = students.length - templateCapacity
  if (rowDelta > 0) {
    sheet.spliceRows(finalTemplateStatsRow - 1, 0, ...Array.from({ length: rowDelta }, () => []))
  } else if (rowDelta < 0) {
    for (const range of summaryHeaderMerges(finalTemplateSummaryRow)) sheet.unMergeCells(range)
    const firstUnusedDataRow = finalDataStartRow + students.length
    sheet.spliceRows(firstUnusedDataRow, Math.abs(rowDelta))
    for (const range of summaryHeaderMerges(finalTemplateSummaryRow + rowDelta)) sheet.mergeCells(range)
  }

  const statsRow = finalTemplateStatsRow + rowDelta
  const summaryRow = finalTemplateSummaryRow + rowDelta
  const dataEndRow = students.length ? finalDataStartRow + students.length - 1 : finalDataStartRow - 1
  const dataAreaEndRow = statsRow - 2

  for (let row = finalTemplateStatsRow - 1; row <= dataAreaEndRow; row += 1) {
    copyDataRowStyle(sheet, row)
  }
  clearValues(sheet, finalDataStartRow, dataAreaEndRow)
  clearValues(sheet, statsRow - 1, statsRow + 3)
  clearValues(sheet, summaryRow + 2, summaryRow + 11, 4, 11)

  students.forEach((student, index) => {
    const row = sheet.getRow(finalDataStartRow + index)
    row.getCell(1).value = safeText(student.name)
    row.getCell(2).value = safeText(student.studentCode)
    row.getCell(3).value = safeText(student.faculty)
    row.getCell(4).value = safeText(student.major)
    const studyYear = Number(student.studyYear)
    row.getCell(5).value = Number.isFinite(studyYear) && studyYear > 0 ? studyYear : null
    for (let competency = 1; competency <= finalCompetencyCount; competency += 1) {
      row.getCell(finalPreStartColumn + competency - 1).value = student.preScores.get(competency) ?? null
      row.getCell(finalPostStartColumn + competency - 1).value = student.postScores.get(competency) ?? null
    }
  })

  const preColumns = Array.from({ length: finalCompetencyCount }, (_, index) => index + finalPreStartColumn)
  const postColumns = Array.from({ length: finalCompetencyCount }, (_, index) => index + finalPostStartColumn)
  const preStats = preColumns.map((column) => {
    const values = students.flatMap((student) => {
      const score = student.preScores.get(column - finalPreStartColumn + 1)
      return score === undefined ? [] : [score]
    })
    return { column, mean: average(values), stdev: sampleStdev(values) }
  })
  const postStats = postColumns.map((column) => {
    const values = students.flatMap((student) => {
      const score = student.postScores.get(column - finalPostStartColumn + 1)
      return score === undefined ? [] : [score]
    })
    return { column, mean: average(values), stdev: sampleStdev(values) }
  })
  const allPreScores = preStats.flatMap((stat) => students.flatMap((student) => {
    const score = student.preScores.get(stat.column - finalPreStartColumn + 1)
    return score === undefined ? [] : [score]
  }))
  const allPostScores = postStats.flatMap((stat) => students.flatMap((student) => {
    const score = student.postScores.get(stat.column - finalPostStartColumn + 1)
    return score === undefined ? [] : [score]
  }))

  sheet.getCell(statsRow, 2).value = 'Mean'
  sheet.getCell(statsRow + 1, 2).value = 'SD'
  sheet.getCell(statsRow + 2, 2).value = 'Round SD'
  sheet.getCell(statsRow + 3, 2).value = 'Interpretation'

  for (const stat of preStats) {
    const column = columnLetter(stat.column)
    if (stat.mean !== null) setFormula(sheet.getCell(statsRow, stat.column), formulaForAverage(column, finalDataStartRow, dataEndRow), stat.mean)
    if (stat.stdev !== null) {
      setFormula(sheet.getCell(statsRow + 1, stat.column), formulaForStdev(column, finalDataStartRow, dataEndRow), stat.stdev)
      setFormula(sheet.getCell(statsRow + 2, stat.column), `ROUND(${column}${statsRow + 1},3)`, round(stat.stdev, 3))
    }
    sheet.getCell(statsRow + 3, stat.column).value = interpretation(stat.mean)
  }
  for (const stat of postStats) {
    const column = columnLetter(stat.column)
    const roundedMean = round(stat.mean, 2)
    if (roundedMean !== null) setFormula(sheet.getCell(statsRow, stat.column), formulaForAverage(column, finalDataStartRow, dataEndRow, true), roundedMean)
    if (stat.stdev !== null) {
      setFormula(sheet.getCell(statsRow + 1, stat.column), formulaForStdev(column, finalDataStartRow, dataEndRow), stat.stdev)
      setFormula(sheet.getCell(statsRow + 2, stat.column), `ROUND(${column}${statsRow + 1},3)`, round(stat.stdev, 3))
    }
    sheet.getCell(statsRow + 3, stat.column).value = interpretation(roundedMean)
  }

  const overallPreMean = average(allPreScores)
  const overallPreStdev = sampleStdev(allPreScores)
  const overallPostMean = round(average(allPostScores), 2)
  const overallPostStdev = sampleStdev(allPostScores)
  const preStartLetter = columnLetter(finalPreStartColumn)
  const preEndLetter = columnLetter(finalPreStartColumn + finalCompetencyCount - 1)
  const preAverageLetter = columnLetter(finalPreAverageColumn)
  const postStartLetter = columnLetter(finalPostStartColumn)
  const postEndLetter = columnLetter(finalPostStartColumn + finalCompetencyCount - 1)
  const postAverageLetter = columnLetter(finalPostAverageColumn)
  if (overallPreMean !== null) setFormula(sheet.getCell(statsRow, finalPreAverageColumn), `AVERAGE(${preStartLetter}${statsRow}:${preEndLetter}${statsRow})`, overallPreMean)
  if (overallPreStdev !== null) {
    setFormula(sheet.getCell(statsRow + 1, finalPreAverageColumn), `STDEV(${preStartLetter}${finalDataStartRow}:${preEndLetter}${dataEndRow})`, overallPreStdev)
    setFormula(sheet.getCell(statsRow + 2, finalPreAverageColumn), `ROUND(${preAverageLetter}${statsRow + 1},3)`, round(overallPreStdev, 3))
  }
  sheet.getCell(statsRow + 3, finalPreAverageColumn).value = interpretation(overallPreMean)
  if (overallPostMean !== null) setFormula(sheet.getCell(statsRow, finalPostAverageColumn), `ROUND(AVERAGE(${postStartLetter}${statsRow}:${postEndLetter}${statsRow}),2)`, overallPostMean)
  if (overallPostStdev !== null) {
    setFormula(sheet.getCell(statsRow + 1, finalPostAverageColumn), `STDEV(${postStartLetter}${finalDataStartRow}:${postEndLetter}${dataEndRow})`, overallPostStdev)
    setFormula(sheet.getCell(statsRow + 2, finalPostAverageColumn), `ROUND(${postAverageLetter}${statsRow + 1},3)`, round(overallPostStdev, 3))
  }
  sheet.getCell(statsRow + 3, finalPostAverageColumn).value = interpretation(overallPostMean)

  const summaryRows = preStats.map((pre, index) => {
    const post = postStats[index]!
    const preMean = round(pre.mean, 2)
    const postMean = round(post.mean, 2)
    return { preMean, preStdev: round(pre.stdev, 3), postMean, postStdev: round(post.stdev, 3), difference: preMean === null || postMean === null ? null : postMean - preMean }
  })
  const ranked = summaryRows.filter((row) => row.difference !== null).map((row) => row.difference!).sort((left, right) => right - left)
  const denseRanks = new Map<number, number>()
  ranked.forEach((difference) => { if (!denseRanks.has(difference)) denseRanks.set(difference, denseRanks.size + 1) })
  summaryRows.forEach((summary, index) => {
    const row = summaryRow + 2 + index
    sheet.getCell(row, 4).value = summary.preMean
    sheet.getCell(row, 5).value = summary.preStdev
    sheet.getCell(row, 6).value = interpretation(summary.preMean)
    sheet.getCell(row, 7).value = summary.postMean
    sheet.getCell(row, 8).value = summary.postStdev
    sheet.getCell(row, 9).value = interpretation(summary.postMean)
    if (summary.difference !== null) setFormula(sheet.getCell(row, 10), `G${row}-D${row}`, summary.difference)
    sheet.getCell(row, 11).value = summary.difference === null ? null : denseRanks.get(summary.difference) ?? null
  })

  const averageRow = summaryRow + 11
  sheet.getCell(averageRow, 4).value = round(overallPreMean, 2)
  sheet.getCell(averageRow, 5).value = round(overallPreStdev, 3)
  sheet.getCell(averageRow, 6).value = interpretation(overallPreMean)
  sheet.getCell(averageRow, 7).value = overallPostMean
  sheet.getCell(averageRow, 8).value = round(overallPostStdev, 3)
  sheet.getCell(averageRow, 9).value = interpretation(overallPostMean)
  if (overallPreMean !== null && overallPostMean !== null) setFormula(sheet.getCell(averageRow, 10), `G${averageRow}-D${averageRow}`, overallPostMean - round(overallPreMean, 2)!)

  if (sheet.rowCount > averageRow) sheet.spliceRows(averageRow + 1, sheet.rowCount - averageRow)
  clearTrailingRows(sheet, averageRow + 1)
  sheet.pageSetup.printArea = `A1:${columnLetter(finalLastColumn)}${averageRow}`
}

async function loadFinalTemplate() {
  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.readFile(finalTemplatePath)
  } catch {
    throw new ApiError(500, 'ไม่พบหรือไม่สามารถอ่านไฟล์ template สำหรับรายงาน Final ได้ กรุณาติดต่อผู้ดูแลระบบ')
  }
  const finalSheet = workbook.getWorksheet('Final')
  if (!finalSheet) throw new ApiError(500, 'ไม่พบ worksheet ชื่อ Final ในไฟล์ template')
  normalizeSharedFormulas(finalSheet)
  for (const sheet of workbook.worksheets.filter((sheet) => sheet.id !== finalSheet.id)) workbook.removeWorksheet(sheet.id)
  if (workbook.worksheets.length !== 1 || workbook.worksheets[0]?.name !== 'Final') throw new ApiError(500, 'ไม่สามารถเตรียม worksheet Final สำหรับการส่งออกได้')
  workbook.calcProperties.fullCalcOnLoad = true
  return { workbook, finalSheet }
}

function responseFilter(filters: ReportFilters) {
  return {
    sql: 'WHERE sr.activity_id = ?',
    values: [filters.activityId] as Array<string | number>,
  }
}

async function activityFor(filters: ReportFilters) {
  const rows = await pool.query<ActivityRow[]>('SELECT id, code, name FROM activities WHERE id = ? LIMIT 1', [filters.activityId])
  if (!rows[0]) throw new ApiError(404, 'ไม่พบกิจกรรมที่เลือก')
  return rows[0]
}

function configureSheet(sheet: ExcelJS.Worksheet, title: string, filters: ReportFilters, activity: ActivityRow) {
  sheet.properties.defaultRowHeight = 20
  sheet.views = [{ state: 'frozen', ySplit: 4 }]
  sheet.mergeCells('A1:H1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = title
  titleCell.font = { bold: true, size: 16, color: { argb: 'FF203D63' } }
  sheet.getCell('A2').value = 'กิจกรรม'
  sheet.getCell('B2').value = `${safeText(activity.code ?? 'ไม่ระบุรหัส')} — ${safeText(activity.name)}`
  sheet.getCell('A3').value = 'ข้อมูล'
  sheet.getCell('B3').value = 'คำตอบทั้งหมดของกิจกรรม'
}

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF385F8D' } }
  row.alignment = { vertical: 'middle', wrapText: true }
}

export async function createRawExport(filters: ReportFilters) {
  const [activity, rows] = await Promise.all([
    activityFor(filters),
    pool.query<RawAnswerRow[]>(`SELECT s.student_code, s.first_name, s.last_name, s.email, s.faculty, s.major, s.study_year, s.education_level, s.phone,
        a.code AS activity_code, a.name AS activity_name, sr.phase, sr.submitted_at,
        c.code AS competency_code, c.name AS competency_name, ra.score
      FROM survey_responses sr
      JOIN students s ON s.id = sr.student_id
      JOIN activities a ON a.id = sr.activity_id
      JOIN response_answers ra ON ra.response_id = sr.id
      JOIN competencies c ON c.id = ra.competency_id
      ${responseFilter(filters).sql}
      ORDER BY sr.submitted_at ASC, s.student_code ASC, c.display_order ASC`, responseFilter(filters).values),
  ])
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SEDA Activity Evaluation System'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Raw Data')
  configureSheet(sheet, 'SEDA Raw Assessment Data', filters, activity)
  const header = sheet.addRow(['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'สำนักวิชา', 'สาขาวิชา', 'ชั้นปี', 'ระดับการศึกษา', 'เบอร์โทร', 'รหัสกิจกรรม', 'กิจกรรม', 'Phase', 'เวลาที่ส่ง', 'รหัสสมรรถนะ', 'สมรรถนะ', 'ระดับคำตอบ'])
  styleHeader(header)
  rows.forEach((row) => sheet.addRow([safeText(row.student_code), safeText(row.first_name), safeText(row.last_name), safeText(row.email), safeText(row.faculty), safeText(row.major), safeText(row.study_year), safeText(row.education_level), safeText(row.phone), safeText(row.activity_code), safeText(row.activity_name), row.phase.toUpperCase(), timestamp(row.submitted_at), safeText(row.competency_code), safeText(row.competency_name), Number(row.score)]))
  sheet.columns = [16, 18, 18, 28, 20, 20, 12, 18, 18, 16, 28, 10, 26, 20, 28, 12].map((width) => ({ width }))
  const filename = `SEDA_raw_${filePart(activity.code ?? activity.name)}.xlsx`
  return { activity, filename, buffer: Buffer.from(await workbook.xlsx.writeBuffer()), rowCount: rows.length }
}

export async function createFinalExport(filters: ReportFilters) {
  const filter = responseFilter(filters)
  const [activity, questions, answers] = await Promise.all([
    activityFor(filters),
    pool.query<FinalQuestionRow[]>(`
      SELECT q.display_order
      FROM activities a
      JOIN questions q ON q.template_id = a.survey_template_id
      WHERE a.id = ? AND q.is_required = TRUE
      ORDER BY q.display_order ASC`, [filters.activityId]),
    pool.query<FinalAnswerRow[]>(`
      SELECT s.id AS student_id, s.student_code, s.first_name, s.last_name, s.faculty, s.major, s.study_year, sr.phase,
        c.display_order, ra.score
      FROM survey_responses sr
      JOIN students s ON s.id = sr.student_id
      JOIN response_answers ra ON ra.response_id = sr.id
      JOIN competencies c ON c.id = ra.competency_id
      ${filter.sql}
        AND EXISTS (
          SELECT 1 FROM survey_responses paired_response
          WHERE paired_response.activity_id = sr.activity_id
            AND paired_response.student_id = sr.student_id
          GROUP BY paired_response.activity_id, paired_response.student_id
          HAVING SUM(paired_response.phase = 'pre') > 0 AND SUM(paired_response.phase = 'post') > 0
        )
      ORDER BY s.student_code ASC, c.display_order ASC, sr.submitted_at ASC`, filter.values),
  ])
  const questionOrders = questions.map((question) => Number(question.display_order))
  if (questionOrders.length !== finalCompetencyCount || questionOrders.some((order, index) => order !== index + 1)) {
    throw new ApiError(422, 'รายงาน Final รองรับแบบประเมิน IMPACTS3 ที่มีสมรรถนะ 9 ด้านเท่านั้น')
  }
  const { workbook, finalSheet } = await loadFinalTemplate()
  const students = finalStudents(answers)
  writeFinalTemplateSheet(finalSheet, students)
  return { activity, filename: activityReportFilename(activity.name), buffer: Buffer.from(await workbook.xlsx.writeBuffer()), rowCount: students.length }
}

// Keep the old endpoint safe for existing bookmarks: it now produces the same Final-only workbook.
export async function createSummaryExport(filters: ReportFilters) {
  return createFinalExport(filters)
}
