import { Link } from 'react-router-dom';
import { Linkedin, Mail, BookOpen } from 'lucide-react';

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
              © 2025 Haigoo 远程工作助手.
            </p>
          </div>

          {/* Separator */}
          <span className="hidden sm:block w-1 h-1 bg-slate-300 rounded-full" aria-hidden="true" />

          {/* Social Links */}
          <div className="flex items-center gap-5">
            <a 
              href="https://www.linkedin.com/company/haigoo/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-[#0077b5] transition-colors p-1"
              title="LinkedIn"
            >
              <Linkedin className="w-4 h-4" />
            </a>
            
            <a 
              href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-[#ff2442] transition-colors flex items-center gap-1.5 p-1"
              title="小红书"
            >
              <BookOpen className="w-4 h-4" />
              <span className="font-medium text-xs">小红书</span>
            </a>

            <a 
              href="mailto:haigooremote@outlook.com" 
              className="text-slate-400 hover:text-indigo-600 transition-colors p-1"
              title="联系邮箱"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}