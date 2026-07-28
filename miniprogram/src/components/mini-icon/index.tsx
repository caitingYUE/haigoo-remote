import { Image } from '@tarojs/components'
import type { CSSProperties } from 'react'
import './index.scss'

export type MiniIconName =
  | 'application'
  | 'building'
  | 'chevronRight'
  | 'club'
  | 'favorite'
  | 'link'
  | 'mail'
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
}

export default function MiniIcon({ name, size = 24, className = '' }: MiniIconProps) {
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`
  }

  return (
    <Image
      className={`mini-icon ${className}`.trim()}
      mode='aspectFit'
      src={`/assets/icons/${name}.png`}
      style={style}
    />
  )
}
