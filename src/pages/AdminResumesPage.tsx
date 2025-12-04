
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FileText,
    Trash2,
    Search,
    RefreshCw,
    User,
    Calendar,
    CheckCircle,
    XCircle,
    AlertCircle
} from 'lucide-react';

interface ParsedResume {
    name?: string;
    email?: string;
    mobile_number?: string;
    skills?: string[] | string;
    education?: string[] | string;
    experience?: string[] | string;
    [key: string]: any;
}

interface ResumeRecord {
    id: string;
    userId: string;
    fileName: string;
    size: number;
    parseStatus: 'success' | 'failed' | 'partial';
    parsedData: ParsedResume;
    uploadedAt: string;
}

const AdminResumesPage: React.FC = () => {
    const [resumes, setResumes] = useState<ResumeRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [storageProvider, setStorageProvider] = useState<string>('');

    const fetchResumes = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('haigoo_auth_token');
            const res = await fetch('/api/resumes', {
                headers: {
                    'Authorization': `Bearer ${token || ''}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                setResumes(data.data || []);
                setStorageProvider(data.provider || 'unknown');
            } else {
                console.error('Failed to fetch resumes');
            }
        } catch (error) {
            console.error('Error fetching resumes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResumes();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('确定要删除这份简历吗？')) return;

        try {
            const token = localStorage.getItem('haigoo_auth_token');
            const res = await fetch(`/api/resumes?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token || ''}`
                }
            });

            if (res.ok) {
                setResumes(prev => prev.filter(r => r.id !== id));
            } else {
                alert('删除失败');
            }
        } catch (error) {
            alert('删除出错: ' + error);
        }
    };

    const filteredResumes = resumes.filter(resume => {
        const term = searchTerm.toLowerCase();
        const name = resume.parsedData?.name?.toLowerCase() || '';
        const email = resume.parsedData?.email?.toLowerCase() || '';
        const fileName = resume.fileName.toLowerCase();

        return name.includes(term) || email.includes(term) || fileName.includes(term);
    });

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('zh-CN');
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-6">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">简历管理</h1>
                            <p className="text-slate-600">管理用户上传的简历数据</p>
                        </div>
                        <div className="flex space-x-3">
                            <Link
                                to="/admin"
                                className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                            >
                                返回仪表盘
                            </Link>
                            <button
                                onClick={fetchResumes}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                            >
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                刷新列表
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="bg-white rounded-lg shadow mb-6">
                    <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                        <div className="flex items-center max-w-md w-full bg-slate-100 rounded-md px-3 py-2">
                            <Search className="w-5 h-5 text-slate-400 mr-2" />
                            <input
                                type="text"
                                placeholder="搜索姓名、邮箱或文件名..."
                                className="bg-transparent border-none focus:ring-0 w-full text-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="text-sm text-slate-500">
                            存储提供者: <span className="font-medium text-slate-900">{storageProvider}</span>
                            <span className="mx-2">|</span>
                            总计: <span className="font-medium text-slate-900">{resumes.length}</span>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">候选人</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">文件信息</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">解析状态</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">上传时间</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            加载中...
                                        </td>
                                    </tr>
                                ) : filteredResumes.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                            暂无简历数据
                                        </td>
                                    </tr>
                                ) : (
                                    filteredResumes.map((resume) => (
                                        <tr key={resume.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                        <User className="w-5 h-5 text-blue-600" />
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-slate-900">
                                                            {resume.parsedData?.name || '未知姓名'}
                                                        </div>
                                                        <div className="text-sm text-slate-500">
                                                            {resume.parsedData?.email || '无邮箱'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <FileText className="w-4 h-4 text-slate-400 mr-2" />
                                                    <div>
                                                        <div className="text-sm text-slate-900">{resume.fileName}</div>
                                                        <div className="text-sm text-slate-500">{formatSize(resume.size)}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {resume.parseStatus === 'success' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        <CheckCircle className="w-3 h-3 mr-1 self-center" /> 解析成功
                                                    </span>
                                                ) : resume.parseStatus === 'partial' ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                                                        <AlertCircle className="w-3 h-3 mr-1 self-center" /> 部分解析
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                                                        <XCircle className="w-3 h-3 mr-1 self-center" /> 解析失败
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                <div className="flex items-center">
                                                    <Calendar className="w-4 h-4 mr-2 text-slate-400" />
                                                    {formatDate(resume.uploadedAt)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex space-x-3">
                                                    <button
                                                        onClick={() => {
                                                            alert(JSON.stringify(resume.parsedData, null, 2))
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900"
                                                        title="查看详情"
                                                    >
                                                        <FileText className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(resume.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="删除"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
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
};

export default AdminResumesPage;
