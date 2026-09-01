import { useEffect, useState } from 'react'
import { getActivity, getSurveyTemplate } from '../../../lib/api'
import type { Activity, SurveyTemplate } from '../dashboard/types'
import StudentAssessmentPreview from './StudentAssessmentPreview'

type Props = { onNavigate: (path: string, replace?: boolean) => void }
type PreviewData = { activity: Activity; template: SurveyTemplate; phase: 'pre' | 'post' }

function previewRequest() {
  const parameters = new URLSearchParams(window.location.search)
  const activityId = Number(parameters.get('activityId'))
  const phase = parameters.get('phase') === 'post' ? 'post' as const : 'pre' as const
  if (!Number.isSafeInteger(activityId) || activityId < 1) throw new Error('กรุณาเลือกกิจกรรมที่ต้องการ Preview')
  return { activityId, phase }
}

async function fetchPreviewData(): Promise<PreviewData> {
  const request = previewRequest()
  const activity = await getActivity(request.activityId)
  if (!activity.surveyTemplateId) throw new Error('กิจกรรมนี้ยังไม่ได้เลือกแบบประเมิน')
  return { activity, template: await getSurveyTemplate(activity.surveyTemplateId), phase: request.phase }
}

function AssessmentPreviewPage({ onNavigate }: Props) {
  const [data, setData] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    try { setData(await fetchPreviewData()) }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดตัวอย่างแบบประเมินได้') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    let active = true
    fetchPreviewData().then((result) => { if (active) setData(result) })
      .catch((requestError) => { if (active) setError(requestError instanceof Error ? requestError.message : 'ไม่สามารถโหลดตัวอย่างแบบประเมินได้') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  if (loading) return <main className="assessment-preview-route-state" role="status"><img src="/seda-logo.png" alt="SEDA" /><h1>กำลังเตรียม Preview</h1><p>โปรดรอสักครู่</p></main>
  if (error || !data) return <main className="assessment-preview-route-state"><img src="/seda-logo.png" alt="SEDA" /><h1>เปิด Preview ไม่สำเร็จ</h1><p role="alert">{error || 'ไม่พบข้อมูลกิจกรรม'}</p><div><button type="button" onClick={() => onNavigate('/admin/assessments')}>กลับไปเลือกกิจกรรม</button><button type="button" onClick={() => void load()}>ลองใหม่</button></div></main>
  return <StudentAssessmentPreview activity={data.activity} template={data.template} phase={data.phase} onClose={() => onNavigate('/admin/assessments')} />
}

export default AssessmentPreviewPage
