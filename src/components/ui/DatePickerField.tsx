import { useState } from 'react'
import Icon from './Icon'

type DatePickerFieldProps = {
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
}

const monthNames = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
]

function DatePickerField({ value, onChange, required = false }: DatePickerFieldProps) {
  const [initialYear, initialMonth, initialDay] = (value ?? '').split('-')
  const [dateParts, setDateParts] = useState({
    year: initialYear ?? '',
    month: initialMonth ?? '',
    day: initialDay ?? '',
  })
  const { year: yearValue, month: monthValue, day: dayValue } = dateParts
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 8 }, (_, index) => currentYear - 2 + index)
  if (yearValue && !years.includes(Number(yearValue))) years.push(Number(yearValue))
  years.sort((left, right) => left - right)

  const updateDate = (part: 'year' | 'month' | 'day', nextValue: string) => {
    const next = { year: yearValue, month: monthValue, day: dayValue, [part]: nextValue }
    setDateParts(next)
    onChange(next.year && next.month && next.day ? `${next.year}-${next.month}-${next.day}` : null)
  }

  const caption = yearValue && monthValue && dayValue
    ? `วันที่ ${Number(dayValue)} เดือน ${monthNames[Number(monthValue) - 1]} ปี พ.ศ. ${Number(yearValue) + 543}`
    : 'เลือกวัน เดือน และปี พ.ศ. ให้ครบถ้วน'

  return (
    <span className="date-picker-control">
      <span className="date-picker-field">
        <Icon name="calendar" />
        <select aria-label="วัน" required={required} value={dayValue ?? ''} onChange={(event) => updateDate('day', event.target.value)}>
          <option value="">วันที่</option>
          {Array.from({ length: 31 }, (_, index) => {
            const day = String(index + 1).padStart(2, '0')
            return <option key={day} value={day}>วันที่ {index + 1}</option>
          })}
        </select>
        <span className="date-picker-separator">/</span>
        <select aria-label="เดือน" required={required} value={monthValue ?? ''} onChange={(event) => updateDate('month', event.target.value)}>
          <option value="">เดือน</option>
          {monthNames.map((month, index) => {
            const monthValue = String(index + 1).padStart(2, '0')
            return <option key={monthValue} value={monthValue}>{month}</option>
          })}
        </select>
        <span className="date-picker-separator">/</span>
        <select aria-label="ปี พ.ศ." required={required} value={yearValue ?? ''} onChange={(event) => updateDate('year', event.target.value)}>
          <option value="">ปี พ.ศ.</option>
          {years.map((year) => <option key={year} value={year}>พ.ศ. {year + 543}</option>)}
        </select>
      </span>
      <small className="date-picker-caption">{caption}</small>
    </span>
  )
}

export default DatePickerField
