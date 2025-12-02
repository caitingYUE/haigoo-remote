import React, { useState, useEffect, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import getCroppedImg from '../utils/cropImage'

import { Plus, Search, Globe, Linkedin, Briefcase, Trash2, Edit2, ExternalLink, Loader2, CheckCircle, XCircle, Upload, ZoomIn, ZoomOut, RefreshCw, Database } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { ClassificationService } from '../services/classification-service'
import { CompanyIndustry } from '../types/rss-types'
import AdminCompanyJobsModal from '../components/AdminCompanyJobsModal'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

export default function AdminTrustedCompaniesPage() {

    const { showSuccess, showError } = useNotificationHelpers()
    const { token } = useAuth()
    const [fetchDetailsEnabled, setFetchDetailsEnabled] = useState(false)
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<Partial<TrustedCompany> | null>(null)
    const [managingJobsCompany, setManagingJobsCompany] = useState<TrustedCompany | null>(null)
    const [crawling, setCrawling] = useState(false)
    const [processingImage, setProcessingImage] = useState(false)
    const [batchImporting, setBatchImporting] = useState(false)
    const [batchExporting, setBatchExporting] = useState(false)
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(12)

    // Crop State
    const [cropModalOpen, setCropModalOpen] = useState(false)
    const [tempImgSrc, setTempImgSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        careersPage: '',
        linkedin: '',
        description: '',
        logo: '',
        coverImage: '',
        address: '',
        tags: '',
        industry: '其他' as CompanyIndustry,
        canRefer: false
    })

    const loadCompanies = React.useCallback(async () => {
        try {
            setLoading(true)
            const data = await trustedCompaniesService.getAllCompanies()
            setCompanies(data)
        } catch (error) {
            showError('加载失败', '无法获取公司列表')
        } finally {
            setLoading(false)
        }
    }, [showError])

    useEffect(() => {
        loadCompanies()
    }, [loadCompanies])

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isModalOpen])

    const totalPages = Math.ceil(companies.length / pageSize)
    const paginatedCompanies = companies.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const renderPagination = () => {
        if (totalPages <= 1) return null

        const maxPagesToShow = 7
        let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
        const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1)

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1)
        }

        const pages = []
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i)
        }

        return (
            <div className="py-8 flex items-center justify-between border-t border-gray-200 mt-8">
                <div className="text-sm text-gray-500">
                    显示 {((currentPage - 1) * pageSize) + 1} 到 {Math.min(currentPage * pageSize, companies.length)} 条，共 {companies.length} 条
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        上一页
                    </button>

                    {startPage > 1 && (
                        <>
                            <button
                                onClick={() => setCurrentPage(1)}
                                className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 ${currentPage === 1 ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                            >
                                1
                            </button>
                            {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                        </>
                    )}

                    {pages.map(p => (
                        <button
                            key={p}
                            onClick={() => setCurrentPage(p)}
                            className={`px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 ${currentPage === p
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'border-gray-300 text-gray-700'
                                }`}
                        >
                            {p}
                        </button>
                    ))}

                    {endPage < totalPages && (
                        <>
                            {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 ${currentPage === totalPages ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                            >
                                {totalPages}
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        下一页
                    </button>
                </div>
            </div>
        )
    }



    const handleEdit = (company: TrustedCompany) => {
        setEditingCompany(company)
        setFormData({
            name: company.name,
            website: company.website,
            careersPage: company.careersPage,
            linkedin: company.linkedin || '',
            description: company.description || '',
            logo: company.logo || '',
            coverImage: company.coverImage || '',
            address: company.address || '',
            tags: company.tags ? company.tags.join(', ') : '',
            industry: company.industry || '其他',
            canRefer: !!company.canRefer
        })
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            name: '',
            website: '',
            careersPage: '',
            linkedin: '',
            description: '',
            logo: '',
            coverImage: '',
            address: '',
            tags: '',
            industry: '其他',
            canRefer: false
        })
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这个公司吗？')) return
        try {
            await trustedCompaniesService.deleteCompany(id)
            showSuccess('删除成功')
            loadCompanies()
        } catch (error) {
            showError('删除失败', error instanceof Error ? error.message : '未知错误')
        }
    }

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
            await trustedCompaniesService.saveCompany({
                id: editingCompany?.id,
                ...formData,
                tags: tagsArray
            })
            showSuccess('保存成功')
            setIsModalOpen(false)
            loadCompanies()
        } catch (error) {
            showError('保存失败', error instanceof Error ? error.message : '未知错误')
        }
    }

    const handleAutoFill = async () => {
        const url = formData.website || formData.careersPage
        if (!url) {
            showError('请输入官网或招聘页地址', '需要URL来抓取信息')
            return
        }

        try {
            setCrawling(true)
            const metadata = await trustedCompaniesService.fetchMetadata(url)

            if (!metadata) {
                showError('抓取失败', '无法获取网页信息，请手动输入')
                return
            }

            const classification = ClassificationService.classifyCompany(
                metadata.title || '',
                metadata.description || ''
            )

            setFormData(prev => ({
                ...prev,
                name: prev.name || metadata.title || '',
                description: prev.description || metadata.description || '',
                logo: prev.logo || metadata.icon || '',
                coverImage: prev.coverImage || metadata.image || '', // Map image to coverImage
                address: prev.address || metadata.address || '',
                industry: classification.industry,
                tags: prev.tags ? prev.tags : classification.tags.join(', ')
            }))
            showSuccess('抓取成功', '已自动填充部分信息')
        } catch (error) {
            showError('抓取失败', '无法获取网页信息，请手动输入')
        } finally {
            setCrawling(false)
        }
    }

    const handleCrawlJobs = async (company: TrustedCompany) => {
        try {
            setCrawling(true)
            const message = fetchDetailsEnabled
                ? `正在抓取 ${company.name} 的岗位（包含详细描述，可能需要较长时间）...`
                : `正在抓取 ${company.name} 的岗位...`
            showSuccess('开始抓取', message)

            // Build query string with optional detail fetching
            const params = new URLSearchParams({
                action: 'crawl-jobs',
                id: company.id,
                fetchDetails: fetchDetailsEnabled.toString(),
                maxDetails: '10'
            })

            const response = await fetch(`/api/data/trusted-companies?${params}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            const data = await response.json()
            if (data.success) {
                showSuccess('抓取完成', `成功抓取 ${data.count} 个岗位`)
            } else {
                showError('抓取失败', data.error)
            }
        } catch (error) {
            showError('抓取失败', '网络或服务器错误')
        } finally {
            setCrawling(false)
        }
    }

    const processImageFile = (file: File) => {
        if (!file.type.startsWith('image/')) {
            showError('文件格式错误', '请上传图片文件')
            return
        }
        const reader = new FileReader()
        reader.onload = () => {
            setTempImgSrc(reader.result as string)
            setCropModalOpen(true)
            setZoom(1)
            setCrop({ x: 0, y: 0 })
        }
        reader.readAsDataURL(file)
    }

    const handleCropSave = async () => {
        if (!tempImgSrc || !croppedAreaPixels) return
        try {
            setProcessingImage(true)
            const croppedImageBase64 = await getCroppedImg(tempImgSrc, croppedAreaPixels)

            const res = await fetch('/api/process-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: croppedImageBase64 })
            })
            const data = await res.json()
            if (data.success) {
                setFormData(prev => ({ ...prev, coverImage: data.image }))
                showSuccess('图片上传成功', '已更新封面图')
                setCropModalOpen(false)
                setTempImgSrc(null)
            } else {
                showError('上传失败', data.error)
            }
        } catch (err) {
            console.error(err)
            showError('处理失败', '无法处理图片')
        } finally {
            setProcessingImage(false)
        }
    }

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile()
                if (file) {
                    e.preventDefault()
                    await processImageFile(file)
                    return
                }
            }
        }
    }

    const handleBatchImport = async (file?: File) => {
        let selectedFile = file

        // If no file provided, prompt user to select one
        if (!selectedFile) {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.xlsx,.xls'
            input.onchange = async (e) => {
                const target = e.target as HTMLInputElement
                if (target.files && target.files[0]) {
                    await handleBatchImport(target.files[0])
                }
            }
            input.click()
            return
        }

        if (!window.confirm(`确定要导入 "${selectedFile.name}" 吗？这将导入所有未重复的企业数据并自动爬取logo等信息。`)) {
            return
        }

        try {
            setBatchImporting(true)
            showSuccess('开始导入', '正在读取Excel文件...')

            // Read file as base64
            const reader = new FileReader()
            reader.onload = async (e) => {
                try {
                    const base64 = e.target?.result as string
                    const fileBuffer = base64.split(',')[1] // Remove data:...;base64, prefix

                    const response = await fetch('/api/data/trusted-companies?action=batch-import', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            fileBuffer,
                            crawlMetadata: true
                        })
                    })

                    const data = await response.json()

                    if (data.success) {
                        showSuccess(
                            '导入成功',
                            `成功导入 ${data.imported} 个企业，跳过 ${data.skipped} 个重复企业，爬取 ${data.crawled} 个企业的元数据`
                        )
                        loadCompanies()
                    } else {
                        showError('导入失败', data.error || '未知错误')
                    }
                } catch (error) {
                    console.error('Batch import error:', error)
                    showError('导入失败', error instanceof Error ? error.message : '网络或服务器错误')
                } finally {
                    setBatchImporting(false)
                }
            }
            reader.onerror = () => {
                showError('文件读取失败', '无法读取Excel文件')
                setBatchImporting(false)
            }
            reader.readAsDataURL(selectedFile)
        } catch (error) {
            console.error('File selection error:', error)
            showError('文件选择失败', error instanceof Error ? error.message : '未知错误')
            setBatchImporting(false)
        }
    }

    const handleBatchExport = async () => {
        try {
            setBatchExporting(true)
            showSuccess('开始导出', '正在生成Excel文件...')

            const response = await fetch('/api/data/trusted-companies?action=batch-export', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })

            const data = await response.json()
            
            if (data.success) {
                // Convert base64 to blob and download
                const binaryString = atob(data.fileData)
                const bytes = new Uint8Array(binaryString.length)
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i)
                }
                const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
                
                // Create download link
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = data.fileName
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                window.URL.revokeObjectURL(url)
                
                showSuccess('导出成功', `成功导出 ${data.count} 个企业数据`)
            } else {
                showError('导出失败', data.error || '未知错误')
            }
        } catch (error) {
            console.error('Batch export error:', error)
            showError('导出失败', error instanceof Error ? error.message : '网络或服务器错误')
        } finally {
            setBatchExporting(false)
        }
    }

    return (
        <div className="w-full p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">企业库</h1>
                        <p className="text-gray-500 mt-1">管理经过认证的优质远程企业名单，支持行业分类和标签</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={fetchDetailsEnabled}
                                onChange={(e) => setFetchDetailsEnabled(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            抓取详细描述
                        </label>
                        <button
                            onClick={handleBatchExport}
                            disabled={batchExporting || companies.length === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {batchExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                            {batchExporting ? '导出中...' : '批量导出'}
                        </button>
                        <button
                            onClick={() => handleBatchImport()}
                            disabled={batchImporting}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {batchImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                            {batchImporting ? '导入中...' : '批量导入'}
                        </button>
                        <button
                            onClick={handleAdd}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            新增企业
                        </button>
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {paginatedCompanies.map(company => (
                                <div key={company.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
                                {/* Image Preview Area */}
                                <div className="w-full h-32 bg-gray-50 relative border-b border-gray-100 group">
                                    {company.coverImage ? (
                                        <img src={company.coverImage} alt={company.name} className="w-full h-full object-cover" />
                                    ) : company.logo ? (
                                        <img src={company.logo} alt={company.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                                            <span className="text-4xl font-bold opacity-20">{company.name.charAt(0)}</span>
                                        </div>
                                    )}

                                    {/* Action Buttons Overlay */}
                                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleCrawlJobs(company)}
                                            disabled={crawling}
                                            className="p-1.5 bg-white text-gray-600 hover:text-green-600 rounded-lg shadow-sm border border-gray-200 transition-colors"
                                            title="抓取岗位"
                                        >
                                            <Briefcase className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setManagingJobsCompany(company)}
                                            className="p-1.5 bg-white text-gray-600 hover:text-blue-600 rounded-lg shadow-sm border border-gray-200 transition-colors"
                                            title="管理岗位"
                                        >
                                            <Search className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleEdit(company)} className="p-1.5 bg-white text-gray-600 hover:text-blue-600 rounded-lg shadow-sm border border-gray-200 transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(company.id)} className="p-1.5 bg-white text-gray-600 hover:text-red-600 rounded-lg shadow-sm border border-gray-200 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {company.isTrusted && (
                                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-green-600 shadow-sm border border-gray-100">
                                            <CheckCircle className="w-3 h-3" /> 已审核
                                        </div>
                                    )}
                                    {company.canRefer && (
                                        <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-green-50/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-emerald-700 shadow-sm border border-emerald-100">
                                            可内推
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-gray-900 line-clamp-1 text-lg">{company.name}</h3>
                                                {company.industry && (
                                                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-100 whitespace-nowrap">
                                                        {company.industry}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                <span>更新于 {new Date(company.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                                        {company.description || '暂无描述'}
                                    </p>

                                    <div className="flex flex-wrap gap-2 mb-4">
                                        {company.tags?.slice(0, 3).map((tag, i) => (
                                            <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                        {company.website && (
                                            <a href={company.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600" title="官网">
                                                <Globe className="w-4 h-4" />
                                            </a>
                                        )}
                                        {company.careersPage && (
                                            <a href={company.careersPage} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600" title="招聘页">
                                                <Briefcase className="w-4 h-4" />
                                            </a>
                                        )}
                                        {company.linkedin && (
                                            <a href={company.linkedin} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600" title="LinkedIn">
                                                <Linkedin className="w-4 h-4" />
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {renderPagination()}

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingCompany ? '编辑企业' : '新增企业'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-full">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">企业名称 *</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                                placeholder="例如：GitLab"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAutoFill}
                                                disabled={crawling || (!formData.website && !formData.careersPage)}
                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                                            >
                                                {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                                                自动抓取
                                            </button>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">输入官网链接后点击自动抓取可快速填充信息</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">官网链接</label>
                                        <input
                                            type="url"
                                            value={formData.website}
                                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="https://..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">招聘页链接</label>
                                        <input
                                            type="url"
                                            value={formData.careersPage}
                                            onChange={e => setFormData({ ...formData, careersPage: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="https://.../careers"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn 链接</label>
                                        <input
                                            type="url"
                                            value={formData.linkedin}
                                            onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="https://linkedin.com/company/..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">企业地址 (国家/城市)</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={e => setFormData({ ...formData, address: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="例如：美国, 旧金山"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                        <input
                                            type="text"
                                            value={formData.logo}
                                            onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            placeholder="https://..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">封面图 (Cover Image)</label>
                                        <div
                                            className="space-y-2"
                                            onPaste={handlePaste}
                                        >
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={formData.coverImage}
                                                    onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="输入 URL 或粘贴图片 (Ctrl+V)"
                                                />
                                                <label className={`px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 cursor-pointer flex items-center gap-2 whitespace-nowrap ${processingImage ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                                    {processingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                                                    上传
                                                    <input
                                                        type="file"
                                                        className="hidden"
                                                        accept="image/*"
                                                        disabled={processingImage}
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0]
                                                            if (file) processImageFile(file)
                                                        }}
                                                    />
                                                </label>
                                            </div>

                                            {/* Preview */}
                                            {formData.coverImage && (
                                                <div className="relative w-full aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group">
                                                    <img src={formData.coverImage} alt="Preview" className="w-full h-full object-cover" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setFormData({ ...formData, coverImage: '' })}
                                                        className="absolute top-2 right-2 p-1 bg-white/90 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}

                                            <p className="text-xs text-gray-500">
                                                支持粘贴图片、上传文件或输入 URL。系统会自动裁剪为 16:9 (1200x675)。
                                            </p>
                                        </div>
                                    </div>

                                    <div className="col-span-full">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">企业简介</label>
                                        <textarea
                                            rows={4}
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="简要介绍企业业务、文化及远程办公政策..."
                                        />
                                    </div>

                                    <div className="col-span-full">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">行业分类</label>
                                        <select
                                            value={formData.industry}
                                            onChange={e => setFormData({ ...formData, industry: e.target.value as CompanyIndustry })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                        >
                                            <option value="其他">其他</option>
                                            <option value="互联网/软件">互联网/软件</option>
                                            <option value="人工智能">人工智能</option>
                                            <option value="大健康/医疗">大健康/医疗</option>
                                            <option value="教育">教育</option>
                                            <option value="金融/Fintech">金融/Fintech</option>
                                            <option value="电子商务">电子商务</option>
                                            <option value="Web3/区块链">Web3/区块链</option>
                                            <option value="游戏">游戏</option>
                                            <option value="媒体/娱乐">媒体/娱乐</option>
                                            <option value="企业服务/SaaS">企业服务/SaaS</option>
                                            <option value="硬件/物联网">硬件/物联网</option>
                                            <option value="消费生活">消费生活</option>
                                        </select>
                                    </div>

                                    <div className="col-span-full">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.tags}
                                            onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="SaaS, DevOps, 全球远程, 异步协作"
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                                            <input
                                                type="checkbox"
                                                checked={formData.canRefer}
                                                onChange={e => setFormData({ ...formData, canRefer: e.target.checked })}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            可内推
                                        </label>
                                        <p className="text-xs text-gray-500">勾选后，该企业职位将展示“可内推”标识</p>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                    >
                                        取消
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                                    >
                                        保存
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Jobs Management Modal */}
                {managingJobsCompany && (
                    <AdminCompanyJobsModal
                        company={managingJobsCompany}
                        onClose={() => setManagingJobsCompany(null)}
                    />
                )}
                {/* Crop Modal */}
                {cropModalOpen && tempImgSrc && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl flex flex-col shadow-xl overflow-hidden h-[80vh]">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-white z-10">
                                <h2 className="text-lg font-bold text-gray-900">裁剪封面图 (16:9)</h2>
                                <button onClick={() => setCropModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="relative flex-1 bg-gray-900 w-full">
                                <Cropper
                                    image={tempImgSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={16 / 9}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                    objectFit="contain"
                                />
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100">
                                <div className="flex items-center gap-4 mb-4">
                                    <ZoomOut className="w-5 h-5 text-gray-500" />
                                    <input
                                        type="range"
                                        value={zoom}
                                        min={1}
                                        max={3}
                                        step={0.1}
                                        aria-labelledby="Zoom"
                                        onChange={(e) => setZoom(Number(e.target.value))}
                                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                    />
                                    <ZoomIn className="w-5 h-5 text-gray-500" />
                                </div>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setCropModalOpen(false)}
                                        className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleCropSave}
                                        disabled={processingImage}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {processingImage && <Loader2 className="w-4 h-4 animate-spin" />}
                                        确认裁剪并上传
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div >
    )
}
