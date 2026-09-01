import { useState } from 'react'
import { generateActivityQr, regenerateActivityQr } from '../../../lib/api'
import type { ActivityQr } from '../dashboard/types'
import Button from '../../../shared/components/ui/Button'

type Props = { activityId: number; qrCodes: ActivityQr[]; onChanged: () => void }

function ActivityQrPanel({ activityId, qrCodes, onChanged }: Props) {
  const [message, setMessage] = useState('')
  const [working, setWorking] = useState('')
  const activeFor = (phase: 'pre' | 'post') => qrCodes.find((qr) => qr.phase === phase && qr.active)
  const act = async (phase: 'pre' | 'post', current?: ActivityQr) => {
    setWorking(phase); setMessage('')
    try { if (current) await regenerateActivityQr(activityId, current.id); else await generateActivityQr(activityId, phase); onChanged(); setMessage(current ? `สร้าง ${phase} QR ใหม่และยกเลิก token เดิมแล้ว` : `สร้าง ${phase} QR แล้ว`) }
    catch (error) { setMessage(error instanceof Error ? error.message : 'ไม่สามารถสร้าง QR ได้') } finally { setWorking('') }
  }
  const copy = async (url: string) => { try { await navigator.clipboard.writeText(url); setMessage('คัดลอกลิงก์แล้ว') } catch { setMessage('ไม่สามารถคัดลอกลิงก์ได้') } }
  return <section className="qr-section panel"><div className="panel-heading"><h2>QR Codes</h2></div><div className="qr-grid">{(['pre', 'post'] as const).map((phase) => { const qr = activeFor(phase); const qrImageUrl = qr ? `/api/activities/${activityId}/qr/${qr.id}/png?target=${encodeURIComponent(qr.url)}` : ''; return <article className="qr-card" key={phase}><h3>{phase === 'pre' ? 'Pre-test' : 'Post-test'}</h3>{qr ? <><img src={qrImageUrl} alt={`QR Code สำหรับ ${phase}`} /><p>{qr.url}</p><div><Button onClick={() => copy(qr.url)}>Copy Link</Button><a href={qrImageUrl} download>Download PNG</a><Button disabled={working === phase} onClick={() => act(phase, qr)}>Regenerate</Button></div></> : <div className="qr-empty"><p>ยังไม่มี QR Code</p><Button disabled={working === phase} onClick={() => act(phase)}>Generate</Button></div>}</article> })}</div>{message && <p className="qr-message" role="status">{message}</p>}
    <div className="qr-history"><h3>ประวัติ Token</h3>{qrCodes.length === 0 ? <p>ยังไม่มีประวัติ</p> : <ul>{qrCodes.map((qr) => <li key={qr.id}><strong>{qr.phase.toUpperCase()}</strong><span>{new Date(qr.createdAt).toLocaleString('th-TH')}</span><span>{qr.active ? 'ใช้งานอยู่' : `ยกเลิก ${qr.revokedAt ? new Date(qr.revokedAt).toLocaleString('th-TH') : ''}`}</span></li>)}</ul>}</div>
  </section>
}

export default ActivityQrPanel
