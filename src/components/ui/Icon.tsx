export type IconName =
  | 'activities'
  | 'analytics'
  | 'assessments'
  | 'calendar'
  | 'clock'
  | 'check'
  | 'dashboard'
  | 'draft'
  | 'external'
  | 'eye'
  | 'hourglass'
  | 'edit'
  | 'logout'
  | 'lock'
  | 'participants'
  | 'more'
  | 'reports'
  | 'rocket'
  | 'search'
  | 'settings'
  | 'bell'
  | 'book'
  | 'trash'
  | 'unlock'

type IconProps = {
  name: IconName
  className?: string
}

function Icon({ name, className = '' }: IconProps) {
  return <span aria-hidden="true" className={`ui-icon ui-icon--${name} ${className}`} />
}

export default Icon
