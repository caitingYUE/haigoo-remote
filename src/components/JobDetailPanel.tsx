import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Share2, Bookmark, MapPin, Clock, DollarSign, Building2, Zap, MessageSquare, Globe, X } from 'lucide-react'
import { Job } from '../types'
import { segmentJobDescription } from '../utils/translation'
import { SingleLineTags } from './SingleLineTags'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'

interface JobDetailPanelProps {
    job: Job
    onSave?: (jobId: string) => void
    isSaved?: boolean
    onApply?: (jobId: string) => void
    onClose?: () => void // Optional, for mobile modal close button
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
    const [activeTab, setActiveTab] = useState<'description' | 'company' | 'openings'>('description')
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
    const [feedbackAccuracy, setFeedbackAccuracy] = useState<'accurate' | 'inaccurate' | 'unknown'>('unknown')
    const [feedbackContent, setFeedbackContent] = useState('')
    const [feedbackContact, setFeedbackContact] = useState('')
    const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
    const [feedbackMessage, setFeedbackMessage] = useState('')

    // 语言切换状态：true = 显示翻译，false = 显示原文
    const [showTranslation, setShowTranslation] = useState(true)

    // 检查是否有翻译内容
    const hasTranslation = !!(job?.translations?.title || job?.translations?.description)

    const [companyInfo, setCompanyInfo] = useState<TrustedCompany | null>(null);
    const [companyJobs, setCompanyJobs] = useState<Job[]>([])
    const [companyLoading, setCompanyLoading] = useState<boolean>(false)
    const [companyError, setCompanyError] = useState<string | null>(null)

    useEffect(() => {
        if (job?.companyId) {
            trustedCompaniesService.getCompanyById(job.companyId).then(setCompanyInfo).catch(() => setCompanyInfo(null));
        } else {
            setCompanyInfo(null);
        }
    }, [job?.companyId]);

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if (!job?.company) { setCompanyJobs([]); return }
            setCompanyLoading(true)
            setCompanyError(null)
            try {
                const resp = await processedJobsService.getProcessedJobs(1, 10, { company: job.company })
                const others = resp.jobs.filter(j => j.id !== job.id)
                if (!cancelled) setCompanyJobs(others)
            } catch (e: any) {
                if (!cancelled) setCompanyError(String(e?.message || e))
            } finally {
                if (!cancelled) setCompanyLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [job?.company, job?.id])

    // Reset tab when job changes
    useEffect(() => {
        setActiveTab('description')
        setIsFeedbackOpen(false)
    }, [job.id])

    const jobDescriptionData = useMemo(() => {
        // 根据语言切换状态选择描述
        const descToUse = showTranslation && job?.translations?.description
            ? job.translations.description
            : job?.description
        const desc = typeof descToUse === 'string' ? descToUse as string : (descToUse ? String(descToUse) : '')
        return segmentJobDescription(desc)
    }, [job, showTranslation])

    const handleApply = () => {
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
                // 这里可以添加一个 toast 提示
            }
        } catch (error) {
            console.error('分享失败:', error)
        }
    }

    const handleSave = () => {
        onSave?.(job.id)
    }

    const openFeedback = () => {
        setIsFeedbackOpen(true)
        setFeedbackMessage('')
    }

    const closeFeedback = () => {
        setIsFeedbackOpen(false)
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
                    contact: feedbackContact,
                    source: job.source || '',
                    sourceUrl: job.sourceUrl || ''
                })
            })
            const data = await res.json().catch(() => ({ success: false }))
            if (res.ok && data?.success) {
                setFeedbackMessage('反馈已提交，感谢你的帮助！')
                setTimeout(() => { closeFeedback() }, 1200)
                setFeedbackAccuracy('unknown')
                setFeedbackContent('')
                setFeedbackContact('')
            } else {
                setFeedbackMessage(data?.error || '提交失败，请稍后重试')
            }
        } catch (e: any) {
            setFeedbackMessage('提交失败，请检查网络连接')
        } finally {
            setFeedbackSubmitting(false)
        }
    }

    // 显示文本的辅助函数：支持翻译切换
    const displayText = (originalText: string, translatedText?: string): string => {
        if (showTranslation && translatedText) {
            return translatedText
        }
        return originalText || ''
    }

    // 格式化文本渲染
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
                return <strong key={index} className="font-semibold text-slate-800 dark:text-white">{part}</strong>
            }
            return part
        })
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Header */}
            <header className="flex-shrink-0 border-b border-gray-200 dark:border-zinc-700 p-6 pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        <div className="flex-shrink-0">
                            <div
                                className="w-12 h-12 bg-[#3182CE] rounded-xl flex items-center justify-center shadow-md shadow-blue-500/15 dark:shadow-blue-500/10 relative"
                                role="img"
                                aria-label={`${job.company || '未知公司'} 公司标志`}
                            >
                                <span className="text-white font-bold text-base">
                                    {(job.company || '未知公司').charAt(0)}
                                </span>
                                <div
                                    className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-md flex items-center justify-center shadow-sm"
                                    role="img"
                                    aria-label="推荐职位标识"
                                >
                                    <Zap className="w-2 h-2 text-white" />
                                </div>
                            </div>
                        </div>
                        <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent truncate leading-tight">
                            {displayText(job.title, job.translations?.title)}
                        </h1>
                    </div>
                    {showCloseButton && onClose && (
                        <button
                            onClick={onClose}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-all duration-200"
                            aria-label="关闭"
                        >
                            <X className="h-4 w-4 text-slate-500" />
                        </button>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between">
                    <p className="text-slate-600 dark:text-slate-400 font-medium text-sm truncate">
                        {displayText(job.company || '')} • {displayText(job.location || '', job.translations?.location)}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 rounded-lg transition-all duration-200 border border-slate-200/50 dark:border-zinc-700/50"
                            title="分享"
                        >
                            <Share2 className="w-4 h-4" />
                        </button>

                        <button
                            onClick={handleSave}
                            className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${isSaved
                                ? 'bg-[#3182CE]/5 text-[#3182CE] border-[#3182CE]/20'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-zinc-700/50'
                                }`}
                            title={isSaved ? '已收藏' : '收藏'}
                        >
                            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                        </button>

                        {hasTranslation && (
                            <button
                                onClick={() => setShowTranslation(!showTranslation)}
                                className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 border text-xs font-medium ${showTranslation
                                    ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-zinc-700/50'
                                    }`}
                                title={showTranslation ? '切换到原文' : '切换到翻译'}
                            >
                                {showTranslation ? '译' : '原'}
                            </button>
                        )}

                        <button
                            onClick={openFeedback}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 rounded-lg transition-all duration-200 border border-slate-200/50 dark:border-zinc-700/50"
                            title="反馈"
                        >
                            <MessageSquare className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
                <div className="p-6 space-y-6">
                    {/* Company Info Card */}
                    <section className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm">
                        <div className="flex items-start gap-6">
                            <div className="flex-shrink-0">
                                <div className="w-16 h-16 bg-gradient-to-br from-[#3182CE] via-[#256bb0] to-[#1A365D] rounded-2xl flex items-center justify-center shadow-lg shadow-[#3182CE]/20">
                                    <span className="text-white font-bold text-xl">
                                        {(job.company || '未知公司').charAt(0)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex-1 min-w-0">
                                        <h2 className="text-xl font-semibold text-slate-800 dark:text-white mb-1 truncate">
                                            {displayText(job.company || '')}
                                        </h2>
                                        {job.sourceUrl && (
                                            <div className="mb-2">
                                                <span className="text-sm text-slate-500 dark:text-slate-400">来自：</span>
                                                <a
                                                    href={job.sourceUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-[#3182CE] hover:text-[#256bb0] underline decoration-1 underline-offset-2 transition-colors"
                                                >
                                                    {(() => {
                                                        if (job.source) return job.source
                                                        try { return new URL(job.sourceUrl || '').hostname } catch { return job.sourceUrl || '' }
                                                    })()}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <dl className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                        <dd className="truncate">{displayText(job.type)}</dd>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                        <dd className="truncate">{job.category || '未分类'}</dd>
                                    </div>
                                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                        <Clock className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                        <dd className="truncate">{new Date(job.postedAt).toLocaleDateString('zh-CN')}</dd>
                                    </div>
                                    {typeof job.salary === 'object' && job.salary.min > 0 && (
                                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                                            <DollarSign className="w-4 h-4 flex-shrink-0 text-slate-400" />
                                            <dd className="truncate font-medium text-emerald-600 dark:text-emerald-400">
                                                {job.salary.currency}{job.salary.min.toLocaleString()} - {job.salary.currency}{job.salary.max.toLocaleString()}
                                            </dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>
                    </section>

                    {/* Tabs */}
                    <nav className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
                        {[
                            { key: 'description', label: '职位描述' },
                            { key: 'company', label: '公司信息' },
                            { key: 'openings', label: '在招职位' }
                        ].map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none ${activeTab === tab.key
                                    ? 'bg-white dark:bg-gray-700 text-[#3182CE] shadow-sm border border-gray-200 dark:border-gray-600'
                                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </nav>

                    {/* Tab Content */}
                    <div className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-slate-200/40 dark:border-zinc-700/40">
                        {activeTab === 'description' && (
                            <div className="space-y-6">
                                <section>
                                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-slate-500" />
                                        工作地点
                                    </h3>
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                                            {displayText(job.location, job.translations?.location)}
                                        </div>
                                    </div>
                                </section>

                                {(((job as any).tags && (job as any).tags.length > 0) || (job.skills && job.skills.length > 0)) && (
                                    <section>
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                                            技能要求
                                        </h3>
                                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                                            <SingleLineTags
                                                tags={(Array.isArray((job as any).tags) && (job as any).tags.length > 0
                                                    ? (job as any).tags
                                                    : (job.skills || [])) as string[]}
                                                size="sm"
                                            />
                                        </div>
                                    </section>
                                )}

                                {jobDescriptionData.sections.map((section, index) => (
                                    <section key={index}>
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                                            {displayText(section.title)}
                                        </h3>
                                        <div className="prose prose-slate dark:prose-invert max-w-none">
                                            <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                                {renderFormattedText(displayText(section.content))}
                                            </div>
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}

                        {activeTab === 'company' && (
                            <div className="space-y-6">
                                <section>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                                            {`关于 ${displayText(companyInfo?.name || job.company || '')}`}
                                        </h3>
                                        {companyInfo?.website && (
                                            <a
                                                href={companyInfo.website}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <Globe className="w-4 h-4" />
                                                访问官网
                                            </a>
                                        )}
                                    </div>

                                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
                                        {renderFormattedText(displayText(
                                            companyInfo?.description ||
                                            (jobDescriptionData.sections.find(s => /About|公司介绍|关于我们/i.test(s.title))?.content) || ''
                                        )) || (
                                                <p>暂无公司介绍信息。</p>
                                            )}
                                    </div>
                                </section>

                                <section>
                                    <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-4">公司详情</h4>
                                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <dt className="font-semibold text-slate-800 dark:text-white mb-2">行业</dt>
                                            <dd className="text-slate-600 dark:text-slate-400">{companyInfo?.industry || '未分类'}</dd>
                                        </div>
                                        {companyInfo?.tags && companyInfo.tags.length > 0 && (
                                            <div className="col-span-full">
                                                <dt className="font-semibold text-slate-800 dark:text-white mb-2">标签</dt>
                                                <dd><SingleLineTags tags={companyInfo.tags} size="sm" /></dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="font-semibold text-slate-800 dark:text-white mb-2">总部</dt>
                                            <dd className="text-slate-600 dark:text-slate-400">{displayText(job.location)}</dd>
                                        </div>
                                    </dl>
                                </section>
                            </div>
                        )}

                        {activeTab === 'openings' && (
                            <section>
                                <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">在招职位</h3>
                                {companyLoading ? (
                                    <div className="text-sm text-slate-500">加载中…</div>
                                ) : companyError ? (
                                    <div className="text-sm text-red-600">{companyError}</div>
                                ) : companyJobs.length === 0 ? (
                                    <div className="text-sm text-slate-500">暂无该公司的其他在招职位</div>
                                ) : (
                                    <div className="space-y-3">
                                        {companyJobs.map((cj) => (
                                            <article key={cj.id} className="p-4 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-all duration-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="min-w-0">
                                                        <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={cj.title}>{cj.title}</h4>
                                                        <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={cj.location}>{cj.location}</p>
                                                    </div>
                                                    {cj.sourceUrl && (
                                                        <a href={cj.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-[#3182CE] hover:text-[#256bb0] underline underline-offset-2">查看</a>
                                                    )}
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4 sticky bottom-0">
                <button
                    onClick={handleApply}
                    className="w-full bg-[#3182CE] hover:bg-[#256bb0] text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
                >
                    <Zap className="w-4 h-4 group-hover:animate-pulse" />
                    前往申请，Go！
                </button>
            </footer>

            {/* Feedback Modal */}
            {isFeedbackOpen && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-30">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-700 w-full max-w-md mx-4">
                        <div className="p-5 border-b border-slate-200 dark:border-zinc-700 flex items-center justify-between">
                            <h3 className="text-base font-semibold">岗位信息反馈</h3>
                            <button onClick={closeFeedback} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800">
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
                                <textarea value={feedbackContent} onChange={(e) => setFeedbackContent(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 text-sm" placeholder="请描述你发现的问题或建议"></textarea>
                            </div>
                            {feedbackMessage && <div className="text-sm text-blue-600">{feedbackMessage}</div>}
                            <div className="flex justify-end gap-2">
                                <button onClick={closeFeedback} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                                <button onClick={submitFeedback} disabled={feedbackSubmitting} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">提交</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
