import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import { navigateTo, reLaunch, setClipboardData, showModal, showToast } from '@tarojs/taro'
import { useRef, useState } from 'react'
import {
  deleteMiniAccount,
  logoutMiniAccount,
  submitMiniFeedback,
  unbindWebsiteAccount
} from '../../services/mini-auth-service'
import { getMiniSessionCacheKey, getMiniUser, hasAuthenticatedSession } from '../../services/session'
import './index.scss'

export default function AccountSettingsPage() {
  const user = getMiniUser()
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState<'logout' | 'unbind' | 'delete' | 'feedback' | ''>('')

  const operationLock = useRef(false)
  const finishSession = (message: string, scope: string) => {
    if (scope !== getMiniSessionCacheKey()) return
    logoutMiniAccount()
    setPassword('')
    void reLaunch({ url: '/pages/index/index' })
    showToast({ title: message, icon: 'success' })
  }

  const handleAccountAction = async (action: 'logout' | 'unbind' | 'delete') => {
    if (operationLock.current) return
    if (action !== 'logout' && !hasAuthenticatedSession()) {
      showToast({ title: '请先登录并连接 Haigoo 账号', icon: 'none' })
      return
    }
    if (action !== 'logout' && !password) {
      showToast({ title: '请输入 Haigoo 账号密码', icon: 'none' })
      return
    }
    operationLock.current = true
    setPending(action)
    const scope = getMiniSessionCacheKey()
    const labels = {
      logout: { title: '退出当前账号？', content: '退出不会删除 Haigoo 账号、会员或咨询记录。', confirmText: '退出登录', done: '已退出登录' },
      unbind: { title: '解除微信绑定？', content: '解绑后账号和数据仍会保留。下次使用会员或咨询服务时，需要重新连接。', confirmText: '确认解绑', done: '已解除绑定' },
      delete: { title: '永久注销账号？', content: '账号及相关服务数据将被删除且无法恢复，同一邮箱 30 天内不能重新注册。', confirmText: '继续注销', done: '账号已注销' }
    }[action]
    try {
      if (!(await showModal(labels)).confirm) return
      if (action === 'delete' && !(await showModal({
        title: '请再次确认', content: '这是不可撤销操作。确认永久注销 HaigooRemote 账号吗？', confirmText: '永久注销'
      })).confirm) return
      if (scope !== getMiniSessionCacheKey()) return
      if (action === 'unbind') await unbindWebsiteAccount(password)
      if (action === 'delete') await deleteMiniAccount(password)
      finishSession(labels.done, scope)
    } catch (error) {
      showModal({ title: '操作未完成', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
    } finally {
      operationLock.current = false
      setPending('')
    }
  }
  const handleLogout = () => handleAccountAction('logout')
  const handleUnbind = () => handleAccountAction('unbind')
  const handleDelete = () => handleAccountAction('delete')

  const handleFeedback = async () => {
    if (operationLock.current) return
    if (feedback.trim().length < 5) {
      showToast({ title: '请至少输入 5 个字的问题或建议', icon: 'none' })
      return
    }
    operationLock.current = true
    setPending('feedback')
    try {
      await submitMiniFeedback(feedback)
      setFeedback('')
      showToast({ title: '反馈已提交', icon: 'success' })
    } catch (error) {
      showModal({ title: '提交失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
    } finally {
      operationLock.current = false
      setPending('')
    }
  }

  return (
    <View className='account-settings-page'>
      <View className='settings-hero'>
        <View>
          <Text className='settings-hero__title'>账号与安全</Text>
          <Text className='settings-hero__copy'>{user?.email || '当前 HaigooRemote 账号'}</Text>
        </View>
      </View>

      <View className='settings-card'>
        <Text className='settings-card__title'>常用操作</Text>
        <View className='settings-row' aria-role='button' aria-label='通过邮箱重置密码' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/account-bind/index?mode=forgot' })}>
          <Text>通过邮箱重置密码</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' aria-role='button' aria-label='查看隐私政策' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/legal/index?type=privacy' })}>
          <Text>隐私政策</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' aria-role='button' aria-label='查看用户服务协议' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/legal/index?type=terms' })}>
          <Text>用户服务协议</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' aria-role='button' aria-label='退出登录' hoverClass='mini-action--pressed' onClick={handleLogout}>
          <Text>退出登录</Text><Text className='settings-row__arrow'>›</Text>
        </View>
      </View>

      <View className='settings-card'>
        <Text className='settings-card__title'>帮助与反馈</Text>
        <Textarea
          className='settings-feedback'
          value={feedback}
          maxlength={1000}
          aria-label='问题或建议'
          placeholder='写下你的问题或建议'
          onInput={(event) => setFeedback(event.detail.value)}
        />
        <Button className='settings-secondary-button' loading={pending === 'feedback'} disabled={Boolean(pending)} onClick={handleFeedback}>提交反馈</Button>
        <View className='settings-email' aria-role='button' aria-label='复制联系邮箱' hoverClass='mini-action--pressed' onClick={() => setClipboardData({ data: 'hi@haigooremote.com' }).then(() => showToast({ title: '联系邮箱已复制', icon: 'success' }))}>
          <Text>联系邮箱：hi@haigooremote.com</Text><Text>复制</Text>
        </View>
      </View>

      <View className='settings-card settings-card--danger'>
        <Text className='settings-card__title'>解绑与注销</Text>
        <Text className='settings-card__copy'>操作前，请输入 Haigoo 账号密码进行验证。</Text>
        <Input
          className='settings-password'
          value={password}
          password
          placeholder='输入 Haigoo 账号密码'
          onInput={(event) => setPassword(event.detail.value)}
        />
        <Button className='settings-warning-button' loading={pending === 'unbind'} disabled={Boolean(pending)} onClick={handleUnbind}>解除微信绑定</Button>
        <Button className='settings-danger-button' loading={pending === 'delete'} disabled={Boolean(pending)} onClick={handleDelete}>永久注销账号</Button>
        <View className='settings-danger-note'><Text>注销后无法恢复，请先确认账号中的数据已不再需要。</Text></View>
      </View>
    </View>
  )
}
