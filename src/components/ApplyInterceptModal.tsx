import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Crown, ArrowRight, Shield, TrendingUp, Sparkles, Target, CheckCircle2, FileCheck, Building2, MapPin, Users, Star, Calendar, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../types';
import { TrustedCompany } from '../services/trusted-companies-service';

interface ApplyInterceptModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    companyInfo?: TrustedCompany | null;
    isMember: boolean;
    onProceedToApply: () => void;
}

import { getJobSourceType } from '../utils/job-source-helper';

export const ApplyInterceptModal: React.FC<ApplyInterceptModalProps> = ({
    isOpen,
    onClose,
    job,
    companyInfo,
    isMember,
    onProceedToApply
}) => {
    const navigate = useNavigate();

    if (!isOpen) return null;

    // Member View for Trusted Company Jobs (Not Referral)
    if (isMember && (job.isTrusted || job.sourceType === 'trusted')) {
        return createPortal(
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute top-3 right-3 p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Header */}
                    <div className="bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 p-5 border-b border-white/10 relative overflow-hidden">
                        {/* Decorative background elements */}
                        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                        
                        <div className="relative z-10 flex items-start gap-3">
                            <div className="bg-white/10 p-2.5 rounded-xl shadow-lg border border-white/20 backdrop-blur-md">
                                {companyInfo?.logo ? (
                                    <img src={companyInfo.logo} alt={companyInfo.name} className="w-8 h-8 object-contain" />
                                ) : (
                                    <Building2 className="w-8 h-8 text-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                                    {companyInfo?.name || job.company}
                                    <span className="px-1.5 py-0.5 bg-white/20 text-white text-[10px] rounded-full font-bold border border-white/10 backdrop-blur-md">已认证</span>
                                </h3>
                                <p className="text-xs text-indigo-100/80">
                                    Haigoo Member 专属认证信息
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5">
                        <div className="grid grid-cols-2 gap-3 mb-5">
                            {companyInfo?.companyRating && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                        <span className="text-xs font-semibold text-slate-900">企业评分</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-base font-bold text-slate-900">{companyInfo.companyRating}</span>
                                        {companyInfo.ratingSource && (
                                            <span className="text-[10px] text-slate-500">via {companyInfo.ratingSource}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            
                            {companyInfo?.employeeCount && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-xs font-semibold text-slate-900">员工规模</span>
                                    </div>
                                    <div className="text-xs text-slate-900 font-medium">
                                        {companyInfo.employeeCount}
                                    </div>
                                </div>
                            )}

                            {companyInfo?.address && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 col-span-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-xs font-semibold text-slate-900">总部地址</span>
                                    </div>
                                    <div className="text-xs text-slate-900 font-medium">
                                        {companyInfo.address}
                                    </div>
                                </div>
                            )}

                             {companyInfo?.foundedYear && (
                                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                                        <span className="text-xs font-semibold text-slate-900">成立年份</span>
                                    </div>
                                    <div className="text-xs text-slate-900 font-medium">
                                        {companyInfo.foundedYear}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-green-50 rounded-xl p-3 mb-5 border border-green-100 flex items-start gap-2.5">
                            <Shield className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                            <div>
                                <h4 className="text-xs font-bold text-green-800 mb-0.5">Haigoo 安全保障</h4>
                                <p className="text-[10px] text-green-700 leading-relaxed">
                                    作为会员，您正在申请的是经过 Haigoo 深度验证的真实企业岗位。我们已核实该企业的合法性及招聘真实性。
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                onClose();
                                onProceedToApply();
                            }}
                            className="w-full py-3 px-6 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                        >
                            前往官网申请 <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 内推岗位且为免费用户 - 显示会员升级引导
    if (job.canRefer && !isMember) {
        return createPortal(
            <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Header Gradient */}
                    <div className="h-40 bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 flex flex-col items-center justify-center relative overflow-hidden">
                        {/* Decorative elements */}
                        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                        <div className="absolute top-0 left-1/4 w-32 h-32 bg-indigo-400/20 rounded-full blur-[40px] animate-pulse"></div>
                        <div className="absolute bottom-0 right-1/4 w-32 h-32 bg-teal-400/20 rounded-full blur-[40px] animate-pulse delay-700"></div>
                        
                        <div className="relative z-10 bg-white/10 p-4 rounded-full backdrop-blur-md shadow-2xl border border-white/20 ring-1 ring-white/10">
                            <Crown className="w-10 h-10 text-white/90" />
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-6 pt-8 text-center -mt-6 relative z-10 bg-white rounded-t-3xl">
                        <div className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold uppercase tracking-wide rounded-full mb-3">
                            <Target className="w-3.5 h-3.5" />
                            内推专属
                        </div>

                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                            解锁内推直达通道
                        </h3>

                        <p className="text-sm text-slate-600 mb-5 leading-relaxed px-4">
                            该岗位支持 Haigoo 特邀会员专属内推，简历直达 HR 邮箱，面试机会提升 3 倍。
                        </p>

                        <div className="bg-slate-50 rounded-xl p-3 mb-6 text-left space-y-2.5 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">内推成功率提升 300%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">简历直达 Hiring Manager</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">内推简历优化1V1评估</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    navigate('/membership');
                                }}
                                className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-200/50 transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
                            >
                                立即成为 Haigoo Member <ArrowRight className="w-4 h-4" />
                            </button>

                            <button
                                onClick={onClose}
                                className="w-full py-2 px-6 text-slate-400 font-medium hover:text-slate-600 transition-colors text-xs"
                            >
                                暂不需要，谢谢
                            </button>
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // 官网/第三方岗位 - 免费用户显示审核说明
    if (!isMember) {
        const sourceType = getJobSourceType(job);

        // 如果是第三方可信平台（如 LinkedIn, Indeed 等），显示简化的跳转提示
        if (sourceType === 'trusted_platform') {
            return createPortal(
                <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                        onClick={onClose}
                    />

                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="bg-slate-50 p-6 border-b border-slate-100 text-center">
                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                                <ExternalLink className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">
                                即将前往第三方平台
                            </h3>
                            <p className="text-sm text-slate-500">
                                该岗位发布于合作招聘平台
                            </p>
                        </div>

                        <div className="p-6">
                            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-100">
                                <div className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-slate-900 text-sm mb-1">Haigoo 已验证</p>
                                        <p className="text-xs text-slate-600 leading-relaxed">
                                            我们已确认该平台及岗位的真实性。跳转后您可能需要注册或登录该平台账号。
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    onClose();
                                    onProceedToApply();
                                }}
                                className="w-full py-3 px-6 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2"
                            >
                                继续前往申请 <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            );
        }

        // 默认情况（官网/企业直投）：显示完整的风险评估引导
        return createPortal(
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
            </div>,
            document.body
        );
    }

    // 会员用户 - 直接跳转，无弹窗（这个组件不应该被调用）
    return null;
};
