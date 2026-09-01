type DatePickerFieldProps = {
  value: string | null
  onChange: (value: string | null) => void
  required?: boolean
  min?: string
  max?: string
  disabled?: boolean
  ariaLabel?: string
}

function DatePickerField({ value, onChange, required = false, min, max, disabled = false, ariaLabel = 'วันที่' }: DatePickerFieldProps) {
  return <input
    aria-label={ariaLabel}
    className="date-picker-field"
    disabled={disabled}
    lang="en-GB"
    max={max}
    min={min}
    onChange={(event) => onChange(event.target.value || null)}
    required={required}
    type="date"
    value={value ?? ''}
  />
}

export default DatePickerField
