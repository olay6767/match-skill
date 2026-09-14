import { useEffect, useState } from 'react'
import { ApiError, getPublicSurveyStatus, identifyPublicSurvey, type PublicSurveyInfo, type SurveySessionStartResult } from '../../../lib/api'
import StudentIdentityForm from './StudentIdentityForm'
import SurveyWindowState from './SurveyWindowState'
import { getStoredSurveySession, saveStoredSurveySession } from './studentSession'
import { formThemeStyle, studentThemePageClass } from '../../../shared/formTheme'
import './student-entry.css'

type StudentEntryPageProps = {
  token: string
  onNavigate: (path: string, replace?: boolean) => void
}

function StudentEntryPage({ token, onNavigate }: StudentEntryPageProps) {
  const [survey, setSurvey] = useState<PublicSurveyInfo | null>(null)
  const [state, setState] = useState<'loading' | 'invalid' | 'network-error' | null>('loading')
  const [reloadNonce, setReloadNonce] = useState(0)
  const [isRegistering, setIsRegistering] = useState(false)

  useEffect(() => {
    let active = true
    getPublicSurveyStatus(token)
      .then((result) => {
        if (!active) return
        setSurvey(result)
        setState(null)
      })
      .catch((error) => {
        if (!active) return
        setState(error instanceof ApiError && [400, 404, 410].includes(error.status) ? 'invalid' : 'network-error')
      })
    return () => { active = false }
  }, [reloadNonce, token])

  const retry = () => {
    setSurvey(null)
    setState('loading')
    setReloadNonce((current) => current + 1)
  }

  useEffect(() => {
    if (!survey || survey.status !== 'open') return
    const session = getStoredSurveySession(token)
    if (session) onNavigate(`/s/${token}/${session.next}`, true)
  }, [onNavigate, survey, token])

  const identify = (values: Parameters<typeof identifyPublicSurvey>[1]) => identifyPublicSurvey(token, values)
  const startSurvey = (result: SurveySessionStartResult) => {
    saveStoredSurveySession(token, result)
    onNavigate(`/s/${token}/${result.next}`, true)
  }

  if (state) return <main className={`student-page student-page--status student-page--status-${state}`}><SurveyWindowState kind={state} onRetry={state === 'network-error' ? retry : undefined} /></main>
  if (!survey) return null
  if (survey.status !== 'open') return <main className={`${studentThemePageClass(survey.activity.formTheme)} student-page--status student-page--status-${survey.status}`} style={formThemeStyle(survey.activity.formTheme)}><SurveyWindowState kind={survey.status} /></main>

  return (
    <main className={studentThemePageClass(survey.activity.formTheme)} style={formThemeStyle(survey.activity.formTheme)}>
      <section className="student-entry-card">
        {isRegistering
          ? <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
          : survey.activity.imageData
          ? <img className="student-entry-poster" src={survey.activity.imageData} alt={`โปสเตอร์กิจกรรม ${survey.activity.name}`} />
          : <img className="student-logo" src="/seda-logo.png" alt="SEDA" />}
        <p className="student-phase">{survey.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'}</p>
        <h1>{survey.activity.name}</h1>
        <p className="student-intro">กรอกรหัสนักศึกษาเพื่อเริ่มทำแบบประเมิน หากเป็นครั้งแรก ระบบจะขอข้อมูลสำหรับลงทะเบียน</p>
        <StudentIdentityForm onSubmit={identify} onVerified={startSurvey} onRegistrationChange={setIsRegistering} />
      </section>
    </main>
  )
}

export default StudentEntryPage
