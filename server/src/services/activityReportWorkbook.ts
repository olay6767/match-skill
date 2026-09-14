import ExcelJS from 'exceljs'

export type ActivityReportWorkbookInput = {
  activity: {
    id: number
    code: string | null
    name: string
    date: Date | string | null
    participantLimit: number
  }
  competencies: Array<{ code: string; name: string; displayOrder: number }>
  students: Array<{
    studentCode: string
    name: string
    faculty: string
    program: string
    studyYear: number | string | null
    preCompleted: boolean
    postCompleted: boolean
    preScores: Map<number, number>
    postScores: Map<number, number>
  }>
}

type ReportStudent = ActivityReportWorkbookInput['students'][number]

const colors = {
  ink: 'FF3F4B5B',
  copy: 'FF657184',
  muted: 'FF8792A1',
  orange: 'FFEF6C18',
  orangeDark: 'FFB95414',
  orangeSoft: 'FFFFF1E6',
  header: 'FF465365',
  stripe: 'FFFAF9F7',
  line: 'FFEAE6E2',
  green: 'FF23835A',
  red: 'FFC34D43',
  white: 'FFFFFFFF',
}

const scoringGuide = [
  { level: 1, range: '1.00–1.85', interpretation: 'ตระหนักรู้' },
  { level: 2, range: '1.86–2.71', interpretation: 'เริ่มลอง' },
  { level: 3, range: '2.72–3.57', interpretation: 'พัฒนา' },
  { level: 4, range: '3.58–4.43', interpretation: 'ชำนาญ' },
  { level: 5, range: '4.44–5.29', interpretation: 'ก้าวหน้า' },
  { level: 6, range: '5.30–6.15', interpretation: 'ผู้เชี่ยวชาญ' },
  { level: 7, range: '6.16–7.00', interpretation: 'ผู้มีวิสัยทัศน์' },
]

function safeText(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text
}

function round(value: number | null, decimals = 2) {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(decimals))
}

function average(values: number[]) {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null
}

function scoreAverage(scores: Map<number, number>) {
  return average(Array.from(scores.values()))
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

function activityDate(value: Date | string | null) {
  if (!value) return 'ไม่ระบุวันที่'
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).slice(0, 10)
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

function prepareSheet(sheet: ExcelJS.Worksheet, title: string, input: ActivityReportWorkbookInput, lastColumn: number, xSplit = 0) {
  sheet.properties.defaultRowHeight = 21
  sheet.mergeCells(1, 1, 1, lastColumn)
  sheet.mergeCells(2, 1, 2, lastColumn)
  const titleCell = sheet.getCell(1, 1)
  titleCell.value = title
  titleCell.font = { bold: true, size: 17, color: { argb: colors.white } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.header } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 34

  const subtitleCell = sheet.getCell(2, 1)
  subtitleCell.value = `${safeText(input.activity.code ?? `Activity ${input.activity.id}`)} · ${safeText(input.activity.name)} · ${activityDate(input.activity.date)}`
  subtitleCell.font = { bold: true, size: 10, color: { argb: colors.orangeDark } }
  subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.orangeSoft } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(2).height = 25
  sheet.getRow(3).height = 8
  sheet.views = [{ state: 'frozen', xSplit, ySplit: 4, activeCell: `${columnLetter(xSplit + 1)}5` }]
  sheet.pageSetup.orientation = lastColumn > 8 ? 'landscape' : 'portrait'
  sheet.pageSetup.fitToPage = true
  sheet.pageSetup.fitToWidth = 1
  sheet.pageSetup.fitToHeight = 0
}

function styleHeader(sheet: ExcelJS.Worksheet, rowNumber: number, headers: string[]) {
  const row = sheet.getRow(rowNumber)
  headers.forEach((header, index) => { row.getCell(index + 1).value = header })
  row.height = headers.some((header) => header.length > 28) ? 48 : 34
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = { bold: true, size: 10, color: { argb: colors.white } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.orange } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      right: { style: 'thin', color: { argb: 'FFFFB47D' } },
      bottom: { style: 'thin', color: { argb: 'FFD85D0D' } },
    }
  })
}

function styleDataRows(sheet: ExcelJS.Worksheet, firstRow: number, lastRow: number, lastColumn: number) {
  for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber += 1) {
    const row = sheet.getRow(rowNumber)
    row.height = 23
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column)
      cell.font = { size: 10, color: { argb: colors.copy } }
      cell.alignment = { vertical: 'middle', wrapText: column <= 5 }
      cell.border = { bottom: { style: 'thin', color: { argb: colors.line } } }
      if (rowNumber % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.stripe } }
    }
  }
}

function finishTable(sheet: ExcelJS.Worksheet, headerRow: number, lastRow: number, widths: number[]) {
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width })
  sheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: headerRow, column: widths.length },
  }
  if (lastRow >= headerRow + 1) styleDataRows(sheet, headerRow + 1, lastRow, widths.length)
}

function styleDifference(sheet: ExcelJS.Worksheet, row: number, column: number, value: number | null) {
  if (value === null) return
  const cell = sheet.getCell(row, column)
  cell.font = { bold: true, size: 10, color: { argb: value > 0 ? colors.green : value < 0 ? colors.red : colors.copy } }
  cell.numFmt = '0.00'
}

function buildImpacts(input: ActivityReportWorkbookInput) {
  const impacts = input.competencies.map((competency) => {
    const pairs = input.students.flatMap((student) => {
      const pre = student.preScores.get(competency.displayOrder)
      const post = student.postScores.get(competency.displayOrder)
      return pre === undefined || post === undefined ? [] : [{ pre, post }]
    })
    const preAverage = round(average(pairs.map((pair) => pair.pre)))
    const postAverage = round(average(pairs.map((pair) => pair.post)))
    const difference = preAverage === null || postAverage === null ? null : round(postAverage - preAverage)
    return {
      ...competency,
      n: pairs.length,
      preAverage,
      postAverage,
      difference,
      preLevel: interpretation(preAverage),
      postLevel: interpretation(postAverage),
      improved: pairs.filter((pair) => pair.post > pair.pre).length,
      same: pairs.filter((pair) => pair.post === pair.pre).length,
      decreased: pairs.filter((pair) => pair.post < pair.pre).length,
      rank: null as number | null,
    }
  })
  const rankedDifferences = [...new Set(impacts.flatMap((impact) => impact.difference === null ? [] : [impact.difference]))].sort((left, right) => right - left)
  impacts.forEach((impact) => { impact.rank = impact.difference === null ? null : rankedDifferences.indexOf(impact.difference) + 1 })
  return impacts
}

function addExecutiveSummary(workbook: ExcelJS.Workbook, input: ActivityReportWorkbookInput, impacts: ReturnType<typeof buildImpacts>) {
  const sheet = workbook.addWorksheet('Executive Summary', { properties: { tabColor: { argb: colors.orange } } })
  prepareSheet(sheet, 'Executive Summary', input, 3)
  const paired = input.students.filter((student) => student.preCompleted && student.postCompleted)
  const preAverages = paired.flatMap((student) => { const value = scoreAverage(student.preScores); return value === null ? [] : [value] })
  const postAverages = paired.flatMap((student) => { const value = scoreAverage(student.postScores); return value === null ? [] : [value] })
  const preAverage = round(average(preAverages))
  const postAverage = round(average(postAverages))
  const improvement = preAverage === null || postAverage === null ? null : round(postAverage - preAverage)
  const comparable = impacts.filter((impact) => impact.difference !== null)
  const topGrowth = comparable.reduce<(typeof comparable)[number] | null>((best, item) => !best || item.difference! > best.difference! ? item : best, null)
  const lowest = comparable.reduce<(typeof comparable)[number] | null>((worst, item) => !worst || item.difference! < worst.difference! ? item : worst, null)
  const registered = input.students.length
  const preCount = input.students.filter((student) => student.preCompleted).length
  const postCount = input.students.filter((student) => student.postCompleted).length
  const rows: Array<[string, string | number | null, string]> = [
    ['Activity ID', input.activity.id, input.activity.code ?? '—'],
    ['Activity Name', safeText(input.activity.name), ''],
    ['Activity Date', activityDate(input.activity.date), ''],
    ['Registered / Attended', registered, 'ผู้ที่เริ่มแบบประเมินหรือส่งคำตอบ'],
    ['PRE Completed', preCount, 'ผู้ส่ง PRE สำเร็จ'],
    ['POST Completed', postCount, 'ผู้ส่ง POST สำเร็จ'],
    ['Completed Both', paired.length, 'ผู้ที่ใช้คำนวณผลเปรียบเทียบ'],
    ['Completion Rate', registered ? paired.length / registered : null, 'Completed Both ÷ Registered / Attended'],
    ['PRE Average', preAverage, 'เฉพาะผู้ทำครบทั้ง PRE และ POST (Likert 1–7)'],
    ['POST Average', postAverage, 'เฉพาะผู้ทำครบทั้ง PRE และ POST (Likert 1–7)'],
    ['Improvement', improvement, 'POST Average − PRE Average'],
    ['Top Growth Competency', topGrowth ? `${safeText(topGrowth.name)} (${topGrowth.difference! >= 0 ? '+' : ''}${topGrowth.difference!.toFixed(2)})` : '—', ''],
    ['Lowest / Declined Competency', lowest ? `${safeText(lowest.name)} (${lowest.difference! >= 0 ? '+' : ''}${lowest.difference!.toFixed(2)})` : '—', ''],
  ]
  styleHeader(sheet, 4, ['Metric', 'Value', 'Definition / Note'])
  rows.forEach((values) => sheet.addRow(values))
  finishTable(sheet, 4, 4 + rows.length, [31, 48, 48])
  sheet.getColumn(2).alignment = { vertical: 'middle', wrapText: true }
  sheet.getCell(12, 2).numFmt = '0.0%'
  ;[13, 14, 15].forEach((row) => { sheet.getCell(row, 2).numFmt = '0.00' })
  styleDifference(sheet, 15, 2, improvement)
}

function addCompetencyImpact(workbook: ExcelJS.Workbook, input: ActivityReportWorkbookInput, impacts: ReturnType<typeof buildImpacts>) {
  const sheet = workbook.addWorksheet('Competency Impact', { properties: { tabColor: { argb: colors.orangeDark } } })
  prepareSheet(sheet, 'Competency Impact', input, 11)
  styleHeader(sheet, 4, ['Competency', 'N', 'PRE Avg', 'POST Avg', 'Difference', 'PRE Level', 'POST Level', 'Rank', 'Improved', 'Same', 'Decreased'])
  impacts.forEach((impact) => sheet.addRow([
    `${impact.displayOrder}. ${safeText(impact.name)}`, impact.n, impact.preAverage, impact.postAverage, impact.difference,
    impact.preLevel, impact.postLevel, impact.rank, impact.improved, impact.same, impact.decreased,
  ]))
  finishTable(sheet, 4, 4 + impacts.length, [42, 9, 12, 12, 13, 23, 23, 9, 12, 10, 12])
  for (let row = 5; row <= 4 + impacts.length; row += 1) {
    ;[3, 4, 5].forEach((column) => { sheet.getCell(row, column).numFmt = '0.00' })
    styleDifference(sheet, row, 5, impacts[row - 5]?.difference ?? null)
  }
}

function addParticipantDetail(workbook: ExcelJS.Workbook, input: ActivityReportWorkbookInput) {
  const headers = ['Student ID', 'Name', 'Faculty', 'Program', 'Year']
  input.competencies.forEach((competency) => {
    const label = `${competency.displayOrder}. ${competency.name}`
    headers.push(`PRE · ${label}`, `POST · ${label}`, `Difference · ${label}`)
  })
  headers.push('PRE Average', 'POST Average', 'Overall Difference', 'PRE Status', 'POST Status')
  const sheet = workbook.addWorksheet('Participant Detail', { properties: { tabColor: { argb: colors.header } } })
  prepareSheet(sheet, 'Participant Detail', input, headers.length, 5)
  styleHeader(sheet, 4, headers)
  input.students.forEach((student) => {
    const row: Array<string | number | null> = [safeText(student.studentCode), safeText(student.name), safeText(student.faculty || 'ไม่ระบุ'), safeText(student.program || 'ไม่ระบุ'), student.studyYear === null ? '' : safeText(student.studyYear)]
    input.competencies.forEach((competency) => {
      const pre = student.preScores.get(competency.displayOrder) ?? null
      const post = student.postScores.get(competency.displayOrder) ?? null
      row.push(pre, post, pre === null || post === null ? null : post - pre)
    })
    const preAverage = round(scoreAverage(student.preScores))
    const postAverage = round(scoreAverage(student.postScores))
    row.push(preAverage, postAverage, preAverage === null || postAverage === null ? null : round(postAverage - preAverage), student.preCompleted ? 'Completed' : 'Not completed', student.postCompleted ? 'Completed' : 'Not completed')
    sheet.addRow(row)
  })
  const competencyWidths = input.competencies.flatMap(() => [15, 15, 17])
  finishTable(sheet, 4, 4 + input.students.length, [16, 25, 22, 22, 10, ...competencyWidths, 14, 14, 18, 17, 17])
  const overallStart = 6 + input.competencies.length * 3
  for (let row = 5; row <= 4 + input.students.length; row += 1) {
    input.competencies.forEach((_competency, index) => {
      const differenceColumn = 8 + index * 3
      const value = sheet.getCell(row, differenceColumn).value
      styleDifference(sheet, row, differenceColumn, typeof value === 'number' ? value : null)
    })
    ;[overallStart, overallStart + 1, overallStart + 2].forEach((column) => { sheet.getCell(row, column).numFmt = '0.00' })
    const overallValue = sheet.getCell(row, overallStart + 2).value
    styleDifference(sheet, row, overallStart + 2, typeof overallValue === 'number' ? overallValue : null)
  }
}

function addSegmentAnalysis(workbook: ExcelJS.Workbook, input: ActivityReportWorkbookInput) {
  const sheet = workbook.addWorksheet('Segment Analysis', { properties: { tabColor: { argb: colors.orange } } })
  prepareSheet(sheet, 'Segment Analysis', input, 6)
  styleHeader(sheet, 4, ['Segment Type', 'Segment', 'N', 'PRE Avg', 'POST Avg', 'Change'])
  const paired = input.students.filter((student) => student.preCompleted && student.postCompleted)
  const dimensions: Array<{ type: string; value: (student: ReportStudent) => string }> = [
    { type: 'Faculty', value: (student) => student.faculty || 'ไม่ระบุ' },
    { type: 'Program', value: (student) => student.program || 'ไม่ระบุ' },
    { type: 'Year', value: (student) => student.studyYear === null || student.studyYear === '' ? 'ไม่ระบุ' : String(student.studyYear) },
  ]
  const rows: Array<[string, string, number, number | null, number | null, number | null]> = []
  dimensions.forEach((dimension) => {
    const groups = new Map<string, ReportStudent[]>()
    paired.forEach((student) => { const label = dimension.value(student); groups.set(label, [...(groups.get(label) ?? []), student]) })
    Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right, 'th')).forEach(([label, students]) => {
      const preAverage = round(average(students.flatMap((student) => { const value = scoreAverage(student.preScores); return value === null ? [] : [value] })))
      const postAverage = round(average(students.flatMap((student) => { const value = scoreAverage(student.postScores); return value === null ? [] : [value] })))
      rows.push([dimension.type, safeText(label), students.length, preAverage, postAverage, preAverage === null || postAverage === null ? null : round(postAverage - preAverage)])
    })
  })
  rows.forEach((row) => sheet.addRow(row))
  finishTable(sheet, 4, 4 + rows.length, [18, 34, 10, 13, 13, 13])
  for (let row = 5; row <= 4 + rows.length; row += 1) {
    ;[4, 5, 6].forEach((column) => { sheet.getCell(row, column).numFmt = '0.00' })
    styleDifference(sheet, row, 6, rows[row - 5]?.[5] ?? null)
  }
}

function addScoringGuide(workbook: ExcelJS.Workbook, input: ActivityReportWorkbookInput) {
  const sheet = workbook.addWorksheet('Scoring Guide', { properties: { tabColor: { argb: colors.header } } })
  prepareSheet(sheet, 'Scoring Guide', input, 3)
  styleHeader(sheet, 4, ['Likert Scale', 'Mean Range', 'Interpretation'])
  scoringGuide.forEach((item) => sheet.addRow([item.level, item.range, item.interpretation]))
  finishTable(sheet, 4, 4 + scoringGuide.length, [18, 22, 36])
  sheet.getCell(13, 1).value = 'หมายเหตุ'
  sheet.getCell(13, 1).font = { bold: true, color: { argb: colors.orangeDark } }
  sheet.mergeCells('B13:C13')
  sheet.getCell(13, 2).value = 'ค่าเฉลี่ยและการแปลผลแสดงในชีตสรุปเท่านั้น ไม่ปะปนกับแถวข้อมูลรายบุคคล'
  sheet.getCell(13, 2).font = { italic: true, color: { argb: colors.muted } }
}

export function buildActivityReportWorkbook(input: ActivityReportWorkbookInput) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SEDA Activity Evaluation System'
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.calcProperties.fullCalcOnLoad = true
  const impacts = buildImpacts(input)
  addExecutiveSummary(workbook, input, impacts)
  addCompetencyImpact(workbook, input, impacts)
  addParticipantDetail(workbook, input)
  addSegmentAnalysis(workbook, input)
  addScoringGuide(workbook, input)
  return workbook
}
