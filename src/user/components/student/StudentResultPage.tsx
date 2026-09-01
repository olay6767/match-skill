import { useEffect, useState } from 'react'
import { ApiError, createPublicSurveyPortalSession, getPublicSurveyResult, type PublicSurveyResult } from '../../../lib/api'
import PersonalSkillChart from './PersonalSkillChart'
import Icon from '../../../shared/components/ui/Icon'
import { getStoredSurveySession } from './studentSession'
import { formThemeStyle, studentThemePageClass } from '../../../shared/formTheme'
import { saveStudentPortalSession } from '../userPortal/session'
import './student-entry.css'

type StudentResultPageProps = {
  token: string
  onNavigate: (path: string, replace?: boolean) => void
}

function formatSubmittedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

function StudentResultPage({ token, onNavigate }: StudentResultPageProps) {
  const storedSession = getStoredSurveySession(token)
  const surveySession = storedSession?.next === 'result' ? storedSession.surveySession : null
  const alreadySubmitted = storedSession?.next === 'result' && storedSession.alreadySubmitted
  const [result, setResult] = useState<PublicSurveyResult | null>(null)
  const [error, setError] = useState('')
  const [errorStatus, setErrorStatus] = useState<number | null>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [isOpeningPortal, setIsOpeningPortal] = useState(false)
  const [portalError, setPortalError] = useState('')

  useEffect(() => {
    if (!surveySession) return
    let active = true
    getPublicSurveyResult(token, surveySession)
      .then((data) => {
        if (!active) return
        setResult(data)
        setError('')
        setErrorStatus(null)
      })
      .catch((requestError) => {
        if (!active) return
        setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดผลการประเมินได้')
        setErrorStatus(requestError instanceof ApiError ? requestError.status : null)
      })
    return () => { active = false }
  }, [reloadNonce, surveySession, token])

  if (!surveySession) {
    return <main className="student-page"><section className="student-state-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>เซสชันดูผลหมดอายุ</h1><p>กรุณายืนยันข้อมูลใหม่เพื่อดูผลของคุณ</p><button className="student-primary-button" type="button" onClick={() => onNavigate(`/s/${token}`, true)}>กลับไปยืนยันข้อมูล</button></section></main>
  }
  if (error && !result) {
    const isSessionError = errorStatus === 401
    return <main className="student-page"><section className="student-state-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>{isSessionError ? 'เซสชันดูผลหมดอายุ' : 'โหลดผลการประเมินไม่สำเร็จ'}</h1><p role="alert">{error}</p><button className="student-primary-button" type="button" onClick={() => isSessionError ? onNavigate(`/s/${token}`, true) : setReloadNonce((value) => value + 1)}>{isSessionError ? 'กลับไปยืนยันข้อมูล' : 'ลองใหม่'}</button></section></main>
  }
  if (!result) return <main className="student-page"><section className="student-state-card" role="status"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>กำลังโหลดผลการประเมิน</h1><p>โปรดรอสักครู่</p></section></main>

  const heading = alreadySubmitted ? 'คุณเคยส่งแบบประเมินนี้แล้ว' : 'บันทึกแบบประเมินเรียบร้อย'
  const subheading = alreadySubmitted ? 'นี่คือผลการประเมินเดิมของคุณ' : 'ขอบคุณที่ทำแบบประเมินจนเสร็จ'
  const openActivityDetail = async () => {
    setIsOpeningPortal(true)
    setPortalError('')
    try {
      const portalSession = await createPublicSurveyPortalSession(token, surveySession)
      saveStudentPortalSession(portalSession)
      onNavigate(`/user/activities/${result.activity.id}`)
    } catch (requestError) {
      setPortalError(requestError instanceof Error ? requestError.message : 'ไม่สามารถเปิดข้อมูลเพิ่มเติมได้')
    } finally {
      setIsOpeningPortal(false)
    }
  }

  return (
    <main className={studentThemePageClass(result.activity.formTheme)} style={formThemeStyle(result.activity.formTheme)}>
      <section className="student-result-card">
        <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
        <span className="student-state-icon student-state-icon--success" aria-hidden="true"><Icon name="check" /></span>
        <p className="student-phase">{result.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'}</p>
        <h1>{heading}</h1>
        <p className="student-intro">{subheading}</p>
        <dl className="student-result-meta"><div><dt>กิจกรรม</dt><dd>{result.activity.name}</dd></div><div><dt>บันทึกเมื่อ</dt><dd>{formatSubmittedAt(result.submittedAt)}</dd></div></dl>
        <PersonalSkillChart competencies={result.competencies} comparison={result.comparison} phase={result.phase} />
        {!result.comparison && <p className="student-result-note">จะแสดงข้อมูลเปรียบเทียบเมื่อมีผล Pre-test และ Post-test ครบทั้งสองส่วน</p>}
        <div className="student-result-more">
          <div><strong>ดูผลและข้อมูลกิจกรรมเพิ่มเติม</strong><span>ติดตามผล Pre/Post และพัฒนาการของคุณใน Student Portal</span></div>
          {portalError && <p className="student-form-alert" role="alert">{portalError}</p>}
          <button className="student-primary-button" type="button" disabled={isOpeningPortal} onClick={() => void openActivityDetail()}>
            {isOpeningPortal ? 'กำลังเปิดข้อมูล...' : <>ดูข้อมูลเพิ่มเติม <Icon name="chevronRight" /></>}
          </button>
        </div>
      </section>
    </main>
  )
}

export default StudentResultPage
