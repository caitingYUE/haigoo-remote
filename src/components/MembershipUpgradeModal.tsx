
import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MembershipUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerSource: 'referral' | 'ai_resume' | 'general';
}

export const MembershipUpgradeModal: React.FC<MembershipUpgradeModalProps> = ({
  isOpen,
  onClose,
  triggerSource
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  const content = {
    referral: {
      title: "解锁完整企业人脉",
      description: "查看岗位相关联系人与更高价值的投递入口，让简历更快抵达关键决策方。",
      benefits: ['完整联系人信息', '高价值邮箱直申', '会员期内不限次使用']
    },
    ai_resume: {
      title: "继续深度打磨简历与面试",
      description: "在已有框架基础上，继续展开简历优化、英文面试拓展和模拟回答。",
      benefits: ['无限次 AI 简历优化', '英文面试题拓展', '中英文模拟回答']
    },
    general: {
      title: "解锁更多求职权益",
      description: "获得 AI 工作助手、关键人脉、邮箱直申与更多会员专属能力，让求职推进更高效。",
      benefits: ['远程岗位核心权益', 'AI 助手与简历优化', '关键人脉与内推通道']
    }
  }[triggerSource];

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[30px] border border-indigo-100 bg-white shadow-[0_36px_120px_-52px_rgba(15,23,42,0.45)] transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-white/10 p-2 text-white/80 backdrop-blur transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(165,180,252,0.28),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.2),_transparent_24%),linear-gradient(135deg,#111827_0%,#1e1b4b_60%,#312e81_100%)] px-6 pb-8 pt-7 text-white">
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
          <div className="absolute -right-10 top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative z-10 pr-10">
            <h3 className="text-[28px] font-black leading-tight tracking-tight text-white">
              {content.title}
            </h3>
            <p className="mt-3 max-w-[300px] text-sm leading-6 text-indigo-50/90">
              {content.description}
            </p>
          </div>
        </div>

        <div className="bg-white px-6 pb-6 pt-5">
          <div className="rounded-[24px] border border-slate-100 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,1))] p-4 shadow-sm">
            <div className="grid gap-3">
              {content.benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 text-sm text-slate-700 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              onClick={() => {
                onClose();
                navigate('/membership#pricing-plans');
              }}
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#312e81_0%,#4338ca_100%)] px-5 py-3.5 text-sm font-bold text-white shadow-[0_20px_40px_-22px_rgba(79,70,229,0.72)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_48px_-22px_rgba(79,70,229,0.8)]"
            >
              查看会员权益
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-slate-200 px-5 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              稍后再看
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
