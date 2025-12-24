import React, { useEffect, useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';

interface MobileRestrictedProps {
  children: React.ReactNode;
  allowContinue?: boolean; // Whether to allow users to close the overlay and continue
}

export const MobileRestricted: React.FC<MobileRestrictedProps> = ({ children, allowContinue = false }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [bypassed, setBypassed] = useState(false);

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
      <div className="fixed inset-0 z-[9999] bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-slate-100">
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-10 h-10 text-[#dc2626]" />
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-4 font-serif">
            请使用电脑访问
          </h2>
          
          <p className="text-slate-600 mb-8 leading-relaxed">
            为了获得最佳的视觉体验和功能交互，当前页面需要更大的屏幕空间。<br/>
            建议您切换至电脑端浏览器打开。
          </p>
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-center gap-2 text-sm text-slate-400 bg-slate-50 py-3 rounded-xl border border-slate-100">
              <Smartphone className="w-4 h-4" />
              <span className="line-through decoration-slate-400">手机端体验受限</span>
            </div>
            
            {allowContinue && (
              <button 
                onClick={() => setBypassed(true)}
                className="mt-4 text-sm text-slate-500 hover:text-[#dc2626] underline decoration-dotted transition-colors"
              >
                我依然想尝试手机版
              </button>
            )}
          </div>
        </div>
        
        <div className="mt-8 text-xs text-slate-400 uppercase tracking-widest font-medium">
          Haigoo Remote Club
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
