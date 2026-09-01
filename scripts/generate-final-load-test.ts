import fs from 'node:fs/promises'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { writeFinalTemplateSheet } from '../server/src/services/exportService.js'

const studentCount = 100
const outputDirectory = path.resolve('outputs/final-load-test')
const outputPath = path.join(outputDirectory, 'Final.xlsx')
const templatePath = path.resolve('server/assets/Final-template.xlsx')

async function main() {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.readFile(templatePath)
  const finalSheet = workbook.getWorksheet('Final')
  if (!finalSheet) throw new Error('ไม่พบ worksheet ชื่อ Final ในไฟล์ template')
  for (const sheet of workbook.worksheets.filter((sheet) => sheet.id !== finalSheet.id)) workbook.removeWorksheet(sheet.id)

  const students = Array.from({ length: studentCount }, (_, index) => ({
    studentCode: `S${String(index + 1).padStart(3, '0')}`,
    name: `Student ${index + 1}`,
    faculty: `Faculty ${(index % 3) + 1}`,
    major: `Major ${(index % 5) + 1}`,
    studyYear: (index % 10) + 1,
    preScores: new Map(Array.from({ length: 9 }, (_, competency) => [competency + 1, (competency % 7) + 1])),
    postScores: new Map(Array.from({ length: 9 }, (_, competency) => [competency + 1, ((competency + 1) % 7) + 1])),
  }))

  writeFinalTemplateSheet(finalSheet, students)
  await fs.mkdir(outputDirectory, { recursive: true })
  await fs.writeFile(outputPath, Buffer.from(await workbook.xlsx.writeBuffer()))

  const verifiedWorkbook = new ExcelJS.Workbook()
  await verifiedWorkbook.xlsx.readFile(outputPath)
  const verifiedSheet = verifiedWorkbook.getWorksheet('Final')
  if (!verifiedSheet) throw new Error('ไฟล์ที่สร้างไม่มี worksheet Final')

  const checks = {
    worksheets: verifiedWorkbook.worksheets.map((sheet) => sheet.name),
    firstStudentCode: verifiedSheet.getCell('B3').value,
    firstFaculty: verifiedSheet.getCell('C3').value,
    firstMajor: verifiedSheet.getCell('D3').value,
    firstStudyYear: verifiedSheet.getCell('E3').value,
    lastStudentCode: verifiedSheet.getCell('B102').value,
    statsLabel: verifiedSheet.getCell('B104').value,
    meanFormula: verifiedSheet.getCell('F104').formula,
  }
  const passed = checks.worksheets.length === 1
    && checks.worksheets[0] === 'Final'
    && checks.firstStudentCode === 'S001'
    && checks.firstFaculty === 'Faculty 1'
    && checks.firstMajor === 'Major 1'
    && checks.firstStudyYear === 1
    && checks.lastStudentCode === 'S100'
    && checks.statsLabel === 'Mean'
    && checks.meanFormula === 'AVERAGE(F3:F102)'
  if (!passed) throw new Error(`ผลการตรวจสอบไม่ผ่าน: ${JSON.stringify(checks)}`)

  console.log(JSON.stringify({ outputPath, studentCount, ...checks }))
}

void main()
