import type { ActivityStatus } from '../../../admin/components/dashboard/types'

type StatusBadgeProps = {
  status: ActivityStatus
  children: string
}

function StatusBadge({ status, children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${status}`}>{children}</span>
}

export default StatusBadge
