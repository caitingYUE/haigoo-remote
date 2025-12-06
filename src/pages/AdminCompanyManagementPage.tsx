import { useState, useEffect, useCallback } from 'react';
import {
    Building2, Search, RefreshCw,
    ExternalLink, Globe, Tag, Briefcase, X, ChevronLeft, ChevronRight, Edit3
} from 'lucide-react';
import { CompanyService } from '../services/company-service';
import { ClassificationService } from '../services/classification-service';
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service';
import { Job } from '../types';

interface Company {
    id: string;
    name: string;
    url?: string;
    description?: string;
    logo?: string;
    industry?: string;
    tags?: string[];
    source: string;
    jobCount: number;
    createdAt: string;
    updatedAt: string;
    isTrusted?: boolean;
    order?: number;
}

export default function AdminCompanyManagementPage() {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [crawling, setCrawling] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize] = useState(20);
    const [searchQuery, setSearchQuery] = useState('');
    const [industryFilter, setIndustryFilter] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Company>>({});
    const [companyJobs, setCompanyJobs] = useState<Job[]>([]);
    const [jobSearchTerm, setJobSearchTerm] = useState('');

    const formatDate = (date?: string) => {
        if (!date) return '';
        const d = new Date(date);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    };

    const getHostname = (url?: string) => {
        if (!url) return '';
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    };

    const formatSalary = (salary?: Job['salary']) => {
        if (!salary) return '薪资面议';
        const { min, max, currency } = salary;
        if (min && max) return `${currency || ''}${min}-${max}`;
        if (min) return `${currency || ''}${min}+`;
        if (max) return `${currency || ''}${max}`;
        return '薪资面议';
    };

    const getJobLink = (job: Job) => {
        const legacyUrl = (job as any)?.url as string | undefined;
        return job.sourceUrl || legacyUrl || '';
    };

    const formatJobDate = (job: Job) => {
        if (!job.postedAt) return '';
        const d = new Date(job.postedAt);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
    };

    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                ...(searchQuery && { search: searchQuery }),
                ...(industryFilter && { industry: industryFilter })
            });

            const response = await fetch(`/api/data/trusted-companies?target=companies&${params}`);
            const data = await response.json();

            if (data.success) {
                let list: Company[] = data.companies || [];

                try {
                    const trustedList = await trustedCompaniesService.getAllCompanies();
                    const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[,._\-]/g, '');
                    const trustedMap = new Map<string, TrustedCompany>();
                    trustedList.forEach((tc: TrustedCompany) => trustedMap.set(normalize(tc.name), tc));

                    list = list.map((c: Company) => {
                        const tc = trustedMap.get(normalize(c.name));
                        if (!tc) return c;
                        return {
                            ...c,
                            url: c.url || tc.website || tc.careersPage || c.url,
                            logo: c.logo || tc.logo || c.logo,
                            description: c.description || tc.description || c.description,
                            tags: Array.from(new Set([...(c.tags || []), ...(tc.tags || [])]))
                        };
                    });
                } catch (e) {
                    console.warn('合并可信企业信息失败:', e);
                }

                setCompanies(list);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('Failed to load companies:', error);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, searchQuery, industryFilter]);

    useEffect(() => {
        loadCompanies();
    }, [loadCompanies]);

    const handleSyncToJobs = async () => {
        if (!confirm('确定要将企业库中的数据（简介、行业、标签等）同步到职位数据库中吗？')) return;

        try {
            setSyncing(true);
            const result = await trustedCompaniesService.syncJobsToProduction();

            if (result.success) {
                alert(`同步成功: 已更新 ${result.count} 个岗位的企业信息`);
            } else {
                alert(`同步失败: ${result.error || '未知错误'}`);
            }
        } catch (error) {
            alert(`同步失败: ${error instanceof Error ? error.message : '未知错误'}`);
        } finally {
            setSyncing(false);
        }
    };

    const syncJobData = async () => {
        try {
            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) return;

            console.log('Syncing company data to jobs...');

            const response = await fetch('/api/data/trusted-companies?action=sync-jobs', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();
            if (data.success) {
                console.log(`Synced jobs: ${data.message}`);
            }
        } catch (error) {
            console.error('Failed to sync job data:', error);
        }
    };

    const handleRefresh = async () => {
        if (!confirm('确定要重新从岗位数据中提取企业信息吗？\n\n这将更新企业的岗位数、来源等统计信息。')) {
            return;
        }

        try {
            setExtracting(true);
            const response = await fetch('/api/data/trusted-companies?target=companies&action=extract');
            const data = await response.json();

            if (data.success) {
                alert(`刷新成功！共提取 ${data.companies?.length || 0} 个企业`);
                await loadCompanies();
                syncJobData();
            } else {
                alert('刷新失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Failed to refresh companies:', error);
            alert('刷新失败，请稍后重试');
        } finally {
            setExtracting(false);
        }
    };

    const handleUpdateInfo = async (company: Company) => {
        if (!company.url) {
            throw new Error('该企业没有官网链接，无法更新信息');
        }

        try {
            setUpdatingMap((prev: Record<string, boolean>) => ({ ...prev, [company.id]: true }));
            const info = await CompanyService.fetchCompanyInfo(company.url);
            const classification = ClassificationService.classifyCompany(
                company.name,
                info.description || company.description || ''
            );

            const updatedCompany = {
                ...company,
                description: info.description || company.description,
                logo: info.logo || company.logo,
                industry: classification.industry !== '其他' ? classification.industry : company.industry,
                tags: Array.from(new Set([...(company.tags || []), ...classification.tags]))
            };

            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) throw new Error('未登录');

            const response = await fetch('/api/data/trusted-companies?target=companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedCompany)
            });

            if (response.ok) {
                setCompanies((prev: Company[]) => prev.map((c: Company) => c.id === company.id ? { ...c, ...updatedCompany } : c));
                if (selectedCompany && selectedCompany.id === company.id) {
                    setSelectedCompany(prev => prev ? { ...prev, ...updatedCompany } : null);
                }
            }
        } catch (error) {
            console.error(`Failed to update ${company.name}:`, error);
            throw error;
        } finally {
            setUpdatingMap((prev: Record<string, boolean>) => ({ ...prev, [company.id]: false }));
        }
    };

    const handleAutoCrawl = async () => {
        const companiesToCrawl = companies.filter(c => c.url && (!c.description || !c.logo));

        if (companiesToCrawl.length === 0) {
            alert('所有企业信息已完整！');
            return;
        }

        if (!confirm(`发现 ${companiesToCrawl.length} 个企业需要补充信息。\n\n是否立即开始自动抓取？`)) {
            return;
        }

        try {
            setCrawling(true);
            let successCount = 0;
            let failureCount = 0;
            const failures: string[] = [];

            for (let i = 0; i < companiesToCrawl.length; i++) {
                const company = companiesToCrawl[i];
                try {
                    await handleUpdateInfo(company);
                    successCount++;
                } catch (e) {
                    failureCount++;
                    failures.push(company.name);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            alert(`自动抓取完成！\n成功: ${successCount}\n失败: ${failureCount}`);
            await loadCompanies();
            syncJobData();
        } catch (error) {
            console.error('Auto crawl error:', error);
            alert('自动抓取失败');
        } finally {
            setCrawling(false);
        }
    };

    const handleAnalyzeIndustryAndTags = async () => {
        const companiesToAnalyze = companies.filter(c => c.description);
        if (companiesToAnalyze.length === 0) {
            alert('没有企业有简介信息，无法进行分析！');
            return;
        }

        if (!confirm(`将对 ${companiesToAnalyze.length} 个企业进行行业和标签分析。\n\n是否继续？`)) return;

        try {
            setAnalyzing(true);
            let successCount = 0;
            for (const company of companiesToAnalyze) {
                try {
                    const classification = ClassificationService.classifyCompany(company.name, company.description || '');
                    const token = localStorage.getItem('haigoo_auth_token');
                    if (!token) throw new Error('未登录');

                    const updatedCompany = {
                        ...company,
                        industry: classification.industry !== '其他' ? classification.industry : company.industry,
                        tags: Array.from(new Set([...(company.tags || []), ...classification.tags]))
                    };

                    const response = await fetch('/api/data/trusted-companies?target=companies', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify(updatedCompany)
                    });

                    if (response.ok) successCount++;
                } catch (e) {
                    console.error(`Failed to analyze ${company.name}`, e);
                }
            }
            alert(`分析完成！\n成功分析 ${successCount} 个企业`);
            await loadCompanies();
            syncJobData();
        } catch (error) {
            console.error('Analysis error:', error);
            alert('分析失败');
        } finally {
            setAnalyzing(false);
        }
    };

    const handleViewDetail = async (company: Company) => {
        setSelectedCompany(company);
        setIsEditing(false);
        setEditForm({});
        try {
            const response = await fetch(`/api/data/processed-jobs?company=${encodeURIComponent(company.name)}&limit=200`);
            const data = await response.json();
            setCompanyJobs(data.jobs || []);
        } catch (error) {
            console.error('Failed to load company jobs:', error);
            setCompanyJobs([]);
        }
    };

    const handleSaveCompany = async () => {
        if (!selectedCompany) return;

        try {
            const updatedCompany = {
                ...selectedCompany,
                ...editForm,
                tags: typeof editForm.tags === 'string' ? (editForm.tags as string).split(',').map(t => t.trim()).filter(Boolean) : (editForm.tags || selectedCompany.tags)
            };

            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) throw new Error('Not logged in');

            const response = await fetch('/api/data/trusted-companies?target=companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedCompany)
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setCompanies((prev: Company[]) => prev.map((c: Company) => c.id === updatedCompany.id ? updatedCompany : c));
                setSelectedCompany(updatedCompany);
                setIsEditing(false);
                alert('保存成功！');
            } else {
                alert('保存失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Failed to save company:', error);
            alert('保存失败');
        }
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Building2 className="w-6 h-6" />
                    企业库管理
                </h1>
                <div className="flex gap-2">
                    <button onClick={handleRefresh} disabled={extracting} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${extracting ? 'animate-spin' : ''}`} />
                        {extracting ? '提取中...' : '刷新数据'}
                    </button>
                    <button onClick={handleSyncToJobs} disabled={syncing} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? '同步中...' : '同步到岗位'}
                    </button>
                    <button onClick={handleAutoCrawl} disabled={crawling} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                        {crawling ? '抓取中...' : '自动补全信息'}
                    </button>
                    <button onClick={handleAnalyzeIndustryAndTags} disabled={analyzing} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                        {analyzing ? '分析中...' : 'AI分析标签'}
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4 items-center">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="搜索企业..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={industryFilter}
                    onChange={(e) => setIndustryFilter(e.target.value)}
                    className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 min-w-[150px]"
                >
                    <option value="">所有行业</option>
                    <option value="互联网">互联网</option>
                    <option value="金融">金融</option>
                    <option value="医疗健康">医疗健康</option>
                    <option value="教育">教育</option>
                    <option value="制造业">制造业</option>
                    <option value="其他">其他</option>
                </select>
                <div className="text-sm text-gray-500 ml-auto">
                    共 {total} 家企业
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center text-gray-500">加载中...</div>
                ) : companies.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">暂无企业数据</div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {companies.map((company: Company) => (
                            <div key={company.id} className="p-4 lg:p-5 hover:bg-gray-50 transition-colors">
                                <div className="flex items-start gap-4">
                                    {company.logo ? (
                                        <img src={company.logo} alt={company.name} className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-gray-100" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold border border-indigo-50">
                                            {company.name.substring(0, 1)}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 space-y-2">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="text-lg font-semibold text-gray-900 truncate">{company.name}</div>
                                            {company.industry && (
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">{company.industry}</span>
                                            )}
                                            {company.isTrusted && (
                                                <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded-full flex items-center gap-1">
                                                    <Briefcase className="w-3 h-3" /> 可信企业
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                                            {company.url && (
                                                <a href={company.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600">
                                                    {getHostname(company.url)} <ExternalLink className="w-3 h-3" />
                                                </a>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <Tag className="w-3 h-3" />
                                                {company.source || '未知来源'}
                                            </span>
                                            {company.updatedAt && (
                                                <span className="flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" />
                                                    更新于 {formatDate(company.updatedAt)}
                                                </span>
                                            )}
                                        </div>
                                        {company.description && (
                                            <p className="text-sm text-gray-600 line-clamp-2">{company.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2">
                                            {company.tags && company.tags.length > 0 ? (
                                                company.tags.slice(0, 6).map((tag, i) => (
                                                    <span key={i} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">{tag}</span>
                                                ))
                                            ) : (
                                                <span className="text-xs text-gray-400">暂无标签</span>
                                            )}
                                            {company.tags && company.tags.length > 6 && (
                                                <span className="text-xs text-gray-400">+{company.tags.length - 6}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <span className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                                            {company.jobCount} 岗位
                                        </span>
                                        <button
                                            onClick={() => handleViewDetail(company)}
                                            className="px-3 py-1.5 text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded-lg text-sm font-medium transition-colors"
                                        >
                                            管理详情
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500 bg-gray-50">
                    <div className="flex items-center gap-2">
                        <span>每页 {pageSize} 条</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button disabled={page === 1} onClick={() => setPage((p: number) => p - 1)} className="disabled:opacity-50 hover:bg-gray-200 p-1 rounded"><ChevronLeft className="w-5 h-5" /></button>
                        <span>第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
                        <button disabled={page * pageSize >= total} onClick={() => setPage((p: number) => p + 1)} className="disabled:opacity-50 hover:bg-gray-200 p-1 rounded"><ChevronRight className="w-5 h-5" /></button>
                    </div>
                </div>
            </div>

            {selectedCompany && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setSelectedCompany(null)}>
                    <div className="bg-white w-full max-w-5xl max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-start bg-gray-50">
                            <div className="flex-1">
                                <div className="flex items-center gap-4 mb-2">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.name || selectedCompany.name}
                                            onChange={e => setEditForm((prev: any) => ({ ...prev, name: e.target.value }))}
                                            className="text-xl font-bold text-slate-900 border-b border-slate-300 focus:border-indigo-500 outline-none w-full bg-transparent"
                                            placeholder="企业名称"
                                        />
                                    ) : (
                                        <h2 className="text-xl font-bold text-slate-900">{selectedCompany.name}</h2>
                                    )}
                                    {selectedCompany.isTrusted && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full flex items-center gap-1">
                                            <Briefcase className="w-3 h-3" /> 可信企业
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-slate-500">
                                    {isEditing ? (
                                        <input
                                            type="text"
                                            value={editForm.url || selectedCompany.url || ''}
                                            onChange={e => setEditForm((prev: any) => ({ ...prev, url: e.target.value }))}
                                            className="flex-1 border-b border-slate-300 focus:border-indigo-500 outline-none bg-transparent"
                                            placeholder="官网链接"
                                        />
                                    ) : (
                                        <a href={selectedCompany.url} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            {selectedCompany.url || '无官网链接'}
                                        </a>
                                    )}
                                    <span className="flex items-center gap-1">
                                        <Tag className="w-3 h-3" />
                                        {selectedCompany.source}
                                    </span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {isEditing ? (
                                    <>
                                        <button
                                            onClick={() => setIsEditing(false)}
                                            className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded"
                                        >
                                            取消
                                        </button>
                                        <button
                                            onClick={handleSaveCompany}
                                            className="px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                        >
                                            保存
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleUpdateInfo(selectedCompany)}
                                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                                            title="自动更新信息"
                                            disabled={updatingMap[selectedCompany.id]}
                                        >
                                            <RefreshCw className={`w-5 h-5 ${updatingMap[selectedCompany.id] ? 'animate-spin' : ''}`} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setEditForm({});
                                                setIsEditing(true);
                                            }}
                                            className="p-2 text-slate-400 hover:text-indigo-600 rounded-full hover:bg-indigo-50"
                                            title="编辑"
                                        >
                                            <Edit3 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => setSelectedCompany(null)}
                                            className="p-2 text-slate-400 hover:text-red-600 rounded-full hover:bg-red-50"
                                        >
                                            <X className="w-6 h-6" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="col-span-1 space-y-6">
                                    <div className="bg-gray-50 p-4 rounded-lg">
                                        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                                            <Building2 className="w-4 h-4" />
                                            企业信息
                                        </h3>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Logo</label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.logo || selectedCompany.logo || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, logo: e.target.value }))}
                                                        className="w-full text-sm border rounded p-1.5"
                                                        placeholder="Logo URL"
                                                    />
                                                ) : (
                                                    selectedCompany.logo && (
                                                        <img src={selectedCompany.logo} alt="Logo" className="w-16 h-16 object-contain bg-white rounded border" />
                                                    )
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">行业</label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.industry || selectedCompany.industry || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, industry: e.target.value }))}
                                                        className="w-full text-sm border rounded p-1.5"
                                                    />
                                                ) : (
                                                    <div className="text-sm text-gray-900">{selectedCompany.industry || '-'}</div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">简介</label>
                                                {isEditing ? (
                                                    <textarea
                                                        value={editForm.description || selectedCompany.description || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, description: e.target.value }))}
                                                        className="w-full text-sm border rounded p-1.5 h-32"
                                                    />
                                                ) : (
                                                    <div className="text-sm text-gray-600 leading-relaxed max-h-48 overflow-y-auto">
                                                        {selectedCompany.description || '暂无简介'}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">标签</label>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.tags || selectedCompany.tags?.join(', ') || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, tags: e.target.value }))}
                                                        className="w-full text-sm border rounded p-1.5"
                                                        placeholder="用逗号分隔"
                                                    />
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedCompany.tags?.map((tag, i) => (
                                                            <span key={i} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">{tag}</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="col-span-2">
                                    <h3 className="font-medium text-gray-900 mb-4 flex items-center justify-between">
                                        <span>关联岗位 ({companyJobs.length})</span>
                                        <div className="relative w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3 h-3" />
                                            <input
                                                type="text"
                                                placeholder="搜索岗位..."
                                                value={jobSearchTerm}
                                                onChange={(e) => setJobSearchTerm(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-full focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </h3>
                                    <div className="space-y-3">
                                        {companyJobs.length === 0 ? (
                                            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-lg">暂无关联岗位</div>
                                        ) : (
                                            companyJobs
                                                .filter(job => !jobSearchTerm || job.title.toLowerCase().includes(jobSearchTerm.toLowerCase()))
                                                .map(job => (
                                                    <div key={job.id} className="p-3 border rounded hover:bg-gray-50 transition-colors group">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                {getJobLink(job) ? (
                                                                    <a href={getJobLink(job)} target="_blank" rel="noopener noreferrer" className="font-medium text-gray-900 hover:text-indigo-600 flex items-center gap-1">
                                                                        {job.title}
                                                                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </a>
                                                                ) : (
                                                                    <span className="font-medium text-gray-900">{job.title}</span>
                                                                )}
                                                                <div className="text-xs text-gray-500 mt-1 flex gap-2">
                                                                    <span>{job.location}</span>
                                                                    <span>•</span>
                                                                    <span>{formatSalary(job.salary)}</span>
                                                                    {formatJobDate(job) && (
                                                                        <>
                                                                            <span>•</span>
                                                                            <span>{formatJobDate(job)}</span>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            {job.isFeatured && (
                                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">精选</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
