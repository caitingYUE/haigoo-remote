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
    const { token, isSuperAdmin } = useAuth()
    const { showSuccess, showError } = useNotificationHelpers()
    
    const [applications, setApplications] = useState<MemberApplication[]>([])
    const [loading, setLoading] = useState(true)
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [stats, setStats] = useState({ member_count: 0 })

    // Approval Modal State
    const [showApprovalModal, setShowApprovalModal] = useState(false)
    const [selectedAppId, setSelectedAppId] = useState<number | null>(null)
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')

    useEffect(() => {
        fetchApplications()
        fetchStats()
    }, [page])

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
                type: 'member',
                page: page.toString(),
                limit: '20'
            })
            const res = await fetch(`/api/admin-ops?${params}`, {
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
        if (status === 'approved') {
            setSelectedAppId(id);
            // Default dates: Start = Today, End = Today + 1 Year
            const start = new Date();
            const end = new Date();
            end.setFullYear(end.getFullYear() + 1);
            
            setStartDate(start.toISOString().split('T')[0]);
            setEndDate(end.toISOString().split('T')[0]);
            setShowApprovalModal(true);
            return;
        }

        const confirmMsg = `确定要拒绝此申请吗？`;
        if (!confirm(confirmMsg)) return;

        await submitStatusUpdate(id, status);
    }

    const handleConfirmApproval = async () => {
        if (!selectedAppId) return;
        await submitStatusUpdate(selectedAppId, 'approved', startDate, endDate);
        setShowApprovalModal(false);
    }

    const submitStatusUpdate = async (id: number, status: string, start?: string, end?: string) => {
        try {
            const params = new URLSearchParams({
                action: 'application_update_status',
                type: 'member'
            });
            const body: any = { id, status, type: 'member' };
            if (start && end) {
                body.startDate = start;
                body.endDate = end;
            }

            const res = await fetch(`/api/admin-ops?${params}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
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

    const handleDeleteApplication = async (id: number) => {
        if (!confirm('确定要删除此申请记录吗？此操作不可撤销。')) return;

        try {
            const params = new URLSearchParams({
                action: 'delete_application',
                id: id.toString(),
                type: 'member'
            });
            const res = await fetch(`/api/admin-applications?${params}`, {
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
                                        <div className="flex flex-col gap-2 justify-end">
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
                                            {isSuperAdmin && (
                                                <button
                                                    onClick={() => handleDeleteApplication(app.id)}
                                                    className="text-gray-400 hover:text-red-600 text-xs self-end"
                                                >
                                                    删除记录
                                                </button>
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

            {/* Approval Modal */}
            {showApprovalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            审批通过 - 设置会员有效期
                        </h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    生效日期 (Start Date)
                                </label>
                                <input 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    失效日期 (End Date)
                                </label>
                                <input 
                                    type="date" 
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-700">
                                提示：通过后系统将自动发送站内信通知用户。
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                onClick={() => setShowApprovalModal(false)}
                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleConfirmApproval}
                                className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 shadow-sm"
                            >
                                确认通过
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
