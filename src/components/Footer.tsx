import { Link } from 'react-router-dom';
import { LinkedInLogo, XiaohongshuLogo, OutlookLogo } from './SocialIcons';
import logoPng from '../assets/logo.png';

export default function Footer() {
  return (
    <footer 
      className="bg-white border-t border-slate-200"
      role="contentinfo"
      aria-label="网站页脚"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          
          {/* Left Side: Brand & Copyright */}
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-2">
                <img src={logoPng} alt="Haigoo Logo" className="h-8 w-auto" />
                <span className="text-xl font-bold text-slate-900 tracking-tight">Haigoo</span>
             </div>
             <p className="text-sm text-slate-500">
               © 2026 Haigoo. All rights reserved.
             </p>
          </div>

          {/* Right Side: Social Links */}
          <div className="flex flex-col items-center md:items-end gap-4">
             <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider">Connect with us</h3>
             <div className="flex items-center gap-4">
                {/* XiaoHongShu */}
                <a 
                  href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-all border border-slate-200 hover:border-red-200 hover:no-underline"
                  title="Follow us on XiaoHongShu"
                >
                  <XiaohongshuLogo className="w-5 h-5" />
                  <span className="text-xs font-medium">Follow us</span>
                </a>

                {/* LinkedIn */}
                <a 
                  href="https://www.linkedin.com/company/haigoo/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 rounded-lg transition-all border border-slate-200 hover:border-blue-200 hover:no-underline"
                  title="Follow us on LinkedIn"
                >
                  <LinkedInLogo className="w-5 h-5" />
                  <span className="text-xs font-medium">Follow us</span>
                </a>

                {/* Email */}
                <a 
                  href="mailto:hi@haigooremote.com" 
                  className="group flex items-center gap-2 px-3 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-all border border-slate-200 hover:border-indigo-200 hover:no-underline"
                  title="Contact us via Email"
                >
                  <OutlookLogo className="w-5 h-5" />
                  <span className="text-xs font-medium">Contact us</span>
                </a>
             </div>
          </div>

        </div>
      </div>
    </footer>
  )
}