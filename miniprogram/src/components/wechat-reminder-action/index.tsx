import { Button, Text } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useEffect, useRef, useState } from 'react'
import MiniIcon from '../mini-icon'
import { setMatchNotifications } from '../../services/career-match-service'
import { emitCompanyFollowChange, invalidateReminderSnapshot, refreshCompanyReminderSnapshot } from '../../services/company-follow-state'
import { getMiniSessionCacheKey } from '../../services/session'
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
  const busyRef = useRef(false)
  const [currentEnabled, setCurrentEnabled] = useState(enabled)
  const alive = useRef(true)
  const currentCompany = useRef(companyId)
  currentCompany.current = companyId
  useEffect(() => { setCurrentEnabled(enabled) }, [enabled])
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const refreshStatus = () => {
    const scope = getMiniSessionCacheKey()
    void refreshCompanyReminderSnapshot().then(snapshot => {
      if (!snapshot || !alive.current || busyRef.current || scope !== getMiniSessionCacheKey() || currentCompany.current !== companyId) return
      const follow = snapshot.follows.find(item => item.company_id === companyId)
      setCurrentEnabled(Boolean(follow?.wechat_enabled && follow.wechat_template_status === 'accepted'))
    })
  }
  useEffect(refreshStatus, [companyId])
  useDidShow(refreshStatus)
  const updateState = (nextEnabled: boolean, scope: string) => {
    if (!alive.current || scope !== getMiniSessionCacheKey() || currentCompany.current !== companyId) return
    setCurrentEnabled(nextEnabled)
    emitCompanyFollowChange({ companyId, followed: true, reminderEnabled: nextEnabled })
    onChanged?.(nextEnabled)
  }

  const toggle = async () => {
    if (busyRef.current) return
    const scope = getMiniSessionCacheKey()
    const isCurrent = () => alive.current && scope === getMiniSessionCacheKey() && currentCompany.current === companyId
    invalidateReminderSnapshot()
    if (currentEnabled) {
      busyRef.current = true
      setBusy(true)
      try {
        await setMatchNotifications(companyId, false, 'not_requested')
        if (!isCurrent()) return
        updateState(false, scope)
        showToast({ title: '已关闭微信提醒', icon: 'success' })
      } catch (error) { if (isCurrent()) showToast({ title: error instanceof Error ? error.message : '暂时无法关闭提醒', icon: 'none' }) }
      finally { busyRef.current = false; setBusy(false) }
      return
    }
    if (!available || !templateId) {
      void trackMiniEvent('mini_wechat_reminder_unavailable', { entity_id: companyId })
      showToast({ title: '微信提醒暂不可用，关注状态已保留', icon: 'none' })
      return
    }
    setBusy(true)
    busyRef.current = true
    void trackMiniEvent('mini_wechat_reminder_prompt', { entity_id: companyId })
    try {
      const status = await requestWechatReminderAuthorization(templateId)
      if (!isCurrent()) return
      if (status === 'accepted') {
        await setMatchNotifications(companyId, true, status)
        if (!isCurrent()) return
        updateState(true, scope)
        showToast({ title: '已预约下一次上新提醒', icon: 'success' })
        void trackMiniEvent('mini_wechat_reminder_accepted', { entity_id: companyId })
      } else {
        await setMatchNotifications(companyId, false, status).catch(() => undefined)
        if (!isCurrent()) return
        updateState(false, scope)
        showToast({ title: status === 'unavailable' ? '请在小程序设置中开启订阅消息' : '已关注，可稍后开启微信提醒', icon: 'none' })
        void trackMiniEvent(status === 'unavailable' ? 'mini_wechat_reminder_unavailable' : 'mini_wechat_reminder_declined', { entity_id: companyId })
      }
    } catch (error) {
      if (!isCurrent()) return
      if (error instanceof ApiRequestError && error.payload.code === 'COMPANY_REMINDER_LIMIT_REACHED') {
        const result = await showModal({ title: '微信提醒已达免费上限', content: '免费版可开启 5 家企业的微信提醒，开通会员可开启更多。', confirmText: '开通会员', cancelText: '管理订阅', confirmColor: '#C94F22' })
        if (result.confirm || result.cancel) navigateTo({ url: result.confirm ? '/pages/membership/index' : '/pages/followed-companies/index' })
        return
      }
      console.warn('[WechatReminderAction] request failed', error)
      showToast({ title: '微信提醒未开启，关注状态已保留', icon: 'none' })
      void trackMiniEvent('mini_wechat_reminder_failed', { entity_id: companyId })
    } finally { busyRef.current = false; setBusy(false) }
  }

  return <Button
    className={`wechat-reminder-action ${currentEnabled ? 'is-enabled' : ''} ${busy ? 'is-busy' : ''}`}
    aria-disabled={busy}
    aria-label={currentEnabled ? '取消下一次微信岗位提醒' : '授权一次微信岗位提醒，收到后可再次授权'}
    onTouchStart={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); void toggle() }}
  >
    <MiniIcon name={currentEnabled ? 'check' : 'subscription'} size={17} />
    <Text>{busy ? '正在处理…' : currentEnabled ? '已预约一次提醒' : '提醒我一次'}</Text>
  </Button>
}
