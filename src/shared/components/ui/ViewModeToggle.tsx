import './viewModeToggle.css'

export type ViewMode = 'grid' | 'list'

type Props = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  label?: string
}

function ViewModeToggle({ value, onChange, label = 'รูปแบบการแสดงกิจกรรม' }: Props) {
  return <div className="view-mode-toggle" role="group" aria-label={label}>
    <button type="button" className={value === 'grid' ? 'is-active' : ''} aria-pressed={value === 'grid'} aria-label="แสดงแบบการ์ด" title="แสดงแบบการ์ด" onClick={() => onChange('grid')}><span className="view-mode-toggle__grid-icon" aria-hidden="true"><i /><i /><i /><i /></span></button>
    <button type="button" className={value === 'list' ? 'is-active' : ''} aria-pressed={value === 'list'} aria-label="แสดงแบบรายการ" title="แสดงแบบรายการ" onClick={() => onChange('list')}><span className="view-mode-toggle__list-icon" aria-hidden="true"><i /><i /><i /></span></button>
  </div>
}

export default ViewModeToggle
