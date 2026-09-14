import Card from '../../../shared/components/ui/Card'
import Icon, { type IconName } from '../../../shared/components/ui/Icon'

type MetricCardProps = {
  icon: IconName
  imageSrc?: string
  tone: string
  meta: string
  metaClass: string
  label: string
  value: string
}

function MetricCard({ icon, imageSrc, tone, meta, metaClass, label, value }: MetricCardProps) {
  return (
    <Card as="article" className="metric-card">
      <div className="metric-card__top">
        <span className={`metric-icon metric-icon--${tone}`}>
          {imageSrc ? <img src={imageSrc} alt="" aria-hidden="true" /> : <Icon name={icon} />}
        </span>
        <span className={metaClass}>{meta}</span>
      </div>
      <p>{label}</p>
      <strong>{value}</strong>
    </Card>
  )
}

export default MetricCard
