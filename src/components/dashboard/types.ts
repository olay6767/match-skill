export type ActivityStatus = 'processing' | 'completed' | 'draft' | 'open'

export type Activity = {
  name: string
  detail: string
  date: string
  participants: string
  preTest: number
  postTest: number
  status: ActivityStatus
  tone: string
  icon: string
}

export type DemoAction = (label: string) => void
