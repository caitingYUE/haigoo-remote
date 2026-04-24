import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
    Building2, Search, Plus, Edit2, Trash2,
    ExternalLink, X, Loader2,
    Wand2, DownloadCloud, Upload, Image as ImageIcon, RefreshCw,
    Globe as GlobeIcon, Briefcase as BriefcaseIcon, Linkedin as LinkedinIcon
} from 'lucide-react'
import { trustedCompaniesService, TrustedCompany, ReferralContact } from '../services/trusted-companies-service'
import { CompanyIndustry } from '../types/rss-types'
import Cropper, { Area } from 'react-easy-crop'
import getCroppedImg, { compressImage } from '../utils/cropImage'
import { ClassificationService } from '../services/classification-service'
import AdminCompanyJobsModal from '../components/AdminCompanyJobsModal'
import { joinTagInput, splitTagInput } from '../utils/tag-input'

export default function AdminTrustedCompaniesPage() {
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')

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
    const [selectedCompanyForJobs, setSelectedCompanyForJobs] = useState<TrustedCompany | null>(null)
    const [formData, setFormData] = useState<Partial<TrustedCompany>>({})
    const [saving, setSaving] = useState(false)

    // New states for automation features
    const [crawlingId, setCrawlingId] = useState<string | null>(null)
    const [autoFilling, setAutoFilling] = useState(false)
    const [filterMemberOnly, setFilterMemberOnly] = useState<'all' | 'yes' | 'no'>('all')

    // Batch crawl state
    const [batchCrawling, setBatchCrawling] = useState(false)
    const [batchProgress, setBatchProgress] = useState('')

    // Cover image upload & crop
    const [coverSource, setCoverSource] = useState<string>('')
    const [showCropper, setShowCropper] = useState(false)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
    const [processingImage, setProcessingImage] = useState(false)
    const [coverUrlInput, setCoverUrlInput] = useState('')
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    const normalizeEmailType = (emailType?: string) => {
        const map: Record<string, string> = {
            '招聘专用邮箱': '招聘邮箱',
            '通用支持邮箱': '通用邮箱',
            '内部员工邮箱': '员工邮箱',
            '企业领导邮箱': '高管邮箱',
            '招聘邮箱': '招聘邮箱',
            '通用邮箱': '通用邮箱',
            '员工邮箱': '员工邮箱',
            '高管邮箱': '高管邮箱',
            'HR邮箱': 'HR邮箱'
        }
        return map[String(emailType || '').trim()] || '通用邮箱'
    }

    const sanitizeTranslationsForSave = (
        description?: string,
        translations?: TrustedCompany['translations']
    ): TrustedCompany['translations'] | undefined => {
        if (!translations || typeof translations !== 'object') return undefined
        const nextTranslations = { ...translations }
        const canonicalDescription = String(description || '').trim()
        const translatedDescription = String(nextTranslations.description || '').trim()

        // Treat the manually maintained company description as canonical.
        // If it diverges from a previously auto-generated translation, drop the stale copy.
        if (canonicalDescription && translatedDescription && canonicalDescription !== translatedDescription) {
            delete nextTranslations.description
        }

        return Object.keys(nextTranslations).length > 0 ? nextTranslations : undefined
    }

    const buildEmptyReferralContact = (override: Partial<ReferralContact> = {}): ReferralContact => ({
        hiringEmail: '',
        emailType: '通用邮箱',
        name: '',
        title: '',
        linkedin: '',
        ...override
    })

    const normalizeReferralContacts = (contacts: ReferralContact[] = []): ReferralContact[] => {
        if (!Array.isArray(contacts)) return []
        return contacts
            .map(contact => ({
                hiringEmail: String(contact?.hiringEmail || '').trim(),
                emailType: normalizeEmailType(contact?.emailType),
                name: String(contact?.name || '').trim(),
                title: String(contact?.title || '').trim(),
                linkedin: String(contact?.linkedin || '').trim()
            }))
            .filter(contact => contact.hiringEmail || contact.name || contact.title || contact.linkedin)
    }

    const resolveInitialReferralContacts = (company?: Partial<TrustedCompany> | null): ReferralContact[] => {
        const fromArray = normalizeReferralContacts(
            Array.isArray(company?.referralContacts) ? company!.referralContacts as ReferralContact[] : []
        )
        if (fromArray.length > 0) return fromArray
        const fallbackEmail = String(company?.hiringEmail || '').trim()
        const fallbackEmailType = normalizeEmailType(company?.emailType)
        if (fallbackEmail) {
            return [buildEmptyReferralContact({ hiringEmail: fallbackEmail, emailType: fallbackEmailType })]
        }
        return []
    }

    const addReferralContact = () => {
        setFormData(prev => ({
            ...prev,
            referralContacts: [...(Array.isArray(prev.referralContacts) ? prev.referralContacts : []), buildEmptyReferralContact()]
        }))
    }

    const removeReferralContact = (index: number) => {
        setFormData(prev => {
            const current = Array.isArray(prev.referralContacts) ? [...prev.referralContacts] : []
            current.splice(index, 1)
            return { ...prev, referralContacts: current }
        })
    }

    const updateReferralContact = (index: number, key: keyof ReferralContact, value: string) => {
        setFormData(prev => {
            const current = Array.isArray(prev.referralContacts) ? [...prev.referralContacts] : []
            while (current.length <= index) current.push(buildEmptyReferralContact())
            current[index] = { ...current[index], [key]: value }
            return { ...prev, referralContacts: current }
        })
    }

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (debouncedSearch !== searchTerm) {
                setDebouncedSearch(searchTerm)
                setPage(1)
            }
        }, 800)
        return () => clearTimeout(timer)
    }, [searchTerm, debouncedSearch])

    useEffect(() => {
        loadCompanies()
    }, [page, sortBy, sortOrder, industryFilter, filterMemberOnly, debouncedSearch])

    // Load companies ONLY from trusted_companies database table
    const loadCompanies = async () => {
        try {
            setLoading(true)
            const data = await trustedCompaniesService.getAllCompanies({
                page,
                limit: PAGE_SIZE,
                sortBy,
                sortOrder,
                industry: industryFilter,
                search: debouncedSearch,
                memberOnly: filterMemberOnly,
                isTrusted: 'yes' // Explicitly request trusted companies (manually added or verified)
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

    const [industries, setIndustries] = useState<string[]>([])

    useEffect(() => {
        const loadTagConfig = async () => {
            try {
                const response = await fetch('/api/data/trusted-companies?target=tags')
                const data = await response.json()
                if (data.success && data.config?.companyIndustries) {
                    setIndustries(data.config.companyIndustries)
                }
            } catch (error) {
                console.error('Failed to load tag config:', error)
            }
        }
        loadTagConfig()
    }, [])

    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortOrder('desc')
        }
        setPage(1)
    }

    const handleEdit = async (company: TrustedCompany) => {
        // Optimistic UI: Show modal immediately with available data
        setEditingCompany(company)
        setFormData({
            ...company,
            emailType: normalizeEmailType(company.emailType),
            referralContacts: resolveInitialReferralContacts(company)
        })

        // If coverImage is missing (due to list optimization), fetch full details
        if (!company.coverImage) {
            setCoverUrlInput('') // Temporary empty

            try {
                // Fetch full details
                const fullCompany = await trustedCompaniesService.getCompanyById(company.id);
                if (fullCompany) {
                    setEditingCompany(fullCompany);
                    setFormData({
                        ...fullCompany,
                        emailType: normalizeEmailType(fullCompany.emailType),
                        referralContacts: resolveInitialReferralContacts(fullCompany)
                    });
                    setCoverUrlInput(fullCompany.coverImage || '');
                }
            } catch (e) {
                console.error("Failed to fetch full company details:", e);
                // Keep showing what we have, maybe user can re-upload if needed
            }
        } else {
            setCoverUrlInput(company.coverImage || '')
        }

        resetCropperState()
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            isTrusted: true,
            memberOnly: false,
            tags: [],
            referralContacts: []
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

            // Optimize cover image if present and is a base64 string (starts with data:image)
            const optimizedFormData = { ...formData };
            if (formData.coverImage && formData.coverImage.startsWith('data:image')) {
                // Compress image to WebP with 0.8 quality and max width 1200
                const compressedCover = await compressImage(formData.coverImage, 1200, 0.8);
                optimizedFormData.coverImage = compressedCover;
            }
            optimizedFormData.tags = splitTagInput(optimizedFormData.tags)
            optimizedFormData.specialties = splitTagInput(optimizedFormData.specialties)
            const normalizedReferralContacts = normalizeReferralContacts(
                Array.isArray(optimizedFormData.referralContacts) ? optimizedFormData.referralContacts as ReferralContact[] : []
            )
            const primaryContact = normalizedReferralContacts[0]
            optimizedFormData.referralContacts = normalizedReferralContacts
            optimizedFormData.hiringEmail = primaryContact?.hiringEmail || undefined
            optimizedFormData.emailType = normalizeEmailType(primaryContact?.emailType || optimizedFormData.emailType)
            optimizedFormData.translations = sanitizeTranslationsForSave(
                optimizedFormData.description,
                optimizedFormData.translations
            )

            const result = await trustedCompaniesService.saveCompany(optimizedFormData)

            if (result.success && result.company) {
                // Optimistic Update / Direct State Update
                setCompanies(prev => {
                    const exists = prev.some(c => c.id === result.company!.id);
                    if (exists) {
                        return prev.map(c => c.id === result.company!.id ? result.company! : c);
                    } else {
                        return [result.company!, ...prev];
                    }
                });

                setIsModalOpen(false)
                setCoverUrlInput('')
                // Remove full reload to improve performance
                // loadCompanies() 
            } else {
                alert('保存失败: ' + (result.error || '未知错误'))
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
                    // Use translated description if available, otherwise fallback to original, then existing
                    description: metadata.translations?.description || metadata.description || prev.description,
                    logo: metadata.icon || metadata.image || prev.logo,
                    translations: metadata.translations // Save translation data
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
            const result = await trustedCompaniesService.crawlJobs(id, true, 100) // Increase limit to 100
            if (result.success) {
                alert(`抓取成功！当前共 ${result.count || 0} 个岗位`)

                // Optimistic Update
                setCompanies(prev => prev.map(c => c.id === id ? {
                    ...c,
                    jobCount: result.count || 0,
                    lastCrawledAt: new Date().toISOString()
                } : c));

                // loadCompanies() // reload to update job counts
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




    const handleSyncData = async () => {
        if (!confirm('确定要同步所有岗位数据并重新计算企业岗位数量吗？这可能需要几分钟。')) return
        try {
            setLoading(true)
            const response = await fetch('/api/data/trusted-companies?action=sync-jobs')
            const data = await response.json()
            if (data.success) {
                alert(data.message)
                loadCompanies()
            } else {
                alert('同步失败: ' + (data.error || '未知错误'))
            }
        } catch (error) {
            console.error('Sync failed:', error)
            alert('同步请求失败')
        } finally {
            setLoading(false)
        }
    }

    const handleBatchCrawl = async () => {
        if (batchCrawling) return
        if (!companies.length) {
            alert('当前列表无企业')
            return
        }
        if (!confirm(`确定要批量抓取当前页的 ${companies.length} 家企业的岗位吗？这可能需要较长时间。`)) return

        setBatchCrawling(true)
        setBatchProgress('初始化...')

        let successCount = 0
        let failCount = 0

        try {
            for (let i = 0; i < companies.length; i++) {
                const company = companies[i]
                setBatchProgress(`正在抓取 (${i + 1}/${companies.length}): ${company.name}`)

                try {
                    // Reuse existing service method with default options (force=true, limit=10)
                    const result = await trustedCompaniesService.crawlJobs(company.id, true, 100)
                    if (result.success) {
                        successCount++
                    } else {
                        failCount++
                        console.error(`Failed to crawl ${company.name}:`, result.error)
                    }
                } catch (err) {
                    failCount++
                    console.error(`Error crawling ${company.name}:`, err)
                }
            }

            alert(`批量抓取完成！成功: ${successCount}, 失败: ${failCount}`)
            loadCompanies() // Reload to update counts
        } catch (error) {
            console.error('Batch crawl failed:', error)
            alert('批量抓取过程中断')
        } finally {
            setBatchCrawling(false)
            setBatchProgress('')
        }
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
                        onClick={handleBatchCrawl}
                        disabled={batchCrawling || loading}
                        className="px-4 py-2 bg-white text-indigo-600 border border-indigo-600 rounded hover:bg-indigo-50 flex items-center gap-2 disabled:opacity-50"
                    >
                        {batchCrawling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <DownloadCloud className="w-4 h-4" />
                        )}
                        {batchCrawling ? '抓取中...' : '爬取本页岗位'}
                    </button>
                    <button
                        onClick={handleSyncData}
                        className="px-4 py-2 bg-white text-indigo-600 border border-indigo-600 rounded hover:bg-indigo-50 flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" />
                        同步数据
                    </button>
                    <button
                        onClick={handleAdd}
                        className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        添加企业
                    </button>
                </div>
            </div>

            {batchCrawling && (
                <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-lg flex items-center gap-3 border border-blue-200">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-medium">{batchProgress}</span>
                </div>
            )}

            <div className="mb-6 flex flex-wrap gap-3 items-center">
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
                    value={filterMemberOnly}
                    onChange={(e) => {
                        setFilterMemberOnly(e.target.value as 'all' | 'yes' | 'no')
                        setPage(1)
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
                >
                    <option value="all">全部申请权限</option>
                    <option value="yes">仅会员</option>
                    <option value="no">全部用户</option>
                </select>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">行业</th>
                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">规模/地址</th>
                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">评分/成立</th>
                                    <th
                                        className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider w-[110px] cursor-pointer hover:bg-gray-100 select-none"
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
                                        className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider w-[120px] cursor-pointer hover:bg-gray-100 select-none"
                                        onClick={() => handleSort('updatedAt')}
                                    >
                                        <div className="flex items-center gap-1">
                                            更新时间
                                            {sortBy === 'updatedAt' && (
                                                <span className="text-gray-700">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                                            )}
                                        </div>
                                    </th>
                                    <th className="px-4 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider w-[100px]">链接</th>
                                    <th className="px-4 py-2 text-right text-[11px] font-medium text-gray-500 uppercase tracking-wider w-[120px]">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {companies.map(company => (
                                    <tr key={company.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden border border-gray-200">
                                                    {company.logo ? (
                                                        <img src={company.logo} alt="" className="h-full w-full object-contain p-0.5" />
                                                    ) : (
                                                        <Building2 className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </div>
                                                <div className="ml-3 max-w-xs">
                                                    <div className="font-medium text-gray-900 flex items-center gap-2 text-[13px]">
                                                        {company.name}
                                                        {company.memberOnly && (
                                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] rounded border border-amber-200 whitespace-nowrap leading-none">
                                                                仅会员
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 truncate" title={company.description}>
                                                        {company.description || '暂无简介'}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                            <span className="px-1.5 py-0.5 inline-flex text-[11px] leading-tight font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {company.industry || '未分类'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700">
                                            <div className="flex flex-col leading-tight">
                                                <span>{company.employeeCount || '-'}</span>
                                                <span className="text-[11px] text-gray-400 truncate max-w-[150px] mt-0.5" title={company.address}>{company.address || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700">
                                            <div className="flex flex-col leading-tight">
                                                <span>{company.companyRating ? `⭐ ${company.companyRating}` : '-'}</span>
                                                <span className="text-[11px] text-gray-400 mt-0.5">{company.foundedYear ? `${company.foundedYear}年` : '-'}</span>
                                            </div>
                                        </td>
                                        <td
                                            className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-700 cursor-pointer hover:text-indigo-600 hover:font-medium underline decoration-dashed underline-offset-4"
                                            onClick={() => setSelectedCompanyForJobs(company)}
                                            title="点击管理岗位"
                                        >
                                            {company.jobCount ?? 0}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-500">
                                            {company.updatedAt ? (
                                                <div className="flex flex-col leading-tight">
                                                    <span>{new Date(company.updatedAt).toLocaleDateString()}</span>
                                                    <span className="text-[11px] text-gray-400 mt-0.5">{new Date(company.updatedAt).toLocaleTimeString()}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[13px] text-gray-500">
                                            <div className="flex gap-1.5">
                                                {company.website && (
                                                    <a href={company.website} target="_blank" rel="noreferrer" title="官网" className="text-gray-400 hover:text-indigo-600">
                                                        <GlobeIcon className="w-[14px] h-[14px]" />
                                                    </a>
                                                )}
                                                {company.careersPage && (
                                                    <a href={company.careersPage} target="_blank" rel="noreferrer" title="招聘主页" className="text-gray-400 hover:text-indigo-600">
                                                        <BriefcaseIcon className="w-[14px] h-[14px]" />
                                                    </a>
                                                )}
                                                {company.linkedin && (
                                                    <a href={company.linkedin} target="_blank" rel="noreferrer" title="LinkedIn" className="text-gray-400 hover:text-indigo-600">
                                                        <LinkedinIcon className="w-[14px] h-[14px]" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap text-[13px] font-medium">
                                            <div className="flex items-center justify-end gap-3">
                                                <button
                                                    onClick={() => handleCrawlJobs(company.id)}
                                                    disabled={crawlingId === company.id}
                                                    className="text-gray-600 hover:text-indigo-600 disabled:opacity-50 transition-colors"
                                                    title="抓取岗位数据"
                                                >
                                                    {crawlingId === company.id ? (
                                                        <Loader2 className="w-[15px] h-[15px] animate-spin" />
                                                    ) : (
                                                        <DownloadCloud className="w-[15px] h-[15px]" />
                                                    )}
                                                </button>
                                                <button onClick={() => handleEdit(company)} className="text-indigo-600 hover:text-indigo-900 transition-colors" title="编辑企业">
                                                    <Edit2 className="w-[15px] h-[15px]" />
                                                </button>
                                                <button onClick={() => handleDelete(company.id)} className="text-red-600 hover:text-red-900 transition-colors" title="删除企业">
                                                    <Trash2 className="w-[15px] h-[15px]" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
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

            {selectedCompanyForJobs && (
                <AdminCompanyJobsModal
                    company={selectedCompanyForJobs}
                    onClose={() => {
                        setSelectedCompanyForJobs(null)
                    }}
                />
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
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-sm font-medium text-gray-700">简介</label>
                                    <span className={`text-xs ${(formData.description?.length || 0) > 300 ? 'text-amber-600 font-medium' : 'text-gray-400'
                                        }`}>
                                        {formData.description?.length || 0} 字 (建议 &le; 300)
                                    </span>
                                </div>
                                <textarea
                                    value={formData.description || ''}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    rows={4}
                                    maxLength={500}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    placeholder="请输入企业简介..."
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    请控制简介长度，以免在详情页占用过多版面。
                                </p>
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
                                    <input
                                        type="url"
                                        value={formData.linkedin || ''}
                                        onChange={e => setFormData({ ...formData, linkedin: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://linkedin.com/company/..."
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-sm font-medium text-gray-700">内推联系人</label>
                                    <button
                                        type="button"
                                        onClick={addReferralContact}
                                        className="px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100"
                                    >
                                        新增联系人
                                    </button>
                                </div>
                                {Array.isArray(formData.referralContacts) && formData.referralContacts.length > 0 ? (
                                    <div className="space-y-3">
                                        {formData.referralContacts.map((contact, index) => (
                                            <div key={`referral-contact-${index}`} className="p-3 border rounded-lg bg-gray-50 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-medium text-gray-700">联系人 {index + 1}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeReferralContact(index)}
                                                        className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
                                                    >
                                                        删除
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">招聘邮箱</label>
                                                        <input
                                                            type="email"
                                                            value={contact.hiringEmail || ''}
                                                            onChange={e => updateReferralContact(index, 'hiringEmail', e.target.value)}
                                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="jobs@company.com"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">邮箱类型</label>
                                                        <select
                                                            value={contact.emailType || '通用邮箱'}
                                                            onChange={e => updateReferralContact(index, 'emailType', e.target.value)}
                                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                                        >
                                                            <option value="招聘邮箱">招聘邮箱</option>
                                                            <option value="通用邮箱">通用邮箱</option>
                                                            <option value="员工邮箱">员工邮箱</option>
                                                            <option value="高管邮箱">高管邮箱</option>
                                                            <option value="HR邮箱">HR邮箱</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">姓名</label>
                                                        <input
                                                            type="text"
                                                            value={contact.name || ''}
                                                            onChange={e => updateReferralContact(index, 'name', e.target.value)}
                                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="例如：Alice Zhang"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">职位</label>
                                                        <input
                                                            type="text"
                                                            value={contact.title || ''}
                                                            onChange={e => updateReferralContact(index, 'title', e.target.value)}
                                                            className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                                            placeholder="例如：Senior Recruiter"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn主页</label>
                                                    <input
                                                        type="url"
                                                        value={contact.linkedin || ''}
                                                        onChange={e => updateReferralContact(index, 'linkedin', e.target.value)}
                                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="https://linkedin.com/in/..."
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 border border-dashed rounded-lg p-4 bg-gray-50">
                                        当前未设置内推联系人，可点击“新增联系人”添加 0-N 组信息。
                                    </div>
                                )}
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

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">企业评分</label>
                                    <input
                                        type="text"
                                        value={formData.companyRating || ''}
                                        onChange={e => setFormData({ ...formData, companyRating: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 4.5/5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">评分来源</label>
                                    <input
                                        type="text"
                                        value={formData.ratingSource || ''}
                                        onChange={e => setFormData({ ...formData, ratingSource: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. Glassdoor, Blind"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">领域/专长 (支持 、 / ， / ; 自动识别)</label>
                                <input
                                    type="text"
                                    value={joinTagInput(formData.specialties)}
                                    onChange={e => setFormData({ ...formData, specialties: splitTagInput(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. SaaS, AI, Cloud Computing"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">标签 (支持 、 / ， / ; 自动识别)</label>
                                <input
                                    type="text"
                                    value={joinTagInput(formData.tags)}
                                    onChange={e => setFormData({
                                        ...formData,
                                        tags: splitTagInput(e.target.value)
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
                                        checked={formData.memberOnly ?? false}
                                        onChange={e => setFormData({ ...formData, memberOnly: e.target.checked })}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">仅会员</span>
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
