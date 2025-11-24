import { Bell, User, Menu, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import logoSvg from '../assets/logo.svg'
const BRAND_LOGO = (import.meta as any).env?.VITE_BRAND_LOGO_URL || logoSvg

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuth()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const userMenuButtonRef = useRef<HTMLButtonElement>(null)

  const isActive = (path: string) => location.pathname === path

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
    { id: 'profile-favorites', label: '我的收藏', href: '/profile?tab=favorites' }
  ]

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-md bg-white/70 border-b border-white/20 transition-all duration-300"
      role="banner"
    >
      <div className="px-6 md:px-10 lg:px-20">
        <div className="flex items-center justify-between h-20 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center">
            <Link
              to="/"
              className="flex-shrink-0 flex items-center focus:outline-none focus:ring-2 focus:ring-[#3182CE] focus:ring-offset-2 rounded-lg transition-all duration-200 hover:scale-110 no-underline hover:no-underline"
              aria-label="Haigoo 首页"
            >
              <img
                src={BRAND_LOGO}
                alt="Haigoo - 海外远程工作助手"
                className="h-12 w-auto"
              />
              <span className="ml-3 text-[#1A365D] font-semibold text-lg">Haigoo Remote Club</span>
            </Link>
          </div>

          {/* Center Navigation - 核心功能导航 */}
          <div className="hidden md:flex items-center justify-center absolute left-1/2 transform -translate-x-1/2 space-x-8">
            <div className="flex flex-col items-center group relative">
              <Link
                to={`/jobs${location.search}`}
                className={`text-base font-medium transition-colors ${location.pathname === '/jobs' || location.pathname === '/'
                  ? 'text-[#3182CE]'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                远程岗位搜索
              </Link>
              {/* Integrated Region Selector Pill */}
              <div className="absolute -bottom-5 left-1/2 transform -translate-x-1/2 flex items-center bg-gray-100 rounded-full p-0.5 border border-gray-200 shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/jobs?region=domestic')
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${!location.search.includes('region=overseas')
                    ? 'bg-white text-[#3182CE] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  国内
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    navigate('/jobs?region=overseas')
                  }}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${location.search.includes('region=overseas')
                    ? 'bg-white text-[#3182CE] shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  海外
                </button>
              </div>

              {/* Active Indicator (Small Dot) if on jobs page */}
              {(location.pathname === '/jobs' || location.pathname === '/') && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-[#3182CE] rounded-full group-hover:opacity-0 transition-opacity duration-200"></div>
              )}
            </div>

            <Link
              to="/trusted-companies"
              className={`text-base font-medium transition-colors ${location.pathname.startsWith('/trusted-companies')
                ? 'text-[#3182CE]'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              可信企业列表
            </Link>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-4" role="toolbar" aria-label="用户操作">
            {/* 未登录：显示登录/注册按钮 */}
            {!isAuthenticated && (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 text-sm font-medium text-[#1A365D] hover:text-[#3182CE] transition-colors"
                >
                  登录
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#3182CE] rounded-lg hover:bg-[#256bb0] transition-all"
                >
                  注册
                </Link>
              </>
            )}

            {/* 已登录：显示通知和用户菜单 */}
            {isAuthenticated && (
              <>
                {/* Notifications */}
                <button
                  className="p-3 text-gray-400 hover:text-gray-600 relative focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="通知，有 1 条新消息"
                  title="通知"
                >
                  <Bell className="h-6 w-6" aria-hidden="true" />
                  <span
                    className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-400"
                    aria-hidden="true"
                  ></span>
                  <span className="sr-only">有新通知</span>
                </button>

                {/* User Menu - 优化用户菜单设计 */}
                <div
                  ref={userMenuRef}
                  className="relative"
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                >
                  <button
                    ref={userMenuButtonRef}
                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2"
                    onKeyDown={handleUserMenuKeyDown}
                    aria-expanded={isUserMenuOpen}
                    aria-haspopup="menu"
                    aria-label={`用户菜单，当前用户：${user?.username || '用户'}`}
                    id="user-menu-button"
                  >
                    {user?.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-8 h-8 rounded-full shadow-sm"
                      />
                    ) : (
                      <div
                        className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center shadow-sm"
                        role="img"
                        aria-label="用户头像"
                      >
                        <User className="h-4 w-4 text-white" aria-hidden="true" />
                      </div>
                    )}
                    <span className="text-sm font-medium hidden sm:block">{user?.username || '用户'}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  {/* 优化下拉菜单设计 */}
                  {isUserMenuOpen && (
                    <div
                      className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200"
                      role="menu"
                      aria-labelledby="user-menu-button"
                      aria-orientation="vertical"
                    >
                      {/* 用户信息 */}
                      <div className="px-4 py-3 border-b border-gray-100" role="presentation">
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
                            <p className="text-sm font-medium text-gray-900">{user?.username || '用户'}</p>
                            <p className="text-xs text-gray-500">{user?.profile?.title || user?.email}</p>
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
                                ? 'bg-[#FF6B35]/10 text-[#FF6B35] font-medium'
                                : 'text-gray-700 hover:bg-[#FF6B35]/5 hover:text-[#FF6B35]'
                                }`}
                              role="menuitem"
                              tabIndex={isUserMenuOpen ? 0 : -1}
                            >
                              {item.label}
                            </Link>
                          )
                        })}
                      </div>

                      {/* 退出登录 - 只保留文字 */}
                      <div className="border-t border-gray-100 pt-1" role="group" aria-label="账户操作">
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
              className="md:hidden p-3 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-haigoo-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
              aria-label={isMenuOpen ? '关闭移动菜单' : '打开移动菜单'}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation - 按要求移除顶部三个 Tab */}
        {isMenuOpen && (
          <nav
            className="md:hidden"
            id="mobile-menu"
            role="navigation"
            aria-label="移动端导航"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              {/* 顶部三个 Tab 已移除 */}

              {/* 移动端用户菜单 */}
              {isAuthenticated && (
                <div className="border-t border-gray-200 pt-2 mt-2" role="region" aria-label="用户信息和操作">
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
                        <p className="text-sm font-medium text-gray-900">{user?.username || '用户'}</p>
                        <p className="text-xs text-gray-500">{user?.profile?.title || user?.email}</p>
                      </div>
                    </div>

                    {userMenuItems.map((item) => {
                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="block px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg"
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
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-2 px-3">
                  <Link
                    to="/login"
                    className="block w-full text-center px-4 py-3 text-base font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="block w-full text-center px-4 py-3 text-base font-medium text-white bg-[#3182CE] rounded-lg hover:bg-[#256bb0] transition-all"
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