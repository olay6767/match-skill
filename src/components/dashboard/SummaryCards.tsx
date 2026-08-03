import MetricCard from './MetricCard'

const metrics = [
  {
    icon: '▣',
    tone: 'blue',
    meta: '+12% ↗',
    metaClass: 'metric-trend',
    label: 'Total Activities',
    value: '158',
  },
  {
    icon: '↗',
    tone: 'orange',
    meta: 'กำลังดำเนินการ',
    metaClass: 'metric-label',
    label: 'Active Activities',
    value: '24',
  },
  {
    icon: '♟',
    tone: 'indigo',
    meta: 'รายคน',
    metaClass: 'metric-label',
    label: 'Participating Students',
    value: '3,420',
  },
  {
    icon: '✓',
    tone: 'green',
    meta: '92% Completion',
    metaClass: 'metric-trend',
    label: 'Completed Assessments',
    value: '8,941',
  },
]

function SummaryCards() {
  return (
    <section className="metrics-grid" aria-label="Summary metrics">
      {metrics.map((metric) => (
        <MetricCard key={metric.label} {...metric} />
      ))}
    </section>
  )
}

export default SummaryCards
