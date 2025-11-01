import React, { useState, useMemo } from 'react'
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
  const [activeTab, setActiveTab] = useState<'description' | 'company' | 'similar'>('description')
  const [isOriginalLanguage, setIsOriginalLanguage] = useState(true)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translatedContent, setTranslatedContent] = useState<{[key: string]: string}>({})
  const [translationError, setTranslationError] = useState<string | null>(null)
  const navigate = useNavigate()

  if (!job) return null

  const handleSave = () => {
    if (onSave) {
      onSave(job.id)
    }
  }

  const handleApply = () => {
    if (onApply) {
      onApply(job.id)
    } else {
      if (job.sourceUrl) {
        window.open(job.sourceUrl, '_blank')
      } else {
        navigate(`/apply/${job.id}`)
        onClose()
      }
    }
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (onNavigateJob) {
      onNavigateJob(direction)
    }
  }

  const handleShare = async () => {
    const shareData = {
      title: `${job.title} - ${job.company}`,
      text: `查看这个职位机会：${job.title} at ${job.company}`,
      url: job.sourceUrl || window.location.href
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch (err) {
        console.log('分享取消或失败')
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`)
        alert('职位信息已复制到剪贴板')
      } catch (err) {
        console.log('复制失败')
      }
    }
  }

  // AI翻译功能 - 固定翻译为中文
  const handleTranslate = async (): Promise<boolean> => {
    if (isTranslating) return false
    setTranslationError(null)
    setIsTranslating(true)
    try {
      const textsToTranslate = [
        job.title,
        job.company,
        job.location,
        job.description
      ]

      const results = await multiTranslationService.batchTranslate(
        textsToTranslate,
        'zh' // 固定翻译为中文
      )

      if (results.success && results.data) {
        const [title, company, location, description] = results.data
        // 简单有效性校验：必须非空且与原文不同
        const isValid = [title, company, location, description].every((r, idx) => {
          const original = textsToTranslate[idx] || ''
          return typeof r === 'string' && r.trim().length > 0 && r.trim() !== original.trim()
        })
        if (!isValid) {
          setTranslationError('翻译服务暂时不可用')
          return false
        }
        setTranslatedContent({ title, company, location, description })
        return true
      } else {
        setTranslationError(results.error || '翻译服务暂时不可用')
        return false
      }
    } catch (error) {
      console.error('翻译失败:', error)
      setTranslationError('翻译过程中发生错误')
      return false
    } finally {
      setIsTranslating(false)
    }
  }

  // 切换语言
  const toggleLanguage = async () => {
    if (!isOriginalLanguage) {
      // 切换到原文
      setIsOriginalLanguage(true)
      return
    }
    // 切换到翻译
    if (Object.keys(translatedContent).length === 0) {
      const ok = await handleTranslate()
      if (!ok) {
        // 翻译失败则保持原文模式
        return
      }
    }
    setIsOriginalLanguage(false)
  }

  const matchPercentage = Math.floor(Math.random() * 20) + 75

  const jobDescriptionData = useMemo(() => {
    if (!job.description) {
      return { summary: '', sections: [] }
    }
    
    try {
      // 根据语言状态选择使用原文还是翻译
      let descriptionToProcess = job.description
      if (!isOriginalLanguage && translatedContent.description) {
        descriptionToProcess = translatedContent.description
      }
      
      return segmentJobDescription(descriptionToProcess)
    } catch (error) {
      console.error('Error processing job description:', error)
      return { summary: '', sections: [] }
    }
  }, [job.description, isOriginalLanguage, translatedContent.description])

  // 简单的文本格式化渲染函数
  const renderFormattedText = (text: string) => {
    if (!text) return null
    
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    
    lines.forEach((line, index) => {
      if (!line.trim()) {
        elements.push(<br key={`br-${index}`} />)
        return
      }
      
      // 处理列表项
      if (line.startsWith('• ')) {
        elements.push(
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-haigoo-primary mt-1">•</span>
            <span>{renderInlineFormatting(line.substring(2))}</span>
          </div>
        )
        return
      }
      
      // 处理标题（以**开头结尾的行）
      if (line.startsWith('**') && line.endsWith('**') && line.length > 4) {
        elements.push(
          <h5 key={index} className="font-semibold text-slate-800 dark:text-white mt-4 mb-2">
            {line.slice(2, -2)}
          </h5>
        )
        return
      }
      
      // 普通段落
      elements.push(
        <p key={index} className="mb-2">
          {renderInlineFormatting(line)}
        </p>
      )
    })
    
    return <div>{elements}</div>
  }
  
  // 处理行内格式化（加粗、斜体）
  const renderInlineFormatting = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-semibold text-slate-800 dark:text-white">{part.slice(2, -2)}</strong>
      } else if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={index} className="italic">{part.slice(1, -1)}</em>
      }
      return part
    })
  }

  const displayText = (text: string, isDescription: boolean = false, fieldName?: string): string => {
    
    let processedText = text
    
    // 智能处理HTML标签，保留格式化信息
    processedText = processedText
      // 处理段落和换行
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '')
      // 处理列表
      .replace(/<\/li>/gi, '\n• ')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/?[uo]l[^>]*>/gi, '\n')
      // 处理标题
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<h[1-6][^>]*>/gi, '\n**')
      // 处理强调标签
      .replace(/<\/?strong[^>]*>/gi, '**')
      .replace(/<\/?b[^>]*>/gi, '**')
      .replace(/<\/?em[^>]*>/gi, '*')
      .replace(/<\/?i[^>]*>/gi, '*')
      // 移除其他HTML标签
      .replace(/<[^>]*>/g, '')
      // 处理HTML实体
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&[a-zA-Z0-9#]+;/g, '')
      // 清理多余的空格和换行
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 合并多个换行
      .replace(/\s+/g, ' ') // 合并多个空格
      .replace(/\n /g, '\n') // 移除换行后的空格
      .trim()
    
    // 根据语言切换状态决定是否使用翻译
    if (isOriginalLanguage) {
      // 原文模式：直接返回处理后的纯文本（保留 ** 和 * 等Markdown标记），交由renderFormattedText渲染
      return processedText
    } else {
      // 翻译模式：优先使用AI翻译，其次使用词典翻译为中文
      if (fieldName && translatedContent[fieldName]) {
        const aiTranslated = translatedContent[fieldName]
        return aiTranslated
      }
      // 使用词典翻译为中文作为回退
      const translatedText = translateText(processedText, true)
      return translatedText
    }
  }

  const canNavigatePrev = jobs.length > 0 && currentJobIndex > 0
  const canNavigateNext = jobs.length > 0 && currentJobIndex < jobs.length - 1

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-500 ease-out ${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm transition-all duration-500"
        onClick={onClose}
      />
      
      {/* Modal - 确保在右侧显示并修复滚动 */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-[900px] bg-gradient-to-br from-white via-slate-50/50 to-white dark:from-zinc-900 dark:via-zinc-900/95 dark:to-zinc-800 border-l border-slate-200/60 dark:border-zinc-700/60 shadow-2xl backdrop-blur-xl transform transition-all duration-500 ease-out flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        
        {/* Navigation Buttons */}
        {jobs.length > 1 && canNavigatePrev && (
          <button
            onClick={() => handleNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-zinc-700/60 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="上一个职位"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        
        {jobs.length > 1 && canNavigateNext && (
          <button
            onClick={() => handleNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-zinc-700/60 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="下一个职位"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Header - 固定头部，分两行布局 */}
        <div className="flex-shrink-0 bg-gradient-to-r from-white/95 via-slate-50/90 to-white/95 dark:from-zinc-900/95 dark:via-zinc-800/90 dark:to-zinc-900/95 backdrop-blur-xl border-b border-slate-200/60 dark:border-zinc-700/60">
          <div className="p-6 pb-3">
            {/* 第一行：公司Logo与主标题 + 右侧AI Match环和关闭 */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-500/15 dark:shadow-blue-500/10">
                    <span className="text-white font-bold text-base">
                      {job.company.charAt(0)}
                    </span>
                  </div>
                  <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm">
                    <Zap className="w-2 h-2 text-white" />
                  </div>
                </div>
                <h2 className="text-lg font-bold bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 dark:from-white dark:via-slate-100 dark:to-white bg-clip-text text-transparent truncate leading-tight">
                  {displayText(job.title, false, 'title')}
                </h2>
              </div>
              <div className="flex items-center">
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-all duration-200 group"
                >
                  <X className="h-4 w-4 text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
                </button>
              </div>
            </div>

            {/* 第二行：副标题（公司与地点） + 右侧操作按钮 */}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-slate-600 dark:text-slate-400 font-medium text-sm truncate">
                {displayText(job.company, false, 'company')} • {displayText(job.location, false, 'location')}
              </p>
              <div className="flex items-center gap-2">
                {/* 翻译开关 */}
                <button
                  onClick={toggleLanguage}
                  disabled={isTranslating}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/70 dark:bg-zinc-800/70 backdrop-blur-sm border border-slate-200/50 dark:border-zinc-700/50 rounded-lg transition-all duration-200 hover:bg-white/90 dark:hover:bg-zinc-800/90 hover:border-slate-300/60 dark:hover:border-zinc-600/60 group disabled:opacity-50 disabled:cursor-not-allowed"
                  title={translationError ? `翻译失败：${translationError}` : (isOriginalLanguage ? '切换到翻译版本' : '切换到原文版本')}
                >
                  <Languages className={`h-3 w-3 ${isTranslating ? 'text-blue-500 dark:text-blue-400 animate-pulse' : 'text-slate-500 dark:text-slate-400'}`} />
                  <span className={`text-xs font-medium ${isOriginalLanguage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>原</span>
                  <span className="text-slate-300 dark:text-slate-600 mx-0.5">/</span>
                  <span className={`text-xs font-medium ${!isOriginalLanguage ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`}>译</span>
                </button>

                {/* 分享 */}
                <button
                  onClick={handleShare}
                  className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 rounded-lg transition-all duration-200 border border-slate-200/50 dark:border-zinc-700/50"
                  title={isOriginalLanguage ? 'Share' : '分享'}
                >
                  <Share2 className="w-4 h-4" />
                </button>

                {/* 收藏 */}
                <button
                  onClick={handleSave}
                  className={`px-2.5 py-1.5 rounded-lg transition-all duration-200 border ${
                    isSaved
                      ? 'bg-haigoo-primary/5 text-haigoo-primary border-haigoo-primary/20'
                      : 'bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-zinc-700/50'
                  }`}
                  title={isOriginalLanguage ? (isSaved ? 'Saved' : 'Save') : (isSaved ? '已收藏' : '收藏')}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-zinc-600 scrollbar-track-transparent">
          <div className="p-6 space-y-6">
            {/* 公司信息卡片 - 优化布局 */}
            <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-start gap-6">
                {/* 公司Logo */}
                <div className="relative flex-shrink-0">
                  <div className="w-16 h-16 bg-gradient-to-br from-haigoo-primary via-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-haigoo-primary/20">
                    <span className="text-white font-bold text-xl">
                      {job.company.charAt(0)}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-center shadow-sm">
                    <Star className="w-2.5 h-2.5 text-white fill-current" />
                  </div>
                </div>
                
                {/* 主要信息区域 */}
                <div className="flex-1 min-w-0">
                  {/* 公司名称与匹配度合并展示 */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-1 truncate">
                        {displayText(job.company)}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span>{isOriginalLanguage ? 'AI Match' : '智能匹配'}</span>
                        <span className="ml-1 font-semibold text-haigoo-primary dark:text-purple-400">{matchPercentage}%</span>
                      </div>
                    </div>
                  </div>

                  {/* 详细信息网格 */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <MapPin className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{displayText(job.location)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Building2 className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{displayText(job.type)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      <Clock className="w-4 h-4 flex-shrink-0 text-slate-400" />
                      <span className="truncate">{new Date(job.postedAt).toLocaleDateString('zh-CN')}</span>
                    </div>
                    {typeof job.salary === 'object' && job.salary.min > 0 && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <DollarSign className="w-4 h-4 flex-shrink-0 text-slate-400" />
                        <span className="truncate font-medium text-emerald-600 dark:text-emerald-400">
                          {job.salary.currency}{job.salary.min.toLocaleString()} - {job.salary.currency}{job.salary.max.toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 优化的Tab导航 - 减少视觉压迫感 */}
            <div className="flex space-x-1 bg-slate-50 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
              {[
                { key: 'description', label: '职位描述' },
                { key: 'company', label: '公司信息' },
                { key: 'similar', label: '相似职位' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    activeTab === tab.key
                      ? 'bg-white dark:bg-zinc-700 text-haigoo-primary dark:text-purple-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-haigoo-primary dark:hover:text-purple-400 hover:bg-white/50 dark:hover:bg-zinc-700/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/60 dark:border-zinc-700/60 shadow-sm hover:shadow-md transition-all duration-300">
              {activeTab === 'description' && (
                <div className="space-y-6">
                  {jobDescriptionData.summary && (
                    <div>
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">职位概要</h4>
                      <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        {renderFormattedText(displayText(jobDescriptionData.summary, true))}
                      </div>
                    </div>
                  )}
                  
                  {jobDescriptionData.sections.map((section, index) => (
                    <div key={index}>
                      <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
                        {displayText(section.title)}
                      </h4>
                      <div className="prose prose-slate dark:prose-invert max-w-none">
                        <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          {renderFormattedText(displayText(section.content, true))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'company' && (
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">{isOriginalLanguage ? `About ${job.company}` : `关于 ${displayText(job.company)}`}</h4>
                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                      {renderFormattedText(displayText(
                        (jobDescriptionData.sections.find(s => /About|公司介绍|关于我们/i.test(s.title))?.content) || '',
                        true,
                        'company_about'
                      )) || (
                        <p>{isOriginalLanguage ? 'Company profile not available.' : '暂无公司介绍信息。'}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-semibold text-slate-800 dark:text-white mb-2">{isOriginalLanguage ? 'Company size' : '公司规模'}</h5>
                      <p className="text-slate-600 dark:text-slate-400">{isOriginalLanguage ? '1000-5000 employees' : '1000-5000人'}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 dark:text-white mb-2">{isOriginalLanguage ? 'Industry' : '行业'}</h5>
                      <p className="text-slate-600 dark:text-slate-400">{isOriginalLanguage ? 'Technology/Internet' : '科技/互联网'}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 dark:text-white mb-2">{isOriginalLanguage ? 'Founded' : '成立时间'}</h5>
                      <p className="text-slate-600 dark:text-slate-400">{isOriginalLanguage ? '2010' : '2010年'}</p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-slate-800 dark:text-white mb-2">{isOriginalLanguage ? 'Headquarters' : '总部'}</h5>
                      <p className="text-slate-600 dark:text-slate-400">{displayText(job.location)}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'similar' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">相似职位推荐</h4>
                  {[1, 2, 3].map((index) => (
                    <div key={index} className="p-4 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl hover:bg-gradient-to-r hover:from-slate-50/80 hover:to-white/80 dark:hover:from-zinc-700/50 dark:hover:to-zinc-600/50 transition-all duration-300 cursor-pointer group transform hover:scale-[1.01]">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-haigoo-primary via-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-haigoo-primary/25 group-hover:shadow-haigoo-primary/40 transition-all duration-300">
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
                          <div className="text-sm font-medium text-haigoo-primary dark:text-purple-400">
                            {85 + index * 2}% 匹配
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            2天前
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 底部固定申请按钮 - 科技感设计 */}
        <div className="border-t border-slate-200/60 dark:border-zinc-700/60 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm p-4">
          <button
            onClick={handleApply}
            className="w-full bg-gradient-to-r from-haigoo-primary via-purple-600 to-indigo-600 hover:from-haigoo-primary/90 hover:via-purple-600/90 hover:to-indigo-600/90 text-white py-3 px-6 rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-haigoo-primary/25 hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 group"
          >
            <Zap className="w-4 h-4 group-hover:animate-pulse" />
            立即申请
            <span className="text-xs opacity-75">• 一键投递</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default JobDetailModal