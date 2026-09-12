import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useRef, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import AuthConsent from '../../components/auth-consent'
import { resolveMiniAvatarUrl } from '../../config/api'
import defaultUserIcon from '../../../assets/icons/default-user.svg'
import memberCrown from '../../../assets/icons/member-crown.svg'
import { claimMemberService, fetchMemberServices } from '../../services/content-service'
import { fetchCareerMatchState, fetchCareerWatch, fetchCompanyFollows } from '../../services/career-match-service'
import type { CareerWatchResponse } from '../../services/career-match-service'
import { loginWithWechat, refreshWechatSession } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import type { CareerMatchState, MemberServiceEntitlement } from '../../types'
import { formatCalendarDate } from '../../utils/runtime-compat'
import './index.scss'

const profileMenus = [
  { key: 'favorites', title: '收藏岗位', description: '查看与官网同步的岗位收藏', icon: 'favorite' },
  { key: 'consultations', title: '职业咨询', description: '提交问题，查看咨询记录', icon: 'service' },
  { key: 'community', title: '开放交流群', description: '和大家聊聊远程工作', icon: 'community' },
  { key: 'orders', title: '订单记录', description: '查看支付和退款状态', icon: 'orders' },
  { key: 'settings', title: '账号与安全', description: '管理密码、绑定和隐私', icon: 'settings' }
] as const

const serviceStatus = { unavailable: '不可领取', available: '可领取', requested: '已申请', in_progress: '处理中', completed: '已完成' }
const membershipLabel = (value?: string) => value === 'quarter' ? '季度会员' : value === 'half_year' ? '半年会员' : 'Haigoo 会员'
const serviceUpdatedLabel = (value?: string | null) => formatCalendarDate(value) ? `更新于 ${formatCalendarDate(value)}` : ''
const roleLabels: Record<string, string> = { product: '产品', project: '项目', engineering: '研发', design: '设计', data: '数据', marketing: '市场', sales: '销售', operations: '运营', research: '研究', finance: '财务', hr: '人力' }

export default function ProfilePage() {
  const dashboardLoadVersion = useRef(0)
  const [, setSessionVersion] = useState(0)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [loggingIn, setLoggingIn] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  const [followCount, setFollowCount] = useState<number | null>(null)
  const [unreadCount, setUnreadCount] = useState<number | null>(null)
  const [membership, setMembership] = useState<{ isMember: boolean; memberType: string; memberExpireAt?: string | null } | null>(null)
  const [watchState, setWatchState] = useState<CareerWatchResponse | null>(null)
  const [careerState, setCareerState] = useState<CareerMatchState | null>(null)
  const [services, setServices] = useState<MemberServiceEntitlement[]>([])
  const [claiming, setClaiming] = useState('')
  const [dashboardLoaded, setDashboardLoaded] = useState(false)
  const [dashboardError, setDashboardError] = useState('')
  const isAuthenticated = hasAuthenticatedSession()
  const user = getMiniUser()
  const avatarUrl = resolveMiniAvatarUrl(user?.avatar)
  useEffect(() => setAvatarFailed(false), [avatarUrl])

  const loadDashboard = useCallback(async () => {
    const loadVersion = ++dashboardLoadVersion.current
    if (!hasAuthenticatedSession()) { setFollowCount(null); setUnreadCount(null); setMembership(null); setWatchState(null); setCareerState(null); setServices([]); setDashboardLoaded(false); setDashboardError(''); return }
    setDashboardLoaded(false)
    setDashboardError('')
    const refreshFailed = await refreshWechatSession().then(() => false).catch(() => true)
    const [follows, watch, career, memberServices] = await Promise.all([
      fetchCompanyFollows().catch(() => null),
      fetchCareerWatch().catch(() => null),
      fetchCareerMatchState().catch(() => null),
      fetchMemberServices().catch(() => null)
    ])
    if (loadVersion !== dashboardLoadVersion.current) return
    setFollowCount(follows ? follows.follows.length : null)
    setUnreadCount(watch ? watch.followedUpdates.length : null)
    setWatchState(watch)
    setCareerState(career)
    if (watch) Taro.eventCenter.trigger('haigoo:unread-change', watch.followedUpdates.length)
    setMembership(memberServices?.membership || null)
    setServices(memberServices?.entitlements || [])
    setDashboardLoaded(true)
    if (refreshFailed || !follows || !watch || !career || !memberServices) setDashboardError('部分信息暂时无法加载')
  }, [])

  useDidShow(() => {
    setSessionVersion((value) => value + 1)
    void loadDashboard()
  })

  const handleLogin = async () => {
    if (loggingIn) return
    if (!consentAccepted) { showToast({ title: '请先阅读并勾选同意下方协议', icon: 'none' }); return }
    setLoggingIn(true)
    try {
      const session = await loginWithWechat(consentAccepted); setSessionVersion((value) => value + 1)
      setConsentAccepted(false)
      if (!session.bound) navigateTo({ url: '/pages/account-bind/index' })
      else { showToast({ title: '微信登录成功', icon: 'success' }); await loadDashboard() }
    } catch (error) { showModal({ title: '微信登录失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false }) }
    finally { setLoggingIn(false) }
  }

  const handleMenu = (key: string) => {
    if (key === 'community') return navigateTo({ url: '/pages/community/index' })
    if (!isAuthenticated) return void handleLogin()
    if (key === 'consultations') return navigateTo({ url: '/pages/consultation/index' })
    if (key === 'favorites') return navigateTo({ url: '/pages/favorite-jobs/index' })
    if (key === 'orders') return navigateTo({ url: '/pages/payment-orders/index' })
    if (key === 'settings') navigateTo({ url: '/pages/account-settings/index' })
  }

  const claim = async (service: MemberServiceEntitlement) => {
    if (service.status !== 'available' || claiming) return
    const confirmed = await showModal({ title: `申请${service.title}`, content: '提交后由现有会员服务团队联系并安排交付。', confirmText: '确认申请' })
    if (!confirmed.confirm) return
    setClaiming(service.key)
    try {
      const result = await claimMemberService(service.key)
      setServices((current) => current.map((item) => item.key === result.entitlement.key ? result.entitlement : item))
      showToast({ title: '已提交申请', icon: 'success' })
    } catch (error) { showModal({ title: '申请没有完成', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false }) } finally { setClaiming('') }
  }

  // The locally persisted user can be stale after a refund. Only render a
  // membership badge once the authoritative dashboard request has completed.
  const activeMembership = dashboardLoaded ? membership : null
  const membershipPending = isAuthenticated && !dashboardLoaded
  const memberExpireAt = formatCalendarDate(activeMembership?.memberExpireAt)
  const directionSummary = watchState?.profile
    ? (watchState.profile.customRoleTerms.length ? watchState.profile.customRoleTerms : watchState.profile.roleFamilies.map((role) => roleLabels[role] || role)).join('、')
    : '尚未设置'
  const resumeSummary = careerState?.importedResume?.filename || (careerState?.profile?.source_type === 'resume' ? '已导入简历' : '上传或更新简历')

  return <View className='page-shell profile-page'>
    <View className='profile-identity'>
      <View className={`profile-identity__avatar ${activeMembership?.isMember ? 'is-member' : ''}`}>
        <View className='profile-identity__avatar-image'>{isAuthenticated && avatarUrl && !avatarFailed ? <Image src={avatarUrl} mode='aspectFill' onError={() => setAvatarFailed(true)} /> : <Image className='profile-identity__default' src={defaultUserIcon} mode='aspectFit' />}</View>
        {activeMembership?.isMember ? <View className='profile-identity__member-badge' aria-label='会员头像标识'><Image src={memberCrown} mode='aspectFit' /></View> : null}
      </View>
      <View className='profile-identity__copy'><Text>{isAuthenticated ? user?.username || 'Haigoo 用户' : '登录 Haigoo'}</Text><Text>{isAuthenticated ? user?.email || '查看你的匹配与服务' : '登录后保存匹配和通知'}</Text></View>
      {!isAuthenticated ? <View className='profile-login' aria-role='button' aria-label='微信登录' aria-disabled={loggingIn} hoverClass='mini-action--pressed' onClick={handleLogin}>{loggingIn ? '登录中…' : '微信登录'}</View> : null}
      {isAuthenticated ? <View className='profile-edit' aria-role='button' aria-label='编辑账号与安全' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/account-settings/index' })}>编辑</View> : null}
    </View>

    {!isAuthenticated ? <View className='profile-auth-notice'><Text>登录将使用微信身份标识，并在已连接账号时同步邮箱和会员状态。不同意也可继续浏览公开企业与岗位。</Text><AuthConsent accepted={consentAccepted} onChange={setConsentAccepted} /></View> : null}

    {isAuthenticated ? <View className='profile-facts'><View aria-role='button' aria-label={`查看关注企业，共 ${followCount ?? '—'} 家`} hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/followed-companies/index' })}><Text>{followCount ?? '—'}</Text><Text>关注企业</Text></View><View aria-role='button' aria-label={`查看未读岗位更新，共 ${unreadCount ?? '—'} 条`} hoverClass='mini-action--pressed' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}><Text>{unreadCount ?? '—'}</Text><Text>未读岗位更新</Text></View></View> : null}
    {isAuthenticated && dashboardError ? <View className='profile-dashboard-error' aria-live='polite'><Text>{dashboardError}</Text><Text aria-role='button' aria-label='重新加载个人信息' onClick={() => void loadDashboard()}>重新加载</Text></View> : null}

    <View className='profile-membership' aria-role='button' aria-label='查看会员方案' hoverClass='mini-action--pressed' onClick={() => navigateTo({ url: '/pages/membership/index' })}>
      <View><MiniIcon name='club' size={25} /><View><Text>{membershipPending ? '正在确认会员状态' : activeMembership?.isMember ? '会员权益正在生效' : '开通会员，查看更多企业'}</Text><Text>{membershipPending ? '请稍候' : activeMembership?.isMember ? `${membershipLabel(activeMembership.memberType)}${memberExpireAt ? ` · 有效期至 ${memberExpireAt}` : ''}` : '岗位提醒 · 内部联系人 · 求职支持'}</Text></View></View><MiniIcon name='chevronRight' size={19} />
    </View>

    {services.length ? <View className='profile-section'><Text className='profile-section__title'>会员服务</Text><View className='profile-services'>{services.map((service) => <View className='profile-service' key={service.key}><View className='profile-service__info'><Text>{service.title}</Text><Text>{service.description}</Text>{service.status !== 'available' && service.updatedAt ? <Text className='profile-service__updated'>{serviceUpdatedLabel(service.updatedAt)}</Text> : null}</View><View aria-role={service.status === 'available' ? 'button' : undefined} className={`profile-service__status profile-service__status--${service.status}`} aria-label={service.status === 'available' ? `申请${service.title}` : serviceStatus[service.status]} onClick={service.status === 'available' ? () => void claim(service) : undefined}>{claiming === service.key ? '提交中…' : serviceStatus[service.status]}</View></View>)}</View></View> : null}

    <View className='profile-section'><Text className='profile-section__title'>求职设置</Text><View className='profile-menu'>
      <View className='profile-menu__item' aria-role='button' aria-label='设置求职方向' hoverClass='mini-action--pressed' onClick={() => isAuthenticated ? Taro.switchTab({ url: '/pages/index/index' }) : void handleLogin()}><View className='profile-menu__icon'><MiniIcon name='target' size={21} /></View><View><Text>求职方向</Text><Text>{isAuthenticated ? directionSummary : '登录后设置'}</Text></View><MiniIcon name='chevronRight' size={19} /></View>
      <View className='profile-menu__item' aria-role='button' aria-label='管理我的简历' hoverClass='mini-action--pressed' onClick={() => isAuthenticated ? navigateTo({ url: '/pages/career-data/index' }) : void handleLogin()}><View className='profile-menu__icon'><MiniIcon name='application' size={21} /></View><View><Text>我的简历</Text><Text>{isAuthenticated ? resumeSummary : '登录后上传'}</Text></View><MiniIcon name='chevronRight' size={19} /></View>
    </View></View>

    <View className='profile-section'><Text className='profile-section__title'>服务与账号</Text><View className='profile-menu'>{profileMenus.map((item) => <View className='profile-menu__item' aria-role='button' aria-label={item.title} hoverClass='mini-action--pressed' key={item.key} onClick={() => handleMenu(item.key)}><View className='profile-menu__icon'><MiniIcon name={item.icon} size={21} /></View><View><Text>{item.title}</Text><Text>{item.description}</Text></View><MiniIcon name='chevronRight' size={19} /></View>)}</View></View>
  </View>
}
