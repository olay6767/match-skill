import Button from '../../../shared/components/ui/Button'
import type { ActivityFilter, DemoAction } from './types'

type ActivityFiltersProps = {
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  onDemoAction: DemoAction
}

const filters: Array<{ value: ActivityFilter; label: string }> = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'draft', label: 'ฉบับร่าง' },
  { value: 'active', label: 'เปิดใช้งาน' },
  { value: 'closed', label: 'ปิดแล้ว' },
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
