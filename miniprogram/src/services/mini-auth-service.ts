import Taro from '@tarojs/taro'
import { requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'
import { clearMiniSession, getMiniSessionToken, saveMiniSession } from './session'

interface MiniUser {
  userId?: string
  username?: string
  email?: string
  avatar?: string
  isMember?: boolean
}

interface SessionResponse {
  success?: boolean
  bound?: boolean
  token?: string
  user?: MiniUser | null
  message?: string
}

export const MINI_AGREEMENT_VERSION = '2026-07-23'
export const MINI_PRIVACY_VERSION = '2026-07-23'

export async function loginWithWechat() {
  const login = await Taro.login()
  if (!login.code) throw new Error('未能获取微信登录凭证，请重试')
  const session = await requestJson<SessionResponse>('/mini/auth/session', {
    method: 'POST',
    data: { code: login.code }
  })
  if (!session.token) throw new Error('微信登录未返回有效会话')
  saveMiniSession({
    token: session.token,
    userId: session.user?.userId || null,
    username: session.user?.username,
    email: session.user?.email,
    avatar: session.user?.avatar,
    isMember: session.user?.isMember
  })
  void trackMiniEvent('mini_login', { status: session.bound ? 'bound' : 'unbound' })
  return session
}

export async function bindWebsiteAccount(email: string, password: string) {
  const response = await requestJson<SessionResponse>('/mini/account/bind', {
    method: 'POST',
    authenticated: true,
    data: { email, password }
  })
  if (!response.token || !response.user?.userId) throw new Error('账号绑定未完成')
  saveMiniSession({
    token: response.token,
    userId: response.user.userId,
    username: response.user.username,
    email: response.user.email,
    avatar: response.user.avatar,
    isMember: response.user.isMember
  })
  void trackMiniEvent('mini_account_bind', { status: 'succeeded' })
  return response
}

export async function registerAndBindWebsiteAccount(
  email: string,
  password: string,
  username?: string,
  consentAccepted = false
) {
  if (!consentAccepted) throw new Error('请先阅读并同意用户服务协议和隐私政策')
  if (!getMiniSessionToken()) await loginWithWechat()
  const response = await requestJson<SessionResponse>('/mini/account/register', {
    method: 'POST',
    authenticated: true,
    data: {
      email,
      password,
      username: username?.trim() || undefined,
      agreementVersion: MINI_AGREEMENT_VERSION,
      privacyVersion: MINI_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString()
    }
  })
  if (!response.token || !response.user?.userId) throw new Error('账号创建未完成，请稍后重试')
  saveMiniSession({
    token: response.token,
    userId: response.user.userId,
    username: response.user.username,
    email: response.user.email,
    avatar: response.user.avatar,
    isMember: response.user.isMember
  })
  void trackMiniEvent('mini_account_register', { status: 'succeeded' })
  return response
}

export async function requestPasswordReset(email: string) {
  if (!getMiniSessionToken()) await loginWithWechat()
  const response = await requestJson<{ success?: boolean; message?: string }>('/mini/account/request-password-reset', {
    method: 'POST',
    authenticated: true,
    data: { email: email.trim().toLowerCase() }
  })
  void trackMiniEvent('mini_password_reset_requested', { status: 'succeeded' })
  return response
}

export async function unbindWebsiteAccount(password: string) {
  const response = await requestJson<{ success?: boolean; message?: string }>('/mini/account/unbind', {
    method: 'POST',
    authenticated: true,
    data: { password }
  })
  void trackMiniEvent('mini_account_unbound', { status: 'succeeded' })
  return response
}

export async function deleteMiniAccount(password: string) {
  const response = await requestJson<{ success?: boolean; message?: string }>('/mini/account/delete', {
    method: 'POST',
    authenticated: true,
    data: { password }
  })
  void trackMiniEvent('mini_account_deleted', { status: 'succeeded' })
  return response
}

export async function submitMiniFeedback(content: string) {
  return requestJson<{ success?: boolean }>('/mini/feedback', {
    method: 'POST',
    authenticated: true,
    data: { content: content.trim() }
  })
}

export function logoutMiniAccount() {
  clearMiniSession()
}
