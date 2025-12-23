
import React, { useState, useEffect } from 'react'
import { 
    Search, Filter, CheckCircle, XCircle, Clock, 
    MoreHorizontal, FileText, ExternalLink, 
    MessageSquare, Briefcase, Building2, Globe
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

interface Application {
    id: number
    user_id: string
    userNickname: string
    userEmail: string
    job_id: string
    jobTitle: string
    company: string
    interaction_type: string
    status: string
    updated_at: string
    created_at: string
    notes: string
    resume_id: string
    resumeName: string
    resumeSize: number
    sourceType: string
}

type TabType = 'referral' | 'official' | 'trusted_platform'

export default function AdminApplicationsPage() {
    const { token } = useAuth()
    const { showSuccess, showError } = useNotificationHelpers()
    
    const [activeTab, setActiveTab] = useState<TabType>('referral')
    const [applications, setApplications] = useState<Application[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [stats, setStats] = useState({ referral_count: 0, official_count: 0, platform_count: 0 })

    useEffect(() => {
        fetchApplications()
        fetchStats()
    }, [activeTab, page, search])

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/admin-applications?action=stats', {
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
                type: activeTab,
                page: page.toString(),
                limit: '20',
                search
            })
            const res = await fetch(`/api/admin-applications?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            if (data.success) {
                setApplications(data.data)
                setTotalPages(data.pagination.totalPages)
            }
        } catch (e) {
            console.error('Failed to fetch applications', e)
            showError('获取数据失败', '网络错误')
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateStatus = async (id: number, status: string, notes?: string) => {
        try {
            const res = await fetch('/api/admin-applications?action=update_status', {
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
            'applied': '已申请',
            'reviewed': '简历已阅',
            'referred': '已内推',
            'interviewing': '面试中',
            'success': '内推成功',
            'rejected': '已拒绝',
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
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Briefcase className="w-6 h-6" />
                    申请管理
                </h1>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => { setActiveTab('referral'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'referral' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Briefcase className="w-4 h-4" />
                    内推申请
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {stats.referral_count}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('official'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'official' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Building2 className="w-4 h-4" />
                    企业官网
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {stats.official_count}
                    </span>
                </button>
                <button
                    onClick={() => { setActiveTab('trusted_platform'); setPage(1); }}
                    className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                        activeTab === 'trusted_platform' 
                        ? 'border-indigo-600 text-indigo-600' 
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                >
                    <Globe className="w-4 h-4" />
                    三方平台
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                        {stats.platform_count}
                    </span>
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
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请用户</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位/公司</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                            {activeTab === 'referral' && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">简历/备注</th>
                            )}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    加载中...
                                </td>
                            </tr>
                        ) : applications.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                    暂无申请记录
                                </td>
                            </tr>
                        ) : (
                            applications.map((app) => (
                                <tr key={app.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{app.userNickname || '未知用户'}</span>
                                            <span className="text-xs text-gray-500">{app.userEmail}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">{app.jobTitle}</span>
                                            <span className="text-sm text-gray-500">{app.company}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(app.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col">
                                            <span>{new Date(app.updated_at).toLocaleDateString()}</span>
                                            <span className="text-xs text-gray-400">{new Date(app.updated_at).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                    {activeTab === 'referral' && (
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                {app.resumeName && (
                                                    <a 
                                                        href={`/api/resumes/${app.resume_id}/download`} 
                                                        target="_blank" 
                                                        className="text-indigo-600 hover:underline text-sm flex items-center gap-1"
                                                    >
                                                        <FileText className="w-3 h-3" />
                                                        {app.resumeName}
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
                                        {activeTab === 'referral' ? (
                                            <select
                                                value={app.status}
                                                onChange={(e) => handleUpdateStatus(app.id, e.target.value)}
                                                className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                            >
                                                <option value="applied">已申请</option>
                                                <option value="reviewed">简历已阅</option>
                                                <option value="referred">已内推</option>
                                                <option value="interviewing">面试中</option>
                                                <option value="success">内推成功</option>
                                                <option value="failed">内推失败</option>
                                                <option value="rejected">已拒绝</option>
                                            </select>
                                        ) : (
                                            <span className="text-gray-400 text-xs">
                                                用户手动更新
                                            </span>
                                        )}
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
