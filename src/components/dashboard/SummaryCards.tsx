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
        <article className="metric-card" key={metric.label}>
          <div className="metric-card__top">
            <span className={`metric-icon metric-icon--${metric.tone}`} aria-hidden="true">
              {metric.icon}
            </span>
            <span className={metric.metaClass}>{metric.meta}</span>
          </div>
          <p>{metric.label}</p>
          <strong>{metric.value}</strong>
        </article>
      ))}
    </section>
  )
}

export default SummaryCards
