import React, { useState, useMemo, useEffect } from 'react'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Zap, MessageSquare, X, ExternalLink, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { segmentJobDescription } from '../utils/translation'
import { SingleLineTags } from './SingleLineTags'
import { MembershipUpgradeModal } from './MembershipUpgradeModal'
// import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

interface JobDetailPanelProps {
    job: Job
    onSave?: (jobId: string) => void
    isSaved?: boolean
    onApply?: (jobId: string) => void
    onClose?: () => void
    showCloseButton?: boolean
}

export const JobDetailPanel: React.FC<JobDetailPanelProps> = ({
    job,
    onSave,
    isSaved = false,
    onApply,
    onClose,
    showCloseButton = false
}) => {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [feedbackAccuracy, setFeedbackAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
    const [feedbackContent, setFeedbackContent] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackMessage, setFeedbackMessage] = useState('')
    const [showTranslation, setShowTranslation] = useState(true)
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)
    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null)
    const [showUpgradeModal, setShowUpgradeModal] = useState(false)

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId).then(setCompanyInfo).catch(() => setCompanyInfo(null))
        } else {
            setCompanyInfo(null)
        }
    }, [job?.companyId])

    const jobDescriptionData = useMemo(() => {
        const descToUse = showTranslation && job?.translations?.description
            ? job.translations.description
            : job?.description
        const desc = typeof descToUse === 'string' ? descToUse as string : (descToUse ? String(descToUse) : '')
        return segmentJobDescription(desc)
    }, [job, showTranslation])

    const handleApply = () => {
        // 检查会员权限
        if (job.canRefer) {
             const isMember = user?.membershipLevel && user.membershipLevel !== 'none' && user.membershipExpireAt && new Date(user.membershipExpireAt) > new Date();
             if (!isMember) {
                 setShowUpgradeModal(true)
                 return;
             }
        }

        if (job.sourceUrl) {
            window.open(job.sourceUrl, '_blank', 'noopener,noreferrer')
        } else {
            onApply?.(job.id)
        }
    }

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: `${job.title} - ${job.company || ''}`,
                    text: `查看这个职位：${job.title} at ${job.company || ''}`,
                    url: window.location.href
                })
            } else {
                await navigator.clipboard.writeText(window.location.href)
            }
        } catch (error) {
            console.error('分享失败:', error)
        }
    }

    const handleSave = () => {
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
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-slate-100 px-6 py-4">
                <div className="flex items-start justify-between mb-2">
                    <h1 className="text-xl font-bold text-slate-900 flex-1 pr-4">
                        {displayText(job.title, job.translations?.title)}
                    </h1>
                    {showCloseButton && onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-all"
                            aria-label="关闭"
                        >
                            <X className="h-4 w-4 text-slate-500" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600 mb-3">
                    <div className="flex items-center gap-1.5">
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium">{displayText(job.company || '')}</span>
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>{displayText(job.location || '', job.translations?.location)}</span>
                    </div>
                </div>

                {typeof job.salary === 'object' && job.salary.min > 0 && (
                    <div className="flex items-center gap-2 mb-3">
                        <DollarSign className="w-4 h-4 text-orange-600" />
                        <span className="font-semibold text-orange-600">
                            {job.salary.currency}{job.salary.min.toLocaleString()} - {job.salary.currency}{job.salary.max.toLocaleString()}
                        </span>
                    </div>
                )}
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                <div className="px-6">
                    {/* Job Description Sections */}
                    {jobDescriptionData.sections.map((section, index) => (
                        <section key={index} className="py-4 border-b border-slate-100">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-base font-semibold text-slate-900">
                                    {displayText(section.title)}
                                </h3>
                                {/* Action buttons on first section */}
                                {index === 0 && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleShare}
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-all"
                                            title="分享"
                                        >
                                            <Share2 className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={handleSave}
                                            className={`p-1.5 rounded transition-all ${isSaved
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'hover:bg-slate-100 text-slate-500'
                                                }`}
                                            title={isSaved ? '已收藏' : '收藏'}
                                        >
                                            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                                        </button>

                                        {hasTranslation && (
                                            <button
                                                onClick={() => setShowTranslation(!showTranslation)}
                                                className={`px-2 py-1 rounded text-xs font-medium transition-all ${showTranslation
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'hover:bg-slate-100 text-slate-600'
                                                    }`}
                                                title={showTranslation ? '切换到原文' : '切换到翻译'}
                                            >
                                                {showTranslation ? '译' : '原'}
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setIsFeedbackOpen(true)}
                                            className="p-1.5 hover:bg-slate-100 text-slate-500 rounded transition-all"
                                            title="反馈"
                                        >
                                            <MessageSquare className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="text-slate-600 text-sm leading-relaxed">
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
                            className="border border-slate-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-start gap-4 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
                                    <span className="text-white font-bold text-lg">
                                        {(job.company || '未知公司').charAt(0)}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-base font-semibold text-slate-900 mb-1">
                                        {displayText(job.company || '')}
                                    </h3>
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <span>{companyInfo?.industry || job.category || '未分类'}</span>
                                        {job.sourceUrl && (
                                            <>
                                                <span className="text-slate-400">•</span>
                                                <a
                                                    href={job.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ExternalLink className="w-3 h-3" />
                                                    查看原始岗位
                                                </a>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">查看企业详情及更多岗位</span>
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-100 bg-white p-4 flex-shrink-0">
                <button
                    onClick={handleApply}
                    className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-3 px-6 rounded-lg font-medium transition-all hover:shadow-md flex items-center justify-center gap-2"
                >
                    <Zap className="w-4 h-4" />
                    前往申请，Go！
                </button>
            </footer>

            {/* Feedback Modal */}
            {isFeedbackOpen && (
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
                            {feedbackMessage && <div className="text-sm text-blue-600">{feedbackMessage}</div>}
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsFeedbackOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">取消</button>
                                <button onClick={submitFeedback} disabled={feedbackSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">提交</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <MembershipUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                triggerSource="referral"
            />
        </div>
    )
}
