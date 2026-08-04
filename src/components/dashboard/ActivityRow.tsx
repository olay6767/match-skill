import IconButton from '../ui/IconButton'
import Icon, { type IconName } from '../ui/Icon'
import ProgressBar from '../ui/ProgressBar'
import StatusBadge from '../ui/StatusBadge'
import { statusLabels } from './dashboardData'
import type { Activity, DemoAction } from './types'

type ActivityRowProps = {
  activity: Activity
  onDemoAction: DemoAction
  onEdit: (activity: Activity) => void
  onDelete: (activity: Activity) => void
  onToggle: (activity: Activity) => void
}

function ActivityRow({ activity, onDemoAction, onEdit, onDelete, onToggle }: ActivityRowProps) {
  const [currentParticipants, totalParticipants] = activity.participants.split(' / ')
  const activityIcons: Record<Activity['status'], IconName> = {
    processing: 'rocket',
    completed: 'check',
    draft: 'reports',
    open: 'activities',
    closed: 'reports',
  }

  return (
    <tr data-activity-id={activity.id}>
      <td>
        <div className="activity-name">
          <span className={`activity-icon activity-icon--${activity.tone}`}>
            <Icon name={activityIcons[activity.status]} />
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
          <IconButton label={`View ${activity.name}`} onClick={() => onDemoAction('ดูรายละเอียด')}><Icon name="eye" /></IconButton>
          <IconButton label={`Edit ${activity.name}`} onClick={() => onEdit(activity)}><Icon name="edit" /></IconButton>
          <IconButton label={`Delete ${activity.name}`} onClick={() => onDelete(activity)}><Icon name="trash" /></IconButton>
          <IconButton
            disabled={activity.status === 'completed'}
            label={activity.status === 'open' ? `Close ${activity.name}` : `Open ${activity.name}`}
            onClick={() => onToggle(activity)}
          >
            <Icon name={activity.status === 'open' ? 'lock' : 'unlock'} />
          </IconButton>
        </div>
      </td>
    </tr>
  )
}

export default ActivityRow
