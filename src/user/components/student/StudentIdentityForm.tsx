import { useState, type FormEvent } from 'react'
import { trackUserEvent } from '../../usage/tracker'
import type { IdentifyPublicSurveyInput, IdentifyPublicSurveyResult, SurveySessionStartResult } from '../../../lib/api'
import { isValidStudentCode, normalizeStudentCode } from '../../../lib/studentCode'
import { OTHER_MAJOR_VALUE, SUT_ACADEMIC_OPTIONS } from '../../../data/sutAcademicOptions'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'

type IdentityValues = {
  firstName: string
  lastName: string
  studentCode: string
  faculty: string
  major: string
  studyYear: string
  email: string
  phone: string
  pdpaConsented: boolean
}
type FormErrors = Partial<Record<keyof IdentityValues, string>>

type StudentIdentityFormProps = {
  onSubmit: (values: IdentifyPublicSurveyInput) => Promise<IdentifyPublicSurveyResult>
  onVerified: (result: SurveySessionStartResult) => void
  onRegistrationChange?: (isRegistering: boolean) => void
}

const initialValues: IdentityValues = {
  firstName: '', lastName: '', studentCode: '', faculty: '', major: '', studyYear: '', email: '', phone: '', pdpaConsented: false,
}

function availableStudyYears(studentCode: string) {
  const validPrefixes = new Set(['B', 'M', 'D'])
  return validPrefixes.has(studentCode.trim().toUpperCase().charAt(0))
    ? Array.from({ length: 10 }, (_, index) => index + 1)
    : []
}

function validate(values: IdentityValues, isRegistering: boolean): FormErrors {
  const errors: FormErrors = {}
  if (!isValidStudentCode(values.studentCode)) errors.studentCode = 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'
  if (!isRegistering) return errors
  if (!values.firstName.trim()) errors.firstName = 'กรุณากรอกชื่อ'
  if (!values.lastName.trim()) errors.lastName = 'กรุณากรอกนามสกุล'
  if (!values.faculty.trim()) errors.faculty = 'กรุณากรอกสำนักวิชา'
  if (!values.major.trim()) errors.major = 'กรุณากรอกสาขาวิชา'
  const studyYears = availableStudyYears(values.studentCode)
  if (!studyYears.includes(Number(values.studyYear))) errors.studyYear = studyYears.length ? `กรุณาเลือกชั้นปี ${studyYears[0]}–${studyYears.at(-1)}` : 'กรุณาเลือกรหัสนักศึกษาที่ถูกต้องก่อน'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'กรุณากรอกอีเมลที่ถูกต้อง'
  if (values.phone.trim().length < 8) errors.phone = 'กรุณากรอกเบอร์โทรให้ครบถ้วน'
  if (!values.pdpaConsented) errors.pdpaConsented = 'กรุณายอมรับข้อตกลงคุ้มครองข้อมูลส่วนบุคคล'
  return errors
}

function StudentIdentityForm({ onSubmit, onVerified, onRegistrationChange }: StudentIdentityFormProps) {
  const [values, setValues] = useState(initialValues)
  const [isRegistering, setIsRegistering] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isOtherMajor, setIsOtherMajor] = useState(false)
  const selectedFaculty = SUT_ACADEMIC_OPTIONS.find((option) => option.faculty === values.faculty)
  const majorOptions = selectedFaculty?.majors ?? []
  const studyYearOptions = availableStudyYears(values.studentCode)

  const update = <K extends keyof IdentityValues>(field: K, value: IdentityValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }
  const selectFaculty = (faculty: string) => {
    update('faculty', faculty)
    update('major', '')
    setIsOtherMajor(false)
  }
  const selectStudentCode = (studentCode: string) => {
    const normalized = normalizeStudentCode(studentCode)
    const validYears = availableStudyYears(normalized)
    setValues((current) => ({
      ...current,
      studentCode: normalized,
      studyYear: validYears.includes(Number(current.studyYear)) ? current.studyYear : '',
    }))
    setErrors((current) => ({ ...current, studentCode: undefined, studyYear: undefined }))
  }
  const selectMajor = (major: string) => {
    if (major === OTHER_MAJOR_VALUE) {
      setIsOtherMajor(true)
      update('major', '')
      return
    }
    setIsOtherMajor(false)
    update('major', major)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = { ...values, studentCode: normalizeStudentCode(values.studentCode), email: values.email.trim().toLowerCase(), phone: values.phone.trim() }
    const nextErrors = validate(normalized, isRegistering)
    setErrors(nextErrors)
    setSubmitError('')
    if (Object.keys(nextErrors).length > 0) {
      trackUserEvent('interaction', 'form_validation_error:survey_identity')
      return
    }

    const input: IdentifyPublicSurveyInput = isRegistering
      ? { studentCode: normalized.studentCode, firstName: normalized.firstName.trim(), lastName: normalized.lastName.trim(), faculty: normalized.faculty.trim(), major: normalized.major.trim(), studyYear: Number(normalized.studyYear), email: normalized.email, phone: normalized.phone, pdpaConsented: normalized.pdpaConsented }
      : { studentCode: normalized.studentCode }

    setIsSubmitting(true)
    try {
      const result = await onSubmit(input)
      if (result.next === 'registration') {
        trackUserEvent('interaction', 'form_stage:survey_registration')
        setValues(normalized)
        setIsRegistering(true)
        onRegistrationChange?.(true)
        return
      }
      trackUserEvent('interaction', 'form_success:survey_identity')
      onRegistrationChange?.(false)
      onVerified(result)
    } catch (error) {
      trackUserEvent('interaction', 'form_error:survey_identity')
      setSubmitError(error instanceof Error ? error.message : 'ไม่สามารถยืนยันข้อมูลได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="student-identity-form" data-usage-form="survey_identity" noValidate onSubmit={handleSubmit}>
      {submitError && <p className="student-form-alert" role="alert">{submitError}</p>}
      {isRegistering && <p className="student-registration-note">ยังไม่พบข้อมูลนักศึกษา กรุณากรอกข้อมูลครั้งแรกให้ครบถ้วน ระบบจะบันทึกไว้สำหรับการสแกนครั้งต่อไป</p>}
      {isRegistering && <div className="student-form-grid"><StudentField id="student-first-name" label="ชื่อ" value={values.firstName} error={errors.firstName} placeholder="ชื่อจริง" autoComplete="given-name" onChange={(value) => update('firstName', value)} /><StudentField id="student-last-name" label="นามสกุล" value={values.lastName} error={errors.lastName} placeholder="นามสกุล" autoComplete="family-name" onChange={(value) => update('lastName', value)} /></div>}
      <StudentField id="student-code" label="รหัสนักศึกษา" value={values.studentCode} error={errors.studentCode} placeholder="เช่น B6728070" autoComplete="username" onChange={selectStudentCode} />
      {isRegistering && <>
        <StudentSelectField id="student-faculty" label="สำนักวิชา" value={values.faculty} error={errors.faculty} placeholder="เลือกสำนักวิชา" options={SUT_ACADEMIC_OPTIONS.map((option) => ({ value: option.faculty, label: option.faculty }))} onChange={selectFaculty} />
        <StudentSelectField id="student-major" label="สาขา / หลักสูตร" value={isOtherMajor ? OTHER_MAJOR_VALUE : values.major} error={errors.major} placeholder={values.faculty ? 'เลือกสาขา / หลักสูตร' : 'เลือกสำนักวิชาก่อน'} disabled={!values.faculty} options={[...majorOptions.map((major) => ({ value: major, label: major })), { value: OTHER_MAJOR_VALUE, label: 'อื่น ๆ / ไม่พบในรายการ' }]} onChange={selectMajor} />
        {isOtherMajor && <StudentField id="student-major-other" label="ระบุสาขา / หลักสูตร" value={values.major} error={errors.major} placeholder="พิมพ์ชื่อสาขาหรือหลักสูตร" autoComplete="organization-title" onChange={(value) => update('major', value)} />}
        <StudentSelectField id="student-year" label="ชั้นปี" value={values.studyYear} error={errors.studyYear} placeholder={studyYearOptions.length ? 'เลือกชั้นปี' : 'กรอกรหัสนักศึกษาก่อน'} disabled={!studyYearOptions.length} options={studyYearOptions.map((year) => ({ value: String(year), label: 'ชั้นปี ' + year }))} onChange={(value) => update('studyYear', value)} />
        <StudentField id="student-email" label="อีเมล" type="email" value={values.email} error={errors.email} placeholder="name@example.com" autoComplete="email" inputMode="email" onChange={(value) => update('email', value)} />
        <StudentField id="student-phone" label="เบอร์โทร" type="tel" value={values.phone} error={errors.phone} placeholder="08x-xxx-xxxx" autoComplete="tel" inputMode="tel" onChange={(value) => update('phone', value)} />
        <div className="student-consent-field"><label className="student-consent-label" htmlFor="student-pdpa-consent"><input id="student-pdpa-consent" type="checkbox" checked={values.pdpaConsented} onChange={(event) => update('pdpaConsented', event.target.checked)} aria-invalid={Boolean(errors.pdpaConsented)} aria-describedby={errors.pdpaConsented ? 'student-pdpa-consent-error' : undefined} /><span>ข้าพเจ้ายอมรับการเก็บและใช้ข้อมูลส่วนบุคคลเพื่อการประเมินตามนโยบายคุ้มครองข้อมูลส่วนบุคคล</span></label>{errors.pdpaConsented && <p className="student-field-error" id="student-pdpa-consent-error">{errors.pdpaConsented}</p>}</div>
      </>}
      <button className="student-primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'กำลังตรวจสอบ...' : isRegistering ? 'บันทึกข้อมูลและเริ่มทำแบบทดสอบ' : 'ดำเนินการต่อ'}</button>
    </form>
  )
}

type StudentFieldProps = {
  id: string
  label: string
  value: string
  error?: string
  type?: 'text' | 'email' | 'tel' | 'number'
  autoComplete: string
  inputMode?: 'text' | 'email' | 'tel' | 'numeric'
  placeholder?: string
  onChange: (value: string) => void
}

function StudentField({ id, label, value, error, type = 'text', autoComplete, inputMode, placeholder, onChange }: StudentFieldProps) {
  const errorId = `${id}-error`
  return <div className="student-field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} required onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <p className="student-field-error" id={errorId}>{error}</p>}</div>
}

type StudentSelectFieldProps = {
  id: string
  label: string
  value: string
  error?: string
  placeholder: string
  options: ReadonlyArray<{ value: string; label: string }>
  disabled?: boolean
  onChange: (value: string) => void
}

function StudentSelectField({ id, label, value, error, placeholder, options, disabled = false, onChange }: StudentSelectFieldProps) {
  const errorId = id + '-error'
  return <div className="student-field student-select-field"><ScrollableSelect id={id} label={label} value={value} disabled={disabled} invalid={Boolean(error)} ariaDescribedBy={error ? errorId : undefined} options={[{ value: '', label: placeholder }, ...options]} onChange={onChange} />{error && <p className="student-field-error" id={errorId}>{error}</p>}</div>
}

export default StudentIdentityForm
