import type { PublicSurveyInfo } from '../../../lib/api'
import Icon from '../../../shared/components/ui/Icon'

type StateKind = PublicSurveyInfo['status'] | 'loading' | 'invalid' | 'network-error'

type SurveyWindowStateProps = {
  kind: StateKind
  onRetry?: () => void
}

const copy: Record<StateKind, { title: string; description: string }> = {
  loading: {
    title: 'กำลังตรวจสอบ QR Code',
    description: 'โปรดรอสักครู่',
  },
  invalid: {
    title: 'ไม่พบ QR Code นี้',
    description: 'QR Code อาจไม่ถูกต้องหรือถูกยกเลิกแล้ว กรุณาตรวจสอบและสแกนใหม่',
  },
  'network-error': {
    title: 'เชื่อมต่อระบบไม่สำเร็จ',
    description: 'กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง',
  },
  not_open: {
    title: 'แบบประเมินยังไม่เปิด',
    description: 'กรุณากลับมาอีกครั้งภายในช่วงเวลาที่ผู้ดูแลกิจกรรมกำหนด',
  },
  closed: {
    title: 'แบบประเมินปิดรับแล้ว',
    description: 'ไม่สามารถเริ่มทำแบบประเมินนี้ได้ในขณะนี้',
  },
  archived: {
    title: 'กิจกรรมถูกเก็บถาวรแล้ว',
    description: 'กิจกรรมนี้ไม่เปิดรับการประเมินเพิ่มเติม',
  },
  open: {
    title: 'แบบประเมินพร้อมใช้งาน',
    description: '',
  },
}

function SurveyWindowState({ kind, onRetry }: SurveyWindowStateProps) {
  const content = copy[kind]
  const isLoading = kind === 'loading'
  const isError = kind === 'invalid' || kind === 'network-error'

  return (
    <section className={`student-state-card student-state-card--window student-state-card--${kind}`} aria-live="polite" aria-busy={isLoading}>
      <img className="student-logo" src="/seda-logo.png" alt="SEDA" />
      <span className={`student-state-icon student-state-icon--${isError ? 'error' : isLoading ? 'loading' : 'neutral'}`} aria-hidden="true">
        <Icon name={isLoading ? 'loading' : isError ? 'error' : 'info'} />
      </span>
      <h1>{content.title}</h1>
      <p role={isError ? 'alert' : 'status'}>{content.description}</p>
      {kind === 'network-error' && onRetry && <button className="student-secondary-button" type="button" onClick={onRetry}>ลองใหม่</button>}
    </section>
  )
}

export default SurveyWindowState
