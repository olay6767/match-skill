import type { ActivityStatus } from './types'

export const statusLabels: Record<ActivityStatus, string> = {
  draft: 'ฉบับร่าง',
  active: 'กำลังเปิด',
  closed: 'ปิดแล้ว',
  archived: 'เก็บถาวร',
}
