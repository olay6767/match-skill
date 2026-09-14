import { useEffect, useState, type FormEvent } from 'react'
import { createStaff, getStaff, getStaffAuditHistory, resetStaffPassword, updateStaff, type StaffAccount, type StaffAuditItem, type StaffRole } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import Button from '../../../shared/components/ui/Button'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import './staff.css'

type Props = { adminEmail: string; onLogout: () => void; onNavigate: (item: DashboardNav) => void; onSettings: () => void }
type CreateForm = { fullName: string; email: string; password: string; confirmPassword: string; role: StaffRole }
const emptyForm: CreateForm = { fullName: '', email: '', password: '', confirmPassword: '', role: 'staff' }
const actionLabel: Record<StaffAuditItem['action'], string> = { created: 'สร้างบัญชี', role_changed: 'เปลี่ยน role', enabled: 'เปิดใช้งานบัญชี', disabled: 'ปิดใช้งานบัญชี', password_reset: 'ตั้งรหัสผ่านใหม่' }

function StaffPage({ adminEmail, onLogout, onNavigate, onSettings }: Props) {
  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [history, setHistory] = useState<StaffAuditItem[]>([])
  const [form, setForm] = useState<CreateForm>(emptyForm)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [workingId, setWorkingId] = useState<number | null>(null)
  const [confirmStatusId, setConfirmStatusId] = useState<number | null>(null)
  const [resetFor, setResetFor] = useState<StaffAccount | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')

  const load = () => Promise.all([getStaff(), getStaffAuditHistory()]).then(([nextStaff, nextHistory]) => { setStaff(nextStaff); setHistory(nextHistory) })
  useEffect(() => { load().catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดข้อมูล Staff ได้')).finally(() => setIsLoading(false)) }, [])
  const refresh = () => { setIsLoading(true); setError(''); load().catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดข้อมูล Staff ได้')).finally(() => setIsLoading(false)) }

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault()
    if (form.password !== form.confirmPassword) { setError('การยืนยันรหัสผ่านไม่ตรงกัน'); return }
    setIsCreating(true); setError(''); setNotice('')
    try { await createStaff({ fullName: form.fullName, email: form.email, password: form.password, role: form.role }); setForm(emptyForm); setNotice('สร้างบัญชี Staff เรียบร้อยแล้ว'); refresh() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถสร้างบัญชี Staff ได้') } finally { setIsCreating(false) }
  }

  const saveRole = async (member: StaffAccount, role: StaffRole) => {
    if (role === member.role) return
    setWorkingId(member.id); setError(''); setNotice('')
    try { await updateStaff(member.id, { role }); setNotice('เปลี่ยนสิทธิ์การใช้งานเรียบร้อยแล้ว'); refresh() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถเปลี่ยน role ได้') } finally { setWorkingId(null) }
  }

  const confirmStatus = async (member: StaffAccount) => {
    setWorkingId(member.id); setError(''); setNotice('')
    try { await updateStaff(member.id, { isActive: !member.isActive }); setConfirmStatusId(null); setNotice(`${member.isActive ? 'ปิด' : 'เปิด'}ใช้งานบัญชีเรียบร้อยแล้ว`); refresh() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถเปลี่ยนสถานะบัญชีได้') } finally { setWorkingId(null) }
  }

  const submitReset = async (event: FormEvent) => {
    event.preventDefault()
    if (!resetFor) return
    if (resetPassword !== resetConfirm) { setError('การยืนยันรหัสผ่านไม่ตรงกัน'); return }
    setWorkingId(resetFor.id); setError(''); setNotice('')
    try { const result = await resetStaffPassword(resetFor.id, resetPassword); setResetFor(null); setResetPassword(''); setResetConfirm(''); setNotice(result.message); refresh() }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถตั้งรหัสผ่านใหม่ได้') } finally { setWorkingId(null) }
  }

  return <DashboardLayout activeNav="Staff" adminEmail={adminEmail} onLogout={onLogout} onNavigate={onNavigate} onSettings={onSettings} search="" onSearchChange={() => undefined} notice={notice} onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <div className="staff-page-heading"><div><p className="eyebrow">SUPER ADMIN</p><h1>จัดการบัญชี Staff</h1><p>จัดการสิทธิ์และสถานะบัญชีผู้ดูแลระบบได้จากหน้าเดียว</p></div><Button className="staff-button staff-button--secondary" onClick={refresh}><span aria-hidden="true">↻</span>รีเฟรชข้อมูล</Button></div>
    <section className="staff-panel staff-create-panel" aria-labelledby="staff-create-title"><div className="staff-panel__header"><div><h2 id="staff-create-title">สร้างบัญชี Staff</h2></div></div><form className="staff-create-form" onSubmit={submitCreate}><label>ชื่อ-นามสกุล<input required autoComplete="name" placeholder="ชื่อและนามสกุล" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label><label>อีเมล<input required type="email" autoComplete="email" placeholder="name@organization.ac.th" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><ScrollableSelect label="สิทธิ์การใช้งาน" value={form.role} options={[{ value: 'staff', label: 'Staff' }, { value: 'super_admin', label: 'Super Admin' }]} onChange={(role) => setForm({ ...form, role: role as StaffRole })} /><label>รหัสผ่านใหม่<input required minLength={8} type="password" autoComplete="new-password" placeholder="อย่างน้อย 8 ตัวอักษร" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>ยืนยันรหัสผ่าน<input required minLength={8} type="password" autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label><Button className="staff-button staff-button--primary" type="submit" disabled={isCreating}><span aria-hidden="true">＋</span>{isCreating ? 'กำลังสร้าง...' : 'สร้างบัญชี'}</Button></form>{error && <p className="staff-error" role="alert">{error}</p>}</section>
    {resetFor && <section className="staff-panel staff-reset-panel" aria-labelledby="staff-reset-title"><div className="staff-panel__header"><div><h2 id="staff-reset-title">ตั้งรหัสผ่านใหม่</h2><p>{resetFor.fullName} · {resetFor.email}</p></div><Button className="staff-button staff-button--ghost" onClick={() => { setResetFor(null); setResetPassword(''); setResetConfirm('') }}>ยกเลิก</Button></div><form className="staff-reset-form" onSubmit={submitReset}><label>รหัสผ่านใหม่<input required minLength={8} type="password" autoComplete="new-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></label><label>ยืนยันรหัสผ่าน<input required minLength={8} type="password" autoComplete="new-password" value={resetConfirm} onChange={(event) => setResetConfirm(event.target.value)} /></label><Button className="staff-button staff-button--primary" type="submit" disabled={workingId === resetFor.id}>{workingId === resetFor.id ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}</Button></form></section>}
    <section className="staff-panel" aria-labelledby="staff-list-title"><div className="staff-panel__header"><div><h2 id="staff-list-title">บัญชีผู้ใช้งาน</h2></div><span className="staff-panel__count">{staff.length} บัญชี</span></div>{isLoading ? <div className="dashboard-loading" role="status">กำลังโหลดบัญชี...</div> : staff.length === 0 ? <div className="analytics-empty">ยังไม่มีบัญชี Staff</div> : <div className="staff-table-wrap"><table><thead><tr><th>ชื่อ / อีเมล</th><th>สิทธิ์</th><th>สถานะ</th><th>สร้างเมื่อ</th><th>จัดการ</th></tr></thead><tbody>{staff.map((member) => { const isSelf = member.email === adminEmail; return <tr key={member.id}><td><strong>{member.fullName}</strong><small>{member.email}{isSelf ? ' (บัญชีของคุณ)' : ''}</small></td><td><ScrollableSelect className="staff-role-select" label={`สิทธิ์ของ ${member.email}`} disabled={workingId === member.id} value={member.role} options={[{ value: 'staff', label: 'Staff' }, { value: 'super_admin', label: 'Super Admin' }]} onChange={(role) => void saveRole(member, role as StaffRole)} /></td><td><span className={`staff-status staff-status--${member.isActive ? 'active' : 'disabled'}`}>{member.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}</span></td><td>{new Date(member.createdAt).toLocaleDateString('th-TH')}</td><td><div className="staff-actions"><Button className="staff-button staff-button--secondary staff-button--compact" disabled={workingId === member.id} onClick={() => { setResetFor(member); setResetPassword(''); setResetConfirm(''); setError('') }}>ตั้งรหัสผ่าน</Button>{confirmStatusId === member.id ? <span className="staff-status-confirm">{member.isActive ? 'ยืนยันปิดบัญชี?' : 'ยืนยันเปิดบัญชี?'}<Button className={`staff-button staff-button--compact ${member.isActive ? 'staff-button--danger' : 'staff-button--success'}`} disabled={workingId === member.id} onClick={() => void confirmStatus(member)}>ยืนยัน</Button><Button className="staff-button staff-button--ghost staff-button--compact" disabled={workingId === member.id} onClick={() => setConfirmStatusId(null)}>ยกเลิก</Button></span> : <Button className={`staff-button staff-button--compact ${member.isActive ? 'staff-button--danger' : 'staff-button--success'}`} disabled={workingId === member.id || (isSelf && member.isActive)} title={isSelf && member.isActive ? 'ไม่สามารถปิดใช้งานบัญชีที่กำลังใช้อยู่' : undefined} onClick={() => setConfirmStatusId(member.id)}>{member.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</Button>}</div></td></tr> })}</tbody></table></div>}</section>
    <section className="staff-panel" aria-labelledby="staff-audit-title"><div className="staff-panel__header"><div><h2 id="staff-audit-title">ประวัติการจัดการล่าสุด</h2></div><span className="staff-panel__count">{history.length} รายการ</span></div>{isLoading ? <div className="dashboard-loading" role="status">กำลังโหลด audit log...</div> : history.length === 0 ? <div className="analytics-empty">ยังไม่มีประวัติการจัดการ</div> : <ul className="staff-audit-list">{history.map((item) => <li key={item.id}><div><strong>{actionLabel[item.action]}</strong><span>{item.actorEmail} → {item.targetEmail}</span></div><time>{new Date(item.createdAt).toLocaleString('th-TH')}</time></li>)}</ul>}</section>
  </DashboardLayout>
}

export default StaffPage
