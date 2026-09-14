import { useEffect, useState, type FormEvent } from 'react'
import Button from '../../../shared/components/ui/Button'
import DatePickerField from '../../../shared/components/ui/DatePickerField'
import ScrollableSelect from '../../../shared/components/ui/ScrollableSelect'
import type { ActivityFormValues } from './activityFormModel'
import FormThemeEditor from './FormThemeEditor'
import RichTextEditor from './RichTextEditor'
import { richTextToPlainText } from '../../../shared/richText'

type Errors = Partial<Record<keyof ActivityFormValues, string>>
const ACTIVITY_DETAIL_MAX_LENGTH = 10_000


function validate(values: ActivityFormValues) {
  const errors: Errors = {}
  if (values.name.trim().length < 2) errors.name = 'กรุณากรอกชื่อกิจกรรมอย่างน้อย 2 ตัวอักษร'
  else if (values.name.trim().length > 255) errors.name = 'ชื่อกิจกรรมต้องไม่เกิน 255 ตัวอักษร'
  if (richTextToPlainText(values.detail).length > ACTIVITY_DETAIL_MAX_LENGTH) errors.detail = 'รายละเอียดต้องไม่เกิน 10,000 ตัวอักษร'
  if ((values.location?.length ?? 0) > 255) errors.location = 'สถานที่ต้องไม่เกิน 255 ตัวอักษร'
  if ((values.targetGroup?.length ?? 0) > 120) errors.targetGroup = 'กลุ่มเป้าหมายต้องไม่เกิน 120 ตัวอักษร'
  if (!Number.isInteger(Number(values.participantLimit)) || Number(values.participantLimit) < 0 || Number(values.participantLimit) > 1_000_000) errors.participantLimit = 'จำนวนรองรับต้องเป็นจำนวนเต็ม 0–1,000,000'
  for (const key of ['preTestDurationMinutes', 'postTestDurationMinutes'] as const) {
    if (!Number.isInteger(Number(values[key])) || Number(values[key]) < 1 || Number(values[key]) > 1_440) errors[key] = 'ระยะเวลาต้องเป็นจำนวนเต็ม 1–1,440 นาที'
  }
  return errors
}

type Props = {
  initialValues: ActivityFormValues
  createdAt: string | null
  templates: Array<{ id: number; name: string }>
  submitLabel: string
  onSubmit: (values: ActivityFormValues, intent: 'draft' | 'continue') => Promise<void>
  onCancel: () => void
  onDirtyChange: (dirty: boolean) => void
}

async function compactActivityImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ PNG, JPEG หรือ WebP')
  }
  if (file.size > 10 * 1024 * 1024) throw new Error('กรุณาเลือกรูปภาพขนาดไม่เกิน 10 MB')

  const source = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('ไม่สามารถอ่านรูปภาพนี้ได้'))
      element.src = source
    })
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('ไม่สามารถเตรียมรูปภาพได้')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const imageData = canvas.toDataURL('image/jpeg', 0.84)
    if (imageData.length > 2_500_000) throw new Error('รูปภาพมีขนาดใหญ่เกินไป กรุณาเลือกรูปที่เล็กลง')
    return imageData
  } finally {
    URL.revokeObjectURL(source)
  }
}

function ActivityForm({ initialValues, createdAt, templates, submitLabel, onSubmit, onCancel, onDirtyChange }: Props) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPreparingImage, setIsPreparingImage] = useState(false)
  const [notice, setNotice] = useState('')
  const dirty = JSON.stringify(values) !== JSON.stringify(initialValues)

  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault() }
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const set = <K extends keyof ActivityFormValues>(key: K, value: ActivityFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: undefined })); setNotice('')
  }
  const submit = async (intent: 'draft' | 'continue') => {
    const nextErrors = validate(values); setErrors(nextErrors)
    if (Object.keys(nextErrors).length) { setNotice('กรุณาตรวจสอบข้อมูลที่กรอก'); return }
    setIsSubmitting(true); setNotice('')
    try { await onSubmit({ ...values, name: values.name.trim(), detail: values.detail.trim() }, intent); if (intent === 'draft') setNotice(submitLabel === 'บันทึกการแก้ไข' ? 'บันทึกการแก้ไขแล้ว · หากเพิ่มเวลา ผู้ที่ยังไม่ส่งจะกลับมาทำต่อด้วย QR เดิมได้' : 'บันทึก Draft เรียบร้อยแล้ว ระบบสร้างรหัสกิจกรรมให้อัตโนมัติ') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'ไม่สามารถบันทึกกิจกรรมได้') }
    finally { setIsSubmitting(false) }
  }
  const field = (key: keyof ActivityFormValues, label: string, type = 'text') => {
    const isDuration = key === 'preTestDurationMinutes' || key === 'postTestDurationMinutes'
    const isNumber = key === 'participantLimit' || isDuration
    return <label className="activity-form-field"><span>{label}</span><input type={type} min={isDuration ? 1 : type === 'number' ? 0 : undefined} max={isDuration ? 1_440 : type === 'number' ? 1_000_000 : undefined} maxLength={key === 'targetGroup' ? 120 : 255} value={String(values[key] ?? '')} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${key}-error` : undefined} onChange={(event) => set(key, (isNumber ? Number(event.target.value) : event.target.value || null) as never)} />{errors[key] && <small id={`${key}-error`} role="alert">{errors[key]}</small>}</label>
  }
  const dateField = (key: 'startDate', label: string) => <div className="activity-form-field"><span>{label}</span><DatePickerField key={values[key] ?? ''} value={values[key]} onChange={(nextValue) => set(key, nextValue)} ariaLabel={label} />{errors[key] && <small id={`${key}-error`} role="alert">{errors[key]}</small>}</div>
  const createdDate = createdAt ? new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(createdAt)) : 'ระบบจะบันทึกให้อัตโนมัติเมื่อสร้างกิจกรรม'
  const selectImage = async (file: File | undefined, target: 'imageData' | 'assessmentImageData') => {
    if (!file) return
    setIsPreparingImage(true); setNotice('')
    try { set(target, await compactActivityImage(file)) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'ไม่สามารถใช้รูปภาพนี้ได้') }
    finally { setIsPreparingImage(false) }
  }
  const activityPosterField = <div className="activity-form-field activity-poster-field"><span>โปสเตอร์กิจกรรม</span><div className="activity-image-picker"><img src={values.imageData ?? '/seda-logo.png'} alt={values.imageData ? 'ตัวอย่างโปสเตอร์กิจกรรม' : 'โลโก้ SEDA เริ่มต้น'} /><div><label className="activity-image-upload"><strong>{isPreparingImage ? 'กำลังเตรียมรูปภาพ...' : values.imageData ? 'เปลี่ยนโปสเตอร์' : 'เลือกรูปโปสเตอร์'}</strong><input type="file" accept="image/png,image/jpeg,image/webp" disabled={isPreparingImage || isSubmitting} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectImage(file, 'imageData') }} /></label>{values.imageData && <button type="button" className="activity-image-remove" onClick={() => set('imageData', null)}>ลบรูปนี้และใช้โลโก้ SEDA</button>}</div></div></div>
  const assessmentHeaderImageField = <div className="activity-form-field activity-assessment-image-field"><span>รูปหัวแบบประเมิน</span><div className="activity-image-picker"><img src={values.assessmentImageData ?? '/seda-logo.png'} alt={values.assessmentImageData ? 'ตัวอย่างรูปหัวแบบประเมิน' : 'โลโก้ SEDA เริ่มต้น'} /><div><label className="activity-image-upload"><strong>{isPreparingImage ? 'กำลังเตรียมรูปภาพ...' : values.assessmentImageData ? 'เปลี่ยนรูปหัวแบบประเมิน' : 'เลือกรูปหัวแบบประเมิน'}</strong><input type="file" accept="image/png,image/jpeg,image/webp" disabled={isPreparingImage || isSubmitting} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void selectImage(file, 'assessmentImageData') }} /></label>{values.assessmentImageData && <button type="button" className="activity-image-remove" onClick={() => set('assessmentImageData', null)}>ลบรูปนี้และใช้โลโก้ SEDA</button>}</div></div></div>

  return <form className="shared-activity-form google-forms-activity-form" noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit('draft') }}>
    <header className="activity-form-intro">
      <div><span>รายละเอียดกิจกรรม</span><h2>ข้อมูลสำหรับสร้างกิจกรรม</h2></div>
      <small>Draft</small>
    </header>
    <div className="activity-created-date"><span>วันที่สร้างกิจกรรม</span><strong>{createdDate}</strong></div>
    <section className="activity-media-section" aria-labelledby="activity-media-title"><div className="activity-media-section__heading"><span>รูปภาพกิจกรรม</span><strong id="activity-media-title">ภาพที่ใช้ในกิจกรรม</strong></div><div className="activity-media-grid">{activityPosterField}{assessmentHeaderImageField}</div></section>
    <div className="activity-form-grid">{field('name', 'ชื่อกิจกรรม *')}<div className="activity-form-field activity-form-field--wide"><span>รายละเอียด</span><RichTextEditor value={values.detail} maxLength={ACTIVITY_DETAIL_MAX_LENGTH} invalid={Boolean(errors.detail)} onChange={(detail) => set('detail', detail)} />{errors.detail && <small role="alert">{errors.detail}</small>}</div>{field('location', 'สถานที่')}{field('targetGroup', 'กลุ่มเป้าหมาย')}{field('participantLimit', 'จำนวนรองรับ', 'number')}{dateField('startDate', 'วันที่เริ่มกิจกรรม')}{field('preTestDurationMinutes', 'ระยะเวลาทำ Pre-test (นาที)', 'number')}{field('postTestDurationMinutes', 'ระยะเวลาทำ Post-test (นาที)', 'number')}
      <ScrollableSelect className="activity-form-field activity-form-template-select" label="แบบประเมิน" value={values.surveyTemplateId ? String(values.surveyTemplateId) : ''} options={[{ value: '', label: 'ยังไม่เลือก' }, ...templates.map((template) => ({ value: String(template.id), label: template.name }))]} onChange={(surveyTemplateId) => set('surveyTemplateId', surveyTemplateId ? Number(surveyTemplateId) : null)} />
    </div>
    <FormThemeEditor value={values.formTheme} disabled={isSubmitting} onChange={(formTheme) => set('formTheme', formTheme)} />
    {notice && <p className="activity-form-notice" role="status">{notice}</p>}
    <div className="activity-form-actions"><Button className="activity-action activity-action--cancel" onClick={onCancel}>ยกเลิก</Button><Button className="activity-action" disabled={isSubmitting} type="submit">{isSubmitting ? 'กำลังบันทึก...' : submitLabel}</Button><Button className="activity-action activity-action--primary" disabled={isSubmitting} onClick={() => void submit('continue')}>Save &amp; Continue</Button></div>
  </form>
}

export default ActivityForm
