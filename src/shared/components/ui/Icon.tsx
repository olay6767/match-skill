export type IconName =
  | 'admin'
  | 'activities'
  | 'analytics'
  | 'assessments'
  | 'calendar'
  | 'clock'
  | 'check'
  | 'dashboard'
  | 'draft'
  | 'download'
  | 'external'
  | 'eye'
  | 'hourglass'
  | 'edit'
  | 'logout'
  | 'lock'
  | 'menu'
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
  | 'close'
  | 'chevronLeft'
  | 'chevronRight'
  | 'location'
  | 'person'
  | 'shield'
  | 'trendUp'
  | 'trendDown'
  | 'trendFlat'
  | 'info'
  | 'error'
  | 'email'
  | 'phone'
  | 'faculty'
  | 'education'
  | 'loading'

const materialSymbolNames: Record<IconName, string> = {
  admin: 'manage_accounts',
  activities: 'event',
  analytics: 'bar_chart',
  assessments: 'assignment',
  calendar: 'calendar_month',
  clock: 'schedule',
  check: 'check_circle',
  dashboard: 'dashboard',
  draft: 'edit_note',
  download: 'download',
  external: 'open_in_new',
  eye: 'visibility',
  hourglass: 'hourglass_empty',
  edit: 'edit',
  logout: 'logout',
  lock: 'lock',
  menu: 'menu',
  participants: 'group',
  more: 'more_vert',
  reports: 'description',
  rocket: 'rocket_launch',
  search: 'search',
  settings: 'settings',
  bell: 'notifications',
  book: 'menu_book',
  trash: 'delete',
  unlock: 'lock_open',
  close: 'close',
  chevronLeft: 'chevron_left',
  chevronRight: 'chevron_right',
  location: 'location_on',
  person: 'person',
  shield: 'verified_user',
  trendUp: 'trending_up',
  trendDown: 'trending_down',
  trendFlat: 'trending_flat',
  info: 'info',
  error: 'error',
  email: 'mail',
  phone: 'phone_in_talk',
  faculty: 'apartment',
  education: 'school',
  loading: 'progress_activity',
}

type IconProps = {
  name: IconName
  className?: string
}

function Icon({ name, className = '' }: IconProps) {
  return <span aria-hidden="true" className={`material-symbols-outlined ui-icon ui-icon--${name} ${className}`}>{materialSymbolNames[name]}</span>
}

export default Icon
