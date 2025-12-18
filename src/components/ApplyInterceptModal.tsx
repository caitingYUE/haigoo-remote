import React from 'react';
import { X, CheckCircle, Crown, ArrowRight, Shield, TrendingUp, Sparkles, Target, CheckCircle2, FileCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../types';

interface ApplyInterceptModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    isMember: boolean;
    onProceedToApply: () => void;
}

export const ApplyInterceptModal: React.FC<ApplyInterceptModalProps> = ({
    isOpen,
    onClose,
    job,
    isMember,
    onProceedToApply
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    // 内推岗位且为免费用户 - 显示会员升级引导
    if (job.canRefer && !isMember) {
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header Gradient */}
                    <div className="h-32 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                        <div className="relative z-10 bg-white/20 p-4 rounded-full backdrop-blur-md shadow-lg">
                            <Crown className="w-12 h-12 text-white" />
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-8 pt-10 text-center -mt-6 relative z-10 bg-white rounded-t-3xl">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wide rounded-full mb-4">
                            <Target className="w-3.5 h-3.5" />
                            内推专属
                        </div>

                        <h3 className="text-2xl font-bold text-slate-900 mb-3">
                            解锁内推直达通道
                        </h3>

                        <p className="text-slate-600 mb-6 leading-relaxed">
                            该岗位支持 Haigoo 特邀会员专属内推，简历直达 HR 邮箱，面试机会提升 3 倍。
                        </p>

                        <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left space-y-3 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">内推成功率提升 300%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-sm font-medium text-slate-700">简历直达 Hiring Manager</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
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
    }

    // 官网/第三方岗位 - 免费用户显示审核说明
    if (!isMember) {
        return (
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 border-b border-green-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-green-100 p-3 rounded-xl">
                                <Shield className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <FileCheck className="w-6 h-6 text-green-600" />
                                    Haigoo 已人工审核此岗位
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    我们已验证该岗位的真实性和有效性
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6">
                        <div className="space-y-4 mb-8">
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-slate-900">中国人可投</p>
                                    <p className="text-sm text-slate-600">该岗位对中国候选人开放申请</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-slate-900">非骗局</p>
                                    <p className="text-sm text-slate-600">确认为真实企业和真实岗位</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="font-medium text-slate-900">真实有效</p>
                                    <p className="text-sm text-slate-600">岗位信息准确，申请渠道有效</p>
                                </div>
                            </div>
                        </div>

                        {/* Member Upgrade CTA */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 mb-6 border border-indigo-100">
                            <div className="flex items-start gap-3">
                                <TrendingUp className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-indigo-900 mb-1 flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                        升级会员，查看企业深度评估
                                    </p>
                                    <p className="text-xs text-indigo-700">
                                        中国候选人友好度 · 历史回复率 · 平均反馈周期 · 风险提示
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate('/membership');
                                }}
                                className="py-3 px-4 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-sm"
                            >
                                查看风险评估
                            </button>
                            <button
                                onClick={() => {
                                    onClose();
                                    onProceedToApply();
                                }}
                                className="py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md transition-all text-sm"
                            >
                                继续前往申请 →
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 会员用户 - 直接跳转，无弹窗（这个组件不应该被调用）
    return null;
};
