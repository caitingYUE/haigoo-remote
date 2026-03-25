import React from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Crown, ArrowRight, Shield, TrendingUp, Sparkles, Target, CheckCircle2, FileCheck, Building2, MapPin, Users, Star, Calendar, ExternalLink, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Job } from '../types';
import { TrustedCompany } from '../services/trusted-companies-service';
import { trackingService } from '../services/tracking-service';

interface ApplyInterceptModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    companyInfo?: TrustedCompany | null;
    isAuthenticated?: boolean;
    isMember: boolean;
    onProceedToApply: (pendingWindow?: Window | null) => void;
    // Free usage for non-members
    referralUsageCount?: number;
    referralUnlocked?: boolean;
    onConsumeReferral?: () => void;
    FREE_FEATURE_LIMIT?: number;
    websiteApplyUsageCount?: number;
    websiteApplyUnlocked?: boolean;
    onConsumeWebsiteApply?: () => Promise<boolean> | boolean;
    websiteApplyLimit?: number;
    onShowUpgrade?: (featureKey: string, sourceKey?: string) => void;
}

import { getJobSourceType } from '../utils/job-source-helper';

export const ApplyInterceptModal: React.FC<ApplyInterceptModalProps> = ({
    isOpen,
    onClose,
    job,
    companyInfo,
    isAuthenticated = false,
    isMember,
    onProceedToApply,
    referralUsageCount = 0,
    referralUnlocked = false,
    onConsumeReferral,
    FREE_FEATURE_LIMIT = 3,
    websiteApplyUsageCount = 0,
    websiteApplyUnlocked = false,
    onConsumeWebsiteApply,
    websiteApplyLimit = 20,
    onShowUpgrade,
}) => {
    const navigate = useNavigate();

    const baseTrackingProps = {
        page_key: 'job_detail',
        module: 'apply_intercept_modal',
        source_key: 'apply_intercept_modal',
        entity_type: 'job',
        entity_id: job?.id,
        job_id: job?.id,
        company: job?.company,
    };

    const openPendingWebsiteApplyWindow = () => {
        const targetUrl = String(job?.url || job?.sourceUrl || '').trim();
        if (!targetUrl) return null;

        const popup = window.open('', '_blank');
        if (!popup) return null;

        try {
            popup.opener = null;
            popup.document.title = '正在跳转申请页面...';
            popup.document.body.style.margin = '0';
            popup.document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
            popup.document.body.style.display = 'flex';
            popup.document.body.style.alignItems = 'center';
            popup.document.body.style.justifyContent = 'center';
            popup.document.body.style.minHeight = '100vh';
            popup.document.body.style.color = '#475569';
            popup.document.body.innerHTML = '<div style="font-size:14px;">正在打开岗位申请页面...</div>';
        } catch (_error) {
            // Ignore cross-window DOM errors and continue with navigation handoff.
        }

        return popup;
    };

    if (!isOpen) return null;

    const canWebsiteApplyFree = isAuthenticated && (websiteApplyUnlocked || websiteApplyUsageCount < websiteApplyLimit);
    const websiteApplyRemaining = Math.max(0, websiteApplyLimit - websiteApplyUsageCount);
    const websiteApplyActionLabel = !isAuthenticated ? '前往申请（需登录）' : canWebsiteApplyFree ? '继续前往申请' : '前往申请次数已用完';

    // Member View for Trusted Company Jobs (Not Referral)
    if (isMember && (job.isTrusted || job.sourceType === 'trusted')) {
        return createPortal(
            <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                    onClick={onClose}
                />

                <div className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 z-20 rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)] p-6">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                        <div className="absolute -right-10 top-0 h-32 w-32 rounded-full bg-cyan-400/15 blur-3xl"></div>
                        
                        <div className="relative z-10 flex items-start gap-3">
                            <div className="rounded-2xl border border-white/15 bg-white/10 p-3 shadow-lg backdrop-blur-md">
                                {companyInfo?.logo ? (
                                    <img src={companyInfo.logo} alt={companyInfo.name} className="w-8 h-8 object-contain" />
                                ) : (
                                    <Building2 className="w-8 h-8 text-white" />
                                )}
                            </div>
                            <div className="flex-1">
                                <div className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80 backdrop-blur-md">
                                    <Shield className="h-3.5 w-3.5 text-cyan-200" />
                                    已认证企业
                                </div>
                                <h3 className="mt-3 text-lg font-bold text-white mb-1 flex items-center gap-2">
                                    {companyInfo?.name || job.company}
                                </h3>
                                <p className="text-xs text-indigo-100/80">
                                    这家企业的关键信息已经过 Haigoo 核验
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

    // 内推岗位且为免费用户 - 有剩余次数则允许，否则显示升级引导
    if (job.canRefer && !isMember) {
        const canReferFree = referralUnlocked || referralUsageCount < FREE_FEATURE_LIMIT;
        const remaining = FREE_FEATURE_LIMIT - referralUsageCount;

        // Still has free quota → allow with count badge
        if (canReferFree) {
            return createPortal(
                <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                    <div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                        onClick={onClose}
                    />

                <div className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 z-20 rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>

                        <div className="relative flex h-32 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)]">
                            <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                            <div className="absolute -right-8 top-4 h-24 w-24 rounded-full bg-cyan-400/15 blur-3xl"></div>
                            <div className="relative z-10 bg-white/10 p-3 rounded-full backdrop-blur-md shadow-2xl border border-white/20">
                                <Target className="w-8 h-8 text-white/90" />
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 pt-6 text-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-full mb-3">
                                <Target className="w-3.5 h-3.5" />
                                邮箱直申
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                                    {referralUnlocked ? '已解锁' : `剩余 ${remaining}/${FREE_FEATURE_LIMIT}`}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-slate-900 mb-2">
                                内推直达通道
                            </h3>

                            <p className="text-sm text-slate-600 mb-5 leading-relaxed px-4">
                                先体验一次关键人脉投递，让简历更快进入企业内部视野。
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => {
                                        trackingService.track('click_apply', {
                                            ...baseTrackingProps,
                                            feature_key: 'referral',
                                            apply_method: 'referral_free_experience',
                                        });
                                        if (!referralUnlocked) {
                                            onConsumeReferral?.();
                                        }
                                        onClose();
                                        onProceedToApply();
                                    }}
                                    className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
                                >
                                    立即内推 <ArrowRight className="w-4 h-4" />
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

        // Quota exhausted → show upgrade
        return createPortal(
            <div className="fixed inset-0 z-[2200] flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                    onClick={onClose}
                />

                <div className="relative w-full max-w-[440px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 z-20 rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="relative flex h-36 flex-col items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)]">
                        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                        <div className="absolute top-0 left-1/4 w-28 h-28 bg-indigo-400/20 rounded-full blur-[40px]"></div>
                        <div className="absolute bottom-0 right-1/4 w-28 h-28 bg-teal-400/20 rounded-full blur-[40px]"></div>
                        
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
                            解锁完整关键人脉
                        </h3>

                        <p className="text-sm text-slate-600 mb-5 leading-relaxed px-4">
                            免费次数已用完。升级后可继续查看岗位相关联系人，并长期使用内推与高价值邮箱投递。
                        </p>

                        <div className="bg-slate-50 rounded-xl p-3 mb-6 text-left space-y-2.5 border border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">查看完整岗位相关联系人</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">高价值邮箱直申</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 p-1 rounded-full">
                                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                                </div>
                                <span className="text-xs font-medium text-slate-700">会员期内不限次使用</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    trackingService.track('upgrade_cta_click', {
                                        ...baseTrackingProps,
                                        feature_key: 'referral',
                                        source_key: 'referral_upgrade_modal',
                                    });
                                    onClose();
                                    onShowUpgrade?.('referral', 'referral_upgrade_modal');
                                }}
                                className="w-full py-3 px-6 bg-gradient-to-r from-indigo-600 to-teal-600 hover:from-indigo-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-200/50 transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 text-sm"
                            >
                                查看会员权益 <ArrowRight className="w-4 h-4" />
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
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                        onClick={onClose}
                    />

                    <div className="relative w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all animate-in fade-in zoom-in duration-200">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="bg-[linear-gradient(180deg,rgba(241,245,249,0.9),rgba(255,255,255,1))] p-6 border-b border-slate-100 text-center">
                            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4">
                                <ExternalLink className="w-6 h-6 text-indigo-600" />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">
                                即将跳转到外部申请页
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
                                onClick={async () => {
                                    trackingService.track('click_apply', {
                                        ...baseTrackingProps,
                                        feature_key: 'website_apply',
                                        apply_method: 'trusted_platform_redirect',
                                    });
                                    if (!isAuthenticated) {
                                        onClose();
                                        navigate('/login');
                                        return;
                                    }
                                    if (!canWebsiteApplyFree) {
                                        trackingService.track('upgrade_cta_click', {
                                            ...baseTrackingProps,
                                            feature_key: 'website_apply',
                                            source_key: 'trusted_platform_upgrade_gate',
                                        });
                                        onShowUpgrade?.('website_apply', 'trusted_platform_upgrade_gate');
                                        return;
                                    }
                                    const pendingWindow = openPendingWebsiteApplyWindow();
                                    const ok = await onConsumeWebsiteApply?.();
                                    if (ok === false) {
                                        if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                        return;
                                    }
                                    onClose();
                                    onProceedToApply(pendingWindow);
                                }}
                                className={`w-full py-3 px-6 font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 ${canWebsiteApplyFree
                                    ? 'bg-slate-900 hover:bg-indigo-600 text-white'
                                    : !isAuthenticated
                                        ? 'bg-slate-900 hover:bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}
                            >
                                {isAuthenticated && canWebsiteApplyFree ? (
                                    <>
                                        {websiteApplyActionLabel} <ArrowRight className="w-4 h-4" />
                                        <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-100 text-xs font-bold rounded">
                                            {websiteApplyUnlocked ? '已解锁' : `${websiteApplyRemaining}/${websiteApplyLimit}`}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {!isAuthenticated ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                        {websiteApplyActionLabel}
                                    </>
                                )}
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
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                    onClick={onClose}
                />

                    <div className="relative w-full max-w-[470px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] transform transition-all">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>

                    <div className="bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,1))] p-6 border-b border-green-100">
                        <div className="flex items-start gap-4">
                            <div className="bg-white p-3 rounded-2xl border border-green-100 shadow-sm">
                                <Shield className="w-8 h-8 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                                    <FileCheck className="w-6 h-6 text-green-600" />
                                    Haigoo 已审核这条岗位信息
                                </h3>
                                <p className="text-sm text-slate-600 mt-1">
                                    你可以更安心地继续投递，也可以先查看更多企业信息
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
                                        会员可查看更完整的企业画像
                                    </p>
                                    <p className="text-xs text-indigo-700">
                                        企业官网、业务背景、总部地点、员工规模、评分等信息
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => {
                                    trackingService.track('upgrade_cta_click', {
                                        ...baseTrackingProps,
                                        feature_key: 'company_info',
                                        source_key: 'website_apply_company_info_gate',
                                    });
                                    onClose();
                                    onShowUpgrade?.('company_info', 'website_apply_company_info_gate');
                                }}
                                className="py-3 px-4 bg-white border-2 border-indigo-600 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition-colors text-sm"
                            >
                                查看企业详情
                            </button>
                            <button
                                onClick={async () => {
                                    trackingService.track('click_apply', {
                                        ...baseTrackingProps,
                                        feature_key: 'website_apply',
                                        apply_method: 'screened_job_redirect',
                                    });
                                    if (!isAuthenticated) {
                                        onClose();
                                        navigate('/login');
                                        return;
                                    }
                                    if (!canWebsiteApplyFree) {
                                        trackingService.track('upgrade_cta_click', {
                                            ...baseTrackingProps,
                                            feature_key: 'website_apply',
                                            source_key: 'screened_job_upgrade_gate',
                                        });
                                        onShowUpgrade?.('website_apply', 'screened_job_upgrade_gate');
                                        return;
                                    }
                                    const pendingWindow = openPendingWebsiteApplyWindow();
                                    const ok = await onConsumeWebsiteApply?.();
                                    if (ok === false) {
                                        if (pendingWindow && !pendingWindow.closed) pendingWindow.close();
                                        return;
                                    }
                                    onClose();
                                    onProceedToApply(pendingWindow);
                                }}
                                className={`py-3 px-4 font-bold rounded-xl shadow-md transition-all text-sm flex items-center justify-center gap-2 ${canWebsiteApplyFree
                                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                                    : !isAuthenticated
                                        ? 'bg-slate-900 hover:bg-indigo-600 text-white'
                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}
                            >
                                {isAuthenticated && canWebsiteApplyFree ? (
                                    <>
                                        {websiteApplyActionLabel} →
                                        <span className="px-1.5 py-0.5 bg-white/15 text-white text-xs font-bold rounded">
                                            {websiteApplyUnlocked ? '已解锁' : `${websiteApplyRemaining}/${websiteApplyLimit}`}
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        {!isAuthenticated ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                        {websiteApplyActionLabel}
                                    </>
                                )}
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
