import { Bell, User, Menu, ChevronDown, Trash2, Check, Crown, Sparkles, Search, X } from 'lucide-react'
import type { FormEvent } from 'react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import brandLogoPng from '../assets/brandlogo.webp'

interface HeaderProps {
  showUpgradeNotice?: boolean
}

function formatHeaderDisplayName(name: string, memberType?: string | null) {
  const normalized = name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Starter|Member|Partner)\)\s*/gi, '').trim()
  if ((memberType === 'quarter' || memberType === 'quarter_pro') && normalized) {
    return `${normalized}（VIP）`
  }
  if (memberType === 'starter' && normalized) {
    return `${normalized}（Starter）`
  }
  if (memberType === 'half_year' && normalized) {
    return `${normalized}（Member）`
  }
  if ((memberType === 'annual' || memberType === 'year') && normalized) {
    return `${normalized}（Partner）`
  }
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
  const { user, isAuthenticated, logout, token, isMember, isTrialMember, memberType } = useAuth()


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
  const memberAvatarRingClass = isMember ? 'ring-2 ring-[#8f8afe] border-2 border-white' : ''
  const memberBadgeBgClass = 'bg-[#f0edff]'
  const memberBadgeIconClass = 'text-[#6f63f6] fill-[#6f63f6]'
  const memberNameClass = isMember ? 'text-[#6f63f6]' : 'text-slate-700'
  const memberTextBadge = 'Trial'
  const memberTextBadgeClass = 'border-[#d8d2ff] bg-[#f0edff] text-[#5d50df]'

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
    navigate('/login')
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
    { id: 'profile-resume', label: '首页', href: '/profile?tab=resume' },
    { id: 'membership', label: '会员权益', href: '/profile?tab=membership' },
    { id: 'profile-about', label: '关于我们', href: '/profile?tab=about' },
    { id: 'profile-favorites', label: '我的收藏', href: '/profile?tab=favorites' },
    { id: 'profile-applications', label: '我的申请', href: '/profile?tab=applications' },
    { id: 'profile-feedback', label: '我要反馈', href: '/profile?tab=feedback' }
  ]

  const isHome = location.pathname === '/'
  const isJobsPage = location.pathname === '/jobs' || location.pathname.startsWith('/jobs/')
  useEffect(() => {
    if (!isJobsPage) return
    const params = new URLSearchParams(location.search)
    setHeaderSearchTerm(params.get('search') || '')
  }, [isJobsPage, location.search])

  const submitHeaderSearch = (event: FormEvent) => {
    event.preventDefault()
    const keyword = headerSearchTerm.trim()
    if (!isJobsPage) {
      navigate(keyword ? `/jobs?search=${encodeURIComponent(keyword)}` : '/jobs')
      return
    }

    const params = new URLSearchParams(location.search)
    if (keyword) params.set('search', keyword)
    else params.delete('search')
    navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`)
  }

  const clearHeaderSearch = () => {
    setHeaderSearchTerm('')
    if (!isJobsPage) return
    const params = new URLSearchParams(location.search)
    params.delete('search')
    navigate(`/jobs${params.toString() ? `?${params.toString()}` : ''}`)
  }

  return (
    <header
      className={`fixed left-0 right-0 z-50 transition-all duration-300 pointer-events-none ${showUpgradeNotice ? 'top-10' : 'top-0'}`}
      role="banner"
    >
      <div className="w-full pointer-events-auto border-b border-[#e5edf3] bg-[#fffdf8] shadow-[0_14px_42px_-38px_rgba(139,101,54,0.34)] transition-all duration-300">
        <div className="mx-auto flex h-14 w-full max-w-[1620px] items-center px-4 sm:px-6 md:h-16">
          {/* Logo */}
          <div className="flex items-center group shrink-0">
            {/* Logo Image with Optical Adjustment */}
            <Link
              to="/"
              className="flex items-center focus:outline-none rounded-lg transition-all duration-200 no-underline hover:no-underline gap-2"
              aria-label="Haigoo 首页"
            >
              <span className="flex h-9 w-[118px] items-center overflow-hidden">
                <img src={brandLogoPng} alt="HaigooRemote" className="h-[52px] w-auto max-w-none -translate-x-2 -translate-y-[1px]" />
              </span>
              <span className="hidden md:block text-[14px] font-bold tracking-tight text-slate-900">海狗远程</span>
            </Link>
          </div>

          <form onSubmit={submitHeaderSearch} className="ml-3 hidden xl:block">
            <div className={`relative ${isJobsPage ? 'w-[360px] 2xl:w-[520px]' : 'w-[300px] 2xl:w-[360px]'}`}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={headerSearchTerm}
                onChange={(event) => setHeaderSearchTerm(event.target.value)}
                placeholder="搜索岗位、公司、技能..."
                className="h-10 w-full rounded-full border border-[#dfeaf1] bg-white pl-9 pr-10 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#b9d9f5] focus:bg-white focus:ring-2 focus:ring-[#9ecbf2]/20"
              />
              {headerSearchTerm ? (
                <button
                  type="button"
                  onClick={clearHeaderSearch}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="清除搜索"
                  title="清除搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </form>

          {/* Main Navigation */}
          <div className="ml-auto mr-6 hidden items-center gap-5 lg:flex xl:gap-7 xl:mr-8">
            <Link
              to="/"
              className={`whitespace-nowrap text-sm transition-colors no-underline hover:no-underline ${location.pathname === '/'
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-500 font-medium hover:text-indigo-600'
                }`}
            >
              首页
            </Link>

            <Link
              to="/jobs"
              className={`whitespace-nowrap text-sm transition-colors no-underline hover:no-underline ${location.pathname === '/jobs'
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-500 font-medium hover:text-indigo-600'
                }`}
            >
              远程工作
            </Link>

            <Link
              to="/corporate-english"
              className={`relative inline-flex items-center gap-1 whitespace-nowrap text-sm transition-colors no-underline hover:no-underline ${location.pathname.startsWith('/corporate-english')
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-500 font-medium hover:text-indigo-600'
                }`}
            >
              职业成长
              <span className="absolute left-full top-0 ml-px -translate-y-1.5 text-[10px] font-black leading-none text-emerald-500">
                新
              </span>
            </Link>

            <Link
              to="/trusted-companies"
              className={`whitespace-nowrap text-sm transition-colors no-underline hover:no-underline ${location.pathname.startsWith('/trusted-companies')
                  ? 'text-slate-900 font-bold'
                  : 'text-slate-500 font-medium hover:text-indigo-600'
                }`}
            >
              精选企业
            </Link>

            <Link
              to="/profile?tab=membership"
              className={`flex items-center gap-1 whitespace-nowrap text-sm transition-colors no-underline hover:no-underline ${location.pathname.startsWith('/profile')
                  ? 'text-indigo-600 font-bold'
                  : 'text-slate-500 font-medium hover:text-indigo-600'
                }`}
            >
              <Crown className="w-4 h-4" />
              Club 权益
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-3" role="toolbar" aria-label="用户操作">
            {/* 未登录：显示登录/注册按钮 */}
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium transition-colors no-underline hover:no-underline text-slate-600 hover:text-slate-900"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-6 py-2.5 text-sm font-medium text-white rounded-full transition-all shadow-md hover:shadow-lg no-underline hover:no-underline bg-indigo-600 hover:bg-indigo-700 hover:text-white"
                >
                  注册
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
                    className={`p-3 relative rounded-[18px] border min-w-[44px] min-h-[44px] flex items-center justify-center transition focus:outline-none focus:ring-2 focus:ring-[#d8d2ff] focus:ring-offset-2 ${
                      isNotificationOpen
                        ? 'border-[#d8d2ff] bg-[#f5f2ff] text-[#6251f5] shadow-[0_14px_30px_-22px_rgba(98,81,245,0.55)]'
                        : 'border-transparent text-slate-400 hover:border-[#e6e0ff] hover:bg-[#faf8ff] hover:text-[#6251f5]'
                    }`}
                    aria-label={`通知，有 ${unreadCount} 条新消息`}
                    title="通知"
                  >
                    <Bell className="h-6 w-6" aria-hidden="true" />
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
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                      <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="text-sm font-semibold text-slate-900">消息通知</h3>
                        <div className="flex gap-2">
                          <button onClick={() => handleMarkRead()} className="text-xs text-indigo-600 hover:text-indigo-800" title="全部已读">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete()} className="text-xs text-slate-400 hover:text-red-600" title="清空全部">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-slate-500 text-sm">
                            暂无消息
                          </div>
                        ) : (
                          notifications.map(notification => (
                            <div key={notification.id} className={`px-4 py-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 relative group ${!notification.isRead ? 'bg-indigo-50/30' : ''}`}>
                              <div className="flex justify-between items-start mb-1">
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${notification.type === 'feedback_reply' ? 'bg-blue-100 text-blue-700' :
                                    notification.type === 'application_update' ? 'bg-green-100 text-green-700' :
                                      'bg-slate-100 text-slate-600'
                                  }`}>
                                  {notification.type === 'feedback_reply' ? '反馈回复' : notification.type === 'application_update' ? '申请更新' : '系统消息'}
                                </span>
                                <span className="text-xs text-slate-400">{new Date(notification.createdAt).toLocaleDateString()}</span>
                              </div>
                              <h4 className={`text-sm font-medium mb-1 ${!notification.isRead ? 'text-slate-900' : 'text-slate-700'}`}>{notification.title}</h4>
                              <p className="text-xs text-slate-600 leading-relaxed">{notification.content}</p>

                              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1 bg-white/80 rounded shadow-sm p-1">
                                {!notification.isRead && (
                                  <button onClick={(e) => { e.stopPropagation(); handleMarkRead(notification.id) }} className="p-1 hover:text-indigo-600 text-slate-400" title="标为已读">
                                    <Check className="w-3 h-3" />
                                  </button>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); handleDelete(notification.id) }} className="p-1 hover:text-red-600 text-slate-400" title="删除">
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
                  className="relative"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    ref={userMenuButtonRef}
                    className="flex max-w-[230px] items-center gap-2 rounded-lg p-2 text-slate-700 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
                    onKeyDown={handleUserMenuKeyDown}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`用户菜单，当前用户：${userDisplayName}`}
                    id="user-menu-button"
                  >
                    {user?.avatar ? (
                      <div className="relative">
                        <img
                          src={user.avatar}
                          alt={userDisplayName}
                          className={`w-8 h-8 rounded-full shadow-sm ${memberAvatarRingClass}`}
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
                          className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm bg-gradient-to-r from-haigoo-primary to-haigoo-secondary ${memberAvatarRingClass}`}
                          role="img"
                          aria-label="用户头像"
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
                    <span className={`hidden max-w-[118px] truncate text-sm font-medium sm:block xl:max-w-[142px] ${memberNameClass}`} title={userDisplayName}>
                      {userDisplayName}
                    </span>
                    {shouldShowMemberTextBadge && (
                      <span className={`hidden sm:inline-flex h-5 items-center rounded-full border px-1.5 text-[10px] font-black leading-none ${memberTextBadgeClass}`}>
                        {memberTextBadge}
                      </span>
                    )}
                    {!isMember && (
                      <span className="hidden sm:inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-bold leading-none text-slate-600">
                        FREE
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
                      className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
                      role="menu"
                      aria-labelledby="user-menu-button"
                      aria-orientation="vertical"
                    >
                      {/* 用户信息 */}
                      <div className="px-4 py-3 border-b border-slate-100" role="presentation">
                        <div className="flex items-center space-x-3">
                          {user?.avatar ? (
                            <img
                              src={user.avatar}
                              alt={userDisplayName}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center"
                              role="img"
                              aria-label="用户头像"
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
                              {!isMember && (
                                <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-bold leading-none text-slate-600">
                                  FREE
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate" title={user?.profile?.title || user?.email}>{user?.profile?.title || user?.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* 简化的菜单选项 - 这里可以放其他普通菜单项，暂时为空或保留其他非敏感项 */}

                      {/* 账户操作区域 */}
                      <div className="pt-1" role="group" aria-label="账户操作">
                        {/* 退出登录 - 调整为常规颜色 */}
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-all duration-200 focus:outline-none focus:bg-slate-50"
                          role="menuitem"
                          tabIndex={isUserMenuOpen ? 0 : -1}
                          aria-label="退出登录"
                        >
                          <div className="flex items-center">
                            <span className="flex-1">退出登录</span>
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
              className="md:hidden p-3 rounded-md text-slate-400 hover:text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-haigoo-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? '关闭移动菜单' : '打开移动菜单'}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav
            className="md:hidden absolute left-3 right-3 top-full mt-3 overflow-hidden rounded-2xl border border-[#e5edf3] bg-[#fffdf8] shadow-[0_20px_48px_-36px_rgba(139,101,54,0.46)]"
            id="mobile-menu"
            role="navigation"
            aria-label="移动端导航"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link
                to="/"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname === '/'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                首页
              </Link>
              <Link
                to="/jobs"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname === '/jobs'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                全部岗位
              </Link>
              <Link
                to="/corporate-english"
                className={`flex items-center gap-2 px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/corporate-english')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <span className="relative inline-flex items-center">
                  职业成长
                  <span className="ml-0.5 -translate-y-1 text-[10px] font-black leading-none text-emerald-500">
                    新
                  </span>
                </span>
              </Link>
              <Link
                to="/trusted-companies"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/trusted-companies')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                精选企业
              </Link>
              <Link
                to="/profile?tab=about"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${(location.pathname === '/about') || (location.pathname === '/profile' && new URLSearchParams(location.search).get('tab') === 'about')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                关于我们
              </Link>
              <Link
                to="/profile?tab=membership"
                className={`flex items-center gap-2 px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/profile')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                <Crown className="h-4 w-4" />
                Club 权益
              </Link>

              {/* 移动端用户菜单 */}
              {isAuthenticated && (
                <div className="border-t border-slate-200 pt-2 mt-2" role="region" aria-label="用户信息和操作">
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
                          aria-label="用户头像"
                        >
                          <User className="h-5 w-5 text-white" aria-hidden="true" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-900">{userDisplayName}</p>
                          {!isMember && (
                            <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-1.5 text-[10px] font-bold leading-none text-slate-600">
                              FREE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{user?.profile?.title || user?.email}</p>
                      </div>
                    </div>

                    {userMenuItems.map((item) => {
                      const isActive = location.pathname === item.href || (item.href.includes('?') && location.search.includes(item.href.split('?')[1]))
                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${isActive
                              ? 'bg-indigo-50 text-indigo-700'
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
                      aria-label="退出登录"
                    >
                      退出登录
                    </button>
                  </div>
                </div>
              )}

              {/* 移动端登录/注册按钮 */}
              {!isAuthenticated && (
                <div className="border-t border-slate-200 pt-2 mt-2 space-y-2 px-3">
                  <Link
                    to="/login"
                    className="block w-full text-center px-4 py-3 text-base font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full text-center px-4 py-3 text-base font-medium text-white bg-slate-900 rounded-lg hover:bg-indigo-600 hover:text-white transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
