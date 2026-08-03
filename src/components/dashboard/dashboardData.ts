import type { Activity, ActivityStatus } from './types'

export const activities: Activity[] = [
  {
    name: 'Creative Thinking Workshop 2024',
    detail: 'Batch 01 – General',
    date: '24 Oct 2023',
    participants: '120 / 150',
    preTest: 100,
    postTest: 45,
    status: 'processing',
    tone: 'blue',
    icon: '◉',
  },
  {
    name: 'Advanced Engineering Ethics',
    detail: 'Internal Training',
    date: '18 Oct 2023',
    participants: '45 / 50',
    preTest: 100,
    postTest: 100,
    status: 'completed',
    tone: 'orange',
    icon: '♙',
  },
  {
    name: 'English Communication Level 3',
    detail: 'Academic Program',
    date: '30 Oct 2023',
    participants: '0 / 200',
    preTest: 0,
    postTest: 0,
    status: 'draft',
    tone: 'slate',
    icon: '◎',
  },
  {
    name: 'UI/UX Designer Certification',
    detail: 'Professional Dev',
    date: '15 Nov 2023',
    participants: '88 / 100',
    preTest: 100,
    postTest: 0,
    status: 'open',
    tone: 'purple',
    icon: '✧',
  },
]

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
}
