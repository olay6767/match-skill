type DurationPickerFieldProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

function DurationPickerField({ label, value, onChange, min = 1, max = 180 }: DurationPickerFieldProps) {
  const setDuration = (nextValue: number) => {
    onChange(Math.min(max, Math.max(min, Math.round(nextValue) || min)))
  }

  return (
    <span className="duration-picker-field">
      <button aria-label={`ลด${label}ลง 1 นาที`} type="button" onClick={() => setDuration(value - 1)}>−</button>
      <input
        aria-label={label}
        inputMode="numeric"
        max={max}
        min={min}
        required
        type="number"
        value={value}
        onChange={(event) => setDuration(Number(event.target.value))}
      />
      <span>นาที</span>
      <button aria-label={`เพิ่ม${label}ขึ้น 1 นาที`} type="button" onClick={() => setDuration(value + 1)}>＋</button>
    </span>
  )
}

export default DurationPickerField
