import { useState, type FormEvent } from 'react'
import Button from '../ui/Button'
import type { ActivityStatus, CreateActivityInput } from './types'

type CreateActivityModalProps = {
  isOpen: boolean
  onClose: () => void
  onCreate: (input: CreateActivityInput) => Promise<void>
}

const today = () => new Date().toISOString().slice(0, 10)

function CreateActivityModal({ isOpen, onClose, onCreate }: CreateActivityModalProps) {
  const [name, setName] = useState('')
  const [detail, setDetail] = useState('')
  const [activityDate, setActivityDate] = useState(today)
  const [participantLimit, setParticipantLimit] = useState(0)
  const [status, setStatus] = useState<ActivityStatus>('draft')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onCreate({
        name: name.trim(),
        detail: detail.trim(),
        activityDate: activityDate || null,
        participantLimit,
        status,
      })
      setName('')
      setDetail('')
      setActivityDate(today())
      setParticipantLimit(0)
      setStatus('draft')
      onClose()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'ไม่สามารถสร้างกิจกรรมได้')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="create-activity-title"
        aria-modal="true"
        className="modal-card"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="create-activity-title">สร้างกิจกรรมใหม่</h2>
            <p>ข้อมูลจะถูกบันทึกลง MariaDB</p>
          </div>
          <Button aria-label="ปิดหน้าต่าง" className="modal-close" onClick={onClose}>×</Button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="modal-field">
            <span>ชื่อกิจกรรม</span>
            <input
              autoFocus
              maxLength={255}
              minLength={2}
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label className="modal-field">
            <span>รายละเอียด</span>
            <input
              maxLength={255}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
            />
          </label>

          <div className="modal-field-grid">
            <label className="modal-field">
              <span>วันที่</span>
              <input
                type="date"
                value={activityDate}
                onChange={(event) => setActivityDate(event.target.value)}
              />
            </label>

            <label className="modal-field">
              <span>จำนวนผู้เข้าร่วมสูงสุด</span>
              <input
                min={0}
                type="number"
                value={participantLimit}
                onChange={(event) => setParticipantLimit(Number(event.target.value))}
              />
            </label>
          </div>

          <label className="modal-field">
            <span>สถานะ</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ActivityStatus)}
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
            </select>
          </label>

          {error && <p className="modal-error" role="alert">{error}</p>}

          <div className="modal-actions">
            <Button className="modal-button modal-button--secondary" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button className="modal-button modal-button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'กำลังบันทึก...' : 'บันทึกกิจกรรม'}
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default CreateActivityModal
