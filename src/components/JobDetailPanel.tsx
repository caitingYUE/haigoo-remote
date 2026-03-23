import React, { useState, useMemo, useEffect } from 'react'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Briefcase, Zap, MessageSquare, X, ExternalLink, ChevronRight, ChevronLeft, Languages, Shield, Sparkles, Target, Crown, Lock, CheckCircle2, Clock, Mail, Linkedin, Users, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { SingleLineTags } from './SingleLineTags'
import { MembershipUpgradeModal } from './MembershipUpgradeModal'
import { ReferralModal } from './ReferralModal'
import { LocationTooltip } from './LocationTooltip'
import { TrustedStandardsBanner } from './TrustedStandardsBanner'
import { ApplyInterceptModal } from './ApplyInterceptModal'
import { ReferralApplicationModal } from './ReferralApplicationModal'
import { RiskRatingDisplay } from './RiskRatingDisplay'
import { MatchDetailsPanel } from './MatchDetailsPanel'
import { trustedCompaniesService, TrustedCompany, ReferralContact } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { useNotificationHelpers } from './NotificationSystem'
import { getJobSourceType } from '../utils/job-source-helper'
import { trackingService } from '../services/tracking-service'
import { ShareJobModal } from './ShareJobModal'
import { getMatchLevelClassName, getMatchLevelLabel, resolveMatchLevel } from '../utils/match-display'
import { buildJobDetailSections, type JobDetailBlock } from '../utils/job-detail-content'

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
    const [showTranslation, setShowTranslation] = useState(false)
    const [translationUsageCount, setTranslationUsageCount] = useState(0)
    const TRANSLATION_FREE_LIMIT = 100
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [companyOpenJobsCount, setCompanyOpenJobsCount] = useState<number | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
    const [showApplyInterceptModal, setShowApplyInterceptModal] = useState(false)
    const [showApplySelectionModal, setShowApplySelectionModal] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const skipNextWebsiteApplyConsumptionRef = React.useRef(false)
    const { showSuccess, showError, showInfo } = useNotificationHelpers()

    const referralContacts = useMemo(() => {
        const source = Array.isArray(companyInfo?.referralContacts) ? companyInfo!.referralContacts : []
        return source.filter(contact => {
            const name = String(contact?.name || '').trim()
            const title = String(contact?.title || '').trim()
            const hiringEmail = String(contact?.hiringEmail || '').trim()
            const linkedin = String(contact?.linkedin || '').trim()
            return !!(name && title && hiringEmail && linkedin)
        })
    }, [companyInfo])

    const showReferralModule = referralContacts.length > 0
    const translationPreferenceKey = `job_translation_preference_${job?.id || ''}`
    // Free usage quotas for non-members (lifetime cumulative, stored in DB)
    const FREE_FEATURE_LIMIT = 3
    const [companyInfoUsageCount, setCompanyInfoUsageCount] = useState(FREE_FEATURE_LIMIT) // conservative default → locked until loaded
    const [emailApplyUsageCount, setEmailApplyUsageCount] = useState(FREE_FEATURE_LIMIT)   // conservative default
    const [referralUsageCount, setReferralUsageCount] = useState(FREE_FEATURE_LIMIT)        // conservative default
    const [unlockedCompanies, setUnlockedCompanies] = useState<string[]>([])
    const WEBSITE_APPLY_FREE_LIMIT = 20
    const [websiteApplyUsageCount, setWebsiteApplyUsageCount] = useState(WEBSITE_APPLY_FREE_LIMIT)
    const [unlockedWebsiteApplyJobIds, setUnlockedWebsiteApplyJobIds] = useState<string[]>([])
    const [matchAnalysisUsageCount, setMatchAnalysisUsageCount] = useState(FREE_FEATURE_LIMIT)
    const [unlockedMatchAnalysisJobIds, setUnlockedMatchAnalysisJobIds] = useState<string[]>([])
    const [unlockingMatchAnalysis, setUnlockingMatchAnalysis] = useState(false)

    useEffect(() => {
        // Reset state when job changes
        setIsFeedbackOpen(false)
        setFeedbackAccuracy('unknown')
        setFeedbackContent('')
        setFeedbackMessage('')

        const savedPreference = typeof window !== 'undefined' ? localStorage.getItem(translationPreferenceKey) : null
        const shouldShowTranslation = isMember || (savedPreference === 'translated' && hasTranslation)
        setShowTranslation(shouldShowTranslation)

        // Track view job detail
        if (job?.id) {
            trackingService.track('view_job_detail', {
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                source: sourceType
            })
        }
    }, [job?.id, isMember, hasTranslation, translationPreferenceKey])

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

    // Load free feature usage counts from server (company info + email apply + referral)
    useEffect(() => {
        if (isAuthenticated && !isMember) {
            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) return;
            const headers = { 'Authorization': `Bearer ${token}` };
            Promise.all([
                fetch('/api/users?resource=free-usage&type=company-info', { headers }).then(r => r.json()),
                fetch('/api/users?resource=free-usage&type=website-apply', { headers }).then(r => r.json()),
                fetch('/api/users?resource=free-usage&type=match-analysis', { headers }).then(r => r.json()),
            ]).then(([ciData, waData, maData]) => {
                if (ciData.success) {
                    syncSharedFreeAccessState(ciData.usage, ciData.unlocked_companies || []);
                }
                if (waData.success) {
                    syncWebsiteApplyState(waData.usage, waData.unlocked_job_ids || [])
                }
                if (maData.success) {
                    setMatchAnalysisUsageCount(maData.usage);
                    setUnlockedMatchAnalysisJobIds(Array.isArray(maData.unlocked_job_ids) ? maData.unlocked_job_ids.map((item: any) => String(item)) : []);
                }
            }).catch(err => console.error('[free-usage] Failed to load quotas:', err));
        } else if (isMember) {
            // Members have no limits
            syncSharedFreeAccessState(0, []);
            syncWebsiteApplyState(0, [])
            setMatchAnalysisUsageCount(0);
            setUnlockedMatchAnalysisJobIds([]);
        }
    }, [isAuthenticated, isMember]);

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId).then(setCompanyInfo).catch(() => setCompanyInfo(null))
        } else {
            setCompanyInfo(null)
        }
    }, [job?.companyId])

    useEffect(() => {
        let cancelled = false
        const loadCompanyOpenJobsCount = async () => {
            try {
                const jobsQuery = job?.companyId
                    ? { companyId: job.companyId, isApproved: true, skipAggregations: true as const }
                    : { company: job.company, isApproved: true, skipAggregations: true as const }
                const jobsResponse = await processedJobsService.getProcessedJobs(1, 100, jobsQuery)
                if (!cancelled) {
                    setCompanyOpenJobsCount(Array.isArray(jobsResponse.jobs) ? jobsResponse.jobs.length : null)
                }
            } catch (error) {
                if (!cancelled) {
                    setCompanyOpenJobsCount(null)
                }
            }
        }

        if (job?.companyId || job?.company) {
            loadCompanyOpenJobsCount()
        } else {
            setCompanyOpenJobsCount(null)
        }

        return () => {
            cancelled = true
        }
    }, [job?.companyId, job?.company])

    // Member-only fields (from PRD)
    const riskRating = job.riskRating;
    const haigooComment = job.haigooComment;
    const hiddenFields = job.hiddenFields;
    const matchLevel = useMemo(() => {
        return resolveMatchLevel(job?.matchScore, job?.matchLevel)
    }, [job])
    const isHighDisplayBand = job?.displayBand === 'high'
    const hasHighTrueScore = Number(job?.trueMatchScore || 0) >= 82
    const showHighMatchDetails = isHighDisplayBand && hasHighTrueScore && matchLevel === 'high'
    const matchLevelLabel = getMatchLevelLabel(matchLevel)
    const matchLevelClass = getMatchLevelClassName(matchLevel)
    const matchDetails = job?.matchDetails
    const isMatchAnalysisUnlocked = isMember || unlockedMatchAnalysisJobIds.includes(String(job?.id || ''))
    const canUseMatchAnalysisTrial = isAuthenticated && !isMember && !isMatchAnalysisUnlocked && matchAnalysisUsageCount < FREE_FEATURE_LIMIT
    const matchDetailsLocked = Boolean(job?.matchDetailsLocked) && !isMatchAnalysisUnlocked

    const syncSharedFreeAccessState = (usage: number, unlockedCompaniesList: string[] = []) => {
        const normalizedUsage = Math.max(0, Number(usage) || 0)
        const normalizedUnlocked = Array.isArray(unlockedCompaniesList) ? unlockedCompaniesList : []

        setCompanyInfoUsageCount(normalizedUsage)
        setEmailApplyUsageCount(normalizedUsage)
        setReferralUsageCount(normalizedUsage)
        setUnlockedCompanies(normalizedUnlocked)
    }

    const syncWebsiteApplyState = (usage: number, unlockedJobIds: string[] = []) => {
        setWebsiteApplyUsageCount(Math.max(0, Number(usage) || 0))
        setUnlockedWebsiteApplyJobIds(Array.isArray(unlockedJobIds) ? unlockedJobIds.map((item) => String(item)) : [])
    }

    const handleUnlockMatchAnalysis = async () => {
        if (!job?.id || !isAuthenticated || isMember || isMatchAnalysisUnlocked || !canUseMatchAnalysisTrial || unlockingMatchAnalysis) return

        const authToken = localStorage.getItem('haigoo_auth_token')
        if (!authToken) return

        setUnlockingMatchAnalysis(true)
        try {
            const res = await fetch('/api/users?resource=free-usage&type=match-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ jobId: String(job.id) })
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || !data.success) {
                throw new Error(data.error || '解锁失败')
            }

            setMatchAnalysisUsageCount(Number(data.usage) || 0)
            setUnlockedMatchAnalysisJobIds(Array.isArray(data.unlocked_job_ids) ? data.unlocked_job_ids.map((item: any) => String(item)) : [])
            showSuccess('已解锁本次 AI 匹配分析', `本账号还可免费体验 ${Math.max(0, FREE_FEATURE_LIMIT - (Number(data.usage) || 0))} 次`)
        } catch (error: any) {
            showError('解锁失败', error?.message || '请稍后重试')
        } finally {
            setUnlockingMatchAnalysis(false)
        }
    }

    const [logoError, setLogoError] = useState(false);

    useEffect(() => {
        setLogoError(false);
    }, [job?.id]); // Reset error state when job changes

    const jobDetailSections = useMemo(() => {
        const originalDesc = typeof job?.description === 'string' ? job.description : (job?.description ? String(job.description) : '')
        const translatedDesc = typeof job?.translations?.description === 'string' ? job.translations.description : (job?.translations?.description ? String(job.translations.description) : '')

        return buildJobDetailSections({
            description: originalDesc,
            translatedDescription: translatedDesc,
            requirements: job?.requirements || [],
            translatedRequirements: job?.translations?.requirements || [],
            responsibilities: job?.responsibilities || [],
            translatedResponsibilities: job?.translations?.responsibilities || [],
            benefits: job?.benefits || [],
            translatedBenefits: job?.translations?.benefits || [],
            preferTranslated: showTranslation
        })
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
                            type: 'email',
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

        if (skipNextWebsiteApplyConsumptionRef.current) {
            skipNextWebsiteApplyConsumptionRef.current = false
        } else {
            const canProceed = await consumeWebsiteApplyIfNeeded()
            if (!canProceed) {
                return
            }
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

    const formatMaskedName = (name?: string) => {
        const normalized = String(name || '').trim()
        if (!normalized) return '＊'
        return normalized.charAt(0).toUpperCase()
    }

    const goToMembershipPayment = () => {
        navigate('/membership#pricing-plans')
    }

    const applyViaReferralContact = async (contact: ReferralContact) => {
        const refCompanyName = job.company || companyInfo?.name || ''
        const isReferralUnlocked = isMember || unlockedCompanies.includes(refCompanyName)
        if (!isReferralUnlocked) {
            goToMembershipPayment()
            return
        }

        const email = String(contact?.hiringEmail || '').trim()
        if (!email) {
            showError('该联系人暂未配置工作邮箱')
            return
        }

        trackingService.track('click_apply', {
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: 'referral_contact_email'
        })

        window.location.href = `mailto:${email}?subject=${encodeURIComponent(`Application for ${job.title}`)}`

        if (isAuthenticated) {
            try {
                const token = localStorage.getItem('haigoo_auth_token')
                await fetch('/api/user-profile?action=record_interaction', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        jobId: job.id,
                        type: 'email',
                        notes: `Applied via referral contact: ${contact.name || ''}`
                    })
                })
                showSuccess('已为你记录申请，可在「我的投递」查看')
            } catch (error) {
                console.error('Failed to record interaction:', error)
            }
        }
    }

    const toSafeExternalUrl = (url?: string) => {
        const raw = String(url || '').trim()
        if (!raw) return '#'
        if (/^https?:\/\//i.test(raw)) return raw
        return `https://${raw}`
    }

    const proceedToApply = async () => {
        // Check if company has hiring email (regardless of member status)
        if (!showReferralModule && companyInfo?.hiringEmail) {
            setShowApplySelectionModal(true);
        } else {
            executeApply('website');
        }
    }

    const consumeWebsiteApplyIfNeeded = async () => {
        if (!isAuthenticated || isMember || !job?.id) return true

        const jobId = String(job.id)
        if (unlockedWebsiteApplyJobIds.includes(jobId)) return true

        const token = localStorage.getItem('haigoo_auth_token')
        if (!token) return false

        try {
            const data = await fetch('/api/users?resource=free-usage&type=website-apply', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ jobId })
            }).then(async (response) => {
                const payload = await response.json()
                if (!response.ok) {
                    const error = new Error(payload.error || '次数校验失败') as Error & {
                        status?: number
                        payload?: any
                    }
                    error.status = response.status
                    error.payload = payload
                    throw error
                }
                return payload
            })

            syncWebsiteApplyState(data.usage, data.unlocked_job_ids || [])
            return true
        } catch (error) {
            console.error('[free-usage] website-apply consume failed:', error)
            const status = typeof error === 'object' && error && 'status' in error ? Number((error as any).status) : 0
            const payload = typeof error === 'object' && error && 'payload' in error ? (error as any).payload : null

            if (payload && typeof payload.usage !== 'undefined') {
                syncWebsiteApplyState(payload.usage, payload.unlocked_job_ids || [])
            }

            if (status === 403) {
                setShowUpgradeModal(true)
                showInfo('前往申请次数已用完', '升级会员后可继续查看并申请更多岗位')
                return false
            }

            showError('前往申请失败', '请稍后重试')
            return false
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

    const renderSectionBlocks = (blocks: JobDetailBlock[]) => {
        if (!Array.isArray(blocks) || blocks.length === 0) return null

        return blocks.map((block, index) => {
            if (block.type === 'list') {
                const ListTag = block.ordered ? 'ol' : 'ul'
                return (
                    <ListTag
                        key={`list-${index}`}
                        className={`space-y-2 pl-5 text-slate-700 leading-7 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
                    >
                        {block.items.map((item, itemIndex) => (
                            <li key={`item-${index}-${itemIndex}`} className="pl-1 marker:text-slate-400">
                                {renderInlineFormatting(item)}
                            </li>
                        ))}
                    </ListTag>
                )
            }

            if (block.type === 'subheading') {
                return (
                    <h4 key={`subheading-${index}`} className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-500">
                        {renderInlineFormatting(block.text)}
                    </h4>
                )
            }

            if (block.type === 'note') {
                return (
                    <div key={`note-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900">
                        {renderInlineFormatting(block.text)}
                    </div>
                )
            }

            return (
                <p key={`paragraph-${index}`} className="text-slate-700 text-[15px] leading-7 lg:leading-8">
                    {renderInlineFormatting(block.text)}
                </p>
            )
        })
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

    const companyIndustryLabel = companyInfo?.industry || job.companyIndustry || job.category || '未分类'
    const rawCompanyJobCount = Number(companyInfo?.jobCount)
    const trustedCompanyJobCount = Number.isFinite(rawCompanyJobCount) && rawCompanyJobCount > 0 ? rawCompanyJobCount : null
    const companyOpenJobCount = companyOpenJobsCount ?? trustedCompanyJobCount
    const companyDescription = String(companyInfo?.description || '').trim() || '该企业暂无公开简介信息，Haigoo 正在持续补充。'
    const websiteApplyLabel = !isAuthenticated ? '前往申请（需登录）' : '前往申请'

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
                        <span className="font-medium text-slate-700">
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
                                        } catch (e) { }
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
                                        if (window.confirm('登录后可免费试用翻译功能（共100次）\\n\\n是否前往登录？')) {
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
                                                            if (typeof window !== 'undefined') {
                                                                localStorage.setItem(translationPreferenceKey, 'original')
                                                            }
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
                                    const nextShowTranslation = !showTranslation
                                    setShowTranslation(nextShowTranslation)
                                    if (typeof window !== 'undefined') {
                                        localStorage.setItem(translationPreferenceKey, nextShowTranslation ? 'translated' : 'original')
                                    }
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
                                        {TRANSLATION_FREE_LIMIT - translationUsageCount}/100
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

                    {showHighMatchDetails && (
                        <div className="mb-6">
                            <MatchDetailsPanel
                                matchLevel={matchLevel}
                                matchDetails={matchDetails}
                                matchDetailsLocked={matchDetailsLocked}
                                isMember={isMember}
                                canUseFreeTrial={canUseMatchAnalysisTrial}
                                freeTrialRemaining={Math.max(0, FREE_FEATURE_LIMIT - matchAnalysisUsageCount)}
                                isUnlocking={unlockingMatchAnalysis}
                                onUnlockFreeTrial={handleUnlockMatchAnalysis}
                                onShowUpgrade={() => setShowUpgradeModal(true)}
                            />
                        </div>
                    )}

                    {/* Job Description Sections */}
                    {jobDetailSections.map((section, index) => (
                        <section key={index} className="mb-8 last:mb-0">
                            <div className="mb-4 flex items-start gap-3">
                                <div className="w-1.5 h-7 bg-indigo-600 rounded-full mt-0.5"></div>
                                <div className="min-w-0">
                                    <h3 className="text-lg font-bold text-slate-900 leading-7">
                                        {section.displayTitle}
                                    </h3>
                                    {section.rawTitle && section.rawTitle !== section.displayTitle && (
                                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400 break-words">
                                            {section.rawTitle}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="space-y-4">
                                {renderSectionBlocks(section.activeBlocks)}
                            </div>
                        </section>
                    ))}

                    {/* Skills/Tags */}
                    {((job.tags && job.tags.length > 0) || (job.skills && job.skills.length > 0)) && (
                        <section className="py-4 border-b border-slate-100">
                            <h3 className="text-base font-semibold text-slate-900 mb-3">
                                技能要求
                            </h3>
                            <SingleLineTags
                                tags={(Array.isArray(job.tags) && job.tags.length > 0
                                    ? job.tags
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
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-lg font-bold text-slate-900 group-hover/card:text-indigo-600 transition-colors truncate">
                                                    {displayText(job.company || '')}
                                                </h3>
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-semibold">
                                                    {companyIndustryLabel}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-indigo-100 text-indigo-700 text-xs font-semibold whitespace-nowrap">
                                            <Briefcase className="w-3.5 h-3.5" />
                                            <span>{companyOpenJobCount != null ? `${companyOpenJobCount} 个在招岗位` : '在招岗位统计中'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        {/* Enhanced Company Info Grid */}
                                        {(() => {
                                            const companyName = job.company || companyInfo?.name || '';
                                            const isUnlocked = isMember || unlockedCompanies.includes(companyName);
                                            const showInfo = isUnlocked;

                                            const handleUnlock = async (e: React.MouseEvent) => {
                                                e.stopPropagation();
                                                const token = localStorage.getItem('haigoo_auth_token');
                                                if (!token) {
                                                    navigate('/login');
                                                    return;
                                                }
                                                // Call unlock API
                                                try {
                                                    const res = await fetch('/api/users?resource=free-usage&type=company-info', {
                                                        method: 'POST',
                                                        headers: {
                                                            'Content-Type': 'application/json',
                                                            'Authorization': `Bearer ${token}`
                                                        },
                                                        body: JSON.stringify({ companyName })
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        syncSharedFreeAccessState(data.usage, data.unlocked_companies || []);
                                                    } else {
                                                        showError('解锁失败', data.error || '服务器错误');
                                                    }
                                                } catch (err) {
                                                    showError('解锁失败', '网络错误');
                                                }
                                            };

                                            return (
                                                <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-100 shadow-sm relative overflow-hidden">
                                                    {!showInfo && (
                                                        <div
                                                            className="absolute inset-0 bg-white/60 backdrop-blur-[4px] z-10 flex flex-col items-center justify-center text-center p-4 cursor-pointer group/lock"
                                                            onClick={(e) => {
                                                                if (companyInfoUsageCount >= FREE_FEATURE_LIMIT) {
                                                                    e.stopPropagation();
                                                                    setShowUpgradeModal(true);
                                                                }
                                                            }}
                                                        >
                                                            {companyInfoUsageCount < FREE_FEATURE_LIMIT ? (
                                                                <button
                                                                    onClick={handleUnlock}
                                                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 transition-colors"
                                                                >
                                                                    <Crown className="w-3.5 h-3.5" />
                                                                    解锁企业信息 ({FREE_FEATURE_LIMIT - companyInfoUsageCount}/{FREE_FEATURE_LIMIT}次)
                                                                </button>
                                                            ) : (
                                                                <>
                                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                                                                        <Lock className="w-4 h-4 text-slate-400" />
                                                                    </div>
                                                                    <span className="text-slate-500 font-medium">
                                                                        {isAuthenticated ? '免费次数已用完，升级会员查看' : '企业认证信息仅会员可见（登录可免费体验）'}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className={`flex items-center gap-2 ${!showInfo ? 'blur-[4px] opacity-40 select-none' : ''}`}>
                                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                            <Users className="w-3 h-3 text-indigo-600" />
                                                        </div>
                                                        <span className="truncate font-medium text-slate-600">
                                                            {showInfo ? (companyInfo?.employeeCount || '规模未知') : '500-1000人'}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-center gap-2 ${!showInfo ? 'blur-[4px] opacity-40 select-none' : ''}`}>
                                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                            <MapPin className="w-3 h-3 text-indigo-600" />
                                                        </div>
                                                        <span className="truncate font-medium text-slate-600" title={showInfo ? (companyInfo?.address || '总部未知') : ''}>
                                                            {showInfo ? (companyInfo?.address || '总部未知') : '北京市海淀区'}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-center gap-2 ${!showInfo ? 'blur-[4px] opacity-40 select-none' : ''}`}>
                                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                            <Calendar className="w-3 h-3 text-indigo-600" />
                                                        </div>
                                                        <span className="font-medium text-slate-600">
                                                            {showInfo ? (companyInfo?.foundedYear ? `${companyInfo.foundedYear}年成立` : '年份未知') : '2015年成立'}
                                                        </span>
                                                    </div>
                                                    <div className={`flex items-center gap-2 ${!showInfo ? 'blur-[4px] opacity-40 select-none' : ''}`}>
                                                        <div className="w-6 h-6 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                                            <Mail className="w-3 h-3 text-indigo-600" />
                                                        </div>
                                                        <span className="text-indigo-600 font-bold">
                                                            {showInfo ? (companyInfo?.hiringEmail || companyInfo?.emailType || '通用邮箱') : 'HR直招邮箱'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    <p className="mt-4 text-sm leading-7 text-slate-600 line-clamp-3">
                                        {companyDescription}
                                    </p>
                                </div>
                            </div>

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
                        </div>
                    </section>

                    {/* Source Label - Modified: Only show Referral badge as requested */}
                    <div className="flex flex-col items-end pb-4 gap-1">
                        {sourceType === 'referral' ? (
                            <>
                                <div className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md border border-indigo-100">
                                    <Target className="w-3.5 h-3.5" />
                                    邮箱申请 (会员专属)
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

                    {showReferralModule && (
                        <section className="pb-5">
                            <div className="rounded-xl border border-indigo-100/80 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50/40 p-3.5 md:p-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <h3 className="text-[15px] md:text-base font-bold text-slate-900 whitespace-nowrap">帮我内推</h3>
                                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${isMember ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                            <Crown className="w-3 h-3" />
                                            {isMember ? '会员专属功能' : '会员专属功能'}
                                        </div>
                                        {!isAuthenticated && (
                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">（登录可免费体验）</span>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-end">
                                        {!isMember && (
                                            <button
                                                onClick={goToMembershipPayment}
                                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold bg-indigo-600 text-white border border-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm"
                                            >
                                                <Crown className="w-3.5 h-3.5" />
                                                加入 Haigoo，收获企业人脉
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    海狗远程俱乐部帮您找到以下企业联系人，通过联系人工作邮箱申请，让简历更快直达企业内部，提高3x回复率。
                                </p>

                                {/* 免费用户解锁逻辑（复用 unlockedCompanies 机制，与企业认证信息共享解锁状态） */}
                                {(() => {
                                    const refCompanyName = job.company || companyInfo?.name || '';
                                    const isReferralUnlocked = isMember || unlockedCompanies.includes(refCompanyName);

                                    // 未登录：直接渲染锁定状态（无解锁按钮）
                                    if (!isAuthenticated) {
                                        return (
                                            <div className="space-y-2">
                                                {referralContacts.map((contact, index) => (
                                                    <div key={`ref-contact-${index}`} className="rounded-lg border border-slate-200/90 bg-white px-3 py-3 shadow-[0_1px_0_0_rgba(15,23,42,0.03)]">
                                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                                            <div className="min-w-0 space-y-2 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-semibold text-slate-900 max-w-[220px] truncate">
                                                                        {`${formatMaskedName(contact.name)}＊`}
                                                                    </span>
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                                                                        {contact.title || '-'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs max-w-[260px] bg-slate-50 border-slate-200 text-slate-400 blur-[2px] select-none">
                                                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        <span className="truncate">会员可见</span>
                                                                    </div>
                                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-300">
                                                                        <Lock className="w-3.5 h-3.5" />
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => navigate('/login')}
                                                                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-500"
                                                            >
                                                                <Lock className="w-3.5 h-3.5" />
                                                                找TA内推
                                                            </button>
                                                        </div>
                                                        <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">
                                                            登录可免费体验，解锁企业人脉
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    // 已登录免费用户：未解锁 + 有剩余次数 → 显示解锁按钮
                                    if (!isReferralUnlocked && companyInfoUsageCount < FREE_FEATURE_LIMIT) {
                                        return (
                                            <div className="space-y-2">
                                                {/* 解锁提示条 */}
                                                <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 flex items-center justify-between gap-3">
                                                    <div className="text-xs text-indigo-700">
                                                        <span className="font-semibold">免费体验次数</span>：解锁后可查看该企业所有联系人邮箱与 Linkedin
                                                    </div>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            const token = localStorage.getItem('haigoo_auth_token');
                                                            if (!token) { navigate('/login'); return; }
                                                            try {
                                                                const res = await fetch('/api/users?resource=free-usage&type=company-info', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                                    body: JSON.stringify({ companyName: refCompanyName })
                                                                });
                                                                const data = await res.json();
                                                                if (data.success) {
                                                                    syncSharedFreeAccessState(data.usage, data.unlocked_companies || []);
                                                                    if (data.remaining === 0) showInfo('体验次数已用完', '升级会员享受无限次内推');
                                                                } else {
                                                                    showError('解锁失败', data.error || '服务器错误');
                                                                }
                                                            } catch (err) {
                                                                showError('解锁失败', '网络错误');
                                                            }
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors whitespace-nowrap flex-shrink-0"
                                                    >
                                                        <Crown className="w-3.5 h-3.5" />
                                                        免费解锁 ({FREE_FEATURE_LIMIT - companyInfoUsageCount}/{FREE_FEATURE_LIMIT}次)
                                                    </button>
                                                </div>
                                                {/* 模糊预览联系人 */}
                                                {referralContacts.map((contact, index) => (
                                                    <div key={`ref-contact-${index}`} className="rounded-lg border border-slate-200/90 bg-white px-3 py-3 shadow-[0_1px_0_0_rgba(15,23,42,0.03)] opacity-50 pointer-events-none select-none">
                                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                                            <div className="min-w-0 space-y-2 flex-1">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm font-semibold text-slate-900">{`${formatMaskedName(contact.name)}＊`}</span>
                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">{contact.title || '-'}</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs bg-slate-50 border-slate-200 text-slate-400 blur-[2px]">
                                                                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                        <span>会员可见</span>
                                                                    </div>
                                                                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-300"><Lock className="w-3.5 h-3.5" /></span>
                                                                </div>
                                                            </div>
                                                            <button className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold bg-slate-100 text-slate-500">
                                                                <Lock className="w-3.5 h-3.5" />找TA内推
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }

                                    // 已登录免费用户：未解锁 + 无剩余次数 → 升级引导
                                    if (!isReferralUnlocked && companyInfoUsageCount >= FREE_FEATURE_LIMIT) {
                                        return (
                                            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-4 text-center">
                                                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2">
                                                    <Lock className="w-4 h-4 text-amber-600" />
                                                </div>
                                                <p className="text-xs text-amber-800 font-semibold mb-1">免费体验次数已用完</p>
                                                <p className="text-[11px] text-amber-700 mb-3">升级为 Haigoo 会员，享受无限次内推结果查看</p>
                                                <button
                                                    onClick={goToMembershipPayment}
                                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                                                >
                                                    <Crown className="w-3.5 h-3.5" />查看会员权益
                                                </button>
                                            </div>
                                        );
                                    }

                                    // 已解锁（会员 或 免费已解锁该企业）：正常显示所有联系人
                                    return (
                                        <div className="space-y-2">
                                            {referralContacts.map((contact, index) => (
                                                <div key={`ref-contact-${index}`} className="rounded-lg border border-slate-200/90 bg-white px-3 py-3 shadow-[0_1px_0_0_rgba(15,23,42,0.03)]">
                                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2.5">
                                                        <div className="min-w-0 space-y-2 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-semibold text-slate-900 max-w-[220px] truncate">
                                                                    {contact.name || '-'}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                                                                    {contact.title || '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs max-w-[260px] bg-indigo-50 border-indigo-100 text-indigo-700 font-semibold">
                                                                    <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                                                                    <span className="truncate">{contact.hiringEmail || '-'}</span>
                                                                </div>
                                                                <a
                                                                    href={toSafeExternalUrl(contact.linkedin)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                                                    title="打开领英主页"
                                                                >
                                                                    <Linkedin className="w-3.5 h-3.5" />
                                                                </a>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => applyViaReferralContact(contact)}
                                                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap bg-slate-900 text-white hover:bg-indigo-700"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                            邮箱直申
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </div>
                        </section>
                    )}
                </div>
            </main >

            {/* Footer */}
            < footer className={`border-t border-slate-100 bg-white p-4 flex-shrink-0 grid ${(job.url || job.sourceUrl || !companyInfo?.hiringEmail) && companyInfo?.hiringEmail && !showReferralModule ? 'grid-cols-2' : 'grid-cols-1'} gap-3`} >
                {/* Website Apply Button */}
                {(job.url || job.sourceUrl || !companyInfo?.hiringEmail) && (
                    (() => {
                        const websiteApplyUnlocked = isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || ''))
                        const canWebsiteApplyFree = !isMember && isAuthenticated && !websiteApplyUnlocked && websiteApplyUsageCount < WEBSITE_APPLY_FREE_LIMIT
                        const isWebsiteApplyAvailable = isMember || websiteApplyUnlocked || canWebsiteApplyFree

                        return (
                            <button
                                onClick={() => {
                                    if (!isAuthenticated) {
                                        navigate('/login')
                                        return
                                    }
                                    if (!isWebsiteApplyAvailable) {
                                        setShowUpgradeModal(true)
                                        return
                                    }
                                    executeApply('website')
                                }}
                                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all min-h-[52px] group relative overflow-hidden shadow-sm flex items-center justify-center gap-2 ${isMember || isWebsiteApplyAvailable
                                    ? 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                                    : 'bg-gradient-to-r from-slate-100 to-slate-200/80 border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:from-indigo-50 hover:to-indigo-50/50'
                                    }`}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-50/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                                {isMember || isWebsiteApplyAvailable ? (
                                    <>
                                        <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors relative z-10" />
                                        <span className="relative z-10 font-semibold text-slate-600 group-hover:text-slate-900">{websiteApplyLabel}</span>
                                        {!isMember && (
                                            <span className="relative z-10 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold rounded">
                                                {websiteApplyUnlocked ? '已解锁' : `${WEBSITE_APPLY_FREE_LIMIT - websiteApplyUsageCount}/${WEBSITE_APPLY_FREE_LIMIT}`}
                                            </span>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors relative z-10" />
                                        <span className="relative z-10 font-semibold text-slate-600 group-hover:text-indigo-600">前往申请</span>
                                        <span className="relative z-10 text-[10px] text-slate-400">体验次数已用完</span>
                                    </>
                                )}
                            </button>
                        )
                    })()
                )}

                {/* Email Apply Button - Only show if company has hiring email */}
                {!showReferralModule && companyInfo?.hiringEmail && (
                    <div className="flex-1 flex flex-col justify-end relative group/email">
                        {(() => {
                            const accessCompanyName = String(job.company || companyInfo?.name || '').trim();
                            const isCompanyAccessUnlocked = isMember || unlockedCompanies.includes(accessCompanyName);
                            const canEmailFree = !isMember && isAuthenticated && !isCompanyAccessUnlocked && emailApplyUsageCount < FREE_FEATURE_LIMIT;
                            const isEmailUnlocked = isMember || isCompanyAccessUnlocked || canEmailFree;
                            return (
                                <button
                                    onClick={async () => {
                                        if (!isAuthenticated) {
                                            if (window.confirm('申请职位需要登录\n\n是否前往登录？')) navigate('/login');
                                            return;
                                        }
                                        if (isEmailUnlocked) {
                                            // Consume one shared free use only when this company has not been unlocked yet
                                            if (!isMember && !isCompanyAccessUnlocked) {
                                                const token = localStorage.getItem('haigoo_auth_token');
                                                if (token) {
                                                    try {
                                                        const data = await fetch('/api/users?resource=free-usage&type=email-apply', {
                                                            method: 'POST',
                                                            headers: {
                                                                'Authorization': `Bearer ${token}`,
                                                                'Content-Type': 'application/json'
                                                            },
                                                            body: JSON.stringify({ companyName: accessCompanyName })
                                                        }).then(r => r.json());
                                                        if (data.success) {
                                                            syncSharedFreeAccessState(data.usage, data.unlocked_companies || []);
                                                            if (data.remaining === 0) showInfo('体验次数已用完', '升级会员享受无限邮箱直申');
                                                        } else {
                                                            throw new Error(data.error || '解锁失败');
                                                        }
                                                    } catch (e) {
                                                        console.error('[free-usage] email-apply consume failed:', e);
                                                        showError('邮箱直申解锁失败', '请稍后重试');
                                                        return;
                                                    }
                                                }
                                            }
                                            executeApply('email');
                                        } else {
                                            setShowUpgradeModal(true);
                                        }
                                    }}
                                    className={`w-full h-full min-h-[52px] px-4 rounded-lg font-medium transition-all flex flex-col items-center justify-center relative overflow-hidden group/btn shadow-sm ${
                                        isMember
                                            ? 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5'
                                            : isEmailUnlocked
                                                ? 'bg-slate-900 text-white hover:bg-slate-800 hover:shadow-md hover:-translate-y-0.5'
                                                : 'bg-gradient-to-r from-slate-100 to-slate-200/80 border border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:from-indigo-50 hover:to-indigo-50/50 cursor-pointer'
                                    }`}
                                >
                                    {isEmailUnlocked ? (
                                        <>
                                            <div className="absolute inset-0 bg-white/5 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300"></div>
                                            <div className="flex items-center gap-2 relative z-10">
                                                <Mail className="w-4 h-4" />
                                                <span>邮箱直申 ({companyInfo?.emailType || job.emailType || '通用邮箱'})</span>
                                                {!isMember && (
                                                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-200 text-xs font-bold rounded">
                                                        {isCompanyAccessUnlocked ? '已解锁' : `${FREE_FEATURE_LIMIT - emailApplyUsageCount}/${FREE_FEATURE_LIMIT}`}
                                                    </span>
                                                )}
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <Lock className="w-3.5 h-3.5 text-slate-400 group-hover/btn:text-indigo-500 transition-colors" />
                                                <span className="text-slate-600 font-semibold group-hover/btn:text-indigo-600 transition-colors">邮箱直申</span>
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-normal group-hover/btn:text-indigo-400 transition-colors">
                                                {isAuthenticated ? '体验次数已用完，升级会员' : '会员专属功能'}
                                            </div>
                                        </>
                                    )}
                                </button>
                            );
                        })()}
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
                referralUsageCount={referralUsageCount}
                referralUnlocked={Boolean(isMember || unlockedCompanies.includes(String(job.company || companyInfo?.name || '').trim()))}
                FREE_FEATURE_LIMIT={FREE_FEATURE_LIMIT}
                websiteApplyUsageCount={websiteApplyUsageCount}
                websiteApplyUnlocked={Boolean(isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || '')))}
                websiteApplyLimit={WEBSITE_APPLY_FREE_LIMIT}
                onConsumeWebsiteApply={async () => {
                    const ok = await consumeWebsiteApplyIfNeeded()
                    if (ok) {
                        skipNextWebsiteApplyConsumptionRef.current = true
                    }
                    return ok
                }}
                onConsumeReferral={async () => {
                    const token = localStorage.getItem('haigoo_auth_token');
                    if (!token) return;
                    try {
                        const data = await fetch('/api/users?resource=free-usage&type=referral', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({ companyName: String(job.company || companyInfo?.name || '').trim() })
                        }).then(r => r.json());
                        if (data.success) {
                            syncSharedFreeAccessState(data.usage, data.unlocked_companies || []);
                            if (data.remaining === 0) showInfo('内推体验次数已用完', '升级会员享受无限次内推');
                        }
                    } catch (e) {
                        console.error('[free-usage] referral consume failed:', e);
                    }
                }}
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
