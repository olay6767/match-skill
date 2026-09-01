import { useCallback, useEffect, useState } from 'react'
import { deleteActivity, getActivity, getActivityQr, updateActivityPhase } from '../../../lib/api'
import type { Activity, ActivityQrData } from '../dashboard/types'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import ActivityOverview from './ActivityOverview'
import ActivityQrPanel from './ActivityQrPanel'

type Phase = 'pre' | 'post'
type Props = { activityId: number; adminEmail: string; canDelete: boolean; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onRouteNavigate: (path: string) => void; onSettings: () => void }
type CloseAtDraft = Record<Phase, string>
const emptyQr: ActivityQrData = { qrCodes: [], stats: { preCount: 0, postCount: 0, pairedCount: 0 } }

function toDateTimeLocal(value: string | null) {
  return value ? value.slice(0, 16) : ''
}

function minCloseAt() {
  const value = new Date()
  value.setMinutes(value.getMinutes() + 1, 0, 0)
  const pad = (part: number) => String(part).padStart(2, '0')
  return value.getFullYear() + '-' + pad(value.getMonth() + 1) + '-' + pad(value.getDate()) + 'T' + pad(value.getHours()) + ':' + pad(value.getMinutes())
}

function formatCloseAt(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function isExpired(value: string | null) {
  return Boolean(value && new Date(value).getTime() <= Date.now())
}

function PhaseControl({ phase, activity, closeAt, phaseWorking, onToggle, onDraftChange, onSaveClose, onClearClose }: {
  phase: Phase
  activity: Activity
  closeAt: string
  phaseWorking: Phase | null
  onToggle: (phase: Phase) => void
  onDraftChange: (phase: Phase, value: string) => void
  onSaveClose: (phase: Phase) => void
  onClearClose: (phase: Phase) => void
}) {
  const label = phase === 'pre' ? 'Pre-test' : 'Post-test'
  const enabled = phase === 'pre' ? activity.preTestEnabled : activity.postTestEnabled
  const savedCloseAt = phase === 'pre' ? activity.preCloseAt : activity.postCloseAt
  const expired = isExpired(savedCloseAt)
  const open = enabled && !expired
  const disabled = phaseWorking !== null || activity.status === 'archived'
  const status = open ? 'เปิด' : expired ? 'ปิด (หมดเวลาที่ตั้งไว้)' : 'ปิด'

  return <article className={open ? 'activity-phase-control activity-phase-control--open' : 'activity-phase-control'}>
    <div className="activity-phase-control__top">
      <div><strong>{label}</strong><span className={open ? 'activity-phase-status activity-phase-status--open' : 'activity-phase-status'}>สถานะ: {status}</span></div>
      <Button aria-pressed={open} disabled={disabled} onClick={() => onToggle(phase)}>{phaseWorking === phase ? 'กำลังบันทึก...' : open ? 'ปิด ' + label : 'เปิด ' + label}</Button>
    </div>
    <label className="activity-phase-close-field">
      <span>ปิดอัตโนมัติเมื่อ</span>
      <input type="datetime-local" value={closeAt} min={minCloseAt()} disabled={disabled} onChange={(event) => onDraftChange(phase, event.target.value)} />
    </label>
    <div className="activity-phase-close-actions">
      <Button disabled={disabled || !closeAt} onClick={() => onSaveClose(phase)}>{phaseWorking === phase ? 'กำลังบันทึก...' : 'บันทึกเวลาปิด'}</Button>
      {savedCloseAt && <Button disabled={disabled} onClick={() => onClearClose(phase)}>ยกเลิกเวลาปิด</Button>}
    </div>
    <span className={expired ? 'activity-phase-close-note activity-phase-close-note--expired' : 'activity-phase-close-note'}>{savedCloseAt ? expired ? 'หมดเวลาปิดอัตโนมัติแล้ว' : 'ตั้งให้ปิด: ' + formatCloseAt(savedCloseAt) : 'ยังไม่ตั้งเวลาปิดอัตโนมัติ'}</span>
  </article>
}

function ActivityDetailPage({ activityId, adminEmail, canDelete, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [activity, setActivity] = useState<Activity | null>(null)
  const [qrData, setQrData] = useState<ActivityQrData>(emptyQr)
  const [closeAtDraft, setCloseAtDraft] = useState<CloseAtDraft>({ pre: '', post: '' })
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [phaseWorking, setPhaseWorking] = useState<Phase | null>(null)

  const load = useCallback(() => {
    Promise.all([getActivity(activityId), getActivityQr(activityId)])
      .then(([nextActivity, nextQr]) => {
        setActivity(nextActivity)
        setQrData(nextQr)
        setCloseAtDraft({ pre: toDateTimeLocal(nextActivity.preCloseAt), post: toDateTimeLocal(nextActivity.postCloseAt) })
      })
      .catch((error) => setNotice(error instanceof Error ? error.message : 'โหลดรายละเอียดไม่ได้'))
      .finally(() => setLoading(false))
  }, [activityId])

  useEffect(load, [load])

  const togglePhase = async (phase: Phase) => {
    if (!activity) return
    const enabled = phase === 'pre' ? activity.preTestEnabled : activity.postTestEnabled
    const savedCloseAt = phase === 'pre' ? activity.preCloseAt : activity.postCloseAt
    const open = enabled && !isExpired(savedCloseAt)
    setPhaseWorking(phase)
    try {
      const nextActivity = await updateActivityPhase(activity.id, phase, isExpired(savedCloseAt) ? { enabled: !open, closeAt: null } : { enabled: !open })
      setActivity(nextActivity)
      setCloseAtDraft({ pre: toDateTimeLocal(nextActivity.preCloseAt), post: toDateTimeLocal(nextActivity.postCloseAt) })
      setNotice((open ? 'ปิด ' : 'เปิด ') + (phase === 'pre' ? 'Pre-test' : 'Post-test') + ' แล้ว')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถเปลี่ยนสถานะแบบทดสอบได้')
    } finally {
      setPhaseWorking(null)
    }
  }

  const saveCloseAt = async (phase: Phase, closeAt: string | null) => {
    if (!activity) return
    setPhaseWorking(phase)
    try {
      const nextActivity = await updateActivityPhase(activity.id, phase, { closeAt })
      setActivity(nextActivity)
      setCloseAtDraft({ pre: toDateTimeLocal(nextActivity.preCloseAt), post: toDateTimeLocal(nextActivity.postCloseAt) })
      setNotice(closeAt ? 'ตั้งเวลาปิด ' + (phase === 'pre' ? 'Pre-test' : 'Post-test') + ' แล้ว' : 'ยกเลิกเวลาปิด ' + (phase === 'pre' ? 'Pre-test' : 'Post-test') + ' แล้ว')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถบันทึกเวลาปิดได้')
    } finally {
      setPhaseWorking(null)
    }
  }

  const removeActivity = async () => {
    if (!activity || !window.confirm('ลบกิจกรรม “' + activity.name + '” อย่างถาวรใช่หรือไม่?\n\nการดำเนินการนี้ย้อนกลับไม่ได้ และจะลบคำตอบแบบประเมิน, QR Code และประวัติของกิจกรรมนี้ด้วย (ข้อมูลนักศึกษาจะยังคงอยู่)')) return
    setIsDeleting(true)
    try {
      await deleteActivity(activity.id)
      onRouteNavigate('/admin/activities')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถลบกิจกรรมได้')
      setIsDeleting(false)
    }
  }

  return <DashboardLayout activeNav="Activities" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    {loading ? <div className="dashboard-loading" role="status">กำลังโหลดรายละเอียดกิจกรรม...</div> : !activity ? <div className="empty-state">ไม่พบกิจกรรม</div> : <>
      <div className="activity-detail-actions"><Button onClick={() => onRouteNavigate('/admin/activities')}>← กลับรายการ</Button><div><Button className="participant-button" onClick={() => onRouteNavigate('/admin/participants?activityId=' + activity.id)}>ดูผู้เข้าร่วม</Button><Button disabled={activity.status === 'archived'} onClick={() => onRouteNavigate('/admin/activities/' + activity.id + '/edit')}>แก้ไขกิจกรรม</Button><Button onClick={() => onRouteNavigate('/admin/analytics?activityId=' + activity.id)}>Analytics</Button>{canDelete && <Button className="danger-button" disabled={isDeleting} onClick={removeActivity}>{isDeleting ? 'กำลังลบ...' : 'ลบถาวร'}</Button>}</div></div>
      <ActivityOverview activity={activity} stats={qrData.stats} />
      <section className="activity-phase-controls panel" aria-label="จัดการการเปิดแบบทดสอบ">
        <div className="activity-phase-controls__heading"><h2>เปิด–ปิดแบบทดสอบ</h2><p>ควบคุม Pre-test และ Post-test แยกกันได้ และตั้งเวลาปิดอัตโนมัติได้</p></div>
        <div className="activity-phase-controls__grid">
          <PhaseControl phase="pre" activity={activity} closeAt={closeAtDraft.pre} phaseWorking={phaseWorking} onToggle={(phase) => void togglePhase(phase)} onDraftChange={(phase, value) => setCloseAtDraft((current) => ({ ...current, [phase]: value }))} onSaveClose={(phase) => void saveCloseAt(phase, closeAtDraft[phase])} onClearClose={(phase) => void saveCloseAt(phase, null)} />
          <PhaseControl phase="post" activity={activity} closeAt={closeAtDraft.post} phaseWorking={phaseWorking} onToggle={(phase) => void togglePhase(phase)} onDraftChange={(phase, value) => setCloseAtDraft((current) => ({ ...current, [phase]: value }))} onSaveClose={(phase) => void saveCloseAt(phase, closeAtDraft[phase])} onClearClose={(phase) => void saveCloseAt(phase, null)} />
        </div>
      </section>
      <ActivityQrPanel activityId={activity.id} qrCodes={qrData.qrCodes} onChanged={load} />
    </>}
  </DashboardLayout>
}

export default ActivityDetailPage
