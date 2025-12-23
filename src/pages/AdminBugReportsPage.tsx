import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, CheckCircle, XCircle, AlertCircle, MessageSquare, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BugReport {
    id: number;
    user_id: string;
    user_nickname: string;
    title: string;
    description: string;
    // image_url is NOT returned in list view by default, but we might have a has_image flag
    has_image?: boolean;
    image_url?: string; // Only populated in detail view
    status: 'open' | 'in_progress' | 'resolved' | 'closed';
    created_at: string;
    updated_at: string;
    contact_info?: string;
    admin_reply?: string;
    replied_at?: string;
}

export default function AdminBugReportsPage() {
    const { user, token } = useAuth();
    const [bugs, setBugs] = useState<BugReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatingId, setUpdatingId] = useState<number | null>(null);
    
    // Reply State
    const [replyingId, setReplyingId] = useState<number | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSendingReply, setIsSendingReply] = useState(false);

    // Image Preview Modal State
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);

    useEffect(() => {
        fetchBugs();
    }, []);

    const fetchBugs = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin-ops?action=bug_report', {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const json = await res.json();
            if (json.success) {
                setBugs(json.data);
            } else {
                throw new Error(json.error || 'Failed to fetch bugs');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchBugDetail = async (id: number) => {
        setLoadingImage(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin-ops?action=bug_report&id=${id}`, {
                headers: {
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            });
            const json = await res.json();
            if (json.success && json.data.image_url) {
                setPreviewImage(json.data.image_url);
            } else {
                alert('No image found or failed to load.');
            }
        } catch (err) {
            console.error(err);
            alert('Failed to load image.');
        } finally {
            setLoadingImage(false);
        }
    };

    const updateStatus = async (id: number, newStatus: string) => {
        setUpdatingId(id);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin-ops?action=bug_report', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id, status: newStatus })
            });
            const json = await res.json();
            if (json.success) {
                setBugs(bugs.map(b => b.id === id ? { ...b, status: newStatus as any, updated_at: new Date().toISOString() } : b));
            } else {
                alert(json.error || 'Failed to update status');
            }
        } catch (err) {
            alert('Failed to update status');
        } finally {
            setUpdatingId(null);
        }
    };

    const submitReply = async () => {
        if (!replyingId || !replyContent.trim()) return;
        setIsSendingReply(true);
        try {
            const res = await fetch('/api/admin-ops?action=bug_report', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({ id: replyingId, replyContent })
            });
            const json = await res.json();
            if (json.success) {
                setBugs(bugs.map(b => b.id === replyingId ? { ...b, admin_reply: replyContent, replied_at: new Date().toISOString() } : b));
                setReplyingId(null);
                setReplyContent('');
                // alert('Reply sent successfully!');
            } else {
                alert(json.error || 'Failed to send reply');
            }
        } catch (err) {
            alert('Failed to send reply');
        } finally {
            setIsSendingReply(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'open': return <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs font-bold">Open</span>;
            case 'in_progress': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-bold">In Progress</span>;
            case 'resolved': return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-bold">Resolved</span>;
            case 'closed': return <span className="px-2 py-1 bg-slate-100 text-slate-800 rounded-full text-xs font-bold">Closed</span>;
            default: return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs">{status}</span>;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <MessageSquare className="w-8 h-8 text-indigo-600" />
                        Bug Reports & Feedback
                    </h1>
                    <Link to="/admin_team" className="text-indigo-600 hover:text-indigo-800">
                        Back to Dashboard
                    </Link>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 text-sm font-semibold text-slate-600">ID</th>
                                        <th className="p-4 text-sm font-semibold text-slate-600">Status</th>
                                        <th className="p-4 text-sm font-semibold text-slate-600">Title</th>
                                        <th className="p-4 text-sm font-semibold text-slate-600">Reporter</th>
                                        <th className="p-4 text-sm font-semibold text-slate-600">Date</th>
                                        <th className="p-4 text-sm font-semibold text-slate-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {bugs.map(bug => (
                                        <tr key={bug.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 text-sm text-slate-500">#{bug.id}</td>
                                            <td className="p-4">{getStatusBadge(bug.status)}</td>
                                            <td className="p-4">
                                                <div className="font-medium text-slate-900">{bug.title}</div>
                                                <div className="text-sm text-slate-500 mt-1 line-clamp-2 max-w-md" title={bug.description}>{bug.description}</div>
                                                {bug.has_image && (
                                                    <div className="mt-2">
                                                        <button 
                                                            onClick={() => fetchBugDetail(bug.id)}
                                                            disabled={loadingImage}
                                                            className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
                                                        >
                                                            {loadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                                                            View Screenshot
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-slate-700">
                                                {bug.user_nickname}
                                                <div className="text-xs text-slate-400">{bug.user_id ? 'Member' : 'Anonymous'}</div>
                                                {bug.contact_info && (
                                                    <div className="text-xs text-indigo-600 mt-1 select-all">{bug.contact_info}</div>
                                                )}
                                            </td>
                                            <td className="p-4 text-sm text-slate-500">
                                                {new Date(bug.created_at).toLocaleDateString()}
                                                {bug.admin_reply && (
                                                    <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                        <CheckCircle className="w-3 h-3" /> Replied
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-4 flex items-center gap-2">
                                                <select
                                                    value={bug.status}
                                                    onChange={(e) => updateStatus(bug.id, e.target.value)}
                                                    disabled={updatingId === bug.id}
                                                    className="text-sm border border-slate-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                                >
                                                    <option value="open">Open</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="resolved">Resolved</option>
                                                    <option value="closed">Closed</option>
                                                </select>
                                                {updatingId === bug.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                                                
                                                <button
                                                    onClick={() => {
                                                        setReplyingId(bug.id);
                                                        setReplyContent(bug.admin_reply || '');
                                                    }}
                                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                                    title="Reply"
                                                >
                                                    <MessageSquare className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {bugs.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-slate-500">
                                                No bug reports yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Image Preview Modal */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200"
                    onClick={() => setPreviewImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] overflow-auto bg-white rounded-lg p-2" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setPreviewImage(null)}
                            className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-10"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <img src={previewImage} alt="Bug Screenshot" className="max-w-full h-auto rounded" />
                    </div>
                </div>
            )}

            {/* Reply Modal */}
            {replyingId && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
                    onClick={() => setReplyingId(null)}
                >
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">Reply to User</h3>
                        <textarea
                            value={replyContent}
                            onChange={(e) => setReplyContent(e.target.value)}
                            placeholder="Enter your reply here..."
                            rows={4}
                            className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none mb-4 resize-none"
                        />
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setReplyingId(null)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={submitReply}
                                disabled={isSendingReply}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSendingReply && <Loader2 className="w-4 h-4 animate-spin" />}
                                Send Reply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
