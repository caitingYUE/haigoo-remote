import React, { useState, useMemo, useEffect } from 'react'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Zap, MessageSquare, X, ExternalLink, ChevronRight, ChevronLeft, Languages, Shield, Sparkles, Target, Crown, Lock, CheckCircle2, Clock, Mail, Users, Calendar, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { segmentJobDescription } from '../utils/translation'
import { SingleLineTags } from './SingleLineTags'
import { MembershipUpgradeModal } from './MembershipUpgradeModal'
import { ReferralModal } from './ReferralModal'
import { LocationTooltip } from './LocationTooltip'
import { TrustedStandardsBanner } from './TrustedStandardsBanner'
import { ApplyInterceptModal } from './ApplyInterceptModal'
import { ReferralApplicationModal } from './ReferralApplicationModal'
import { RiskRatingDisplay } from './RiskRatingDisplay'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { useNotificationHelpers } from './NotificationSystem'
import { getJobSourceType } from '../utils/job-source-helper'
import { trackingService } from '../services/tracking-service'
import { ShareJobModal } from './ShareJobModal'

interface JobDetailPanelProps {
    job: Job
    onSave?: (jobId: string) => void
    isSaved?: boolean
    onApply?: (jobId: string) => void
    onClose?: () => void
    showCloseButton?: boolean
    onNavigateJob?: (direction: 'prev' | 'next') => void
    canNavigatePrev?: boolean
    canNavigateNext?: boolean
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
    job,
    onSave,
    isSaved = false,
    onApply,
    onClose,
    showCloseButton = false,
    onNavigateJob,
    canNavigatePrev = false,
    canNavigateNext = false
}) => {
    const navigate = useNavigate()
    const { user, isMember } = useAuth()
    const sourceType = getJobSourceType(job)
    const isAuthenticated = !!user

    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [feedbackAccuracy, setFeedbackAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
    const [feedbackContent, setFeedbackContent] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackMessage, setFeedbackMessage] = useState('')
    // Translation defaults to false, enabled for members automatically
    const [showTranslation, setShowTranslation] = useState(false)
    const [translationUsageCount, setTranslationUsageCount] = useState(0)
    const TRANSLATION_FREE_LIMIT = 3
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
    const [showApplyInterceptModal, setShowApplyInterceptModal] = useState(false)
    const [showApplySelectionModal, setShowApplySelectionModal] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const { showSuccess, showError, showInfo } = useNotificationHelpers()

    useEffect(() => {
        // Reset state when job changes
        setIsFeedbackOpen(false)
        setFeedbackAccuracy('unknown')
        setFeedbackContent('')
        setFeedbackMessage('')
        
        // Reset translation state - Auto-enable for members
        setShowTranslation(isMember)

        // Track view job detail
        if (job?.id) {
            trackingService.track('view_job_detail', {
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                source: sourceType
            })
        }
    }, [job?.id, isMember])

    // Initialize translation usage from server
    useEffect(() => {
        if (isAuthenticated && !isMember) {
            const token = localStorage.getItem('haigoo_auth_token');
            if (token) {
                fetch('/api/users?resource=translation-usage', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.json())
                .then(data => {
                    if (data.success) {
                        setTranslationUsageCount(data.usage);
                        // Sync local storage for fallback
                        localStorage.setItem('translation_usage_count', data.usage.toString());
                        localStorage.setItem('translation_usage_date', new Date().toDateString());
                    }
                })
                .catch(err => console.error('Failed to fetch translation usage:', err));
            }
        } else if (!isAuthenticated) {
             // Fallback for guest users (still use local storage or just rely on session)
             const storedDate = localStorage.getItem('translation_usage_date')
             const today = new Date().toDateString()
             if (storedDate !== today) {
                 setTranslationUsageCount(0)
                 localStorage.setItem('translation_usage_count', '0')
                 localStorage.setItem('translation_usage_date', today)
             } else {
                 const count = parseInt(localStorage.getItem('translation_usage_count') || '0', 10)
                 setTranslationUsageCount(count)
             }
        }
    }, [isAuthenticated, isMember]);

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId).then(setCompanyInfo).catch(() => setCompanyInfo(null))
        } else {
            setCompanyInfo(null)
        }
    }, [job?.companyId])

    // Member-only fields (from PRD)
    const riskRating = (job as any).riskRating;
    const haigooComment = (job as any).haigooComment;
    const hiddenFields = (job as any).hiddenFields;

    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        setLogoError(false);
    }, [job?.id]); // Reset error state when job changes

    const jobDescriptionData = useMemo(() => {
        const originalDesc = typeof job?.description === 'string' ? job.description : (job?.description ? String(job.description) : '')
        const translatedDesc = typeof job?.translations?.description === 'string' ? job.translations.description : (job?.translations?.description ? String(job.translations.description) : '')

        let descToUse = originalDesc

        if (showTranslation && translatedDesc) {
            // 智能回退逻辑：如果翻译内容过短且原文较长，可能翻译不完整，回退到原文
            // 比如：原文超过500字，但翻译少于200字
            const isTranslationTooShort = originalDesc.length > 500 && translatedDesc.length < 200

            // 或者：原文有很多段落（>10行），但翻译只有寥寥几行（<3行）
            const originalLines = originalDesc.split('\n').length
            const translatedLines = translatedDesc.split('\n').length
            const isTranslationStructureLost = originalLines > 10 && translatedLines < 3

            if (!isTranslationTooShort && !isTranslationStructureLost) {
                descToUse = translatedDesc
            }
        }

        return segmentJobDescription(descToUse)
    }, [job, showTranslation])

    const handleApply = () => {
        // 0. Enforce Login first
        if (!isAuthenticated) {
            if (window.confirm('申请职位需要登录\n\n是否前往登录？')) {
                navigate('/login')
            }
            return;
        }

        // 1. Referral Jobs: Members go to internal application, Non-members see upsell
        if (job.canRefer) {
            if (isMember) {
                setIsReferralModalOpen(true);
            } else {
                setShowApplyInterceptModal(true);
            }
            return;
        }

        // 2. Trusted Jobs: Show certification info (intercept modal)
        // If member, we can decide to skip or show info.
        // User requirement: "Must be logged in and be a member, otherwise unable to apply/jump"
        // So for non-members, we MUST block.
        if (job.isTrusted) {
            // If member, maybe show info but allow proceed (handled in ApplyInterceptModal or here)
            // If we want members to proceed directly:
            if (isMember) {
                // Check if ApplyInterceptModal has a "Member View" which is just informational?
                // The current ApplyInterceptModal shows info for members on Trusted jobs.
                // We'll keep showing it for members, but strictly BLOCK non-members.
                setShowApplyInterceptModal(true); 
            } else {
                 setShowApplyInterceptModal(true);
            }
            return;
        }

        // 3. Other Jobs: Non-members see safety check (now BLOCK), Members go directly
        if (!isMember) {
            setShowApplyInterceptModal(true);
            return;
        }

        // Member users on non-referral/non-trusted jobs: direct apply + track
        proceedToApply();
    }

    const executeApply = async (method: 'website' | 'email') => {
        if (method === 'email' && companyInfo?.hiringEmail) {
            trackingService.track('click_apply', {
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                apply_method: 'email'
            });

            window.location.href = `mailto:${companyInfo.hiringEmail}?subject=${encodeURIComponent(`Application for ${job.title}`)}`;
            
            if (isAuthenticated) {
                try {
                    const token = localStorage.getItem('haigoo_auth_token');
                    await fetch('/api/user-profile?action=record_interaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            jobId: job.id,
                            type: 'apply_redirect',
                            notes: 'Applied via Email'
                        })
                    });
                    showSuccess('已为你记录申请，可在「我的投递」查看');
                } catch (error) {
                    console.error('Failed to record interaction:', error);
                }
            }
            setShowApplySelectionModal(false);
            return;
        }

        const url = job.url || job.sourceUrl;
        
        trackingService.track('click_apply', {
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: url ? 'external_link' : 'internal_apply'
        });

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');

            // For authenticated users, auto-record the application
            if (isAuthenticated) {
                try {
                    const token = localStorage.getItem('haigoo_auth_token');
                    
                    await fetch('/api/user-profile?action=record_interaction', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            jobId: job.id,
                            type: 'apply_redirect',
                            notes: ''
                        })
                    });
                    showSuccess('已为你记录申请，可在「我的投递」查看');
                } catch (error) {
                    console.error('Failed to record interaction:', error);
                }
            }
        } else {
            onApply?.(job.id);
        }
        setShowApplySelectionModal(false);
    }

    const proceedToApply = async () => {
        // Check if company has hiring email (regardless of member status)
        if (companyInfo?.hiringEmail) {
            setShowApplySelectionModal(true);
        } else {
            executeApply('website');
        }
    }

    const handleReferralSuccess = () => {
        showSuccess('申请已提交，请耐心等待审核');
    }

    const handleShare = () => {
        setIsShareModalOpen(true)
        trackingService.track('click_share_button', {
            job_id: job.id,
            from: 'detail_panel'
        });
    }

    const handleSave = () => {
        if (!isAuthenticated) {
            if (window.confirm('登录后可以收藏职位\n\n是否前往登录？')) {
                navigate('/login')
            }
            return
        }

        trackingService.track('click_save_job', {
            job_id: job.id,
            action: isSaved ? 'unsave' : 'save'
        })
        onSave?.(job.id)
    }

    const submitFeedback = async () => {
        if (!feedbackContent.trim()) {
            setFeedbackMessage('请填写反馈内容')
            return
        }
        try {
            setFeedbackSubmitting(true)
            setFeedbackMessage('')
            const token = localStorage.getItem('haigoo_auth_token') || ''
            const res = await fetch('/api/user-profile?action=submit_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job.id,
                    accuracy: feedbackAccuracy,
                    content: feedbackContent,
                    source: job.source || '',
                    sourceUrl: job.sourceUrl || ''
                })
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (res.ok && data?.success) {
                setFeedbackMessage('反馈已提交，感谢你的帮助！')
                setTimeout(() => { setIsFeedbackOpen(false) }, 1200)
                setFeedbackAccuracy('unknown')
                setFeedbackContent('')
            } else {
                setFeedbackMessage(data?.error || '提交失败，请稍后重试')
            }
        } catch (e: any) {
            setFeedbackMessage('提交失败，请检查网络连接')
        } finally {
            setFeedbackSubmitting(false)
        }
    }

    const displayText = (originalText: string, translatedText?: string): string => {
        if (showTranslation && translatedText) {
            return translatedText
        }
        return originalText || ''
    }

    const renderFormattedText = (text: string) => {
        if (!text) return null
        return text.split('\n').map((line, index) => (
            <p key={index} className="mb-2 last:mb-0">
                {renderInlineFormatting(line)}
            </p>
        ))
    }

    const renderInlineFormatting = (text: string) => {
        const boldRegex = /\*\*(.*?)\*\*/g
        const parts = text.split(boldRegex)
        return parts.map((part, index) => {
            if (index % 2 === 1) {
                return <strong key={index} className="font-semibold text-slate-900">{part}</strong>
            }
            return part
        })
    }

    const handleCompanyClick = () => {
        // Navigate to company detail page using company name as identifier
        const companyName = encodeURIComponent(job.company || '')
        navigate(`/companies/${companyName}`)
    }

    return (
        <div className="flex flex-col bg-white">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-slate-100 bg-white/50 backdrop-blur-md px-6 py-5 ss-premium-header relative z-20">
                <div className="flex items-start justify-between mb-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex-1 pr-6 leading-tight tracking-tight">
                        {displayText(job.title, job.translations?.title)}
                    </h1>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        {onNavigateJob && (
                            <div className="flex items-center bg-slate-100/50 p-1 rounded-lg border border-slate-200/50">
                                <button
                                    onClick={() => onNavigateJob('prev')}
                                    disabled={!canNavigatePrev}
                                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${canNavigatePrev
                                        ? 'hover:bg-white text-slate-600 hover:text-indigo-600 shadow-sm'
                                        : 'text-slate-300 cursor-not-allowed'
                                        }`}
                                    title="上一个职位"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <div className="w-px h-4 bg-slate-200 mx-1"></div>
                                <button
                                    onClick={() => onNavigateJob('next')}
                                    disabled={!canNavigateNext}
                                    className={`p-1.5 rounded-md transition-all flex items-center justify-center ${canNavigateNext
                                        ? 'hover:bg-white text-slate-600 hover:text-indigo-600 shadow-sm'
                                        : 'text-slate-300 cursor-not-allowed'
                                        }`}
                                    title="下一个职位"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {showCloseButton && onClose && (
                            <button
                                onClick={onClose}
                                className="ml-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                            >
                                <X className="w-4 h-4" />
                                关闭
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 mb-5">
                        <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[200px] font-medium">{displayText(job.company || '')}</span>
                            {job.isTrusted && isMember && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
                                    <Sparkles className="w-3 h-3" />
                                    认证
                                </span>
                            )}
                        </div>

                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {(() => {
                            const locText = displayText(job.location || '', job.translations?.location);
                            // Only show tooltip if text is truncated (simplified logic: check length)
                            const isLongText = locText.length > 30;
                            
                            return (
                                <div className="relative">
                                    <span
                                        className={`truncate max-w-[150px] inline-block ${isLongText ? 'cursor-help border-b border-dashed border-slate-300 hover:text-indigo-600 hover:border-indigo-400' : ''}`}
                                        onClick={(e) => {
                                            if (isLongText) {
                                                e.stopPropagation();
                                                setShowLocationTooltip(!showLocationTooltip);
                                            }
                                        }}
                                        title={locText}
                                    >
                                        {locText}
                                    </span>
                                    {showLocationTooltip && isLongText && (
                                        <div className="absolute z-50 mt-2 left-0">
                                            <LocationTooltip location={locText} onClose={() => setShowLocationTooltip(false)} />
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </div>

                    {job.timezone && (
                        <div className="flex items-center gap-1.5">
                            <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[200px]" title={job.timezone}>
                                {job.timezone}
                            </span>
                        </div>
                    )}

                    <div className="flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-semibold text-slate-900">
                            {(() => {
                                if (!job.salary) return '薪资面议';
                                if (typeof job.salary === 'string') {
                                    if (job.salary === 'null' || job.salary === 'Open' || job.salary === 'Competitive' || job.salary === 'Unspecified' || job.salary === '0' || job.salary === '0-0') return '薪资面议';
                                    
                                    // Try parse JSON
                                    if (job.salary.trim().startsWith('{')) {
                                        try {
                                            const parsed = JSON.parse(job.salary);
                                            if (parsed && typeof parsed === 'object' && parsed.min > 0) {
                                                return `${parsed.currency === 'USD' ? '$' : '¥'}${parsed.min.toLocaleString()} - ${parsed.max.toLocaleString()}`;
                                            }
                                        } catch (e) {}
                                    }

                                    return job.salary;
                                }
                                if (typeof job.salary === 'object' && job.salary.min > 0) {
                                    return `${job.salary.currency === 'USD' ? '$' : '¥'}${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}`;
                                }
                                return '薪资面议';
                            })()}
                        </span>
                    </div>
                </div>
            </header>

            {/* Action Buttons - Part of scrollable content now */}
            <div className="flex-shrink-0 px-6 py-3 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium border ${isSaved
                                ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            title={isSaved ? '已收藏' : '收藏'}
                        >
                            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                            <span>{isSaved ? '已收藏' : '收藏'}</span>
                        </button>

                        <button
                            onClick={handleShare}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium"
                            title="分享"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>分享</span>
                        </button>

                        {hasTranslation && (
                            <button
                                onClick={() => {
                                    if (!isAuthenticated) {
                                        if (window.confirm('登录后可免费试用翻译功能（每日3次）\n\n是否前往登录？')) {
                                            navigate('/login')
                                        }
                                        return
                                    }

                                    if (!isMember) {
                                        if (translationUsageCount >= TRANSLATION_FREE_LIMIT) {
                                            setShowUpgradeModal(true)
                                            return
                                        }

                                        if (!showTranslation) {
                                            // Optimistically increment
                                            const newCount = translationUsageCount + 1
                                            setTranslationUsageCount(newCount)
                                            
                                            // Call API to persist usage
                                            const token = localStorage.getItem('haigoo_auth_token')
                                            if (token) {
                                                fetch('/api/users?resource=translation-usage', {
                                                    method: 'POST',
                                                    headers: { 'Authorization': `Bearer ${token}` }
                                                })
                                                .then(res => res.json())
                                                .then(data => {
                                                    if (data.success) {
                                                        // Sync accurate count from server
                                                        setTranslationUsageCount(data.usage)
                                                        localStorage.setItem('translation_usage_count', data.usage.toString())
                                                        localStorage.setItem('translation_usage_date', new Date().toDateString())
                                                    } else if (data.error === 'Translation limit reached') {
                                                        // Revert if limit reached (edge case)
                                                        setTranslationUsageCount(TRANSLATION_FREE_LIMIT)
                                                        setShowUpgradeModal(true)
                                                        setShowTranslation(false) // Hide translation
                                                        return // Stop here
                                                    }
                                                })
                                                .catch(console.error)
                                            } else {
                                                // Local fallback
                                                localStorage.setItem('translation_usage_count', newCount.toString())
                                                localStorage.setItem('translation_usage_date', new Date().toDateString())
                                            }

                                            if (newCount >= TRANSLATION_FREE_LIMIT) {
                                                showInfo('试用次数已用完', '升级会员享受无限翻译')
                                            }
                                        }
                                    }
                                    setShowTranslation(!showTranslation)
                                }}
                                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium border ${showTranslation
                                    ? 'bg-violet-50 text-violet-600 border-violet-100'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                                    }`}
                                title={showTranslation ? '切换原文' : '一键翻译'}
                            >
                                <Languages className="w-3.5 h-3.5" />
                                <span>{showTranslation ? '切换原文' : '一键翻译'}</span>
                                {isMember && (
                                    <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded border border-amber-100">
                                        <Crown className="w-3 h-3" />
                                        Member
                                    </span>
                                )}
                                {!isAuthenticated && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded">登录</span>
                                )}
                                {isAuthenticated && !isMember && translationUsageCount < TRANSLATION_FREE_LIMIT && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">
                                        {TRANSLATION_FREE_LIMIT - translationUsageCount}/3
                                    </span>
                                )}
                                {isAuthenticated && !isMember && translationUsageCount >= TRANSLATION_FREE_LIMIT && (
                                    <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-xs font-medium rounded">
                                        会员
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    <button
                        onClick={() => setIsFeedbackOpen(true)}
                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700 hover:bg-white border border-slate-200 rounded-lg transition-all flex items-center gap-1.5 text-sm font-medium"
                        title="反馈问题"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span>反馈</span>
                    </button>
                </div>
            </div >

            {/* Content - Flat layout, no internal scroll */}
            < main className="flex-1 px-6 py-6" >
                <div>
                    {/* Risk Rating Display - Using new component */}
                    <RiskRatingDisplay
                        riskRating={riskRating}
                        haigooComment={haigooComment}
                        hiddenFields={hiddenFields}
                        isMember={isMember}
                        className="mb-6"
                    />

                        {job.isTrusted && isMember && (
                            <div className="mb-6">
                                <TrustedStandardsBanner className="" isMember={isMember} onShowUpgrade={() => setShowUpgradeModal(true)} />
                            </div>
                        )}

                    {/* Job Description Sections */}
                    {jobDescriptionData.sections.map((section, index) => (
                        <section key={index} className="mb-8 last:mb-0">
                            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                                {displayText(section.title)}
                            </h3>
                            <div className="text-slate-600 text-base leading-7 lg:leading-8 tracking-wide font-normal whitespace-pre-line">
                                {renderFormattedText(displayText(section.content))}
                            </div>
                        </section>
                    ))}

                    {/* Skills/Tags */}
                    {(((job as any).tags && (job as any).tags.length > 0) || (job.skills && job.skills.length > 0)) && (
                        <section className="py-4 border-b border-slate-100">
                            <h3 className="text-base font-semibold text-slate-900 mb-3">
                                技能要求
                            </h3>
                            <SingleLineTags
                                tags={(Array.isArray((job as any).tags) && (job as any).tags.length > 0
                                    ? (job as any).tags
                                    : (job.skills || [])) as string[]}
                                size="sm"
                            />
                        </section>
                    )}

                    {/* Company Card at Bottom */}
                    <section className="py-6">
                        <div
                            onClick={handleCompanyClick}
                            className="bg-gradient-to-br from-white to-slate-50/50 border border-slate-200 rounded-xl p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer group/card"
                        >
                            <div className="flex items-start gap-4 mb-4">
                                {job.logo ? (
                                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-100 flex items-center justify-center overflow-hidden shadow-sm flex-shrink-0 p-1 group-hover/card:scale-105 transition-transform duration-300">
                                        <img
                                            src={job.logo}
                                            alt={job.company}
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-white font-bold text-lg">${(job.company || '未知').charAt(0)}</span>`;
                                                (e.target as HTMLImageElement).parentElement!.className = "w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 group-hover/card:scale-105 transition-transform duration-300";
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0 group-hover/card:scale-105 transition-transform duration-300">
                                        <span className="text-white font-bold text-xl">
                                            {(job.company || '未知公司').charAt(0)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover/card:text-indigo-600 transition-colors">
                                        {displayText(job.company || '')}
                                    </h3>
                                    {job.isTrusted && isMember && (
                                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-white text-[10px] font-bold shadow-sm">
                                            <Crown className="w-3 h-3 text-amber-400" />
                                            <span>会员专属信息</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                                    <span>{companyInfo?.industry || job.companyIndustry || job.category || '未分类'}</span>
                                    {companyInfo?.companyRating && isMember && (
                                        <>
                                            <span className="text-slate-300">•</span>
                                            <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                {companyInfo.companyRating}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Enhanced Company Info Grid */}
                                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden">
                                    {!isMember && (
                                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center text-center p-4">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                                <Lock className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <span className="text-slate-500 font-medium">企业认证信息仅会员可见</span>
                                        </div>
                                    )}
                                    <div className={`flex items-center gap-2 ${!isMember ? 'blur-[3px] opacity-60 select-none' : ''}`}>
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <Users className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="truncate font-medium text-slate-600">
                                            {isMember ? (companyInfo?.employeeCount || '规模未知') : '500-1000人'}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${!isMember ? 'blur-[3px] opacity-60 select-none' : ''}`}>
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <MapPin className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="truncate font-medium text-slate-600" title={isMember ? (companyInfo?.address || '总部未知') : ''}>
                                            {isMember ? (companyInfo?.address || '总部未知') : '北京市海淀区'}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${!isMember ? 'blur-[3px] opacity-60 select-none' : ''}`}>
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <Calendar className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="font-medium text-slate-600">
                                            {isMember ? (companyInfo?.foundedYear ? `${companyInfo.foundedYear}年成立` : '年份未知') : '2015年成立'}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-2 ${!isMember ? 'blur-[3px] opacity-60 select-none' : ''}`}>
                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <Mail className="w-3 h-3 text-indigo-600" />
                                        </div>
                                        <span className="text-indigo-600 font-bold">
                                            {isMember ? (companyInfo?.hiringEmail || companyInfo?.emailType || '通用邮箱') : 'HR直招邮箱'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {isMember && (
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-3 px-1">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    Haigoo 已核验企业真实性
                                </span>
                                <div className="flex items-center gap-1 text-indigo-600 font-medium group-hover:translate-x-1 transition-transform">
                                    查看详情
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        )}
                        </div>
                    </section>

                    {/* Source Label - Modified: Only show Referral badge as requested */}
                    <div className="flex flex-col items-end pb-4 gap-1">
                        {sourceType === 'referral' ? (
                            <>
                                <div className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-100">
                                    <Target className="w-3.5 h-3.5" />
                                    Haigoo 内推 (会员专属)
                                </div>
                                <p className="text-[10px] text-slate-500">
                                    * 由 Haigoo 审核简历并转递给企业，提高有效曝光率（会员专属）
                                </p>
                            </>
                        ) : null}
                        
                        {/* Hidden as requested: Official & Trusted Platform badges
                        : sourceType === 'official' ? (
                            <>
                                <div className="inline-flex items-center gap-1 px-3 py-1 bg-orange-50 text-orange-700 text-xs rounded-md border border-orange-100">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    企业官网岗位
                                </div>
                                <p className="text-[10px] text-slate-500">
                                    * 通过公司官网直接投递，Haigoo 已人工核实企业真实性
                                </p>
                            </>
                        ) : sourceType === 'trusted_platform' ? (
                            <>
                                {job.sourceUrl ? (
                                    <a
                                        href={job.sourceUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 text-indigo-600 hover:text-indigo-700 text-xs rounded-md border border-slate-100 hover:border-indigo-200 transition-colors"
                                        title="来自成熟招聘平台，Haigoo 已确认中国候选人可申请"
                                    >
                                        岗位来自 {job.source} (可信平台投递)
                                        <ExternalLink className="w-3 h-3" />
                                    </a>
                                ) : (
                                    <span className="inline-flex items-center px-3 py-1 bg-slate-50 text-slate-400 text-xs rounded-md border border-slate-100">
                                        岗位来自 {job.source}
                                    </span>
                                )}
                                <p className="text-[10px] text-slate-400">
                                    * 来自已审核的成熟招聘平台，可能需要另外注册账号
                                </p>
                            </>
                        ) : null}
                        */}
                    </div>
                </div>
            </main >

            {/* Footer */}
            < footer className={`border-t border-slate-100 bg-white p-4 flex-shrink-0 grid ${companyInfo?.hiringEmail ? 'grid-cols-2' : 'grid-cols-1'} gap-3`} >
                {/* Website Apply Button */}
                <button
                    onClick={() => {
                        if (!isAuthenticated) {
                            if (window.confirm('申请职位需要登录\n\n是否前往登录？')) {
                                navigate('/login')
                            }
                            return
                        }
                        executeApply('website')
                    }}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 py-3 px-4 rounded-lg font-medium transition-all hover:border-indigo-300 hover:shadow-sm flex items-center justify-center gap-2 min-h-[52px] group relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-50/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors relative z-10" />
                    <span className="relative z-10 font-semibold text-slate-600 group-hover:text-slate-900">官网直申</span>
                </button>

                {/* Email Apply Button - Only show if company has hiring email */}
                {companyInfo?.hiringEmail && (
                    <div className="flex-1 flex flex-col justify-end relative group/email">
                        <button
                            onClick={() => {
                                if (isMember) {
                                    executeApply('email')
                                } else {
                                    setShowUpgradeModal(true)
                                }
                            }}
                            className={`w-full h-full min-h-[52px] px-4 rounded-lg font-medium transition-all flex flex-col items-center justify-center relative overflow-hidden group/btn shadow-sm ${
                                isMember 
                                    ? 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5' 
                                    : 'bg-gradient-to-r from-slate-100 to-slate-200/80 border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:from-indigo-50 hover:to-indigo-50/50 cursor-pointer'
                            }`}
                        >
                            {isMember ? (
                                <>
                                    <div className="absolute inset-0 bg-white/5 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                                    <div className="flex items-center gap-2 relative z-10">
                                        <Mail className="w-4 h-4" />
                                        <span>邮箱直申 ({companyInfo?.emailType || job.emailType || '通用邮箱'})</span>
                                    </div>
                                </>
                            ) : (
                                <>
                        <div className="flex items-center gap-2 mb-0.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-indigo-500 transition-colors" />
                            <span className="text-slate-600 font-semibold group-hover/btn:text-indigo-600 transition-colors">邮箱直申 (会员)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal group-hover/btn:text-indigo-400 transition-colors">
                            解锁会员专属高效通道
                        </div>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </footer >

            {/* Feedback Modal */}
            {
                isFeedbackOpen && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md mx-4">
                            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                                <h3 className="text-base font-semibold">岗位信息反馈</h3>
                                <button onClick={() => setIsFeedbackOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2">该岗位信息是否准确？</label>
                                    <div className="flex items-center gap-3">
                                        <label className="inline-flex items-center gap-1 text-sm">
                                            <input type="radio" name="accuracy" value="accurate" checked={feedbackAccuracy === 'accurate'} onChange={() => setFeedbackAccuracy('accurate')} />
                                            准确
                                        </label>
                                        <label className="inline-flex items-center gap-1 text-sm">
                                            <input type="radio" name="accuracy" value="inaccurate" checked={feedbackAccuracy === 'inaccurate'} onChange={() => setFeedbackAccuracy('inaccurate')} />
                                            不准确
                                        </label>
                                        <label className="inline-flex items-center gap-1 text-sm">
                                            <input type="radio" name="accuracy" value="unknown" checked={feedbackAccuracy === 'unknown'} onChange={() => setFeedbackAccuracy('unknown')} />
                                            不确定
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">反馈内容</label>
                                    <textarea value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" placeholder="请描述你发现的问题或建议"></textarea>
                                </div>
                                {feedbackMessage && <div className="text-sm text-indigo-600">{feedbackMessage}</div>}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsFeedbackOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                                    <button onClick={submitFeedback} disabled={feedbackSubmitting} className="px-4 py-2 text-sm bg-slate-900 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50">提交</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource="general"
            />
            <ApplyInterceptModal
                isOpen={showApplyInterceptModal}
                onClose={() => setShowApplyInterceptModal(false)}
                job={job}
                companyInfo={companyInfo}
                isMember={isMember}
                onProceedToApply={proceedToApply}
            />
            <ReferralApplicationModal
                isOpen={isReferralModalOpen}
                onClose={() => setIsReferralModalOpen(false)}
                job={job}
                onSubmitSuccess={handleReferralSuccess}
            />
            {/* Share Modal */}
            <ShareJobModal 
                isOpen={isShareModalOpen} 
                onClose={() => setIsShareModalOpen(false)} 
                jobId={job.id}
                jobTitle={job.translations?.title || job.title}
                companyName={job.translations?.company || job.company || ''}
            />

            {/* Apply Selection Modal (Removed as per optimization request) */}
            {/* Direct Apply Buttons integrated below */}
        </div >
    )
}
