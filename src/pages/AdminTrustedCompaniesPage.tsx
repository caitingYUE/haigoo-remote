import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    Building2, Search, Plus, Edit2, Trash2,
    ExternalLink, X, Loader2,
    Wand2, DownloadCloud, Upload, Image as ImageIcon
} from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { CompanyIndustry } from '../types/rss-types'
import Cropper, { Area } from 'react-easy-crop'
import getCroppedImg from '../utils/cropImage'
import { ClassificationService } from '../services/classification-service'

export default function AdminTrustedCompaniesPage() {
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Pagination & Sort State
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalItems, setTotalItems] = useState(0)
    const [sortBy, setSortBy] = useState('updatedAt')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
    const [industryFilter, setIndustryFilter] = useState('all')
    const PAGE_SIZE = 20

    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<TrustedCompany | null>(null)
    const [formData, setFormData] = useState<Partial<TrustedCompany>>({})
    const [saving, setSaving] = useState(false)

    // New states for automation features
    const [crawlingId, setCrawlingId] = useState<string | null>(null)
    const [autoFilling, setAutoFilling] = useState(false)
    const [analyzingId, setAnalyzingId] = useState<string | null>(null)
    const [filterCanRefer, setFilterCanRefer] = useState<'all' | 'yes' | 'no'>('all')

    // Cover image upload & crop
    const [coverSource, setCoverSource] = useState<string>('')
    const [showCropper, setShowCropper] = useState(false)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [processingImage, setProcessingImage] = useState(false)
    const [coverUrlInput, setCoverUrlInput] = useState('')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
        loadCompanies()
    }, [page, sortBy, sortOrder, industryFilter, filterCanRefer])

    const loadCompanies = async () => {
        try {
            setLoading(true)
            const data = await trustedCompaniesService.getAllCompanies({
                page,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                industry: industryFilter,
                search: searchTerm,
                canRefer: filterCanRefer
            })
            if (Array.isArray(data)) {
                setCompanies(data)
                setTotalPages(1)
                setTotalItems(data.length)
            } else {
                setCompanies(data.companies)
                setTotalPages(data.totalPages)
                setTotalItems(data.total)
            }
        } catch (error) {
            console.error('Failed to load companies:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('desc')
        }
    }

    const handleEdit = (company: TrustedCompany) => {
        setEditingCompany(company)
        setFormData({ ...company })
        setCoverUrlInput(company.coverImage || '')
        resetCropperState()
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            isTrusted: true,
            canRefer: false,
            tags: []
        })
        setCoverUrlInput('')
        resetCropperState()
        setIsModalOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个可信企业吗？删除后相关的岗位也会被删除。')) return

        try {
            const success = await trustedCompaniesService.deleteCompany(id)
            if (success) {
                setCompanies(companies.filter(c => c.id !== id))
            } else {
                alert('删除失败')
            }
        } catch (error) {
            console.error('Delete failed:', error)
            alert('删除出错')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.name) return

        try {
            setSaving(true)
            const success = await trustedCompaniesService.saveCompany(formData)

            if (success) {
                setIsModalOpen(false)
                setCoverUrlInput('')
                loadCompanies()
            } else {
                alert('保存失败')
            }
        } catch (error) {
            console.error('Save failed:', error)
            alert('保存出错')
        } finally {
            setSaving(false)
        }
    }

    // New Automation Handlers
    const handleAutoFill = async () => {
        if (!formData.website) {
            alert('请先输入官网链接')
            return
        }
        try {
            setAutoFilling(true)
            const metadata = await trustedCompaniesService.fetchMetadata(formData.website)
            if (metadata) {
                setFormData(prev => ({
                    ...prev,
                    description: metadata.description || prev.description,
                    logo: metadata.icon || metadata.image || prev.logo,
                    coverImage: metadata.image || prev.coverImage
                }))
                // If name is empty, try to use title
                if (!formData.name && metadata.title) {
                    setFormData(prev => ({ ...prev, name: metadata.title }))
                }
            } else {
                alert('无法抓取到信息，请手动填写')
            }
        } catch (error) {
            console.error('Auto fill failed:', error)
            alert('抓取失败')
        } finally {
            setAutoFilling(false)
        }
    }

    const handleCrawlJobs = async (id: string) => {
        try {
            setCrawlingId(id)
            const result = await trustedCompaniesService.crawlJobs(id, true, 10) // default options
            if (result.success) {
                alert(`抓取成功！新增/更新了 ${result.count || 0} 个岗位`)
                loadCompanies() // reload to update job counts
            } else {
                alert('抓取失败: ' + (result.error || '未知错误'))
            }
        } catch (error) {
            console.error('Crawl jobs failed:', error)
            alert('抓取请求失败')
        } finally {
            setCrawlingId(null)
        }
    }

    const handleFetchLinkedInInfo = async () => {
        if (!formData.linkedin) {
            alert('请先输入LinkedIn链接');
            return;
        }

        try {
            const response = await fetch(`/api/data/trusted-companies?action=crawl&url=${encodeURIComponent(formData.linkedin)}&translate=true`);
            const data = await response.json();

            if (data.error) {
                alert('获取失败: ' + data.error);
                return;
            }

            setFormData(prev => ({
                ...prev,
                description: data.description || prev.description,
                logo: data.logo || prev.logo,
                address: data.address || prev.address,
                coverImage: data.coverImage || prev.coverImage
            }));

            alert('获取成功！请检查并补充信息。');
        } catch (error) {
            console.error('Fetch LinkedIn error:', error);
            alert('获取失败，请稍后重试');
        }
    };

    const openCropperWithSource = (source: string) => {
        // Fix CORS issues by proxying remote images
        if (source.startsWith('http') && !source.includes('/api/images')) {
            setCoverSource(`/api/images?url=${encodeURIComponent(source)}`)
        } else {
            setCoverSource(source)
        }
        setShowCropper(true)
    }

    const resetCropperState = () => {
        setCoverSource('')
        setShowCropper(false)
        setCrop({ x: 0, y: 0 })
        setZoom(1)
        setCroppedAreaPixels(null)
        setProcessingImage(false)
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !file.type.startsWith('image/')) return
        const reader = new FileReader()
        reader.onload = () => {
            const result = reader.result as string
            openCropperWithSource(result)
        }
        reader.readAsDataURL(file)
    }

    const handlePasteImage = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const pastedFile = e.clipboardData.files?.[0]
        if (pastedFile && pastedFile.type.startsWith('image/')) {
            const reader = new FileReader()
            reader.onload = () => {
                openCropperWithSource(reader.result as string)
            }
            reader.readAsDataURL(pastedFile)
            return
        }
        const text = e.clipboardData.getData('text')
        if (text && text.startsWith('http')) {
            openCropperWithSource(text.trim())
        }
    }

    const handleLoadCoverFromUrl = () => {
        if (!coverUrlInput) return
        openCropperWithSource(coverUrlInput.trim())
    }

    const onCropComplete = useCallback((_croppedArea: Area, croppedPixels: Area) => {
        setCroppedAreaPixels(croppedPixels)
    }, [])

    const handleApplyCrop = async () => {
        if (!coverSource || !croppedAreaPixels) return

        try {
            setProcessingImage(true)
            const croppedImage = await getCroppedImg(coverSource, croppedAreaPixels)
            if (croppedImage) {
                setFormData(prev => ({ ...prev, coverImage: croppedImage }))
                setCoverSource('')
                setShowCropper(false)
            }
        } catch (e) {
            console.error('Failed to crop image:', e)
        } finally {
            setProcessingImage(false)
        }
    }

    const handleAnalyzeCurrent = () => {
        if (!formData.name && !formData.description) {
            alert('请先填写企业名称或简介后再分析')
            return
        }
        const { industry, tags } = ClassificationService.classifyCompany(formData.name || '', formData.description || '')
        setFormData(prev => ({
            ...prev,
            industry,
            tags: Array.from(new Set([...(Array.isArray(prev.tags) ? prev.tags : (prev.tags ? [prev.tags as any] : [])), ...tags]))
        }))
    }

    const handleQuickAnalyze = async (company: TrustedCompany) => {
        if (!company.description && !company.website) {
            alert('该企业暂无简介，无法分析')
            return
        }
        try {
            setAnalyzingId(company.id)
            const result = ClassificationService.classifyCompany(company.name, company.description || '')
            const payload = {
                ...company,
                industry: result.industry,
                tags: Array.from(new Set([...(company.tags || []), ...result.tags]))
            }
            const success = await trustedCompaniesService.saveCompany(payload)
            if (success) {
                setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, ...payload } : c))
            } else {
                alert('分析后保存失败')
            }
        } catch (error) {
            console.error('分析失败', error)
            alert('分析失败，请重试')
        } finally {
            setAnalyzingId(null)
        }
    }

    const industries: CompanyIndustry[] = [
        '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
        '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
        '硬件/物联网', '消费生活', '其他'
    ]

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        loadCompanies()
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    可信企业管理
                </h1>
                <div className="flex gap-3">
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        添加企业
                    </button>
                </div>
            </div>

            <form onSubmit={handleSearch} className="mb-6 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="搜索企业名称、简介..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={industryFilter}
                    onChange={(e) => {
                        setIndustryFilter(e.target.value)
                        setPage(1)
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                    <option value="all">所有行业</option>
                    {industries.map(ind => (
                        <option key={ind} value={ind}>{ind}</option>
                    ))}
                </select>
                <select
                    value={filterCanRefer}
                    onChange={(e) => {
                        setFilterCanRefer(e.target.value as 'all' | 'yes' | 'no')
                        setPage(1)
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                    <option value="all">全部内推状态</option>
                    <option value="yes">可内推</option>
                    <option value="no">不可内推</option>
                </select>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                    搜索
                </button>
            </form>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">行业</th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[130px] cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('jobCount')}
                                >
                                    <div className="flex items-center gap-1">
                                        在招岗位
                                        {sortBy === 'jobCount' && (
                                            <span className="text-gray-700">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[130px] cursor-pointer hover:bg-gray-100 select-none"
                                    onClick={() => handleSort('updatedAt')}
                                >
                                    <div className="flex items-center gap-1">
                                        更新时间
                                        {sortBy === 'updatedAt' && (
                                            <span className="text-gray-700">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">链接</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {companies.map(company => (
                                <tr key={company.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                                                {company.logo ? (
                                                    <img src={company.logo} alt="" className="h-full w-full object-contain p-1" />
                                                ) : (
                                                    <Building2 className="w-5 h-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div className="ml-4 max-w-xs">
                                                <div className="font-medium text-gray-900 flex items-center gap-2">
                                                    {company.name}
                                                    {company.canRefer && (
                                                        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded border border-green-200 whitespace-nowrap">
                                                            内推
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-gray-500 truncate" title={company.description}>
                                                    {company.description || '暂无简介'}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {company.industry || '未分类'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        {company.jobCount ?? 0}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {company.lastCrawledAt ? (
                                            <div className="flex flex-col">
                                                <span>{new Date(company.lastCrawledAt).toLocaleDateString()}</span>
                                                <span className="text-xs text-gray-400">{new Date(company.lastCrawledAt).toLocaleTimeString()}</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex gap-2">
                                            {company.website && (
                                                <a href={company.website} target="_blank" rel="noreferrer" title="官网" className="text-gray-400 hover:text-indigo-600">
                                                    <GlobeIcon />
                                                </a>
                                            )}
                                            {company.careersPage && (
                                                <a href={company.careersPage} target="_blank" rel="noreferrer" title="招聘主页" className="text-gray-400 hover:text-indigo-600">
                                                    <BriefcaseIcon />
                                                </a>
                                            )}
                                            {company.linkedin && (
                                                <a href={company.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="text-gray-400 hover:text-indigo-600">
                                                    <LinkedinIcon />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <button
                                            onClick={() => handleCrawlJobs(company.id)}
                                            disabled={crawlingId === company.id}
                                            className="text-gray-600 hover:text-indigo-600 mr-4 disabled:opacity-50"
                                            title="抓取岗位数据"
                                        >
                                            {crawlingId === company.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <DownloadCloud className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button
                                            onClick={() => handleQuickAnalyze(company)}
                                            disabled={analyzingId === company.id}
                                            className="text-gray-600 hover:text-purple-600 mr-4 disabled:opacity-50"
                                            title="AI分析行业与标签"
                                        >
                                            {analyzingId === company.id ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Wand2 className="w-4 h-4" />
                                            )}
                                        </button>
                                        <button onClick={() => handleEdit(company)} className="text-indigo-600 hover:text-indigo-900 mr-4">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(company.id)} className="text-red-600 hover:text-red-900">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!loading && (
                <div className="mt-4 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        共 {totalItems} 条记录，当前第 {page} / {totalPages} 页
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm bg-white"
                        >
                            上一页
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let p = i + 1
                            if (totalPages > 5) {
                                if (page <= 3) p = i + 1
                                else if (page >= totalPages - 2) p = totalPages - 4 + i
                                else p = page - 2 + i
                            }

                            if (p < 1 || p > totalPages) return null

                            return (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`px-3 py-1 border rounded text-sm ${page === p ? 'bg-indigo-600 text-white' : 'hover:bg-gray-50 bg-white'}`}
                                >
                                    {p}
                                </button>
                            )
                        })}
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 text-sm bg-white"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold">
                                {editingCompany ? '编辑企业' : '添加企业'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">企业名称 *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name || ''}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <label className="block text-sm font-medium text-gray-700">行业</label>
                                        <button
                                            type="button"
                                            onClick={handleAnalyzeCurrent}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                                            title="根据简介自动生成行业与标签"
                                        >
                                            <Wand2 className="w-3 h-3" />
                                            AI分析
                                        </button>
                                    </div>
                                    <select
                                        value={formData.industry || ''}
                                        onChange={e => setFormData({ ...formData, industry: e.target.value as CompanyIndustry })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">选择行业</option>
                                        {industries.map(ind => (
                                            <option key={ind} value={ind}>{ind}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">官网链接</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={formData.website || ''}
                                            onChange={e => setFormData({ ...formData, website: e.target.value })}
                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://..."
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAutoFill}
                                            disabled={autoFilling || !formData.website}
                                            className="px-3 py-2 bg-gray-100 text-gray-600 rounded hover:bg-gray-200 disabled:opacity-50"
                                            title="自动抓取信息"
                                        >
                                            {autoFilling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                    <input
                                        type="url"
                                        value={formData.logo || ''}
                                        onChange={e => setFormData({ ...formData, logo: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div
                                onPaste={handlePasteImage}
                                className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-1">
                                        <label className="block text-sm font-medium text-gray-700">企业配图</label>
                                        <p className="text-xs text-gray-500">支持上传文件/URL/直接粘贴，建议裁剪为 16:9 以适配前台卡片</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 flex items-center gap-1 text-sm"
                                        >
                                            <Upload className="w-4 h-4" />
                                            上传文件
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleLoadCoverFromUrl}
                                            disabled={!coverUrlInput}
                                            className="px-3 py-2 bg-white border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50 flex items-center gap-1 text-sm"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            使用URL
                                        </button>
                                    </div>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <div className="mt-3 flex items-center gap-4">
                                    <div className="w-48 h-28 rounded-lg bg-white border border-gray-200 overflow-hidden flex items-center justify-center">
                                        {formData.coverImage ? (
                                            <img src={formData.coverImage} alt="配图" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-gray-400 flex flex-col items-center text-sm">
                                                <ImageIcon className="w-6 h-6 mb-1" />
                                                预览
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <input
                                            type="url"
                                            value={coverUrlInput}
                                            onChange={e => setCoverUrlInput(e.target.value)}
                                            placeholder="https://...（粘贴图片链接后点击使用URL）"
                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <p className="text-xs text-gray-500">在此区域粘贴图片或链接即可触发上传，裁剪完成后自动更新配图</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">招聘主页 (Career Page)</label>
                                    <input
                                        type="url"
                                        value={formData.careersPage || ''}
                                        onChange={e => setFormData({ ...formData, careersPage: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={formData.linkedin || ''}
                                            onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://linkedin.com/company/..."
                                        />
                                        <button
                                            type="button"
                                            onClick={handleFetchLinkedInInfo}
                                            className="px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap"
                                            title="尝试抓取公开信息"
                                        >
                                            <Wand2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">总部地址</label>
                                    <input
                                        type="text"
                                        value={formData.address || ''}
                                        onChange={e => setFormData({ ...formData, address: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">员工人数</label>
                                    <input
                                        type="text"
                                        value={formData.employeeCount || ''}
                                        onChange={e => setFormData({ ...formData, employeeCount: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 1000+"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">成立年份</label>
                                    <input
                                        type="text"
                                        value={formData.foundedYear || ''}
                                        onChange={e => setFormData({ ...formData, foundedYear: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 2010"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">领域/专长 (逗号分隔)</label>
                                <input
                                    type="text"
                                    value={Array.isArray(formData.specialties) ? formData.specialties.join(', ') : (formData.specialties || '')}
                                    onChange={e => setFormData({ ...formData, specialties: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. SaaS, AI, Cloud Computing"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                                <input
                                    type="text"
                                    value={Array.isArray(formData.tags) ? formData.tags.join(', ') : (formData.tags || '')}
                                    onChange={e => setFormData({
                                        ...formData,
                                        tags: e.target.value.split(/[,，]/).map(t => t.trim()).filter(Boolean)
                                    })}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    placeholder="例如: 远程, 弹性工作, 外企"
                                />
                            </div>

                            <div className="flex gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.isTrusted ?? true}
                                        onChange={e => setFormData({ ...formData, isTrusted: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">设为可信企业</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.canRefer ?? false}
                                        onChange={e => setFormData({ ...formData, canRefer: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">支持内推</span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {saving ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showCropper && coverSource && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-3xl shadow-2xl overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b">
                            <h3 className="text-lg font-semibold">裁剪企业配图</h3>
                            <button onClick={resetCropperState} className="text-gray-500 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4">
                            <div className="relative w-full h-[320px] bg-slate-100 rounded-lg overflow-hidden">
                                <Cropper
                                    image={coverSource}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={16 / 9}
                                    onCropChange={setCrop}
                                    onZoomChange={setZoom}
                                    onCropComplete={onCropComplete}
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-600">缩放</span>
                                <input
                                    type="range"
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    value={zoom}
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={resetCropperState}
                                        className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                                        type="button"
                                    >
                                        取消
                                    </button>
                                    <button
                                        onClick={handleApplyCrop}
                                        disabled={processingImage || !croppedAreaPixels}
                                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                                        type="button"
                                    >
                                        {processingImage && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {processingImage ? '处理中...' : '应用裁剪'}
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500">固定16:9比例，裁剪后会自动压缩保存</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function GlobeIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>
    )
}

function BriefcaseIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
    )
}

function LinkedinIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
            <rect x="2" y="9" width="4" height="12"></rect>
            <circle cx="4" cy="4" r="2"></circle>
        </svg>
    )
}
