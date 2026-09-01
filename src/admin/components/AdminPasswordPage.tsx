import { useState, type FormEvent } from 'react'
import { changePassword, requestPasswordReset, resetPassword } from '../../lib/api'
import Button from '../../shared/components/ui/Button'
import Card from '../../shared/components/ui/Card'
import TextField from '../../shared/components/ui/TextField'
import '../styles/App.css'

type AdminPasswordPageProps = {
  mode: 'forgot' | 'reset' | 'change'
  onNavigate: (path: string) => void
  onPasswordChanged?: () => void
}

type FormErrors = {
  email?: string
  currentPassword?: string
  password?: string
  confirmPassword?: string
  token?: string
}

function AdminPasswordPage({ mode, onNavigate, onPasswordChanged }: AdminPasswordPageProps) {
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [resetUrl, setResetUrl] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token') ?? ''

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice('')
    const nextErrors: FormErrors = {}
    if (mode === 'forgot') {
      const normalizedEmail = email.trim()
      if (!normalizedEmail) nextErrors.email = 'กรุณากรอกอีเมลผู้ดูแลระบบ'
      else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) nextErrors.email = 'รูปแบบอีเมลยังไม่ถูกต้อง'
    }
    if (mode === 'change' && !currentPassword) {
      nextErrors.currentPassword = 'กรุณากรอกรหัสผ่านปัจจุบัน'
    }
    if (mode !== 'forgot' && password.length < 8) nextErrors.password = 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร'
    if (mode !== 'forgot' && password !== confirmPassword) nextErrors.confirmPassword = 'รหัสผ่านใหม่และการยืนยันไม่ตรงกัน'
    if (mode === 'reset' && !token) {
      nextErrors.token = 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง กรุณาขอลิงก์ใหม่'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setNotice(nextErrors.token ?? 'กรุณาตรวจสอบข้อมูลที่กรอก')
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'forgot') {
        const result = await requestPasswordReset(email.trim())
        setNotice(result.message)
        setResetUrl(result.resetUrl ?? '')
        setIsComplete(true)
      } else if (mode === 'reset') {
        const result = await resetPassword(token, password)
        setNotice(result.message)
        setPassword('')
        setConfirmPassword('')
        setIsComplete(true)
      } else {
        const result = await changePassword(currentPassword, password)
        setNotice(result.message)
        onPasswordChanged?.()
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถดำเนินการได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  const title = mode === 'forgot' ? 'ลืมรหัสผ่าน' : mode === 'reset' ? 'ตั้งรหัสผ่านใหม่' : 'เปลี่ยนรหัสผ่าน'
  return (
    <main className="admin-shell">
      <Card as="section" className="admin-card password-card" aria-labelledby="password-page-title">
        <header className="admin-header">
          <img className="password-logo" src="/seda-logo.png" alt="SEDA" />
          <h1 id="password-page-title">{title}</h1>
          <p>{mode === 'forgot' ? 'กรอกอีเมลของบัญชีผู้ดูแลระบบ' : 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร'}</p>
        </header>
        <div className="admin-body">
          <form className="admin-form" onSubmit={handleSubmit} noValidate>
            {!isComplete && mode === 'forgot' && <TextField id="reset-email" label="อีเมลผู้ดูแล" name="email" type="email" autoComplete="email" placeholder="กรอกอีเมลผู้ดูแล" required value={email} error={errors.email} onChange={(event) => { setEmail(event.target.value); setErrors((current) => ({ ...current, email: undefined })) }} />}
            {!isComplete && mode === 'change' && <TextField id="current-password" label="รหัสผ่านปัจจุบัน" name="currentPassword" type="password" autoComplete="current-password" required value={currentPassword} error={errors.currentPassword} onChange={(event) => { setCurrentPassword(event.target.value); setErrors((current) => ({ ...current, currentPassword: undefined })) }} />}
            {!isComplete && mode !== 'forgot' && <TextField id="new-password" label="รหัสผ่านใหม่" name="password" type="password" autoComplete="new-password" minLength={8} required value={password} error={errors.password} onChange={(event) => { setPassword(event.target.value); setErrors((current) => ({ ...current, password: undefined })) }} />}
            {!isComplete && mode !== 'forgot' && <TextField id="confirm-password" label="ยืนยันรหัสผ่านใหม่" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} error={errors.confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setErrors((current) => ({ ...current, confirmPassword: undefined })) }} />}
            {!isComplete && <Button className="login-button" type="submit" disabled={isSubmitting}>{isSubmitting ? 'กำลังดำเนินการ...' : mode === 'forgot' ? 'ส่งลิงก์ตั้งรหัสผ่าน' : title}</Button>}
            {notice && <p className="form-notice" role={Object.keys(errors).length > 0 ? 'alert' : 'status'} aria-live="polite">{notice}</p>}
            {resetUrl && <a className="development-reset-link" href={resetUrl}>เปิดลิงก์ตั้งรหัสผ่านสำหรับ Development</a>}
            <Button className="forgot-link back-to-login" onClick={() => onNavigate(mode === 'change' ? '/admin/dashboard' : '/admin/login')}>{mode === 'change' ? 'กลับหน้าภาพรวม' : 'กลับหน้าเข้าสู่ระบบ'}</Button>
          </form>
        </div>
      </Card>
    </main>
  )
}

export default AdminPasswordPage
