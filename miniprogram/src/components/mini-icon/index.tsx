import {
  Add,
  ArrowLeft,
  ArrowRight,
  Articles,
  Check,
  Clock,
  Close,
  Edit,
  Heart,
  Link,
  List2,
  Location,
  Mail,
  More,
  Notice,
  Order,
  Pin,
  Search,
  Service,
  Setting,
  Share,
  ShieldCheck,
  Star,
  StarFill,
  Store,
  User,
  Weixin
} from '@nutui/icons-react-taro'
import type { FunctionComponent } from 'react'
import './index.scss'

export type MiniIconName =
  | 'application'
  | 'briefcase'
  | 'building'
  | 'chevronRight'
  | 'chevronLeft'
  | 'check'
  | 'club'
  | 'clock'
  | 'close'
  | 'community'
  | 'edit'
  | 'favorite'
  | 'link'
  | 'location'
  | 'mail'
  | 'more'
  | 'notes'
  | 'orders'
  | 'plus'
  | 'search'
  | 'service'
  | 'settings'
  | 'share'
  | 'shield'
  | 'subscription'
  | 'target'
  | 'user'
  | 'star'
  | 'starFilled'

interface MiniIconProps {
  name: MiniIconName
  size?: number | string
  className?: string
  color?: string
  label?: string
}

const icons: Record<MiniIconName, FunctionComponent<any>> = {
  application: List2,
  briefcase: Order,
  building: Store,
  chevronRight: ArrowRight,
  chevronLeft: ArrowLeft,
  check: Check,
  club: Star,
  clock: Clock,
  close: Close,
  community: Weixin,
  edit: Edit,
  favorite: Heart,
  link: Link,
  location: Location,
  mail: Mail,
  more: More,
  notes: Articles,
  orders: Order,
  plus: Add,
  search: Search,
  service: Service,
  settings: Setting,
  share: Share,
  shield: ShieldCheck,
  subscription: Notice,
  target: Pin,
  user: User,
  star: Star,
  starFilled: StarFill
}

export default function MiniIcon({ name, size = 24, className = '', color = 'currentColor', label }: MiniIconProps) {
  const Icon = icons[name]
  return <Icon className={`mini-icon ${className}`.trim()} size={size} color={color} ariaHidden={!label} ariaLabel={label} />
}
