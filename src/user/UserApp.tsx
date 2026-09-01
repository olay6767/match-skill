import { useEffect } from 'react'
import StudentEntryPage from './components/student/StudentEntryPage'
import StudentAssessmentPage from './components/student/StudentAssessmentPage'
import StudentResultPage from './components/student/StudentResultPage'
import StudentHistoryPage from './components/student/StudentHistoryPage'
import { UserPortalActivities, UserPortalActivityDetail, UserPortalLogin, UserPortalProfile, UserPortalProgress } from './components/userPortal/UserPortalPages'
import { getStudentPortalSession } from './components/userPortal/session'
import RouteRedirect from '../shared/RouteRedirect'
import { usePathname } from '../shared/usePathname'
import UserUsageTracker from './usage/UserUsageTracker'

function userPageTitle(path: string) {
  if (path === '/user/login' || path === '/user' || path === '/') return 'เข้าสู่ระบบนักศึกษา | SEDA Student'
  if (path === '/user/activities') return 'กิจกรรมของฉัน | SEDA Student'
  if (path === '/user/progress') return 'พัฒนาการของฉัน | SEDA Student'
  if (/^\/user\/activities\/\d+$/.test(path)) return 'รายละเอียดกิจกรรม | SEDA Student'
  if (path === '/user/profile') return 'โปรไฟล์ของฉัน | SEDA Student'
  if (path === '/student/history') return 'ประวัติการประเมิน | SEDA Student'
  if (/^\/s\/[^/]+\/assessment$/.test(path)) return 'ทำแบบประเมิน | SEDA Student'
  if (/^\/s\/[^/]+\/result$/.test(path)) return 'ผลการประเมิน | SEDA Student'
  if (path.startsWith('/s/')) return 'แบบประเมินกิจกรรม | SEDA Student'
  return 'SEDA Student'
}

function UserApp() {
  const [path, navigate] = usePathname()
  useEffect(() => { document.title = userPageTitle(path) }, [path])

  const usageTracker = <UserUsageTracker path={path} />

  if (path === '/') return <>{usageTracker}<RouteRedirect to="/user/login" navigate={navigate} /></>
  const isUserPath = path === '/user' || path.startsWith('/user/') || path === '/student/history' || path.startsWith('/s/')
  if (!isUserPath) return <>{usageTracker}<RouteRedirect to="/user/login" navigate={navigate} /></>

  const surveyMatch = path.match(/^\/s\/([^/]+)(?:\/(assessment|result))?$/)
  if (surveyMatch) {
    const token = surveyMatch[1]
    const destination = surveyMatch[2]
    if (destination === 'assessment') return <>{usageTracker}<StudentAssessmentPage key={token} token={token} onNavigate={navigate} /></>
    if (destination === 'result') return <>{usageTracker}<StudentResultPage key={token} token={token} onNavigate={navigate} /></>
    return <>{usageTracker}<StudentEntryPage token={token} onNavigate={navigate} /></>
  }
  if (path === '/student/history') return <>{usageTracker}<StudentHistoryPage /></>
  if (path === '/user/login' || path === '/user') return <>{usageTracker}<UserPortalLogin onNavigate={navigate} /></>
  if (!getStudentPortalSession()) return <>{usageTracker}<UserPortalLogin onNavigate={navigate} returnTo={path} /></>
  if (path === '/user/activities') return <>{usageTracker}<UserPortalActivities onNavigate={navigate} /></>
  if (path === '/user/progress') return <>{usageTracker}<UserPortalProgress onNavigate={navigate} /></>
  const activityMatch = path.match(/^\/user\/activities\/(\d+)$/)
  if (activityMatch) return <>{usageTracker}<UserPortalActivityDetail activityId={Number(activityMatch[1])} onNavigate={navigate} /></>
  if (path === '/user/profile') return <>{usageTracker}<UserPortalProfile onNavigate={navigate} /></>
  return <>{usageTracker}<UserPortalActivities onNavigate={navigate} /></>
}

export default UserApp
