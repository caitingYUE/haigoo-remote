import { Input, Text, View } from '@tarojs/components'
import MiniIcon from '../mini-icon'
import './index.scss'

interface EditorialSearchProps {
  value: string
  placeholder: string
  disabled?: boolean
  gateLabel?: string
  onInput: (value: string) => void
  onSubmit?: () => void
  onGateClick?: () => void
}

export default function EditorialSearch({ value, placeholder, disabled = false, gateLabel = '', onInput, onSubmit, onGateClick }: EditorialSearchProps) {
  return (
    <View className='editorial-search' aria-role={disabled && onGateClick ? 'button' : undefined} aria-label={disabled ? gateLabel || placeholder : '搜索'} onClick={disabled ? onGateClick : undefined}>
      <MiniIcon name='search' size={22} />
      <Input className='editorial-search__input' value={value} disabled={disabled} confirmType='search' placeholder={placeholder} onInput={(event) => onInput(event.detail.value)} onConfirm={onSubmit} />
      {gateLabel ? <Text className='editorial-search__gate'>{gateLabel}</Text> : null}
    </View>
  )
}
