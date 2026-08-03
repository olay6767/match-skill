import IconButton from '../ui/IconButton'
import ProgressBar from '../ui/ProgressBar'
import StatusBadge from '../ui/StatusBadge'
import { statusLabels } from './dashboardData'
import type { Activity, DemoAction } from './types'

type ActivityRowProps = {
  activity: Activity
  onDemoAction: DemoAction
}

function ActivityRow({ activity, onDemoAction }: ActivityRowProps) {
  const [currentParticipants, totalParticipants] = activity.participants.split(' / ')

  return (
    <tr>
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
        <StatusBadge status={activity.status}>{statusLabels[activity.status]}</StatusBadge>
      </td>
      <td>
        <div className="row-actions">
          <IconButton label={`View ${activity.name}`} onClick={() => onDemoAction('ดูรายละเอียด')}>◎</IconButton>
          <IconButton label={`Edit ${activity.name}`} onClick={() => onDemoAction('แก้ไขกิจกรรม')}>⌕</IconButton>
          <IconButton label={`More actions for ${activity.name}`} onClick={() => onDemoAction('เมนูเพิ่มเติม')}>⋮</IconButton>
        </div>
      </td>
    </tr>
  )
}

export default ActivityRow
