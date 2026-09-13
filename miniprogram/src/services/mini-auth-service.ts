import Taro from '@tarojs/taro'
import { requestJson } from './api-client'
import { trackMiniEvent } from './analytics-service'
import { clearMiniSession, getMiniSessionCacheKey, getMiniUser, getMiniSessionToken, hasAuthenticatedSession, saveMiniSession } from './session'
import { MINI_AGREEMENT_VERSION, MINI_PRIVACY_VERSION } from '../config/legal'

interface MiniUser {
  userId?: string
  username?: string
  email?: string
  avatar?: string
  isMember?: boolean
  memberType?: string
  memberExpireAt?: string | null
}

interface SessionResponse {
  success?: boolean
  bound?: boolean
  token?: string
  user?: MiniUser | null
  message?: string
}

let sessionRequestVersion = 0
let sessionRefreshPending: Promise<SessionResponse> | null = null
let lastSessionRefreshAt = 0
let lastSessionRefreshScope = ''
let accountMutationPending = false
let accountLifecycleVersion = 0

async function mutateAccount<T>(operation: () => Promise<T>, commit?: (result: T) => void): Promise<T> {
  if (accountMutationPending) throw new Error('账号操作正在进行，请稍候')
  accountMutationPending = true
  const lifecycle = accountLifecycleVersion
  const scope = getMiniSessionCacheKey()
  sessionRequestVersion++
  try {
    const result = await operation()
    if (lifecycle !== accountLifecycleVersion || scope !== getMiniSessionCacheKey()) throw new Error('账号状态已变化，请重新操作')
    commit?.(result)
    return result
  } finally {
    accountMutationPending = false
  }
}

function saveAuthoritativeSession(session: Parameters<typeof saveMiniSession>[0]) {
  sessionRequestVersion += 1
  saveMiniSession(session)
}

function requireConsent(accepted: boolean) {
  if (!accepted) throw new Error('请先阅读并同意用户服务协议和隐私政策')
}

export async function loginWithWechat(consentAccepted = false) {
  requireConsent(consentAccepted)
  if (accountMutationPending) throw new Error('账号操作正在进行，请稍候')
  const lifecycle = accountLifecycleVersion
  const session = await createWechatSession()
  if (lifecycle !== accountLifecycleVersion) throw new Error('账号状态已变化，请重新登录')
  return session
}

// Refresh existing membership after payment; this is not a guest login entry.
export async function refreshWechatSession() {
  if (!hasAuthenticatedSession()) throw new Error('请先登录账号')
  if (accountMutationPending) throw new Error('账号操作正在进行，请稍候')
  const session = await createWechatSession()
  return session
}

// Recheck remote refunds/changes at most every five minutes during navigation.
// Purchases explicitly refresh; local expiry and account changes bypass the window.
export async function refreshWechatSessionIfStale(maxAgeMs = 5 * 60 * 1000) {
  if (!hasAuthenticatedSession() || accountMutationPending) return null
  const expiresAt = Date.parse(getMiniUser()?.memberExpireAt || '')
  const justExpired = expiresAt <= Date.now() && lastSessionRefreshAt < expiresAt
  if (!justExpired && lastSessionRefreshScope === getMiniSessionCacheKey() && Date.now() - lastSessionRefreshAt < Math.max(0, maxAgeMs)) return null
  if (sessionRefreshPending) return sessionRefreshPending
  const pending = refreshWechatSession()
  sessionRefreshPending = pending
  try {
    return await pending
  } finally {
    if (sessionRefreshPending === pending) sessionRefreshPending = null
  }
}

async function createWechatSession() {
  const requestVersion = ++sessionRequestVersion
  const login = await Taro.login()
  if (!login.code) throw new Error('微信登录没有完成，请重试')
  const session = await requestJson<SessionResponse>('/mini/auth/session', {
    method: 'POST',
    data: { code: login.code }
  })
  if (!session.token) throw new Error('微信登录没有完成，请重试')
  if (requestVersion === sessionRequestVersion) {
    saveMiniSession({
      token: session.token,
      userId: session.user?.userId || null,
      username: session.user?.username,
      email: session.user?.email,
      avatar: session.user?.avatar,
      isMember: session.user?.isMember,
      memberType: session.user?.memberType,
      memberExpireAt: session.user?.memberExpireAt
    })
    lastSessionRefreshAt = Date.now()
    lastSessionRefreshScope = getMiniSessionCacheKey()
  }
  void trackMiniEvent('mini_login', { status: session.bound ? 'bound' : 'unbound' })
  return session
}

export async function bindWebsiteAccount(email: string, password: string, consentAccepted = false) {
  requireConsent(consentAccepted)
  if (!getMiniSessionToken()) await loginWithWechat(consentAccepted)
  const response = await mutateAccount(() => requestJson<SessionResponse>('/mini/account/bind', {
    method: 'POST',
    authenticated: true,
    data: { email: email.trim().toLowerCase(), password }
  }), (response) => {
    if (!response.token || !response.user?.userId) throw new Error('账号连接没有完成，请重试')
    saveAuthoritativeSession({
      token: response.token,
      userId: response.user.userId,
      username: response.user.username,
      email: response.user.email,
      avatar: response.user.avatar,
      isMember: response.user.isMember,
      memberType: response.user.memberType,
      memberExpireAt: response.user.memberExpireAt
    })
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
  requireConsent(consentAccepted)
  if (!getMiniSessionToken()) await loginWithWechat(consentAccepted)
  const response = await mutateAccount(() => requestJson<SessionResponse>('/mini/account/register', {
    method: 'POST',
    authenticated: true,
    data: {
      email: email.trim().toLowerCase(),
      password,
      username: username?.trim() || undefined,
      agreementVersion: MINI_AGREEMENT_VERSION,
      privacyVersion: MINI_PRIVACY_VERSION,
      acceptedAt: new Date().toISOString()
    }
  }), (response) => {
    if (!response.token || !response.user?.userId) throw new Error('账号创建未完成，请稍后重试')
    saveAuthoritativeSession({
      token: response.token,
      userId: response.user.userId,
      username: response.user.username,
      email: response.user.email,
      avatar: response.user.avatar,
      isMember: response.user.isMember,
      memberType: response.user.memberType,
      memberExpireAt: response.user.memberExpireAt
    })
  })

  void trackMiniEvent('mini_account_register', { status: 'succeeded' })
  return response
}

export async function requestPasswordReset(email: string, consentAccepted = false) {
  requireConsent(consentAccepted)
  if (!getMiniSessionToken()) await loginWithWechat(consentAccepted)
  const response = await requestJson<{ success?: boolean; message?: string }>('/mini/account/request-password-reset', {
    method: 'POST',
    authenticated: true,
    data: { email: email.trim().toLowerCase() }
  })
  void trackMiniEvent('mini_password_reset_requested', { status: 'succeeded' })
  return response
}

export async function unbindWebsiteAccount(password: string) {
  const response = await mutateAccount(() => requestJson<{ success?: boolean; message?: string }>('/mini/account/unbind', {
    method: 'POST',
    authenticated: true,
    data: { password }
  }))
  void trackMiniEvent('mini_account_unbound', { status: 'succeeded' })
  return response
}

export async function deleteMiniAccount(password: string) {
  const response = await mutateAccount(() => requestJson<{ success?: boolean; message?: string }>('/mini/account/delete', {
    method: 'POST',
    authenticated: true,
    data: { password }
  }))
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
  accountLifecycleVersion += 1
  sessionRequestVersion += 1
  lastSessionRefreshAt = 0
  sessionRefreshPending = null
  clearMiniSession()
}
