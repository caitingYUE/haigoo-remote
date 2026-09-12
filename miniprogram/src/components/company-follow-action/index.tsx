import { Button, Text, View } from '@tarojs/components'
import { navigateTo, showModal, showToast } from '@tarojs/taro'
import { useState } from 'react'
import MiniIcon from '../mini-icon'
import type { MiniIconName } from '../mini-icon'
import { followCompany, unfollowCompany } from '../../services/career-match-service'
import { emitCompanyFollowChange } from '../../services/company-follow-state'
import { trackMiniEvent } from '../../services/analytics-service'
import { hasAuthenticatedSession } from '../../services/session'
import { ApiRequestError } from '../../services/api-client'
import './index.scss'

interface CompanyFollowActionProps {
  companyId: string
  companyName: string
  followed: boolean
  reminderEnabled?: boolean
  compact?: boolean
  unfollowedLabel?: string
  unfollowedIcon?: MiniIconName
  onChanged?: (followed: boolean) => void
}

export default function CompanyFollowAction({ companyId, companyName, followed, reminderEnabled = false, compact = false, unfollowedLabel, unfollowedIcon = 'subscription', onChanged }: CompanyFollowActionProps) {
  const [busy, setBusy] = useState(false)
  const applyState = (nextFollowed: boolean) => {
    emitCompanyFollowChange({ companyId, followed: nextFollowed, reminderEnabled: nextFollowed && reminderEnabled })
    onChanged?.(nextFollowed)
  }

  const toggle = async () => {
    if (busy) return
    if (!hasAuthenticatedSession()) {
      const result = await showModal({ title: '登录后关注企业', content: '登录后可保存关注，并接收企业岗位动态。', confirmText: '去登录' })
      if (result.confirm) navigateTo({ url: '/pages/profile/index' })
      return
    }
    if (followed) {
      void trackMiniEvent('mini_company_unfollow_request', { entity_id: companyId, company_name: companyName })
      const result = await showModal({
        title: '取消关注？',
        content: '取消关注后，将不再在关注动态中展示这家企业的新岗位。是否继续？',
        confirmText: '取消关注',
        confirmColor: '#C94F22'
      })
      if (!result.confirm) {
        void trackMiniEvent('mini_company_unfollow_cancel', { entity_id: companyId })
        return
      }
    }
    setBusy(true)
    void trackMiniEvent(followed ? 'mini_company_unfollow_confirm' : 'mini_company_follow_click', { entity_id: companyId, company_name: companyName })
    try {
      if (followed) await unfollowCompany(companyId)
      else await followCompany(companyId)
      applyState(!followed)
      showToast({ title: followed ? '已取消关注' : '已关注企业', icon: 'success' })
      void trackMiniEvent(followed ? 'mini_company_unfollow_success' : 'mini_company_follow_success', { entity_id: companyId })
    } catch (error) {
      if (error instanceof ApiRequestError && error.payload.code === 'COMPANY_FOLLOW_LIMIT_REACHED') {
        const result = await showModal({ title: '企业订阅已达免费上限', content: '开通会员，订阅更多企业岗位更新。', confirmText: '开通会员', cancelText: '管理订阅', confirmColor: '#C94F22' })
        if (result.confirm || result.cancel) navigateTo({ url: result.confirm ? '/pages/membership/index' : '/pages/followed-companies/index' })
        return
      }
      showToast({ title: error instanceof Error ? error.message : followed ? '取消关注失败，请重试' : '关注失败，请重试', icon: 'none' })
      void trackMiniEvent(followed ? 'mini_company_unfollow_failed' : 'mini_company_follow_failed', { entity_id: companyId })
    } finally { setBusy(false) }
  }

  return <Button
    className={`company-follow-action ${followed ? 'is-followed' : ''} ${compact ? 'is-compact' : ''} ${busy ? 'is-busy' : ''}`}
    aria-disabled={busy}
    aria-label={followed ? `取消关注 ${companyName}` : `关注 ${companyName} 的岗位动态`}
    hoverClass='mini-action--pressed'
    onTouchStart={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); void toggle() }}
  >
    <View className='company-follow-action__icon'>
      <MiniIcon name={busy ? 'clock' : followed ? 'check' : unfollowedIcon} size={compact ? '28rpx' : 19} />
    </View>
    <Text>{busy ? '正在处理…' : followed ? '已关注' : unfollowedLabel || (compact ? '关注' : '关注岗位动态')}</Text>
  </Button>
}
