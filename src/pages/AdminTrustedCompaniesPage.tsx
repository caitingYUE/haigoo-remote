import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Globe, Linkedin, Briefcase, Trash2, Edit2, ExternalLink, Loader2, CheckCircle, XCircle } from 'lucide-react'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

export default function AdminTrustedCompaniesPage() {
    const navigate = useNavigate()
    const { showSuccess, showError } = useNotificationHelpers()
    const { token } = useAuth()
    const [fetchDetailsEnabled, setFetchDetailsEnabled] = useState(false)
    const [companies, setCompanies] = useState<TrustedCompany[]>([])
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCompany, setEditingCompany] = useState<Partial<TrustedCompany> | null>(null)
    const [crawling, setCrawling] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        website: '',
        careersPage: '',
        linkedin: '',
        description: '',
        logo: '',
        tags: ''
    })

    useEffect(() => {
        loadCompanies()
    }, [])

    const loadCompanies = async () => {
        try {
            setLoading(true)
            const data = await trustedCompaniesService.getAllCompanies()
            setCompanies(data)
        } catch (error) {
            showError('加载失败', '无法获取公司列表')
        } finally {
            setLoading(false)
        }
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
            tags: company.tags ? company.tags.join(', ') : ''
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
            tags: ''
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

            setFormData(prev => ({
                ...prev,
                name: prev.name || metadata.title || '',
                description: prev.description || metadata.description || '',
                logo: prev.logo || metadata.icon || metadata.image || ''
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

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">可信远程企业管理</h1>
                        <p className="text-gray-500 mt-1">管理经过认证工作栈的优质远程企业名单</p>
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
                        {companies.map(company => (
                            <div key={company.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow overflow-hidden flex flex-col h-full">
                                {/* Image Preview Area */}
                                <div className="w-full h-32 bg-gray-50 relative border-b border-gray-100 group">
                                    {company.logo ? (
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
                                        <button onClick={() => handleEdit(company)} className="p-1.5 bg-white text-gray-600 hover:text-blue-600 rounded-lg shadow-sm border border-gray-200 transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleDelete(company.id)} className="p-1.5 bg-white text-gray-600 hover:text-red-600 rounded-lg shadow-sm border border-gray-200 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {company.isTrusted && (
                                        <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-xs font-medium text-green-600 shadow-sm border border-gray-100">
                                            <CheckCircle className="w-3 h-3" /> 已认证
                                        </div>
                                    )}
                                </div>

                                <div className="p-5 flex flex-col flex-1">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <h3 className="font-bold text-gray-900 line-clamp-1 text-lg">{company.name}</h3>
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

                {/* Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {editingCompany ? '编辑企业' : '新增企业'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                    <XCircle className="w-6 h-6" />
                                </button>
                            </div>

                            <form onSubmit={handleSave} className="p-6 space-y-6">
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Logo 链接</label>
                                        <input
                                            type="url"
                                            value={formData.logo}
                                            onChange={e => setFormData({ ...formData, logo: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="https://..."
                                        />
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
                                        <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                                        <input
                                            type="text"
                                            value={formData.tags}
                                            onChange={e => setFormData({ ...formData, tags: e.target.value })}
                                            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                                            placeholder="SaaS, DevOps, 全球远程, 异步协作"
                                        />
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
            </div>
        </div >
    )
}
