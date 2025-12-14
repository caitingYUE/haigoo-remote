import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle, XCircle, AlertCircle, MessageSquare, Reply, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
}

export default function AdminFeedbackList() {
    const { token } = useAuth();
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

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

    if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="space-y-6">
            <div className="card">
                <div className="card-header">
                    <h2>用户反馈列表</h2>
                    <span className="text-sm text-slate-500">共 {feedbacks.length} 条</span>
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
                                                {!feedback.replyContent && (
                                                    <button
                                                        onClick={() => handleReply(feedback.id)}
                                                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                        title="回复用户"
                                                    >
                                                        <Reply className="w-4 h-4" />
                                                    </button>
                                                )}
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
