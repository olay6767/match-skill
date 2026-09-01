const educationLevelByPrefix = {
  B: 'ปริญญาตรี',
  M: 'ปริญญาโท',
  D: 'ปริญญาเอก',
} as const

const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'

export function normalizeStudentCode(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/[\s\u200B-\u200D\uFEFF-]/g, '')
    .toUpperCase()
}

export function educationLevelFromStudentCode(studentCode: string) {
  const prefix = normalizeStudentCode(studentCode).charAt(0) as keyof typeof educationLevelByPrefix
  return educationLevelByPrefix[prefix] ?? null
}
