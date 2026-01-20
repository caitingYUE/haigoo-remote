import { Link } from 'react-router-dom';
import { LinkedInLogo, XiaohongshuLogo, OutlookLogo } from './SocialIcons';

export default function Footer() {
  return (
    <footer 
      className="bg-white border-t border-slate-200"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-6 text-sm text-slate-500">
          {/* 版权信息 */}
          <div 
            className="text-center"
            role="region"
            aria-label="版权信息"
          >
            <p>
              © 2026 Haigoo. All rights reserved.
            </p>
          </div>

          {/* Separator */}
          <span className="hidden sm:block w-1 h-1 bg-slate-300 rounded-full" aria-hidden="true" />

          {/* Social Links */}
          <div className="flex items-center gap-3">
            <a 
              href="https://www.linkedin.com/company/haigoo/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="LinkedIn"
            >
              <LinkedInLogo className="w-5 h-5" />
            </a>
            
            <a 
              href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="小红书"
            >
              <XiaohongshuLogo className="w-5 h-5" />
            </a>

            <a 
              href="mailto:haigooremote@outlook.com" 
              className="w-8 h-8 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
              title="联系邮箱"
            >
              <OutlookLogo className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}