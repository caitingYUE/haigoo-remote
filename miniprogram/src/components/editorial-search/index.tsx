import { Input, Text, View } from '@tarojs/components'
import { useState } from 'react'
import MiniIcon from '../mini-icon'
import './index.scss'

interface EditorialSearchProps {
  value: string
  placeholder: string
  disabled?: boolean
  gateLabel?: string
  iconSize?: number | string
  onInput: (value: string) => void
  onSubmit?: () => void
  onGateClick?: () => void
}

export default function EditorialSearch({ value, placeholder, disabled = false, gateLabel = '', iconSize = 22, onInput, onSubmit, onGateClick }: EditorialSearchProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View className={`editorial-search ${focused ? 'is-focused' : ''}`} aria-role={disabled && onGateClick ? 'button' : undefined} aria-label={disabled ? gateLabel || placeholder : '搜索'} onClick={disabled ? onGateClick : undefined}>
      <MiniIcon className='editorial-search__icon' name='search' size={iconSize} />
      <Input className='editorial-search__input' value={value} disabled={disabled} aria-label={placeholder} confirmType='search' placeholder={placeholder} placeholderClass='editorial-search__placeholder' onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onInput={(event) => onInput(event.detail.value)} onConfirm={onSubmit} />
      {gateLabel ? <Text className='editorial-search__gate'>{gateLabel}</Text> : null}
    </View>
  )
}
