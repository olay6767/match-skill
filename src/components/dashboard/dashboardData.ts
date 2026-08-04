import type { ActivityStatus } from './types'

export const chartData = [
  { day: 'Mon', pre: 42, post: 65 },
  { day: 'Tue', pre: 72, post: 50 },
  { day: 'Wed', pre: 55, post: 52 },
  { day: 'Thu', pre: 88, post: 72 },
  { day: 'Fri', pre: 77, post: 70 },
  { day: 'Sat', pre: 48, post: 24 },
  { day: 'Sun', pre: 37, post: 18 },
]

export const topSkills = [
  { name: 'Problem Solving', value: 85 },
  { name: 'Digital Literacy', value: 72 },
  { name: 'Collaboration', value: 64 },
  { name: 'Communication', value: 58 },
]

export const statusLabels: Record<ActivityStatus, string> = {
  processing: 'Processing',
  completed: 'Completed',
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
}
