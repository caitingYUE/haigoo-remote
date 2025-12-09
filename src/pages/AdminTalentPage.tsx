
import React, { useState, useEffect, useRef } from 'react';
import { 
    Users, Search, Upload, FileText, Filter, 
    MoreHorizontal, Edit, Trash2, X, Plus, 
    Check, Loader2, Download
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotificationHelpers } from '../components/NotificationSystem';

// Type Definitions
interface Talent {
    id: number;
    talent_id: string;
    name: string;
    title: string;
    email: string;
    phone: string;
    skills: string[];
    tags: string[];
    summary: string;
    education: any[];
    years_of_experience: number;
    resume_url: string;
    created_at: string;
    source: string;
}

export default function AdminTalentPage() {
    const navigate = useNavigate();
    const { token } = useAuth();
    const { showSuccess, showError } = useNotificationHelpers();
    
    const [talents, setTalents] = useState<Talent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    const [uploading, setUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    
    const [editingTalent, setEditingTalent] = useState<Talent | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dirInputRef = useRef<HTMLInputElement>(null);

    // Fetch Talents
    const fetchTalents = async (pageNum = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pageNum.toString(),
                pageSize: '20',
                search: search
            });
            
            const res = await fetch(`/api/data/talent-pool?${params}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            
            if (data.success) {
                setTalents(data.talents);
                setTotal(data.total);
                setTotalPages(data.totalPages);
                setPage(data.page);
            }
        } catch (e) {
            console.error(e);
            showError('加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTalents(1);
    }, [search]); // Debounce usually recommended, keeping simple for now

    // Handle File Upload
    const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        setUploading(true);
        const formData = new FormData();
        
        // Filter for document types
        let count = 0;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            // Simple check
            if (file.name.match(/\.(pdf|docx|doc|txt)$/i)) {
                formData.append('files', file);
                count++;
            }
        }

        if (count === 0) {
            showError('没有找到有效的简历文件 (pdf, docx, txt)');
            setUploading(false);
            return;
        }

        try {
            const res = await fetch('/api/data/talent-pool?action=upload', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            const data = await res.json();
            
            if (data.success) {
                showSuccess(`成功上传 ${data.results.length} 份简历`);
                fetchTalents(1);
            } else {
                showError(data.error || '上传失败');
            }
        } catch (e) {
            showError('上传出错');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (dirInputRef.current) dirInputRef.current.value = '';
        }
    };

    // Save Edit
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTalent) return;
        
        setSaving(true);
        try {
            const res = await fetch(`/api/data/talent-pool?id=${editingTalent.talent_id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(editingTalent)
            });
            const data = await res.json();
            
            if (data.success) {
                showSuccess('保存成功');
                setIsModalOpen(false);
                setEditingTalent(null);
                fetchTalents(page); // Refresh current page
            } else {
                showError(data.error || '保存失败');
            }
        } catch (e) {
            showError('保存出错');
        } finally {
            setSaving(false);
        }
    };

    // Delete
    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这个人才吗？')) return;
        
        try {
            const res = await fetch(`/api/data/talent-pool?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                showSuccess('删除成功');
                fetchTalents(page);
            }
        } catch (e) {
            showError('删除失败');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-[1400px] mx-auto space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Users className="w-6 h-6 text-indigo-600" />
                            人才管理
                        </h1>
                        <p className="text-slate-500 mt-1">管理简历库、标记人才、人岗匹配预备</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => navigate('/admin/data')}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-50 rounded-lg"
                        >
                            返回后台
                        </button>
                        <div className="relative group">
                            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2 shadow-sm shadow-indigo-200">
                                <Upload className="w-4 h-4" />
                                上传简历
                            </button>
                            {/* Dropdown for File/Folder */}
                            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-slate-100 p-2 hidden group-hover:block z-10">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-2 text-sm text-slate-700"
                                >
                                    <FileText className="w-4 h-4" /> 选择文件
                                </button>
                                <button 
                                    onClick={() => dirInputRef.current?.click()}
                                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded flex items-center gap-2 text-sm text-slate-700"
                                >
                                    <Loader2 className="w-4 h-4" /> 选择文件夹
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hidden Inputs */}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleUpload} 
                    multiple 
                    className="hidden" 
                    accept=".pdf,.docx,.doc,.txt"
                />
                <input 
                    type="file" 
                    ref={dirInputRef} 
                    onChange={handleUpload} 
                    // @ts-ignore
                    webkitdirectory="" 
                    directory=""
                    multiple 
                    className="hidden" 
                />

                {/* Filters & Content */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center gap-4">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="搜索姓名、职位、技能..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500/20 text-sm"
                            />
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            共 {total} 位人才
                            {uploading && <span className="ml-2 flex items-center gap-1 text-indigo-600"><Loader2 className="w-3 h-3 animate-spin" /> 上传解析中...</span>}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-3 w-12">#</th>
                                    <th className="px-4 py-3">姓名</th>
                                    <th className="px-4 py-3">当前职位</th>
                                    <th className="px-4 py-3">经验/学历</th>
                                    <th className="px-4 py-3">技能标签</th>
                                    <th className="px-4 py-3">人才库标签</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">加载中...</td></tr>
                                ) : talents.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-slate-400">暂无数据，请上传简历</td></tr>
                                ) : (
                                    talents.map((t, idx) => (
                                        <tr key={t.talent_id} className="hover:bg-slate-50/50 group">
                                            <td className="px-4 py-3 text-slate-400">{(page - 1) * 20 + idx + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{t.name || '未命名'}</div>
                                                <div className="text-xs text-slate-500">{t.email}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">{t.title || '-'}</td>
                                            <td className="px-4 py-3 text-slate-600">
                                                <div>{t.years_of_experience ? `${t.years_of_experience}年` : '-'}</div>
                                                {/* <div className="text-xs text-slate-400">本科</div> */}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {t.skills?.slice(0, 3).map((s, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">{s}</span>
                                                    ))}
                                                    {t.skills?.length > 3 && <span className="text-xs text-slate-400">+{t.skills.length - 3}</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {t.tags?.map((tag, i) => (
                                                        <span key={i} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded text-xs border border-indigo-100">{tag}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => { setEditingTalent(t); setIsModalOpen(true); }}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                                                        title="编辑"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDelete(t.talent_id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="p-4 border-t border-slate-100 flex justify-center gap-2">
                        <button 
                            disabled={page === 1} 
                            onClick={() => fetchTalents(page - 1)}
                            className="px-3 py-1 border rounded hover:bg-slate-50 disabled:opacity-50 text-sm"
                        >
                            上一页
                        </button>
                        <span className="px-3 py-1 text-sm text-slate-600">第 {page} / {totalPages} 页</span>
                        <button 
                            disabled={page === totalPages} 
                            onClick={() => fetchTalents(page + 1)}
                            className="px-3 py-1 border rounded hover:bg-slate-50 disabled:opacity-50 text-sm"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {isModalOpen && editingTalent && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h2 className="text-lg font-bold">编辑人才信息</h2>
                            <button onClick={() => setIsModalOpen(false)}><X className="w-5 h-5 text-slate-400" /></button>
                        </div>
                        
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">姓名</label>
                                    <input 
                                        type="text" 
                                        value={editingTalent.name} 
                                        onChange={e => setEditingTalent({...editingTalent, name: e.target.value})}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">职位 Title</label>
                                    <input 
                                        type="text" 
                                        value={editingTalent.title} 
                                        onChange={e => setEditingTalent({...editingTalent, title: e.target.value})}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">邮箱</label>
                                    <input 
                                        type="email" 
                                        value={editingTalent.email} 
                                        onChange={e => setEditingTalent({...editingTalent, email: e.target.value})}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">电话</label>
                                    <input 
                                        type="text" 
                                        value={editingTalent.phone} 
                                        onChange={e => setEditingTalent({...editingTalent, phone: e.target.value})}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">工作年限</label>
                                    <input 
                                        type="number" 
                                        value={editingTalent.years_of_experience || 0} 
                                        onChange={e => setEditingTalent({...editingTalent, years_of_experience: parseInt(e.target.value)})}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">技能 (逗号分隔)</label>
                                <textarea 
                                    value={editingTalent.skills?.join(', ')} 
                                    onChange={e => setEditingTalent({...editingTalent, skills: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 h-20"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">人才库标签 (逗号分隔)</label>
                                <input 
                                    type="text" 
                                    value={editingTalent.tags?.join(', ')} 
                                    onChange={e => setEditingTalent({...editingTalent, tags: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="例如: 潜力股, 待面试, 技术大牛"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">个人总结 / 备注</label>
                                <textarea 
                                    value={editingTalent.summary} 
                                    onChange={e => setEditingTalent({...editingTalent, summary: e.target.value})}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500/20 h-24"
                                />
                            </div>
                        </form>

                        <div className="p-4 border-t bg-slate-50 flex justify-end gap-3">
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                保存修改
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
