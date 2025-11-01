import React, { useState, useMemo, useEffect, useRef } from 'react'
import { X, Share2, Bookmark, ExternalLink, Languages, MapPin, Clock, DollarSign, Building2, Zap, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'
import { translateText, formatJobDescription, segmentJobDescription } from '../utils/translation'
import { multiTranslationService } from '../services/multi-translation-service'

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
  const [activeTab, setActiveTab] = useState<'description' | 'company' | 'similar'>('description')
  const [isOriginalLanguage, setIsOriginalLanguage] = useState(true)
  const [translatedContent, setTranslatedContent] = useState<Record<string, string>>({})
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  
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
            const tabKeys = ['description', 'company', 'similar'] as const
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

  if (!job || !isOpen) return null

  const matchPercentage = Math.floor(Math.random() * 20) + 80

  const handleSave = () => {
    onSave?.(job.id)
  }

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
          title: `${job.title} - ${job.company}`,
          text: `查看这个职位：${job.title} at ${job.company}`,
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

  // AI 翻译功能
  const toggleLanguage = async () => {
    if (isOriginalLanguage && Object.keys(translatedContent).length === 0) {
      setIsTranslating(true)
      setTranslationError(null)
      
      try {
        const textsToTranslate = [
          job.title,
          job.company,
          job.location,
          job.type,
          job.description
        ]
        
        const results = await multiTranslationService.batchTranslate(textsToTranslate, 'zh')
        
        if (results.success && results.data) {
          const [title, company, location, type, description] = results.data
          setTranslatedContent({ title, company, location, type, description })
        } else {
          setTranslationError('翻译服务暂时不可用')
        }
      } catch (error) {
        console.error('翻译失败:', error)
        setTranslationError('翻译服务暂时不可用')
      } finally {
        setIsTranslating(false)
      }
    }
    
    setIsOriginalLanguage(!isOriginalLanguage)
  }

  // 显示文本的辅助函数
  const displayText = (originalText: string, isLongText = false, key?: string): string => {
    if (isOriginalLanguage) {
      return originalText
    }
    
    if (key && translatedContent[key]) {
      return translatedContent[key]
    }
    
    return originalText
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

  // 处理职位描述数据
  const jobDescriptionData = useMemo(() => {
    return segmentJobDescription(displayText(job.description, true, 'description'))
  }, [job.description, isOriginalLanguage, translatedContent])

  const canNavigatePrev = currentJobIndex > 0
  const canNavigateNext = currentJobIndex < jobs.length - 1

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
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
        className={`bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200/60 dark:border-zinc-700/60 w-full max-w-4xl h-[90vh] flex flex-col relative transform transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Navigation Buttons */}
        {jobs.length > 1 && canNavigatePrev && (
          <button
            onClick={() => handleNavigate('prev')}
            onKeyDown={(e) => handleKeyDown(e, () => handleNavigate('prev'))}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-zinc-700/60 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
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
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-zinc-700/60 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="下一个职位 (Ctrl+→)"
            aria-label={`下一个职位，当前第 ${currentJobIndex + 1} 个，共 ${jobs.length} 个`}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Header - 固定头部，分两行布局 */}
        <header className="flex-shrink-0 bg-gradient-to-r from-white/95 via-slate-50/90 to-white/95 dark:from-zinc-900/95 dark:via-zinc-800/90 dark:to-zinc-900/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-zinc-700/60">
          <div className="p-6 pb-3">
            {/* 第一行：公司Logo与主标题 + 右侧AI Match环和关闭 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative flex-shrink-0">
                  <div 
                    className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/15 dark:shadow-blue-500/10"
                    role="img"
                    aria-label={`${job.company} 公司标志`}
                  >
                    <span className="text-white font-bold text-base">
                      {job.company.charAt(0)}
                    </span>
                  </div>
                  <div 
                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm"
                    role="img"
                    aria-label="推荐职位标识"
                  >
                    <Zap className="w-2 h-2 text-white" />
                  </div>
                </div>
                <h1 
                  id="job-modal-title"
                  className="text-lg font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent truncate leading-tight"
                >
                  {displayText(job.title, false, 'title')}
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
                {displayText(job.company, false, 'company')} • {displayText(job.location, false, 'location')}
              </p>
              <div className="flex items-center gap-2" role="toolbar" aria-label="职位操作">
                {/* 翻译开关 */}
                <button
                  onClick={toggleLanguage}
                  onKeyDown={(e) => handleKeyDown(e, toggleLanguage)}
                  disabled={isTranslating}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-zinc-700/50 rounded-lg transition-all duration-200 hover:bg-white/90 dark:hover:bg-zinc-800/90 hover:border-slate-300/60 dark:hover:border-zinc-600/60 group disabled:opacity-50 disabled:cursor-not-allowed"
                  title={translationError ? `翻译失败：${translationError}` : (isOriginalLanguage ? '切换到翻译版本' : '切换到原文版本')}
                  aria-label={`语言切换，当前显示${isOriginalLanguage ? '原文' : '翻译'}版本`}
                  aria-pressed={!isOriginalLanguage}
                >
                  <Languages className={`h-3 w-3 ${isTranslating ? 'text-blue-500 dark:text-blue-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className={`text-xs font-medium ${isOriginalLanguage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>原</span>
                  <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
                  <span className={`text-xs font-medium ${!isOriginalLanguage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>译</span>
                </button>

                {/* 分享 */}
                <button
                  onClick={handleShare}
                  onKeyDown={(e) => handleKeyDown(e, handleShare)}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 rounded-lg transition-all duration-200 border border-slate-200/50 dark:border-zinc-700/50"
                  title={isOriginalLanguage ? 'Share' : '分享'}
                  aria-label="分享职位信息"
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* 收藏 */}
                <button
                  onClick={handleSave}
                  onKeyDown={(e) => handleKeyDown(e, handleSave)}
                  className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${
                    isSaved
                      ? 'bg-haigoo-primary/5 text-haigoo-primary border-haigoo-primary/20'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-zinc-700/50'
                  }`}
                  title={isOriginalLanguage ? (isSaved ? 'Saved' : 'Save') : (isSaved ? '已收藏' : '收藏')}
                  aria-label={isSaved ? '取消收藏职位' : '收藏职位'}
                  aria-pressed={isSaved}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
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
                <div className="relative flex-shrink-0">
                  <div 
                    className="w-16 h-16 bg-gradient-to-br from-haigoo-primary via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-haigoo-primary/20"
                    role="img"
                    aria-label={`${job.company} 公司标志`}
                  >
                    <span className="text-white font-bold text-xl">
                      {job.company.charAt(0)}
                    </span>
                  </div>
                  <div 
                    className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm"
                    role="img"
                    aria-label="优质雇主标识"
                  >
                    <Star className="w-2.5 h-2.5 text-white fill-current" />
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
                        {displayText(job.company)}
                      </h2>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span>{isOriginalLanguage ? 'AI Match' : '智能匹配'}</span>
                        <span 
                          className="ml-1 font-semibold text-haigoo-primary dark:text-purple-400"
                          aria-label={`匹配度 ${matchPercentage} 百分比`}
                        >
                          {matchPercentage}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 详细信息网格 */}
                  <dl className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                      <dt className="sr-only">工作地点</dt>
                      <dd className="truncate">{displayText(job.location)}</dd>
                    </div>
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

            {/* 优化的Tab导航 - 简洁设计 */}
            <nav 
              className="flex space-x-1 bg-slate-50/80 dark:bg-zinc-800/80 p-1 rounded-xl"
              role="tablist"
              aria-label="职位详情选项卡"
            >
              {[
                { key: 'description', label: '职位描述', shortcut: 'Alt+1' },
                { key: 'company', label: '公司信息', shortcut: 'Alt+2' },
                { key: 'similar', label: '相似职位', shortcut: 'Alt+3' }
              ].map((tab, index) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  onKeyDown={(e) => handleKeyDown(e, () => setActiveTab(tab.key as any))}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150 ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-zinc-700 text-haigoo-primary dark:text-purple-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-white/60 dark:hover:bg-zinc-700/60'
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
                  {jobDescriptionData.summary && (
                    <section>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">职位概要</h3>
                      <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {renderFormattedText(displayText(jobDescriptionData.summary, true))}
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
                          {renderFormattedText(displayText(section.content, true))}
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
                      {isOriginalLanguage ? `About ${job.company}` : `关于 ${displayText(job.company)}`}
                    </h3>
                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {renderFormattedText(displayText(
                        (jobDescriptionData.sections.find(s => /About|公司介绍|关于我们/i.test(s.title))?.content) || '',
                        true,
                        'company_about'
                      )) || (
                        <p>{isOriginalLanguage ? 'Company profile not available.' : '暂无公司介绍信息。'}</p>
                      )}
                    </div>
                  </section>
                  
                  <section>
                    <h4 className="text-base font-semibold text-slate-800 dark:text-white mb-4">公司详情</h4>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          {isOriginalLanguage ? 'Company size' : '公司规模'}
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          {isOriginalLanguage ? '1000-5000 employees' : '1000-5000人'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          {isOriginalLanguage ? 'Industry' : '行业'}
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          {isOriginalLanguage ? 'Technology/Internet' : '科技/互联网'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          {isOriginalLanguage ? 'Founded' : '成立时间'}
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">
                          {isOriginalLanguage ? '2010' : '2010年'}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-slate-800 dark:text-white mb-2">
                          {isOriginalLanguage ? 'Headquarters' : '总部'}
                        </dt>
                        <dd className="text-slate-600 dark:text-slate-400">{displayText(job.location)}</dd>
                      </div>
                    </dl>
                  </section>
                </div>
              )}

              {activeTab === 'similar' && (
                <section>
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">相似职位推荐</h3>
                  <div className="space-y-4" role="list">
                    {[1, 2, 3].map((index) => (
                      <article 
                        key={index} 
                        className="p-4 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-white/80 dark:hover:from-zinc-700/50 dark:hover:to-zinc-600/50 transition-all duration-300 cursor-pointer group transform hover:scale-[1.01]"
                        role="listitem"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            // 处理相似职位点击
                          }
                        }}
                        aria-label={`相似职位：${job.title} ${index + 1}，匹配度 ${85 + index * 2}%`}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-12 h-12 bg-gradient-to-br from-haigoo-primary via-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-haigoo-primary/25 group-hover:shadow-haigoo-primary/40 transition-all duration-300"
                            role="img"
                            aria-hidden="true"
                          >
                            <span className="text-white font-bold">
                              {String.fromCharCode(65 + index)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-haigoo-primary dark:group-hover:text-purple-400 transition-colors">
                              {job.title} {index + 1}
                            </h4>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {job.company} • {job.location}
                            </p>
                          </div>
                          <div className="text-right">
                            <div 
                              className="text-sm font-medium text-haigoo-primary dark:text-purple-400"
                              aria-label={`匹配度 ${85 + index * 2} 百分比`}
                            >
                              {85 + index * 2}% 匹配
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              2天前
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </main>
        
        {/* 底部固定申请按钮 - 科技感设计 */}
        <footer className="border-t border-slate-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4">
          <button
            ref={applyButtonRef}
            onClick={handleApply}
            onKeyDown={(e) => handleKeyDown(e, handleApply)}
            className="w-full bg-gradient-to-r from-haigoo-primary via-purple-600 to-indigo-600 hover:from-haigoo-primary/90 hover:via-purple-600/90 hover:to-indigo-600/90 text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-haigoo-primary/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
            aria-label={`申请 ${job.title} 职位`}
          >
            <Zap className="w-4 h-4 group-hover:animate-pulse" aria-hidden="true" />
            立即申请
            <span className="text-xs opacity-75">• 一键投递</span>
          </button>
        </footer>
      </div>
    </div>
  )
}

export default JobDetailModal