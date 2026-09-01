import { useEffect, useState } from 'react'
import { ApiError, getStudentHistory, getStudentHistoryResponse, requestStudentHistoryOtp, type StudentHistoryItem, type StudentHistoryResponse, verifyStudentHistoryOtp } from '../../../lib/api'
import { isValidStudentCode, normalizeStudentCode } from '../../../lib/studentCode'
import { clearHistorySession, getStoredHistorySession, saveHistorySession, type StoredHistorySession } from './studentHistorySession'
import { trackUserEvent } from '../../usage/tracker'
import './student-entry.css'

type FormValues = { studentCode: string; email: string; otp: string }
type FormErrors = Partial<Record<keyof FormValues, string>>

const initialValues: FormValues = { studentCode: '', email: '', otp: '' }

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function validateIdentity(values: FormValues): FormErrors {
  const errors: FormErrors = {}
  if (!isValidStudentCode(values.studentCode)) errors.studentCode = 'รหัสนักศึกษาต้องขึ้นต้น B, M หรือ D ตามด้วยตัวเลข 7 หลัก'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'กรุณากรอกอีเมลที่ถูกต้อง'
  return errors
}

function StudentHistoryPage() {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [notice, setNotice] = useState('')
  const [developmentOtp, setDevelopmentOtp] = useState('')
  const [isRequesting, setIsRequesting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [historySession, setHistorySession] = useState<StoredHistorySession | null>(() => getStoredHistorySession())
  const [history, setHistory] = useState<StudentHistoryItem[] | null>(null)
  const [historyError, setHistoryError] = useState('')
  const [historyReloadNonce, setHistoryReloadNonce] = useState(0)
  const [selectedResponse, setSelectedResponse] = useState<StudentHistoryResponse | null>(null)
  const [isLoadingResponse, setIsLoadingResponse] = useState(false)

  useEffect(() => {
    if (!historySession) return
    let active = true
    getStudentHistory(historySession.historySession)
      .then((result) => {
        if (!active) return
        setHistory(result.history)
        setHistoryError('')
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 401) {
          clearHistorySession()
          setHistorySession(null)
          setNotice('เซสชันดูประวัติหมดอายุ กรุณาขอรหัสยืนยันใหม่')
          return
        }
        setHistoryError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดประวัติได้')
      })
    return () => { active = false }
  }, [historyReloadNonce, historySession])

  const update = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const requestOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = { ...values, studentCode: normalizeStudentCode(values.studentCode), email: values.email.trim().toLowerCase() }
    const nextErrors = validateIdentity(normalized)
    setErrors(nextErrors)
    setNotice('')
    setDevelopmentOtp('')
    if (Object.keys(nextErrors).length) { trackUserEvent('interaction', 'form_validation_error:history_request'); return }
    setIsRequesting(true)
    try {
      const result = await requestStudentHistoryOtp({ studentCode: normalized.studentCode, email: normalized.email })
      setValues(normalized)
      setNotice(result.message)
      setDevelopmentOtp(result.developmentOtp ?? '')
      trackUserEvent('interaction', 'form_success:history_request')
    } catch (requestError) {
      trackUserEvent('interaction', 'form_error:history_request')
      setNotice(requestError instanceof Error ? requestError.message : 'ไม่สามารถขอรหัสยืนยันได้')
    } finally {
      setIsRequesting(false)
    }
  }

  const verifyOtp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateIdentity(values)
    if (!/^\d{6}$/.test(values.otp.trim())) nextErrors.otp = 'กรุณากรอกรหัสยืนยัน 6 หลัก'
    setErrors(nextErrors)
    setNotice('')
    if (Object.keys(nextErrors).length) { trackUserEvent('interaction', 'form_validation_error:history_verify'); return }
    setIsVerifying(true)
    try {
      const result = await verifyStudentHistoryOtp({ studentCode: normalizeStudentCode(values.studentCode), email: values.email.trim().toLowerCase(), otp: values.otp.trim() })
      const session = { historySession: result.historySession, expiresAt: result.expiresAt }
      saveHistorySession(session)
      setHistorySession(session)
      setHistory(null)
      setSelectedResponse(null)
      setNotice('')
      trackUserEvent('interaction', 'form_success:history_verify')
    } catch (requestError) {
      trackUserEvent('interaction', 'form_error:history_verify')
      setNotice(requestError instanceof Error ? requestError.message : 'ไม่สามารถยืนยันรหัสได้')
    } finally {
      setIsVerifying(false)
    }
  }

  const openResponse = async (responseId: number) => {
    if (!historySession) return
    setIsLoadingResponse(true)
    setNotice('')
    try {
      const result = await getStudentHistoryResponse(responseId, historySession.historySession)
      setSelectedResponse(result.response)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 401) {
        clearHistorySession()
        setHistorySession(null)
        setNotice('เซสชันดูประวัติหมดอายุ กรุณาขอรหัสยืนยันใหม่')
      } else setNotice(requestError instanceof Error ? requestError.message : 'ไม่สามารถเปิดผลการประเมินได้')
    } finally {
      setIsLoadingResponse(false)
    }
  }

  if (historySession) {
    return <main className="student-page"><section className="student-history-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><div className="student-history-heading"><div><h1>ประวัติการประเมิน</h1><p>แสดงเฉพาะประวัติที่ยืนยันตัวตนแล้ว</p></div><button className="student-history-link" type="button" onClick={() => { clearHistorySession(); setHistorySession(null); setHistory(null); setSelectedResponse(null) }}>ออกจากประวัติ</button></div>{historyError ? <div className="student-history-empty"><p role="alert">{historyError}</p><button className="student-primary-button" type="button" onClick={() => setHistoryReloadNonce((value) => value + 1)}>ลองใหม่</button></div> : !history ? <div className="student-history-empty" role="status">กำลังโหลดประวัติ...</div> : history.length === 0 ? <div className="student-history-empty">ยังไม่มีประวัติการตอบแบบประเมิน</div> : <ul className="student-history-list">{history.map((item) => <li key={item.responseId}><div><span className="student-history-phase">{item.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'}</span><strong>{item.activityName}</strong><small>{formatDate(item.submittedAt)} · ส่งแล้ว</small></div><button className="student-secondary-button" type="button" disabled={isLoadingResponse} onClick={() => void openResponse(item.responseId)}>ดูผล</button></li>)}</ul>}{selectedResponse && <article className="student-history-detail"><div className="student-result-section-heading"><h2>{selectedResponse.activityName}</h2><button className="student-history-link" type="button" onClick={() => setSelectedResponse(null)}>ปิด</button></div><p className="student-phase">{selectedResponse.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'} · {formatDate(selectedResponse.submittedAt)}</p><ul className="student-history-levels">{selectedResponse.competencies.map((competency) => <li key={competency.competencyId}><span>{competency.name}</span><strong>ระดับ {competency.levelValue}/7</strong></li>)}</ul></article>}{notice && <p className="student-form-alert" role="alert">{notice}</p>}</section></main>
  }

  return (
    <main className="student-page">
      <section className="student-history-card">
        <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
        <h1>ดูประวัติการประเมิน</h1>
        <p className="student-intro">ยืนยันตัวตนด้วยรหัสที่ส่งไปยังอีเมล เพื่อปกป้องข้อมูลส่วนบุคคลของคุณ</p>
        <form className="student-identity-form" data-usage-form="history_request" noValidate onSubmit={requestOtp}>
          <HistoryField id="history-student-code" label="รหัสนักศึกษา" value={values.studentCode} error={errors.studentCode} autoComplete="username" onChange={(value) => update('studentCode', normalizeStudentCode(value))} />
          <HistoryField id="history-email" label="อีเมล" type="email" value={values.email} error={errors.email} autoComplete="email" onChange={(value) => update('email', value)} />
          <button className="student-primary-button" type="submit" disabled={isRequesting}>{isRequesting ? 'กำลังส่งรหัส...' : 'ขอรหัสยืนยัน'}</button>
        </form>
        {notice && <p className="student-history-notice" role="status">{notice}</p>}
        {developmentOtp && <p className="student-history-development-code">รหัสทดสอบสำหรับ development: <strong>{developmentOtp}</strong></p>}
        {(notice || developmentOtp) && <form className="student-identity-form student-history-otp-form" data-usage-form="history_verify" noValidate onSubmit={verifyOtp}><HistoryField id="history-otp" label="รหัสยืนยัน 6 หลัก" value={values.otp} error={errors.otp} autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(value) => update('otp', value.replace(/\D/g, ''))} /><button className="student-primary-button" type="submit" disabled={isVerifying}>{isVerifying ? 'กำลังยืนยัน...' : 'เปิดประวัติการประเมิน'}</button></form>}
      </section>
    </main>
  )
}

type HistoryFieldProps = {
  id: string
  label: string
  value: string
  error?: string
  type?: 'text' | 'email'
  autoComplete: string
  inputMode?: 'numeric'
  maxLength?: number
  onChange: (value: string) => void
}

function HistoryField({ id, label, value, error, type = 'text', autoComplete, inputMode, maxLength, onChange }: HistoryFieldProps) {
  const errorId = `${id}-error`
  return <div className="student-field"><label htmlFor={id}>{label}</label><input id={id} type={type} value={value} autoComplete={autoComplete} inputMode={inputMode} maxLength={maxLength} required onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} />{error && <p className="student-field-error" id={errorId}>{error}</p>}</div>
}

export default StudentHistoryPage
