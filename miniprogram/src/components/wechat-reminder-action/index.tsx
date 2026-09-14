import { Button, Text } from '@tarojs/components'
import Taro, { navigateTo, switchTab, showModal, showToast, useDidShow } from '@tarojs/taro'
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

export async function requestMatchingReminderAuthorization(templateId: string, isCurrent: () => boolean): Promise<WechatReminderAuthorization | null> {
  const snapshot = await refreshCompanyReminderSnapshot()
  if (!isCurrent()) return null
  if (!snapshot) {
    showToast({ title: '暂时无法读取岗位偏好，请重试', icon: 'none' })
    return null
  }
  if (!snapshot.matchingPreferencesReady) {
    const result = await showModal({ title: '先设置匹配岗位', content: '请在 Match 中选择岗位类型，或上传简历并确认匹配方向。设置后才能订阅匹配更新。', confirmText: '去设置', cancelText: '暂不设置' })
    if (result.confirm && isCurrent()) await switchTab({ url: '/pages/index/index' })
    return null
  }
  const result = await showModal({
    title: '订阅匹配更新',
    content: '企业有匹配的岗位时提醒你\n\n按你在自定义设置或简历中确认的岗位类型匹配。当前微信每次授权可接收一条提醒，收到后可再次订阅。',
    confirmText: '微信提醒', cancelText: '暂不开启'
  })
  if (!result.confirm || !isCurrent()) return null
  return requestWechatReminderAuthorization(templateId)
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
      const status = await requestMatchingReminderAuthorization(templateId, isCurrent)
      if (!isCurrent() || status === null) return
      if (status === 'accepted') {
        await setMatchNotifications(companyId, true, status)
        if (!isCurrent()) return
        updateState(true, scope)
        showToast({ title: '企业有匹配的岗位时提醒你', icon: 'none', duration: 3000 })
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
      if (error instanceof ApiRequestError && error.payload.code === 'WATCH_ROLE_REQUIRED') {
        const result = await showModal({ title: '请更新岗位偏好', content: '岗位偏好已变更，请在 Match 中确认后重新订阅。', confirmText: '去设置' })
        if (result.confirm && isCurrent()) await switchTab({ url: '/pages/index/index' })
        return
      }
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
    aria-label={currentEnabled ? '取消匹配岗位微信提醒' : '订阅匹配更新，企业有匹配的岗位时提醒你'}
    onTouchStart={(event) => event.stopPropagation()}
    onClick={(event) => { event.stopPropagation(); void toggle() }}
  >
    <MiniIcon name={currentEnabled ? 'check' : 'subscription'} size={17} />
    <Text>{busy ? '正在处理…' : currentEnabled ? '已订阅匹配提醒' : '订阅匹配更新'}</Text>
  </Button>
}
