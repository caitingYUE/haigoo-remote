import { View } from '@tarojs/components'
import type { PropsWithChildren } from 'react'

interface EditorialRowProps extends PropsWithChildren {
  className?: string
  label: string
  onClick: () => void
}

export default function EditorialRow({ className = '', label, onClick, children }: EditorialRowProps) {
  return <View className={className} aria-role='button' aria-label={label} onClick={onClick}>{children}</View>
}
