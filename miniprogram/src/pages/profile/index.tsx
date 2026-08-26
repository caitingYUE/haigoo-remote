import { Image, Text, View } from '@tarojs/components'
import Taro, { navigateTo, showModal, showToast, useDidShow } from '@tarojs/taro'
import { useCallback, useEffect, useState } from 'react'
import MiniIcon from '../../components/mini-icon'
import { resolveMiniAvatarUrl } from '../../config/api'
import { claimMemberService, fetchMemberServices } from '../../services/content-service'
import { fetchCareerMatchState, fetchCareerWatch, fetchCompanyFollows } from '../../services/career-match-service'
import type { CareerWatchResponse } from '../../services/career-match-service'
import { loginWithWechat } from '../../services/mini-auth-service'
import { getMiniUser, hasAuthenticatedSession } from '../../services/session'
import type { CareerMatchState, MemberServiceEntitlement } from '../../types'
import './index.scss'

const profileMenus = [
  { key: 'consultations', title: '职业咨询', description: '提交问题，查看咨询记录' },
  { key: 'community', title: '开放交流群', description: '和大家聊聊远程工作' },
  { key: 'orders', title: '订单记录', description: '查看支付和退款状态' },
  { key: 'settings', title: '账号与安全', description: '管理密码、绑定和隐私' }
]

const serviceStatus = { available: '可领取', requested: '已申请', in_progress: '处理中', completed: '已完成' }
const membershipLabel = (value?: string) => value === 'quarter' ? '季度会员' : value === 'half_year' ? '半年会员' : 'Haigoo 会员'
const serviceUpdatedLabel = (value?: string | null) => value ? `更新于 ${new Date(value).toLocaleDateString('zh-CN')}` : ''
const roleLabels: Record<string, string> = { product: '产品', project: '项目', engineering: '研发', design: '设计', data: '数据', marketing: '市场', sales: '销售', operations: '运营', research: '研究', finance: '财务', hr: '人力' }

export default function ProfilePage() {
  const [, setSessionVersion] = useState(0)
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
    if (!hasAuthenticatedSession()) { setFollowCount(null); setUnreadCount(null); setMembership(null); setWatchState(null); setCareerState(null); setServices([]); setDashboardLoaded(false); setDashboardError(''); return }
    setDashboardError('')
    const [follows, watch, career, memberServices] = await Promise.all([
      fetchCompanyFollows().catch(() => null),
      fetchCareerWatch().catch(() => null),
      fetchCareerMatchState().catch(() => null),
      fetchMemberServices().catch(() => null)
    ])
    setFollowCount(follows ? follows.follows.length : null)
    setUnreadCount(watch ? watch.followedUpdates.length : null)
    setWatchState(watch)
    setCareerState(career)
    if (watch) Taro.eventCenter.trigger('haigoo:unread-change', watch.followedUpdates.length)
    setMembership(memberServices?.membership || null)
    setServices(memberServices?.entitlements || [])
    setDashboardLoaded(true)
    if (!follows || !watch || !career || !memberServices) setDashboardError('部分信息暂时无法加载')
  }, [])

  useDidShow(() => {
    Taro.eventCenter.trigger('haigoo:tab-change', '/pages/profile/index')
    setSessionVersion((value) => value + 1)
    void loadDashboard()
  })

  const handleLogin = async () => {
    try {
      const session = await loginWithWechat(); setSessionVersion((value) => value + 1)
      if (!session.bound) navigateTo({ url: '/pages/account-bind/index' })
      else { showToast({ title: '微信登录成功', icon: 'success' }); await loadDashboard() }
    } catch (error) { showModal({ title: '微信登录失败', content: error instanceof Error ? error.message : '请稍后重试', showCancel: false }) }
  }

  const handleMenu = (key: string) => {
    if (key === 'community') return navigateTo({ url: '/pages/community/index' })
    if (!isAuthenticated) return void handleLogin()
    if (key === 'consultations') return navigateTo({ url: '/pages/consultation/index' })
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

  const activeMembership = membership || (!dashboardLoaded && user ? { isMember: Boolean(user.isMember), memberType: user.memberType || '', memberExpireAt: user.memberExpireAt } : null)
  const memberExpireAt = activeMembership?.memberExpireAt ? new Date(activeMembership.memberExpireAt).toLocaleDateString('zh-CN') : ''
  const directionSummary = watchState?.profile
    ? (watchState.profile.customRoleTerms.length ? watchState.profile.customRoleTerms : watchState.profile.roleFamilies.map((role) => roleLabels[role] || role)).join('、')
    : '尚未设置'
  const resumeSummary = careerState?.importedResume?.filename || (careerState?.profile?.source_type === 'resume' ? '已导入简历' : '上传或更新简历')

  return <View className='page-shell profile-page'>
    <View className='profile-identity'>
      <View className='profile-identity__avatar'>{isAuthenticated && avatarUrl && !avatarFailed ? <Image src={avatarUrl} mode='aspectFill' onError={() => setAvatarFailed(true)} /> : <Image className='profile-identity__default' src='/assets/icons/default-user.svg' mode='aspectFit' />}</View>
      <View className='profile-identity__copy'><Text>{isAuthenticated ? user?.username || 'Haigoo 用户' : '登录 Haigoo'}</Text><Text>{isAuthenticated ? user?.email || '查看你的匹配与服务' : '登录后保存匹配和通知'}</Text></View>
      {!isAuthenticated ? <View className='profile-login' onClick={handleLogin}>微信登录</View> : null}
    </View>

    {isAuthenticated ? <View className='profile-facts'><View aria-role='button' onClick={() => Taro.switchTab({ url: '/pages/companies/index' })}><Text>{followCount ?? '—'}</Text><Text>关注企业</Text></View><View aria-role='button' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}><Text>{unreadCount ?? '—'}</Text><Text>未读岗位更新</Text></View></View> : null}
    {isAuthenticated && dashboardError ? <View className='profile-dashboard-error'><Text>{dashboardError}</Text><Text aria-role='button' onClick={() => void loadDashboard()}>重新加载</Text></View> : null}

    <View className='profile-membership' onClick={() => navigateTo({ url: '/pages/membership/index' })}>
      <View><MiniIcon name='club' size={25} /><View><Text>{activeMembership?.isMember ? '会员权益正在生效' : '开通会员，查看更多企业'}</Text><Text>{activeMembership?.isMember ? `${membershipLabel(activeMembership.memberType)}${memberExpireAt ? ` · 有效期至 ${memberExpireAt}` : ''}` : '岗位提醒 · 内部联系人 · 求职支持'}</Text></View></View><MiniIcon name='chevronRight' size={19} />
    </View>

    {services.length ? <View className='profile-section'><Text className='profile-section__title'>半年会员服务</Text><View className='profile-services'>{services.map((service) => <View className='profile-service' key={service.key}><View><Text>{service.title}</Text><Text>{service.description}</Text>{service.status !== 'available' && service.updatedAt ? <Text className='profile-service__updated'>{serviceUpdatedLabel(service.updatedAt)}</Text> : null}</View><Text aria-role={service.status === 'available' ? 'button' : undefined} className={`profile-service__status profile-service__status--${service.status}`} onClick={service.status === 'available' ? () => void claim(service) : undefined}>{claiming === service.key ? '提交中…' : serviceStatus[service.status]}</Text></View>)}</View></View> : null}

    <View className='profile-section'><Text className='profile-section__title'>求职设置</Text><View className='profile-menu'>
      <View className='profile-menu__item' aria-role='button' onClick={() => isAuthenticated ? Taro.switchTab({ url: '/pages/index/index' }) : void handleLogin()}><View><Text>求职方向</Text><Text>{isAuthenticated ? directionSummary : '登录后设置'}</Text></View><MiniIcon name='chevronRight' size={19} /></View>
      <View className='profile-menu__item' aria-role='button' onClick={() => isAuthenticated ? navigateTo({ url: '/pages/career-data/index' }) : void handleLogin()}><View><Text>我的简历</Text><Text>{isAuthenticated ? resumeSummary : '登录后上传'}</Text></View><MiniIcon name='chevronRight' size={19} /></View>
    </View></View>

    <View className='profile-section'><Text className='profile-section__title'>服务与账号</Text><View className='profile-menu'>{profileMenus.map((item) => <View className='profile-menu__item' aria-role='button' key={item.key} onClick={() => handleMenu(item.key)}><View><Text>{item.title}</Text><Text>{item.description}</Text></View><MiniIcon name='chevronRight' size={19} /></View>)}</View></View>
  </View>
}
