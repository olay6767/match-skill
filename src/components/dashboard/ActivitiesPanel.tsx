import { statusLabels } from './dashboardData'
import type { Activity, DemoAction } from './types'

type ActivityFilter = 'all' | 'processing' | 'completed'

type ActivitiesPanelProps = {
  activities: Activity[]
  filter: ActivityFilter
  onFilterChange: (filter: ActivityFilter) => void
  onDemoAction: DemoAction
}

function ProgressBar({ value, tone = 'green' }: { value: number; tone?: string }) {
  return (
    <div className="table-progress">
      <span className={`table-progress__track table-progress__track--${tone}`}>
        <span style={{ width: `${value}%` }} />
      </span>
      <strong>{value}%</strong>
    </div>
  )
}

function ActivitiesPanel({ activities, filter, onFilterChange, onDemoAction }: ActivitiesPanelProps) {
  return (
    <section className="panel activities-panel">
      <div className="panel-heading panel-heading--activities">
        <h2>Recent Activities</h2>
        <div className="activity-filters" role="group" aria-label="Filter activities">
          <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => onFilterChange('all')}>
            ทั้งหมด
          </button>
          <button className={filter === 'processing' ? 'active' : ''} type="button" onClick={() => onFilterChange('processing')}>
            รอดำเนินการ
          </button>
          <button className={filter === 'completed' ? 'active' : ''} type="button" onClick={() => onFilterChange('completed')}>
            เสร็จสิ้น
          </button>
          <button type="button" onClick={() => onDemoAction('ตัวกรองขั้นสูง')}>☷ ตัวกรอง</button>
        </div>
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
            {activities.map((activity) => {
              const [currentParticipants, totalParticipants] = activity.participants.split(' / ')
              return (
                <tr key={activity.name}>
                  <td>
                    <div className="activity-name">
                      <span className={`activity-icon activity-icon--${activity.tone}`} aria-hidden="true">
                        {activity.icon}
                      </span>
                      <span>
                        <strong>{activity.name}</strong>
                        <small>{activity.detail}</small>
                      </span>
                    </div>
                  </td>
                  <td>{activity.date}</td>
                  <td><strong>{currentParticipants}</strong> / {totalParticipants}</td>
                  <td><ProgressBar value={activity.preTest} /></td>
                  <td><ProgressBar value={activity.postTest} tone="orange" /></td>
                  <td>
                    <span className={`status-badge status-badge--${activity.status}`}>
                      {statusLabels[activity.status]}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button type="button" aria-label={`View ${activity.name}`} onClick={() => onDemoAction('ดูรายละเอียด')}>◎</button>
                      <button type="button" aria-label={`Edit ${activity.name}`} onClick={() => onDemoAction('แก้ไขกิจกรรม')}>⌕</button>
                      <button type="button" aria-label={`More actions for ${activity.name}`} onClick={() => onDemoAction('เมนูเพิ่มเติม')}>⋮</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {activities.length === 0 && <div className="empty-state">ไม่พบกิจกรรมที่ค้นหา</div>}
      </div>

      <div className="table-footer">
        <span>Showing 1–{activities.length} of 158 results</span>
        <div className="pagination" aria-label="Pagination">
          <button type="button" aria-label="Previous page">‹</button>
          <button className="active" type="button">1</button>
          <button type="button" onClick={() => onDemoAction('หน้าที่ 2')}>2</button>
          <button type="button" onClick={() => onDemoAction('หน้าที่ 3')}>3</button>
          <span>…</span>
          <button type="button" onClick={() => onDemoAction('หน้าที่ 40')}>40</button>
          <button type="button" aria-label="Next page" onClick={() => onDemoAction('หน้าถัดไป')}>›</button>
        </div>
      </div>
    </section>
  )
}

export default ActivitiesPanel
