import { useState, type FormEvent } from "react"
import Button from "../../shared/components/ui/Button"
import adminPortalLogo from "../../assets/93.png"
import adminMascot from "../../assets/677.png"
import "../styles/App.css"
import "./adminLoginRefresh.css"

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
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2.8 12s3.2-5.2 9.2-5.2 9.2 5.2 9.2 5.2-3.2 5.2-9.2 5.2S2.8 12 2.8 12Z" /><circle cx="12" cy="12" r="2.5" />{!visible && <path className="admin-login-eye-slash" d="m4 4 16 16" />}</svg>
}

function ArrowIcon() {
  return <svg className="admin-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M14 7l5 5-5 5" /></svg>
}

function LoadingIcon() {
  return <svg className="admin-login-icon admin-login-icon--loading" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" /></svg>
}

function AdminIllustration() {
  return (
    <div className="admin-login-illustration-stage" aria-hidden="true">
      <svg className="admin-login-illustration" viewBox="0 0 520 360" focusable="false">
      <defs>
        <linearGradient id="admin-platform-top" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#fff8f1" /><stop offset="1" stopColor="#ffd1ab" /></linearGradient>
        <linearGradient id="admin-platform-side" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ef8b45" /><stop offset="1" stopColor="#d96217" /></linearGradient>
        <linearGradient id="admin-screen-head" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#ef6816" /><stop offset="1" stopColor="#ff9a4c" /></linearGradient>
        <linearGradient id="admin-bar" x1="0" y1="1" x2="0" y2="0"><stop stopColor="#f06b19" /><stop offset="1" stopColor="#ffb77d" /></linearGradient>
        <filter id="admin-soft-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="13" stdDeviation="12" floodColor="#9b4b1c" floodOpacity=".18" /></filter>
      </defs>

      <ellipse className="admin-login-illustration__shadow" cx="260" cy="314" rx="182" ry="27" fill="#a54b18" opacity=".16" />
      <path d="M78 263v38c0 22 81 41 182 41s182-19 182-41v-38Z" fill="url(#admin-platform-side)" />
      <ellipse className="admin-login-illustration__platform-top" cx="260" cy="263" rx="182" ry="46" fill="url(#admin-platform-top)" />
      <ellipse className="admin-login-illustration__platform-glow" cx="260" cy="263" rx="153" ry="32" fill="#fff" opacity=".24" />
      <ellipse className="admin-login-illustration__platform-ring" cx="260" cy="255" rx="112" ry="25" fill="none" stroke="#fff" strokeWidth="2" opacity=".5" />

      <g className="admin-login-illustration__screen" filter="url(#admin-soft-shadow)">
        <rect x="137" y="52" width="258" height="188" rx="22" fill="#fff" />
        <path d="M159 52h214a22 22 0 0 1 22 22v19H137V74a22 22 0 0 1 22-22Z" fill="url(#admin-screen-head)" />
        <circle cx="160" cy="73" r="4" fill="#fff" opacity=".9" />
        <circle cx="174" cy="73" r="4" fill="#fff" opacity=".6" />
        <circle cx="188" cy="73" r="4" fill="#fff" opacity=".38" />
        <rect x="316" y="68" width="56" height="10" rx="5" fill="#fff" opacity=".5" />

        <rect x="157" y="111" width="88" height="46" rx="11" fill="#fff4e9" />
        <circle cx="174" cy="128" r="7" fill="#f47c2b" opacity=".9" />
        <rect x="188" y="121" width="36" height="6" rx="3" fill="#30445f" opacity=".78" />
        <rect x="188" y="133" width="27" height="5" rx="2.5" fill="#95a0af" opacity=".55" />

        <rect x="255" y="111" width="120" height="46" rx="11" fill="#f6f8fb" />
        <rect x="270" y="123" width="41" height="6" rx="3" fill="#30445f" opacity=".76" />
        <rect x="270" y="135" width="77" height="5" rx="2.5" fill="#a8b0ba" opacity=".55" />
        <circle cx="356" cy="134" r="10" fill="#e5f5ec" />
        <path d="m351 134 3 3 6-7" fill="none" stroke="#2f9368" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />

        <path className="admin-login-illustration__chart-line" d="M158 205c22-9 31-30 51-24s24 17 43 3 30-7 44-20 30-5 50-26" fill="none" stroke="#ef6e1b" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M158 212h197" fill="none" stroke="#e9edf1" strokeWidth="2" strokeLinecap="round" />
        <g className="admin-login-illustration__bars">
          <rect x="166" y="190" width="12" height="22" rx="4" fill="url(#admin-bar)" opacity=".45" />
          <rect x="187" y="177" width="12" height="35" rx="4" fill="url(#admin-bar)" opacity=".55" />
          <rect x="208" y="184" width="12" height="28" rx="4" fill="url(#admin-bar)" opacity=".48" />
          <rect x="229" y="166" width="12" height="46" rx="4" fill="url(#admin-bar)" opacity=".66" />
          <rect x="250" y="172" width="12" height="40" rx="4" fill="url(#admin-bar)" opacity=".6" />
          <rect x="271" y="153" width="12" height="59" rx="4" fill="url(#admin-bar)" opacity=".76" />
          <rect x="292" y="160" width="12" height="52" rx="4" fill="url(#admin-bar)" opacity=".7" />
          <rect x="313" y="141" width="12" height="71" rx="4" fill="url(#admin-bar)" opacity=".88" />
          <rect x="334" y="128" width="12" height="84" rx="4" fill="url(#admin-bar)" />
        </g>
      </g>

      <g className="admin-login-illustration__card admin-login-illustration__card--left" filter="url(#admin-soft-shadow)">
        <rect x="79" y="126" width="88" height="72" rx="17" fill="#fff" />
        <circle cx="106" cy="151" r="11" fill="#fff0e3" />
        <circle cx="106" cy="148" r="4" fill="#ed6b19" />
        <path d="M98 160c2-7 14-7 16 0" fill="none" stroke="#ed6b19" strokeWidth="3" strokeLinecap="round" />
        <rect x="126" y="143" width="25" height="6" rx="3" fill="#354861" opacity=".76" />
        <rect x="126" y="156" width="18" height="5" rx="2.5" fill="#9ca5b0" opacity=".6" />
        <rect x="96" y="177" width="54" height="6" rx="3" fill="#f2b98f" opacity=".65" />
      </g>

      <g className="admin-login-illustration__card admin-login-illustration__card--right" filter="url(#admin-soft-shadow)">
        <rect x="370" y="139" width="78" height="78" rx="18" fill="#fff" />
        <circle cx="409" cy="165" r="15" fill="#e9f7ef" />
        <path d="m401 165 6 6 11-14" fill="none" stroke="#2b9567" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="389" y="190" width="40" height="6" rx="3" fill="#f2b487" opacity=".72" />
      </g>

      <circle className="admin-login-illustration__spark admin-login-illustration__spark--one" cx="101" cy="91" r="7" fill="#fff" opacity=".8" />
      <circle className="admin-login-illustration__spark admin-login-illustration__spark--two" cx="427" cy="89" r="5" fill="#ef6b18" opacity=".55" />
      <path className="admin-login-illustration__spark admin-login-illustration__spark--three" d="m457 111 4 9 9 4-9 4-4 9-4-9-9-4 9-4Z" fill="#fff" opacity=".82" />
      </svg>
      <div className="admin-login-mascot">
        <span className="admin-login-mascot__aura" />
        <img src={adminMascot} alt="" />
        <i className="admin-login-mascot__spark admin-login-mascot__spark--one" />
        <i className="admin-login-mascot__spark admin-login-mascot__spark--two" />
        <i className="admin-login-mascot__spark admin-login-mascot__spark--three" />
      </div>
    </div>
  )
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
    <main className="admin-login-v2-shell">
      <span className="admin-login-v2-orb admin-login-v2-orb--one" aria-hidden="true" />
      <span className="admin-login-v2-orb admin-login-v2-orb--two" aria-hidden="true" />

      <section className="admin-login-v2" aria-label="หน้าเข้าสู่ระบบผู้ดูแล SEDA">
        <aside className="admin-login-v2-hero" aria-label="SEDA Admin Console">
          <div className="admin-login-v2-brand">
            <img src={adminPortalLogo} alt="SEDA" />
            <span>ADMIN CONSOLE</span>
          </div>

          <div className="admin-login-v2-message">
            <small>พื้นที่บริหารจัดการ</small>
            <h1>จัดการง่าย<br /><em>เห็นผลชัดเจน</em></h1>
            <p>ดูแลกิจกรรม ผู้เข้าร่วม และผลการประเมิน<br />ครบจบในพื้นที่เดียว</p>
          </div>

          <div className="admin-login-v2-visual"><AdminIllustration /></div>
        </aside>

        <section className="admin-login-v2-panel" aria-labelledby="admin-login-title">
          <header className="admin-login-v2-header">
            <span>SEDA ADMIN</span>
            <h2 id="admin-login-title">พร้อมดูแลทุกกิจกรรม</h2>
            <p>เข้าสู่ระบบเพื่อจัดการและติดตามผลในที่เดียว</p>
          </header>

          <form className="admin-login-v2-form" onSubmit={handleSubmit} noValidate>
            <div className="admin-login-v2-field">
              <label htmlFor="admin-email">อีเมลผู้ดูแล</label>
              <div className="admin-login-v2-input">
                <MailIcon />
                <input id="admin-email" name="email" type="email" autoComplete="username" autoFocus placeholder="name@example.com" value={email} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "admin-email-error" : undefined} onChange={(event) => { setEmail(event.target.value); if (errors.email) setErrors({ ...errors, email: undefined }) }} />
              </div>
              {errors.email && <small id="admin-email-error">{errors.email}</small>}
            </div>

            <div className="admin-login-v2-field">
              <label htmlFor="admin-password">รหัสผ่าน</label>
              <div className="admin-login-v2-password">
                <LockIcon />
                <input id="admin-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="กรอกรหัสผ่าน" value={password} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "admin-password-error" : undefined} onChange={(event) => { setPassword(event.target.value); if (errors.password) setErrors({ ...errors, password: undefined }) }} />
                <Button className="admin-login-v2-show" aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)}><EyeIcon visible={showPassword} /></Button>
              </div>
              {errors.password && <small id="admin-password-error">{errors.password}</small>}
            </div>

            <div className="admin-login-v2-options">
              <label><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /><span>จดจำอีเมลนี้</span></label>
            </div>

            <Button className="admin-login-v2-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? <><LoadingIcon /> กำลังเข้าสู่ระบบ...</> : <>เข้าสู่ระบบ <ArrowIcon /></>}
            </Button>
            {notice && <p className="admin-login-v2-notice" role="alert" aria-live="polite">{notice}</p>}
          </form>

          <footer className="admin-login-v2-footer"><span>SEDA Skill Analytics</span><i aria-hidden="true" /><span>Admin Portal</span></footer>
        </section>
      </section>
    </main>
  )
}

export default AdminLogin
