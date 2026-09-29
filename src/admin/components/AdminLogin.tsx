import { useState, type FormEvent } from "react"
import Button from "../../shared/components/ui/Button"
import adminCover from "../../assets/8.png"
import "../styles/App.css"
import "./adminLogin.css"

type AdminLoginProps = {
  onLogin: (email: string, password: string, remember: boolean) => Promise<void>
}

type FormErrors = {
  email?: string
  password?: string
}

function MailIcon() {
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3.25" y="5.25" width="17.5" height="13.5" rx="3" /><path d="m4.5 7 7.5 5.5L19.5 7" /></svg>
}

function LockIcon() {
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4.5" y="10" width="15" height="10" rx="3" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /><path d="M12 14v2.5" /></svg>
}

function EyeIcon({ visible }: { visible: boolean }) {
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.8 12s3.2-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.2 5.2-9.2 5.2S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.5" />{!visible && <path d="m4 4 16 16" />}</svg>
}

function ArrowIcon() {
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M14 7l5 5-5 5" /></svg>
}

function LoadingIcon() {
  return <svg className="admin-login-icon admin-login-icon--loading" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" /></svg>
}

function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState(
    () => window.localStorage.getItem("matchskill-admin-email") ?? "",
  )
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(
    () => Boolean(window.localStorage.getItem("matchskill-admin-email")),
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [notice, setNotice] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = () => {
    const nextErrors: FormErrors = {}
    const normalizedEmail = email.trim()

    if (!normalizedEmail) {
      nextErrors.email = "กรุณากรอกอีเมลผู้ดูแลระบบ"
    } else if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      nextErrors.email = "รูปแบบอีเมลยังไม่ถูกต้อง"
    }

    if (!password) nextErrors.password = "กรุณากรอกรหัสผ่านผู้ดูแลระบบ"

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    const normalizedEmail = email.trim()
    setNotice("")
    setIsSubmitting(true)
    try {
      await onLogin(normalizedEmail, password, rememberMe)
      if (rememberMe) {
        window.localStorage.setItem("matchskill-admin-email", normalizedEmail)
      } else {
        window.localStorage.removeItem("matchskill-admin-email")
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ไม่สามารถเข้าสู่ระบบได้")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-card" aria-label="หน้าเข้าสู่ระบบผู้ดูแล SEDA">
        <aside className="admin-login-media" aria-label="มหาวิทยาลัยเทคโนโลยีสุรนารี">
          <img src={adminCover} alt="มหาวิทยาลัยเทคโนโลยีสุรนารี" />
        </aside>

        <span className="admin-login-flowers" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
        </span>

        <section className="admin-login-panel" aria-labelledby="admin-login-title">
          <div className="admin-login-sut-logo" role="img" aria-label="SEDA" />

          <header className="admin-login-header">
            <h1 id="admin-login-title">Welcome back</h1>
            <strong>Sign in to SUT Admin Portal</strong>
            <p>ระบบบริหารจัดการมหาวิทยาลัยเทคโนโลยีสุรนารี</p>
          </header>

          <form className="admin-login-form" onSubmit={handleSubmit} noValidate>
            <div className="admin-login-field">
              <label htmlFor="admin-email">อีเมลผู้ดูแลระบบ</label>
              <div className="admin-login-control">
                <MailIcon />
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoFocus
                  placeholder="Username or Email"
                  value={email}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "admin-email-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (errors.email) setErrors({ ...errors, email: undefined })
                  }}
                />
              </div>
              {errors.email && <small id="admin-email-error">{errors.email}</small>}
            </div>

            <div className="admin-login-field">
              <label htmlFor="admin-password">รหัสผ่าน</label>
              <div className="admin-login-control admin-login-control--password">
                <LockIcon />
                <input
                  id="admin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "admin-password-error" : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (errors.password) setErrors({ ...errors, password: undefined })
                  }}
                />
                <Button
                  className="admin-login-show-password"
                  type="button"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((current) => !current)}
                >
                  <EyeIcon visible={showPassword} />
                </Button>
              </div>
              {errors.password && <small id="admin-password-error">{errors.password}</small>}
            </div>

            <label className="admin-login-remember">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} />
              <span>Remember me</span>
            </label>

            <Button className="admin-login-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><LoadingIcon /> Signing in...</> : <>Sign in <ArrowIcon /></>}
            </Button>

            {notice && <p className="admin-login-notice" role="alert" aria-live="polite">{notice}</p>}
          </form>

          <footer className="admin-login-footer">หากพบปัญหาในการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ</footer>
        </section>
      </section>
    </main>
  )
}

export default AdminLogin
