import React, { useState, useMemo, useEffect } from 'react'
import { Share2, Bookmark, MapPin, DollarSign, Building2, Zap, MessageSquare, X, ExternalLink, ChevronRight, ChevronLeft, Languages } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { segmentJobDescription } from '../utils/translation'
import { SingleLineTags } from './SingleLineTags'
import { MembershipUpgradeModal } from './MembershipUpgradeModal'
import { LocationTooltip } from './LocationTooltip'
// import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

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
    const [showLocationTooltip, setShowLocationTooltip] = useState(false)

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId).then(setCompanyInfo).catch(() => setCompanyInfo(null))
        } else {
            setCompanyInfo(null)
        }
    }, [job?.companyId])

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
        <div className="flex flex-col bg-white">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
                <div className="flex items-start justify-between mb-3">
                    <h1 className="text-2xl font-bold text-slate-900 flex-1 pr-4">
                        {displayText(job.title, job.translations?.title)}
                    </h1>

                    <div className="flex items-center gap-2">
                        {onNavigateJob && (
                            <>
                                <button
                                    onClick={() => onNavigateJob('prev')}
                                    disabled={!canNavigatePrev}
                                    className={`p-2 rounded-lg transition-all flex items-center justify-center border ${canNavigatePrev
                                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                        }`}
                                    title="上一个职位"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => onNavigateJob('next')}
                                    disabled={!canNavigateNext}
                                    className={`p-2 rounded-lg transition-all flex items-center justify-center border ${canNavigateNext
                                        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'
                                        }`}
                                    title="下一个职位"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                                {showCloseButton && <div className="w-px h-6 bg-slate-200 mx-1"></div>}
                            </>
                        )}

                        {showCloseButton && onClose && (
                            <button
                                onClick={onClose}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-all flex items-center gap-2"
                            >
                                <X className="h-4 w-4" />
                                <span>关闭</span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 text-sm text-slate-600 mb-4">
                    <div 
                        className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600 transition-colors"
                        onClick={() => {
                            const url = job.companyWebsite || job.sourceUrl
                            if (url) {
                                window.open(url, '_blank', 'noopener,noreferrer')
                            }
                        }}
                    >
                        <Building2 className="w-4 h-4" />
                        <span className="font-medium hover:underline">{displayText(job.company || '')}</span>
                        {(job.companyWebsite || job.sourceUrl) && <ExternalLink className="w-3 h-3 ml-0.5" />}
                    </div>
                    <span className="text-slate-300">|</span>
                    <div className="flex items-center gap-1.5 relative group">
                        <MapPin className="w-4 h-4 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setShowLocationTooltip(!showLocationTooltip)
                            }}
                            className="hover:text-indigo-600 hover:underline decoration-dashed underline-offset-4 transition-colors text-left"
                        >
                            {displayText(job.location || '', job.translations?.location)}
                        </button>
                        {showLocationTooltip && (
                            <div className="absolute top-full left-0 mt-2 z-50">
                                <LocationTooltip
                                    location={job.location || ''}
                                    onClose={() => setShowLocationTooltip(false)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {job.salary && typeof job.salary === 'object' && job.salary.min > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="w-4 h-4 text-indigo-600" />
                        <span className="font-semibold text-indigo-600">
                            {job.salary.currency}{job.salary.min.toLocaleString()} - {job.salary.currency}{job.salary.max.toLocaleString()}
                        </span>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <button
                        onClick={handleShare}
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all flex items-center gap-1.5"
                        title="分享"
                    >
                        <Share2 className="w-4 h-4" />
                        <span className="text-sm">分享</span>
                    </button>

                    <button
                        onClick={handleSave}
                        className={`p-2 rounded-lg transition-all flex items-center gap-1.5 ${isSaved
                            ? 'bg-indigo-50 text-indigo-600'
                            : 'hover:bg-slate-100 text-slate-600'
                            }`}
                        title={isSaved ? '已收藏' : '收藏'}
                    >
                        <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                        <span className="text-sm">{isSaved ? '已收藏' : '收藏'}</span>
                    </button>

                    {/* Translation Toggle - Inline with actions */}
                    {hasTranslation && (
                        <button
                            onClick={() => setShowTranslation(!showTranslation)}
                            className={`p-2 rounded-lg transition-all flex items-center gap-1.5 ${showTranslation
                                ? 'text-indigo-600 font-medium'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            title={showTranslation ? '切换到原文' : '切换到翻译'}
                        >
                            <Languages className="w-4 h-4" />
                            <span className="text-sm">{showTranslation ? '译' : '原'}</span>
                        </button>
                    )}

                    <button
                        onClick={() => setIsFeedbackOpen(true)}
                        className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all flex items-center gap-1.5"
                        title="反馈"
                    >
                        <MessageSquare className="w-4 h-4" />
                        <span className="text-sm">反馈</span>
                    </button>
                </div>
            </header>

            {/* Content - Flat layout, no internal scroll */}
            <main className="flex-1 px-6 py-6">
                <div>
                    {/* Job Description Sections */}
                    {jobDescriptionData.sections.map((section, index) => (
                        <section key={index} className="mb-6">
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">
                                {displayText(section.title)}
                            </h3>
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
                            className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                            <div className="flex items-start gap-4 mb-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0">
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
                                                    className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
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
            </main >

            {/* Footer */}
            < footer className="border-t border-slate-100 bg-white p-4 flex-shrink-0" >
                <button
                    onClick={handleApply}
                    className="w-full bg-slate-900 hover:bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium transition-all hover:shadow-md flex items-center justify-center gap-2"
                >
                    <Zap className="w-4 h-4" />
                    前往申请，Go！
                </button>
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
                triggerSource="referral"
            />
        </div >
    )
}
