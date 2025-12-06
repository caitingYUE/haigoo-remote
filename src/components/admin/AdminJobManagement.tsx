import React, { useState, useMemo } from 'react';
import {
    Search, Filter, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    Trash2, X, Star, Calendar, MapPin, Building, Briefcase, Eye, AlertCircle
} from 'lucide-react';
import { Job, JobFilter, JobCategory } from '../../types/rss-types';
import { jobAggregator } from '../../services/job-aggregator';

interface AdminJobManagementProps {
    jobs: Job[];
    loading: boolean;
    filter: JobFilter;
    onFilterChange: (filter: JobFilter) => void;
    searchTerm: string;
    onSearch: (term: string) => void;
    onRefresh: () => Promise<void>;
}

const AdminJobManagement: React.FC<AdminJobManagementProps> = ({
    jobs,
    loading,
    filter,
    onFilterChange,
    searchTerm,
    onSearch,
    onRefresh
}) => {
    // Local state for UI
    const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);

    // Sorting state
    const [sortBy, setSortBy] = useState<'publishedAt' | 'title' | 'company' | 'remoteLocationRestriction'>('publishedAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(20);

    // Reset pagination when filter or search changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm]);

    // Job Detail Modal State
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showJobDetail, setShowJobDetail] = useState(false);
    const [currentJobIndex, setCurrentJobIndex] = useState(-1);

    // Dropdown toggles
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);

    // --- Helpers ---
    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return '无效日期';
        try {
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) return '无效日期';
            return new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }).format(dateObj);
        } catch (error) {
            return '无效日期';
        }
    };

    const getStatusColor = (status: Job['status']) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'inactive': return 'text-yellow-600 bg-yellow-100';
            case 'archived': return 'text-red-600 bg-red-100';
            default: return 'text-slate-600 bg-slate-100';
        }
    };

    const getUniqueCategories = () => {
        const categories = [...new Set(jobs.map(job => job.category).filter(Boolean))];
        return categories.sort();
    };

    // --- Logic ---

    // Sorting
    const sortedJobs = useMemo(() => {
        const sorted = [...jobs].sort((a, b) => {
            let aValue: any, bValue: any;
            switch (sortBy) {
                case 'publishedAt':
                    aValue = new Date(a.publishedAt || 0).getTime();
                    bValue = new Date(b.publishedAt || 0).getTime();
                    break;
                case 'title':
                    aValue = a.title?.toLowerCase() || '';
                    bValue = b.title?.toLowerCase() || '';
                    break;
                case 'company':
                    aValue = a.company?.toLowerCase() || '';
                    bValue = b.company?.toLowerCase() || '';
                    break;
                case 'remoteLocationRestriction':
                    aValue = a.remoteLocationRestriction?.toLowerCase() || '';
                    bValue = b.remoteLocationRestriction?.toLowerCase() || '';
                    break;
                default:
                    return 0;
            }
            if (sortOrder === 'asc') {
                return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
            } else {
                return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
            }
        });
        return sorted;
    }, [jobs, sortBy, sortOrder]);

    // Pagination
    const totalPages = Math.max(1, Math.ceil(sortedJobs.length / itemsPerPage));
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentJobs = sortedJobs.slice(startIndex, endIndex);

    // --- Handlers ---

    const handleSort = (field: 'publishedAt' | 'title' | 'company' | 'remoteLocationRestriction') => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
        setCurrentPage(1);
    };

    const handleCategoryFilter = (category: string) => {
        onFilterChange({
            ...filter,
            category: category === 'all' ? undefined : [category as JobCategory]
        });
        setCurrentPage(1);
        setShowCategoryFilter(false);
    };

    const handleJobDelete = async (jobId: string) => {
        if (confirm('确定要删除这个岗位吗？')) {
            jobAggregator.deleteJob(jobId);
            await onRefresh();
        }
    };

    const handleBatchDelete = async () => {
        if (selectedJobs.length === 0) return;
        if (confirm(`确定要删除选中的 ${selectedJobs.length} 个岗位吗？`)) {
            selectedJobs.forEach(jobId => {
                jobAggregator.deleteJob(jobId);
            });
            setSelectedJobs([]);
            await onRefresh();
        }
    };

    const handleBatchUpdateCategory = async (category: JobCategory) => {
        if (selectedJobs.length === 0) return;
        const updatedCount = jobAggregator.batchUpdateCategory(selectedJobs, category);
        alert(`已更新 ${updatedCount} 个岗位的分类`);
        setSelectedJobs([]);
        await onRefresh();
    };

    const handleJobStatusUpdate = async (jobId: string, status: Job['status']) => {
        await jobAggregator.updateJobStatus(jobId, status);
        await onRefresh();
    };

    const handleToggleFeatured = async (jobId: string, isFeatured: boolean) => {
        try {
            const success = await jobAggregator.updateJobFeaturedStatus(jobId, isFeatured);
            if (success) {
                await onRefresh();
                if (selectedJob?.id === jobId) {
                    setSelectedJob({ ...selectedJob, isFeatured });
                }
            } else {
                alert('更新精选状态失败：未找到该岗位');
            }
        } catch (error) {
            console.error('Failed to toggle featured status:', error);
            alert('更新精选状态失败');
        }
    };

    // Job Detail Handlers
    const handleViewJobDetail = (job: Job, index: number) => {
        setSelectedJob(job);
        setCurrentJobIndex(index);
        setShowJobDetail(true);
    };

    const handleCloseJobDetail = () => {
        setShowJobDetail(false);
        setSelectedJob(null);
        setCurrentJobIndex(-1);
    };

    const handleNavigateJob = (direction: 'prev' | 'next') => {
        const newIndex = direction === 'prev' ? currentJobIndex - 1 : currentJobIndex + 1;
        if (newIndex >= 0 && newIndex < currentJobs.length) {
            setCurrentJobIndex(newIndex);
            setSelectedJob(currentJobs[newIndex]);
        }
    };

    return (
        <div>
            {/* 搜索和筛选 */}
            <div className="bg-white rounded-lg shadow mb-6 p-6">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="搜索岗位标题、公司或描述..."
                                value={searchTerm}
                                onChange={(e) => onSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-md shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-slate-50"
                    >
                        <Filter className="w-4 h-4 mr-2" />
                        筛选
                    </button>
                </div>

                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">岗位状态</label>
                                <select
                                    value={filter.status?.[0] || ''}
                                    onChange={(e) => onFilterChange({
                                        ...filter,
                                        status: e.target.value ? [e.target.value as Job['status']] : undefined
                                    })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">全部状态</option>
                                    <option value="active">活跃</option>
                                    <option value="inactive">非活跃</option>
                                    <option value="archived">已删除</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">工作类型</label>
                                <select
                                    value={filter.jobType?.[0] || ''}
                                    onChange={(e) => onFilterChange({
                                        ...filter,
                                        jobType: e.target.value ? [e.target.value as Job['jobType']] : undefined
                                    })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">全部类型</option>
                                    <option value="Full-time">全职</option>
                                    <option value="Part-time">兼职</option>
                                    <option value="Contract">合同</option>
                                    <option value="Freelance">自由职业</option>
                                    <option value="Internship">实习</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">数据源</label>
                                <select
                                    value={filter.source?.[0] || ''}
                                    onChange={(e) => onFilterChange({
                                        ...filter,
                                        source: e.target.value ? [e.target.value] : undefined
                                    })}
                                    className="w-full border border-slate-300 rounded-md px-3 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    <option value="">全部来源</option>
                                    <option value="WeWorkRemotely">WeWorkRemotely</option>
                                    <option value="Remotive">Remotive</option>
                                    <option value="JobsCollider">JobsCollider</option>
                                    <option value="RealWorkFromAnywhere">RealWorkFromAnywhere</option>
                                    <option value="Himalayas">Himalayas</option>
                                    <option value="NoDesk">NoDesk</option>
                                </select>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 批量操作 */}
            {selectedJobs.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-indigo-700">
                            已选择 {selectedJobs.length} 个岗位
                        </p>
                        <div className="flex space-x-2">
                            <button
                                onClick={handleBatchDelete}
                                className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                            >
                                <Trash2 className="w-3 h-3 mr-1" />
                                批量删除
                            </button>
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        handleBatchUpdateCategory(e.target.value as JobCategory);
                                        e.target.value = '';
                                    }
                                }}
                                className="text-xs border border-slate-300 rounded px-2 py-1"
                            >
                                <option value="">批量分类</option>
                                <option value="软件开发">软件开发</option>
                                <option value="前端开发">前端开发</option>
                                <option value="后端开发">后端开发</option>
                                <option value="产品管理">产品管理</option>
                                <option value="设计">设计</option>
                                <option value="市场营销">市场营销</option>
                                <option value="其他">其他</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* 岗位列表 */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <input
                                        type="checkbox"
                                        checked={selectedJobs.length === currentJobs.length && currentJobs.length > 0}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelectedJobs(currentJobs.map(job => job.id));
                                            } else {
                                                setSelectedJobs([]);
                                            }
                                        }}
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => handleSort('title')}
                                        className="flex items-center space-x-1 hover:text-slate-700"
                                    >
                                        <span>岗位信息</span>
                                        {sortBy === 'title' && (
                                            sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative">
                                    <div className="flex items-center space-x-1">
                                        <button
                                            onClick={() => setShowCategoryFilter(!showCategoryFilter)}
                                            className="flex items-center space-x-1 hover:text-slate-700"
                                        >
                                            <span>分类</span>
                                            <Filter className="w-3 h-3" />
                                        </button>
                                    </div>
                                    {showCategoryFilter && (
                                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-md shadow-lg z-10">
                                            <div className="py-1">
                                                <button
                                                    onClick={() => handleCategoryFilter('all')}
                                                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 ${!filter.category ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                                                        }`}
                                                >
                                                    全部分类
                                                </button>
                                                {getUniqueCategories().map(category => (
                                                    <button
                                                        key={category}
                                                        onClick={() => handleCategoryFilter(category)}
                                                        className={`block w-full text-left px-4 py-2 text-sm hover:bg-slate-100 ${filter.category?.[0] === category ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700'
                                                            }`}
                                                    >
                                                        {category}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => handleSort('company')}
                                        className="flex items-center space-x-1 hover:text-slate-700"
                                    >
                                        <span>公司 & 地点</span>
                                        {sortBy === 'company' && (
                                            sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    <button
                                        onClick={() => handleSort('publishedAt')}
                                        className="flex items-center space-x-1 hover:text-slate-700"
                                    >
                                        <span>发布时间</span>
                                        {sortBy === 'publishedAt' && (
                                            sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                                        )}
                                    </button>
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    状态
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        加载中...
                                    </td>
                                </tr>
                            ) : currentJobs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                                        没有找到匹配的岗位
                                    </td>
                                </tr>
                            ) : (
                                currentJobs.map((job, index) => (
                                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <input
                                                type="checkbox"
                                                checked={selectedJobs.includes(job.id)}
                                                onChange={() => {
                                                    setSelectedJobs(prev =>
                                                        prev.includes(job.id)
                                                            ? prev.filter(id => id !== job.id)
                                                            : [...prev, job.id]
                                                    );
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium text-slate-900 line-clamp-1" title={job.title}>
                                                    {job.title}
                                                </span>
                                                <span className="text-xs text-slate-500 line-clamp-1">{job.jobType}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 hover:text-indigo-700">
                                                        原始链接
                                                    </a>
                                                    <button
                                                        onClick={() => handleToggleFeatured(job.id, !job.isFeatured)}
                                                        className={`text-xs flex items-center gap-1 ${job.isFeatured ? 'text-yellow-600 font-medium' : 'text-slate-400 hover:text-yellow-600'}`}
                                                    >
                                                        <Star className={`w-3 h-3 ${job.isFeatured ? 'fill-current' : ''}`} />
                                                        {job.isFeatured ? '已精选' : '设为精选'}
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-xs rounded-full bg-slate-100 text-slate-800">
                                                {job.category || '未分类'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col text-sm text-slate-900">
                                                <span className="font-medium">{job.company}</span>
                                                <span className="text-slate-500 text-xs">{job.location}</span>
                                                {job.remoteLocationRestriction && (
                                                    <span className="text-slate-400 text-xs mt-0.5 line-clamp-1" title={job.remoteLocationRestriction}>
                                                        {job.remoteLocationRestriction.substring(0, 15)}{job.remoteLocationRestriction.length > 15 ? '...' : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {formatDate(job.publishedAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <select
                                                value={job.status}
                                                onChange={(e) => handleJobStatusUpdate(job.id, e.target.value as Job['status'])}
                                                className={`text-xs rounded-full px-2 py-1 border-0 focus:ring-2 focus:ring-indigo-500 ${getStatusColor(job.status)}`}
                                            >
                                                <option value="active">活跃</option>
                                                <option value="inactive">非活跃</option>
                                                <option value="archived">已删除</option>
                                            </select>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleViewJobDetail(job, index)}
                                                className="text-indigo-600 hover:text-indigo-900 mr-3"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleJobDelete(job.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && currentJobs.length > 0 && (
                    <div className="bg-white px-4 py-3 border-t border-slate-200 sm:px-6">
                        <div className="flex items-center justify-between">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    上一页
                                </button>
                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
                                >
                                    下一页
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-slate-700">
                                        显示第 <span className="font-medium">{startIndex + 1}</span> 到 <span className="font-medium">{Math.min(endIndex, sortedJobs.length)}</span> 条，
                                        共 <span className="font-medium">{sortedJobs.length}</span> 条
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                        <button
                                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                            disabled={currentPage === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            上一页
                                        </button>
                                        {totalPages > 0 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            // Simple pagination logic for display (showing first 5 pages or dynamic range)
                                            // For simplicity matching original: just first 5 or logic?
                                            // The original code had logic to show pages.
                                            // Let's implement a simple version or copy logic?
                                            // Original: Array.from({ length: Math.min(5, totalPages) }, (_, i) => ...
                                            // It didn't perform complex shifting.
                                            const page = i + 1;
                                            // If we want it to shift:
                                            let renderPage = page;
                                            if (totalPages > 5 && currentPage > 3) {
                                                renderPage = currentPage - 2 + i;
                                                if (renderPage > totalPages) renderPage = renderPage - (renderPage - totalPages);
                                            }

                                            // Just sticking to simple for now as per original if it was simple.
                                            // Actually the original logic was: Array.from({ length: Math.min(5, totalPages) ...
                                            // This implies it only ever showed 1-5? No, that's bad UI if total > 5.
                                            // I will improve it slightly to show pages around current.

                                            const maxButtons = 5;
                                            let startPage = Math.max(1, currentPage - 2);
                                            let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                                            if (endPage - startPage < maxButtons - 1) {
                                                startPage = Math.max(1, endPage - maxButtons + 1);
                                            }

                                            const items = [];
                                            for (let p = startPage; p <= endPage; p++) items.push(p);

                                            return items.map(p => (
                                                <button
                                                    key={p}
                                                    onClick={() => setCurrentPage(p)}
                                                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === p
                                                        ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                                        : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            ));
                                        })}
                                        <button
                                            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                            disabled={currentPage === totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                                        >
                                            下一页
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Job Detail Modal */}
            {showJobDetail && selectedJob && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header with Navigation */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleNavigateJob('prev')}
                                    disabled={currentJobIndex === 0}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="上一个岗位"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <span className="text-sm text-slate-600">
                                    {currentJobIndex + 1} / {currentJobs.length}
                                </span>
                                <button
                                    onClick={() => handleNavigateJob('next')}
                                    disabled={currentJobIndex === currentJobs.length - 1}
                                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="下一个岗位"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => handleToggleFeatured(selectedJob.id, !selectedJob.isFeatured)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${selectedJob.isFeatured
                                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                        }`}
                                >
                                    <Star className={`w-4 h-4 ${selectedJob.isFeatured ? 'fill-current' : ''}`} />
                                    {selectedJob.isFeatured ? '已精选' : '标记精选'}
                                </button>
                                <button
                                    onClick={handleCloseJobDetail}
                                    className="p-2 rounded-lg hover:bg-slate-100"
                                    title="关闭"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 mb-2">{selectedJob.title}</h2>
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <span className="font-medium">{selectedJob.company}</span>
                                        <span>•</span>
                                        <span>{selectedJob.location}</span>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {selectedJob.salary && (
                                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                            {selectedJob.salary}
                                        </span>
                                    )}
                                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                                        {selectedJob.jobType}
                                    </span>
                                    {selectedJob.isRemote && (
                                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                                            远程
                                        </span>
                                    )}
                                    <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
                                        {selectedJob.experienceLevel}
                                    </span>
                                    {selectedJob.remoteLocationRestriction && (
                                        <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                                            {selectedJob.remoteLocationRestriction}
                                        </span>
                                    )}
                                </div>

                                {selectedJob.description && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-3">岗位描述</h3>
                                        <div className="prose prose-sm max-w-none text-slate-700 whitespace-pre-wrap">
                                            {selectedJob.description}
                                        </div>
                                    </div>
                                )}

                                {selectedJob.requirements && selectedJob.requirements.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-3">任职要求</h3>
                                        <ul className="list-disc list-inside space-y-2 text-slate-700">
                                            {selectedJob.requirements.map((req, index) => (
                                                <li key={index}>{req}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {selectedJob.benefits && selectedJob.benefits.length > 0 && (
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-3">福利待遇</h3>
                                        <ul className="list-disc list-inside space-y-2 text-slate-700">
                                            {selectedJob.benefits.map((benefit, index) => (
                                                <li key={index}>{benefit}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="border-t pt-4">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-slate-500">来源:</span>
                                            <span className="ml-2 text-slate-900">{selectedJob.source}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">分类:</span>
                                            <span className="ml-2 text-slate-900">{selectedJob.category}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">发布时间:</span>
                                            <span className="ml-2 text-slate-900">{formatDate(selectedJob.publishedAt)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">状态:</span>
                                            <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getStatusColor(selectedJob.status)}`}>
                                                {selectedJob.status === 'active' ? '活跃' : selectedJob.status === 'inactive' ? '非活跃' : '已删除'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedJob.url && (
                                    <div className="border-t pt-4">
                                        <a
                                            href={selectedJob.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium"
                                        >
                                            查看原始岗位信息
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminJobManagement;
