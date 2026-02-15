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
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8">
          
          {/* Brand & Company Info - Spans 8 cols */}
          <div className="md:col-span-8 space-y-8">
             {/* Logo */}
             <div className="flex items-center gap-3">
                <img src={logoPng} alt="Haigoo Logo" className="h-10 w-auto" />
                <span className="text-2xl font-bold text-slate-900 tracking-tight">Haigoo</span>
             </div>

             {/* Company Details */}
             <div className="space-y-4 max-w-md">
                <h4 className="text-base font-bold text-slate-900">行渡科技（杭州）有限公司</h4>
                
                <div className="flex items-start gap-3 text-slate-500">
                   <MapPinIcon className="w-5 h-5 mt-0.5 shrink-0 text-slate-400" />
                   <span className="text-sm leading-6">杭州市余杭区仓前街道景兴路999号10幢403-31室</span>
                </div>
                
                <div className="flex items-center gap-3 text-slate-500">
                   <MailIcon className="w-5 h-5 shrink-0 text-slate-400" />
                   <a href="mailto:hi@haigooremote.com" className="text-sm hover:text-indigo-600 transition-colors">
                      hi@haigooremote.com
                   </a>
                </div>
             </div>
             
             {/* Copyright (Desktop) */}
             <div className="hidden md:block pt-8">
                <p className="text-xs text-slate-400">
                  © 2026 Haigoo. All rights reserved.
                  {import.meta.env.DEV ? ' (Local)' : window.location.hostname.includes('develop') ? <span className="text-amber-600 font-bold ml-1">(PREVIEW ENV - v2026.02.14)</span> : ''}
                </p>
             </div>
          </div>

          {/* Social Links - Spans 4 cols */}
          <div className="md:col-span-4 space-y-6">
             <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Connect with us</h3>
             <div className="flex flex-col gap-3">
                {/* XiaoHongShu */}
                <a 
                  href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between px-4 py-3 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-xl transition-all border border-slate-200 hover:border-red-200 shadow-sm hover:shadow-md no-underline"
                >
                  <div className="flex items-center gap-3">
                    <XiaohongshuLogo className="w-5 h-5" />
                    <span className="text-sm font-medium">Little Red Book</span>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-red-400 font-medium">Follow</span>
                </a>

                {/* LinkedIn */}
                <a 
                  href="https://www.linkedin.com/company/haigoo/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between px-4 py-3 bg-white hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-xl transition-all border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-md no-underline"
                >
                  <div className="flex items-center gap-3">
                    <LinkedInLogo className="w-5 h-5" />
                    <span className="text-sm font-medium">LinkedIn</span>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-blue-400 font-medium">Follow</span>
                </a>

                {/* Email Action */}
                <a 
                  href="mailto:hi@haigooremote.com" 
                  className="group flex items-center justify-between px-4 py-3 bg-white hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition-all border border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-md no-underline"
                >
                  <div className="flex items-center gap-3">
                    <OutlookLogo className="w-5 h-5" />
                    <span className="text-sm font-medium">Email Us</span>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-indigo-400 font-medium">Contact</span>
                </a>
             </div>
          </div>

          {/* Copyright (Mobile) */}
          <div className="md:hidden col-span-1 pt-8 border-t border-slate-200">
              <p className="text-xs text-slate-400 text-center">
                © 2026 Haigoo. All rights reserved.
              </p>
          </div>

        </div>
      </div>
    </footer>
  )
}
