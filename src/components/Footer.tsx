import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';

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
          {/* <span className="hidden sm:block w-1 h-1 bg-slate-300 rounded-full" aria-hidden="true" /> */}

          {/* Links */}
          {/* <Link 
            to="/bug-leaderboard" 
            className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors group"
            title="查看贡献榜"
          >
            <Trophy className="w-4 h-4 text-slate-400 group-hover:text-yellow-500 transition-colors" />
            <span>贡献榜</span>
          </Link> */}
        </div>
      </div>
    </footer>
  )
}