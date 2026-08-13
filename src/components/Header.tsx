import { Bell, User, Menu, ChevronDown, Trash2, Check, Crown, Sparkles, Search, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from './NotificationSystem'
import { useLanguage } from '../contexts/LanguageContext'
import LanguageToggle from './LanguageToggle'
import { COMPLIANCE_FEATURES } from '../config/compliance'

interface HeaderProps {
  showUpgradeNotice?: boolean
}

function formatHeaderDisplayName(name: string, memberType?: string | null) {
  const normalized = name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Starter|Member|Partner)\)\s*/gi, '').trim()
  return normalized || name
}

export default function Header({ showUpgradeNotice = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [headerSearchTerm, setHeaderSearchTerm] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, token, isMember, isTrialMember, memberType, isLoading: authLoading } = useAuth()
  const { showWarning } = useNotificationHelpers()
  const { isEnglish, text, path } = useLanguage()


  const userMenuRef = useRef<HTMLDivElement>(null)
  const notificationRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const userMenuButtonRef = useRef<HTMLButtonElement>(null)

  // Fetch notifications
  useEffect(() => {
    if (isAuthenticated && token) {
      fetch('/api/user-profile?action=notifications', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setNotifications(data.notifications || [])
          }
        })
        .catch(console.error)
    }
  }, [isAuthenticated, token])

  const unreadCount = notifications.filter(n => !n.isRead).length
  const isDeepLegacyMember = memberType === 'quarter_pro'
  const isQuarterMember = memberType === 'quarter'
  const shouldShowMemberTextBadge = isMember && isTrialMember && !isQuarterMember && !isDeepLegacyMember
  const userDisplayName = formatHeaderDisplayName(user?.username || '用户', memberType)
  const memberAvatarRingClass = isMember ? 'ring-2 ring-[#ffb28f] border-2 border-white' : ''
  const memberBadgeBgClass = 'bg-[#fff2eb]'
  const memberBadgeIconClass = 'text-[#d84b1f] fill-[#d84b1f]'
  const memberNameClass = isMember ? 'text-[#8f5e19]' : 'text-slate-700'
  const memberTextBadge = isEnglish ? 'Trail' : '体验会员'
  const memberTextBadgeClass = 'border-[#e7c98e] bg-[#fff8e8] text-[#8f5e19]'

  const handleMarkRead = async (id?: string) => {
    try {
      const res = await fetch('/api/user-profile?action=notifications_mark_read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        setNotifications(prev => prev.map(n =>
          (!id || n.id === id) ? { ...n, isRead: true } : n
        ))
      }
    } catch (e) {
      console.error(e)
    }
  }

  const handleDelete = async (id?: string) => {
    try {
      const res = await fetch('/api/user-profile?action=notifications_delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        if (id) {
          setNotifications(prev => prev.filter(n => n.id !== id))
        } else {
          setNotifications([])
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Click outside to close notification dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setIsNotificationOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  // 处理登出
  const handleLogout = () => {
    logout()
    setIsUserMenuOpen(false)
    navigate(path('/login'))
  }

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape 键关闭菜单
      if (e.key === 'Escape') {
        if (isUserMenuOpen) {
          setIsUserMenuOpen(false)
          userMenuButtonRef.current?.focus()
        }
        if (isMenuOpen) {
          setIsMenuOpen(false)
          mobileMenuButtonRef.current?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMenuOpen, isUserMenuOpen])

  // 处理鼠标进入用户菜单区域
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsUserMenuOpen(true)
  }

  // 处理鼠标离开用户菜单区域
  const handleMouseLeave = () => {
    timeoutRef.current = window.setTimeout(() => {
      setIsUserMenuOpen(false)
    }, 300) // 300ms延迟，给用户足够时间移动鼠标
  }

  // 键盘事件处理函数
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  // 用户菜单键盘导航
  const handleUserMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setIsUserMenuOpen(!isUserMenuOpen)
    } else if (e.key === 'ArrowDown' && !isUserMenuOpen) {
      e.preventDefault()
      setIsUserMenuOpen(true)
    }
  }

  // 用户菜单选项
  const userMenuItems: { id: string; label: string; href: string; danger?: boolean }[] = [
    { id: 'profile-resume', label: text('首页', 'Home'), href: '/profile?tab=resume' },
    ...(isMember || !COMPLIANCE_FEATURES.nonMemberProfileUtilitiesOnHome ? [
      { id: 'profile-favorites', label: text('我的收藏', 'Saved jobs'), href: '/profile?tab=favorites' },
      { id: 'profile-applications', label: text('我的申请', 'My applications'), href: '/profile?tab=applications' },
    ] : []),
    { id: 'membership', label: text('咨询服务', 'Consulting service'), href: '/profile?tab=membership' },
    { id: 'profile-about', label: text('关于我们', 'About us'), href: '/profile?tab=about' },
    { id: 'profile-feedback', label: text('意见反馈', 'Feedback'), href: '/profile?tab=feedback' },
    { id: 'profile-settings', label: text('账户设置', 'Account settings'), href: '/profile?tab=settings' },
  ]

  const isJobsPage = location.pathname === '/jobs' || location.pathname.startsWith('/jobs/')
  useEffect(() => {
    if (!isJobsPage) return
    const params = new URLSearchParams(location.search)
    setHeaderSearchTerm(params.get('search') || '')
  }, [isJobsPage, location.search])

  const submitHeaderSearch = (event: FormEvent) => {
    event.preventDefault()
    const keyword = headerSearchTerm.trim()

    if (keyword && authLoading) return

    if (keyword && !isAuthenticated) {
      const destination = `/jobs?search=${encodeURIComponent(keyword)}`
      showWarning(text('请先登录', 'Please log in'), text('登录后即可搜索并查看完整岗位结果。', 'Log in to search and view complete job results.'))
      navigate(path(`/login?redirect=${encodeURIComponent(path(destination))}`))
      return
    }

    if (keyword && !user?.emailVerified) {
      showWarning(text('请先验证邮箱', 'Please verify your email'), text('完成邮箱验证后即可搜索并查看完整岗位结果。', 'Verify your email to search and view complete job results.'))
      return
    }

    if (!isJobsPage) {
      navigate(path(keyword ? `/jobs?search=${encodeURIComponent(keyword)}` : '/jobs'))
      return
    }

    const params = new URLSearchParams(location.search)
    if (keyword) params.set('search', keyword)
    else params.delete('search')
    navigate(path(`/jobs${params.toString() ? `?${params.toString()}` : ''}`))
  }

  const clearHeaderSearch = () => {
    setHeaderSearchTerm('')
    if (!isJobsPage) return
    const params = new URLSearchParams(location.search)
    params.delete('search')
    navigate(path(`/jobs${params.toString() ? `?${params.toString()}` : ''}`))
  }

  return (
    <>
    <a className="haigoo-skip-link" href="#main-content">{text('跳到主要内容', 'Skip to main content')}</a>
    <header
      className={`haigoo-site-header pointer-events-none fixed left-0 right-0 z-50 transition-[top] duration-300 ${showUpgradeNotice ? 'top-10' : 'top-0'}`}
      role="banner"
    >
      <div className="haigoo-site-header__bar pointer-events-auto w-full transition-[width,margin,border-radius] duration-300">
        <div className="mx-auto flex h-14 w-full max-w-[1800px] items-center gap-2 px-3 sm:px-4 md:h-16 lg:gap-3 xl:px-5 2xl:gap-4 2xl:px-6">
          {/* Logo */}
          <div className="flex items-center group shrink-0">
            {/* Logo Image with Optical Adjustment */}
            <Link
              to={path('/')}
              className="haigoo-site-header__brand flex items-center gap-3 focus:outline-none no-underline hover:no-underline"
              aria-label={text('Haigoo 首页', 'Haigoo home')}
            >
              <span className="haigoo-site-header__wordmark"><strong>HAIGOO</strong><span>REMOTE</span></span>
              {!isEnglish ? <span className="haigoo-site-header__brand-cn hidden md:block">海狗远程</span> : null}
            </Link>
          </div>

          {isJobsPage ? <form onSubmit={submitHeaderSearch} className="hidden min-w-0 shrink xl:block xl:flex-[0_1_300px] 2xl:flex-[0_1_420px]">
            <div className="haigoo-site-header__search relative w-full min-w-[210px] max-w-[420px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={headerSearchTerm}
                onChange={(event) => setHeaderSearchTerm(event.target.value)}
                placeholder={text('搜索岗位、公司或技能', 'Search roles, companies, or skills')}
                aria-label={text('搜索岗位、公司或技能', 'Search roles, companies, or skills')}
                className="h-10 w-full rounded-full border-0 bg-transparent pl-9 pr-10 text-sm font-medium text-slate-800 outline-none placeholder:text-slate-400"
              />
              {headerSearchTerm ? (
                <button
                  type="button"
                  onClick={clearHeaderSearch}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label={text('清除搜索', 'Clear search')}
                  title={text('清除搜索', 'Clear search')}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </form> : null}

          {/* Main Navigation */}
          <div className="ml-auto hidden min-w-0 shrink items-center gap-3 lg:flex xl:gap-4 2xl:gap-6">
            <Link
              to={path('/')}
              className="haigoo-site-header__nav-link whitespace-nowrap"
              aria-current={location.pathname === '/' ? 'page' : undefined}
            >
              {text('首页', 'Home')}
            </Link>

            <Link
              to={path('/jobs')}
              className="haigoo-site-header__nav-link whitespace-nowrap"
              aria-current={isJobsPage ? 'page' : undefined}
            >
              {text('远程工作', 'Remote jobs')}
            </Link>

            <Link
              to={path('/trusted-companies')}
              className="haigoo-site-header__nav-link whitespace-nowrap"
              aria-current={location.pathname.startsWith('/trusted-companies') ? 'page' : undefined}
            >
              {text('远程企业', 'Remote companies')}
            </Link>

            <Link
              to={path('/careerlearning')}
              className="haigoo-site-header__nav-link whitespace-nowrap"
              aria-current={location.pathname.startsWith('/careerlearning') || location.pathname.startsWith('/corporate-english') ? 'page' : undefined}
            >
              {text('职业成长', 'Career growth')}
            </Link>

            <Link
              to={path('/profile?tab=resume')}
              className="haigoo-site-header__nav-link whitespace-nowrap"
              aria-current={location.pathname.startsWith('/profile') ? 'page' : undefined}
            >
              {text('个人中心', 'Personal center')}
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex shrink-0 items-center gap-1.5 xl:gap-2 2xl:gap-3" role="toolbar" aria-label={text('用户操作', 'User actions')}>
            <LanguageToggle />
            {/* 未登录：显示登录/注册按钮 */}
            {!isAuthenticated && (
              <>
                <Link
                  to={path('/login')}
                  className="hidden px-4 py-2 text-sm font-medium transition-colors no-underline hover:no-underline text-slate-600 hover:text-slate-900 md:inline-flex"
                >
                  {text('登录', 'Log in')}
                </Link>
                <Link
                  to={path('/register')}
                  className="haigoo-site-header__primary-action hidden min-h-11 items-center rounded-full px-6 text-sm font-semibold transition-colors no-underline md:inline-flex"
                >
                  {text('注册', 'Sign up')}
                </Link>
              </>
            )}

            {/* 已登录：显示通知和用户菜单 */}
            {isAuthenticated && (
              <>
                {/* Notifications */}
                <div ref={notificationRef} className="relative">
                  <button
                    onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                    className={`hg-notification-trigger relative flex h-11 w-11 items-center justify-center rounded-full border p-0 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#f5b391] focus-visible:ring-offset-2 ${
                      isNotificationOpen
                        ? 'border-[#f5b391] bg-[#fff4ee] text-[#a83c17]'
                        : 'border-transparent text-slate-400 hover:border-[#e1e5eb] hover:bg-[#f6f7fa] hover:text-[#c94f22]'
                    }`}
                    aria-label={text(`通知，有 ${unreadCount} 条新消息`, `Notifications, ${unreadCount} unread`)}
                    aria-expanded={isNotificationOpen}
                    aria-haspopup="dialog"
                    title={text('通知', 'Notifications')}
                  >
                    <Bell className="h-[21px] w-[21px]" aria-hidden="true" />
                    {unreadCount > 0 && (
                      <span
                        className="absolute -top-1 -right-1 flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white"
                        aria-hidden="true"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotificationOpen && (
                    <div className={`hg-notification-popover fixed left-3 right-3 z-50 overflow-hidden border border-[#e1e5eb] bg-white shadow-[0_28px_72px_-28px_rgba(15,23,42,0.38)] animate-in fade-in-0 zoom-in-95 duration-200 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[23rem] ${showUpgradeNotice ? 'top-28' : 'top-16'}`} role="dialog" aria-label={text('消息中心', 'Message center')}>
                      <div className="flex items-center justify-between border-b border-[#e6e1d8] px-4 py-3.5">
                        <h3 className="text-sm font-semibold text-slate-900">{text('消息通知', 'Notifications')}</h3>
                        <div className="flex gap-2">
                          <button onClick={() => handleMarkRead()} disabled={notifications.length === 0 || unreadCount === 0} className="inline-flex h-9 w-9 items-center justify-center border border-transparent text-[#466f9d] hover:border-[#c9dce8] hover:bg-[#eff5fb] disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-transparent disabled:hover:bg-transparent" title={text('全部已读', 'Mark all as read')} aria-label={text('全部已读', 'Mark all as read')}>
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete()} disabled={notifications.length === 0} className="inline-flex h-9 w-9 items-center justify-center border border-transparent text-slate-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:border-transparent disabled:hover:bg-transparent" title={text('清空全部', 'Clear all')} aria-label={text('清空全部', 'Clear all')}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-slate-500 text-sm">
                            {text('暂无消息', 'No notifications')}
                          </div>
                        ) : (
                          notifications.map(notification => (
                            <div key={notification.id} className={`group relative border-b border-[#e6e1d8] px-4 py-3.5 last:border-0 hover:bg-[#f4f8fb] ${!notification.isRead ? 'bg-[#eff5fb] shadow-[inset_3px_0_0_#466f9d]' : ''}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`border px-2 py-1 text-[11px] font-bold ${notification.type === 'feedback_reply' ? 'border-[#c9dce8] bg-[#eff5fb] text-[#466f9d]' :
                                    notification.type === 'application_update' ? 'border-[#d7e5d2] bg-[#f3f6f0] text-[#4e6250]' :
                                      'border-[#e7c98e] bg-[#fff8e8] text-[#8f5e19]'
                                  }`}>
                                  {notification.type === 'feedback_reply' ? text('反馈回复', 'Feedback reply') : notification.type === 'application_update' ? text('申请更新', 'Application update') : text('系统消息', 'System message')}
                                </span>
                                <span className="text-xs text-slate-400">{new Date(notification.createdAt).toLocaleDateString()}</span>
                              </div>
                              <h4 className={`text-sm font-medium mb-1 ${!notification.isRead ? 'text-slate-900' : 'text-slate-700'}`}>{notification.title}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{notification.content}</p>

                              <div className="absolute right-2 top-2 hidden gap-1 border border-[#e6e1d8] bg-[#fffdf8]/95 p-1 shadow-sm group-hover:flex">
                                {!notification.isRead && (
                                  <button onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id) }} className="p-1 text-slate-400 hover:bg-[#eff5fb] hover:text-[#466f9d]" title={text('标为已读', 'Mark as read')}>
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(notification.id) }} className="p-1 hover:text-red-600 text-slate-400" title={text('删除', 'Delete')}>
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu - 优化用户菜单设计 */}
                <div
                  ref={userMenuRef}
                  className="relative hidden lg:block"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    ref={userMenuButtonRef}
                    className="hg-header-account-trigger flex max-w-[210px] items-center gap-1.5 p-1.5 text-slate-700 transition-[background-color,color,box-shadow] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff9a6c] focus-visible:ring-offset-2 2xl:gap-2 2xl:p-2"
                    onKeyDown={handleUserMenuKeyDown}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label={text(`用户菜单，当前用户：${userDisplayName}`, `User menu, current user: ${userDisplayName}`)}
                    id="user-menu-button"
                  >
                    {user?.avatar ? (
                      <div className="relative">
                        <img
                          src={user.avatar}
                          alt={userDisplayName}
                          className={`hg-header-account-avatar w-8 h-8 ${memberAvatarRingClass}`}
                        />
                        {isMember && (
                          <div className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 border border-white shadow-sm ${memberBadgeBgClass}`}>
                            {isTrialMember ? <Sparkles className={`w-3 h-3 ${memberBadgeIconClass}`} /> : <Crown className={`w-3 h-3 ${memberBadgeIconClass}`} />}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <div
                          className={`hg-header-account-avatar flex h-8 w-8 items-center justify-center bg-[#1b2440] ${memberAvatarRingClass}`}
                          role="img"
                          aria-label={text('用户头像', 'User avatar')}
                        >
                          <User className="h-4 w-4 text-white" aria-hidden="true" />
                        </div>
                        {isMember && (
                          <div className={`absolute -top-1.5 -right-1.5 rounded-full p-0.5 border border-white shadow-sm ${memberBadgeBgClass}`}>
                            {isTrialMember ? <Sparkles className={`w-3 h-3 ${memberBadgeIconClass}`} /> : <Crown className={`w-3 h-3 ${memberBadgeIconClass}`} />}
                          </div>
                        )}
                      </div>
                    )}
                    <span className={`hidden max-w-[132px] truncate text-sm font-medium 2xl:block ${memberNameClass}`} title={userDisplayName}>
                      {userDisplayName}
                    </span>
                    {shouldShowMemberTextBadge && (
                      <span className={`hidden 2xl:inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-black leading-none ${memberTextBadgeClass}`}>
                        {memberTextBadge}
                      </span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* 优化下拉菜单设计 */}
                  {isUserMenuOpen && (
                    <div
                      className="hg-header-account-menu absolute right-0 z-50 mt-2 w-72 animate-in fade-in-0 zoom-in-95 duration-200"
                      role="menu"
                      aria-labelledby="user-menu-button"
                      aria-orientation="vertical"
                    >
                      {/* 用户信息 */}
                      <div className="hg-header-account-summary" role="presentation">
                        <div className="flex items-center space-x-3">
                          {user?.avatar ? (
                            <img
                              src={user.avatar}
                              alt={userDisplayName}
                              className="hg-header-account-avatar h-10 w-10"
                            />
                          ) : (
                            <div
                              className="hg-header-account-avatar flex h-10 w-10 items-center justify-center bg-[#1b2440]"
                              role="img"
                              aria-label={text('用户头像', 'User avatar')}
                            >
                              <User className="h-5 w-5 text-white" aria-hidden="true" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-medium text-slate-900">{userDisplayName}</p>
                              {shouldShowMemberTextBadge && (
                                <span className={`inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[10px] font-black leading-none ${memberTextBadgeClass}`}>
                                  {memberTextBadge}
                                </span>
                              )}
                              {isMember ? <span className="hg-header-member-tag inline-flex h-5 shrink-0 items-center border px-2 text-[10px] font-bold leading-none">Haigoo Club Member</span> : null}
                            </div>
                            <p className="text-xs text-slate-500 truncate" title={user?.profile?.title || user?.email}>{user?.profile?.title || user?.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="hg-header-account-links" role="group" aria-label={text('我的 Haigoo', 'My Haigoo')}>
                        {userMenuItems.map((item) => (
                          <Link
                            key={item.id}
                            to={path(item.href)}
                            className="hg-header-account-link"
                            role="menuitem"
                            tabIndex={isUserMenuOpen ? 0 : -1}
                            onClick={() => setIsUserMenuOpen(false)}
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>

                      {/* 账户操作区域 */}
                      <div className="hg-header-account-actions" role="group" aria-label={text('账户操作', 'Account actions')}>
                        {/* 退出登录 - 调整为常规颜色 */}
                        <button
                          onClick={handleLogout}
                          className="hg-header-account-link hg-header-account-logout"
                          role="menuitem"
                          tabIndex={isUserMenuOpen ? 0 : -1}
                          aria-label={text('退出登录', 'Log out')}
                        >
                          <div className="flex items-center">
                            <span className="flex-1">{text('退出登录', 'Log out')}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Mobile menu button */}
            <button
              ref={mobileMenuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              onKeyDown={(e) => handleKeyDown(e, () => setIsMenuOpen(!isMenuOpen))}
              className="lg:hidden p-3 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-haigoo-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? text('关闭移动菜单', 'Close mobile menu') : text('打开移动菜单', 'Open mobile menu')}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav
            className="absolute left-3 right-3 top-full mt-3 max-h-[calc(100dvh-4.75rem)] overflow-y-auto overscroll-contain rounded-2xl border border-[#e5edf3] bg-[#fffdf8] pb-[env(safe-area-inset-bottom)] shadow-[0_20px_48px_-36px_rgba(139,101,54,0.46)] lg:hidden"
            id="mobile-menu"
            role="navigation"
            aria-label={text('移动端导航', 'Mobile navigation')}
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to={path('/')}
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname === '/'
                  ? 'bg-[#eff5fb] text-[#345d88]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {text('首页', 'Home')}
              </Link>
              <Link
                to={path('/jobs')}
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname === '/jobs'
                  ? 'bg-[#eff5fb] text-[#345d88]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {text('远程工作', 'Remote jobs')}
              </Link>
              <Link
                to={path('/trusted-companies')}
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/trusted-companies')
                  ? 'bg-[#eff5fb] text-[#345d88]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {text('远程企业', 'Remote companies')}
              </Link>
              <Link
                to={path('/careerlearning')}
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/careerlearning') || location.pathname.startsWith('/corporate-english')
                  ? 'bg-[#eff5fb] text-[#345d88]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {text('职业成长', 'Career growth')}
              </Link>
              <Link
                to={path('/profile?tab=resume')}
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/profile')
                  ? 'bg-[#eff5fb] text-[#345d88]'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {text('个人中心', 'Personal center')}
              </Link>

              {/* 移动端用户菜单 */}
              {isAuthenticated && (
                <div className="border-t border-slate-200 pt-2 mt-2" role="region" aria-label={text('用户信息和操作', 'User information and actions')}>
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-3 mb-3">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={userDisplayName}
                          className={`w-8 h-8 rounded-full ${memberAvatarRingClass}`}
                        />
                      ) : (
                        <div
                          className={`w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center ${memberAvatarRingClass}`}
                          role="img"
                          aria-label={text('用户头像', 'User avatar')}
                        >
                          <User className="h-5 w-5 text-white" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">{userDisplayName}</p>
                          {isMember ? <span className="hg-header-member-tag inline-flex h-5 shrink-0 items-center border px-2 text-[10px] font-bold leading-none">Club Member</span> : null}
                        </div>
                        <p className="text-xs text-slate-500">{user?.profile?.title || user?.email}</p>
                      </div>
                    </div>

                    {userMenuItems.map((item) => {
                      const isActive = location.pathname === item.href || (item.href.includes('?') && location.search.includes(item.href.split('?')[1]))
                      return (
                        <Link
                          key={item.id}
                          to={path(item.href)}
                          className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${isActive
                              ? 'bg-[#eff5fb] text-[#345d88]'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      )
                    })}

                    <button
                      onClick={() => {
                        handleLogout()
                        setIsMenuOpen(false)
                      }}
                      className="block w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg"
                      aria-label={text('退出登录', 'Log out')}
                    >
                      {text('退出登录', 'Log out')}
                    </button>
                  </div>
                </div>
              )}

              {/* 移动端登录/注册按钮 */}
              {!isAuthenticated && (
                <div className="border-t border-slate-200 pt-2 mt-2 space-y-2 px-3">
                  <Link
                    to={path('/login')}
                    className="block w-full text-center px-4 py-3 text-base font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {text('登录', 'Log in')}
                  </Link>
                  <Link
                    to={path('/register')}
                    className="block w-full text-center px-4 py-3 text-base font-medium text-white bg-slate-900 rounded-lg hover:bg-[#466f9d] hover:text-white transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {text('注册', 'Sign up')}
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
    </>
  )
}
