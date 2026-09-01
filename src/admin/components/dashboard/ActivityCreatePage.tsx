import { useCallback, useEffect, useState } from 'react'
import { createActivity, getActiveSurveyTemplates, getActivity, updateActivity } from '../../../lib/api'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import ActivityForm from './ActivityForm'
import { emptyActivityForm, type ActivityFormValues } from './activityFormModel'

type Props = {
  activityId?: number
  adminEmail: string
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
  onRouteNavigate: (path: string) => void
  onSettings: () => void
}

function ActivityCreatePage({ activityId, adminEmail, onLogout, onNavigate, onRouteNavigate, onSettings }: Props) {
  const [initialValues, setInitialValues] = useState<ActivityFormValues | null>(activityId ? null : emptyActivityForm)
  const [templates, setTemplates] = useState<Array<{ id: number; name: string }>>([])
  const [isDirty, setIsDirty] = useState(false)
  const [notice, setNotice] = useState('')
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useEffect(() => {
    getActiveSurveyTemplates().then(setTemplates).catch((error) => setNotice(error instanceof Error ? error.message : 'โหลดแบบประเมินไม่ได้'))
    if (activityId) getActivity(activityId).then((activity) => {
      setInitialValues({
        name: activity.name, detail: activity.detail, imageData: activity.imageData, assessmentImageData: activity.assessmentImageData, formTheme: activity.formTheme, location: activity.location,
        startDate: activity.startDate, surveyTemplateId: activity.surveyTemplateId, targetGroup: activity.targetGroup,
        participantLimit: activity.participantLimit, preTestDurationMinutes: activity.preTestDurationMinutes,
        postTestDurationMinutes: activity.postTestDurationMinutes,
      })
      setCreatedAt(activity.createdAt)
    }).catch((error) => setNotice(error instanceof Error ? error.message : 'โหลดกิจกรรมไม่ได้'))
  }, [activityId])

  const confirmLeave = useCallback(() => !isDirty || window.confirm('มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?'), [isDirty])
  const route = (path: string) => { if (confirmLeave()) onRouteNavigate(path) }
  const nav = (item: DashboardNav) => { if (confirmLeave()) onNavigate(item) }
  const handleSubmit = async (values: ActivityFormValues, intent: 'draft' | 'continue') => {
    const activity = activityId ? await updateActivity(activityId, values) : await createActivity(values)
    setInitialValues(values); setIsDirty(false)
    setCreatedAt(activity.createdAt)
    if (intent === 'continue') onRouteNavigate(`/admin/activities/${activity.id}`)
  }

  return <DashboardLayout activeNav="Activities" adminEmail={adminEmail} onLogout={onLogout} onNavigate={nav}
    onSettings={() => { if (confirmLeave()) onSettings() }} search="" onSearchChange={() => undefined} notice={notice}
    onCloseNotice={() => setNotice('')} onDemoAction={() => undefined}>
    <div className="activity-form-page">
      <div className="activities-page-heading activity-form-page-heading"><div><span className="activity-form-eyebrow">Activity form</span><h1>{activityId ? 'แก้ไขกิจกรรม' : 'สร้างกิจกรรมใหม่'}</h1><p>กรอกข้อมูลตามต้องการ แล้วแอดมินสามารถเปิดหรือปิดกิจกรรมได้ด้วยตนเองทุกเมื่อ</p></div></div>
      {!initialValues ? <div className="dashboard-loading" role="status">กำลังโหลดข้อมูลกิจกรรม...</div> : <ActivityForm key={`${activityId ?? 'new'}-${JSON.stringify(initialValues)}`} createdAt={createdAt} initialValues={initialValues} templates={templates} submitLabel={activityId ? 'บันทึกการแก้ไข' : 'Save Draft'} onDirtyChange={setIsDirty} onCancel={() => route('/admin/activities')} onSubmit={handleSubmit} />}
    </div>
  </DashboardLayout>
}

export default ActivityCreatePage
