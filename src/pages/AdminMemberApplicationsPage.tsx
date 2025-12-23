import React, { useState, useEffect } from 'react'
import { 
    Search, CheckCircle, XCircle, Clock, 
    FileText, User, MessageSquare, Briefcase
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

interface MemberApplication {
    id: number
    user_id: string
    username: string
    email: string
    avatar: string
    nickname: string
    experience: string
    career_ideal: string
    portfolio: string
    expectations: string
    contribution: string
    contact: string
    contact_type: string
    status: string
    created_at: string
    updated_at: string
}

export default function AdminMemberApplicationsPage() {
    const { token } = useAuth()
    const { showSuccess, showError } = useNotificationHelpers()
    
    const [applications, setApplications] = useState<MemberApplication[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [stats, setStats] = useState({ member_count: 0 })

    useEffect(() => {
        fetchApplications()
        fetchStats()
    }, [page])

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
                type: 'member',
                page: page.toString(),
                limit: '20'
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

    const handleUpdateStatus = async (id: number, status: string) => {
        if (!confirm(`确定要将此申请标记为 ${status === 'approved' ? '通过' : '拒绝'} 吗？`)) return;

        try {
            const res = await fetch('/api/admin-applications?action=update_status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id, status, type: 'member' })
            })
            const data = await res.json()
            if (data.success) {
                showSuccess('状态更新成功')
                fetchApplications()
                fetchStats()
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
            'approved': 'bg-green-100 text-green-800',
            'rejected': 'bg-red-100 text-red-800'
        }
        
        const labels: Record<string, string> = {
            'pending': '待审核',
            'approved': '已通过',
            'rejected': '已拒绝'
        }

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
                {labels[status] || status}
            </span>
        )
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <User className="w-6 h-6" />
                    会员申请管理
                    {stats.member_count > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            {stats.member_count} 待处理
                        </span>
                    )}
                </h1>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请用户</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">申请详情</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">联系方式</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
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
                                            <div className="flex items-center gap-2">
                                                {app.avatar ? (
                                                    <img src={app.avatar} alt="" className="w-6 h-6 rounded-full" />
                                                ) : (
                                                    <div className="w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center text-xs text-indigo-600 font-bold">
                                                        {(app.username || 'U')[0]}
                                                    </div>
                                                )}
                                                <span className="font-medium text-gray-900">{app.nickname || app.username || '未知用户'}</span>
                                            </div>
                                            <span className="text-xs text-gray-500 ml-8">{app.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1 max-w-md">
                                            <div className="text-sm">
                                                <span className="font-medium text-gray-700">经历: </span>
                                                <span className="text-gray-600 line-clamp-2">{app.experience}</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="font-medium text-gray-700">理想: </span>
                                                <span className="text-gray-600 line-clamp-2">{app.career_ideal}</span>
                                            </div>
                                            {app.portfolio && (
                                                <div className="text-sm">
                                                    <span className="font-medium text-gray-700">作品集: </span>
                                                    <a href={app.portfolio} target="_blank" className="text-indigo-600 hover:underline truncate inline-block max-w-[200px] align-bottom">
                                                        {app.portfolio}
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-col">
                                            <span className="text-sm text-gray-900">{app.contact}</span>
                                            <span className="text-xs text-gray-500 uppercase">{app.contact_type}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {getStatusBadge(app.status)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex flex-col">
                                            <span>{new Date(app.created_at).toLocaleDateString()}</span>
                                            <span className="text-xs text-gray-400">{new Date(app.created_at).toLocaleTimeString()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        {app.status === 'pending' && (
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleUpdateStatus(app.id, 'approved')}
                                                    className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors"
                                                >
                                                    通过
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateStatus(app.id, 'rejected')}
                                                    className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded border border-red-200 hover:bg-red-100 transition-colors"
                                                >
                                                    拒绝
                                                </button>
                                            </div>
                                        )}
                                        {app.status !== 'pending' && (
                                            <span className="text-gray-400 text-xs">已处理</span>
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
