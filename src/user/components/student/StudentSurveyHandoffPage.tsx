import { getStoredSurveySession } from './studentSession'
import Icon from '../../../shared/components/ui/Icon'
import './student-entry.css'

type StudentSurveyHandoffPageProps = {
  token: string
  destination: 'assessment' | 'result'
  onNavigate: (path: string, replace?: boolean) => void
}

function StudentSurveyHandoffPage({ token, destination, onNavigate }: StudentSurveyHandoffPageProps) {
  const session = getStoredSurveySession(token)
  const isCurrentDestination = session?.next === destination
  const title = destination === 'assessment' ? 'ยืนยันข้อมูลเรียบร้อย' : 'คุณเคยส่งแบบประเมินแล้ว'
  const message = destination === 'assessment'
    ? 'กำลังเปิดแบบประเมินสำหรับคุณ'
    : 'ระบบจะเปิดผลการประเมินเดิมของคุณ โดยไม่อนุญาตให้ส่งซ้ำ'

  return (
    <main className="student-page">
      <section className="student-state-card">
        <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
        <span className="student-state-icon student-state-icon--success" aria-hidden="true"><Icon name="check" /></span>
        <h1>{title}</h1>
        <p>{isCurrentDestination ? message : 'เซสชันนี้หมดอายุแล้ว กรุณายืนยันข้อมูลใหม่อีกครั้ง'}</p>
        {!isCurrentDestination && <button className="student-primary-button" type="button" onClick={() => onNavigate(`/s/${token}`, true)}>กลับไปยืนยันข้อมูล</button>}
      </section>
    </main>
  )
}

export default StudentSurveyHandoffPage
