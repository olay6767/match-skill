import { useState, type FormEvent } from 'react'
import Button from '../ui/Button'
import DatePickerField from '../ui/DatePickerField'
import DurationPickerField from '../ui/DurationPickerField'
import type { Activity, ActivityStatus, UpdateActivityInput } from './types'

type EditActivityModalProps = {
  activity: Activity | null
  onClose: () => void
  onSave: (input: UpdateActivityInput) => Promise<void>
}

function EditActivityModal({ activity, onClose, onSave }: EditActivityModalProps) {
  const [name, setName] = useState(activity?.name ?? '')
  const [detail, setDetail] = useState(activity?.detail ?? '')
  const [activityDate, setActivityDate] = useState(activity?.activityDate ?? '')
  const [preTestDurationMinutes, setPreTestDurationMinutes] = useState(activity?.preTestDurationMinutes ?? 15)
  const [postTestDurationMinutes, setPostTestDurationMinutes] = useState(activity?.postTestDurationMinutes ?? 15)
  const [targetGroup, setTargetGroup] = useState(activity?.targetGroup ?? '')
  const [participantLimit, setParticipantLimit] = useState(activity?.participantLimit ?? 0)
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'draft')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!activity) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        detail: detail.trim(),
        activityDate: activityDate || null,
        preTestDurationMinutes,
        postTestDurationMinutes,
        targetGroup: targetGroup.trim() || null,
        participantLimit: Number(participantLimit),
        status,
      })
      onClose()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'ไม่สามารถแก้ไขกิจกรรมได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="edit-activity-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="edit-activity-title">แก้ไขกิจกรรม</h2>
            <p>แก้ไขรายละเอียดแล้วบันทึกลง MariaDB</p>
          </div>
          <Button aria-label="ปิดหน้าต่าง" className="modal-close" onClick={onClose}>×</Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>ชื่อกิจกรรม</span>
            <input autoFocus maxLength={255} minLength={2} required value={name} onChange={(event) => setName(event.target.value)} />
          </label>

          <label className="modal-field">
            <span>รายละเอียด</span>
            <input maxLength={255} value={detail} onChange={(event) => setDetail(event.target.value)} />
          </label>

          <div className="modal-field-grid">
            <label className="modal-field">
              <span>วันที่แบบสอบถาม</span>
              <DatePickerField value={activityDate || null} onChange={(value) => setActivityDate(value ?? '')} />
            </label>
            <label className="modal-field">
              <span>จำนวนผู้เข้าร่วม</span>
              <input min={0} type="number" value={participantLimit} onChange={(event) => setParticipantLimit(Number(event.target.value))} />
            </label>
          </div>

          <div className="modal-field-grid">
            <label className="modal-field">
              <span>ระยะเวลา Pre-test</span>
              <DurationPickerField
                label="ระยะเวลา Pre-test"
                value={preTestDurationMinutes}
                onChange={setPreTestDurationMinutes}
              />
            </label>
            <label className="modal-field">
              <span>ระยะเวลา Post-test</span>
              <DurationPickerField
                label="ระยะเวลา Post-test"
                value={postTestDurationMinutes}
                onChange={setPostTestDurationMinutes}
              />
            </label>
          </div>

          <label className="modal-field">
            <span>กลุ่มเป้าหมาย</span>
            <input maxLength={120} value={targetGroup} onChange={(event) => setTargetGroup(event.target.value)} />
          </label>

          <label className="modal-field">
            <span>สถานะ</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ActivityStatus)}>
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          {error && <p className="modal-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <Button className="modal-button modal-button--secondary" onClick={onClose}>ยกเลิก</Button>
            <Button className="modal-button modal-button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default EditActivityModal
