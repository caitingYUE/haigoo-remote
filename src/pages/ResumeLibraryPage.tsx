import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, FileText, FolderOpen, Eye, X, Trash2, Download, Edit3, Search, AlertCircle } from 'lucide-react'
import { ResumeItem } from '../types/resume-types'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { ResumeStorageService } from '../services/resume-storage-service'
import { translationMappingService } from '../services/translation-mapping-service'

const ResumeLibraryPage: React.FC = () => {
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [viewingResume, setViewingResume] = useState<ResumeItem | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string>('')
  // 全局筛选与搜索
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    category: '全部',
    location: '全部',
    direction: '全部'
  })
  // 编辑弹窗
  const [editingResume, setEditingResume] = useState<ResumeItem | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  // 存储统计
  const [storageStats, setStorageStats] = useState<{ count: number; size: number; lastUpdate: string | null }>({ count: 0, size: 0, lastUpdate: null })
  
  // 从存储加载简历（服务端优先）
  useEffect(() => {
    const loadData = async () => {
      try {
        const loadedResumes = await ResumeStorageService.loadResumes()
        // 兼容旧数据：若缺少职位分类则自动补充
        const enriched = loadedResumes.map(r => {
          if (!r.jobCategory && r.parseStatus === 'success') {
            const combined = [r.title, r.targetRole, r.summary, r.textContent].filter(Boolean).join(' ')
            const enumCategory = translationMappingService.normalizeJobCategory(combined || '')
            return { ...r, jobCategory: mapJobCategoryToChinese(enumCategory) }
          }
          return r
        })
        setResumes(enriched)
        // 初始化存储统计
        const stats = ResumeStorageService.getStats()
        setStorageStats(stats)
        console.log('[ResumeLibrary] Loaded', loadedResumes.length, 'resumes')
      } catch (e) {
        console.error('[ResumeLibrary] Failed to load:', e)
      }
    }
    loadData()
  }, [])

  // 保存到存储（当 resumes 变化时）
  useEffect(() => {
    const saveData = async () => {
      if (resumes.length > 0) {
        try {
          await ResumeStorageService.saveResumes(resumes)
          // 更新统计
          const stats = ResumeStorageService.getStats()
          setStorageStats(stats)
        } catch (e) {
          console.error('[ResumeLibrary] Failed to save:', e)
          alert('保存失败：' + (e as Error).message)
        }
      }
    }
    
    // 防抖：避免频繁保存
    const timeoutId = setTimeout(saveData, 1000)
    return () => clearTimeout(timeoutId)
  }, [resumes])

  const singleFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleResumeFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    
    setIsLoading(true)
    const totalFiles = fileList.length
    let processed = 0
    
    const newItems: ResumeItem[] = []
    for (const file of Array.from(fileList)) {
      processed++
      setUploadProgress(`正在处理 ${processed}/${totalFiles}: ${file.name}`)
      
      const blobURL = URL.createObjectURL(file)
      console.log(`[ResumeLibrary] Processing (${processed}/${totalFiles}): ${file.name} (${file.type}, ${file.size} bytes)`)
      
      try {
        const parsed = await parseResumeFileEnhanced(file)
        console.log(`[ResumeLibrary] Parse result:`, parsed)
        // 自动职位分类（结合标题、求职方向、摘要、全文）
        const combined = [parsed.title, parsed.targetRole, parsed.summary, parsed.textContent]
          .filter(Boolean)
          .join(' ')
        const enumCategory = translationMappingService.normalizeJobCategory(combined || '')
        const jobCategory = mapJobCategoryToChinese(enumCategory)

        newItems.push({
          id: `resume_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          fileType: file.type || 'unknown',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          blobURL,
          name: parsed.name,
          title: parsed.title,
          gender: parsed.gender,
          location: parsed.location,
          targetRole: parsed.targetRole,
          education: parsed.education,
          graduationYear: parsed.graduationYear,
          summary: parsed.summary,
          textContent: parsed.textContent,
          jobCategory,
          parseStatus: parsed.success ? 'success' : 'failed'
        })
      } catch (e) {
        console.error(`[ResumeLibrary] Parse error for ${file.name}:`, e)
        newItems.push({
          id: `resume_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          fileName: file.name,
          fileType: file.type || 'unknown',
          size: file.size,
          uploadedAt: new Date().toISOString(),
          blobURL,
          parseStatus: 'failed'
        } as ResumeItem)
      }
      
      // 实时更新（每处理 5 个文件更新一次）
      if (processed % 5 === 0 || processed === totalFiles) {
        setResumes(prev => [...newItems, ...prev])
      }
    }
    
    // 最终更新
    setResumes(prev => [...newItems, ...prev])
    setIsLoading(false)
    setUploadProgress('')
    
    console.log(`[ResumeLibrary] Completed: ${newItems.length} resumes processed`)
  }
  
  // 选项集合（动态）
  const categoryOptions = ['全部', ...Array.from(new Set(resumes.map(r => r.jobCategory).filter(Boolean))) as string[]]
  const locationOptions = ['全部', ...Array.from(new Set(resumes.map(r => (r.location || '').trim()).filter(loc => loc && loc !== '-')))]
  const directionOptions = ['全部', ...Array.from(new Set(resumes.map(r => (r.targetRole || '').trim()).filter(d => d && d !== '-')))]

  // 过滤与搜索
  const filteredResumes = resumes.filter(r => {
    const matchCategory = filters.category === '全部' || (r.jobCategory === filters.category)
    const matchLocation = filters.location === '全部' || ((r.location || '').includes(filters.location))
    const matchDirection = filters.direction === '全部' || ((r.targetRole || '').includes(filters.direction))
    const term = searchTerm.trim().toLowerCase()
    const matchSearch = term === '' || [
      r.name || '',
      r.title || '',
      r.education || '',
      r.summary || '',
      r.textContent || ''
    ].some(t => t.toLowerCase().includes(term))
    return matchCategory && matchLocation && matchDirection && matchSearch
  })
  
  // 删除简历
  const handleDeleteResume = (id: string) => {
    if (confirm('确定要删除这份简历吗？')) {
      setResumes(prev => prev.filter(r => r.id !== id))
      console.log('[ResumeLibrary] Deleted resume:', id)
    }
  }
  
  // 清空所有简历
  const handleClearAll = async () => {
    if (confirm('确定要清空所有简历吗？此操作不可恢复！')) {
      setResumes([])
      await ResumeStorageService.clearAllResumes()
      console.log('[ResumeLibrary] Cleared all resumes')
    }
  }
  
  // 导出简历数据
  const handleExport = () => {
    try {
      const json = ResumeStorageService.exportToJSON()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `haigoo-resumes-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('导出失败：' + (e as Error).message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="p-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex items-center gap-3">
              <Upload className="w-4 h-4 text-haigoo-primary" />
              <span className="text-sm font-medium text-gray-700">简历库管理</span>
              {/* 存储统计 */}
              <span className="text-xs text-gray-500">
                {storageStats.count > 0 && (
                  <>
                    已保存 {storageStats.count} 份 · 约 {(storageStats.size/1024/1024).toFixed(2)}MB
                  </>
                )}
              </span>
              {/* 存储接近上限警告 */}
              {storageStats.size > 4.5 * 1024 * 1024 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                  <AlertCircle className="w-3 h-3" /> 存储接近浏览器上限，请及时导出或清理
                </span>
              )}
              {isLoading && (
                <span className="text-xs text-blue-600 animate-pulse">{uploadProgress || '正在解析上传文件...'}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={() => singleFileInputRef.current?.click()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-3 h-3" />
                上传文件
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderOpen className="w-3 h-3" />
                上传文件夹
              </button>
              <button
                onClick={handleExport}
                disabled={resumes.length === 0}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-blue-300 rounded-md hover:bg-blue-50 text-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-3 h-3" />
                导出数据
              </button>
              <button
                onClick={handleClearAll}
                disabled={resumes.length === 0}
                className="inline-flex items-center gap-2 h-9 px-3 text-sm border border-red-300 rounded-md hover:bg-red-50 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3 h-3" />
                清空数据
              </button>
            </div>
          </div>
          {/* 搜索与筛选条（单行不换行） */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
              {/* 搜索框 */}
              <div className="relative min-w-[280px] flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="搜索：姓名 / 教育 / 工作等关键词"
                  className="w-full h-9 pl-9 pr-3 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {/* 筛选：职位类别 */}
              <div className="flex items-center gap-2 h-9 px-2 border border-gray-300 rounded-md bg-white min-w-[200px]">
                <span className="text-xs text-gray-500 whitespace-nowrap">职位类别</span>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="flex-1 h-full bg-transparent outline-none border-0 text-sm"
                >
                  {categoryOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {/* 筛选：地点 */}
              <div className="flex items-center gap-2 h-9 px-2 border border-gray-300 rounded-md bg-white min-w-[200px]">
                <span className="text-xs text-gray-500 whitespace-nowrap">地点</span>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                  className="flex-1 h-full bg-transparent outline-none border-0 text-sm"
                >
                  {locationOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              {/* 筛选：求职方向 */}
              <div className="flex items-center gap-2 h-9 px-2 border border-gray-300 rounded-md bg-white min-w-[220px]">
                <span className="text-xs text-gray-500 whitespace-nowrap">求职方向</span>
                <select
                  value={filters.direction}
                  onChange={(e) => setFilters(prev => ({ ...prev, direction: e.target.value }))}
                  className="flex-1 h-full bg-transparent outline-none border-0 text-sm"
                >
                  {directionOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] table-auto">
            <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-12 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序号</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">职位</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地点</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">求职方向</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">教育背景</th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">毕业年限</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工作经历</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">职位类别</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">上传时间</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">解析状态</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredResumes.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-sm text-gray-500" colSpan={13}>
                    暂无数据，请上传简历或调整筛选条件
                  </td>
                </tr>
              ) : filteredResumes.map((r, idx) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.name || '解析失败'} maxLines={1}>
                      <div className="text-sm text-gray-900">{r.name || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.title || '解析失败'} maxLines={3}>
                      <div className="text-sm text-gray-900 break-words min-w-0 max-w-[220px]">{r.title || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.location || '解析失败'} maxLines={3}>
                      <div className="text-sm text-gray-700 break-words min-w-0 max-w-[200px]">{r.location || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.targetRole || '解析失败'} maxLines={3}>
                      <div className="text-sm text-gray-700 break-words min-w-0 max-w-[220px]">{r.targetRole || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.education || '解析失败'} maxLines={3}>
                      <div className="text-sm text-gray-700 break-words min-w-0 max-w-[220px]">{r.education || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.graduationYear || '解析失败'} maxLines={1} clampChildren={false}>
                      <span className="text-sm text-gray-700">{r.graduationYear || '-'}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.summary || '解析失败'} maxLines={3}>
                      <div className="text-sm text-gray-700 break-words min-w-0 max-w-[240px]">{r.summary || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.jobCategory || '未分类'} maxLines={1} clampChildren={false}>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">{r.jobCategory || '未分类'}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    {new Date(r.uploadedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-600">
                    <Tooltip content={`${r.fileName}\n${(r.size/1024).toFixed(1)} KB`} maxLines={3} clampChildren={true}>
                      <div className="flex items-start gap-2 max-w-[240px]">
                        <FileText className="w-3 h-3 text-gray-400 mt-0.5" />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-gray-900 text-sm break-words">{r.fileName}</span>
                          <span className="text-gray-500 break-words">{r.fileType || '未知类型'}</span>
                        </div>
                      </div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.parseStatus === 'success' ? '解析成功' : '解析失败'} maxLines={1} clampChildren={false}>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${r.parseStatus === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {r.parseStatus === 'success' ? '成功' : '解析失败'}
                      </span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap overflow-hidden">
                    <div className="flex items-center gap-1 truncate">
                      <button
                        onClick={() => { setViewingResume(r); setShowResumeModal(true); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" /> 详情
                      </button>
                      <button
                        onClick={() => { setEditingResume(r); setShowEditModal(true); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors"
                      >
                        <Edit3 className="w-3 h-3" /> 编辑
                      </button>
                      <button
                        onClick={() => handleDeleteResume(r.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3 h-3" /> 删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 详情弹窗 */}
      {showResumeModal && viewingResume && (
        <ResumeDetailModal
          item={viewingResume}
          onClose={() => {
            setShowResumeModal(false)
            setViewingResume(null)
          }}
        />
      )}

      {/* 编辑弹窗 */}
      {showEditModal && editingResume && (
        <ResumeEditModal
          item={editingResume}
          onClose={() => { setShowEditModal(false); setEditingResume(null) }}
          onSave={(updated) => {
            // 重新分类
            const combined = [updated.title, updated.targetRole, updated.summary, updated.textContent]
              .filter(Boolean).join(' ')
            const enumCategory = translationMappingService.normalizeJobCategory(combined || '')
            const jobCategory = mapJobCategoryToChinese(enumCategory)
            const merged = { ...updated, jobCategory }
            setResumes(prev => prev.map(r => r.id === merged.id ? merged : r))
            setShowEditModal(false)
            setEditingResume(null)
          }}
        />
      )}
    </div>
  )
}

const Tooltip: React.FC<{
  content: string;
  children: React.ReactNode;
  maxLines?: number;
  clampChildren?: boolean;
  trigger?: 'hover' | 'click';
  forceShow?: boolean;
  usePortal?: boolean;
}> = ({ content, children, maxLines = 3, clampChildren = true, trigger = 'hover', forceShow = false, usePortal = true }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false)
  const [placeTop, setPlaceTop] = useState(true)
  const [portalPos, setPortalPos] = useState<{ top: number; left: number } | null>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const verticalOverflow = el.scrollHeight > el.clientHeight + 1
    const horizontalOverflow = el.scrollWidth > el.clientWidth + 1
    setShouldShowTooltip(verticalOverflow || horizontalOverflow)
  }, [content, maxLines, clampChildren])

  // 当使用门户渲染并显示气泡后，测量气泡尺寸并在需要时进行位置修正
  useEffect(() => {
    if (!usePortal || !showTooltip || !portalPos) return
    const tip = tooltipRef.current
    if (!tip) return
    const h = tip.offsetHeight
    const w = tip.offsetWidth
    let nextTop = portalPos.top
    let nextLeft = portalPos.left

    if (placeTop) {
      // 在上方显示时，容器实际顶部为 top - h（因为 translateY(-100%)）
      const actualTop = nextTop - h
      const minMargin = 8
      if (actualTop < minMargin) {
        nextTop = h + minMargin
      }
    } else {
      // 在下方显示时，避免底部越出视口
      const bottom = nextTop + h
      const maxBottom = window.innerHeight - 8
      if (bottom > maxBottom) {
        nextTop = Math.max(8, maxBottom - h)
      }
    }
    // 水平方向安全边距与最大宽度
    const maxWidth = 384
    nextLeft = Math.max(8, Math.min(nextLeft, window.innerWidth - maxWidth - 8))

    if (nextTop !== portalPos.top || nextLeft !== portalPos.left) {
      setPortalPos({ top: nextTop, left: nextLeft })
    }
  }, [usePortal, showTooltip, portalPos, placeTop])

  return (
    <div
      className="relative"
      onMouseEnter={trigger === 'hover' ? (() => {
        if (shouldShowTooltip) {
          const el = textRef.current
          if (el) {
            const rect = el.getBoundingClientRect()
            // 视口顶部过近则向下展开；阈值 96px
            const preferTop = rect.top > 96
            setPlaceTop(preferTop)
            // 计算固定定位坐标（使用门户渲染避免裁剪）
            const gap = 8
            const top = preferTop ? (rect.top - gap) : (rect.bottom + gap)
            // 预估最大宽度 24rem ≈ 384px，避免越出右侧
            const maxWidth = 384
            const leftSafe = Math.max(8, Math.min(rect.left, window.innerWidth - maxWidth - 8))
            setPortalPos({ top, left: leftSafe })
          }
          setShowTooltip(true)
        }
      }) : undefined}
      onMouseLeave={trigger === 'hover' ? (() => setShowTooltip(false)) : undefined}
    >
      <div
        ref={textRef}
        className={clampChildren ? 'overflow-hidden text-ellipsis' : ''}
        style={clampChildren ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.6em',
          maxHeight: `${maxLines * 1.6}em`
        } : undefined}
      >
        <div className={`${showTooltip ? 'ring-1 ring-blue-300/60 bg-blue-50/40 rounded-sm' : ''}`}>
          {children}
        </div>
      </div>
      {showTooltip && (shouldShowTooltip || forceShow) && (
        usePortal && portalPos ? (
          createPortal(
            <div
              ref={tooltipRef}
              className={`z-[9999] p-3 bg-gray-900/95 text-white text-sm rounded-lg shadow-2xl ring-1 ring-black/20 max-w-sm pointer-events-none`}
              style={{ position: 'fixed', top: portalPos.top, left: portalPos.left, transform: placeTop ? 'translateY(-100%)' : undefined }}
            >
              <div className="whitespace-pre-wrap break-words">{content}</div>
              {placeTop ? (
                <div className="absolute top-full left-4 w-0 h-0 border-l-5 border-r-5 border-t-5 border-transparent border-t-gray-900/95"></div>
              ) : (
                <div className="absolute bottom-full left-4 w-0 h-0 border-l-5 border-r-5 border-b-5 border-transparent border-b-gray-900/95"></div>
              )}
            </div>,
            document.body
          )
        ) : (
          <div className={`absolute ${placeTop ? '-top-2 left-0 -translate-y-full' : 'top-full left-0 mt-2'} z-[9999] p-3 bg-gray-900/95 text-white text-sm rounded-lg shadow-2xl ring-1 ring-black/20 max-w-sm pointer-events-none`}>
            <div className="whitespace-pre-wrap break-words">{content}</div>
            {placeTop ? (
              <div className="absolute top-full left-4 w-0 h-0 border-l-5 border-r-5 border-t-5 border-transparent border-t-gray-900/95"></div>
            ) : (
              <div className="absolute bottom-full left-4 w-0 h-0 border-l-5 border-r-5 border-b-5 border-transparent border-b-gray-900/95"></div>
            )}
          </div>
        )
      )}
    </div>
  )
}

// 当门户气泡首次显示后，测量其尺寸并修正坐标，保证在上方时不会被视口顶部遮挡
// 注意：依赖 Tooltip 组件的内部状态（showTooltip/placeTop/portalPos）
// 放在同文件中以便在构建后静态分析
// 由于 React Hooks 的作用域，需在组件内部添加如下 effect；为简洁起见，这里追加到文件末尾说明

const ResumeDetailModal: React.FC<{
  item: ResumeItem;
  onClose: () => void;
}> = ({ item, onClose }) => {
  const isImage = item.fileType.startsWith('image/')
  const isPDF = item.fileType.includes('pdf')
  const isDocx = item.fileName.toLowerCase().endsWith('.docx')

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">简历详情</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">解析信息</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">姓名:</span> {item.name || '解析失败'}</div>
                <div><span className="font-medium">Title:</span> {item.title || '-'}</div>
                <div><span className="font-medium">性别:</span> {item.gender || '-'}</div>
                <div><span className="font-medium">地点:</span> {item.location || '-'}</div>
                <div><span className="font-medium">求职方向:</span> {item.targetRole || '-'}</div>
                <div><span className="font-medium">毕业年限:</span> {item.graduationYear || '-'}</div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-2">文件信息</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">文件名:</span> {item.fileName}</div>
                <div><span className="font-medium">类型:</span> {item.fileType || '未知'}</div>
                <div><span className="font-medium">大小:</span> {(item.size/1024).toFixed(1)} KB</div>
                <div>
                  <a href={item.blobURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">在新窗口打开原件</a>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-medium text-gray-900 mb-2">原件预览</h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {isImage ? (
                <img src={item.blobURL} alt={item.fileName} className="w-full max-h-[70vh] object-contain" />
              ) : isPDF ? (
                <object data={item.blobURL} type="application/pdf" className="w-full h-[70vh]">
                  <div className="p-4">
                    <p className="text-sm text-gray-600">无法内嵌预览PDF，请点击上方链接在新窗口打开。</p>
                  </div>
                </object>
              ) : isDocx ? (
                <div className="p-4 bg-white">
                  {item.textContent ? (
                    <pre className="whitespace-pre-wrap break-words text-sm text-gray-800 max-h-[70vh] overflow-y-auto">{item.textContent}</pre>
                  ) : (
                    <p className="text-sm text-gray-600">DOCX未成功解析文本，可在新窗口下载查看原件。</p>
                  )}
                </div>
              ) : (
                <div className="p-4">
                  <p className="text-sm text-gray-600">暂不支持该文件类型的内嵌预览，请在新窗口打开。</p>
                </div>
              )}
            </div>
          </div>

          {item.textContent && (
            <div>
              <h3 className="font-medium text-gray-900 mb-2">文本内容</h3>
              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-[50vh] overflow-y-auto">
                {item.textContent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ResumeEditModal: React.FC<{
  item: ResumeItem;
  onClose: () => void;
  onSave: (updated: ResumeItem) => void;
}> = ({ item, onClose, onSave }) => {
  const [form, setForm] = useState<ResumeItem>({ ...item })
  const update = (key: keyof ResumeItem, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">编辑简历</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-600">姓名</label>
              <input value={form.name || ''} onChange={e => update('name', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-xs text-gray-600">Title</label>
              <input value={form.title || ''} onChange={e => update('title', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-xs text-gray-600">地点</label>
              <input value={form.location || ''} onChange={e => update('location', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-xs text-gray-600">求职方向</label>
              <input value={form.targetRole || ''} onChange={e => update('targetRole', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-xs text-gray-600">教育背景</label>
              <input value={form.education || ''} onChange={e => update('education', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
            <div>
              <label className="text-xs text-gray-600">毕业年限</label>
              <input value={form.graduationYear || ''} onChange={e => update('graduationYear', e.target.value)} className="w-full px-3 py-2 border rounded-md" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600">工作经历摘要</label>
            <textarea value={form.summary || ''} onChange={e => update('summary', e.target.value)} className="w-full px-3 py-2 border rounded-md h-28" />
          </div>
        </div>
        <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-sm border rounded-md">取消</button>
          <button
            onClick={() => onSave(form)}
            className="px-3 py-1.5 text-sm bg-haigoo-primary text-white rounded-md hover:bg-purple-700"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

export default ResumeLibraryPage
// 分类枚举到中文标签的映射
function mapJobCategoryToChinese(enumCategory: string | undefined): string | undefined {
  if (!enumCategory) return undefined
  const map: Record<string, string> = {
    product: '产品管理',
    development: '软件开发',
    design: 'UI/UX设计',
    marketing: '市场营销',
    sales: '销售',
    operations: '运营',
    hr: '人力资源',
    finance: '财务',
    legal: '法律',
    customer_service: '客户支持',
    data_science: '数据科学',
    security: '安全',
    qa: '质量保证',
    devops: 'DevOps',
    management: '管理',
    other: '其他'
  }
  return map[enumCategory] || '其他'
}