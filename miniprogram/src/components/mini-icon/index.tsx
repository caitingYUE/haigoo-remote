import {
  ArrowRight,
  Articles,
  Check,
  Edit,
  Heart,
  Link,
  List2,
  Mail,
  Notice,
  Pin,
  Search,
  Setting,
  Share,
  ShieldCheck,
  Star,
  Store,
  User,
  Weixin
} from '@nutui/icons-react-taro'
import type { FunctionComponent } from 'react'
import './index.scss'

export type MiniIconName =
  | 'application'
  | 'building'
  | 'chevronRight'
  | 'check'
  | 'club'
  | 'community'
  | 'edit'
  | 'favorite'
  | 'link'
  | 'mail'
  | 'notes'
  | 'search'
  | 'settings'
  | 'share'
  | 'shield'
  | 'subscription'
  | 'target'
  | 'user'

interface MiniIconProps {
  name: MiniIconName
  size?: number
  className?: string
  color?: string
  label?: string
}

const icons: Record<MiniIconName, FunctionComponent<any>> = {
  application: List2,
  building: Store,
  chevronRight: ArrowRight,
  check: Check,
  club: Star,
  community: Weixin,
  edit: Edit,
  favorite: Heart,
  link: Link,
  mail: Mail,
  notes: Articles,
  search: Search,
  settings: Setting,
  share: Share,
  shield: ShieldCheck,
  subscription: Notice,
  target: Pin,
  user: User
}

export default function MiniIcon({ name, size = 24, className = '', color = 'currentColor', label }: MiniIconProps) {
  const Icon = icons[name]
  return <Icon className={`mini-icon ${className}`.trim()} size={size} color={color} ariaHidden={!label} ariaLabel={label} />
}
