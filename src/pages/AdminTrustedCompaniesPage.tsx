import { useState, useEffect } from 'react'
import { 
    Building2, Search, Plus, Edit2, Trash2, 
    ExternalLink, Check, X, Save, Loader2,
    Wand2, DownloadCloud, Database, RefreshCw
} from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { CompanyIndustry } from '../types/rss-types'

export default function AdminTrustedCompaniesPage() {
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<TrustedCompany | null>(null)
    const [formData, setFormData] = useState<Partial<TrustedCompany>>({})
    const [saving, setSaving] = useState(false)
    
    // New states for automation features
    const [crawlingId, setCrawlingId] = useState<string | null>(null)
    const [aggregating, setAggregating] = useState(false)
    const [autoFilling, setAutoFilling] = useState(false)

    useEffect(() => {
        loadCompanies()
    }, [])

    const loadCompanies = async () => {
        try {
            setLoading(true)
            const data = await trustedCompaniesService.getAllCompanies()
            setCompanies(data)
        } catch (error) {
            console.error('Failed to load companies:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (company: TrustedCompany) => {
        setEditingCompany(company)
        setFormData({ ...company })
        setIsModalOpen(true)
    }

    const handleAdd = () => {
        setEditingCompany(null)
        setFormData({
            isTrusted: true,
            canRefer: false,
            tags: []
        })
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

    const handleAggregate = async () => {
        if (!confirm('确定要从现有的岗位数据中提取企业信息吗？这可能会覆盖现有的企业数据。')) return
        try {
            setAggregating(true)
            const result = await trustedCompaniesService.aggregateCompanies()
            if (result.success) {
                alert(`提取成功！${result.message}`)
                loadCompanies()
            } else {
                alert('提取失败: ' + (result.error || '未知错误'))
            }
        } catch (error) {
            console.error('Aggregate failed:', error)
            alert('提取请求失败')
        } finally {
            setAggregating(false)
        }
    }

    const filteredCompanies = companies.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.industry?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const industries: CompanyIndustry[] = [
        '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech', 
        '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS', 
        '硬件/物联网', '消费生活', '其他'
    ]

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    可信企业管理
                </h1>
                <div className="flex gap-3">
                    <button 
                        onClick={handleAggregate}
                        disabled={aggregating}
                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 flex items-center gap-2"
                        title="从现有岗位数据中自动提取企业信息"
                    >
                        {aggregating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                        从岗位提取
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

            <div className="mb-6 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                    type="text"
                    placeholder="搜索企业名称、行业..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
            </div>

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
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">链接</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {filteredCompanies.map(company => (
                                <tr key={company.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            {company.logo ? (
                                                <img src={company.logo} alt="" className="h-8 w-8 rounded object-contain mr-3" />
                                            ) : (
                                                <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center mr-3">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                            <div>
                                                <div className="font-medium text-gray-900">{company.name}</div>
                                                <div className="text-xs text-gray-500 truncate max-w-xs">{company.description}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {company.industry || '未分类'}
                                        </span>
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
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col gap-1">
                                            {company.isTrusted && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 w-fit">
                                                    可信
                                                </span>
                                            )}
                                            {company.canRefer && (
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800 w-fit">
                                                    可内推
                                                </span>
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
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
                                    <select
                                        value={formData.industry || ''}
                                        onChange={e => setFormData({...formData, industry: e.target.value as CompanyIndustry})}
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
                                    onChange={e => setFormData({...formData, description: e.target.value})}
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
                                            onChange={e => setFormData({...formData, website: e.target.value})}
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
                                        onChange={e => setFormData({...formData, logo: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">招聘主页 (Career Page)</label>
                                    <input
                                        type="url"
                                        value={formData.careersPage || ''}
                                        onChange={e => setFormData({...formData, careersPage: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                                    <input
                                        type="url"
                                        value={formData.linkedin || ''}
                                        onChange={e => setFormData({...formData, linkedin: e.target.value})}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://linkedin.com/company/..."
                                    />
                                </div>
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
                                        onChange={e => setFormData({...formData, isTrusted: e.target.checked})}
                                        className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">设为可信企业</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.canRefer ?? false}
                                        onChange={e => setFormData({...formData, canRefer: e.target.checked})}
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
