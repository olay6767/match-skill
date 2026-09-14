import { useEffect, useRef } from 'react'
import type { ActivityOption, DashboardFilters as FilterValues } from './types'
import DatePickerField from '../../../shared/components/ui/DatePickerField'

type Props = {
  value: FilterValues
  activities: ActivityOption[]
  onChange: (value: FilterValues) => void
}

function ActivityCheckboxFilter({ values, activities, onChange }: { values: string[]; activities: ActivityOption[]; onChange: (values: string[]) => void }) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selectedLabel = values.length === 0
    ? 'ทุกกิจกรรม'
    : values.length === 1
      ? activities.find((activity) => String(activity.id) === values[0])?.name ?? '1 กิจกรรม'
      : `เลือกแล้ว ${values.length} กิจกรรม`

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (detailsRef.current?.open && !detailsRef.current.contains(event.target as Node)) detailsRef.current.open = false
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && detailsRef.current) detailsRef.current.open = false
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [])

  const toggleActivity = (activityId: string, checked: boolean) => {
    const nextValues = checked ? [...values, activityId] : values.filter((value) => value !== activityId)
    onChange(nextValues.length === activities.length ? [] : nextValues)
  }

  return <div className="dashboard-activity-multiselect">
    <span>ชื่อกิจกรรม</span>
    <details ref={detailsRef}>
      <summary><strong title={selectedLabel}>{selectedLabel}</strong><i aria-hidden="true" /></summary>
      <div className="dashboard-activity-multiselect__menu" role="group" aria-label="เลือกกิจกรรมที่ใช้คำนวณ Dashboard">
        <div className="dashboard-activity-multiselect__menu-header">
          <span><strong>เลือกกิจกรรม</strong><small>เลือกได้มากกว่าหนึ่งรายการ</small></span>
          <b>{values.length === 0 ? `ทั้งหมด ${activities.length}` : `${values.length} / ${activities.length}`}</b>
        </div>
        <label className={`is-all${values.length === 0 ? ' is-selected' : ''}`}>
          <input type="checkbox" checked={values.length === 0} onChange={() => onChange([])} />
          <span className="dashboard-activity-multiselect__option-copy"><strong>ทุกกิจกรรม</strong><small>รวมข้อมูลจากทุกกิจกรรม</small></span>
        </label>
        {activities.map((activity) => {
          const activityId = String(activity.id)
          const selected = values.includes(activityId)
          return <label className={selected ? 'is-selected' : ''} key={activity.id}>
            <input type="checkbox" checked={selected} onChange={(event) => toggleActivity(activityId, event.target.checked)} />
            <span title={activity.name}>{activity.name}</span>
          </label>
        })}
        {activities.length === 0 && <p>ยังไม่มีกิจกรรม</p>}
      </div>
    </details>
  </div>
}

function DashboardFilters({ value, activities, onChange }: Props) {
  return (
    <section className="dashboard-data-filters" aria-label="ตัวกรองข้อมูล Dashboard">
      <label>วันที่เริ่มต้น<DatePickerField key={value.from} value={value.from || null} max={value.to || undefined} ariaLabel="วันที่เริ่มต้น" onChange={(from) => onChange({ ...value, from: from ?? '' })} /></label>
      <label>วันที่สิ้นสุด<DatePickerField key={value.to} value={value.to || null} min={value.from || undefined} ariaLabel="วันที่สิ้นสุด" onChange={(to) => onChange({ ...value, to: to ?? '' })} /></label>
      <ActivityCheckboxFilter values={value.activityIds} activities={activities} onChange={(activityIds) => onChange({ ...value, activityIds })} />
      <button type="button" onClick={() => onChange({ from: '', to: '', activityIds: [] })}>ล้างตัวกรอง</button>
    </section>
  )
}

export default DashboardFilters
