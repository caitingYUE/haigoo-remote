import { LinkedInLogo, XiaohongshuLogo, OutlookLogo } from './SocialIcons';
import logoPng from '../assets/logo.png';

const MapPinIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const MailIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export default function Footer() {
  return (
    <footer 
      className="bg-slate-50 border-t border-slate-200"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Main Content: Left (Brand/Intro) & Right (Address/Contact) */}
        <div className="flex flex-col md:flex-row justify-between gap-12 lg:gap-24 mb-16">
          
          {/* Left Column: Brand, Intro, CTA */}
          <div className="md:w-5/12 space-y-6">
             {/* Logo */}
             <div className="flex items-center gap-3">
                <img src={logoPng} alt="Haigoo Logo" className="h-10 w-auto" />
                <span className="text-2xl font-bold text-slate-900 tracking-tight">Haigoo</span>
             </div>
             
             {/* Intro Text */}
             <p className="text-slate-500 leading-relaxed text-sm">
                连接全球机遇，释放人才潜能。Haigoo 帮助中国专业人才探索远程工作机会，实现工作与生活的完美平衡。
             </p>

             {/* CTA Button */}
             <div className="pt-2">
                <a 
                   href="mailto:hi@haigooremote.com" 
                   className="inline-flex items-center justify-center px-6 py-2.5 border border-slate-300 shadow-sm text-sm font-medium rounded-full text-slate-700 bg-white hover:bg-slate-50 hover:text-indigo-600 hover:border-indigo-200 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                   联系我们
                </a>
             </div>
          </div>

          {/* Right Column: Address & Contact Info Grid */}
          <div className="md:w-7/12 grid grid-cols-1 sm:grid-cols-2 gap-8 lg:gap-12">
             
             {/* Address Column */}
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <MapPinIcon className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">公司地址</h4>
                        <div className="text-sm text-slate-500 space-y-1">
                            <p className="font-medium text-slate-700">行渡科技（杭州）有限公司</p>
                            <p className="leading-relaxed">杭州市余杭区仓前街道景兴路999号10幢403-31室</p>
                        </div>
                    </div>
                </div>
             </div>

             {/* Contact Info Column */}
             <div className="space-y-4">
                <div className="flex items-start gap-3">
                    <MailIcon className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold text-slate-900">联系方式</h4>
                        <div className="text-sm text-slate-500">
                            <a href="mailto:hi@haigooremote.com" className="hover:text-indigo-600 transition-colors block">
                                hi@haigooremote.com
                            </a>
                        </div>
                    </div>
                </div>
             </div>

          </div>
        </div>

        {/* Bottom Section: Social Icons & Copyright */}
        <div className="pt-8 border-t border-slate-200 flex flex-col items-center gap-6">
           
           {/* Social Icons Row */}
           <div className="flex items-center gap-8">
              <a 
                href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Little Red Book"
              >
                <XiaohongshuLogo className="w-6 h-6" />
              </a>

              <a 
                href="https://www.linkedin.com/company/haigoo/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title="LinkedIn"
              >
                <LinkedInLogo className="w-6 h-6" />
              </a>

              <a 
                href="mailto:hi@haigooremote.com" 
                className="text-slate-400 hover:text-indigo-600 transition-colors"
                title="Email"
              >
                <OutlookLogo className="w-6 h-6" />
              </a>
           </div>

           {/* Copyright */}
           <p className="text-xs text-slate-400 text-center">
              © 2026 Haigoo. All rights reserved.
              {import.meta.env.DEV ? ' (Local)' : window.location.hostname.includes('develop') ? <span className="text-amber-600 font-bold ml-1">(PREVIEW ENV - v2026.02.14)</span> : ''}
           </p>
        </div>

      </div>
    </footer>
  )
}
