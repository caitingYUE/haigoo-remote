import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, RefreshCw, ExternalLink, Trash2, Loader2, Search, Edit2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TrustedCompany } from '../services/trusted-companies-service';
import { DateFormatter } from '../utils/date-formatter';
import { EditJobModal } from './EditJobModal';
import { dataManagementService, ProcessedJobData } from '../services/data-management-service';

interface AdminCompanyJobsModalProps {
    company: TrustedCompany;
    onClose: () => void;
    onUpdate?: (count: number) => void;
}

export default function AdminCompanyJobsModal({ company, onClose, onUpdate }: AdminCompanyJobsModalProps) {
    const { token } = useAuth();
    const [jobs, setJobs] = useState<ProcessedJobData[]>([]);
    const [loading, setLoading] = useState(true);
    const [crawling, setCrawling] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingJob, setEditingJob] = useState<ProcessedJobData | null>(null);
    
    // Pagination
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 10;

    const fetchJobs = useCallback(async () => {
        try {
            setLoading(true);
            // Use companyId for exact filtering
            const companyFilter = company.id ? `companyId=${company.id}` : `company=${encodeURIComponent(company.name)}`;
            const res = await fetch(`/api/data/processed-jobs?${companyFilter}&limit=${PAGE_SIZE}&page=${page}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.jobs) {
                setJobs(data.jobs);
                setTotal(data.total || 0);
                // Notify parent about total count
                if (onUpdate && typeof data.total === 'number') {
                    onUpdate(data.total);
                }
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
        } finally {
            setLoading(false);
        }
    }, [company.id, company.name, token, page, onUpdate]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    const handleCrawl = async () => {
        try {
            setCrawling(true);
            const res = await fetch(`/api/data/trusted-companies?action=crawl-jobs&id=${company.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                alert(`抓取成功，新增/更新 ${data.count} 个职位`);
                // Reset to page 1 to see new jobs
                setPage(1);
                fetchJobs();
            } else {
                alert(`抓取失败: ${data.error}`);
            }
        } catch (error) {
            alert('抓取请求失败');
        } finally {
            setCrawling(false);
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if (!confirm('确定要删除这个职位吗？')) return;
        
        try {
            const res = await fetch(`/api/data/processed-jobs?id=${encodeURIComponent(jobId)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (res.ok) {
                setJobs(prev => prev.filter(j => j.id !== jobId));
                
                // Optimistic update for total count
                const newTotal = Math.max(0, total - 1);
                setTotal(newTotal);
                if (onUpdate) {
                    onUpdate(newTotal);
                }

                if (jobs.length === 1 && page > 1) {
                    setPage(p => p - 1);
                } else {
                    fetchJobs(); // Refresh current page to fill the gap
                }
            } else {
                const data = await res.json();
                alert(`删除失败: ${data.error || res.statusText}`);
            }
        } catch (error) {
            console.error('Delete job error:', error);
            alert('删除请求失败');
        }
    };

    const handleEditJob = (job: ProcessedJobData) => {
        setEditingJob(job);
    };

    const handleSaveEdit = async (updatedJob: Partial<ProcessedJobData>, shouldClose: boolean = true) => {
        if (!editingJob) return;

        try {
            // Optimistic update
            setJobs(prev => prev.map(job => 
                job.id === editingJob.id ? { ...job, ...updatedJob } as ProcessedJobData : job
            ));

            if (editingJob.id) {
                await dataManagementService.updateProcessedJob(editingJob.id, updatedJob, 'admin');
            }
            
            if (shouldClose) {
                setEditingJob(null);
            }
        } catch (error) {
            console.error('Failed to save job:', error);
            alert('保存失败');
            fetchJobs(); // Revert on error
        }
    };

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            {company.logo && <img src={company.logo} className="w-6 h-6 object-contain rounded" alt="" />}
                            {company.name} - 职位管理
                        </h2>
                        <p className="text-sm text-slate-500 mt-1">共 {jobs.length} 个职位</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-slate-50">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="搜索职位..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border-slate-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                    </div>
                    <button
                        onClick={handleCrawl}
                        disabled={crawling}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 text-sm font-medium"
                    >
                        {crawling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        {crawling ? '抓取中...' : '立即抓取'}
                    </button>
                    <button
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"
                        onClick={() => alert('手动录入功能开发中...')}
                    >
                        <Plus className="w-4 h-4" />
                        手动录入
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-0">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">职位名称</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">地点</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">发布时间</th>
                                    <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredJobs.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                                            暂无职位数据，请尝试抓取
                                        </td>
                                    </tr>
                                ) : (
                                    filteredJobs.map(job => (
                                        <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-slate-900">{job.title}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{job.jobType}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600">
                                                {job.location}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                {DateFormatter.formatPublishTime(job.publishedAt)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {job.url && (
                                                        <a
                                                            href={job.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                                                            title="查看原网页"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleEditJob(job)}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors"
                                                        title="编辑"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteJob(job.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
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
                    )}
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white rounded-b-2xl">
                    <span className="text-sm text-slate-500">
                        共 {total} 个职位
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        >
                            上一页
                        </button>
                        <span className="text-sm text-slate-600 self-center">
                             {page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page * PAGE_SIZE >= total || loading}
                            className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-white"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>
            
            {editingJob && (
                <EditJobModal
                    job={editingJob}
                    onSave={handleSaveEdit}
                    onClose={() => setEditingJob(null)}
                    availableCategories={['前端开发', '后端开发', '全栈开发', '移动开发', 'UI/UX设计', '产品经理', '数据分析', '运维/SRE', '市场营销', '人工智能', 'Web3/区块链']}
                />
            )}
        </div>
    );
}
