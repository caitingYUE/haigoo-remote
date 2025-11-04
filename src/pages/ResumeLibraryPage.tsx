import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Upload, FileText, FolderOpen, Eye, X } from 'lucide-react'
import { ResumeItem } from '../types/resume-types'
import { parseResumeFile } from '../services/resume-parser'

const ResumeLibraryPage: React.FC = () => {
  const [resumes, setResumes] = useState<ResumeItem[]>([])
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [viewingResume, setViewingResume] = useState<ResumeItem | null>(null)

  const singleFileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleResumeFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const newItems: ResumeItem[] = []
    for (const file of Array.from(fileList)) {
      const blobURL = URL.createObjectURL(file)
      try {
        const parsed = await parseResumeFile(file)
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
          parseStatus: parsed.success ? 'success' : 'failed'
        })
      } catch (e) {
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
    }
    setResumes(prev => [...newItems, ...prev])
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-haigoo-primary" />
            <span className="text-sm font-medium text-gray-700">上传简历</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => singleFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <FileText className="w-3 h-3" />
              上传文件
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <FolderOpen className="w-3 h-3" />
              上传文件夹
            </button>
            <input
              ref={singleFileInputRef}
              type="file"
              accept=".doc,.docx,.pdf,.png,.jpg,.jpeg,.txt"
              multiple
              className="hidden"
              onChange={(e) => handleResumeFiles(e.target.files)}
            />
            <input
              ref={folderInputRef}
              type="file"
              // @ts-ignore WebKit directory selection
              webkitdirectory=""
              multiple
              className="hidden"
              onChange={(e) => handleResumeFiles(e.target.files)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">性别</th>
                <th className="w-48 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地点</th>
                <th className="w-56 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">求职方向</th>
                <th className="w-56 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">教育背景</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">毕业年限</th>
                <th className="w-56 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工作经历总结</th>
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">文件</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">解析状态</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">详情</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {resumes.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <Tooltip content={r.name || '解析失败'} maxLines={1}>
                      <div className="text-sm text-gray-900">{r.name || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.title || '解析失败'} maxLines={2}>
                      <div className="text-sm text-gray-900">{r.title || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.gender || '解析失败'} maxLines={1} clampChildren={false}>
                      <span className="text-xs text-gray-700">{r.gender || '-'}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.location || '解析失败'} maxLines={3}>
                      <div className="text-xs text-gray-700">{r.location || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.targetRole || '解析失败'} maxLines={3}>
                      <div className="text-xs text-gray-700">{r.targetRole || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.education || '解析失败'} maxLines={3}>
                      <div className="text-xs text-gray-700">{r.education || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.graduationYear || '解析失败'} maxLines={1} clampChildren={false}>
                      <span className="text-xs text-gray-700">{r.graduationYear || '-'}</span>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2">
                    <Tooltip content={r.summary || '解析失败'} maxLines={3}>
                      <div className="text-xs text-gray-700">{r.summary || <span className="text-gray-400">-</span>}</div>
                    </Tooltip>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    <Tooltip content={`${r.fileName}\n${(r.size/1024).toFixed(1)} KB`} maxLines={2} clampChildren={false}>
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 text-xs">{r.fileName}</span>
                        <span className="text-gray-500">{r.fileType || '未知类型'}</span>
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
                  <td className="px-3 py-2">
                    <button
                      onClick={() => { setViewingResume(r); setShowResumeModal(true); }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                    >
                      <Eye className="w-3 h-3" /> 详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showResumeModal && viewingResume && (
        <ResumeDetailModal
          item={viewingResume}
          onClose={() => {
            setShowResumeModal(false)
            setViewingResume(null)
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
}> = ({ content, children, maxLines = 3, clampChildren = true, trigger = 'hover', forceShow = false }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = textRef.current
    if (!el) return
    const verticalOverflow = el.scrollHeight > el.clientHeight + 1
    const horizontalOverflow = el.scrollWidth > el.clientWidth + 1
    setShouldShowTooltip(verticalOverflow || horizontalOverflow)
  }, [content, maxLines, clampChildren])

  return (
    <div
      className="relative"
      onMouseEnter={trigger === 'hover' ? (() => shouldShowTooltip && setShowTooltip(true)) : undefined}
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
        {children}
      </div>
      {showTooltip && (shouldShowTooltip || forceShow) && (
        <div className="absolute z-50 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg max-w-sm -top-2 left-0 transform -translate-y-full">
          <div className="whitespace-pre-wrap break-words">{content}</div>
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  )
}

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

export default ResumeLibraryPage