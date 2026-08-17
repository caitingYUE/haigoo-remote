import { Text, View } from '@tarojs/components'

interface EditorialStateProps {
  title: string
  copy: string
  actionLabel?: string
  onAction?: () => void
}

export default function EditorialState({ title, copy, actionLabel, onAction }: EditorialStateProps) {
  return <View className='empty-state'><Text className='empty-state__title'>{title}</Text><Text className='empty-state__copy'>{copy}</Text>{actionLabel && onAction ? <View className='empty-state__action' aria-role='button' onClick={onAction}>{actionLabel}</View> : null}</View>
}
