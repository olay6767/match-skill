import { useEffect, useId, useRef, useState } from 'react'
import Icon from './Icon'
import './scrollableSelect.css'

export type ScrollableSelectOption = {
  value: string
  label: string
}

type ScrollableSelectProps = {
  id?: string
  label: string
  value: string
  options: ScrollableSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  invalid?: boolean
  ariaDescribedBy?: string
  className?: string
}

function ScrollableSelect({ id, label, value, options, onChange, disabled = false, invalid = false, ariaDescribedBy, className = '' }: ScrollableSelectProps) {
  const generatedId = useId().replace(/:/g, '')
  const selectId = id ?? `scrollable-select-${generatedId}`
  const menuId = `${selectId}-menu`
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [opensUp, setOpensUp] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  const toggleMenu = () => {
    if (disabled) return
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect()
      setOpensUp(rect.bottom + Math.min(286, window.innerHeight * 0.45) > window.innerHeight - 16 && rect.top > window.innerHeight / 2)
    }
    setOpen((current) => !current)
  }

  const select = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
  }

  return <div className={`scrollable-select-field ${className}`.trim()}>
    <label htmlFor={selectId}>{label}</label>
    <div className={`scrollable-select${opensUp ? ' scrollable-select--up' : ''}`} ref={rootRef}>
      <button id={selectId} type="button" className="scrollable-select__trigger" aria-haspopup="listbox" aria-controls={menuId} aria-expanded={open && !disabled} aria-invalid={invalid || undefined} aria-describedby={ariaDescribedBy} disabled={disabled} onClick={toggleMenu} onKeyDown={(event) => {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !open) { event.preventDefault(); toggleMenu() }
      }}>
        <span title={selectedOption?.label}>{selectedOption?.label ?? 'ไม่มีรายการ'}</span>
        <Icon name="chevronRight" />
      </button>
      {open && !disabled && <div id={menuId} className="scrollable-select__menu" role="listbox" aria-label={label}>
        {options.map((option) => <button type="button" role="option" aria-selected={option.value === value} className={option.value === value ? 'is-selected' : ''} key={option.value} onClick={() => select(option.value)}>{option.label}</button>)}
      </div>}
    </div>
  </div>
}

export default ScrollableSelect
