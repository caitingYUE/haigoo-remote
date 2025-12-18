
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

  if (!isOpen) return null;

  if (showApplication) {
    return (
      <MembershipApplicationModal 
        isOpen={true} 
        onClose={() => {
          setShowApplication(false);
          onClose();
        }} 
      />
    );
  }

  const content = {
    referral: {
      title: "解锁内推直达通道",
      description: "该岗位支持 Haigoo 特邀会员专属内推，直达 HR 邮箱或内推系统，面试机会提升 3 倍。",
      icon: <Zap className="w-12 h-12 text-yellow-500" />,
      highlight: "内推成功率提升 300%"
    },
    ai_resume: {
      title: "开启 AI 简历深度优化",
      description: "使用大模型分析您的简历与目标岗位的匹配度，获得具体的修改建议和优化后的表达。",
      icon: <Star className="w-12 h-12 text-purple-500" />,
      highlight: "简历通过率提升 200%"
    },
    general: {
      title: "升级 Haigoo 特邀会员",
      description: "加入 Haigoo 远程工作俱乐部，获取独家岗位、内推机会和求职辅导。",
      icon: <Crown className="w-12 h-12 text-indigo-500" />,
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
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Image / Gradient */}
        <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center relative overflow-hidden">
           <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
           <div className="relative z-10 bg-white/20 p-4 rounded-full backdrop-blur-md shadow-lg">
              {content.icon}
           </div>
        </div>

        {/* Body */}
        <div className="p-8 pt-10 text-center -mt-6 relative z-10 bg-white rounded-t-3xl">
          <div className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wide rounded-full mb-4">
            Premium Feature
          </div>
          
          <h3 className="text-2xl font-bold text-slate-900 mb-3">
            {content.title}
          </h3>
          
          <p className="text-slate-600 mb-6 leading-relaxed">
            {content.description}
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left space-y-3 border border-slate-100">
            <div className="flex items-center gap-3">
               <div className="bg-green-100 p-1 rounded-full">
                  <Check className="w-3 h-3 text-green-600" />
               </div>
               <span className="text-sm font-medium text-slate-700">{content.highlight}</span>
            </div>
            <div className="flex items-center gap-3">
               <div className="bg-green-100 p-1 rounded-full">
                  <Check className="w-3 h-3 text-green-600" />
               </div>
               <span className="text-sm font-medium text-slate-700">解锁全部会员专属权益</span>
            </div>
             <div className="flex items-center gap-3">
               <div className="bg-green-100 p-1 rounded-full">
                  <Check className="w-3 h-3 text-green-600" />
               </div>
               <span className="text-sm font-medium text-slate-700">7天无理由退款保障</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                onClose();
                navigate('/membership');
              }}
              className="w-full py-3.5 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2"
            >
              立即成为 Haigoo Member <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={onClose}
              className="w-full py-3 px-6 text-slate-500 font-medium hover:text-slate-800 transition-colors text-sm"
            >
              暂不需要，谢谢
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
