import MetricCard from './MetricCard'
import type { IconName } from '../ui/Icon'
import type { DashboardSummary } from './types'

type SummaryCardsProps = {
  summary: DashboardSummary
}

function SummaryCards({ summary }: SummaryCardsProps) {
  const metrics: Array<{
    icon: IconName
    tone: string
    meta: string
    metaClass: string
    label: string
    value: string
  }> = [
    {
      icon: 'activities',
      tone: 'blue',
      meta: '+12% ↗',
      metaClass: 'metric-trend',
      label: 'Total Activities',
      value: summary.totalActivities.toLocaleString(),
    },
    {
      icon: 'rocket',
      tone: 'orange',
      meta: 'กำลังดำเนินการ',
      metaClass: 'metric-label',
      label: 'Active Activities',
      value: summary.activeActivities.toLocaleString(),
    },
    {
      icon: 'participants',
      tone: 'indigo',
      meta: 'รายคน',
      metaClass: 'metric-label',
      label: 'Participating Students',
      value: summary.participatingStudents.toLocaleString(),
    },
    {
      icon: 'check',
      tone: 'green',
      meta: '92% Completion',
      metaClass: 'metric-trend',
      label: 'Completed Assessments',
      value: summary.completedAssessments.toLocaleString(),
    },
  ]

  return (
    <section className="metrics-grid" aria-label="Summary metrics">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  )
}

export default SummaryCards
