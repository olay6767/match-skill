import MetricCard from './MetricCard'
import type { IconName } from '../../../shared/components/ui/Icon'
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
      meta: 'คำตอบ',
      metaClass: 'metric-label',
      label: 'ผู้ตอบ Pre-test',
      value: summary.preCount.toLocaleString(),
    },
    {
      icon: 'rocket',
      tone: 'orange',
      meta: 'คำตอบ',
      metaClass: 'metric-label',
      label: 'ผู้ตอบ Post-test',
      value: summary.postCount.toLocaleString(),
    },
    {
      icon: 'participants',
      tone: 'indigo',
      meta: 'Pre + Post',
      metaClass: 'metric-label',
      label: 'ผู้ตอบที่ทำครบ',
      value: summary.pairedCount.toLocaleString(),
    },
    {
      icon: 'check',
      tone: 'green',
      meta: summary.preCount > 0 ? 'ทำครบ ÷ Pre-test' : 'ยังไม่มี Pre-test',
      metaClass: 'metric-label',
      label: 'อัตราการทำครบ',
      value: summary.completionRate === null ? '—' : `${summary.completionRate}%`,
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
