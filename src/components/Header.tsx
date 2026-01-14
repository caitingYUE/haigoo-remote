import { Bell, User, Menu, ChevronDown, Trash2, Check, Crown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoPng from '../assets/logo.png'

const BRAND_LOGO = (import.meta as any).env?.VITE_BRAND_LOGO_URL || logoPng
const BETA_END_DATE = new Date('2025-01-24').getTime()

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [showBeta, setShowBeta] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, token, isMember } = useAuth()


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

  // 用户菜单选项 - 恢复个人中心入口
  const userMenuItems: { id: string; label: string; href: string }[] = [
    { id: 'profile-resume', label: '我的简历', href: '/profile?tab=resume' },
    { id: 'profile-favorites', label: '我的收藏', href: '/profile?tab=favorites' },
    { id: 'profile-subscriptions', label: '订阅管理', href: '/profile?tab=subscriptions' },
    { id: 'membership', label: '会员中心', href: '/membership' },
    { id: 'profile-feedback', label: '我要反馈', href: '/profile?tab=feedback' }
  ]

  return (
    <header
      className="absolute top-6 left-0 right-0 z-50 px-4 md:px-6 lg:px-8 transition-all duration-300 pointer-events-none"
      role="banner"
    >
      <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md rounded-3xl shadow-lg border border-white/40 px-6 md:px-8 pointer-events-auto transition-all duration-300">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex-shrink-0 flex items-center focus:outline-none rounded-lg transition-all duration-200 hover:scale-105 no-underline hover:no-underline"
              aria-label="Haigoo 首页"
            >
              <img
                src={BRAND_LOGO}
                alt="Haigoo - 海外远程工作助手"
                className="h-12 w-auto"
                style={{ 
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden'
                }}
              />
              <span className="ml-3 text-[#1A365D] font-semibold text-lg flex items-center gap-2">
                海狗远程俱乐部
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm ring-1 ring-white/20">
                  内测版
                </span>
              </span>
            </Link>
          </div>

          {/* Center Navigation - Right aligned */}
          <div className="hidden md:flex items-center gap-6 ml-auto mr-8">
            <Link
              to="/"
              className={`text-base transition-colors ${location.pathname === '/'
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 font-normal hover:text-slate-900'
                }`}
            >
              首页
            </Link>

            <Link
              to="/jobs"
              className={`text-base transition-colors ${location.pathname === '/jobs'
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 font-normal hover:text-slate-900'
                }`}
            >
              远程岗位
            </Link>

            <Link
              to="/trusted-companies"
              className={`text-base transition-colors ${location.pathname.startsWith('/trusted-companies')
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 font-normal hover:text-slate-900'
                }`}
            >
              精选企业
            </Link>

            <Link
              to="/membership"
              className={`text-base transition-colors ${location.pathname === '/membership'
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 font-normal hover:text-slate-900'
                }`}
            >
              会员中心
            </Link>

            <Link
              to="/profile"
              className={`text-base transition-colors ${location.pathname.startsWith('/profile')
                ? 'text-slate-900 font-bold'
                : 'text-slate-600 font-normal hover:text-slate-900'
                }`}
            >
              个人中心
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4" role="toolbar" aria-label="用户操作">
            {/* 未登录：显示登录/注册按钮 */}
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-[#1A365D] hover:text-indigo-600 transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-indigo-600 transition-all"
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
                    className="p-3 text-slate-400 hover:text-slate-600 relative focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                                <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                    notification.type === 'feedback_reply' ? 'bg-blue-100 text-blue-700' : 
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
                    className="flex items-center space-x-2 text-slate-700 hover:text-slate-900 p-2 rounded-lg hover:bg-slate-50 transition-all duration-200 focus:outline-none"
                    onKeyDown={handleUserMenuKeyDown}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`用户菜单，当前用户：${user?.username || '用户'}`}
                    id="user-menu-button"
                  >
                    {user?.avatar ? (
                      <div className="relative">
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className={`w-8 h-8 rounded-full shadow-sm ${isMember ? 'ring-2 ring-indigo-400 border-2 border-white' : ''}`}
                        />
                        {isMember && (
                          <div className="absolute -top-1.5 -right-1.5 bg-indigo-100 rounded-full p-0.5 border border-white shadow-sm">
                            <Crown className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <div
                          className={`w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center shadow-sm ${isMember ? 'ring-2 ring-indigo-400 border-2 border-white' : ''}`}
                          role="img"
                          aria-label="用户头像"
                        >
                          <User className="h-4 w-4 text-white" aria-hidden="true" />
                        </div>
                        {isMember && (
                          <div className="absolute -top-1.5 -right-1.5 bg-indigo-100 rounded-full p-0.5 border border-white shadow-sm">
                            <Crown className="w-3 h-3 text-indigo-500 fill-indigo-500" />
                          </div>
                        )}
                      </div>
                    )}
                    <span className={`text-sm font-medium hidden sm:block ${isMember ? 'text-indigo-600' : ''}`}>{user?.username || '用户'}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* 优化下拉菜单设计 */}
                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
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
                              alt={user.username}
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
                          <div>
                            <p className="text-sm font-medium text-slate-900 truncate max-w-[150px]">{user?.username || '用户'}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[150px]" title={user?.profile?.title || user?.email}>{user?.profile?.title || user?.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* 简化的菜单选项 - 只保留文字 */}
                      <div className="py-1" role="group" aria-label="用户菜单选项">
                        {userMenuItems.map((item) => {
                          return (
                            <Link
                              key={item.id}
                              to={item.href}
                              className={`block px-4 py-2.5 text-sm transition-all duration-200 focus:outline-none rounded-lg ${location.pathname === item.href || location.search.includes(item.href.split('?')[1])
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700'
                                }`}
                              role="menuitem"
                              tabIndex={isUserMenuOpen ? 0 : -1}
                              onClick={() => setIsUserMenuOpen(false)}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>

                      {/* 退出登录 - 只保留文字 */}
                      <div className="border-t border-slate-100 pt-1" role="group" aria-label="账户操作">
                        <button
                          onClick={handleLogout}
                          className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all duration-200 focus:outline-none focus:bg-red-50"
                          role="menuitem"
                          tabIndex={isUserMenuOpen ? 0 : -1}
                          aria-label="退出登录"
                        >
                          退出登录
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
            className="md:hidden absolute top-full left-0 right-0 mt-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 overflow-hidden"
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
                远程岗位
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
                to="/membership"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname === '/membership'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                会员中心
              </Link>
              <Link
                to="/profile"
                className={`block px-3 py-2 text-base font-medium rounded-lg transition-colors ${location.pathname.startsWith('/profile')
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                onClick={() => setIsMenuOpen(false)}
              >
                个人中心
              </Link>

              {/* 移动端用户菜单 */}
              {isAuthenticated && (
                <div className="border-t border-slate-200 pt-2 mt-2" role="region" aria-label="用户信息和操作">
                  <div className="px-3 py-2">
                    <div className="flex items-center space-x-3 mb-3">
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div
                          className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center"
                          role="img"
                          aria-label="用户头像"
                        >
                          <User className="h-5 w-5 text-white" aria-hidden="true" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user?.username || '用户'}</p>
                        <p className="text-xs text-slate-500">{user?.profile?.title || user?.email}</p>
                      </div>
                    </div>

                    {userMenuItems.map((item) => {
                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="block px-3 py-2 text-base font-medium text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg"
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
                    className="block w-full text-center px-4 py-3 text-base font-medium text-white bg-slate-900 rounded-lg hover:bg-indigo-600 transition-all"
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
