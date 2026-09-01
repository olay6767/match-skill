import { useState } from 'react'
import DatePickerField from './DatePickerField'
import Icon from './Icon'

type DateTimePickerFieldProps = {
  value: string | null
  onChange: (value: string | null) => void
  min?: string
  max?: string
  ariaLabel: string
  disabled?: boolean
}

function datePart(value: string | null) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null
}

function timePart(value: string | null) {
  return value?.match(/T(\d{2}:\d{2})$/)?.[1] ?? ''
}

function DateTimePickerField({ value, onChange, min, max, ariaLabel, disabled = false }: DateTimePickerFieldProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(() => datePart(value))
  const [selectedTime, setSelectedTime] = useState(() => timePart(value))

  const updateDate = (nextDate: string | null) => {
    setSelectedDate(nextDate)
    if (!nextDate) {
      onChange(null)
      return
    }
    const nextTime = selectedTime || '09:00'
    setSelectedTime(nextTime)
    onChange(`${nextDate}T${nextTime}`)
  }

  const updateTime = (nextTime: string) => {
    setSelectedTime(nextTime)
    onChange(selectedDate && nextTime ? `${selectedDate}T${nextTime}` : null)
  }

  return (
    <span className="date-time-picker-control">
      <DatePickerField value={selectedDate} onChange={updateDate} min={min} max={max} ariaLabel={ariaLabel} disabled={disabled} />
      <span className="time-picker-field">
        <Icon name="clock" />
        <input aria-label={`${ariaLabel}: เวลา`} disabled={disabled} type="time" value={selectedTime} onChange={(event) => updateTime(event.target.value)} />
      </span>
      <small className="date-picker-caption">เลือกวัน / เดือน / ปี และเวลา</small>
    </span>
  )
}

export default DateTimePickerField
