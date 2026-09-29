import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { StudentPortalApiError, completeStudentPortalOnboarding, getStudentPortalActivities, getStudentPortalActivity, getStudentPortalProfile, getStudentPortalProgress, loginStudentPortal } from './api'
import { isValidStudentCode, normalizeStudentCode } from '../../../lib/studentCode'
import { clearStudentPortalSession, getStudentPortalSession, saveStudentPortalSession } from './session'
import type { CompetencyResult, JoinedActivity, StudentResult, UserActivityDetail, UserProfile, UserProgressActivity } from './types'
import Icon from '../../../shared/components/ui/Icon'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import ViewModeToggle, { type ViewMode } from '../../../shared/components/ui/ViewModeToggle'
import RichTextContent from '../../../shared/components/ui/RichTextContent'
import activityHeaderIcon from '../../../assets/9.png'
import comparisonHeroImage from '../../../assets/7.png'
import comparisonFocusIcon from '../../../assets/77.png'
import comparisonChangeIcon from '../../../assets/79.png'
import comparisonStrengthIcon from '../../../assets/88.png'
import progressAchievementIcon from '../../../assets/23.png'
import progressDevelopmentIcon from '../../../assets/99.png'
import progressDeclineIcon from '../../../assets/999.png'
import barChartArtwork from '../../../assets/773.png'
import activitiesNavIcon from '../../../assets/กิจกรรม.png'
import progressNavIcon from '../../../assets/พัฒนาการ.png'
import profileNavIcon from '../../../assets/โปรไฟล์.png'
import gmailProfileIcon from '../../../assets/gmail.png'
import phoneProfileIcon from '../../../assets/number.png'
import degreeProfileIcon from '../../../assets/ปริญาตรี.png'
import majorProfileIcon from '../../../assets/สาขา.png'
import facultyProfileIcon from '../../../assets/สำนักวิชา.png'
import englishFlag from '../../../assets/6666.jpg'
import thaiFlag from '../../../assets/888.jpg'
import studentPortalLogo from '../../../assets/93.png'
import sutBrandMark from '../../../assets/11.png'
import studentLoginCover from '../../../assets/8.png'
import { trackUserEvent } from '../../usage/tracker'
import './userPortal.css'
import "./userPortalLoginRefresh.css"

type Navigate = (path: string, replace?: boolean) => void
type PortalPageProps = { onNavigate: Navigate }
type PortalLanguage = 'TH' | 'EN'

const PORTAL_LANGUAGE_KEY = 'seda:user-language'
const PORTAL_LANGUAGE_EVENT = 'seda:portal-language-change'
const PORTAL_ONBOARDING_KEY = 'seda:user-onboarding:v1'

function readPortalLanguage(): PortalLanguage {
  try {
    return window.localStorage.getItem(PORTAL_LANGUAGE_KEY) === 'EN' ? 'EN' : 'TH'
  } catch {
    return 'TH'
  }
}
function usePortalLanguage() {
  const [language, setLanguageState] = useState<PortalLanguage>(readPortalLanguage)

  useEffect(() => {
    document.documentElement.lang = language === 'TH' ? 'th' : 'en'
  }, [language])

  useEffect(() => {
    const syncLanguage = (event: Event) => {
      const nextLanguage = (event as CustomEvent<PortalLanguage>).detail
      setLanguageState(nextLanguage === 'EN' ? 'EN' : readPortalLanguage())
    }
    const syncStorage = () => setLanguageState(readPortalLanguage())
    window.addEventListener(PORTAL_LANGUAGE_EVENT, syncLanguage)
    window.addEventListener('storage', syncStorage)
    return () => {
      window.removeEventListener(PORTAL_LANGUAGE_EVENT, syncLanguage)
      window.removeEventListener('storage', syncStorage)
    }
  }, [])

  const setLanguage = useCallback((nextLanguage: PortalLanguage) => {
    setLanguageState(nextLanguage)
    try {
      window.localStorage.setItem(PORTAL_LANGUAGE_KEY, nextLanguage)
    } catch {
      // Keep the selected language for the current session when storage is unavailable.
    }
    window.dispatchEvent(new CustomEvent<PortalLanguage>(PORTAL_LANGUAGE_EVENT, { detail: nextLanguage }))
  }, [])

  const t = useCallback((thai: string, english: string) => language === 'TH' ? thai : english, [language])
  return { language, setLanguage, t }
}

function formatDate(value: string | null, language: PortalLanguage) {
  if (!value) return language === 'TH' ? 'ไม่ระบุวันที่' : 'Date not specified'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return language === 'TH' ? 'ไม่ระบุวันที่' : 'Date not specified'
  return date.toLocaleDateString(language === 'TH' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatDateTime(value: string, language: PortalLanguage) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return language === 'TH' ? 'ไม่ระบุเวลา' : 'Time not specified'
  return date.toLocaleString(language === 'TH' ? 'th-TH' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function portalRequestError(error: unknown, language: PortalLanguage, thaiFallback: string, englishFallback: string) {
  if (language === 'TH' && error instanceof Error) return error.message
  return language === 'TH' ? thaiFallback : englishFallback
}

type LocalizableActivity = {
  activityCode: string | null
  name: string
  detail?: string | null
  location?: string | null
}

const englishActivityCopy: Record<string, { name: string; detail?: string; location?: string }> = {
  'ACT-000018': {
    name: 'Untitled Activity',
    detail: 'No English description is available for this activity.',
    location: 'Location not specified',
  },
  'ACT-000019': {
    name: 'Activity Test',
    detail: 'Activity test',
    location: 'Test location',
  },
  'ACT-000025': {
    name: 'SEDA Develops Planning and Negotiation Skills for Public Health Students through Catan Board Game-Based Learning',
    location: 'Suranaree University of Technology',
    detail: `On 2 September 2026, the Student Entrepreneurship Development Academy (SEDA), Suranaree University of Technology, collaborated with the Institute of Public Health to organize an entrepreneurship skills development activity for students in the OSCE Room, F9 Building. Catan Board Game was used as a learning tool to strengthen planning, decision-making, negotiation, and resource-management skills through a simulated environment.

The activity began with the foundations of Entrepreneurship and the Entrepreneurial Mindset. Students explored how entrepreneurship extends beyond starting a business to recognizing opportunities, making effective use of available resources, making decisions under constraints, and taking action to create meaningful value.

Students also learned about Effectuation: beginning with the resources at hand, accepting manageable risk, building partnerships, adapting to unexpected situations, and shaping the future through action. These ideas were then connected to Strategic Thinking.

Catan provided a practical simulation in which students could test real strategies—from choosing locations and allocating resources to deciding when to build roads, settlements, or cities, and adapting their plans as conditions changed.

Negotiation and collaboration were central to the experience. Because no player could obtain every required resource alone, students had to communicate, exchange, negotiate, and reach agreements with others. This process strengthened Communication, Negotiation, Decision-Making, and Teamwork skills that are valuable in study, work, and future business settings.

After the activity, students reflected through Padlet using the prompts “What I Like – What I Learn – What I Wish.” The feedback was highly positive, and students were able to connect their experience in the game with planning, resource management, teamwork, negotiation, and applying these ideas in other situations.

This activity reflects SEDA’s experiential-learning approach: helping students learn to think, plan, and negotiate through hands-on practice while developing an Entrepreneurial Mindset and essential 21st-century skills for future opportunities, challenges, and change.`,
  },
  'ACT-000027': {
    name: 'SEDA Develops Planning and Negotiation Skills for Public Health Students through Catan Board Game-Based Learning',
    location: 'Suranaree University of Technology',
    detail: 'On 2 September 2026, the Student Entrepreneurship Development Academy (SEDA), Suranaree University of Technology, collaborated with the Institute of Public Health to organize an entrepreneurship skills development activity for students.',
  },
}

function containsThai(value: string | null | undefined) {
  return Boolean(value && /[ก-๙]/.test(value))
}

function activityEnglishCopy(activity: LocalizableActivity) {
  return activity.activityCode ? englishActivityCopy[activity.activityCode] : undefined
}

function localizedActivityName(activity: LocalizableActivity, language: PortalLanguage) {
  if (language === 'TH') return activity.name
  const translated = activityEnglishCopy(activity)?.name
  if (translated) return translated
  return containsThai(activity.name)
    ? `Student Activity${activity.activityCode ? ` · ${activity.activityCode}` : ''}`
    : activity.name
}

function localizedActivityDetail(activity: LocalizableActivity, language: PortalLanguage) {
  const detail = activity.detail ?? null
  if (language === 'TH') return detail
  const translated = activityEnglishCopy(activity)?.detail
  if (translated) return translated
  return containsThai(detail) ? 'No English description is available for this activity.' : detail
}

function localizedActivityLocation(activity: LocalizableActivity, language: PortalLanguage) {
  const location = activity.location ?? null
  if (language === 'TH') return location
  const translated = activityEnglishCopy(activity)?.location
  if (translated) return translated
  return containsThai(location) ? 'Location not specified' : location
}

function localizedCompetencyName(name: string, displayOrder: number, language: PortalLanguage) {
  if (language === 'TH') return name
  const englishInParentheses = name.match(/\(([^()]*)\)\s*$/)?.[1]?.trim()
  if (englishInParentheses) return englishInParentheses
  return containsThai(name) ? `Competency ${displayOrder}` : name
}


function isSessionError(error: unknown) {
  return error instanceof StudentPortalApiError && error.status === 401
}

function PortalShell({ title, titleEn, eyebrow, active, onNavigate, children }: PortalPageProps & { title: string; titleEn: string; eyebrow: string; active: 'activities' | 'progress' | 'profile'; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const languageRef = useRef<HTMLDivElement>(null)
  const { language, setLanguage, t } = usePortalLanguage()
  const onboardingStorageKey = useMemo(() => {
    const studentCode = getStudentPortalSession()?.studentCode
    return `${PORTAL_ONBOARDING_KEY}:${studentCode ?? 'device'}`
  }, [])
  const rememberGuideCompletion = useCallback(() => {
    try { window.localStorage.setItem(onboardingStorageKey, 'complete') } catch { /* Continue without local persistence. */ }
    void completeStudentPortalOnboarding().catch(() => {
      // Local persistence still prevents repeat prompts when the API is temporarily unavailable.
    })
  }, [onboardingStorageKey])

  useEffect(() => {
    if (!languageOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!languageRef.current?.contains(event.target as Node)) setLanguageOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLanguageOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [languageOpen])

  useEffect(() => {
    if (active !== 'activities') return
    if (getStudentPortalSession()?.onboardingCompleted) return
    try {
      if (window.localStorage.getItem(onboardingStorageKey)) return
    } catch {
      // Show the guide when storage is unavailable.
    }
    const timer = window.setTimeout(() => {
      setGuideStep(0)
      setGuideOpen(true)
    }, 550)
    return () => window.clearTimeout(timer)
  }, [active, onboardingStorageKey])

  useEffect(() => {
    if (!guideOpen) return
    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        rememberGuideCompletion()
        setGuideOpen(false)
      }
    }
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [guideOpen, rememberGuideCompletion])

  const copy = {
    activities: t('กิจกรรมของฉัน', 'My Activities'),
    progress: t('พัฒนาการ', 'My Progress'),
    profile: t('โปรไฟล์', 'Profile'),
    logout: t('ออกจากระบบ', 'Sign out'),
    openMenu: t('เปิดเมนู', 'Open menu'),
    closeMenu: t('ปิดเมนู', 'Close menu'),
    languageMenu: t('เลือกภาษา', 'Choose language'),
    viewProfile: t('ดูโปรไฟล์', 'View profile'),
    openGuide: t('เปิดคู่มือการใช้งาน', 'Open user guide'),
  }

  const guideSteps = [
    {
      icon: 'rocket' as const,
      eyebrow: t('ยินดีต้อนรับ', 'Welcome'),
      title: t('เริ่มใช้งาน SEDA ในไม่กี่ขั้นตอน', 'Get started with SEDA in a few steps'),
      description: t('เรียนรู้วิธีเลือกกิจกรรม ทำแบบประเมิน และติดตามพัฒนาการของตนเองได้อย่างง่ายดาย', 'Learn how to choose activities, complete assessments, and easily track your own progress.'),
      tips: [t('ใช้เวลาไม่ถึง 1 นาที', 'Takes less than a minute'), t('เปิดดูใหม่ได้ทุกเมื่อ', 'Available again at any time')],
    },
    {
      icon: 'activities' as const,
      eyebrow: t('ขั้นตอนที่ 1', 'Step 1'),
      title: t('กิจกรรมของฉัน', 'My Activities'),
      description: t('เลือกกิจกรรมเพื่อดูรายละเอียด วัน เวลา สถานที่ และสถานะการประเมิน', 'Choose an activity to view its details, date, time, location, and assessment status.'),
      tips: [t('สลับมุมมองตารางหรือรายการได้', 'Switch between grid and list views'), t('เลือกหลายกิจกรรมเพื่อเปรียบเทียบได้', 'Select activities to compare')],
    },
    {
      icon: 'analytics' as const,
      eyebrow: t('ขั้นตอนที่ 2', 'Step 2'),
      title: t('ผลการพัฒนาทักษะ', 'Skill Development Results'),
      description: t('ตรวจสอบคะแนน PRE/POST และเปรียบเทียบพัฒนาการของแต่ละทักษะผ่านกราฟ', 'Review PRE/POST scores and compare the development of each skill through charts.'),
      tips: [t('เลือกดูทีละกิจกรรมหรือทั้งหมดได้', 'View one activity or all activities'), t('แตะกราฟเพื่อดูคะแนนเพิ่มเติม', 'Interact with charts for more detail')],
    },
    {
      icon: 'person' as const,
      eyebrow: t('ขั้นตอนที่ 3', 'Step 3'),
      title: t('ข้อมูลส่วนตัวและการตั้งค่า', 'Personal Information and Settings'),
      description: t('ตรวจสอบข้อมูลนักศึกษาและเปลี่ยนภาษาผ่านไอคอนธงด้านบน', 'Review student information and change the language using the flag icon at the top.'),
      tips: [t('กดปุ่มข้อมูลด้านบนเพื่อเปิดไกด์อีกครั้ง', 'Use the info button to reopen this guide'), t('พร้อมแล้ว เริ่มสำรวจกิจกรรมได้เลย', 'You are ready to explore your activities')],
    },
  ]
  const currentGuideStep = guideSteps[guideStep]
  const closeGuide = () => {
    rememberGuideCompletion()
    setGuideOpen(false)
  }
  const openGuide = () => {
    setGuideStep(0)
    setGuideOpen(true)
  }

  const logout = () => {
    trackUserEvent('interaction', 'logout')
    clearStudentPortalSession()
    onNavigate('/user/login', true)
  }
  const move = (path: string) => {
    setMenuOpen(false)
    onNavigate(path)
  }
  const chooseLanguage = (nextLanguage: PortalLanguage) => {
    setLanguage(nextLanguage)
    setLanguageOpen(false)
  }

  return <div className={`user-portal-shell${guideOpen ? ' is-guide-open' : ''}`}>
    <aside className={'user-portal-sidebar' + (menuOpen ? ' is-open' : '')}>
      <div className="user-portal-brand">
        <img className="user-portal-brand__logo" src={studentPortalLogo} alt="SEDA" />
        <span className="user-portal-brand__label">Student Portal</span>
        <button type="button" className="user-portal-close" onClick={() => setMenuOpen(false)} aria-label={copy.closeMenu}><Icon name="close" /></button>
      </div>
      <nav>
        <button type="button" className={`${active === 'activities' ? 'is-active' : ''}${guideOpen && guideStep === 1 ? ' is-guide-highlighted' : ''}`} aria-current={active === 'activities' ? 'page' : undefined} onClick={() => move('/user/activities')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={activitiesNavIcon} alt="" /></span><span>{copy.activities}</span></button>
        <button type="button" className={`${active === 'progress' ? 'is-active' : ''}${guideOpen && guideStep === 2 ? ' is-guide-highlighted' : ''}`} aria-current={active === 'progress' ? 'page' : undefined} onClick={() => move('/user/progress')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={progressNavIcon} alt="" /></span><span>{copy.progress}</span></button>
        <button type="button" className={`${active === 'profile' ? 'is-active' : ''}${guideOpen && guideStep === 3 ? ' is-guide-highlighted' : ''}`} aria-current={active === 'profile' ? 'page' : undefined} onClick={() => move('/user/profile')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={profileNavIcon} alt="" /></span><span>{copy.profile}</span></button>
      </nav>
      <button type="button" className="user-portal-logout" onClick={logout}><Icon name="logout" />{copy.logout}</button>
    </aside>
    {menuOpen && <button type="button" className="user-portal-backdrop" onClick={() => setMenuOpen(false)} aria-label={copy.closeMenu} />}
    <main className="user-portal-main">
      <header>
        <button type="button" className="user-portal-menu" onClick={() => setMenuOpen(true)} aria-label={copy.openMenu}><Icon name="menu" /></button>
        <div className="user-portal-header-title"><span>{eyebrow}</span><h1>{t(title, titleEn)}</h1></div>
        <div className="user-portal-header-actions">
          <button type="button" className="user-portal-guide-button" aria-label={copy.openGuide} title={copy.openGuide} onClick={openGuide}><Icon name="info" /></button>
          <div className="user-portal-language-picker" ref={languageRef}>
            <button type="button" className={'user-portal-language-button' + (languageOpen ? ' is-open' : '')} aria-label={copy.languageMenu} title={copy.languageMenu} aria-haspopup="menu" aria-expanded={languageOpen} onClick={() => setLanguageOpen((open) => !open)}><img src={language === 'TH' ? thaiFlag : englishFlag} alt="" /></button>
            {languageOpen && <div className="user-portal-language-menu" role="menu" aria-label={copy.languageMenu}>
              <button type="button" role="menuitemradio" aria-checked={language === 'TH'} className={language === 'TH' ? 'is-active' : ''} onClick={() => chooseLanguage('TH')}><img src={thaiFlag} alt="" /><span>ไทย</span>{language === 'TH' && <Icon name="check" />}</button>
              <button type="button" role="menuitemradio" aria-checked={language === 'EN'} className={language === 'EN' ? 'is-active' : ''} onClick={() => chooseLanguage('EN')}><img src={englishFlag} alt="" /><span>English</span>{language === 'EN' && <Icon name="check" />}</button>
            </div>}
          </div>
          <button type="button" className={'user-portal-profile-shortcut' + (active === 'profile' ? ' is-active' : '')} aria-label={copy.viewProfile} title={copy.viewProfile} onClick={() => move('/user/profile')}><img src={profileNavIcon} alt="" /></button>
        </div>
      </header>
      <div className="user-portal-content">{children}</div>
    </main>
    <nav className="user-portal-mobile-nav" aria-label={t('เมนูหลัก', 'Main navigation')}>
      <button type="button" className={active === 'activities' ? 'is-active' : ''} aria-current={active === 'activities' ? 'page' : undefined} onClick={() => move('/user/activities')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={activitiesNavIcon} alt="" /></span><span>{copy.activities}</span></button>
      <button type="button" className={active === 'progress' ? 'is-active' : ''} aria-current={active === 'progress' ? 'page' : undefined} onClick={() => move('/user/progress')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={progressNavIcon} alt="" /></span><span>{copy.progress}</span></button>
      <button type="button" className={active === 'profile' ? 'is-active' : ''} aria-current={active === 'profile' ? 'page' : undefined} onClick={() => move('/user/profile')}><span className="user-portal-nav-icon" aria-hidden="true"><img src={profileNavIcon} alt="" /></span><span>{copy.profile}</span></button>
    </nav>
    {guideOpen && <div className="user-portal-guide" role="presentation">
      <div className="user-portal-guide__backdrop" />
      <section className={`user-portal-guide__dialog is-step-${guideStep}`} role="dialog" aria-modal="true" aria-labelledby="user-portal-guide-title" aria-describedby="user-portal-guide-description">
        <header>
          <span>{t('คู่มือเริ่มต้นใช้งาน', 'Getting started guide')}</span>
          <button type="button" onClick={closeGuide} aria-label={t('ปิดคู่มือ', 'Close guide')}><Icon name="close" /></button>
        </header>
        <div className={`user-portal-guide__icon is-step-${guideStep}`} aria-hidden="true">
          <img src={guideStep === 0 ? studentPortalLogo : guideStep === 1 ? activitiesNavIcon : guideStep === 2 ? progressNavIcon : profileNavIcon} alt="" />
        </div>
        <small>{currentGuideStep.eyebrow}</small>
        <h2 id="user-portal-guide-title">{currentGuideStep.title}</h2>
        <p id="user-portal-guide-description">{currentGuideStep.description}</p>
        <ul>{currentGuideStep.tips.map((tip) => <li key={tip}><Icon name="check" />{tip}</li>)}</ul>
        <div className="user-portal-guide__progress" aria-label={t(`ขั้นตอน ${guideStep + 1} จาก ${guideSteps.length}`, `Step ${guideStep + 1} of ${guideSteps.length}`)}>{guideSteps.map((_, index) => <i key={index} className={index === guideStep ? 'is-active' : index < guideStep ? 'is-complete' : ''} />)}</div>
        <footer>
          <button type="button" className="is-skip" onClick={closeGuide}>{t('ข้ามคำแนะนำ', 'Skip guide')}</button>
          <div>
            {guideStep > 0 && <button type="button" className="is-back" onClick={() => setGuideStep((step) => step - 1)}><Icon name="chevronLeft" />{t('ย้อนกลับ', 'Back')}</button>}
            <button type="button" className="is-next" onClick={() => guideStep === guideSteps.length - 1 ? closeGuide() : setGuideStep((step) => step + 1)}>{guideStep === guideSteps.length - 1 ? t('เริ่มใช้งาน', 'Get started') : t('ถัดไป', 'Next')} {guideStep < guideSteps.length - 1 && <Icon name="chevronRight" />}</button>
          </div>
        </footer>
      </section>
    </div>}
  </div>
}


function LoadingState({ label }: { label?: string }) {
  const { t } = usePortalLanguage()
  return <div className="user-portal-state" role="status"><span className="user-portal-spinner" /><p>{label ?? t('กำลังโหลดข้อมูล...', 'Loading data...')}</p></div>
}

function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  const { t } = usePortalLanguage()
  return <div className="user-portal-state user-portal-state--error" role="alert"><strong>{t('ไม่สามารถแสดงข้อมูลได้', 'Unable to display data')}</strong><p>{message}</p>{retry && <button type="button" onClick={retry}>{t('ลองอีกครั้ง', 'Try again')}</button>}</div>
}

function StudentIdIcon() {
  return <svg className="user-portal-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2.4" /><path d="M5.8 16c.8-2.6 5.6-2.6 6.4 0M15 9h3.2M15 13h3.2" /></svg>
}

function StudentLoginArrow() {
  return <svg className="user-portal-login-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h13M14 7l5 5-5 5" /></svg>
}

function StudentLoginSpinner() {
  return <svg className="user-portal-login-icon user-portal-login-icon--spinner" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="8.5" /></svg>
}

export function UserPortalLogin({ onNavigate, returnTo }: PortalPageProps & { returnTo?: string }) {
  const { language, t } = usePortalLanguage()
  const [studentCode, setStudentCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { if (getStudentPortalSession()) onNavigate("/user/activities", true) }, [onNavigate])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = normalizeStudentCode(studentCode)
    if (!isValidStudentCode(normalized)) {
      trackUserEvent("interaction", "form_validation_error:student_portal_login")
      setError(t("กรุณากรอกรหัสนักศึกษาที่ถูกต้อง เช่น B6728070", "Please enter a valid student ID, such as B6728070"))
      return
    }
    setBusy(true)
    setError("")
    try {
      saveStudentPortalSession({ ...(await loginStudentPortal(normalized)), studentCode: normalized })
      trackUserEvent("interaction", "login_success")
      trackUserEvent("interaction", "form_success:student_portal_login")
      onNavigate(returnTo?.startsWith("/user/") && returnTo !== "/user/login" ? returnTo : "/user/activities", true)
    } catch (requestError) {
      trackUserEvent("interaction", "form_error:student_portal_login")
      setError(portalRequestError(requestError, language, "ไม่สามารถเข้าสู่ระบบได้", "Unable to sign in"))
    } finally {
      setBusy(false)
    }
  }

  return <main className="user-portal-login">
    <span className="user-portal-login__ambient user-portal-login__ambient--one" aria-hidden="true" />
    <span className="user-portal-login__ambient user-portal-login__ambient--two" aria-hidden="true" />

    <section className="user-portal-login__card" aria-label={t("หน้าเข้าสู่ระบบนักศึกษา", "Student sign-in page")}>
      <span className="user-portal-login__desktop-atmosphere" aria-hidden="true">
        <i className="user-portal-login__leaf user-portal-login__leaf--one" />
        <i className="user-portal-login__leaf user-portal-login__leaf--two" />
        <i className="user-portal-login__leaf user-portal-login__leaf--three" />
        <i className="user-portal-login__leaf user-portal-login__leaf--four" />
        <i className="user-portal-login__leaf user-portal-login__leaf--five" />
        <i className="user-portal-login__leaf user-portal-login__leaf--six" />
        <i className="user-portal-login__leaf user-portal-login__leaf--seven" />
        <i className="user-portal-login__leaf user-portal-login__leaf--eight" />
        <i className="user-portal-login__leaf user-portal-login__leaf--nine" />
        <i className="user-portal-login__leaf user-portal-login__leaf--ten" />
      </span>
      <section className="user-portal-login__panel">
        <svg className="user-portal-login__desktop-curve" viewBox="0 0 260 1000" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d="M110 0C245 180 235 310 92 430C-20 525 8 690 150 770C240 822 244 920 135 1000H260V0Z" />
        </svg>
        <form data-usage-form="student_portal_login" onSubmit={submit} noValidate>
          <div className="user-portal-login__top-logos" aria-label="SEDA Student Portal and SUT anniversary">
            <img className="user-portal-login__seda-logo" src={studentPortalLogo} alt="SEDA Student Portal" />
            <span aria-hidden="true" />
            <img className="user-portal-login__anniversary-logo" src={sutBrandMark} alt="SUT" />
          </div>
          <div className="user-portal-login__brand" aria-hidden="true">
            <img src={studentPortalLogo} alt="SEDA" />
            <span>STUDENT PORTAL</span>
          </div>
          <header className="user-portal-login__heading">
            <h1>{t("เริ่มต้นพื้นที่ของคุณ", "Enter your space")}</h1>
            <p>{t("กรอกรหัสนักศึกษาเพื่อดูกิจกรรมและพัฒนาการ", "Enter your student ID to view activities and progress.")}</p>
          </header>

          <div className="user-portal-login__field">
            <label htmlFor="portal-student-code">{t("รหัสนักศึกษา", "Student ID")}</label>
            <div className="user-portal-login__input">
              <StudentIdIcon />
              <input id="portal-student-code" autoFocus autoComplete="username" inputMode="text" value={studentCode} aria-invalid={Boolean(error)} aria-describedby={error ? "portal-student-code-error" : undefined} onChange={(event) => { setStudentCode(normalizeStudentCode(event.target.value)); setError("") }} placeholder={t("เช่น B6728070", "e.g. B6728070")} maxLength={8} />
            </div>
            {error && <p id="portal-student-code-error" className="user-portal-form-error" role="alert">{error}</p>}
          </div>

          <button type="submit" disabled={busy}>
            {busy ? <><StudentLoginSpinner />{t("กำลังเข้าสู่ระบบ...", "Signing in...")}</> : <>{t("เข้าสู่ระบบ", "Sign in")}<StudentLoginArrow /></>}
          </button>
          <em>{t("ใช้รหัสนักศึกษาของคุณเพื่อเข้าถึงข้อมูลส่วนบุคคล", "Use your student ID to access your personal information.")}</em>
        </form>
        <p className="user-portal-login__contact">{t("หากพบปัญหาในการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ", "If you have trouble signing in, please contact the system administrator.")}</p>
      </section>

      <section className="user-portal-login__visual" aria-label={t("เส้นทางการพัฒนาของนักศึกษา", "Student development journey")}>
        <img className="user-portal-login__cover" src={studentLoginCover} alt="" aria-hidden="true" />
        <img className="user-portal-login__partner-logo" src={sutBrandMark} alt="" aria-hidden="true" />
      </section>
    </section>
  </main>
}

type UserActivityComparisonMetric = 'average' | 'maximum' | 'minimum'

function ActivityCard({ activity, onNavigate, selectionMode = false, selected = false, comparisonEligible = false, onToggleSelection }: {
  activity: JoinedActivity
  onNavigate: Navigate
  selectionMode?: boolean
  selected?: boolean
  comparisonEligible?: boolean
  onToggleSelection?: () => void
}) {
  const { language, t } = usePortalLanguage()
  const statusLabel = activity.activityStatus === 'active'
    ? t('กำลังดำเนินการ', 'In progress')
    : activity.activityStatus === 'closed'
      ? t('เสร็จสิ้น', 'Completed')
      : activity.activityStatus === 'draft'
        ? t('ฉบับร่าง', 'Draft')
        : t('เก็บถาวร', 'Archived')

  return <article className={`user-portal-activity-card${selected ? ' is-selected' : ''}`}>
    <div className="user-portal-activity-card__image">
      {activity.imageData ? <img src={activity.imageData} alt="" /> : <span>SEDA</span>}
      {selectionMode && <button type="button" className={`user-portal-activity-card__select${selected ? ' is-selected' : ''}`} disabled={!comparisonEligible} aria-pressed={selected} title={comparisonEligible ? undefined : t('ต้องทำ PRE-TEST และ POST-TEST ให้ครบก่อน', 'Complete both PRE-TEST and POST-TEST first')} onClick={onToggleSelection}><i aria-hidden="true">{selected ? '✓' : '+'}</i>{comparisonEligible ? selected ? t('เลือกแล้ว', 'Selected') : t('เลือกเปรียบเทียบ', 'Select to compare') : t('ข้อมูลไม่ครบ', 'Incomplete data')}</button>}
      <b className={`user-portal-status user-portal-status--${activity.activityStatus}`}>{statusLabel}</b>
    </div>
    <div className="user-portal-activity-card__body">
      <small>{activity.activityCode ?? t('กิจกรรมนักศึกษา', 'Student activity')}</small>
      <h2>{localizedActivityName(activity, language)}</h2>
      <p><Icon name="calendar" />{formatDate(activity.startDate, language)}</p>
      <p><Icon name="location" />{localizedActivityLocation(activity, language) ?? t('ไม่ระบุสถานที่', 'Location not specified')}</p>
      <div className="user-portal-phase"><span className={activity.preResponse ? 'done' : ''}>PRE {activity.preResponse && <Icon name="check" />}</span><span className={activity.postResponse ? 'done' : ''}>POST {activity.postResponse && <Icon name="check" />}</span></div>
      <button type="button" onClick={() => onNavigate(`/user/activities/${activity.activityId}`)}>{t('ดูรายละเอียดเพิ่มเติม', 'View more details')} <Icon name="chevronRight" /></button>
    </div>
  </article>
}

function UserActivityComparison({ activities, onEditSelection }: { activities: UserProgressActivity[]; onEditSelection: () => void }) {
  const { language, t } = usePortalLanguage()
  const [metric, setMetric] = useState<UserActivityComparisonMetric>('average')
  const metricLabels: Record<UserActivityComparisonMetric, string> = {
    average: t('คะแนนเฉลี่ย', 'Average'),
    maximum: t('คะแนนสูงสุด', 'Highest'),
    minimum: t('คะแนนต่ำสุด', 'Lowest'),
  }

  const phaseMetricValue = (activity: UserProgressActivity, phase: 'pre' | 'post') => {
    const scores = activity.competencies.map((competency) => competency[phase]).filter((score): score is number => score !== null)
    if (!scores.length) return phase === 'pre' ? activity.preAverage : activity.postAverage
    if (metric === 'maximum') return Math.max(...scores)
    if (metric === 'minimum') return Math.min(...scores)
    return scores.reduce((sum, score) => sum + score, 0) / scores.length
  }

  const comparisonRows = activities.map((activity) => {
    const pre = phaseMetricValue(activity, 'pre')
    const post = phaseMetricValue(activity, 'post')
    return { activity, pre, post, change: post - pre }
  })
  const overallChange = activities.length ? activities.reduce((sum, activity) => sum + activity.change, 0) / activities.length : 0
  const overallDirection = progressDirection(overallChange, language)
  const bestPost = [...activities].sort((left, right) => right.postAverage - left.postAverage)[0]
  const bestGrowth = [...activities].sort((left, right) => right.change - left.change)[0]
  const bestGrowthDirection = progressDirection(bestGrowth?.change ?? 0, language)

  const competencyGroups = new Map<string, { name: string; postTotal: number; postCount: number; changeTotal: number; changeCount: number }>()
  activities.forEach((activity) => {
    activity.competencies.forEach((competency) => {
      const current = competencyGroups.get(competency.name) ?? { name: competency.name, postTotal: 0, postCount: 0, changeTotal: 0, changeCount: 0 }
      if (competency.post !== null) {
        current.postTotal += competency.post
        current.postCount += 1
      }
      if (competency.change !== null) {
        current.changeTotal += competency.change
        current.changeCount += 1
      }
      competencyGroups.set(competency.name, current)
    })
  })

  const competencySummary = Array.from(competencyGroups.values())
    .filter((competency) => competency.postCount > 0)
    .map((competency) => ({ name: competency.name, post: competency.postTotal / competency.postCount, change: competency.changeCount ? competency.changeTotal / competency.changeCount : 0 }))
  const strongestCompetency = [...competencySummary].sort((left, right) => right.post - left.post)[0]
  const focusCompetency = [...competencySummary].sort((left, right) => left.post - right.post)[0]

  return <section className="user-activity-comparison" id="user-activity-comparison" aria-labelledby="user-activity-comparison-title">
    <header>
      <div><span>ACTIVITY COMPARISON</span><h2 id="user-activity-comparison-title">{t('เปรียบเทียบกิจกรรมของคุณ', 'Compare your activities')}</h2><p>{t('มองเห็นความเปลี่ยนแปลง จุดเด่น และด้านที่ควรพัฒนาจากกิจกรรมที่เลือก', 'See your progress, strengths, and areas to develop across the selected activities.')}</p></div>
      <img className="user-activity-comparison__hero-art" src={comparisonHeroImage} alt="" aria-hidden="true" />
      <button type="button" onClick={onEditSelection}><Icon name="chevronLeft" />{t('กลับไปเลือกกิจกรรม', 'Back to activity selection')}</button>
    </header>

    <div className="user-activity-comparison__selected" aria-label={t('กิจกรรมที่เลือก', 'Selected activities')}>
      <strong>{t(`กำลังเปรียบเทียบ ${activities.length} กิจกรรม`, `Comparing ${activities.length} activities`)}</strong>
      <div>{activities.map((activity, index) => <span key={activity.activityId}><i>{index + 1}</i>{localizedActivityName(activity, language)}</span>)}</div>
    </div>

    <div className="user-activity-comparison__overview" aria-label={t('สรุปภาพรวมการเปรียบเทียบ', 'Comparison overview')}>
      <article className={'is-' + overallDirection.className.replace('is-', '')}><span><img className="is-average-change" src={comparisonChangeIcon} alt="" /></span><div><small>{t('การเปลี่ยนแปลงเฉลี่ย', 'Average change')}</small><strong>{progressChange(overallChange)}</strong><p>{t(`${overallDirection.label} จาก ${activities.length} กิจกรรม`, `${overallDirection.label} across ${activities.length} activities`)}</p></div></article>
      <article className="is-post"><span><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span><div><small>{t('คะแนน POST สูงสุด', 'Highest POST score')}</small><strong>{bestPost ? progressScore(bestPost.postAverage) : '—'} <em>/ 7</em></strong><p>{bestPost ? localizedActivityName(bestPost, language) : t('ยังไม่มีข้อมูล', 'No data yet')}</p></div></article>
      <article className={'is-growth ' + bestGrowthDirection.className}><span><img className="is-best-growth" src={progressNavIcon} alt="" /></span><div><small>{t('พัฒนาการดีที่สุด', 'Best improvement')}</small><strong>{bestGrowth ? progressChange(bestGrowth.change) : '—'}</strong><p>{bestGrowth ? localizedActivityName(bestGrowth, language) : t('ยังไม่มีข้อมูล', 'No data yet')}</p></div></article>
    </div>

    {strongestCompetency && focusCompetency && <div className="user-activity-comparison__insights">
      <article className="is-strength"><header><span><img className="is-strength" src={comparisonStrengthIcon} alt="" /></span><div><small>{t('จุดแข็งของคุณ', 'Your strength')}</small><strong>{t('ทักษะที่มีคะแนนหลังเข้าร่วมสูงสุด', 'Skill with the highest POST score')}</strong></div></header><h3>{localizedCompetencyName(strongestCompetency.name, 0, language)}</h3><p>{t('คะแนน POST เฉลี่ย', 'Average POST score')} <b>{progressScore(strongestCompetency.post)} / 7</b> · {t('เปลี่ยนแปลง', 'Change')} {progressChange(strongestCompetency.change)}</p></article>
      <article className="is-focus"><header><span><img className="is-focus" src={comparisonFocusIcon} alt="" /></span><div><small>{t('เป้าหมายถัดไป', 'Next focus')}</small><strong>{t('ทักษะที่ยังพัฒนาต่อได้', 'A skill you can develop further')}</strong></div></header><h3>{localizedCompetencyName(focusCompetency.name, 0, language)}</h3><p>{t('คะแนน POST เฉลี่ย', 'Average POST score')} <b>{progressScore(focusCompetency.post)} / 7</b> · {t('ลองเลือกกิจกรรมที่ช่วยเสริมทักษะนี้ต่อ', 'Choose another activity that helps strengthen this skill.')}</p></article>
    </div>}

    <div className="user-activity-comparison__toolbar">
      <div><strong>{t('คะแนน PRE และ POST รายกิจกรรม', 'PRE and POST scores by activity')}</strong><small>{t('เลือกวิธีสรุปคะแนนจากแต่ละทักษะ · คะแนนเต็ม 7', 'Choose how competency scores are summarized · Maximum score: 7')}</small></div>
      <div role="group" aria-label={t('เลือกข้อมูลที่ต้องการเปรียบเทียบ', 'Choose comparison metric')}>{(Object.keys(metricLabels) as UserActivityComparisonMetric[]).map((item) => <button type="button" key={item} className={metric === item ? 'is-active' : ''} aria-pressed={metric === item} onClick={() => setMetric(item)}>{metricLabels[item]}</button>)}</div>
    </div>

    <div className="user-activity-comparison__legend" aria-label={t('คำอธิบายสี', 'Chart legend')}><span className="is-pre">{t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)')}</span><span className="is-post">{t('หลังเข้าร่วม (POST)', 'After participation (POST)')}</span></div>

    <div className="user-activity-comparison__chart">
      <div className="user-activity-comparison__scale" aria-hidden="true">{Array.from({ length: 8 }, (_, value) => <span key={value}>{value}</span>)}</div>
      <div className="user-activity-comparison__rows">{comparisonRows.map(({ activity, pre, post, change }, index) => {
        const preWidth = Math.min(100, Math.max(0, pre / 7 * 100))
        const postWidth = Math.min(100, Math.max(0, post / 7 * 100))
        const direction = progressDirection(change, language)
        return <article key={activity.activityId}>
          <div className="user-activity-comparison__activity"><i>{index + 1}</i><div><b>{localizedActivityName(activity, language)}</b><small>{activity.activityCode ?? t('กิจกรรมนักศึกษา', 'Student activity')}</small></div></div>
          <div className="user-activity-comparison__scores">
            <div className="is-pre"><span>PRE</span><div className="user-activity-comparison__track" aria-label={t(`คะแนน PRE ${progressScore(pre)} จาก 7`, `PRE score ${progressScore(pre)} out of 7`)}><i style={{ width: String(preWidth) + '%' }} /></div><strong>{progressScore(pre)}</strong></div>
            <div className="is-post"><span>POST</span><div className="user-activity-comparison__track" aria-label={t(`คะแนน POST ${progressScore(post)} จาก 7`, `POST score ${progressScore(post)} out of 7`)}><i style={{ width: String(postWidth) + '%' }} /></div><strong>{progressScore(post)}</strong></div>
          </div>
          <strong className={'user-activity-comparison__change ' + direction.className}><img className="user-trend-artwork" src={progressNavIcon} alt="" />{progressChange(change)}<small>{direction.label}</small></strong>
        </article>
      })}</div>
    </div>
  </section>
}

export function UserPortalActivities({ onNavigate }: PortalPageProps) {
  const { language, t } = usePortalLanguage()
  const [activities, setActivities] = useState<JoinedActivity[] | null>(null)
  const [progressActivities, setProgressActivities] = useState<UserProgressActivity[]>([])
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const [activityResult, progressResult] = await Promise.all([getStudentPortalActivities(), getStudentPortalProgress()])
      setError('')
      setActivities(activityResult.activities)
      setProgressActivities(progressResult.activities)
      setSelectedActivityIds((current) => current.filter((activityId) => progressResult.activities.some((activity) => activity.activityId === activityId)))
    } catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(portalRequestError(requestError, language, 'โหลดกิจกรรมไม่สำเร็จ', 'Unable to load activities'))
    }
  }, [language, onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])
  const visibleActivities = activities ?? []
  const comparisonEligibleIds = useMemo(() => new Set(progressActivities.map((activity) => activity.activityId)), [progressActivities])
  const selectedActivities = useMemo(() => progressActivities.filter((activity) => selectedActivityIds.includes(activity.activityId)), [progressActivities, selectedActivityIds])
  const toggleSelection = (activityId: number) => setSelectedActivityIds((current) => current.includes(activityId) ? current.filter((id) => id !== activityId) : [...current, activityId])
  const cancelSelection = () => { setSelectionMode(false); setComparisonOpen(false); setSelectedActivityIds([]) }
  const startComparison = () => { setSelectionMode(true); setComparisonOpen(false) }
  const openComparison = () => {
    if (selectedActivities.length < 2) return
    trackUserEvent('interaction', 'student_activity_comparison')
    setSelectionMode(false)
    setComparisonOpen(true)
    window.setTimeout(() => document.getElementById('user-activity-comparison')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  return <PortalShell title="กิจกรรมของฉัน" titleEn="My Activities" eyebrow="MY ACTIVITIES" active="activities" onNavigate={onNavigate}>
    <section className={`user-portal-intro${viewMode === 'list' ? ' is-list-view' : ''}`}>
      <div className="user-portal-intro__copy"><span className="user-portal-intro__icon" aria-hidden="true"><img src={activityHeaderIcon} alt="" /></span><div><h2>{t('เส้นทางการเรียนรู้ของคุณ', 'Your learning journey')}</h2><p>{t('รวมกิจกรรมและแบบประเมิน PRE/POST ที่คุณทำไว้', 'All your activities and completed PRE/POST assessments in one place.')}</p></div></div>
      {activities && <div className="user-portal-intro__actions"><strong>{t(`${activities.length} กิจกรรม`, `${activities.length} activities`)}</strong><ViewModeToggle value={viewMode} onChange={setViewMode} label={t('รูปแบบการแสดงกิจกรรม', 'Activity view')} gridLabel={t('แสดงแบบการ์ด', 'Grid view')} listLabel={t('แสดงแบบรายการ', 'List view')} />{progressActivities.length >= 2 && <button type="button" className={selectionMode || comparisonOpen ? 'is-active' : ''} onClick={selectionMode || comparisonOpen ? cancelSelection : startComparison}><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" />{selectionMode || comparisonOpen ? t('ยกเลิกการเปรียบเทียบ', 'Cancel comparison') : t('เปรียบเทียบกิจกรรม', 'Compare activities')}</button>}</div>}
    </section>
    {activities === null && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : visibleActivities.length ? <>
      {comparisonOpen && <UserActivityComparison activities={selectedActivities} onEditSelection={() => { setComparisonOpen(false); setSelectionMode(true) }} />}
      <section className={`user-portal-activity-grid${viewMode === 'list' ? ' is-list-view' : ''}${selectionMode ? ' is-selecting' : ''}`}>{visibleActivities.map((activity) => <ActivityCard key={activity.activityId} activity={activity} onNavigate={onNavigate} selectionMode={selectionMode} selected={selectedActivityIds.includes(activity.activityId)} comparisonEligible={comparisonEligibleIds.has(activity.activityId)} onToggleSelection={() => toggleSelection(activity.activityId)} />)}</section>
      {selectionMode && <aside className="user-activity-selection-bar" aria-live="polite"><div><strong>{t(`เลือกแล้ว ${selectedActivities.length} กิจกรรม`, `${selectedActivities.length} activities selected`)}</strong><span>{selectedActivities.length ? selectedActivities.slice(0, 3).map((activity) => localizedActivityName(activity, language)).join(', ') : t('เลือกอย่างน้อย 2 กิจกรรมที่ต้องการเปรียบเทียบ', 'Select at least 2 activities to compare')}{selectedActivities.length > 3 ? t(` และอีก ${selectedActivities.length - 3} กิจกรรม`, ` and ${selectedActivities.length - 3} more`) : ''}</span></div><div><button type="button" className="is-clear" disabled={!selectedActivities.length} onClick={() => setSelectedActivityIds([])}>{t('ล้างการเลือก', 'Clear selection')}</button><button type="button" className="is-compare" disabled={selectedActivities.length < 2} onClick={openComparison}>{t('เปรียบเทียบกิจกรรม', 'Compare activities')} ({selectedActivities.length})</button></div></aside>}
    </> : <div className="user-portal-state"><strong>{t('ยังไม่มีกิจกรรม', 'No activities yet')}</strong><p>{t('กิจกรรมที่ทำแบบประเมินแล้วจะแสดงที่นี่', 'Activities with completed assessments will appear here.')}</p></div>}
  </PortalShell>
}

function progressScore(value: number | null) {
  return value === null ? '—' : value.toFixed(2)
}

function progressChange(value: number | null) {
  return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

function progressDirection(value: number, language: PortalLanguage): { label: string; className: string } {
  if (value > 0) return { label: language === 'TH' ? 'ดีขึ้น' : 'Improved', className: 'is-positive' }
  if (value < 0) return { label: language === 'TH' ? 'ลดลง' : 'Declined', className: 'is-negative' }
  return { label: language === 'TH' ? 'คงที่' : 'Unchanged', className: 'is-neutral' }
}

function averageProgressValues(values: number[]) {
  if (!values.length) return null
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100
}

function aggregateProgressActivities(activities: UserProgressActivity[], language: PortalLanguage) {
  if (!activities.length) return null
  const competencyGroups = new Map<number, UserProgressActivity['competencies'][number][]>()
  for (const activity of activities) {
    for (const competency of activity.competencies) {
      const group = competencyGroups.get(competency.competencyId) ?? []
      group.push(competency)
      competencyGroups.set(competency.competencyId, group)
    }
  }
  const competencies = [...competencyGroups.values()].map((group) => {
    const first = group[0]
    const pre = averageProgressValues(group.flatMap((item) => item.pre === null ? [] : [item.pre]))
    const post = averageProgressValues(group.flatMap((item) => item.post === null ? [] : [item.post]))
    return {
      competencyId: first.competencyId,
      name: localizedCompetencyName(first.name, first.displayOrder, language),
      displayOrder: first.displayOrder,
      pre,
      post,
      change: pre === null || post === null ? null : Math.round((post - pre) * 100) / 100,
    }
  }).sort((left, right) => left.displayOrder - right.displayOrder)
  const preAverage = averageProgressValues(competencies.flatMap((item) => item.pre === null ? [] : [item.pre])) ?? 0
  const postAverage = averageProgressValues(competencies.flatMap((item) => item.post === null ? [] : [item.post])) ?? 0
  return {
    activityId: 0,
    activityCode: '',
    name: language === 'TH' ? `ทุกกิจกรรม (${activities.length} กิจกรรม)` : `All activities (${activities.length})`,
    activityDate: null,
    preAverage,
    postAverage,
    change: Math.round((postAverage - preAverage) * 100) / 100,
    competencies,
  } satisfies UserProgressActivity
}


function ProgressPrePostChart({ pre, post }: { pre: number; post: number }) {
  const { language, t } = usePortalLanguage()
  const average = Math.round((pre + post) / 2 * 100) / 100
  const change = Math.round((post - pre) * 100) / 100
  const direction = progressDirection(change, language)
  const changeLabel = change > 0 ? t('เพิ่มขึ้นจากเดิม', 'Increase from before') : change < 0 ? t('ลดลงจากเดิม', 'Decrease from before') : t('คะแนนคงเดิม', 'Score unchanged')
  const trendDescription = change > 0 ? t('หลังเข้าร่วมมีคะแนนเฉลี่ยสูงขึ้น', 'The average score increased after participation.') : change < 0 ? t('หลังเข้าร่วมมีคะแนนเฉลี่ยลดลง', 'The average score decreased after participation.') : t('คะแนนเฉลี่ยก่อนและหลังเท่ากัน', 'The PRE and POST averages are equal.')
  const bars = [
    { key: 'pre', label: t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)'), value: pre },
    { key: 'post', label: t('หลังเข้าร่วม (POST)', 'After participation (POST)'), value: post },
  ] as const

  return <div className="user-progress-summary">
    <section className="user-progress-summary__chart" aria-labelledby="progress-average-chart-title">
      <header><span><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span><h3 id="progress-average-chart-title">{t('คะแนนเฉลี่ย PRE และ POST', 'Average PRE and POST scores')}</h3></header>
      <div className="user-progress-bar-chart">
        <div className="user-progress-bar-chart__scale" aria-hidden="true">{[7, 6, 5, 4, 3, 2, 1].map((level) => <span key={level}>{level}</span>)}</div>
        <div className="user-progress-bar-chart__plot">
          <div className="user-progress-bar-chart__grid" aria-hidden="true">{[7, 6, 5, 4, 3, 2, 1].map((level) => <i key={level} />)}</div>
          <div className="user-progress-bar-chart__columns">{bars.map((bar) => {
            const height = Math.min(100, Math.max(0, bar.value / 7 * 100))
            return <div className={`user-progress-bar-chart__column is-${bar.key}`} key={bar.key}><div><strong style={{ bottom: `calc(${height}% + 9px)` }}>{progressScore(bar.value)}</strong><i style={{ height: `${height}%` }} /></div><span>{bar.label}</span></div>
          })}</div>
        </div>
      </div>
    </section>

    <aside className="user-progress-summary__stats" aria-label={t('สรุปการเปลี่ยนแปลง', 'Change summary')}>
      <article className={`user-progress-summary-stat is-change ${direction.className}`}><span><img className="user-trend-artwork" src={progressNavIcon} alt="" /></span><div><small>{changeLabel}</small><strong>{progressChange(change)}</strong><p>{t('คะแนนเฉลี่ย POST − PRE', 'Average POST − PRE score')}</p></div></article>
      <article className="user-progress-summary-stat is-average"><span><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span><div><small>{t('คะแนนเฉลี่ยรวม PRE + POST', 'Combined PRE + POST average')}</small><strong>{progressScore(average)} <em>/ 7</em></strong><p>{t('จากคะแนนเต็ม 7 คะแนน', 'Maximum score: 7')}</p></div></article>
      <article className="user-progress-summary-stat is-trend"><span><img className="user-trend-artwork" src={progressNavIcon} alt="" /></span><div><small>{t('แนวโน้ม', 'Trend')}</small><strong>{direction.label}</strong><p>{trendDescription}</p></div></article>
    </aside>
  </div>
}


function ProgressCompetencyResults({ competencies }: { competencies: UserProgressActivity['competencies'] }) {
  const { language, t } = usePortalLanguage()
  const orderedCompetencies = [...competencies].sort((left, right) => left.displayOrder - right.displayOrder)

  return <section className="user-assessment-results user-progress-assessment" aria-labelledby="user-progress-assessment-title">
    <header className="user-assessment-results__header">
      <span className="user-assessment-results__icon" aria-hidden="true"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span>
      <div className="user-assessment-results__heading"><small>ASSESSMENT RESULTS</small><h2 id="user-progress-assessment-title">{t('ผลการประเมินทักษะ', 'Skill assessment results')}</h2><p>{t('เปรียบเทียบคะแนนก่อนและหลังเข้าร่วมกิจกรรมในแต่ละสมรรถนะ', 'Compare PRE and POST scores for each competency.')}</p></div>
      <div className="user-assessment-results__legend" aria-label={t('คำอธิบายผลการประเมิน', 'Assessment legend')}>
        <span className="is-pre"><i /><b>{t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)')}</b><small>{t('คะแนนเฉลี่ยก่อนเข้าร่วม', 'Average PRE score')}</small></span>
        <span className="is-post"><i /><b>{t('หลังเข้าร่วม (POST)', 'After participation (POST)')}</b><small>{t('คะแนนเฉลี่ยหลังเข้าร่วม', 'Average POST score')}</small></span>
      </div>
      <div className="user-assessment-results__maximum"><small>{t('คะแนนเต็ม', 'Maximum')}</small><strong>{t('7 คะแนน', '7 points')}</strong></div>
    </header>
    <div className="user-assessment-results__grid">
      {orderedCompetencies.map((competency) => {
        const change = competency.pre !== null && competency.post !== null ? Math.round((competency.post - competency.pre) * 10) / 10 : null
        const direction = progressDirection(change ?? 0, language)
        const changeClass = change === null ? 'is-unavailable' : direction.className
        const changeText = change === null ? '—' : (change > 0 ? '+' : '') + change.toFixed(1)
        const preText = competency.pre === null ? '—' : competency.pre.toFixed(1)
        const postText = competency.post === null ? '—' : competency.post.toFixed(1)
        const preWidth = Math.min(100, Math.max(0, (competency.pre ?? 0) / 7 * 100)) + '%'
        const postWidth = Math.min(100, Math.max(0, (competency.post ?? 0) / 7 * 100)) + '%'

        return <article className="user-assessment-skill" key={competency.competencyId}>
          <div className="user-assessment-skill__heading"><span>{competency.displayOrder}</span><h3>{localizedCompetencyName(competency.name, competency.displayOrder, language)}</h3></div>
          <div className="user-assessment-skill__body">
            <div className="user-assessment-skill__scores">
              <div className="user-assessment-score is-pre" aria-label={t(`คะแนน PRE ${preText} จาก 7`, `PRE score ${preText} out of 7`)}><b>PRE</b><i><em style={{ width: preWidth }} /></i><span><strong>{preText}</strong><small>/ 7</small></span></div>
              <div className="user-assessment-score is-post" aria-label={t(`คะแนน POST ${postText} จาก 7`, `POST score ${postText} out of 7`)}><b>POST</b><i><em style={{ width: postWidth }} /></i><span><strong>{postText}</strong><small>/ 7</small></span></div>
            </div>
            <div className={'user-assessment-skill__change ' + changeClass} aria-label={t(`ผลต่าง ${changeText}`, `Difference ${changeText}`)}><img className="user-trend-artwork" src={progressNavIcon} alt="" /><strong>{changeText}</strong><small>{t('ผลต่าง', 'Difference')}</small></div>
          </div>
        </article>
      })}
    </div>
  </section>
}


type ProgressJourneyFilter = 'all' | 'positive' | 'negative'

function ProgressJourney({ activities, onSelect }: { activities: UserProgressActivity[]; onSelect: (activityId: number) => void }) {
  const { language, t } = usePortalLanguage()
  const [trendFilter, setTrendFilter] = useState<ProgressJourneyFilter>('all')
  const [selectedActivityIds, setSelectedActivityIds] = useState<number[]>([])
  const [activityFilterOpen, setActivityFilterOpen] = useState(false)
  const activityFilterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activityFilterOpen) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!activityFilterRef.current?.contains(event.target as Node)) setActivityFilterOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActivityFilterOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [activityFilterOpen])

  const orderedActivities = [...activities].sort((left, right) => String(left.activityDate ?? '').localeCompare(String(right.activityDate ?? '')))
  const trendActivities = orderedActivities.filter((activity) => trendFilter === 'all' || (trendFilter === 'positive' ? activity.change > 0 : activity.change < 0))
  const selectedSet = new Set(selectedActivityIds)
  const filteredActivities = selectedActivityIds.length ? trendActivities.filter((activity) => selectedSet.has(activity.activityId)) : trendActivities.slice(0, 3)

  const toggleActivity = (activityId: number) => {
    setSelectedActivityIds((current) => {
      if (current.includes(activityId)) return current.filter((id) => id !== activityId)
      return current.length >= 3 ? current : [...current, activityId]
    })
  }

  return <section className="user-progress-panel user-progress-timeline" aria-labelledby="user-progress-journey-title">
    <header>
      <div className="user-progress-timeline__heading"><span>MY JOURNEY</span><h2 id="user-progress-journey-title">{t('เส้นทางพัฒนาการของฉัน', 'My development journey')}</h2><p>{t('แสดงกิจกรรมที่ทำครบทั้ง Pre-test และ Post-test เลือกดูพร้อมกันได้สูงสุด 3 กิจกรรม', 'View activities with completed PRE and POST tests. Select up to 3 activities at once.')}</p></div>
      <div className="user-progress-timeline__filters">
        <div className="user-progress-trend-filter" role="group" aria-label={t('กรองตามแนวโน้ม', 'Filter by trend')}>
          <span aria-hidden="true"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span>
          {([
            { value: 'all', label: t('ทั้งหมด', 'All') },
            { value: 'positive', label: t('พัฒนาขึ้น', 'Improved') },
            { value: 'negative', label: t('ลดลง', 'Declined') },
          ] as const).map((filter) => <button type="button" key={filter.value} className={trendFilter === filter.value ? 'is-active' : ''} aria-pressed={trendFilter === filter.value} onClick={() => setTrendFilter(filter.value)}>{filter.label}</button>)}
        </div>
        <div className="user-progress-activity-filter" ref={activityFilterRef}>
          <button type="button" className="user-progress-activity-filter__trigger" aria-haspopup="dialog" aria-expanded={activityFilterOpen} onClick={() => setActivityFilterOpen((open) => !open)}><Icon name="activities" /><span>{selectedActivityIds.length ? t(`เลือกแล้ว ${selectedActivityIds.length}/3`, `Selected ${selectedActivityIds.length}/3`) : t('เลือกกิจกรรม', 'Select activities')}</span><Icon name="chevronRight" /></button>
          {activityFilterOpen && <><button type="button" className="user-progress-activity-filter__backdrop" aria-label={t('ปิดตัวเลือกกิจกรรม', 'Close activity selector')} onClick={() => setActivityFilterOpen(false)} /><div className="user-progress-activity-filter__menu" role="dialog" aria-label={t('เลือกกิจกรรมที่ต้องการแสดง', 'Select activities to display')}>
            <header><div><strong>{t('เลือกกิจกรรม', 'Select activities')}</strong><small>{t('เลือกได้สูงสุด 3 กิจกรรม', 'Select up to 3 activities')}</small></div><span>{selectedActivityIds.length}/3</span></header>
            <div>{orderedActivities.map((activity) => {
              const selected = selectedSet.has(activity.activityId)
              const disabled = !selected && selectedActivityIds.length >= 3
              return <button type="button" key={activity.activityId} className={selected ? 'is-selected' : ''} disabled={disabled} aria-pressed={selected} onClick={() => toggleActivity(activity.activityId)}><i aria-hidden="true">{selected ? '✓' : ''}</i><span><b>{localizedActivityName(activity, language)}</b><small>{formatDate(activity.activityDate, language)}</small></span></button>
            })}</div>
            <footer><button type="button" disabled={!selectedActivityIds.length} onClick={() => setSelectedActivityIds([])}>{t('ล้างการเลือก', 'Clear selection')}</button><small>{selectedActivityIds.length ? t('กำลังแสดงกิจกรรมที่เลือก', 'Showing selected activities') : t('ค่าเริ่มต้นแสดง 3 กิจกรรมแรก', 'Showing the first 3 activities by default')}</small><button type="button" className="is-done" onClick={() => setActivityFilterOpen(false)}>{t('เสร็จสิ้น', 'Done')}</button></footer>
          </div></>}
        </div>
      </div>
    </header>

    <div className="user-progress-timeline__list">
      {filteredActivities.length ? filteredActivities.map((activity) => {
        const itemDirection = progressDirection(activity.change, language)
        return <button type="button" key={activity.activityId} onClick={() => onSelect(activity.activityId)}>
          <i className="user-progress-timeline__dot" aria-hidden="true" />
          <span className="user-progress-timeline__activity"><b>{localizedActivityName(activity, language)}</b><small><Icon name="calendar" />{formatDate(activity.activityDate, language)}</small></span>
          <strong className="user-progress-timeline__scores">{progressScore(activity.preAverage)} <i>→</i> {progressScore(activity.postAverage)}</strong>
          <em className={itemDirection.className}><img className="user-trend-artwork" src={progressNavIcon} alt="" /> {progressChange(activity.change)}</em>
          <Icon name="chevronRight" />
        </button>
      }) : <div className="user-progress-timeline__empty"><Icon name="info" /><strong>{t('ไม่พบกิจกรรมตามตัวกรองนี้', 'No activities match this filter')}</strong><p>{t('ลองเปลี่ยนแนวโน้มหรือล้างกิจกรรมที่เลือก', 'Try another trend or clear the selected activities.')}</p></div>}
    </div>
  </section>
}


export function UserPortalProgress({ onNavigate }: PortalPageProps) {
  const { language, t } = usePortalLanguage()
  const [activities, setActivities] = useState<UserProgressActivity[] | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<number | 'all'>('all')
  const [showAllStrengths, setShowAllStrengths] = useState(false)
  const [showAllDevelopments, setShowAllDevelopments] = useState(false)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const result = await getStudentPortalProgress()
      setError('')
      setActivities(result.activities)
      setSelectedActivityId((current) => current === 'all' || result.activities.some((activity) => activity.activityId === current) ? current : 'all')
    } catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(portalRequestError(requestError, language, 'โหลดข้อมูลพัฒนาการไม่สำเร็จ', 'Unable to load progress data'))
    }
  }, [language, onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  const allActivities = useMemo(() => aggregateProgressActivities(activities ?? [], language), [activities, language])
  const activity = selectedActivityId === 'all' ? allActivities : activities?.find((item) => item.activityId === selectedActivityId) ?? null
  const completedCompetencies = activity?.competencies.filter((item) => item.pre !== null && item.post !== null) ?? []
  const highestPostScore = completedCompetencies.length ? Math.max(...completedCompetencies.map((item) => item.post ?? 0)) : null
  const strengths = completedCompetencies.filter((item) => highestPostScore !== null && item.post === highestPostScore).sort((left, right) => left.displayOrder - right.displayOrder)
  const visibleStrengths = showAllStrengths ? strengths : strengths.slice(0, 1)
  const lowestPostScore = completedCompetencies.length ? Math.min(...completedCompetencies.map((item) => item.post ?? 0)) : null
  const developments = completedCompetencies.filter((item) => lowestPostScore !== null && item.post === lowestPostScore).sort((left, right) => left.displayOrder - right.displayOrder)
  const visibleDevelopments = showAllDevelopments ? developments : developments.slice(0, 1)
  const direction = activity ? progressDirection(activity.change, language) : null
  const showingAllActivities = selectedActivityId === 'all'

  return <PortalShell title="พัฒนาการของฉัน" titleEn="My Progress" eyebrow="MY PROGRESS" active="progress" onNavigate={onNavigate}>
    {activities === null && !error ? <LoadingState label={t('กำลังคำนวณพัฒนาการของคุณ...', 'Calculating your progress...')} /> : error ? <ErrorState message={error} retry={() => void load()} /> : !activities?.length ? <div className="user-portal-state"><strong>{t('ยังไม่มีข้อมูลพัฒนาการ', 'No progress data yet')}</strong><p>{t('เมื่อทำครบทั้ง Pre-test และ Post-test แล้ว ผลพัฒนาการจะแสดงที่นี่', 'Your progress will appear here after you complete both the PRE and POST tests.')}</p></div> : activity && direction && <div className="user-progress-dashboard">
      <section className="user-progress-toolbar">
        <div className="user-progress-toolbar__copy"><span>PERSONAL DEVELOPMENT</span><h2>{t('ภาพรวมการเปลี่ยนแปลงของคุณ', 'Your progress overview')}</h2><p>{t('ทุกก้าวของการเรียนรู้ คือการลงทุนกับอนาคตของคุณ', 'Every step in learning is an investment in your future.')}</p></div>
        <div className="user-progress-toolbar__art" aria-hidden="true"><i /><i /><i /><b /></div>
        <blockquote><b>“</b><span>{t('การพัฒนาไม่ใช่จุดหมาย', 'Development is not a destination')}<br />{t('แต่คือการเดินทางที่ต่อเนื่อง', 'but a continuous journey.')}</span><b>”</b></blockquote>
      </section>

      <section className="user-progress-kpis" aria-label={t('คะแนนสรุป', 'Score summary')}>
        <article className="is-activity"><span className="user-progress-kpi-icon"><Icon name="activities" /></span><div><small>{t('กิจกรรม', 'Activity')}</small><ScrollableSelect id="progress-activity" className="user-progress-activity-select" label={t('เลือกกิจกรรม', 'Select activity')} value={String(selectedActivityId)} options={[{ value: 'all', label: t('ทุกกิจกรรม', 'All activities') }, ...activities.map((item) => ({ value: String(item.activityId), label: localizedActivityName(item, language) }))]} onChange={(activityId) => { setSelectedActivityId(activityId === 'all' ? 'all' : Number(activityId)); setShowAllStrengths(false); setShowAllDevelopments(false) }} /></div></article>
        <article className="is-pre"><span className="user-progress-kpi-icon"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span><div><small>{t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)')}</small><strong>{progressScore(activity.preAverage)}</strong><em>{t('คะแนนเฉลี่ย', 'Average score')}</em></div></article>
        <article className="is-post"><span className="user-progress-kpi-icon"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span><div><small>{t('หลังเข้าร่วม (POST)', 'After participation (POST)')}</small><strong>{progressScore(activity.postAverage)}</strong><em>{t('คะแนนเฉลี่ย', 'Average score')}</em></div></article>
        <article className={direction.className}><span className="user-progress-kpi-icon"><img className="user-trend-artwork" src={progressNavIcon} alt="" /></span><div><small>{t('คะแนนเปลี่ยนแปลง', 'Score change')}</small><strong>{progressChange(activity.change)}</strong><em>POST − PRE</em></div></article>
        <article className={direction.className}><span className="user-progress-kpi-icon"><img className="user-trend-artwork" src={progressNavIcon} alt="" /></span><div><small>{t('แนวโน้ม', 'Trend')}</small><strong className="user-progress-direction">{direction.label}</strong><em>{t('เทียบก่อนเข้าร่วม', 'Compared with PRE')}</em></div></article>
      </section>

      <section className="user-progress-panel user-progress-prepost"><header><div><span>{showingAllActivities ? 'PRE + POST AVERAGE' : 'PRE + POST'}</span><h2>{showingAllActivities ? t('การเปลี่ยนแปลงของคุณ', 'Your score change') : t('เปรียบเทียบคะแนนก่อนและหลัง', 'Compare PRE and POST scores')}</h2><p>{showingAllActivities ? t('เปรียบเทียบค่าเฉลี่ยรวม PRE และ POST บนสเกล 1–7', 'Compare overall PRE and POST averages on a 1–7 scale.') : t('คะแนนเฉลี่ย PRE และ POST ของกิจกรรมที่เลือก บนสเกล 1–7', 'Average PRE and POST scores for the selected activity on a 1–7 scale.')}</p></div><strong className={direction.className}><img className="user-trend-artwork" src={progressNavIcon} alt="" /> {progressChange(activity.change)}</strong></header><ProgressPrePostChart pre={activity.preAverage} post={activity.postAverage} /></section>

      <ProgressCompetencyResults competencies={completedCompetencies} />

      <section className="user-progress-insights" aria-label={t('จุดเด่นและจุดที่ควรพัฒนา', 'Strengths and development areas')}>
        <article className="is-strength">
          <header><span className="user-progress-insight-icon"><img className="user-trend-artwork" src={progressNavIcon} alt="" /></span><div><small>YOUR STRENGTH</small><h2>{t('จุดเด่นของคุณ', 'Your strength')}</h2><p>{t('สมรรถนะที่มีคะแนนหลังเข้าร่วมสูงที่สุด', 'The competency with your highest POST score.')}</p></div></header>
          {strengths.length ? <><ul className="user-progress-strength-list">{visibleStrengths.map((strength) => <li key={strength.competencyId}><span><img src={progressAchievementIcon} alt="" /></span><div><b>{localizedCompetencyName(strength.name, strength.displayOrder, language)}</b><small>{t('คะแนนหลังเข้าร่วม', 'POST score')}</small></div><strong>{progressScore(strength.post)} <em>/ 7</em></strong></li>)}</ul>{strengths.length > 1 && <button type="button" className="user-progress-strength-toggle" aria-expanded={showAllStrengths} onClick={() => setShowAllStrengths((current) => !current)}><i aria-hidden="true">{showAllStrengths ? '−' : '+'}</i>{showAllStrengths ? t('แสดงน้อยลง', 'Show less') : t(`ดูจุดเด่นเพิ่มเติม (${strengths.length - 1})`, `View more strengths (${strengths.length - 1})`)}</button>}</> : <p className="user-progress-insight-empty">{t('ยังไม่มีข้อมูลคะแนนสำหรับวิเคราะห์จุดเด่น', 'There is not enough score data to identify a strength yet.')}</p>}
        </article>
        <article className="is-development">
          <header><span className="user-progress-insight-icon"><img src={progressDevelopmentIcon} alt="" /></span><div><small>DEVELOPMENT AREA</small><h2>{t('จุดที่ควรพัฒนา', 'Area to develop')}</h2><p>{t('สมรรถนะที่มีคะแนนต่ำที่สุดเมื่อเทียบกับด้านอื่น', 'The competency with your lowest score relative to the others.')}</p></div></header>
          {developments.length ? <><ul className="user-progress-development-list">{visibleDevelopments.map((development) => <li key={development.competencyId}><span className={development.change !== null && development.change < 0 ? 'is-decline' : 'is-achievement'}><img src={development.change !== null && development.change < 0 ? progressDeclineIcon : progressAchievementIcon} alt="" /></span><div><b>{localizedCompetencyName(development.name, development.displayOrder, language)}</b><small>{t('คะแนนหลังเข้าร่วม', 'POST score')}</small></div><strong>{progressScore(development.post)} <em>/ 7</em></strong></li>)}</ul>{developments.length > 1 && <button type="button" className="user-progress-strength-toggle is-orange" aria-expanded={showAllDevelopments} onClick={() => setShowAllDevelopments((current) => !current)}><i aria-hidden="true">{showAllDevelopments ? '−' : '+'}</i>{showAllDevelopments ? t('แสดงน้อยลง', 'Show less') : t(`ดูด้านที่ควรพัฒนาเพิ่มเติม (${developments.length - 1})`, `View more development areas (${developments.length - 1})`)}</button>}</> : <p className="user-progress-insight-empty">{t('ยังไม่มีข้อมูลคะแนนสำหรับวิเคราะห์ด้านที่ควรพัฒนา', 'There is not enough score data to identify a development area yet.')}</p>}
        </article>
      </section>

      <ProgressJourney key={activities.map((item) => item.activityId).join(',')} activities={activities} onSelect={(activityId) => { setSelectedActivityId(activityId); setShowAllStrengths(false); setShowAllDevelopments(false) }} />
    </div>}
  </PortalShell>
}


function SkillRadar({ results }: { results: StudentResult[] }) {
  const { language, t } = usePortalLanguage()
  const [selectedCompetency, setSelectedCompetency] = useState<CompetencyResult | null>(null)
  const [hoveredCompetency, setHoveredCompetency] = useState<CompetencyResult | null>(null)
  const [visiblePhases, setVisiblePhases] = useState<Record<'pre' | 'post', boolean>>({ pre: true, post: true })
  const activeCompetency = hoveredCompetency ?? selectedCompetency
  const latest = new Map<'pre' | 'post', StudentResult>()
  for (const result of results) {
    const previous = latest.get(result.phase)
    if (!previous || new Date(result.submittedAt) > new Date(previous.submittedAt)) latest.set(result.phase, result)
  }
  const reference = latest.get('post') ?? latest.get('pre')
  if (!reference || reference.competencies.length < 3) return null
  const competencies = [...reference.competencies].sort((left, right) => left.displayOrder - right.displayOrder)
  const width = 360
  const height = 360
  const centerX = width / 2
  const centerY = height / 2
  const radius = 122
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + index * Math.PI * 2 / competencies.length
    return { x: centerX + Math.cos(angle) * radius * value / 7, y: centerY + Math.sin(angle) * radius * value / 7 }
  }
  const points = (values: Map<number, number>) => competencies.map((item, index) => point(index, values.get(item.competencyId) ?? 0)).map((item) => `${item.x},${item.y}`).join(' ')
  const series = (['pre', 'post'] as const).flatMap((phase) => { const result = latest.get(phase); return result ? [{ phase, values: new Map(result.competencies.map((item) => [item.competencyId, item.levelValue])) }] : [] })
  const visibleSeries = series.filter((item) => visiblePhases[item.phase])
  const activeScores = activeCompetency ? visibleSeries.flatMap((item) => { const score = item.values.get(activeCompetency.competencyId); return score === undefined ? [] : [{ phase: item.phase, score }] }) : []

  return <section className="user-portal-radar" aria-labelledby="skill-radar-title">
    <header className="user-portal-radar__header">
      <span className="user-portal-radar__header-icon" aria-hidden="true"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span>
      <div className="user-portal-radar__heading-copy"><small>SKILL RADAR</small><h2 id="skill-radar-title">{t('ภาพรวมทักษะ', 'Skill overview')}</h2><p>{t('เปรียบเทียบคะแนนแต่ละสมรรถนะบนสเกล 1–7', 'Compare competency scores on a 1–7 scale.')}</p></div>
      <div className="user-portal-radar__legend" role="group" aria-label={t('เลือกข้อมูลที่แสดงในกราฟ', 'Choose data shown in the chart')}>{series.map((item) => <button type="button" key={item.phase} className={`${item.phase}${visiblePhases[item.phase] ? ' is-visible' : ' is-hidden'}`} aria-pressed={visiblePhases[item.phase]} onClick={() => setVisiblePhases((current) => ({ ...current, [item.phase]: !current[item.phase] }))}>{item.phase === 'pre' ? t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)') : t('หลังเข้าร่วม (POST)', 'After participation (POST)')}</button>)}</div>
    </header>
    <div className="user-portal-radar__chart">
      {activeCompetency && <div className="user-portal-radar__tooltip" role="tooltip"><strong>{activeCompetency.displayOrder}</strong><div className="user-portal-radar__tooltip-content"><span>{localizedCompetencyName(activeCompetency.name, activeCompetency.displayOrder, language)}</span><div className="user-portal-radar__tooltip-values">{activeScores.map((item) => <em className={item.phase} key={item.phase}>{item.phase.toUpperCase()} {item.score.toFixed(1)}</em>)}</div></div></div>}
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={t('กราฟเรดาร์แสดงคะแนนทักษะ PRE และ POST', 'Radar chart of PRE and POST competency scores')}>
        {[1, 2, 3, 4, 5, 6, 7].map((level) => <circle key={level} className="user-portal-radar__ring" cx={centerX} cy={centerY} r={radius * level / 7} />)}
        {competencies.map((item, index) => {
          const end = point(index, 7)
          const label = point(index, 8.25)
          const isActive = activeCompetency?.competencyId === item.competencyId
          return <g key={item.competencyId} className={`user-portal-radar__label-target${isActive ? ' is-active' : ''}`} role="button" aria-label={`${item.displayOrder}. ${localizedCompetencyName(item.name, item.displayOrder, language)}`} aria-pressed={isActive} onPointerEnter={() => setHoveredCompetency(item)} onPointerLeave={() => setHoveredCompetency(null)} onFocus={() => setHoveredCompetency(item)} onBlur={() => setHoveredCompetency(null)} tabIndex={0} onClick={() => setSelectedCompetency((current) => current?.competencyId === item.competencyId ? null : item)} onKeyDown={(event) => { if (event.key !== 'Enter' && event.key !== ' ') return; event.preventDefault(); setSelectedCompetency((current) => current?.competencyId === item.competencyId ? null : item) }}>
            <line x1={centerX} y1={centerY} x2={end.x} y2={end.y} />
            <circle className="user-portal-radar__label-hit" cx={label.x} cy={label.y} r="18" />
            <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="middle">{item.displayOrder}</text>
          </g>
        })}
        {visibleSeries.map((item) => <g className={`user-portal-radar__series ${item.phase}`} key={item.phase}>
          <polygon points={points(item.values)} />
          {competencies.map((competency, index) => {
            const marker = point(index, item.values.get(competency.competencyId) ?? 0)
            return <circle key={`${item.phase}-${competency.competencyId}`} cx={marker.x} cy={marker.y} r="3.5" />
          })}
        </g>)}
        <g className="user-portal-radar__scale" aria-hidden="true">{[1, 2, 3, 4, 5, 6, 7].map((level) => <text key={level} x={centerX + 6} y={centerY - radius * level / 7 + 4}>{level}</text>)}</g>
      </svg>
    </div>
  </section>
}


function ExpandableActivityDescription({ description }: { description: string | null }) {
  const { t } = usePortalLanguage()
  const text = description?.trim() ? description : t('ไม่มีรายละเอียดเพิ่มเติม', 'No additional details')
  const contentRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [canExpand, setCanExpand] = useState(false)
  const [expandedHeight, setExpandedHeight] = useState(0)

  useEffect(() => {
    const content = contentRef.current
    if (!content) return
    const measure = () => {
      const lineHeight = Number.parseFloat(window.getComputedStyle(content).lineHeight) || 27
      const collapsedHeight = lineHeight * 5
      setExpandedHeight(content.scrollHeight)
      setCanExpand(content.scrollHeight > collapsedHeight + 1)
    }
    const frame = window.requestAnimationFrame(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(content)
    return () => { window.cancelAnimationFrame(frame); observer?.disconnect() }
  }, [text])

  return <div className="user-portal-hero__description-block">
    <div className={`user-portal-hero__description${canExpand ? ' has-overflow' : ''}${expanded ? ' is-expanded' : ''}`}><div ref={contentRef} className="user-portal-hero__description-text" style={expanded && expandedHeight ? { maxHeight: `${expandedHeight}px` } : undefined}><RichTextContent value={text} /></div></div>
    {canExpand && <button type="button" className={`user-portal-hero__description-toggle${expanded ? ' is-expanded' : ''}`} aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? t('ย่อรายละเอียด', 'Show less') : t('ดูเพิ่มเติม', 'Read more')}<Icon name="chevronRight" /></button>}
  </div>
}


type CombinedCompetencyResult = {
  competencyId: number
  name: string
  displayOrder: number
  pre: number | null
  post: number | null
}

function CombinedAssessmentResults({ results }: { results: StudentResult[] }) {
  const { language, t } = usePortalLanguage()
  const preResult = results.find((result) => result.phase === 'pre') ?? null
  const postResult = results.find((result) => result.phase === 'post') ?? null
  const pairedCompetencies = new Map<number, CombinedCompetencyResult>()

  for (const result of results) {
    for (const competency of result.competencies) {
      const current = pairedCompetencies.get(competency.competencyId) ?? { competencyId: competency.competencyId, name: competency.name, displayOrder: competency.displayOrder, pre: null, post: null }
      pairedCompetencies.set(competency.competencyId, { ...current, [result.phase]: competency.levelValue })
    }
  }

  const competencies = [...pairedCompetencies.values()].sort((left, right) => left.displayOrder - right.displayOrder)
  const phaseLabel = (result: StudentResult | null, phase: 'pre' | 'post') => result ? formatDateTime(result.submittedAt, language) : t(`ยังไม่มีผล ${phase.toUpperCase()}`, `No ${phase.toUpperCase()} result yet`)

  return <section className="user-assessment-results" aria-labelledby="user-assessment-results-title">
    <header className="user-assessment-results__header">
      <span className="user-assessment-results__icon" aria-hidden="true"><img className="user-bar-chart-artwork" src={barChartArtwork} alt="" /></span>
      <div className="user-assessment-results__heading"><small>ASSESSMENT RESULTS</small><h2 id="user-assessment-results-title">{t('ผลการประเมินทักษะ', 'Skill assessment results')}</h2><p>{t('เปรียบเทียบคะแนนก่อนและหลังเข้าร่วมกิจกรรมในแต่ละสมรรถนะ', 'Compare PRE and POST scores for each competency.')}</p></div>
      <div className="user-assessment-results__legend" aria-label={t('คำอธิบายผลการประเมิน', 'Assessment legend')}>
        <span className="is-pre"><i /><b>{t('ก่อนเข้าร่วม (PRE)', 'Before participation (PRE)')}</b><small>{phaseLabel(preResult, 'pre')}</small></span>
        <span className="is-post"><i /><b>{t('หลังเข้าร่วม (POST)', 'After participation (POST)')}</b><small>{phaseLabel(postResult, 'post')}</small></span>
      </div>
      <div className="user-assessment-results__maximum"><small>{t('คะแนนเต็ม', 'Maximum')}</small><strong>{t('7 คะแนน', '7 points')}</strong></div>
    </header>
    <div className="user-assessment-results__grid">
      {competencies.map((competency) => {
        const change = competency.pre !== null && competency.post !== null ? Math.round((competency.post - competency.pre) * 10) / 10 : null
        const direction = progressDirection(change ?? 0, language)
        const changeClass = change === null ? 'is-unavailable' : direction.className
        const changeText = change === null ? '—' : (change > 0 ? '+' : '') + change.toFixed(1)
        const preText = competency.pre === null ? '—' : competency.pre.toFixed(1)
        const postText = competency.post === null ? '—' : competency.post.toFixed(1)
        const preWidth = Math.min(100, Math.max(0, (competency.pre ?? 0) / 7 * 100)) + '%'
        const postWidth = Math.min(100, Math.max(0, (competency.post ?? 0) / 7 * 100)) + '%'
        return <article className="user-assessment-skill" key={competency.competencyId}>
          <div className="user-assessment-skill__heading"><span>{competency.displayOrder}</span><h3>{localizedCompetencyName(competency.name, competency.displayOrder, language)}</h3></div>
          <div className="user-assessment-skill__body">
            <div className="user-assessment-skill__scores">
              <div className="user-assessment-score is-pre" aria-label={t(`คะแนน PRE ${competency.pre === null ? 'ยังไม่มีข้อมูล' : preText + ' จาก 7'}`, `PRE score ${competency.pre === null ? 'unavailable' : preText + ' out of 7'}`)}><b>PRE</b><i><em style={{ width: preWidth }} /></i><span><strong>{preText}</strong><small>/ 7</small></span></div>
              <div className="user-assessment-score is-post" aria-label={t(`คะแนน POST ${competency.post === null ? 'ยังไม่มีข้อมูล' : postText + ' จาก 7'}`, `POST score ${competency.post === null ? 'unavailable' : postText + ' out of 7'}`)}><b>POST</b><i><em style={{ width: postWidth }} /></i><span><strong>{postText}</strong><small>/ 7</small></span></div>
            </div>
            <div className={'user-assessment-skill__change ' + changeClass} aria-label={t(`ผลต่าง ${changeText}`, `Difference ${changeText}`)}><img className="user-trend-artwork" src={progressNavIcon} alt="" /><strong>{changeText}</strong><small>{t('ผลต่าง', 'Difference')}</small></div>
          </div>
        </article>
      })}
    </div>
  </section>
}


export function UserPortalActivityDetail({ activityId, onNavigate }: PortalPageProps & { activityId: number }) {
  const { language, t } = usePortalLanguage()
  const [activity, setActivity] = useState<UserActivityDetail | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const result = await getStudentPortalActivity(activityId)
      setError('')
      setActivity(result.activity)
    } catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      if (requestError instanceof StudentPortalApiError && requestError.status === 404) {
        setError(t('ไม่พบกิจกรรมนี้ หรือคุณไม่มีสิทธิ์ดูข้อมูล', 'This activity was not found, or you do not have permission to view it.'))
      } else {
        setError(portalRequestError(requestError, language, 'โหลดข้อมูลไม่สำเร็จ', 'Unable to load activity details'))
      }
    }
  }, [activityId, language, onNavigate, t])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  return <PortalShell title="รายละเอียดกิจกรรม" titleEn="Activity Details" eyebrow="ACTIVITY DETAIL" active="activities" onNavigate={onNavigate}>
    <button type="button" className="user-portal-back" onClick={() => onNavigate('/user/activities')}><Icon name="chevronLeft" />{t('กลับไปกิจกรรมทั้งหมด', 'Back to all activities')}</button>
    {!activity && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : activity && <>
      <section className="user-portal-hero">
        <div className="user-portal-hero__media">{activity.imageData ? <img src={activity.imageData} alt="" /> : <img className="is-placeholder" src={studentPortalLogo} alt="SEDA" />}</div>
        <article><small>{activity.activityCode ?? t('กิจกรรมนักศึกษา', 'Student activity')}</small><h2>{localizedActivityName(activity, language)}</h2><ExpandableActivityDescription key={`${activity.activityId}:${language}:${localizedActivityDetail(activity, language)}`} description={localizedActivityDetail(activity, language)} /><dl><div><dt>{t('วันที่จัด', 'Activity date')}</dt><dd>{formatDate(activity.startDate, language)}</dd></div><div><dt>{t('สถานที่', 'Location')}</dt><dd>{localizedActivityLocation(activity, language) ?? t('ไม่ระบุสถานที่', 'Location not specified')}</dd></div></dl></article>
      </section>
      {activity.results.length > 0 && <SkillRadar results={activity.results} />}
      <div className="user-portal-result-list">{activity.results.length ? <CombinedAssessmentResults results={activity.results} /> : <div className="user-portal-state"><p>{t('กิจกรรมนี้ยังไม่มีผลการประเมิน', 'This activity has no assessment results yet.')}</p></div>}</div>
    </>}
  </PortalShell>
}


function maskEmail(value: string, language: PortalLanguage) {
  const [name, domain] = value.split('@')
  return domain ? `${name.slice(0, 2)}${'•'.repeat(Math.max(3, name.length - 2))}@${domain}` : language === 'TH' ? 'ไม่ระบุ' : 'Not specified'
}

function maskPhone(value: string | null, language: PortalLanguage) {
  return value && value.length >= 4 ? `${value.slice(0, 3)}-•••-${value.slice(-4)}` : language === 'TH' ? 'ไม่ระบุ' : 'Not specified'
}

function maskName(value: string, language: PortalLanguage) {
  const normalized = value.trim()
  if (!normalized) return language === 'TH' ? 'ไม่ระบุ' : 'Not specified'
  return normalized.split(/\s+/).map((part) => {
    const visibleLength = Math.min(2, Math.max(1, part.length - 1))
    return `${part.slice(0, visibleLength)}${'•'.repeat(Math.max(2, part.length - visibleLength))}`
  }).join(' ')
}

function profileValue(value: string | null, language: PortalLanguage) {
  if (!value) return language === 'TH' ? 'ไม่ระบุ' : 'Not specified'
  if (language === 'TH') return value
  const knownValues: Record<string, string> = {
    'ปริญญาตรี': "Bachelor's degree",
    'ปริญญาโท': "Master's degree",
    'ปริญญาเอก': 'Doctoral degree',
  }
  return knownValues[value.trim()] ?? value
}

export function UserPortalProfile({ onNavigate }: PortalPageProps) {
  const { language, t } = usePortalLanguage()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [error, setError] = useState('')
  const load = useCallback(async () => {
    try {
      const result = await getStudentPortalProfile()
      setError('')
      setProfile(result.profile)
    } catch (requestError) {
      if (isSessionError(requestError)) { onNavigate('/user/login', true); return }
      setError(portalRequestError(requestError, language, 'โหลดโปรไฟล์ไม่สำเร็จ', 'Unable to load profile'))
    }
  }, [language, onNavigate])
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [load])

  return <PortalShell title="โปรไฟล์ของฉัน" titleEn="My Profile" eyebrow="MY PROFILE" active="profile" onNavigate={onNavigate}>
    {!profile && !error ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void load()} /> : profile && <div className="user-portal-profile">
      <section className="user-profile-identity">
        <small>STUDENT PROFILE</small>
        <div className="user-profile-avatar-frame"><div className="user-portal-avatar"><Icon name="person" /></div><i aria-hidden="true" /><i aria-hidden="true" /></div>
        <b className="user-profile-verified"><Icon name="check" />{t('ยืนยันตัวตนแล้ว', 'Identity verified')}</b>
        <h2>{maskName(profile.firstName, language)} {maskName(profile.lastName, language)}</h2>
        <span>{t('รหัสนักศึกษา', 'Student ID')}</span>
        <p>{profile.studentCode}</p>
      </section>
      <article className="user-profile-details">
        <header>
          <div><small>{t('ข้อมูลส่วนตัว', 'PERSONAL INFORMATION')}</small><h2>{t('ข้อมูลที่ลงทะเบียนไว้', 'Registered information')}</h2><p>{t('ข้อมูลส่วนตัวที่เชื่อมต่อกับระบบกิจกรรมของคุณ', 'Personal information linked to your activity account.')}</p></div>
          <b><Icon name="lock" />{t('อ่านอย่างเดียว', 'Read only')}</b>
        </header>
        <dl>
          <div><span className="user-profile-field-icon"><img className="is-email" src={gmailProfileIcon} alt="" /></span><div><dt>{t('อีเมล', 'Email')}</dt><dd>{maskEmail(profile.email, language)}</dd></div></div>
          <div><span className="user-profile-field-icon"><img className="is-phone" src={phoneProfileIcon} alt="" /></span><div><dt>{t('เบอร์โทร', 'Phone number')}</dt><dd>{maskPhone(profile.phone, language)}</dd></div></div>
          <div><span className="user-profile-field-icon"><img className="is-faculty" src={facultyProfileIcon} alt="" /></span><div><dt>{t('สำนักวิชา', 'Institute')}</dt><dd>{profileValue(profile.faculty, language)}</dd></div></div>
          <div><span className="user-profile-field-icon"><img className="is-major" src={majorProfileIcon} alt="" /></span><div><dt>{t('สาขา', 'Program')}</dt><dd>{profileValue(profile.major, language)}</dd></div></div>
          <div><span className="user-profile-field-icon"><img className="is-education" src={degreeProfileIcon} alt="" /></span><div><dt>{t('ระดับการศึกษา', 'Education level')}</dt><dd>{profileValue(profile.educationLevel, language)}</dd></div></div>
          <div><span className="user-profile-field-icon"><Icon name="participants" /></span><div><dt>{t('ชั้นปี', 'Year of study')}</dt><dd>{profile.studyYear ? t(`ปี ${profile.studyYear}`, `Year ${profile.studyYear}`) : t('ไม่ระบุ', 'Not specified')}</dd></div></div>
        </dl>
        <aside><span><Icon name="shield" /></span><div><strong>{t('การคุ้มครองข้อมูลส่วนบุคคล', 'Personal data protection')}</strong><p>{t('ระบบแสดงเฉพาะข้อมูลที่จำเป็น หากข้อมูลไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ', 'Only essential information is displayed. If anything is incorrect, please contact the system administrator.')}</p></div></aside>
      </article>
    </div>}
  </PortalShell>
}
