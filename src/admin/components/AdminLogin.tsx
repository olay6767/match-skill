import { useState, type FormEvent } from 'react'
import Button from '../../shared/components/ui/Button'
import '../styles/App.css'

type AdminLoginProps = {
  onLogin: (email: string, password: string, remember: boolean) => Promise<void>
}

type FormErrors = {
  email?: string
  password?: string
}

function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState(
    () => window.localStorage.getItem('matchskill-admin-email') ?? '',
  )
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(
    () => Boolean(window.localStorage.getItem('matchskill-admin-email')),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [notice, setNotice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const nextErrors: FormErrors = {}
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      nextErrors.email = 'กรุณากรอกอีเมลผู้ดูแลระบบ'
    } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      nextErrors.email = 'รูปแบบอีเมลยังไม่ถูกต้อง'
    }

    if (!password) {
      nextErrors.password = 'กรุณากรอกรหัสผ่านผู้ดูแลระบบ'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const normalizedEmail = email.trim()
    setNotice('')
    setIsSubmitting(true)
    try {
      await onLogin(normalizedEmail, password, rememberMe)
      if (rememberMe) {
        window.localStorage.setItem('matchskill-admin-email', normalizedEmail)
      } else {
        window.localStorage.removeItem('matchskill-admin-email')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'ไม่สามารถเข้าสู่ระบบได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-v2-shell">
      <section className="admin-login-v2" aria-label="หน้าเข้าสู่ระบบผู้ดูแล SEDA">
        <section className="admin-login-v2-panel" aria-labelledby="admin-login-title">
          <header className="admin-login-v2-header">
            <span>สำหรับผู้ดูแลระบบ</span>
            <h2 id="admin-login-title">ยินดีต้อนรับกลับมา</h2>
            <p>เข้าสู่ระบบเพื่อจัดการกิจกรรมและผลการประเมิน</p>
          </header>

          <form className="admin-login-v2-form" onSubmit={handleSubmit} noValidate>
            <label className="admin-login-v2-field" htmlFor="admin-email">
              <span>อีเมลผู้ดูแล</span>
              <input id="admin-email" name="email" type="email" autoComplete="username" placeholder="name@example.com" value={email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'admin-email-error' : undefined} onChange={(event) => { setEmail(event.target.value); if (errors.email) setErrors({ ...errors, email: undefined }) }} />
              {errors.email && <small id="admin-email-error">{errors.email}</small>}
            </label>

            <label className="admin-login-v2-field" htmlFor="admin-password">
              <span>รหัสผ่าน</span>
              <div className="admin-login-v2-password">
                <input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" value={password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? 'admin-password-error' : undefined} onChange={(event) => { setPassword(event.target.value); if (errors.password) setErrors({ ...errors, password: undefined }) }} />
                <Button className="admin-login-v2-show" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'ซ่อน' : 'แสดง'}</Button>
              </div>
              {errors.password && <small id="admin-password-error">{errors.password}</small>}
            </label>

            <div className="admin-login-v2-options">
              <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>จดจำอีเมลนี้</span></label>
            </div>

            <Button className="admin-login-v2-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</Button>
            {notice && <p className="admin-login-v2-notice" role="alert" aria-live="polite">{notice}</p>}

            <div className="admin-login-v2-security"><i aria-hidden="true">✓</i><span><strong>ระบบรักษาความปลอดภัย</strong><small>ข้อมูลเข้าสู่ระบบถูกส่งผ่านการเชื่อมต่อที่เข้ารหัส</small></span></div>
          </form>

          <footer className="admin-login-v2-footer"><p>© 2026 SEDA Skill Analytics</p></footer>
        </section>
      </section>
    </main>
  )
}

export default AdminLogin
