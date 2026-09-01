import { useEffect, useMemo, useRef, useState } from 'react'
import type { IdentifyPublicSurveyInput, IdentifyPublicSurveyResult, PublicSurveyQuestion, SurveySessionStartResult } from '../../../lib/api'
import type { Activity, SurveyTemplate } from '../dashboard/types'
import AssessmentProgress from '../../../user/components/student/AssessmentProgress'
import StudentCompetencyQuestion from '../../../user/components/student/CompetencyQuestion'
import StudentIdentityForm from '../../../user/components/student/StudentIdentityForm'
import Icon from '../../../shared/components/ui/Icon'
import { formThemeStyle, studentThemePageClass } from '../../../shared/formTheme'
import '../../../user/components/student/student-entry.css'
import './student-assessment-preview.css'

type PreviewStep = 'identity' | 'instructions' | 'questions' | 'review' | 'complete'

type Props = {
  activity: Activity
  template: SurveyTemplate
  phase: 'pre' | 'post'
  onClose: () => void
}

const PREVIEW_SESSION: SurveySessionStartResult = {
  next: 'assessment',
  alreadySubmitted: false,
  resumed: false,
  surveySession: 'preview-session',
  expiresAt: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
}

const stepLabels: Array<{ step: PreviewStep; label: string }> = [
  { step: 'identity', label: 'ยืนยันตัวตน' },
  { step: 'instructions', label: 'คำแนะนำ' },
  { step: 'questions', label: 'แบบประเมิน' },
  { step: 'review', label: 'ตรวจคำตอบ' },
  { step: 'complete', label: 'เสร็จสิ้น' },
]

function StudentAssessmentPreview({ activity, template, phase, onClose }: Props) {
  const [step, setStep] = useState<PreviewStep>('identity')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [isRegistering, setIsRegistering] = useState(false)
  const previewBodyRef = useRef<HTMLDivElement>(null)

  const questions = useMemo<PublicSurveyQuestion[]>(() => (
    [...template.competencies]
      .sort((left, right) => left.displayOrder - right.displayOrder)
      .map((competency) => ({
        questionId: competency.id,
        competencyId: competency.id,
        name: competency.name,
        definition: competency.definition,
        displayOrder: competency.displayOrder,
        levels: competency.levels.map((level) => ({
          levelValue: level.level,
          title: level.title,
          description: level.description,
          example: level.example,
        })),
      }))
  ), [template.competencies])

  useEffect(() => {
    previewBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [currentIndex, step])

  const identifyPreviewStudent = async (values: IdentifyPublicSurveyInput): Promise<IdentifyPublicSurveyResult> => {
    await Promise.resolve()
    return values.firstName ? PREVIEW_SESSION : { next: 'registration' }
  }

  const restart = () => {
    setAnswers({})
    setCurrentIndex(0)
    setIsRegistering(false)
    setStep('identity')
  }

  const currentQuestion = questions[currentIndex]
  const selectedAnswer = currentQuestion ? answers[currentQuestion.questionId] : undefined
  const answeredCount = questions.filter((question) => answers[question.questionId] !== undefined).length
  const activeStepIndex = stepLabels.findIndex((item) => item.step === step)
  const phaseLabel = phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'
  const durationMinutes = phase === 'pre' ? activity.preTestDurationMinutes : activity.postTestDurationMinutes
  const assessmentImage = activity.assessmentImageData
  const assessmentHeader = <div className={`student-assessment-header-media${assessmentImage ? ' student-assessment-header-media--custom' : ''}`}>
    <img src={assessmentImage ?? '/seda-logo.png'} alt={assessmentImage ? `รูปด้านบนแบบประเมิน ${activity.name}` : 'SEDA'} />
  </div>
  const jumpToStep = (nextStep: PreviewStep) => {
    if (nextStep === 'questions' && questions.length > 0) setCurrentIndex(0)
    setStep(nextStep)
  }
  const goPrevious = () => {
    if (step === 'instructions') setStep('identity')
    else if (step === 'questions') {
      if (currentIndex > 0) setCurrentIndex((index) => index - 1)
      else setStep('instructions')
    } else if (step === 'review') {
      setCurrentIndex(Math.max(0, questions.length - 1))
      setStep('questions')
    } else if (step === 'complete') setStep('review')
  }
  const goNext = () => {
    if (step === 'identity') setStep('instructions')
    else if (step === 'instructions') {
      setCurrentIndex(0)
      setStep('questions')
    } else if (step === 'questions') {
      if (currentIndex < questions.length - 1) setCurrentIndex((index) => index + 1)
      else setStep('review')
    } else if (step === 'review') setStep('complete')
  }
  const previewPosition = step === 'questions' && questions.length > 0
    ? `แบบประเมิน · ข้อ ${currentIndex + 1} จาก ${questions.length}`
    : stepLabels[activeStepIndex]?.label ?? ''
  const themedStudentPageClass = studentThemePageClass(activity.formTheme, 'assessment-preview-student-page')
  const themedStudentPageStyle = formThemeStyle(activity.formTheme)

  return (
    <main className="assessment-preview-page">
      <section className="assessment-preview-workspace" aria-labelledby="assessment-preview-title">
        <header className="assessment-preview-toolbar">
          <div>
            <span className="assessment-preview-badge">PREVIEW</span>
            <div>
              <h2 id="assessment-preview-title">{activity.name} · {phaseLabel}</h2>
              <p>Preview ตามข้อมูลของกิจกรรม · ข้อมูลและคำตอบจะไม่ถูกบันทึก</p>
            </div>
          </div>
          <div className="assessment-preview-toolbar-actions">
            <button type="button" onClick={restart}>เริ่มใหม่</button>
            <button className="assessment-preview-close" type="button" onClick={onClose}>กลับคลังแบบประเมิน</button>
          </div>
        </header>

        <nav className="assessment-preview-steps" aria-label="ขั้นตอน Preview">
          {stepLabels.map((item, index) => (
            <button type="button" aria-current={index === activeStepIndex ? 'step' : undefined} className={index === activeStepIndex ? 'is-current' : index < activeStepIndex ? 'is-complete' : ''} key={item.step} onClick={() => jumpToStep(item.step)}>
              <i aria-hidden="true">{index < activeStepIndex ? '✓' : index + 1}</i>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="assessment-preview-body" ref={previewBodyRef}>
          {step === 'identity' && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}>
              <section className="student-entry-card">
                {isRegistering
                  ? <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
                  : activity.imageData
                    ? <img className="student-entry-poster" src={activity.imageData} alt={`โปสเตอร์กิจกรรม ${activity.name}`} />
                    : <img className="student-logo" src="/seda-logo.png" alt="SEDA" />}
                <p className="student-phase">{phaseLabel} · PREVIEW</p>
                <h1>{activity.name}</h1>
                <p className="student-intro">กรอกรหัสนักศึกษาเพื่อเริ่มทำแบบประเมิน หากเป็นครั้งแรก ระบบจะขอข้อมูลสำหรับลงทะเบียน</p>
                <StudentIdentityForm onSubmit={identifyPreviewStudent} onVerified={() => setStep('instructions')} onRegistrationChange={setIsRegistering} />
              </section>
            </main>
          )}

          {step === 'instructions' && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}>
              <section className="student-assessment-card student-assessment-card--guide">
                <p className="student-phase">{phaseLabel} · {activity.name}</p>
                <PreviewTimer minutes={durationMinutes} />
                <img className="student-assessment-guide-image" src={phase === 'pre' ? '/pretest-intro.png' : '/posttest-intro.png'} alt={phase === 'pre' ? 'คำถามสำหรับการประเมินก่อนเข้าร่วมกิจกรรม' : 'คำถามสำหรับการประเมินหลังเข้าร่วมกิจกรรม'} />
                <img className="student-assessment-guide-image" src="/impact3-assessment-guide.png" alt="วิธีการประเมินตนเองโดยใช้กรอบ IMPACTS3" />
                <h1>วิธีทำแบบประเมิน</h1>
                <p className="student-intro">โปรดอ่านแนวทางการประเมินตนเองก่อนเริ่มทำแบบทดสอบ</p>
                <button className="student-primary-button" type="button" onClick={() => setStep('questions')}>เริ่มทำแบบประเมิน</button>
              </section>
            </main>
          )}

          {step === 'questions' && currentQuestion && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}>
              <section className="student-assessment-card">
                {assessmentHeader}
                <p className="student-phase">{phaseLabel} · {activity.name}</p>
                <PreviewTimer minutes={durationMinutes} />
                <AssessmentProgress current={currentIndex + 1} total={questions.length} />
                <StudentCompetencyQuestion
                  question={currentQuestion}
                  value={selectedAnswer}
                  onChange={(levelValue) => setAnswers((current) => ({ ...current, [currentQuestion.questionId]: levelValue }))}
                />
                {selectedAnswer === undefined && <p className="student-next-hint" role="status">กรุณาเลือกคำตอบ 1 ระดับก่อนดำเนินการต่อ</p>}
                <div className="student-assessment-actions">
                  <button className="student-secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>ก่อนหน้า</button>
                  <button className="student-primary-button" type="button" disabled={selectedAnswer === undefined} onClick={() => {
                    if (currentIndex === questions.length - 1) setStep('review')
                    else setCurrentIndex((index) => index + 1)
                  }}>{currentIndex === questions.length - 1 ? 'ตรวจสอบคำตอบ' : 'ถัดไป'}</button>
                </div>
              </section>
            </main>
          )}

          {step === 'review' && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}>
              <section className="student-assessment-card">
                {assessmentHeader}
                <h1>ตรวจสอบคำตอบ</h1>
                <PreviewTimer minutes={durationMinutes} />
                <p className="student-intro">ตอบแล้ว {answeredCount} จาก {questions.length} ข้อ กรุณาตรวจสอบก่อนส่ง</p>
                <ol className="student-answer-summary">
                  {questions.map((question, index) => {
                    const selectedLevel = question.levels.find((level) => level.levelValue === answers[question.questionId])
                    return (
                      <li key={question.questionId}>
                        <div><strong>{index + 1}. {question.name}</strong><span>{selectedLevel ? `ระดับ ${selectedLevel.levelValue}: ${selectedLevel.title}` : 'ยังไม่ได้เลือกคำตอบ'}</span></div>
                        <button type="button" onClick={() => { setCurrentIndex(index); setStep('questions') }}>แก้ไข</button>
                      </li>
                    )
                  })}
                </ol>
                <div className="student-assessment-actions">
                  <button className="student-secondary-button" type="button" onClick={() => setStep('questions')}>กลับไปทำต่อ</button>
                  <button className="student-primary-button" type="button" disabled={answeredCount !== questions.length} onClick={() => setStep('complete')}>ส่งแบบประเมิน</button>
                </div>
              </section>
            </main>
          )}

          {step === 'complete' && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}>
              <section className="student-state-card">
                <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
                <span className="student-state-icon student-state-icon--success" aria-hidden="true"><Icon name="check" /></span>
                <p className="student-phase">{phaseLabel} · PREVIEW</p>
                <h1>บันทึกแบบประเมินเรียบร้อย</h1>
                <p>นี่คือหน้าสำเร็จในโหมด Preview ระบบไม่ได้บันทึกข้อมูลนักศึกษาหรือคำตอบชุดนี้</p>
                <button className="student-primary-button" type="button" onClick={restart}>ทดลองใหม่ตั้งแต่ต้น</button>
              </section>
            </main>
          )}

          {step === 'questions' && !currentQuestion && (
            <main className={themedStudentPageClass} style={themedStudentPageStyle}><section className="student-state-card"><h1>ยังไม่มีคำถามสำหรับ Preview</h1><p>กรุณาเพิ่มสมรรถนะและระดับคำตอบก่อนทดลองแบบสอบถาม</p></section></main>
          )}
        </div>
        <footer className="assessment-preview-pagination" aria-label="ปุ่มเปลี่ยนหน้า Preview">
          <button type="button" disabled={step === 'identity'} onClick={goPrevious}>← ย้อนกลับ</button>
          <span>{previewPosition}</span>
          <button className="is-next" type="button" disabled={step === 'complete'} onClick={goNext}>{step === 'complete' ? 'หน้าสุดท้าย' : 'ข้ามไปหน้าถัดไป →'}</button>
        </footer>
      </section>
    </main>
  )
}

function PreviewTimer({ minutes }: { minutes: number }) {
  return <p className="student-assessment-timer" role="timer" aria-label={`ตัวอย่างเวลาที่เหลือ ${minutes} นาที`}><span>เวลาที่เหลือ</span><strong>{String(minutes).padStart(2, '0')}:00</strong></p>
}

export default StudentAssessmentPreview
