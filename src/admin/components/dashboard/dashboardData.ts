import type { ActivityStatus } from './types'

export const statusLabels: Record<ActivityStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  closed: 'Closed',
  archived: 'Archived',
}
