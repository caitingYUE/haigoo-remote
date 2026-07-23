import { Button, Input, Text, Textarea, View } from '@tarojs/components'
import { Close, Mail, ShieldCheck, Warning } from '@nutui/icons-react-taro'
import { navigateTo, setClipboardData, showModal, showToast, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import {
  deleteMiniAccount,
  logoutMiniAccount,
  submitMiniFeedback,
  unbindWebsiteAccount
} from '../../services/mini-auth-service'
import { getMiniUser } from '../../services/session'
import './index.scss'

export default function AccountSettingsPage() {
  const user = getMiniUser()
  const [password, setPassword] = useState('')
  const [feedback, setFeedback] = useState('')
  const [pending, setPending] = useState<'unbind' | 'delete' | 'feedback' | ''>('')

  const finishSession = (message: string) => {
    logoutMiniAccount()
    showToast({ title: message, icon: 'success' })
    switchTab({ url: '/pages/profile/index' })
  }

  const handleLogout = () => {
    showModal({
      title: '退出当前账号？',
      content: '退出只会清除本机登录状态，不会删除网站账号或收藏、订阅数据。',
      confirmText: '退出登录',
      success: ({ confirm }) => {
        if (confirm) finishSession('已退出登录')
      }
    })
  }

  const handleUnbind = () => {
    if (!password) {
      showToast({ title: '请输入网站账号密码进行验证', icon: 'none' })
      return
    }
    showModal({
      title: '解除微信绑定？',
      content: '解绑后网站账号和数据仍会保留；再次使用收藏、订阅等同步功能时需要重新绑定。',
      confirmText: '确认解绑',
      success: async ({ confirm }) => {
        if (!confirm) return
        setPending('unbind')
        try {
          await unbindWebsiteAccount(password)
          finishSession('已解除绑定')
        } catch (error) {
          showModal({ title: '解绑失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
        } finally {
          setPending('')
        }
      }
    })
  }

  const handleDelete = () => {
    if (!password) {
      showToast({ title: '请输入网站账号密码进行验证', icon: 'none' })
      return
    }
    showModal({
      title: '永久注销账号？',
      content: '账号、收藏、订阅及相关数据将被删除且无法恢复，同一邮箱 30 天内不能重新注册。',
      cancelText: '取消',
      confirmText: '继续注销',
      success: ({ confirm }) => {
        if (!confirm) return
        showModal({
          title: '请再次确认',
          content: '这是不可撤销操作。确认永久注销 Haigoo Remote 账号吗？',
          confirmText: '永久注销',
          success: async ({ confirm: finalConfirm }) => {
            if (!finalConfirm) return
            setPending('delete')
            try {
              await deleteMiniAccount(password)
              finishSession('账号已注销')
            } catch (error) {
              showModal({ title: '注销失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
            } finally {
              setPending('')
            }
          }
        })
      }
    })
  }

  const handleFeedback = async () => {
    if (feedback.trim().length < 5) {
      showToast({ title: '请至少输入 5 个字的问题或建议', icon: 'none' })
      return
    }
    setPending('feedback')
    try {
      await submitMiniFeedback(feedback)
      setFeedback('')
      showToast({ title: '反馈已提交', icon: 'success' })
    } catch (error) {
      showModal({ title: '提交失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false })
    } finally {
      setPending('')
    }
  }

  return (
    <View className='account-settings-page'>
      <View className='settings-hero'>
        <View className='settings-hero__icon'><ShieldCheck size={32} color='#5146e5' /></View>
        <View>
          <Text className='settings-hero__title'>账号与安全</Text>
          <Text className='settings-hero__copy'>{user?.email || '当前 Haigoo Remote 账号'}</Text>
        </View>
      </View>

      <View className='settings-card'>
        <Text className='settings-card__title'>常用操作</Text>
        <View className='settings-row' onClick={() => navigateTo({ url: '/pages/account-bind/index?mode=forgot' })}>
          <Mail size={23} color='#5146e5' /><Text>通过邮箱重置密码</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' onClick={() => navigateTo({ url: '/pages/legal/index?type=privacy' })}>
          <ShieldCheck size={23} color='#5146e5' /><Text>隐私政策</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' onClick={() => navigateTo({ url: '/pages/legal/index?type=terms' })}>
          <ShieldCheck size={23} color='#5146e5' /><Text>用户服务协议</Text><Text className='settings-row__arrow'>›</Text>
        </View>
        <View className='settings-row' onClick={handleLogout}>
          <Close size={23} color='#5146e5' /><Text>退出登录</Text><Text className='settings-row__arrow'>›</Text>
        </View>
      </View>

      <View className='settings-card'>
        <Text className='settings-card__title'>帮助与反馈</Text>
        <Textarea
          className='settings-feedback'
          value={feedback}
          maxlength={1000}
          placeholder='岗位失效、信息错误、功能问题或其他建议'
          onInput={(event) => setFeedback(event.detail.value)}
        />
        <Button className='settings-secondary-button' loading={pending === 'feedback'} disabled={Boolean(pending)} onClick={handleFeedback}>提交反馈</Button>
        <View className='settings-email' onClick={() => setClipboardData({ data: 'hi@haigooremote.com' }).then(() => showToast({ title: '联系邮箱已复制', icon: 'success' }))}>
          <Text>联系邮箱：hi@haigooremote.com</Text><Text>复制</Text>
        </View>
      </View>

      <View className='settings-card settings-card--danger'>
        <Text className='settings-card__title'>账号高风险操作</Text>
        <Text className='settings-card__copy'>执行解绑或注销前，请输入网站账号密码完成安全验证。</Text>
        <Input
          className='settings-password'
          value={password}
          password
          placeholder='输入网站账号密码'
          onInput={(event) => setPassword(event.detail.value)}
        />
        <Button className='settings-warning-button' loading={pending === 'unbind'} disabled={Boolean(pending)} onClick={handleUnbind}>解除微信绑定</Button>
        <Button className='settings-danger-button' loading={pending === 'delete'} disabled={Boolean(pending)} onClick={handleDelete}>永久注销账号</Button>
        <View className='settings-danger-note'><Warning size={18} color='#a94b4b' /><Text>注销不可撤销，请先确认网站与小程序数据已不再需要。</Text></View>
      </View>
    </View>
  )
}
