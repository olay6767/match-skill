import { useState, type FormEvent } from 'react'
import '../App.css'

type AdminLoginProps = {
  onLogin: (email: string) => void
}

type FormErrors = {
  email?: string
  password?: string
}

const DEMO_ADMIN_EMAIL = 'admin@matchskill.com'
const DEMO_ADMIN_PASSWORD = 'admin1234'

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

  const validate = () => {
    const nextErrors: FormErrors = {}
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      nextErrors.email = 'กรุณากรอกอีเมลผู้ดูแลระบบ'
    } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      nextErrors.email = 'รูปแบบอีเมลยังไม่ถูกต้อง'
    } else if (normalizedEmail.toLowerCase() !== DEMO_ADMIN_EMAIL) {
      nextErrors.email = 'อีเมลนี้ไม่มีสิทธิ์ผู้ดูแลระบบ'
    }

    if (!password) {
      nextErrors.password = 'กรุณากรอกรหัสผ่านผู้ดูแลระบบ'
    } else if (password !== DEMO_ADMIN_PASSWORD) {
      nextErrors.password = 'รหัสผ่านผู้ดูแลระบบไม่ถูกต้อง'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const normalizedEmail = email.trim()
    setNotice('')
    if (rememberMe) {
      window.localStorage.setItem('matchskill-admin-email', normalizedEmail)
    } else {
      window.localStorage.removeItem('matchskill-admin-email')
    }
    onLogin(normalizedEmail)
  }

  return (
    <main className="admin-shell">
      <section className="admin-card" aria-label="SEDA Skill Analytics admin portal">
        <header className="admin-header">
          <a className="seda-logo" href="#" aria-label="SEDA home">
            <img src="/seda-logo.png" alt="SEDA" />
          </a>
          <h1>Skill Analytics</h1>
          <p>Admin Portal Management</p>
        </header>

        <div className="admin-body">
          <form className="admin-form" onSubmit={handleSubmit} noValidate>
            <div className="field-group">
              <label htmlFor="email">Username / Email</label>
              <div className="input-wrap">
                <span className="field-icon field-icon--user" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (errors.email) setErrors({ ...errors, email: undefined })
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
              </div>
              {errors.email && <p className="field-error" id="email-error">{errors.email}</p>}
            </div>

            <div className="field-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrap">
                <span className="field-icon field-icon--lock" aria-hidden="true" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (errors.password) setErrors({ ...errors, password: undefined })
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                <button
                  className="show-password"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="field-icon field-icon--eye" aria-hidden="true" />
                </button>
              </div>
              {errors.password && <p className="field-error" id="password-error">{errors.password}</p>}
            </div>

            <div className="form-options">
              <label className="remember-row">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                />
                <span>Remember Me</span>
              </label>
              <button
                className="forgot-link"
                type="button"
                onClick={() => setNotice('การรีเซ็ตรหัสผ่านจะเปิดใช้เมื่อเชื่อมระบบบัญชีจริง')}
              >
                ลืมรหัสผ่าน
              </button>
            </div>

            <button className="login-button" type="submit">
              เข้าสู่ระบบ <span aria-hidden="true">↪</span>
            </button>

            {notice && <p className="form-notice" role="status">{notice}</p>}

            <div className="secure-note">
              <span className="shield-icon" aria-hidden="true">♢</span>
              SECURE CONNECTION ACTIVE
            </div>

            <p className="demo-note">
              บัญชีทดลอง: <strong>{DEMO_ADMIN_EMAIL}</strong> /{' '}
              <strong>{DEMO_ADMIN_PASSWORD}</strong>
            </p>
          </form>
        </div>

        <footer className="admin-footer">
          <p>© 2024 Skill Analytics. All rights reserved.</p>
          <nav aria-label="Footer links">
            <a href="#privacy">Privacy Policy</a>
            <a href="#terms">Terms of Service</a>
          </nav>
        </footer>
      </section>
    </main>
  )
}

export default AdminLogin
