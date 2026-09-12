import { Button, Text } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast } from '@tarojs/taro'
import { useState } from 'react'
import MiniIcon from '../mini-icon'
import { setMatchNotifications } from '../../services/career-match-service'
import { emitCompanyFollowChange } from '../../services/company-follow-state'
import { trackMiniEvent } from '../../services/analytics-service'
import { ApiRequestError } from '../../services/api-client'
import './index.scss'

interface WechatReminderActionProps {
  companyId: string
  available: boolean
  templateId: string
  enabled: boolean
  onChanged?: (enabled: boolean) => void
}

export type WechatReminderAuthorization = 'accepted' | 'rejected' | 'unavailable'

export async function requestWechatReminderAuthorization(templateId: string): Promise<WechatReminderAuthorization> {
  const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (options: { tmplIds: string[] }) => Promise<Record<string, string>>
  const result = await requestSubscribeMessage({ tmplIds: [templateId] })
  const rawStatus = String(result[templateId] || '')
  return rawStatus === 'accept' ? 'accepted' : rawStatus === 'ban' ? 'unavailable' : 'rejected'
}

export default function WechatReminderAction({ companyId, available, templateId, enabled, onChanged }: WechatReminderActionProps) {
  const [busy, setBusy] = useState(false)
  const updateState = (nextEnabled: boolean) => {
    emitCompanyFollowChange({ companyId, followed: true, reminderEnabled: nextEnabled })
    onChanged?.(nextEnabled)
  }

  const toggle = async () => {
    if (busy) return
    if (enabled) {
      setBusy(true)
      try {
        await setMatchNotifications(companyId, false, 'not_requested')
        updateState(false)
        showToast({ title: '已关闭微信提醒', icon: 'success' })
      } catch (error) { showToast({ title: error instanceof Error ? error.message : '暂时无法关闭提醒', icon: 'none' }) }
      finally { setBusy(false) }
      return
    }
    if (!available || !templateId) {
      void trackMiniEvent('mini_wechat_reminder_unavailable', { entity_id: companyId })
      showToast({ title: '微信提醒暂不可用，关注状态已保留', icon: 'none' })
      return
    }
    setBusy(true)
    void trackMiniEvent('mini_wechat_reminder_prompt', { entity_id: companyId })
    try {
      const status = await requestWechatReminderAuthorization(templateId)
      if (status === 'accepted') {
        await setMatchNotifications(companyId, true, status)
        updateState(true)
        showToast({ title: '微信提醒已开启', icon: 'success' })
        void trackMiniEvent('mini_wechat_reminder_accepted', { entity_id: companyId })
      } else {
        await setMatchNotifications(companyId, false, status).catch(() => undefined)
        updateState(false)
        showToast({ title: status === 'unavailable' ? '请在小程序设置中开启订阅消息' : '已关注，可稍后开启微信提醒', icon: 'none' })
        void trackMiniEvent(status === 'unavailable' ? 'mini_wechat_reminder_unavailable' : 'mini_wechat_reminder_declined', { entity_id: companyId })
      }
    } catch (error) {
      if (error instanceof ApiRequestError && error.payload.code === 'COMPANY_REMINDER_LIMIT_REACHED') {
        const result = await showModal({ title: '微信提醒已达免费上限', content: '免费版可开启 5 家企业的微信提醒，开通会员可开启更多。', confirmText: '开通会员', cancelText: '管理订阅', confirmColor: '#C94F22' })
        if (result.confirm || result.cancel) navigateTo({ url: result.confirm ? '/pages/membership/index' : '/pages/followed-companies/index' })
        return
      }
      console.warn('[WechatReminderAction] request failed', error)
      showToast({ title: '微信提醒未开启，关注状态已保留', icon: 'none' })
      void trackMiniEvent('mini_wechat_reminder_failed', { entity_id: companyId })
    } finally { setBusy(false) }
  }

  return <Button
    className={`wechat-reminder-action ${enabled ? 'is-enabled' : ''} ${busy ? 'is-busy' : ''}`}
    aria-disabled={busy}
    aria-label={enabled ? '关闭微信岗位提醒' : '开启微信岗位提醒'}
    onTouchStart={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); void toggle() }}
  >
    <MiniIcon name={enabled ? 'check' : 'subscription'} size={17} />
    <Text>{busy ? '正在处理…' : enabled ? '微信提醒已开启' : '开启微信提醒'}</Text>
  </Button>
}
