import { Button, Input, Text, View } from '@tarojs/components'
import { navigateBack, navigateTo, showModal, showToast, useRouter } from '@tarojs/taro'
import { useState } from 'react'
import {
  bindWebsiteAccount,
  loginWithWechat,
  requestPasswordReset,
  registerAndBindWebsiteAccount
} from '../../services/mini-auth-service'
import { getMiniSessionToken } from '../../services/session'
import './index.scss'

type AuthMode = 'bind' | 'register' | 'forgot'

function validateRegistration(email: string, password: string, confirmPassword: string) {
  if (!email.trim() || !password || !confirmPassword) return '请填写邮箱、密码和确认密码'
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return '请输入正确的邮箱地址'
  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return '密码至少 8 位，且同时包含字母和数字'
  }
  if (password !== confirmPassword) return '两次输入的密码不一致'
  return ''
}

export default function AccountBindPage() {
  const router = useRouter()
  const [mode, setMode] = useState<AuthMode>(router.params.mode === 'forgot' ? 'forgot' : 'bind')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)

  const ensureWechatSession = async () => {
    if (!getMiniSessionToken()) await loginWithWechat()
  }

  const handleBind = async () => {
    if (!email.trim() || !password) {
      showToast({ title: '请输入网站账号邮箱和密码', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await ensureWechatSession()
      await bindWebsiteAccount(email.trim(), password)
      setCompleted(true)
    } catch (error) {
      showModal({
        title: '绑定失败',
        content: error instanceof Error ? error.message : '请检查邮箱和密码后重试',
        showCancel: false
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async () => {
    const validationMessage = validateRegistration(email, password, confirmPassword)
    if (validationMessage) {
      showToast({ title: validationMessage, icon: 'none' })
      return
    }
    if (!consentAccepted) {
      showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await ensureWechatSession()
      await registerAndBindWebsiteAccount(email.trim(), password, username, consentAccepted)
      setCompleted(true)
    } catch (error) {
      showModal({
        title: '注册未完成',
        content: error instanceof Error ? error.message : '请稍后再试',
        showCancel: false
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      showToast({ title: '请输入正确的注册邮箱', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await ensureWechatSession()
      const response = await requestPasswordReset(email.trim())
      showModal({
        title: '请检查邮箱',
        content: response.message || '如果该邮箱已注册，密码重置邮件会发送到该邮箱。',
        showCancel: false,
        success: () => setMode('bind')
      })
    } catch (error) {
      showModal({
        title: '暂时无法发送',
        content: error instanceof Error ? error.message : '请稍后再试',
        showCancel: false
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (completed) {
    return (
      <View className='account-bind-page'>
        <View className='account-auth-hero account-auth-hero--complete'>
          <Text className='account-auth-hero__brand'>HAIGOO REMOTE</Text>
          <View className='account-auth-complete__mark'>✓</View>
          <Text className='account-auth-hero__title'>账号已连接</Text>
          <Text className='account-auth-hero__copy'>微信身份、网站账号与求职权益已同步。若刚注册，请前往邮箱完成验证，以使用完整申请服务。</Text>
        </View>
        <View className='account-auth-complete-card'>
          <Text className='account-auth-complete-card__title'>接下来你可以</Text>
          <Text className='account-auth-complete-card__item'>1. 在邮箱中完成账号验证</Text>
          <Text className='account-auth-complete-card__item'>2. 浏览岗位，开始你的远程求职旅程</Text>
          <Button className='account-auth-primary-button' onClick={() => navigateBack()}>
            返回上一页
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className='account-bind-page'>
      <View className='account-auth-hero'>
        <Text className='account-auth-hero__brand'>HAIGOO REMOTE</Text>
        <Text className='account-auth-hero__title'>让微信连接你的{'\n'}远程职业旅程</Text>
        <Text className='account-auth-hero__copy'>先确认微信身份，再连接或创建 Haigoo 账号。会员权益、投递记录和职业资料会在同一个账号中延续。</Text>
        <View className='account-auth-steps'>
          <Text className='account-auth-steps__item account-auth-steps__item--active'>01 微信身份</Text>
          <Text className='account-auth-steps__line' />
          <Text className='account-auth-steps__item'>02 Haigoo 账号</Text>
          <Text className='account-auth-steps__line' />
          <Text className='account-auth-steps__item'>03 同步权益</Text>
        </View>
      </View>

      <View className='account-bind-card'>
        {mode === 'forgot' ? (
          <View className='account-auth-back' onClick={() => setMode('bind')}>
            <Text>‹ 返回账号绑定</Text>
          </View>
        ) : (
          <View className='account-auth-tabs'>
            <View
              className={'account-auth-tabs__item ' + (mode === 'bind' ? 'account-auth-tabs__item--active' : '')}
              onClick={() => setMode('bind')}
            >
              <Text>已有账号</Text>
            </View>
            <View
              className={'account-auth-tabs__item ' + (mode === 'register' ? 'account-auth-tabs__item--active' : '')}
              onClick={() => setMode('register')}
            >
              <Text>创建账号</Text>
            </View>
          </View>
        )}

        <Text className='account-bind-title'>
          {mode === 'bind' ? '登录并绑定网站账号' : mode === 'register' ? '创建 Haigoo 网站账号' : '找回网站账号密码'}
        </Text>
        <Text className='account-bind-copy'>
          {mode === 'bind'
            ? '使用已有 Haigoo 账号完成一次安全验证。密码只用于本次验证，不会保存在小程序中。'
            : mode === 'register'
              ? '创建后会自动绑定当前微信，并发送一封验证邮件到你的邮箱。'
              : '输入注册邮箱，我们会发送一封密码重置邮件。为保护账号安全，无论邮箱是否存在都会显示相同结果。'}
        </Text>

        <Text className='account-bind-label'>邮箱</Text>
        <Input
          className='account-bind-input'
          value={email}
          type='text'
          placeholder='name@example.com'
          onInput={(event) => setEmail(event.detail.value)}
        />

        {mode === 'register' ? (
          <>
            <Text className='account-bind-label'>昵称 <Text className='account-bind-label__optional'>选填</Text></Text>
            <Input
              className='account-bind-input'
              value={username}
              maxlength={24}
              placeholder='例如：Caitlin'
              onInput={(event) => setUsername(event.detail.value)}
            />
          </>
        ) : null}

        {mode !== 'forgot' ? (
          <>
            <Text className='account-bind-label'>密码</Text>
            <View className='account-bind-password-wrap'>
              <Input
                className='account-bind-input account-bind-input--password'
                value={password}
                password={!showPassword}
                placeholder={mode === 'register' ? '至少 8 位，包含字母和数字' : '输入网站账号密码'}
                onInput={(event) => setPassword(event.detail.value)}
              />
              <Text className='account-bind-password-toggle' onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? '隐藏' : '显示'}
              </Text>
            </View>
          </>
        ) : null}

        {mode === 'register' ? (
          <>
            <Text className='account-bind-label'>确认密码</Text>
            <Input
              className='account-bind-input'
              value={confirmPassword}
              password={!showPassword}
              placeholder='再次输入密码'
              onInput={(event) => setConfirmPassword(event.detail.value)}
            />
          </>
        ) : null}

        {mode === 'bind' ? (
          <Text className='account-auth-forgot' onClick={() => setMode('forgot')}>忘记密码？通过邮箱找回</Text>
        ) : null}

        {mode === 'register' ? (
          <View className='account-auth-consent'>
            <View
              className={`account-auth-consent__checkbox ${consentAccepted ? 'account-auth-consent__checkbox--checked' : ''}`}
              onClick={() => setConsentAccepted((value) => !value)}
            >
              <Text>{consentAccepted ? '✓' : ''}</Text>
            </View>
            <Text className='account-auth-consent__copy'>我已阅读并同意</Text>
            <Text className='account-auth-consent__link' onClick={() => navigateTo({ url: '/pages/legal/index?type=terms' })}>《用户服务协议》</Text>
            <Text className='account-auth-consent__copy'>和</Text>
            <Text className='account-auth-consent__link' onClick={() => navigateTo({ url: '/pages/legal/index?type=privacy' })}>《隐私政策》</Text>
          </View>
        ) : null}

        <Button
          className='account-auth-primary-button'
          loading={submitting}
          disabled={submitting}
          onClick={mode === 'bind' ? handleBind : mode === 'register' ? handleRegister : handlePasswordReset}
        >
          {mode === 'bind' ? '安全绑定并继续' : mode === 'register' ? '创建账号并绑定微信' : '发送密码重置邮件'}
        </Button>

        <View className='account-auth-security'>
          <Text className='account-auth-security__icon'>✓</Text>
          <Text>{mode === 'bind' ? '账号密码仅用于一次性校验' : mode === 'register' ? '注册信息会通过加密连接安全提交' : '重置链接 1 小时内有效'}</Text>
        </View>
      </View>
    </View>
  )
}
