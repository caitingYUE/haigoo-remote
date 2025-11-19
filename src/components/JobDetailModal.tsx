import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Share2, Bookmark, ExternalLink, MapPin, Clock, DollarSign, Building2, Zap, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { segmentJobDescription } from '../utils/translation'
import { SingleLineTags } from './SingleLineTags'
import { processedJobsService } from '../services/processed-jobs-service'

interface JobDetailModalProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onSave?: (jobId: string) => void
  isSaved?: boolean
  onApply?: (jobId: string) => void
  jobs?: Job[]
  currentJobIndex?: number
  onNavigateJob?: (direction: 'prev' | 'next') => void
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onSave,
  isSaved = false,
  
  onApply,
  jobs = [],
  currentJobIndex = -1,
  onNavigateJob
}) => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'description' | 'company' | 'openings'>('description')
  // 仅显示原始文本，不进行语言切换或翻译
  
  // 可访问性相关的 refs
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const applyButtonRef = useRef<HTMLButtonElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  // 存储焦点管理
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement
      // 延迟聚焦以确保模态框已渲染
      setTimeout(() => {
        closeButtonRef.current?.focus()
      }, 100)
    } else {
      // 恢复之前的焦点
      if (previousFocusRef.current) {
        previousFocusRef.current.focus()
      }
    }
  }, [isOpen])

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          handleTabNavigation(e)
          break
        case 'ArrowLeft':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleNavigate('prev')
          }
          break
        case 'ArrowRight':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            handleNavigate('next')
          }
          break
        case '1':
        case '2':
        case '3':
          if (e.altKey) {
            e.preventDefault()
            const tabKeys = ['description', 'company', 'openings'] as const
            setActiveTab(tabKeys[parseInt(e.key) - 1])
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Tab 键导航处理
  const handleTabNavigation = (e: KeyboardEvent) => {
    if (!modalRef.current) return

    const focusableElements = modalRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    if (e.shiftKey) {
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement?.focus()
      }
    } else {
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement?.focus()
      }
    }
  }

  // 键盘事件处理函数
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      action()
    }
  }

  const jobDescriptionData = useMemo(() => {
    const desc = typeof job?.description === 'string' ? job?.description as string : (job?.description ? String(job?.description) : '')
    return segmentJobDescription(desc)
  }, [job])

  const [companyJobs, setCompanyJobs] = useState<Job[]>([])
  const [companyLoading, setCompanyLoading] = useState<boolean>(false)
  const [companyError, setCompanyError] = useState<string | null>(null)

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

  if (!job || !isOpen) return null

  const handleApply = () => {
    onApply?.(job.id)
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    onNavigateJob?.(direction)
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

  // 显示文本的辅助函数：直接返回原文
  const displayText = (originalText: string): string => {
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
    // 处理粗体文本 **text**
    const boldRegex = /\*\*(.*?)\*\*/g
    const parts = text.split(boldRegex)
    
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} className="font-semibold text-slate-800 dark:text-white">{part}</strong>
      }
      return part
    })
  }

  // 处理职位描述数据：已提前计算，保证 hooks 调用顺序一致

  const canNavigatePrev = currentJobIndex > 0
  const canNavigateNext = currentJobIndex < jobs.length - 1

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-stretch justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby="job-modal-title"
      aria-describedby="job-modal-description"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div 
        ref={modalRef}
        className={`bg-white dark:bg-zinc-900 shadow-xl h-full w-full max-w-[95vw] md:max-w-[60vw] lg:max-w-[50vw] xl:max-w-[45vw] flex flex-col relative transform transition-all duration-300 ${
          isOpen ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Navigation Buttons */}
        {jobs.length > 1 && canNavigatePrev && (
          <button
            onClick={() => handleNavigate('prev')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('prev'))}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            title="上一个职位 (Ctrl+←)"
            aria-label={`上一个职位，当前第 ${currentJobIndex + 1} 个，共 ${jobs.length} 个`}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        
        {jobs.length > 1 && canNavigateNext && (
          <button
            onClick={() => handleNavigate('next')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('next'))}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            title="下一个职位 (Ctrl+→)"
            aria-label={`下一个职位，当前第 ${currentJobIndex + 1} 个，共 ${jobs.length} 个`}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Header - 简化头部样式 */}
        <header className="flex-shrink-0 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700">
          <div className="p-6 pb-3">
            {/* 第一行：公司Logo与主标题 + 右侧AI Match环和关闭 */}
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
                    {/* 推荐标识集成到右上角 */}
                    <div 
                      className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-md flex items-center justify-center shadow-sm"
                      role="img"
                      aria-label="推荐职位标识"
                    >
                      <Zap className="w-2 h-2 text-white" />
                    </div>
                  </div>
                </div>
                <h1 
                  id="job-modal-title"
                  className="text-lg font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent truncate leading-tight"
                >
                  {displayText(job.title)}
                </h1>
              </div>
              <div className="flex items-center">
                <button
                  ref={closeButtonRef}
                  onClick={onClose}
                  onKeyDown={(e) => handleKeyDown(e, onClose)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-all duration-200 group"
                  aria-label="关闭职位详情对话框"
                  title="关闭 (Esc)"
                >
                  <X className="h-4 w-4 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                </button>
              </div>
            </div>

            {/* 第二行：副标题（公司与地点） + 右侧操作按钮 */}
            <div className="mt-2 flex items-center justify-between">
              <p 
                id="job-modal-description"
                className="text-slate-600 dark:text-slate-400 font-medium text-sm truncate"
              >
                {displayText(job.company || '')} • {displayText(job.location || '')}
              </p>
              <div className="flex items-center gap-2" role="toolbar" aria-label="职位操作">
                {/* 分享 */}
                <button
                  onClick={handleShare}
                  onKeyDown={(e) => handleKeyDown(e, handleShare)}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 rounded-lg transition-all duration-200 border border-slate-200/50 dark:border-zinc-700/50"
                  title="分享"
                  aria-label="分享职位信息"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
          <div className="p-6 space-y-6">
            {/* 公司信息卡片 - 优化布局 */}
            <section 
              className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-all duration-300"
              aria-labelledby="company-info-title"
            >
              <div className="flex items-start gap-6">
                {/* 公司Logo */}
                <div className="flex-shrink-0">
                  <div 
                    className="w-16 h-16 bg-gradient-to-br from-[#3182CE] via-[#256bb0] to-[#1A365D] rounded-2xl flex items-center justify-center shadow-lg shadow-[#3182CE]/20"
                    role="img"
                    aria-label={`${job.company || '未知公司'} 公司标志`}
                  >
                    <span className="text-white font-bold text-xl">
                      {(job.company || '未知公司').charAt(0)}
                    </span>
                  </div>
                </div>
                
                {/* 主要信息区域 */}
                <div className="flex-1 min-w-0">
                  {/* 公司名称与匹配度合并展示 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h2 
                        id="company-info-title"
                        className="text-xl font-semibold text-slate-800 dark:text-white mb-1 truncate"
                      >
                        {displayText(job.company || '')}
                      </h2>
                      
                      {/* 来源信息 */}
                      {job.sourceUrl && (
                        <div className="mb-2">
                          <span className="text-sm text-slate-500 dark:text-slate-400">
                            来自：
                          </span>
                          <a
                            href={job.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-haigoo-primary dark:text-[#3182CE] hover:text-haigoo-primary/80 dark:hover:text-[#256bb0] underline decoration-1 underline-offset-2 transition-colors"
                            title={'查看原始职位信息'}
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

                  {/* 详细信息网格 - 移除地址信息 */}
                  <dl className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                      <dt className="sr-only">工作类型</dt>
                      <dd className="truncate">{displayText(job.type)}</dd>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                      <dt className="sr-only">发布时间</dt>
                      <dd className="truncate">{new Date(job.postedAt).toLocaleDateString('zh-CN')}</dd>
                    </div>
                    {typeof job.salary === 'object' && job.salary.min > 0 && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                        <dt className="sr-only">薪资范围</dt>
                        <dd className="truncate font-medium text-emerald-600 dark:text-emerald-400">
                          {job.salary.currency}{job.salary.min.toLocaleString()} - {job.salary.currency}{job.salary.max.toLocaleString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </div>
            </section>

            {/* 专业Tab导航 - 标准tab组件样式 */}
            <nav 
              className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700"
              role="tablist"
              aria-label="职位详情选项卡"
            >
              {[
                { key: 'description', label: '职位描述', shortcut: 'Alt+1' },
                { key: 'company', label: '公司信息', shortcut: 'Alt+2' },
                { key: 'openings', label: '在招职位', shortcut: 'Alt+3' }
              ].map((tab, index) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  onKeyDown={(e) => handleKeyDown(e, () => setActiveTab(tab.key as any))}
                  className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#3182CE] focus:ring-offset-2 ${
                    activeTab === tab.key 
                      ? 'bg-white dark:bg-gray-700 text-[#3182CE] dark:text-[#3182CE] shadow-sm border border-gray-200 dark:border-gray-600' 
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  aria-controls={`tabpanel-${tab.key}`}
                  id={`tab-${tab.key}`}
                  title={`${tab.label} (${tab.shortcut})`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>

            {/* Tab Content */}
            <div 
              className="bg-white dark:bg-zinc-800 rounded-xl p-6 border border-slate-200/40 dark:border-zinc-700/40"
              role="tabpanel"
              id={`tabpanel-${activeTab}`}
              aria-labelledby={`tab-${activeTab}`}
            >
              {activeTab === 'description' && (
                <div className="space-y-6">
                  {/* 工作地点信息模块 */}
                  <section>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-slate-500" />
                      工作地点
                    </h3>
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {displayText(job.location)}
                      </div>
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        此职位可能有特定的地点要求或远程工作选项。
                      </div>
                    </div>
                  </section>

                  {/* 技能标签模块 */}
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
                          fallback="remote"
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
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                      {`关于 ${displayText(job.company || '')}`}
                    </h3>
                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {renderFormattedText(displayText(
                        (jobDescriptionData.sections.find(s => /About|公司介绍|关于我们/i.test(s.title))?.content) || '',
                        
                      )) || (
                        <p>暂无公司介绍信息。</p>
                      )}
                    </div>
                  </section>
                  
                  <section>
                    <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-4">公司详情</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          公司规模
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          1000-5000人
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          行业
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          科技/互联网
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          成立时间
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          2010年
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          总部
                        </dt>
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
                    <div className="space-y-3" role="list">
                      {companyJobs.map((cj) => (
                        <article key={cj.id} className="p-4 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-all duration-200" role="listitem">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0">
                              <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={cj.title}>{cj.title}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={cj.location}>{cj.location}</p>
                            </div>
                            {cj.sourceUrl && (
                              <a href={cj.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-haigoo-primary underline underline-offset-2">查看</a>
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
        
        {/* 底部申请按钮 - 根据内容自适应，保持在视窗内 */}
        <footer className="border-t border-slate-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4 sticky bottom-0">
          <button
            ref={applyButtonRef}
            onClick={handleApply}
            onKeyDown={(e) => handleKeyDown(e, handleApply)}
            className="w-full bg-[#3182CE] hover:bg-[#256bb0] text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
            aria-label={`申请 ${job.title} 职位`}
          >
            <Zap className="w-4 h-4 group-hover:animate-pulse" aria-hidden="true" />
            前往申请，Go！
          </button>
        </footer>
      </div>
    </div>
  )
}

export default JobDetailModal