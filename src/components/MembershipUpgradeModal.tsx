
import React from 'react';
import { createPortal } from 'react-dom';
import { X, Crown, Check, ArrowRight, Zap, Star, Sparkles } from 'lucide-react';
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
      eyebrow: '关键人脉解锁',
      title: "把简历送到更关键的人手里",
      description: "查看岗位相关的招聘负责人、业务 Leader 和更高价值的企业联系人，提升触达效率。",
      icon: <Zap className="w-10 h-10 text-amber-300 drop-shadow-lg" />,
      highlight: "解锁完整企业人脉与更高价值投递入口",
      accent: 'from-amber-500/20 via-orange-500/10 to-transparent',
      benefits: ['查看完整关键联系人', '解锁高价值邮箱直申', '会员期内不限次使用']
    },
    ai_resume: {
      eyebrow: 'AI 深度打磨',
      title: "继续把简历和面试打磨到更强",
      description: "在已有框架基础上，继续获得更细致的简历优化、英文面试拓展和双语模拟回答。",
      icon: <Star className="w-10 h-10 text-fuchsia-300 drop-shadow-lg" />,
      highlight: "解锁无限次 AI 简历优化与深度打磨",
      accent: 'from-fuchsia-500/20 via-violet-500/10 to-transparent',
      benefits: ['简历表达深度优化', '英文面试题拓展', '中英文模拟回答']
    },
    general: {
      eyebrow: '会员权益',
      title: "解锁更完整的求职工具箱",
      description: "获得 AI 工作助手、关键人脉、邮箱直申与更多会员专属能力，让求职推进更高效。",
      icon: <Crown className="w-10 h-10 text-indigo-300 drop-shadow-lg" />,
      highlight: "一站式解锁简历、投递和人脉权益",
      accent: 'from-cyan-500/15 via-indigo-500/10 to-transparent',
      benefits: ['远程岗位核心权益', 'AI 助手与简历优化', '关键人脉与内推通道']
    }
  }[triggerSource];

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer" 
        onClick={onClose}
      />

      <div className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <button 
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)] px-6 pb-6 pt-6 text-white">
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
          <div className={`absolute -right-16 top-0 h-40 w-40 rounded-full bg-gradient-to-br ${content.accent} blur-3xl`}></div>
          <div className="absolute -left-10 bottom-0 h-28 w-28 rounded-full bg-white/10 blur-3xl"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              {content.eyebrow}
            </div>

            <div className="mt-5 flex items-start gap-4">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-2xl backdrop-blur-md">
                {content.icon}
              </div>
              <div className="flex-1 pr-8">
                <h3 className="text-[24px] font-black leading-tight tracking-tight">
                  {content.title}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/78">
                  {content.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white px-6 pb-6 pt-5">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/90 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Check className="h-4 w-4 text-emerald-500" />
              {content.highlight}
            </div>
            <div className="mt-3 grid gap-2.5">
              {content.benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2.5 text-sm text-slate-600">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-emerald-500 shadow-sm">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{benefit}</span>
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
              className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(90deg,#4f46e5,#06b6d4)] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 hover:shadow-xl"
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
