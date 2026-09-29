import { useEffect, useRef } from 'react'

type Option = { value: string; label: string }

type Props = {
  label: string
  values: string[]
  options: Option[]
  allLabel: string
  onChange: (values: string[]) => void
}

function MultiSelect({ label, values, options, allLabel, onChange }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const selectedLabel = values.length === 0
    ? allLabel
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label ?? values[0]
      : `เลือกแล้ว ${values.length} รายการ`

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

  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...values, value] : values.filter((item) => item !== value)
    onChange(next.length === options.length ? [] : next)
  }

  return <div className="ui-multi-select">
    <span>{label}</span>
    <details ref={detailsRef}>
      <summary><strong title={selectedLabel}>{selectedLabel}</strong><i aria-hidden="true" /></summary>
      <div className="ui-multi-select__menu" role="group" aria-label={label}>
        <div className="ui-multi-select__heading"><span>เลือกได้หลายรายการ</span><b>{values.length || options.length} / {options.length}</b></div>
        <label className={values.length === 0 ? 'is-selected' : ''}>
          <input type="checkbox" checked={values.length === 0} onChange={() => onChange([])} />
          <span>{allLabel}</span>
        </label>
        {options.map((option) => {
          const checked = values.includes(option.value)
          return <label className={checked ? 'is-selected' : ''} key={option.value}>
            <input type="checkbox" checked={checked} onChange={(event) => toggle(option.value, event.target.checked)} />
            <span title={option.label}>{option.label}</span>
          </label>
        })}
        {!options.length && <p>ยังไม่มีตัวเลือก</p>}
      </div>
    </details>
  </div>
}

export default MultiSelect
