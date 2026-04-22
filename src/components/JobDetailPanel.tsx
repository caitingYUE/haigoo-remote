import React, { useState, useMemo, useEffect } from 'react'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Briefcase, X, ChevronRight, ChevronLeft, CheckCircle2, Clock, Mail, Linkedin, Users, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { SingleLineTags } from './SingleLineTags'
import { MembershipUpgradeModal } from './MembershipUpgradeModal'
import { LocationTooltip } from './LocationTooltip'
import { ReferralApplicationModal } from './ReferralApplicationModal'
import { MatchDetailsPanel } from './MatchDetailsPanel'
import { EmailConnectModal } from './EmailConnectModal'
import { trustedCompaniesService, TrustedCompany, ReferralContact } from '../services/trusted-companies-service'
import { processedJobsService } from '../services/processed-jobs-service'
import { useNotificationHelpers } from './NotificationSystem'
import { getJobSourceType } from '../utils/job-source-helper'
import { trackingService } from '../services/tracking-service'
import { ShareJobModal } from './ShareJobModal'
import { resolveMatchLevel } from '../utils/match-display'
import { buildJobDetailSections, type JobDetailBlock } from '../utils/job-detail-content'
import { formatSalaryForDisplay } from '../utils/salary-display'

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
    showInlineNavigation?: boolean
}

type PendingApplyWindow = Window | null

type WebsiteApplyState =
    | 'login_required'
    | 'website_available'
    | 'website_locked_member'
    | 'email_only'
    | 'unavailable'

type ReferralAccessMode =
    | 'unlocked'
    | 'guest'
    | 'member_only'
    | 'free_available'
    | 'free_exhausted'

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
    job,
    onSave,
    isSaved = false,
    onApply,
    onClose,
    showCloseButton = false,
    onNavigateJob,
    canNavigatePrev = false,
    canNavigateNext = false,
    showInlineNavigation = true
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
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)
    const [showTranslation, setShowTranslation] = useState(false)
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [companyOpenJobsCount, setCompanyOpenJobsCount] = useState<number | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)
    const [upgradeTriggerSource, setUpgradeTriggerSource] = useState<'referral' | 'ai_resume' | 'general'>('general')
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)
    const [isReferralModalOpen, setIsReferralModalOpen] = useState(false)
    const [isShareModalOpen, setIsShareModalOpen] = useState(false)
    const [isEmailConnectOpen, setIsEmailConnectOpen] = useState(false)
    const [selectedReferralContact, setSelectedReferralContact] = useState<ReferralContact | null>(null)
    const { showSuccess, showError, showInfo } = useNotificationHelpers()

    const usesCustomReferralContacts = job?.referralContactMode === 'custom'

    const referralContacts = useMemo(() => {
        const source = Array.isArray(companyInfo?.referralContacts) ? companyInfo!.referralContacts : []
        return source.filter(contact => {
            const name = String(contact?.name || '').trim()
            const title = String(contact?.title || '').trim()
            return !!(name && title)
        })
    }, [companyInfo])

    const displayReferralContacts = useMemo(() => {
        if (referralContacts.length > 0) return referralContacts
        if (usesCustomReferralContacts) return []
        const fallbackEmail = String(companyInfo?.hiringEmail || '').trim()
        if (!fallbackEmail) return []
        return [{
            id: `fallback-${job.id}`,
            name: `${job.company || companyInfo?.name || '企业'} 联系人`,
            title: companyInfo?.emailType || job.emailType || '通用邮箱',
            emailType: companyInfo?.emailType || job.emailType || '通用邮箱',
            hiringEmail: fallbackEmail,
            linkedin: '',
        }]
    }, [referralContacts, usesCustomReferralContacts, companyInfo?.hiringEmail, companyInfo?.emailType, job.id, job.company, job.emailType, companyInfo?.name])

    const showReferralModule = displayReferralContacts.length > 0
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
    const [sharedFreeUsageReady, setSharedFreeUsageReady] = useState(false)
    const [websiteApplyUsageReady, setWebsiteApplyUsageReady] = useState(false)
    const exposureKeysRef = React.useRef<Set<string>>(new Set())

    const openUpgradeModal = (featureKey: string, sourceKey = 'job_detail') => {
        trackingService.track('upgrade_modal_view', {
            page_key: 'job_detail',
            module: 'job_detail',
            feature_key: featureKey,
            source_key: sourceKey,
            entity_type: 'job',
            entity_id: job?.id,
        })
        setUpgradeTriggerSource(featureKey === 'referral' ? 'referral' : 'general')
        setShowUpgradeModal(true)
    }

    useEffect(() => {
        // Reset state when job changes
        setIsFeedbackOpen(false)
        setFeedbackAccuracy('unknown')
        setFeedbackContent('')
        setFeedbackMessage('')
        setIsEmailConnectOpen(false)
        setSelectedReferralContact(null)

        const savedPreference = typeof window !== 'undefined' ? localStorage.getItem(translationPreferenceKey) : null
        const shouldShowTranslation = hasTranslation && savedPreference !== 'original'
        setShowTranslation(shouldShowTranslation)

        // Track view job detail
        if (job?.id) {
            exposureKeysRef.current = new Set()
            trackingService.track('view_job_detail', {
                page_key: 'job_detail',
                module: 'job_detail',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                source: sourceType
            })
        }
    }, [job?.id, hasTranslation, translationPreferenceKey, sourceType, job?.title, job?.company])

    useEffect(() => {
        if (!job?.id) return
        const baseProps = {
            page_key: 'job_detail',
            source_key: 'job_detail',
            entity_type: 'job',
            entity_id: job.id,
        }

        const expose = (featureKey: string, extra: Record<string, any> = {}) => {
            const dedupeKey = `${job.id}:${featureKey}:${extra.entity_id || ''}`
            if (exposureKeysRef.current.has(dedupeKey)) return
            exposureKeysRef.current.add(dedupeKey)
            trackingService.featureExposure(featureKey, {
                ...baseProps,
                module: 'job_detail',
                ...extra,
            })
        }

        expose('favorite')
        if (hasTranslation) expose('translation')
        const hasJobScopedEmailPath = !usesCustomReferralContacts && Boolean(companyInfo?.hiringEmail)
        if (job.url || job.sourceUrl || !hasJobScopedEmailPath) expose('website_apply')
        if (job.company || companyInfo?.name) expose('company_info', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
        if (!showReferralModule && hasJobScopedEmailPath) expose('email_apply', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
        if (job.canRefer || showReferralModule) expose('referral', {
            entity_type: 'company',
            entity_id: String(job.company || companyInfo?.name || '').trim(),
        })
    }, [job?.id, hasTranslation, companyInfo?.name, companyInfo?.hiringEmail, showReferralModule, job?.url, job?.sourceUrl, job?.canRefer, usesCustomReferralContacts])

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
                    setSharedFreeUsageReady(true)
                }
                if (waData.success) {
                    syncWebsiteApplyState(waData.usage, waData.unlocked_job_ids || [])
                    setWebsiteApplyUsageReady(true)
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
            setSharedFreeUsageReady(true)
            setWebsiteApplyUsageReady(true)
        } else {
            setSharedFreeUsageReady(false)
            setWebsiteApplyUsageReady(false)
        }
    }, [isAuthenticated, isMember]);

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId, job.id).then(setCompanyInfo).catch(() => setCompanyInfo(null))
        } else {
            setCompanyInfo(null)
        }
    }, [job?.companyId, job?.id])

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

    const matchLevel = useMemo(() => {
        return resolveMatchLevel(job?.matchScore, job?.matchLevel)
    }, [job])
    const isHighDisplayBand = job?.displayBand === 'high'
    const hasHighTrueScore = Number(job?.trueMatchScore || 0) >= 82
    const showHighMatchDetails = isHighDisplayBand && hasHighTrueScore && matchLevel === 'high'
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

    const openPendingWebsiteApplyWindow = (): PendingApplyWindow => {
        const url = String(job?.url || job?.sourceUrl || '').trim()
        if (!url) return null

        const popup = window.open('', '_blank')
        if (!popup) return null

        try {
            popup.opener = null
            popup.document.title = '正在跳转申请页面...'
            popup.document.body.style.margin = '0'
            popup.document.body.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
            popup.document.body.style.display = 'flex'
            popup.document.body.style.alignItems = 'center'
            popup.document.body.style.justifyContent = 'center'
            popup.document.body.style.minHeight = '100vh'
            popup.document.body.style.color = '#475569'
            popup.document.body.innerHTML = '<div style="font-size:14px;">正在打开岗位申请页面...</div>'
        } catch (_error) {
            // Ignore cross-window DOM errors and continue with navigation handoff.
        }

        return popup
    }

    const handleUnlockMatchAnalysis = async () => {
        if (!job?.id || !isAuthenticated || isMember || isMatchAnalysisUnlocked || !canUseMatchAnalysisTrial || unlockingMatchAnalysis) return

        const authToken = localStorage.getItem('haigoo_auth_token')
        if (!authToken) return

        trackingService.featureClick('match_analysis', {
            page_key: 'job_detail',
            module: 'job_detail_match_analysis',
            source_key: 'job_detail',
            entity_type: 'job',
            entity_id: job.id,
        })
        setUnlockingMatchAnalysis(true)
        try {
            const res = await fetch('/api/users?resource=free-usage&type=match-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    jobId: String(job.id),
                    page_key: 'job_detail',
                    source_key: 'job_detail',
                    entity_type: 'job',
                    entity_id: job.id,
                    flow_id: `match_analysis_${job.id}`
                })
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
    const isMemberRestrictedJob = Boolean(job?.memberOnly || companyInfo?.memberOnly);

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

    const promptLogin = (message = '申请职位需要登录\n\n是否前往登录？') => {
        if (window.confirm(message)) {
            navigate('/login')
        }
    }

    const handleApply = async () => {
        trackingService.track('click_apply_init', {
            page_key: 'job_detail',
            module: 'job_detail_apply',
            source_key: 'job_detail',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            source: sourceType,
            is_authenticated: isAuthenticated,
            is_member: isMember
        })

        // 0. Enforce Login first
        if (!isAuthenticated) {
            promptLogin()
            return
        }

        if (isMemberRestrictedJob && !isMember) {
            openUpgradeModal('member_only_job_apply', 'job_detail_apply_member_only')
            return
        }

        const hasWebsiteApply = Boolean(job.url || job.sourceUrl)
        const hasEmailApply = !usesCustomReferralContacts && Boolean(companyInfo?.hiringEmail)
        const websiteApplyUnlocked = isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || ''))
        const canWebsiteApplyFree = !isMember && !websiteApplyUnlocked && websiteApplyUsageCount < WEBSITE_APPLY_FREE_LIMIT
        const canUseWebsiteApply = isMember || websiteApplyUnlocked || canWebsiteApplyFree

        if (hasWebsiteApply) {
            if (!canUseWebsiteApply) {
                openUpgradeModal('website_apply', 'job_detail_apply_direct')
                return
            }
            await executeApply('website', openPendingWebsiteApplyWindow())
            return
        }

        if (!showReferralModule && hasEmailApply) {
            const accessCompanyName = String(job.company || companyInfo?.name || '').trim()
            const isCompanyAccessUnlocked = isMember || (!isMemberRestrictedJob && unlockedCompanies.includes(accessCompanyName))
            const canEmailFree = !isMember && !isMemberRestrictedJob && isAuthenticated && !isCompanyAccessUnlocked && emailApplyUsageCount < FREE_FEATURE_LIMIT
            const canUseEmailApply = isMember || isCompanyAccessUnlocked || canEmailFree

            if (!canUseEmailApply) {
                openUpgradeModal(isMemberRestrictedJob ? 'member_only_job_apply' : 'email_apply', 'job_detail_apply_email')
                return
            }
            await executeApply('email')
            return
        }

        if (showReferralModule) {
            showInfo('仅支持邮箱申请', '该岗位不支持官网网申，请使用上方联系人入口继续申请。')
            return
        }

        if (job.canRefer) {
            if (isMember) {
                setIsReferralModalOpen(true)
                return
            }
            openUpgradeModal('referral', 'job_detail_apply_referral')
            return
        }

        onApply?.(job.id)
    }

    const executeApply = async (method: 'website' | 'email', pendingWindow: PendingApplyWindow = null) => {
        if (method === 'email' && companyInfo?.hiringEmail) {
            trackingService.track('click_apply', {
                page_key: 'job_detail',
                module: 'job_detail_footer',
                feature_key: 'email_apply',
                source_key: 'job_detail',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                apply_method: 'email',
                source: sourceType
            });

            window.location.href = `mailto:${companyInfo.hiringEmail}?subject=${encodeURIComponent(`Application for ${job.title || ''}`)}`;
            trackingService.track('email_apply_success', {
                page_key: 'job_detail',
                module: 'job_detail_footer',
                feature_key: 'email_apply',
                source_key: 'job_detail',
                entity_type: 'job',
                entity_id: job.id,
                job_id: job.id,
                company: job.company,
            })

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
                            notes: 'Applied via Email',
                            source: 'email'
                        })
                    });
                    showSuccess('已为你记录申请，可在「我的投递」查看');
                } catch (error) {
                    console.error('Failed to record interaction:', error);
                }
            }
            return
        }

        const canProceed = await consumeWebsiteApplyIfNeeded()
        if (!canProceed) {
            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.close()
            }
            return
        }

        const url = job.url || job.sourceUrl;

        trackingService.track('click_apply', {
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: url ? 'external_link' : 'internal_apply',
            source: sourceType
        });

        if (url) {
            trackingService.track('click_apply_external', {
                job_id: job.id,
                job_title: job.title,
                company: job.company,
                external_url: url,
                source: sourceType
            });

            if (pendingWindow && !pendingWindow.closed) {
                pendingWindow.location.href = url
            } else {
                window.open(url, '_blank', 'noopener,noreferrer');
            }

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
                            notes: '',
                            source: sourceType
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
    }

    const formatMaskedName = (name?: string) => {
        const normalized = String(name || '').trim()
        if (!normalized) return '＊'
        return normalized.charAt(0).toUpperCase()
    }

    const getReferralEmailActionLabel = (contact: ReferralContact) => {
        const baseLabel = String(contact.emailType || companyInfo?.emailType || job.emailType || '').trim()
        if (!baseLabel) return '邮箱直申'
        return baseLabel.endsWith('邮箱') ? `${baseLabel}直申` : `${baseLabel}邮箱直申`
    }

    const getReferralAvatarLabel = (contact: ReferralContact) => {
        const emailType = String(contact.emailType || '').toLowerCase()
        const title = String(contact.title || '').toLowerCase()
        if (/(hr|talent|people|招聘核心)/i.test(`${emailType} ${title}`)) return 'HR'
        if (/(招聘|recruit|hiring)/i.test(`${emailType} ${title}`)) return 'HIRE'
        if (/(boss|ceo|chief|founder|vp|head|director|决策)/i.test(`${emailType} ${title}`)) return 'BOSS'
        if (/(员工|employee|staff|teammate|partner|manager)/i.test(`${emailType} ${title}`)) return 'TEAM'
        return 'GEN'
    }

    const handleUnlockReferralPreview = async () => {
        const token = localStorage.getItem('haigoo_auth_token');
        const companyName = String(job.company || companyInfo?.name || '').trim()
        if (!token) {
            navigate('/login')
            return
        }
        if (isMemberRestrictedJob && !isMember) {
            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_unlock')
            return
        }
        try {
            const res = await fetch('/api/users?resource=free-usage&type=referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    companyName,
                    page_key: 'job_detail',
                    source_key: 'job_detail_referral_preview',
                    entity_type: 'company',
                    entity_id: companyName,
                    flow_id: `referral_preview_${job.id}`
                })
            });
            const data = await res.json();
            if (data.success) {
                syncSharedFreeAccessState(data.usage, data.unlocked_companies || []);
                showSuccess('已解锁该企业人脉', `当前还可免费查看 ${Math.max(0, FREE_FEATURE_LIMIT - (Number(data.usage) || 0))} 次`)
                if (data.remaining === 0) showInfo('免费次数已用完', '升级会员解锁全部人脉');
            } else {
                showError('解锁失败', data.error || '服务器错误');
            }
        } catch (err) {
            showError('解锁失败', '网络错误');
        }
    }

    const goToMembershipPayment = (featureKey = 'referral', sourceKey = 'job_detail_referral') => {
        trackingService.track('upgrade_cta_click', {
            page_key: 'job_detail',
            module: 'job_detail_referral',
            feature_key: featureKey,
            source_key: sourceKey,
            entity_type: 'job',
            entity_id: job?.id,
        })
        openUpgradeModal(featureKey, sourceKey)
    }

    const openReferralEmailAssistant = (contact: ReferralContact) => {
        const refCompanyName = job.company || companyInfo?.name || ''
        const isReferralUnlocked = isMember || unlockedCompanies.includes(refCompanyName)
        if (!isAuthenticated) {
            promptLogin('登录后可查看联系人并继续申请\n\n是否前往登录？')
            return
        }

        if (!isReferralUnlocked) {
            goToMembershipPayment('referral', 'job_detail_referral_locked_apply')
            return
        }

        const email = String(contact?.hiringEmail || '').trim()
        if (!email) {
            showError('该联系人暂未配置工作邮箱')
            return
        }

        trackingService.featureClick('referral', {
            page_key: 'job_detail',
            module: 'job_detail_referral',
            source_key: 'job_detail',
            entity_type: 'company',
            entity_id: refCompanyName,
        })
        setSelectedReferralContact(contact)
        setIsEmailConnectOpen(true)
    }

    const toSafeExternalUrl = (url?: string) => {
        const raw = String(url || '').trim()
        if (!raw) return '#'
        if (/^https?:\/\//i.test(raw)) return raw
        return `https://${raw}`
    }

    const handleReferralEmailOpen = async (contact: ReferralContact, resumeId: string, resumeName: string) => {
        trackingService.track('click_apply', {
            page_key: 'job_detail',
            module: 'job_detail_referral',
            feature_key: 'referral',
            source_key: 'job_detail',
            entity_type: 'job',
            entity_id: job.id,
            job_id: job.id,
            job_title: job.title,
            company: job.company,
            apply_method: 'referral_contact_email',
            source: 'referral'
        })

        if (!isAuthenticated) return

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
                    notes: `Opened referral email template: ${contact.name || ''}${resumeId ? ` | resume: ${resumeName || resumeId}` : ''}`,
                    source: 'referral_contact_email'
                })
            })
            showSuccess('已为你记录申请，可在「我的投递」查看')
        } catch (error) {
            console.error('Failed to record interaction:', error)
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
                body: JSON.stringify({
                    jobId,
                    page_key: 'job_detail',
                    source_key: 'job_detail',
                    entity_type: 'job',
                    entity_id: jobId,
                    flow_id: `website_apply_${jobId}`
                })
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
                openUpgradeModal('website_apply')
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
            page_key: 'job_detail',
            module: 'job_detail_header',
            feature_key: 'favorite',
            source_key: 'job_detail',
            entity_type: 'job',
            entity_id: job.id,
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
    const websiteApplyUnlocked = isMember || unlockedWebsiteApplyJobIds.includes(String(job.id || ''))
    const websiteApplyFreeRemaining = Math.max(0, WEBSITE_APPLY_FREE_LIMIT - websiteApplyUsageCount)
    const canWebsiteApplyFree = !isMember && isAuthenticated && !websiteApplyUnlocked && websiteApplyUsageCount < WEBSITE_APPLY_FREE_LIMIT
    const shouldShowWebsiteApplyTrialStatus = Boolean(job.url || job.sourceUrl) && isAuthenticated && !isMember && !isMemberRestrictedJob && websiteApplyUsageReady
    const refCompanyName = String(job.company || companyInfo?.name || '').trim()
    const isReferralCompanyUnlocked = isMember || (!isMemberRestrictedJob && unlockedCompanies.includes(refCompanyName))
    const referralFreeRemaining = Math.max(0, FREE_FEATURE_LIMIT - referralUsageCount)
    const hasWebsiteApply = Boolean(job.url || job.sourceUrl)
    const hasEmailApply = !usesCustomReferralContacts && Boolean(companyInfo?.hiringEmail)
    const hasAnyEmailPath = hasEmailApply || showReferralModule
    const canUseWebsiteApply = hasWebsiteApply && (isMember || websiteApplyUnlocked || canWebsiteApplyFree)
    const resolveWebsiteApplyState = (): WebsiteApplyState => {
        if (hasWebsiteApply) {
            if (!isAuthenticated) return 'login_required'
            if (canUseWebsiteApply) return 'website_available'
            return 'website_locked_member'
        }
        if (hasAnyEmailPath) return 'email_only'
        return 'unavailable'
    }
    const websiteApplyState = resolveWebsiteApplyState()
    const getReferralAccessMode = (): ReferralAccessMode => {
        if (isReferralCompanyUnlocked) return 'unlocked'
        if (!isAuthenticated) return 'guest'
        if (isMemberRestrictedJob) return 'member_only'
        if (referralUsageCount < FREE_FEATURE_LIMIT) return 'free_available'
        return 'free_exhausted'
    }
    const referralAccessMode = getReferralAccessMode()
    const hasMultipleReferralContacts = displayReferralContacts.length > 1
    const shouldShowUnifiedReferralUnlock = hasMultipleReferralContacts && referralAccessMode !== 'unlocked'
    const getUnifiedReferralUnlockLabel = () => {
        if (referralAccessMode === 'guest') return '登录查看'
        if (referralAccessMode === 'member_only') return 'VIP 解锁'
        if (referralAccessMode === 'free_available') return `一键解锁 ${referralFreeRemaining}/${FREE_FEATURE_LIMIT}`
        if (referralAccessMode === 'free_exhausted') return `一键解锁 ${referralFreeRemaining}/${FREE_FEATURE_LIMIT}`
        return ''
    }
    const handleUnifiedReferralUnlock = (event?: React.MouseEvent) => {
        event?.preventDefault()
        event?.stopPropagation()
        if (referralAccessMode === 'guest') {
            promptLogin('登录后可查看联系人并继续申请\n\n是否前往登录？')
            return
        }
        if (referralAccessMode === 'member_only') {
            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_group')
            return
        }
        if (referralAccessMode === 'free_available') {
            handleUnlockReferralPreview()
            return
        }
        if (referralAccessMode === 'free_exhausted') {
            goToMembershipPayment('referral', 'job_detail_referral_group_exhausted')
        }
    }
    const getApplyButtonLabel = () => {
        switch (websiteApplyState) {
            case 'login_required':
                return '前往申请（需登录）'
            case 'website_available':
                if (isMemberRestrictedJob) return '前往申请 · VIP'
                if (websiteApplyUnlocked && !isMember) return '前往申请（已解锁）'
                return shouldShowWebsiteApplyTrialStatus && !websiteApplyUnlocked
                    ? `前往申请 ${websiteApplyFreeRemaining}/${WEBSITE_APPLY_FREE_LIMIT}`
                    : '前往申请'
            case 'website_locked_member':
                if (isMemberRestrictedJob) return '前往申请 · VIP'
                return `前往申请 ${websiteApplyFreeRemaining}/${WEBSITE_APPLY_FREE_LIMIT}`
            case 'email_only':
                if (!isAuthenticated) return '仅支持邮箱申请（需登录）'
                if (isReferralCompanyUnlocked && !isMember) return '仅支持邮箱申请（已解锁）'
                return isMemberRestrictedJob ? '仅支持邮箱申请 · VIP' : '仅支持邮箱申请'
            default:
                return '暂无申请入口'
        }
    }
    const getApplyButtonClassName = () => {
        switch (websiteApplyState) {
            case 'login_required':
            case 'website_available':
            case 'website_locked_member':
                return 'bg-indigo-600 text-white shadow-[0_20px_36px_-24px_rgba(79,70,229,0.55)] hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-[0_24px_40px_-22px_rgba(79,70,229,0.48)]'
            case 'email_only':
                return 'border border-slate-200 bg-slate-100 text-slate-500 hover:border-slate-300 hover:text-slate-700'
            default:
                return 'border border-slate-200 bg-slate-50 text-slate-400'
        }
    }
    const handleApplyButtonClick = () => {
        trackingService.featureClick('website_apply', {
            page_key: 'job_detail',
            module: 'job_detail_header',
            source_key: 'job_detail_top',
            entity_type: 'job',
            entity_id: job.id
        })

        if (websiteApplyState === 'login_required') {
            promptLogin()
            return
        }

        if (websiteApplyState === 'website_locked_member') {
            openUpgradeModal(isMemberRestrictedJob ? 'member_only_job_apply' : 'website_apply')
            return
        }

        if (websiteApplyState === 'email_only') {
            if (!isAuthenticated) {
                promptLogin('邮箱申请需要登录\n\n是否前往登录？')
                return
            }
            if (!showReferralModule && hasEmailApply) {
                handleApply()
                return
            }
            showInfo('仅支持邮箱申请', '该岗位不支持官网网申，请使用下方联系人入口继续申请。')
            return
        }

        if (websiteApplyState === 'unavailable') {
            showInfo('暂无申请入口', '该岗位暂未配置官网申请或邮箱直申入口。')
            return
        }

        handleApply()
    }
    return (
        <div className="flex flex-col bg-[radial-gradient(circle_at_top,rgba(238,242,255,0.6),transparent_32%),linear-gradient(180deg,#ffffff_0%,#fbfcff_100%)]">
            <header className="relative z-20 flex-shrink-0 border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-6 py-6 backdrop-blur-md">
                <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 rounded-full bg-indigo-100/35 blur-3xl" />
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-[1_1_56%]">
                        <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug tracking-tight">
                                {displayText(job.title, job.translations?.title)}
                            </h1>
                            {hasTranslation && (
                                <button
                                    onClick={() => {
                                        trackingService.featureClick('translation', {
                                            page_key: 'job_detail',
                                            module: 'job_detail_translation',
                                            source_key: 'job_detail',
                                            entity_type: 'job',
                                            entity_id: job.id,
                                        })
                                        const nextShowTranslation = !showTranslation
                                        setShowTranslation(nextShowTranslation)
                                        if (typeof window !== 'undefined') {
                                            localStorage.setItem(translationPreferenceKey, nextShowTranslation ? 'translated' : 'original')
                                        }
                                    }}
                                    className={`inline-flex h-6 items-center justify-center gap-1 rounded-full border px-2 transition-colors ${
                                        showTranslation
                                            ? 'border-indigo-200 bg-indigo-50 text-indigo-600'
                                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
                                    }`}
                                    title={showTranslation ? '当前为中文，点击恢复原文' : '当前为原文，点击切换中文'}
                                >
                                    <span className={`leading-none ${showTranslation ? 'text-[12px] font-bold text-indigo-700' : 'text-[8px] font-semibold text-slate-400'}`}>中</span>
                                    <span className="text-[9px] text-slate-300">/</span>
                                    <span className={`leading-none ${showTranslation ? 'text-[8.5px] font-semibold text-slate-400' : 'text-[11px] font-bold text-slate-700'}`}>EN</span>
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="relative z-20 flex flex-shrink-0 items-center gap-3">
                        <div className="relative z-20 flex flex-shrink-0 items-center gap-2">
                            <button
                                onClick={handleSave}
                                className={`relative z-10 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border transition-all ${
                                    isSaved
                                        ? 'border-indigo-200 bg-indigo-50 text-indigo-600 shadow-[0_14px_26px_-20px_rgba(79,70,229,0.45)]'
                                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900 hover:shadow-[0_14px_26px_-20px_rgba(15,23,42,0.24)]'
                                }`}
                                title={isSaved ? '取消收藏' : '收藏'}
                            >
                                <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                            </button>

                            <button
                                onClick={handleShare}
                                className="relative z-10 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-all hover:border-slate-300 hover:text-slate-900 hover:shadow-[0_14px_26px_-20px_rgba(15,23,42,0.24)]"
                                title="分享"
                            >
                                <Share2 className="h-4 w-4" />
                            </button>
                        </div>

                        {(hasWebsiteApply || hasAnyEmailPath || onApply) && (
                            <>
                                <div className="h-9 w-px flex-shrink-0 bg-slate-200/80" />
                                <button
                                    onClick={handleApplyButtonClick}
                                    className={`group relative z-10 isolate inline-flex min-w-[132px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl px-5 py-3 text-[15px] font-bold transition-all duration-200 ${getApplyButtonClassName()}`}
                                    title={getApplyButtonLabel()}
                                >
                                    <div className="pointer-events-none absolute inset-0 -translate-x-[100%] skew-x-12 bg-white/10 transition-transform duration-500 group-hover:translate-x-[100%]" />
                                    <span className="relative z-10 inline-flex items-center gap-2 whitespace-nowrap">
                                        <span>{getApplyButtonLabel()}</span>
                                    </span>
                                </button>
                            </>
                        )}

                        {showCloseButton && showInlineNavigation && (
                            <>
                                <div className="h-9 w-px flex-shrink-0 bg-slate-200/80" />
                                <div className="relative z-20 mr-1 flex flex-shrink-0 items-center gap-1">
                                    <button
                                        onClick={() => onNavigateJob?.('prev')}
                                        disabled={!canNavigatePrev}
                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="上一个岗位"
                                    >
                                        <ChevronLeft className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => onNavigateJob?.('next')}
                                        disabled={!canNavigateNext}
                                        className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                                        title="下一个岗位"
                                    >
                                        <ChevronRight className="w-5 h-5" />
                                    </button>
                                </div>
                            </>
                        )}

                        {showCloseButton && onClose && (
                            <>
                                <div className="h-9 w-px flex-shrink-0 bg-slate-200/80" />
                                <button
                                    onClick={onClose}
                                    className="relative z-20 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
                                    title="关闭"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Meta row — single compact line */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-slate-500">
                    <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-700 truncate max-w-[160px]">{displayText(job.company || '')}</span>
                    </div>

                    <span className="text-slate-200">·</span>

                    <div className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        {(() => {
                            const locText = displayText(job.location || '', job.translations?.location);
                            const isLongText = locText.length > 30;
                            return (
                                <div className="relative">
                                    <span
                                        className={`inline-block truncate align-middle leading-[1.1] max-w-[130px] ${isLongText ? 'cursor-help border-b border-dashed border-slate-300 hover:text-indigo-600 hover:border-indigo-400' : ''}`}
                                        onClick={(e) => { if (isLongText) { e.stopPropagation(); setShowLocationTooltip(!showLocationTooltip); } }}
                                        title={locText}
                                    >{locText}</span>
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
                        <>
                            <span className="text-slate-200">·</span>
                            <div className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                                <span className="truncate max-w-[160px]" title={job.timezone}>{job.timezone}</span>
                            </div>
                        </>
                    )}

                    <span className="text-slate-200">·</span>

                    <div className="flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-slate-800">{formatSalaryForDisplay(job.salary, '薪资面议')}</span>
                    </div>
                </div>
            </header>

            {/* Content - Flat layout, no internal scroll */}
            < main className="flex-1 bg-[linear-gradient(180deg,rgba(255,255,255,0.76),rgba(248,250,252,0.2))] px-6 py-7" >
                <div className="space-y-8">
                    {/* 帮我内推 — placed ABOVE AI match analysis */}
                    {showReferralModule && (
                        <section>
                            <div className="rounded-[28px] border border-slate-200/90 bg-[radial-gradient(circle_at_top_right,rgba(219,234,254,0.55),transparent_30%),linear-gradient(180deg,#ffffff_0%,#fbfdff_100%)] p-5 md:p-6 shadow-[0_28px_72px_-46px_rgba(15,23,42,0.2)]">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="text-[18px] md:text-[20px] font-black tracking-tight text-slate-900">
                                        帮我内推 <span className="font-black text-indigo-600">@{job.company || companyInfo?.name || '该企业'}</span>
                                        </h3>
                                        {shouldShowUnifiedReferralUnlock ? (
                                            <button
                                                type="button"
                                                onClick={handleUnifiedReferralUnlock}
                                                className="inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.48)] transition-colors hover:bg-slate-800"
                                            >
                                                {getUnifiedReferralUnlockLabel()}
                                            </button>
                                        ) : null}
                                    </div>
                                    <p className={`mt-2 text-xs leading-6 text-slate-600 md:text-[13px] ${showCloseButton && !showInlineNavigation ? 'truncate' : ''}`}>
                                        Haigoo 为你找到了本岗位的直接招聘 HR /业务负责人，简历邮件直达关键决策方，申请效率提升3倍
                                    </p>
                                </div>

                                {(() => {
                                    const isReferralUnlocked = isReferralCompanyUnlocked

                                    const contactThemes = [
                                        {
                                            shell: 'border-indigo-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,248,255,0.96))]',
                                            glow: 'from-indigo-500 via-violet-400 to-sky-400',
                                            avatar: 'border-indigo-200 bg-[linear-gradient(135deg,#5b5ff7_0%,#26b8ff_100%)] text-white',
                                            icon: 'border-indigo-100 bg-indigo-50 text-indigo-700',
                                            chip: 'border-indigo-100 bg-indigo-50 text-indigo-700'
                                        },
                                        {
                                            shell: 'border-sky-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,250,255,0.96))]',
                                            glow: 'from-sky-500 via-cyan-400 to-teal-400',
                                            avatar: 'border-sky-200 bg-[linear-gradient(135deg,#1d9bf0_0%,#4dd4ff_100%)] text-white',
                                            icon: 'border-sky-100 bg-sky-50 text-sky-700',
                                            chip: 'border-sky-100 bg-sky-50 text-sky-700'
                                        },
                                        {
                                            shell: 'border-emerald-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,252,248,0.96))]',
                                            glow: 'from-emerald-500 via-teal-400 to-cyan-400',
                                            avatar: 'border-emerald-200 bg-[linear-gradient(135deg,#22c55e_0%,#14b8a6_100%)] text-white',
                                            icon: 'border-emerald-100 bg-emerald-50 text-emerald-700',
                                            chip: 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                        },
                                        {
                                            shell: 'border-violet-100/95 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(249,246,255,0.96))]',
                                            glow: 'from-violet-500 via-fuchsia-400 to-pink-400',
                                            avatar: 'border-violet-200 bg-[linear-gradient(135deg,#8b5cf6_0%,#ec4899_100%)] text-white',
                                            icon: 'border-violet-100 bg-violet-50 text-violet-700',
                                            chip: 'border-violet-100 bg-violet-50 text-violet-700'
                                        }
                                    ]

                                    const handleLockedContactClick = (event: React.MouseEvent, mode: 'guest' | 'member_only' | 'free_available' | 'free_exhausted') => {
                                        event.preventDefault()
                                        event.stopPropagation()
                                        if (mode === 'guest') {
                                            promptLogin('登录后可查看联系人并继续申请\n\n是否前往登录？')
                                            return
                                        }
                                        if (mode === 'member_only') {
                                            goToMembershipPayment('member_only_job_apply', 'job_detail_referral_member_only_card')
                                            return
                                        }
                                        if (mode === 'free_available') {
                                            handleUnlockReferralPreview()
                                            return
                                        }
                                        goToMembershipPayment('referral', 'job_detail_referral_exhausted')
                                    }

                                    const shouldUseReferralCarousel = displayReferralContacts.length > 1 || (showCloseButton && !showInlineNavigation)
                                    const referralListClass = shouldUseReferralCarousel
                                        ? 'flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                                        : 'space-y-3'

                                    return (
                                        <div className={`mt-4 ${referralListClass}`}>
                                            {displayReferralContacts.map((contact, index) => {
                                                const theme = contactThemes[index % contactThemes.length]
                                                const isUnlockedCard = referralAccessMode === 'unlocked'
                                                const displayName = isUnlockedCard ? (contact.name || '-') : `${formatMaskedName(contact.name)}*`
                                                const displayTitle = contact.title || 'Hiring Contact'
                                                const avatarLabel = getReferralAvatarLabel(contact)
                                                const shouldShowReferralTrialCount = !isUnlockedCard && isAuthenticated && !isMember && !isMemberRestrictedJob && sharedFreeUsageReady
                                                const emailButtonLabel = isUnlockedCard
                                                    ? !isMember
                                                        ? `${getReferralEmailActionLabel(contact)}（已解锁）`
                                                        : getReferralEmailActionLabel(contact)
                                                    : shouldShowUnifiedReferralUnlock
                                                        ? getUnifiedReferralUnlockLabel()
                                                        : referralAccessMode === 'guest'
                                                            ? '登录查看'
                                                            : referralAccessMode === 'member_only'
                                                                ? 'VIP 解锁'
                                                                : referralAccessMode === 'free_exhausted'
                                                                    ? `一键解锁 ${referralFreeRemaining}/${FREE_FEATURE_LIMIT}`
                                                                    : shouldShowReferralTrialCount
                                                                        ? `${getReferralEmailActionLabel(contact)} ${referralFreeRemaining}/${FREE_FEATURE_LIMIT}`
                                                                        : getReferralEmailActionLabel(contact)

                                                return (
                                                    <div
                                                        key={`ref-contact-${index}`}
                                                        onClick={referralAccessMode === 'guest' ? (event) => handleLockedContactClick(event, 'guest') : undefined}
                                                        className={`relative overflow-hidden rounded-[24px] border ${theme.shell} shadow-[0_24px_50px_-36px_rgba(79,70,229,0.2)] ${
                                                            referralAccessMode === 'guest' ? 'cursor-pointer' : ''
                                                        } ${shouldUseReferralCarousel ? 'min-w-[308px] max-w-[328px] flex-shrink-0 snap-start md:min-w-[320px] md:max-w-[336px]' : ''}`}
                                                    >
                                                        <div className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${theme.glow}`} />
                                                        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.28),transparent_34%,rgba(255,255,255,0.12)_68%,transparent)] opacity-90" />
                                                        <div className="relative p-4">
                                                            <div className="flex items-center gap-3.5">
                                                                <div className={`flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[20px] border text-center font-black uppercase tracking-[-0.02em] shadow-[0_18px_30px_-24px_rgba(79,70,229,0.32)] ${theme.avatar}`}>
                                                                    <span className="block text-[14px] leading-none">{avatarLabel}</span>
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                                                                        <div className="truncate text-[18px] font-black tracking-tight text-slate-900">
                                                                            {displayName}
                                                                        </div>
                                                                        <div className="truncate text-[13px] font-medium text-slate-500">
                                                                            / {displayTitle}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 border-t border-slate-200/70 pt-3">
                                                                <div className="flex items-center gap-2">
                                                                    {contact.linkedin ? (
                                                                        <button
                                                                            type="button"
                                                                            onClick={(event) => {
                                                                                if (!isUnlockedCard) {
                                                                                    handleLockedContactClick(event, referralAccessMode)
                                                                                    return
                                                                                }
                                                                                event.stopPropagation()
                                                                                window.open(toSafeExternalUrl(contact.linkedin), '_blank', 'noopener,noreferrer')
                                                                            }}
                                                                            className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                                                                isUnlockedCard
                                                                                    ? `${theme.icon} shadow-[0_12px_22px_-18px_rgba(79,70,229,0.28)] hover:brightness-95`
                                                                                    : 'border-slate-200 bg-slate-100 text-slate-500'
                                                                            }`}
                                                                            title="LinkedIn"
                                                                        >
                                                                            <Linkedin className="h-4 w-4 shrink-0" />
                                                                        </button>
                                                                    ) : null}

                                                                    <button
                                                                            type="button"
                                                                            onClick={(event) => {
                                                                                if (!isUnlockedCard) {
                                                                                    if (shouldShowUnifiedReferralUnlock) {
                                                                                        handleUnifiedReferralUnlock(event)
                                                                                        return
                                                                                    }
                                                                                    handleLockedContactClick(event, referralAccessMode)
                                                                                    return
                                                                                }
                                                                                event.stopPropagation()
                                                                                openReferralEmailAssistant(contact)
                                                                            }}
                                                                        className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-colors ${
                                                                            isUnlockedCard
                                                                                ? 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.5)] hover:bg-slate-800 hover:border-slate-800'
                                                                                : 'border-slate-900 bg-slate-900 text-white shadow-[0_18px_32px_-24px_rgba(15,23,42,0.4)] hover:bg-slate-800 hover:border-slate-800'
                                                                        }`}
                                                                    >
                                                                        <Mail className="h-4 w-4 shrink-0" />
                                                                        <span className="truncate">
                                                                            {emailButtonLabel}
                                                                        </span>
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })()}
                            </div>
                        </section>
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
                                onShowUpgrade={() => openUpgradeModal('match_analysis')}
                            />
                        </div>
                    )}

                    {/* Job Description Sections */}
                    {jobDetailSections.map((section, index) => (
                        <section key={index} className="last:mb-0 rounded-[26px] border border-slate-100 bg-white/86 px-5 py-5 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.22)]">
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
                        <section className="rounded-[26px] border border-slate-100 bg-white/86 px-5 py-5 shadow-[0_22px_48px_-42px_rgba(15,23,42,0.22)]">
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
                    <section className="pb-2">
                        <div
                            onClick={handleCompanyClick}
                            className="bg-gradient-to-br from-white to-slate-50/60 border border-slate-200 rounded-[24px] p-5 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group/card"
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
                                                <h3 className="text-lg font-bold text-slate-900 transition-colors truncate">
                                                    {displayText(job.company || '')}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap">
                                            <Briefcase className="w-3.5 h-3.5" />
                                            <span>{companyOpenJobCount != null ? `${companyOpenJobCount} 个在招岗位` : '在招岗位统计中'}</span>
                                        </div>
                                    </div>

                                    <div className="mt-2">
                                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    <Users className="w-3 h-3 text-slate-500" />
                                                </div>
                                                <span className="truncate font-medium text-slate-600">
                                                    {companyInfo?.employeeCount || '规模未知'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    <MapPin className="w-3 h-3 text-slate-500" />
                                                </div>
                                                <span className="truncate font-medium text-slate-600" title={companyInfo?.address || '总部未知'}>
                                                    {companyInfo?.address || '总部未知'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    <Calendar className="w-3 h-3 text-slate-500" />
                                                </div>
                                                <span className="font-medium text-slate-600">
                                                    {companyInfo?.foundedYear ? `${companyInfo.foundedYear}年成立` : '年份未知'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                                                    <Building2 className="w-3 h-3 text-slate-500" />
                                                </div>
                                                <span className="font-medium text-slate-600">
                                                    {companyIndustryLabel}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="mt-4 text-sm leading-7 text-slate-600 line-clamp-3">
                                        {companyDescription}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-3 flex items-center justify-end px-1 text-xs text-slate-500">
                                <div className="flex items-center gap-1 font-medium text-indigo-600 transition-transform group-hover:translate-x-1">
                                    查看详情
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>
                    </section>

                </div>
            </main >

            {/* Feedback Modal */}
            {
                isFeedbackOpen && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                        <div className="w-full max-w-[430px] overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-[0_40px_120px_-48px_rgba(15,23,42,0.55)] mx-4">
                            <div className="relative overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#312e81_55%,#155e75_100%)] px-5 py-5 text-white">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                                <div className="relative z-10 flex items-center justify-between">
                                    <div>
                                        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80">岗位反馈</div>
                                        <h3 className="mt-3 text-lg font-bold">告诉我们这条岗位信息是否准确</h3>
                                    </div>
                                    <button onClick={() => setIsFeedbackOpen(false)} className="rounded-full border border-white/12 bg-slate-900/10 p-2 text-white/70 transition-colors hover:bg-white/15 hover:text-white">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="p-5 space-y-4">
                                <p className="text-sm text-slate-500">你的反馈会帮助我们继续优化岗位质量与展示准确度。</p>
                                <div>
                                    <label className="block text-sm font-medium mb-2">该岗位信息是否准确？</label>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="accurate" checked={feedbackAccuracy === 'accurate'} onChange={() => setFeedbackAccuracy('accurate')} />
                                            准确
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="inaccurate" checked={feedbackAccuracy === 'inaccurate'} onChange={() => setFeedbackAccuracy('inaccurate')} />
                                            不准确
                                        </label>
                                        <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm">
                                            <input type="radio" name="accuracy" value="unknown" checked={feedbackAccuracy === 'unknown'} onChange={() => setFeedbackAccuracy('unknown')} />
                                            不确定
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2">反馈内容</label>
                                    <textarea value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm" placeholder="请描述你发现的问题或建议"></textarea>
                                </div>
                                {feedbackMessage && <div className="text-sm text-indigo-600">{feedbackMessage}</div>}
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setIsFeedbackOpen(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">取消</button>
                                    <button onClick={submitFeedback} disabled={feedbackSubmitting} className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg disabled:opacity-50">提交</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource={upgradeTriggerSource}
            />
            <ReferralApplicationModal
                isOpen={isReferralModalOpen}
                onClose={() => setIsReferralModalOpen(false)}
                job={job}
                onSubmitSuccess={handleReferralSuccess}
            />
            <EmailConnectModal
                isOpen={isEmailConnectOpen}
                onClose={() => {
                    setIsEmailConnectOpen(false)
                    setSelectedReferralContact(null)
                }}
                contact={selectedReferralContact}
                job={job}
                onOpenEmail={({ contact, resumeId, resumeName }) => {
                    handleReferralEmailOpen(contact, resumeId, resumeName)
                }}
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
