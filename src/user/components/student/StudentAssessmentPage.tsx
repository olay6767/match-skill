import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError, getPublicSurveyQuestions, savePublicSurveyDraft, submitPublicSurvey, type PublicSurveyQuestions } from '../../../lib/api'
import AssessmentProgress from './AssessmentProgress'
import CompetencyQuestion from './CompetencyQuestion'
import { trackUserEvent } from '../../usage/tracker'
import { getStoredSurveySession, setStoredSurveySessionNext } from './studentSession'
import { formThemeStyle, studentThemePageClass } from '../../../shared/formTheme'
import './student-entry.css'

type StudentAssessmentPageProps = {
  token: string
  onNavigate: (path: string, replace?: boolean) => void
}

function instructionStorageKey(token: string) {
  return `seda-survey-instructions:${token}`
}

function shouldShowInstructions(token: string, surveySession: string | null, resumed: boolean) {
  if (!surveySession || resumed) return false
  try {
    return window.sessionStorage.getItem(instructionStorageKey(token)) !== surveySession
  } catch {
    return true
  }
}

function remainingSeconds(expiresAt: string | undefined) {
  const expiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN
  return Number.isNaN(expiresAtMs) ? 0 : Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1_000))
}

function formatRemainingTime(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function StudentAssessmentPage({ token, onNavigate }: StudentAssessmentPageProps) {
  const storedSession = getStoredSurveySession(token)
  const surveySession = storedSession?.next === 'assessment' ? storedSession.surveySession : null
  const expiresAt = storedSession?.next === 'assessment' ? storedSession.expiresAt : undefined
  const resumed = storedSession?.next === 'assessment' ? storedSession.resumed : false
  const [data, setData] = useState<PublicSurveyQuestions | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isReviewing, setIsReviewing] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [timeRemaining, setTimeRemaining] = useState(() => remainingSeconds(expiresAt))
  const [showInstructions, setShowInstructions] = useState(() => shouldShowInstructions(token, surveySession, resumed))
  const draftSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const trackedQuestionAnswers = useRef(new Set<number>())

  useEffect(() => {
    const updateRemainingTime = () => setTimeRemaining(remainingSeconds(expiresAt))
    updateRemainingTime()
    const interval = window.setInterval(updateRemainingTime, 1_000)
    return () => window.clearInterval(interval)
  }, [expiresAt])

  useEffect(() => {
    if (!surveySession) return
    let active = true
    getPublicSurveyQuestions(token, surveySession)
      .then((result) => {
        if (!active) return
        setData(result)
        const restoredAnswers = Object.fromEntries(result.draftAnswers.map((answer) => [answer.questionId, answer.levelValue]))
        const firstUnansweredIndex = result.questions.findIndex((question) => restoredAnswers[question.questionId] === undefined)
        setAnswers(restoredAnswers)
        setCurrentIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : Math.max(0, result.questions.length - 1))
        setIsReviewing(firstUnansweredIndex < 0 && result.questions.length > 0)
        setError('')
      })
      .catch((requestError) => {
        if (!active) return
        if (requestError instanceof ApiError && requestError.status === 409) {
          setStoredSurveySessionNext(token, 'result')
          onNavigate(`/s/${token}/result`, true)
          return
        }
        setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดแบบประเมินได้')
      })
    return () => { active = false }
  }, [onNavigate, reloadNonce, surveySession, token])

  useEffect(() => {
    if (!data || isReviewing) return
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentIndex, data, isReviewing])

  const answeredCount = useMemo(() => data?.questions.filter((question) => answers[question.questionId] !== undefined).length ?? 0, [answers, data])
  const currentQuestion = data?.questions[currentIndex]
  const timer = <p className={`student-assessment-timer${timeRemaining <= 300 ? ' student-assessment-timer--urgent' : ''}`} role="timer" aria-label={`เวลาที่เหลือ ${formatRemainingTime(timeRemaining)}`}><span>เวลาที่เหลือ</span><strong>{formatRemainingTime(timeRemaining)}</strong></p>

  const submit = async () => {
    if (!data || !surveySession || answeredCount !== data.questions.length) return
    setError('')
    setIsSubmitting(true)
    const request = {
      surveySession,
      answers: data.questions.map((question) => ({
        questionId: question.questionId,
        competencyId: question.competencyId,
        levelValue: answers[question.questionId]!,
      })),
    }
    try {
      await submitPublicSurvey(token, request)
      trackUserEvent('interaction', 'assessment_submitted', { activityId: data.activity.id, phase: data.phase, totalQuestions: data.questions.length })
      window.sessionStorage.removeItem(instructionStorageKey(token))
      setStoredSurveySessionNext(token, 'result')
      onNavigate(`/s/${token}/result`, true)
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 409) {
        window.sessionStorage.removeItem(instructionStorageKey(token))
        setStoredSurveySessionNext(token, 'result')
        onNavigate(`/s/${token}/result`, true)
        return
      }
      setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถส่งแบบประเมินได้ กรุณาลองใหม่อีกครั้ง')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!surveySession) {
    return <main className="student-page"><section className="student-state-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>เซสชันแบบประเมินหมดอายุ</h1><p>กรุณายืนยันข้อมูลใหม่ก่อนเริ่มทำแบบประเมิน</p><button className="student-primary-button" type="button" onClick={() => onNavigate(`/s/${token}`, true)}>กลับไปยืนยันข้อมูล</button></section></main>
  }
  if (timeRemaining === 0) {
    return <main className="student-page"><section className="student-state-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>หมดเวลาทำแบบประเมิน</h1><p>กรุณายืนยันข้อมูลใหม่ หากผู้ดูแลยังเปิดกิจกรรมอยู่</p><button className="student-primary-button" type="button" onClick={() => onNavigate(`/s/${token}`, true)}>กลับไปหน้าเริ่มต้น</button></section></main>
  }
  if (error && !data) {
    return <main className="student-page"><section className="student-state-card"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>โหลดแบบประเมินไม่สำเร็จ</h1><p role="alert">{error}</p><button className="student-primary-button" type="button" onClick={() => { setError(''); setReloadNonce((value) => value + 1) }}>ลองใหม่</button></section></main>
  }
  if (!data || !currentQuestion) return <main className="student-page"><section className="student-state-card" role="status"><img className="student-logo" src="/seda-logo.png" alt="SEDA" /><h1>กำลังโหลดแบบประเมิน</h1><p>โปรดรอสักครู่</p></section></main>

  const assessmentHeader = <AssessmentHeaderImage imageData={data.activity.imageData} activityName={data.activity.name} />
  const themedPageClass = studentThemePageClass(data.activity.formTheme)
  const themedPageStyle = formThemeStyle(data.activity.formTheme)
  const hasAnsweredCurrentQuestion = answers[currentQuestion.questionId] !== undefined
  const updateAnswer = (levelValue: number) => {
    if (!surveySession) return
    setAnswers((current) => ({ ...current, [currentQuestion.questionId]: levelValue }))
    setError('')
    if (!trackedQuestionAnswers.current.has(currentQuestion.questionId)) {
      trackedQuestionAnswers.current.add(currentQuestion.questionId)
      trackUserEvent('interaction', 'assessment_question_answered', {
        activityId: data.activity.id,
        phase: data.phase,
        questionNumber: currentIndex + 1,
        totalQuestions: data.questions.length,
      })
    }
    const draftAnswer = {
      surveySession,
      questionId: currentQuestion.questionId,
      competencyId: currentQuestion.competencyId,
      levelValue,
    }
    draftSaveQueue.current = draftSaveQueue.current
      .catch(() => undefined)
      .then(() => savePublicSurveyDraft(token, draftAnswer))
      .catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถบันทึกคำตอบชั่วคราวได้'))
  }

  const startAssessment = () => {
    window.sessionStorage.setItem(instructionStorageKey(token), surveySession)
    setShowInstructions(false)
    trackUserEvent('interaction', 'assessment_started', { activityId: data.activity.id, phase: data.phase, totalQuestions: data.questions.length })
  }

  if (showInstructions) {
    return (
      <main className={themedPageClass} style={themedPageStyle}>
        <section className="student-assessment-card student-assessment-card--guide">
          <p className="student-phase">{data.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'} · {data.activity.name}</p>
          {timer}
          {data.phase === 'pre' && <img className="student-assessment-guide-image" src="/pretest-intro.png" alt="คำถามสำหรับการประเมินก่อนเข้าร่วมกิจกรรม: ท่านคิดว่าก่อนที่ท่านเข้าร่วมกิจกรรมนี้ ท่านมีพฤติกรรมในมิติต่าง ๆ ต่อไปนี้ในระดับใด" />}
          {data.phase === 'post' && <img className="student-assessment-guide-image" src="/posttest-intro.png" alt="คำถามสำหรับการประเมินหลังเข้าร่วมกิจกรรม: ท่านคิดว่าหลังจากที่ท่านเข้าร่วมกิจกรรมนี้ ท่านมีพฤติกรรมในมิติต่าง ๆ ต่อไปนี้ในระดับใด" />}
          <img className="student-assessment-guide-image" src="/impact3-assessment-guide.png" alt="วิธีการประเมินตนเองโดยใช้กรอบ IMPACTS³: อ่านคำอธิบาย เลือกระดับ สะท้อนตนเอง และเลือกคำตอบ" />
          <h1>วิธีทำแบบประเมิน</h1>
          <p className="student-intro">โปรดอ่านแนวทางการประเมินตนเองก่อนเริ่มทำแบบทดสอบ</p>
          <button className="student-primary-button" type="button" onClick={startAssessment}>เริ่มทำแบบประเมิน</button>
        </section>
      </main>
    )
  }

  if (isReviewing) {
    return (
      <main className={themedPageClass} style={themedPageStyle}>
        <section className="student-assessment-card">
          {assessmentHeader}
          <h1>ตรวจสอบคำตอบ</h1>
          {timer}
          <p className="student-intro">ตอบแล้ว {answeredCount} จาก {data.questions.length} ข้อ กรุณาตรวจสอบก่อนส่ง</p>
          <ol className="student-answer-summary">
            {data.questions.map((question, index) => {
              const selectedLevel = question.levels.find((level) => level.levelValue === answers[question.questionId])
              return <li key={question.questionId}><div><strong>{index + 1}. {question.name}</strong><span>{selectedLevel ? `ระดับ ${selectedLevel.levelValue}: ${selectedLevel.title}` : 'ยังไม่ได้เลือกคำตอบ'}</span></div><button type="button" onClick={() => { setCurrentIndex(index); setIsReviewing(false) }}>แก้ไข</button></li>
            })}
          </ol>
          {error && <p className="student-form-alert" role="alert">{error}</p>}
          {answeredCount !== data.questions.length && <p className="student-form-alert" role="alert">กรุณาตอบให้ครบทั้ง 9 ข้อก่อนส่ง</p>}
          <div className="student-assessment-actions"><button className="student-secondary-button" type="button" onClick={() => setIsReviewing(false)}>กลับไปทำต่อ</button><button className="student-primary-button" type="button" disabled={answeredCount !== data.questions.length || isSubmitting} onClick={() => void submit()}>{isSubmitting ? 'กำลังส่งคำตอบ...' : 'ส่งแบบประเมิน'}</button></div>
        </section>
      </main>
    )
  }

  return (
    <main className={themedPageClass} style={themedPageStyle}>
      <section className="student-assessment-card">
        {assessmentHeader}
        <p className="student-phase">{data.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'} · {data.activity.name}</p>
        {timer}
        <AssessmentProgress current={currentIndex + 1} total={data.questions.length} />
        <CompetencyQuestion question={currentQuestion} value={answers[currentQuestion.questionId]} onChange={updateAnswer} />
        {!hasAnsweredCurrentQuestion && <p className="student-next-hint" role="status">กรุณาเลือกคำตอบ 1 ระดับก่อนดำเนินการต่อ</p>}
        {error && <p className="student-form-alert" role="alert">{error}</p>}
        <div className="student-assessment-actions">
          <button className="student-secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>ก่อนหน้า</button>
          <button className="student-primary-button" type="button" disabled={!hasAnsweredCurrentQuestion} onClick={() => currentIndex === data.questions.length - 1 ? setIsReviewing(true) : setCurrentIndex((index) => index + 1)}>{currentIndex === data.questions.length - 1 ? 'ตรวจสอบคำตอบ' : 'ถัดไป'}</button>
        </div>
      </section>
    </main>
  )
}

function AssessmentHeaderImage({ imageData, activityName }: { imageData: string | null; activityName: string }) {
  return <div className={`student-assessment-header-media${imageData ? ' student-assessment-header-media--custom' : ''}`}>
    <img src={imageData ?? '/seda-logo.png'} alt={imageData ? `รูปด้านบนแบบประเมิน ${activityName}` : 'SEDA'} />
  </div>
}

export default StudentAssessmentPage
