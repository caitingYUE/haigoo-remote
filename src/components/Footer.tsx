export default function Footer() {
  return (
    <footer 
      className="bg-white border-t border-slate-200"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
          {/* 版权信息 */}
          <div 
            className="text-sm text-slate-500 text-center"
            role="region"
            aria-label="版权信息"
          >
            <p>
              © 2025 Haigoo 远程工作助手.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}