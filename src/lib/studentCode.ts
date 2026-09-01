const thaiDigits = '๐๑๒๓๔๕๖๗๘๙'

export function normalizeStudentCode(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[๐-๙]/g, (digit) => String(thaiDigits.indexOf(digit)))
    .replace(/[\s\u200B-\u200D\uFEFF-]/g, '')
    .toUpperCase()
}

export function isValidStudentCode(value: string) {
  return /^[BMD]\d{7}$/.test(normalizeStudentCode(value))
}
