import { useEffect, useState } from 'react'
import { ApiError, getPublicSurveyStatus } from '../../../lib/api'

type State = { activity: { id: number; name: string }; phase: 'pre' | 'post'; status: 'not_open' | 'open' | 'closed' | 'archived' }

function StudentSurveyStatusPage({ token }: { token: string }) {
  const [data, setData] = useState<State | null>(null)
  const [message, setMessage] = useState('กำลังตรวจสอบ QR Code...')
  useEffect(() => { getPublicSurveyStatus(token).then((result) => { setData(result); setMessage('') }).catch((error) => setMessage(error instanceof ApiError && error.status === 410 ? 'QR Code นี้ไม่ถูกต้องหรือถูกยกเลิกแล้ว' : error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบ QR Code ได้')) }, [token])
  const labels = { not_open: 'แบบประเมินยังไม่เปิด', open: 'แบบประเมินพร้อมใช้งาน', closed: 'แบบประเมินปิดแล้ว', archived: 'กิจกรรมถูกเก็บถาวรแล้ว' }
  return <main className="student-status-page"><section><img src="/seda-logo.png" alt="SEDA" />{data ? <><small>{data.phase === 'pre' ? 'PRE-TEST' : 'POST-TEST'}</small><h1>{data.activity.name}</h1><p className={`student-window-status student-window-status--${data.status}`}>{labels[data.status]}</p>{data.status === 'open' && <p>ขั้นตอนระบุตัวตนและทำแบบประเมินจะเชื่อมต่อในหน้า Student Entry</p>}</> : <p role="status">{message}</p>}</section></main>
}

export default StudentSurveyStatusPage
