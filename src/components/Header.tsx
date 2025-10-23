import { Search, Bell, User, Menu, Settings, Briefcase, Star, TrendingUp, LogOut, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logoSvg from '../assets/logo.svg'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const location = useLocation()
  const userMenuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number | null>(null)

  const isActive = (path: string) => location.pathname === path

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

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

  // 用户菜单选项
  const userMenuItems = [
    { id: 'profile', label: '个人资料', icon: User, href: '/profile?tab=profile' },
    { id: 'resume', label: '简历信息', icon: Briefcase, href: '/profile?tab=resume' },
    { id: 'subscriptions', label: '职位订阅', icon: Bell, href: '/profile?tab=subscriptions' },
    { id: 'recommendations', label: '推荐墙', icon: Star, href: '/profile?tab=recommendations' },
    { id: 'insights', label: 'AI职业洞察', icon: TrendingUp, href: '/profile?tab=insights' },
    { id: 'applications', label: '我的申请', icon: Briefcase, href: '/applications' },
    { id: 'settings', label: '设置', icon: Settings, href: '/profile?tab=settings' }
  ]

  return (
    <header className="bg-white border-b border-gray-200 relative z-50">
      <div className="px-6 md:px-10 lg:px-20">
        <div className="flex items-center justify-between h-20 max-w-7xl mx-auto">
          {/* Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <img src={logoSvg} alt="Haigoo" className="h-10 w-auto" />
              <span className="ml-3 text-base text-gray-600 font-medium">远程助手</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            <Link 
              to="/" 
              className={`px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/') 
                  ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                  : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
              }`}
            >
              专属推荐
            </Link>
            <Link 
              to="/jobs" 
              className={`px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/jobs') 
                  ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                  : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
              }`}
            >
              全部岗位
            </Link>
            <Link 
              to="/remote-experience" 
              className={`px-6 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                isActive('/remote-experience') 
                  ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                  : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
              }`}
            >
              远程经验
            </Link>
          </nav>

          {/* Search Bar - Remove from header since it's in the main page */}
          
          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Notifications */}
            <button className="p-2 text-gray-400 hover:text-gray-600 relative">
              <Bell className="h-6 w-6" />
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400"></span>
            </button>

            {/* User Menu */}
            <div 
              ref={userMenuRef}
              className="relative"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200">
                <div className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-white" />
                </div>
                <span className="text-sm font-medium">张三</span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* 下拉菜单 */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in-0 zoom-in-95 duration-200">
                  {/* 用户信息 */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">张三</p>
                        <p className="text-xs text-gray-500">高级前端工程师</p>
                      </div>
                    </div>
                  </div>

                  {/* 菜单选项 */}
                  <div className="py-1">
                    {userMenuItems.map((item) => {
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.id}
                          to={item.href}
                          className="flex items-center px-4 py-2.5 text-sm text-gray-700 hover:bg-haigoo-primary/5 hover:text-haigoo-primary transition-all duration-200 group"
                        >
                          <Icon className="h-4 w-4 mr-3 group-hover:scale-110 transition-transform duration-200" />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>

                  {/* 退出登录 */}
                  <div className="border-t border-gray-100 pt-1">
                    <button className="flex items-center w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all duration-200 group">
                      <LogOut className="h-4 w-4 mr-3 group-hover:scale-110 transition-transform duration-200" />
                      退出登录
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
              <Link 
                to="/" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                  isActive('/') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
              >
                专属推荐
              </Link>
              <Link 
                to="/jobs" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                  isActive('/jobs') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
              >
                全部岗位
              </Link>
              <Link 
                to="/remote-experience" 
                className={`block px-4 py-3 text-base font-semibold rounded-lg transition-all duration-200 ${
                  isActive('/remote-experience') 
                    ? 'text-white bg-haigoo-primary shadow-lg shadow-haigoo-primary/25' 
                    : 'text-gray-600 hover:text-haigoo-primary hover:bg-haigoo-primary/5'
                }`}
              >
                远程经验
              </Link>
              
              {/* 移动端用户菜单 */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="px-3 py-2">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-haigoo-primary to-haigoo-secondary rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
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
                        className="flex items-center px-3 py-2 text-base font-medium text-gray-500 hover:text-gray-900"
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        {item.label}
                      </Link>
                    )
                  })}
                  
                  <button className="flex items-center w-full px-3 py-2 text-base font-medium text-red-600 hover:text-red-700">
                    <LogOut className="h-5 w-5 mr-3" />
                    退出登录
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}