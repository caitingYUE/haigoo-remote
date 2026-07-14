import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface MobileRestrictedProps {
  children: React.ReactNode;
  allowContinue?: boolean; // Whether to allow users to close the overlay and continue
}

export const MobileRestricted: React.FC<MobileRestrictedProps> = ({ children, allowContinue = false }) => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });
  const [bypassed, setBypassed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem('haigoo_mobile_continue') === 'true';
  });

  useEffect(() => {
    const checkMobile = () => {
      // Check if width is less than 768px (standard tablet/mobile breakpoint)
      const isMobileWidth = window.innerWidth < 768;
      setIsMobile(isMobileWidth);
    };

    // Initial check
    checkMobile();

    // Listen for resize
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (isMobile && !bypassed) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[linear-gradient(180deg,#fffdf8_0%,#f4f8fb_100%)] p-6 text-center">
        <div className="w-full max-w-md rounded-[28px] border border-[#dfe8ef] bg-white/88 p-7 shadow-[0_28px_80px_-58px_rgba(61,89,120,0.64)] backdrop-blur">
          <div className="mx-auto mb-5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#eef5ff]">
            <Monitor className="h-9 w-9 text-[#5f63f6]" />
          </div>
          
          <h2 className="mb-3 text-2xl font-black text-slate-900">
            电脑端体验更完整
          </h2>
          
          <p className="mb-6 text-sm leading-7 text-slate-600">
            岗位筛选和详情对比在大屏上更稳定。如果手机端加载较慢或显示拥挤，建议切换至电脑端浏览器打开。
          </p>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 py-3 text-sm font-semibold text-slate-500">
              <Smartphone className="h-4 w-4" />
              <span>手机端将保留搜索和基础浏览</span>
            </div>
            
            {allowContinue && (
              <button 
                onClick={() => {
                  window.sessionStorage.setItem('haigoo_mobile_continue', 'true');
                  setBypassed(true);
                }}
                className="rounded-2xl bg-[#5f63f6] px-5 py-3 text-sm font-black text-white shadow-[0_18px_42px_-28px_rgba(95,99,246,0.62)] transition hover:-translate-y-0.5"
              >
                继续访问手机版
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-8 text-xs font-medium uppercase tracking-widest text-slate-400">
          Haigoo Remote Club
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
