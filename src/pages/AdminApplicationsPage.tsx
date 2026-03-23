
import React, { useState, useEffect } from 'react'
import {
    Search, FileText, Briefcase, Building2, Globe
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

interface Application {
    id: number
    user_id: string
    userNickname: string
    username?: string
    userEmail: string
    email?: string
    job_id: string
    jobTitle: string
    job_title?: string
    company: string
    job_company?: string
    interaction_type: string
    status: string
    updated_at: string
    created_at: string
    notes: string
    resume_id: string
    resumeName: string
    resume_name?: string
    resumeSize: number
    sourceType: string
    // Official/Platform Aggregated Stats
    total_applications?: number
    pending_interview?: number
    interviewing?: number
    success?: number
}

type TabType = 'email' | 'official' | 'trusted_platform'

export default function AdminApplicationsPage() {
    const { token, isSuperAdmin } = useAuth()
    const { showSuccess, showError } = useNotificationHelpers()

    const [activeTab, setActiveTab] = useState<TabType>('email')
    // applications can be individual (email) or aggregated (official/platform)
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [stats, setStats] = useState({ email_count: 0, official_count: 0, platform_count: 0 })
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'updated_at', direction: 'desc' })

    const aggregatedSortItems = [
        { key: 'total_applications', label: '总申请', tone: 'bg-blue-50 text-blue-700 border-blue-100' },
        { key: 'pending_interview', label: '待面试', tone: 'bg-amber-50 text-amber-700 border-amber-100' },
        { key: 'interviewing', label: '面试中', tone: 'bg-orange-50 text-orange-700 border-orange-100' },
        { key: 'success', label: '已录用', tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' }
    ] as const

    useEffect(() => {
        fetchApplications()
        fetchStats()
    }, [activeTab, page, search, sortConfig])

    useEffect(() => {
        setPage(1)
    }, [activeTab, search, sortConfig])

    const formatCompactJobId = (jobId?: string) => {
        const raw = String(jobId || '').trim()
        if (!raw) return ''
        if (raw.length <= 32) return raw
        return `${raw.slice(0, 18)}...${raw.slice(-6)}`
    }

    const toggleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }))
    }

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin-ops?action=application_stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setStats(data.stats)
            }
        } catch (e) {
            console.error('Failed to fetch stats', e)
        }
    }

    const fetchApplications = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams({
                action: 'application_list',
                type: activeTab,
                page: page.toString(),
                limit: '20',
                search,
                sortBy: sortConfig.key,
                sortDir: sortConfig.direction
            })
            const res = await fetch(`/api/admin-ops?${params.toString()}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (res.ok && data.success) {
                setApplications(data.data)
                setTotalPages(data.pagination.totalPages)
                return
            }
            throw new Error(data.error || '获取申请数据失败')
        } catch (e) {
            console.error('Failed to fetch applications', e)
            showError('获取数据失败', e instanceof Error ? e.message : '网络错误')
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteApplication = async (id: number) => {
        if (!confirm('确定要删除此申请记录吗？此操作不可撤销。')) return;

        try {
            const params = new URLSearchParams({
                action: 'application_delete',
                id: id.toString(),
                type: 'email'
            });
            const res = await fetch(`/api/admin-ops?${params.toString()}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            })
            const data = await res.json()
            if (data.success) {
                showSuccess('删除成功')
                fetchApplications()
                fetchStats()
            } else {
                showError('删除失败', data.error)
            }
        } catch (e) {
            showError('操作失败', '网络错误')
        }
    }

    const handleUpdateStatus = async (id: number, status: string, notes?: string) => {
        try {
            const res = await fetch('/api/admin-ops?action=application_update_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, status, notes })
            })
            const data = await res.json()
            if (data.success) {
                showSuccess('状态更新成功')
                fetchApplications() // Refresh to reflect changes
            } else {
                showError('更新失败', data.error)
            }
        } catch (e) {
            showError('操作失败', '网络错误')
        }
    }

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'pending_apply': 'bg-blue-50 text-blue-600',
            'applied': 'bg-blue-100 text-blue-800',
            'reviewed': 'bg-indigo-100 text-indigo-800',
            'referred': 'bg-purple-100 text-purple-800',
            'interviewing': 'bg-orange-100 text-orange-800',
            'success': 'bg-green-100 text-green-800',
            'rejected': 'bg-red-100 text-red-800',
            'failed': 'bg-red-50 text-red-900',
            'offer': 'bg-green-100 text-green-800'
        }

        const labels: Record<string, string> = {
            'pending': '待处理',
            'pending_apply': '待投递',
            'applied': '已申请',
            'reviewed': '简历已阅',
            'referred': '已内推',
            'interviewing': '面试中',
            'failed': '内推失败',
            'offer': '已录用',
            'redirected': '已跳转'
        }

        const displayStatus = status || 'redirected';

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[displayStatus] || 'bg-gray-100 text-gray-800'}`}>
                {labels[displayStatus] || displayStatus}
            </span>
        )
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto overflow-hidden flex flex-col h-[calc(100vh-64px)]">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Briefcase className="w-6 h-6" />
                    申请管理
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => { setActiveTab('email'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'email'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Briefcase className="w-4 h-4" />
                    邮箱申请
                </button>
                <button
                    onClick={() => { setActiveTab('official'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'official'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Building2 className="w-4 h-4" />
                    企业官网
                </button>
                <button
                    onClick={() => { setActiveTab('trusted_platform'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'trusted_platform'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                >
                    <Globe className="w-4 h-4" />
                    三方平台
                </button>
            </div>

            {/* Search */}
            <div className="mb-6 flex gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="搜索用户、公司、岗位..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        {activeTab === 'email' ? (
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请用户</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位/公司</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">简历/备注</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        ) : (
                            <tr>
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => toggleSort('job_title')}
                                >
                                    <div className="flex items-center gap-1">
                                        岗位信息
                                        {sortConfig.key === 'job_title' && (
                                            <span className="text-xs">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>
                                        )}
                                    </div>
                                </th>
                                {aggregatedSortItems.map((item) => (
                                    <th
                                        key={item.key}
                                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                        onClick={() => toggleSort(item.key)}
                                    >
                                        <div className="inline-flex items-center gap-1">
                                            {item.label}
                                            {sortConfig.key === item.key && (
                                                <span className="text-xs">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th
                                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                                    onClick={() => toggleSort('updated_at')}
                                >
                                    <div className="flex items-center gap-1">
                                        最后更新
                                        {sortConfig.key === 'updated_at' && (
                                            <span className="text-xs">{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>
                                        )}
                                    </div>
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        )}
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={activeTab === 'email' ? 6 : 7} className="px-6 py-12 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        ) : applications.length === 0 ? (
                            <tr>
                                <td colSpan={activeTab === 'email' ? 6 : 7} className="px-6 py-12 text-center text-gray-500">
                                    暂无申请记录
                                </td>
                            </tr>
                        ) : (
                            applications.map((app, idx) => (
                                <tr key={app.id || idx} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        {activeTab === 'email' ? (
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{app.username || app.userNickname || '未知用户'}</span>
                                                <span className="text-xs text-gray-500">{app.email || app.userEmail}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-900">{app.job_title || app.jobTitle}</span>
                                                    {app.job_id && (
                                                        <span
                                                            className="max-w-[240px] truncate text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full font-mono"
                                                            title={app.job_id}
                                                        >
                                                            ID: {formatCompactJobId(app.job_id)}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm text-gray-500">{app.job_company || app.company}</span>
                                            </div>
                                        )}
                                    </td>
                                    {activeTab === 'email' && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-900">{app.job_title || app.jobTitle}</span>
                                                <span className="text-sm text-gray-500">{app.job_company || app.company}</span>
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {activeTab === 'email' ? (
                                            getStatusBadge(app.status)
                                        ) : (
                                            <div className="text-center">
                                                <span className={`inline-flex min-w-[52px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold ${aggregatedSortItems[0].tone}`}>
                                                    {app.total_applications || 0}
                                                </span>
                                            </div>
                                        )}
                                    </td>
                                    {activeTab !== 'email' && aggregatedSortItems.slice(1).map((item) => (
                                        <td key={item.key} className="px-4 py-4 whitespace-nowrap text-center">
                                            <span className={`inline-flex min-w-[52px] items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-semibold ${item.tone}`}>
                                                {app[item.key as keyof Application] || 0}
                                            </span>
                                        </td>
                                    ))}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col">
                                            <span>{new Date(app.updated_at).toLocaleDateString()}</span>
                                            <span className="text-xs text-gray-400">{new Date(app.updated_at).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                    {activeTab === 'email' && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {(app.resume_name || app.resumeName) && (
                                                    <a
                                                        href={`/api/resumes/${app.resume_id}/download`}
                                                        target="_blank"
                                                        className="text-indigo-600 hover:underline text-sm flex items-center gap-1"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        {app.resume_name || app.resumeName}
                                                    </a>
                                                )}
                                                {app.notes && (
                                                    <p className="text-xs text-gray-500 bg-gray-50 p-1 rounded">
                                                        "{app.notes}"
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex flex-col gap-2 items-end justify-center h-full min-h-[40px]">
                                            {activeTab === 'email' && isSuperAdmin && (
                                                <button
                                                    onClick={() => handleDeleteApplication(app.id)}
                                                    className="text-gray-400 hover:text-red-600 text-xs"
                                                >
                                                    删除记录
                                                </button>
                                            )}
                                            {activeTab !== 'email' && (
                                                <span className="text-xs text-gray-300">-</span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div className="mt-4 flex justify-end gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        上一页
                    </button>
                    <span className="px-3 py-1 text-gray-500">
                        {page} / {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
                    >
                        下一页
                    </button>
                </div>
            )}
        </div>
    )
}
