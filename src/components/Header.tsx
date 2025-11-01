import { Search, Bell, User, Menu, Settings, Briefcase, Star, TrendingUp, LogOut, ChevronDown, FileText } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoSvg from '../assets/logo.svg'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const location = useLocation()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const userMenuButtonRef = useRef<HTMLButtonElement>(null)

  const isActive = (path: string) => location.pathname === path

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

  // 简化用户菜单选项，保留核心功能
  const userMenuItems = [
    { id: 'profile', label: '个人资料', icon: User, href: '/profile?tab=profile' },
    { id: 'resume', label: '简历优化', icon: FileText, href: '/profile?tab=resume' },
    { id: 'applications', label: '申请记录', icon: Briefcase, href: '/profile?tab=applications' },
    { id: 'insights', label: 'AI洞察', icon: TrendingUp, href: '/profile?tab=insights' },
    { id: 'settings', label: '设置', icon: Settings, href: '/profile?tab=settings' }
  ]

  return (
    <header 
      className="bg-white border-b border-gray-200 relative z-50"
      role="banner"
    >
      <div className="px-6 md:px-10 lg:px-20">
        <div className="flex items-center justify-between h-20 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center">
            <Link 
              to="/" 
              className="flex-shrink-0 flex items-center focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg"
              aria-label="Haigoo 首页"
            >
              <img 
                src={logoSvg} 
                alt="Haigoo - 海外远程工作助手" 
                className="h-10 w-auto" 
              />
            </Link>
          </div>

          {/* Desktop Navigation - 改善导航层级和视觉效果 */}
          <nav 
            className="hidden md:flex items-center space-x-1"
            role="navigation"
            aria-label="主导航"
          >
            <Link 
              to="/" 
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                isActive('/') 
                  ? 'text-white bg-haigoo-primary shadow-md' 
                  : 'text-gray-700 hover:text-haigoo-primary hover:bg-haigoo-primary/8'
              }`}
              aria-current={isActive('/') ? 'page' : undefined}
            >
              🎯 智能推荐
            </Link>
            <Link 
              to="/jobs" 
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                isActive('/jobs') 
                  ? 'text-white bg-haigoo-primary shadow-md' 
                  : 'text-gray-700 hover:text-haigoo-primary hover:bg-haigoo-primary/8'
              }`}
              aria-current={isActive('/jobs') ? 'page' : undefined}
            >
              💼 全部职位
            </Link>
            <Link 
              to="/remote-experience" 
              className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                isActive('/remote-experience') 
                  ? 'text-white bg-haigoo-primary shadow-md' 
                  : 'text-gray-700 hover:text-haigoo-primary hover:bg-haigoo-primary/8'
              }`}
              aria-current={isActive('/remote-experience') ? 'page' : undefined}
            >
              🌍 远程指南
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-4" role="toolbar" aria-label="用户操作">
            {/* Notifications */}
            <button 
              className="p-2 text-gray-400 hover:text-gray-600 relative focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg"
              aria-label="通知，有 1 条新消息"
              title="通知"
            >
              <Bell className="h-6 w-6" aria-hidden="true" />
              <span 
                className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"
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
                aria-label="用户菜单，当前用户：张三"
                id="user-menu-button"
              >
                <div 
                  className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center shadow-sm"
                  role="img"
                  aria-label="用户头像"
                >
                  <User className="h-4 w-4 text-white" aria-hidden="true" />
                </div>
                <span className="text-sm font-medium hidden sm:block">张三</span>
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
                      <div 
                        className="w-10 h-10 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center"
                        role="img"
                        aria-label="用户头像"
                      >
                        <User className="h-5 w-5 text-white" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">张三</p>
                        <p className="text-xs text-gray-500">前端工程师</p>
                      </div>
                    </div>
                  </div>

                  {/* 简化的菜单选项 */}
                  <div className="py-1" role="group" aria-label="用户菜单选项">
                    {userMenuItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-haigoo-primary/8 hover:text-haigoo-primary transition-all duration-200 group focus:outline-none focus:bg-haigoo-primary/8 focus:text-haigoo-primary"
                          role="menuitem"
                          tabIndex={isUserMenuOpen ? 0 : -1}
                        >
                          <Icon className="h-4 w-4 mr-3 group-hover:scale-105 transition-transform duration-200" aria-hidden="true" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>

                  {/* 退出登录 */}
                  <div className="border-t border-gray-100 pt-1" role="group" aria-label="账户操作">
                    <button 
                      className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all duration-200 group focus:outline-none focus:bg-red-50"
                      role="menuitem"
                      tabIndex={isUserMenuOpen ? 0 : -1}
                      aria-label="退出登录"
                    >
                      <LogOut className="h-4 w-4 mr-3 group-hover:scale-105 transition-transform duration-200" aria-hidden="true" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              ref={mobileMenuButtonRef}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              onKeyDown={(e) => handleKeyDown(e, () => setIsMenuOpen(!isMenuOpen))}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-haigoo-primary"
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
            className="md:hidden"
            id="mobile-menu"
            role="navigation"
            aria-label="移动端导航"
          >
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              <Link 
                to="/" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                  isActive('/') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
                aria-current={isActive('/') ? 'page' : undefined}
                onClick={() => setIsMenuOpen(false)}
              >
                专属推荐
              </Link>
              <Link 
                to="/jobs" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                  isActive('/jobs') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
                aria-current={isActive('/jobs') ? 'page' : undefined}
                onClick={() => setIsMenuOpen(false)}
              >
                全部岗位
              </Link>
              <Link 
                to="/remote-experience" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 ${
                  isActive('/remote-experience') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
                aria-current={isActive('/remote-experience') ? 'page' : undefined}
                onClick={() => setIsMenuOpen(false)}
              >
                远程经验
              </Link>
              
              {/* 移动端用户菜单 */}
              <div className="border-t border-gray-200 pt-2 mt-2" role="region" aria-label="用户信息和操作">
                <div className="px-3 py-2">
                  <div className="flex items-center space-x-3 mb-3">
                    <div 
                      className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center"
                      role="img"
                      aria-label="用户头像"
                    >
                      <User className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">张三</p>
                      <p className="text-xs text-gray-500">高级前端工程师</p>
                    </div>
                  </div>
                  
                  {userMenuItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.id}
                        to={item.href}
                        className="flex items-center px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-lg"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Icon className="h-5 w-5 mr-3" aria-hidden="true" />
                        {item.label}
                      </Link>
                    )
                  })}
                  
                  <button 
                    className="flex items-center w-full px-3 py-2 text-base font-medium text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-lg"
                    aria-label="退出登录"
                  >
                    <LogOut className="h-5 w-5 mr-3" aria-hidden="true" />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}