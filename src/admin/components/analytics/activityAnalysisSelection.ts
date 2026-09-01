import type { ActivityAnalysisCard } from '../../../lib/api'

export type SelectedActivity = Pick<ActivityAnalysisCard, 'id' | 'name' | 'date' | 'category' | 'organizer' | 'status' | 'hasEvaluation'>

const storageKey = 'seda.activity-analysis.selection'

export function readSelectedActivities(): Record<number, SelectedActivity> {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(storageKey) ?? '{}') as Record<string, SelectedActivity>
    return Object.fromEntries(Object.values(parsed).filter((activity) => Number.isInteger(activity?.id) && activity.id > 0).map((activity) => [activity.id, activity]))
  } catch {
    return {}
  }
}

export function saveSelectedActivities(activities: Record<number, SelectedActivity>) {
  window.sessionStorage.setItem(storageKey, JSON.stringify(activities))
}
