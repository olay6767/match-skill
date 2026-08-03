import Card from '../ui/Card'

type MetricCardProps = {
  icon: string
  tone: string
  meta: string
  metaClass: string
  label: string
  value: string
}

function MetricCard({ icon, tone, meta, metaClass, label, value }: MetricCardProps) {
  return (
    <Card as="article" className="metric-card">
      <div className="metric-card__top">
        <span className={`metric-icon metric-icon--${tone}`} aria-hidden="true">
          {icon}
        </span>
        <span className={metaClass}>{meta}</span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </Card>
  )
}

export default MetricCard
