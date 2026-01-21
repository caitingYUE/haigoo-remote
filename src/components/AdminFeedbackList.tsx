import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, MessageSquare, Reply, User, Trash2, Download, Briefcase, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { SUPER_ADMIN_EMAILS } from '../config/admin';

interface Feedback {
    id: string;
    userId: string;
    username?: string;
    email?: string;
    jobId?: string;
    accuracy: 'accurate' | 'inaccurate' | 'unknown';
    content: string;
    contact: string;
    source?: string;
    sourceUrl?: string;
    createdAt: string;
    replyContent?: string;
    repliedAt?: string;
    companyName?: string;
    companyWebsite?: string;
    recruitmentNeeds?: string;
}

export default function AdminFeedbackList() {
    const { token, user } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const isSuperAdmin = user?.email && SUPER_ADMIN_EMAILS.includes(user.email);

    const fetchFeedbacks = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/user-profile?action=feedbacks_list', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                setFeedbacks(data.feedbacks || []);
            } else {
                setError(data.error || 'Failed to fetch feedbacks');
            }
        } catch (err) {
            setError('Network error');
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchFeedbacks();
    }, [fetchFeedbacks]);

    const handleReply = async (feedbackId: string) => {
        const content = window.prompt('请输入回复内容：');
        if (!content) return;

        try {
            const res = await fetch('/api/admin-ops?action=reply_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ feedbackId, replyContent: content })
            });
            const data = await res.json();
            if (data.success) {
                alert('回复成功');
                fetchFeedbacks();
            } else {
                alert('回复失败: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('回复失败: 网络错误');
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('确定要删除这条反馈记录吗？此操作不可恢复。')) return;
        
        try {
            const res = await fetch('/api/admin-ops?action=delete_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (data.success) {
                setFeedbacks(prev => prev.filter(f => f.id !== id));
            } else {
                alert('删除失败: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('删除失败: 网络错误');
        }
    };

    const handleExport = () => {
        if (feedbacks.length === 0) {
            alert('暂无数据可导出');
            return;
        }
        
        // Convert to CSV
        const headers = ['ID', 'User ID', 'Username', 'Email', 'Job ID', 'Accuracy', 'Content', 'Contact', 'Source', 'Created At', 'Reply Content', 'Replied At'];
        const rows = feedbacks.map(f => [
            f.id,
            f.userId || '',
            `"${(f.username || '').replace(/"/g, '""')}"`,
            `"${(f.email || '').replace(/"/g, '""')}"`,
            f.jobId || '',
            f.accuracy,
            `"${(f.content || '').replace(/"/g, '""')}"`,
            `"${(f.contact || '').replace(/"/g, '""')}"`,
            `"${(f.source || '').replace(/"/g, '""')}"`,
            new Date(f.createdAt).toLocaleString(),
            `"${(f.replyContent || '').replace(/"/g, '""')}"`,
            f.repliedAt ? new Date(f.repliedAt).toLocaleString() : ''
        ]);
        
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `user_feedbacks_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="card-header">
                    <h2>用户反馈列表</h2>
                    <div className="flex gap-2 items-center">
                        <span className="text-sm text-slate-500 mr-2">共 {feedbacks.length} 条</span>
                        {isSuperAdmin && (
                            <button 
                                onClick={handleExport}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
                                title="导出 CSV"
                            >
                                <Download className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
                <div className="card-content">
                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>时间/用户</th>
                                    <th>类型/准确性</th>
                                    <th>内容</th>
                                    <th>联系方式</th>
                                    <th>关联信息</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                {feedbacks.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-500">暂无反馈数据</td>
                                    </tr>
                                ) : (
                                    feedbacks.map(feedback => (
                                        <tr key={feedback.id}>
                                            <td className="text-sm text-slate-500">
                                                <div>{new Date(feedback.createdAt).toLocaleString()}</div>
                                                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400">
                                                    <User className="w-3 h-3" />
                                                    {feedback.username || feedback.userId.slice(0, 8)}
                                                </div>
                                            </td>
                                            <td>
                                                {feedback.jobId ? (
                                                    <span className={`status-badge ${feedback.accuracy === 'accurate' ? 'high' : feedback.accuracy === 'inaccurate' ? 'low' : 'medium'}`}>
                                                        {feedback.accuracy === 'accurate' ? <CheckCircle className="w-3 h-3 mr-1" /> :
                                                            feedback.accuracy === 'inaccurate' ? <XCircle className="w-3 h-3 mr-1" /> :
                                                                <AlertCircle className="w-3 h-3 mr-1" />}
                                                        {feedback.accuracy === 'accurate' ? '准确' : feedback.accuracy === 'inaccurate' ? '不准确' : '未知'}
                                                    </span>
                                                ) : (
                                                    <span className="status-badge medium">
                                                        <MessageSquare className="w-3 h-3 mr-1" /> 平台建议
                                                    </span>
                                                )}
                                            </td>
                                            <td className="max-w-md">
                                                <div className="text-sm text-slate-900 break-words">{feedback.content}</div>
                                                {feedback.companyName && (
                                                    <div className="mt-2 text-xs bg-indigo-50 p-2 rounded border border-indigo-100">
                                                        <div className="font-semibold text-indigo-700 mb-1 flex items-center gap-1">
                                                            <Briefcase className="w-3 h-3" /> 招聘需求信息
                                                        </div>
                                                        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-slate-700">
                                                            <span className="text-slate-500">企业:</span>
                                                            <span className="font-medium">{feedback.companyName}</span>
                                                            
                                                            <span className="text-slate-500">官网:</span>
                                                            <a href={feedback.companyWebsite} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline truncate">
                                                                {feedback.companyWebsite}
                                                            </a>
                                                        </div>
                                                    </div>
                                                )}
                                                {feedback.replyContent && (
                                                    <div className="mt-2 text-xs bg-slate-50 p-2 rounded border border-slate-100 text-slate-600">
                                                        <div className="font-semibold text-indigo-600 mb-1">管理员回复:</div>
                                                        {feedback.replyContent}
                                                        <div className="text-slate-400 mt-1">{new Date(feedback.repliedAt!).toLocaleString()}</div>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-sm text-slate-500">
                                                {feedback.contact || '-'}
                                            </td>
                                            <td className="text-sm">
                                                {feedback.jobId ? (
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">Job ID: {feedback.jobId}</span>
                                                        {feedback.source && <span className="text-xs text-slate-500">来源: {feedback.source}</span>}
                                                        {feedback.sourceUrl && (
                                                            <a href={feedback.sourceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline text-xs">
                                                                查看原始链接
                                                            </a>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400">-</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    {!feedback.replyContent && (
                                                        <button
                                                            onClick={() => handleReply(feedback.id)}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                            title="回复用户"
                                                        >
                                                            <Reply className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {isSuperAdmin && (
                                                        <button
                                                            onClick={() => handleDelete(feedback.id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                            title="删除"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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
                </div>
            </div>
        </div>
    );
}
