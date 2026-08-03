import Card from '../ui/Card'
import ActivityFilters from './ActivityFilters'
import ActivityRow from './ActivityRow'
import Pagination from './Pagination'
import type { Activity, ActivityFilter, DemoAction } from './types'

type ActivitiesPanelProps = {
  activities: Activity[]
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  onDemoAction: DemoAction
}

function ActivitiesPanel({ activities, filter, onFilterChange, onDemoAction }: ActivitiesPanelProps) {
  return (
    <Card as="section" className="panel activities-panel">
      <div className="panel-heading panel-heading--activities">
        <h2>Recent Activities</h2>
        <ActivityFilters
          filter={filter}
          onFilterChange={onFilterChange}
          onDemoAction={onDemoAction}
        />
      </div>

      <div className="activity-table-wrap">
        <table className="activity-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Date</th>
              <th>Participants</th>
              <th>Pre-Test</th>
              <th>Post-Test</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <ActivityRow
                activity={activity}
                key={activity.name}
                onDemoAction={onDemoAction}
              />
            ))}
          </tbody>
        </table>
        {activities.length === 0 && <div className="empty-state">ไม่พบกิจกรรมที่ค้นหา</div>}
      </div>

      <div className="table-footer">
        <span>Showing 1–{activities.length} of 158 results</span>
        <Pagination onDemoAction={onDemoAction} />
      </div>
    </Card>
  )
}

export default ActivitiesPanel
