export default function Footer() {
  // 键盘事件处理函数
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  // 导航链接数据
  const footerLinks = [
    { 
      id: 'about', 
      label: '关于我们', 
      href: '/about',
      ariaLabel: '了解 Haigoo 的使命和团队'
    },
    { 
      id: 'contact', 
      label: '联系我们', 
      href: '/contact',
      ariaLabel: '获取联系方式和客服支持'
    },
    { 
      id: 'privacy', 
      label: '隐私政策', 
      href: '/privacy',
      ariaLabel: '查看隐私保护政策和数据使用说明'
    }
  ]

  return (
    <footer 
      className="bg-white border-t border-gray-200"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* 版权信息 */}
          <div 
            className="text-sm text-gray-500 text-center sm:text-left"
            role="region"
            aria-label="版权信息"
          >
            <p>
              © 2024 <span className="font-medium text-haigoo-primary">Haigoo</span> 海外远程工作助手. 
              <span className="sr-only">版权所有</span>
              保留所有权利.
            </p>
          </div>

          {/* 导航链接 */}
          <nav 
            className="flex flex-wrap justify-center sm:justify-end gap-6"
            role="navigation"
            aria-label="页脚导航"
          >
            {footerLinks.map((link) => (
              <a
                key={link.id}
                href={link.href}
                className="text-sm text-gray-500 hover:text-haigoo-primary transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2 rounded-md px-1 py-1"
                aria-label={link.ariaLabel}
                onKeyDown={(e) => handleKeyDown(e, () => {
                  // 这里可以添加自定义导航逻辑
                  window.location.href = link.href
                })}
              >
                {link.label}
              </a>
            ))}
          </nav>
        </div>

        {/* 可选：添加额外的页脚信息 */}
        <div className="mt-6 pt-6 border-t border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-gray-600">
            <div 
              className="flex items-center gap-4"
              role="region"
              aria-label="网站信息"
            >
              <span>🌍 专注海外远程工作机会</span>
              <span className="hidden sm:inline">•</span>
              <span>🤖 AI 智能匹配推荐</span>
            </div>
            
            <div 
              className="flex items-center gap-2"
              role="region"
              aria-label="技术支持信息"
            >
              <span>由</span>
              <span className="font-medium text-haigoo-primary">Haigoo AI</span>
              <span>驱动</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}