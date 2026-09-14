import './viewModeToggle.css'

export type ViewMode = 'grid' | 'list'

type Props = {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  label?: string
  gridLabel?: string
  listLabel?: string
}

function ViewModeToggle({ value, onChange, label = 'รูปแบบการแสดงกิจกรรม', gridLabel = 'แสดงแบบการ์ด', listLabel = 'แสดงแบบรายการ' }: Props) {
  return <div className="view-mode-toggle" role="group" aria-label={label}>
    <button type="button" className={value === 'grid' ? 'is-active' : ''} aria-pressed={value === 'grid'} aria-label={gridLabel} title={gridLabel} onClick={() => onChange('grid')}><span className="view-mode-toggle__grid-icon" aria-hidden="true"><i /><i /><i /><i /></span></button>
    <button type="button" className={value === 'list' ? 'is-active' : ''} aria-pressed={value === 'list'} aria-label={listLabel} title={listLabel} onClick={() => onChange('list')}><span className="view-mode-toggle__list-icon" aria-hidden="true"><i /><i /><i /></span></button>
  </div>
}

export default ViewModeToggle
