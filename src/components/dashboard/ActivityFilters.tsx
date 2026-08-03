import Button from '../ui/Button'
import type { ActivityFilter, DemoAction } from './types'

type ActivityFiltersProps = {
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  onDemoAction: DemoAction
}

const filters: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'processing', label: 'รอดำเนินการ' },
  { value: 'completed', label: 'เสร็จสิ้น' },
]

function ActivityFilters({ filter, onFilterChange, onDemoAction }: ActivityFiltersProps) {
  return (
    <div className="activity-filters" role="group" aria-label="Filter activities">
      {filters.map((item) => (
        <Button
          className={filter === item.value ? 'active' : ''}
          key={item.value}
          onClick={() => onFilterChange(item.value)}
        >
          {item.label}
        </Button>
      ))}
      <Button onClick={() => onDemoAction('ตัวกรองขั้นสูง')}>☷ ตัวกรอง</Button>
    </div>
  )
}

export default ActivityFilters
