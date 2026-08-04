import { useMemo, useState, type FormEvent } from 'react'
import Button from '../ui/Button'
import Icon from '../ui/Icon'
import DatePickerField from '../ui/DatePickerField'
import DurationPickerField from '../ui/DurationPickerField'
import DashboardLayout from '../layout/DashboardLayout'
import type { DashboardNav } from '../layout/DashboardSidebar'
import { createActivity } from '../../lib/api'

type ActivityCreatePageProps = {
  adminEmail: string
  onLogout: () => void
  onNavigate: (item: DashboardNav) => void
}

const targetGroups = [
  { value: 'นักเรียนทั่วไป', label: 'นักเรียนทั่วไป', capacity: 45 },
  { value: 'Internal Training', label: 'Internal Training', capacity: 30 },
  { value: 'Academic Program', label: 'Academic Program', capacity: 200 },
]

function ActivityCreatePage({ adminEmail, onLogout, onNavigate }: ActivityCreatePageProps) {
  const [search, setSearch] = useState('')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [preTestDurationMinutes, setPreTestDurationMinutes] = useState(15)
  const [postTestDurationMinutes, setPostTestDurationMinutes] = useState(15)
  const [targetGroup, setTargetGroup] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const selectedGroup = useMemo(
    () => targetGroups.find((group) => group.value === targetGroup),
    [targetGroup],
  )

  const showDemoMessage = (label: string) => {
    setError(`${label} จะพร้อมใช้งานในขั้นถัดไป`)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      await createActivity({
        name: name.trim(),
        detail: description.trim(),
        activityDate: eventDate || null,
        preTestDurationMinutes,
        postTestDurationMinutes,
        targetGroup: targetGroup || null,
        participantLimit: selectedGroup?.capacity ?? 0,
        status: 'draft',
      })
      onNavigate('Dashboard')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถบันทึกกิจกรรมได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formattedDate = eventDate
    ? new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(`${eventDate}T00:00:00`),
      )
    : 'ยังไม่ได้กำหนด'

  return (
    <DashboardLayout
      activeNav="Activities"
      adminEmail={adminEmail}
      onCloseNotice={() => setError('')}
      onDemoAction={showDemoMessage}
      onLogout={onLogout}
      onNavigate={onNavigate}
      onSearchChange={setSearch}
      search={search}
      notice={error}
    >
      <div className="activity-create-breadcrumb">
        <span>Activities</span>
        <span aria-hidden="true">›</span>
        <strong>New Activity</strong>
      </div>

      <div className="activity-create-heading">
        <div>
          <h1>Create New Activity</h1>
          <p>Set up a new structured activity for student skills assessment.</p>
        </div>
        <div className="activity-draft-status">
          <span>DRAFT STATUS</span>
          <strong>Not Started</strong>
          <Icon name="draft" />
        </div>
      </div>

      <div className="activity-create-grid">
        <form className="activity-form panel" onSubmit={handleSubmit}>
          <div className="activity-form-steps" aria-label="Activity setup steps">
            <div className="activity-step activity-step--active">
              <span>1</span><strong>Basic Details</strong>
            </div>
            <i aria-hidden="true" />
            <div className="activity-step">
              <span>2</span><strong>Scheduling</strong>
            </div>
            <i aria-hidden="true" />
            <div className="activity-step">
              <span>3</span><strong>Target Groups</strong>
            </div>
          </div>

          <div className="activity-form-body">
            <label className="activity-form-field">
              <span>Activity Name <b>*</b></span>
              <input
                autoFocus
                maxLength={255}
                minLength={2}
                placeholder="e.g., Annual Leadership Workshop"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="activity-form-field">
              <span>Description <b>*</b></span>
              <textarea
                maxLength={255}
                minLength={2}
                placeholder="Describe the objectives and learning outcomes of this activity..."
                required
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <div className="activity-form-divider" />

            <label className="activity-form-field">
              <span>วันที่จัดกิจกรรม <b>*</b></span>
              <small className="activity-field-hint">วันที่จัดกิจกรรมและทำแบบประเมิน</small>
              <DatePickerField required value={eventDate || null} onChange={(value) => setEventDate(value ?? '')} />
            </label>

            <div className="activity-time-grid">
              <label className="activity-form-field">
                <span>ระยะเวลาทำ Pre-test <b>*</b></span>
                <small className="activity-field-hint">กำหนดเวลาที่ผู้เข้าร่วมใช้ทำ Pre-test</small>
                <DurationPickerField
                  label="ระยะเวลาทำ Pre-test"
                  value={preTestDurationMinutes}
                  onChange={setPreTestDurationMinutes}
                />
              </label>
              <label className="activity-form-field">
                <span>ระยะเวลาทำ Post-test <b>*</b></span>
                <small className="activity-field-hint">กำหนดเวลาที่ผู้เข้าร่วมใช้ทำ Post-test</small>
                <DurationPickerField
                  label="ระยะเวลาทำ Post-test"
                  value={postTestDurationMinutes}
                  onChange={setPostTestDurationMinutes}
                />
              </label>
            </div>

            <div className="activity-form-divider" />

            <label className="activity-form-field">
              <span>Target Student Group <b>*</b></span>
              <select required value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)}>
                <option value="">Select a group...</option>
                {targetGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
              </select>
            </label>

            <div className="activity-form-actions">
              <Button className="activity-action activity-action--cancel" onClick={() => onNavigate('Dashboard')}>
                Cancel
              </Button>
              <Button className="activity-action activity-action--draft" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button className="activity-action activity-action--primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Saving...' : 'Save & Continue'}
              </Button>
            </div>
          </div>
        </form>

        <aside className="activity-create-aside">
          <section className="activity-tip">
            <Icon name="analytics" className="activity-tip-icon" />
            <h2>Pro Tip</h2>
            <p>Defining specific target groups helps the analytics engine provide more accurate skill gap insights.</p>
            <button type="button" onClick={() => showDemoMessage('Documentation')}>Read documentation <Icon name="external" /></button>
          </section>

          <section className="activity-preview panel">
            <h2>Activity Preview</h2>
            <div className="activity-preview-row">
              <span className="activity-preview-icon"><Icon name="book" /></span>
              <span><small>Title</small><strong>{name || 'Not defined yet'}</strong></span>
            </div>
            <div className="activity-preview-row">
              <span className="activity-preview-icon activity-preview-icon--orange"><Icon name="participants" /></span>
              <span><small>Capacity</small><strong>Up to {selectedGroup?.capacity ?? 45} students</strong></span>
            </div>
            <div className="activity-readiness">
              <div><span>System Readiness</span><b>{name && eventDate && targetGroup ? '80%' : '40%'}</b></div>
              <span><i style={{ width: name && eventDate && targetGroup ? '80%' : '40%' }} /></span>
            </div>
            <p className="activity-preview-date">
              {formattedDate} · Pre-test {preTestDurationMinutes} นาที · Post-test {postTestDurationMinutes} นาที
            </p>
          </section>

          <div className="activity-environment">
            <span aria-hidden="true">◌</span>
            <strong>Learning Environment</strong>
          </div>
        </aside>
      </div>
    </DashboardLayout>
  )
}

export default ActivityCreatePage
