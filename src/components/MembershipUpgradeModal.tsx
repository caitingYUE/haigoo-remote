
import React, { useState } from 'react';
import { X, Crown, Check, ArrowRight, Zap, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MembershipApplicationModal } from './MembershipApplicationModal';

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
  const [showApplication, setShowApplication] = useState(false);

  const handleUpgradeClick = () => {
    setShowApplication(true);
  };

  if (!isOpen) return null;

  const content = {
    referral: {
      title: "解锁内推直达通道",
      description: "该岗位支持 Haigoo 特邀会员专属内推，直达 HR 邮箱或内推系统，面试机会提升 3 倍。",
      icon: <Zap className="w-12 h-12 text-yellow-300 drop-shadow-lg" />,
      highlight: "内推成功率提升 300%"
    },
    ai_resume: {
      title: "开启 AI 简历深度优化",
      description: "使用大模型分析您的简历与目标岗位的匹配度，获得具体的修改建议和优化后的表达。",
      icon: <Star className="w-12 h-12 text-purple-300 drop-shadow-lg" />,
      highlight: "简历通过率提升 200%"
    },
    general: {
      title: "升级 Haigoo 特邀会员",
      description: "加入 Haigoo 远程工作俱乐部，获取独家岗位、内推机会和求职辅导。",
      icon: <Crown className="w-12 h-12 text-indigo-300 drop-shadow-lg" />,
      highlight: "全方位助力远程求职"
    }
  }[triggerSource];

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Image / Gradient - Premium Dark Theme */}
        <div className="h-48 bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 flex flex-col items-center justify-center relative overflow-hidden">
           {/* Decorative elements */}
           <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
           <div className="absolute top-0 left-1/4 w-32 h-32 bg-indigo-400/20 rounded-full blur-[40px] animate-pulse"></div>
           <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-teal-400/20 rounded-full blur-[40px] animate-pulse delay-700"></div>
           
           <div className="relative z-10 bg-white/10 p-4 rounded-full backdrop-blur-md shadow-2xl border border-white/20 ring-1 ring-white/10">
              {content.icon}
           </div>
        </div>

        {/* Body */}
        <div className="p-8 pt-6 text-center relative z-10 bg-white">
          <div className="inline-block px-3 py-1 bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200 text-amber-700 text-xs font-bold uppercase tracking-wide rounded-full mb-6 shadow-sm">
            Premium Feature
          </div>
          
          <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tight">
            {content.title}
          </h3>
          
          <p className="text-slate-600 mb-8 leading-relaxed">
            {content.description}
          </p>

          <div className="bg-slate-50 rounded-xl p-5 mb-8 text-left space-y-4 border border-slate-100">
            <div className="flex items-center gap-3">
               <div className="bg-emerald-100 rounded-full p-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
               </div>
               <span className="text-slate-700 text-sm font-medium">{content.highlight}</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="bg-emerald-100 rounded-full p-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
               </div>
               <span className="text-slate-700 text-sm font-medium">解锁全部会员专属权益</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="bg-emerald-100 rounded-full p-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
               </div>
               <span className="text-slate-700 text-sm font-medium">获取优质远程人脉</span>
            </div>
          </div>

          <div className="space-y-3">
             <button
               onClick={() => {
                 onClose();
                 navigate('/membership');
               }}
               className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 group"
             >
               申请成为 Haigoo Member
               <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
             </button>
             
             <button
               onClick={onClose}
               className="text-sm text-slate-400 hover:text-slate-600 transition-colors py-2"
             >
               暂不需要，谢谢
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
