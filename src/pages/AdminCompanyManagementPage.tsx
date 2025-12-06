import { useState, useEffect, useCallback } from 'react';
import {
    Building2, Search, RefreshCw,
    ExternalLink, Globe, Tag, Briefcase, Eye, X, ChevronLeft, ChevronRight
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

            <div className="mb-6 text-gray-500 text-sm">
                共 {total} 家企业
            </div>

            <div className="flex gap-6 h-[calc(100vh-200px)]">
                    <div className="w-1/3 flex flex-col bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b space-y-4">
                            <div className="relative">
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
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">所有行业</option>
                                <option value="互联网">互联网</option>
                                <option value="金融">金融</option>
                                <option value="医疗健康">医疗健康</option>
                                <option value="教育">教育</option>
                                <option value="制造业">制造业</option>
                                <option value="其他">其他</option>
                            </select>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {loading ? (
                                <div className="p-8 text-center text-gray-500">加载中...</div>
                            ) : (
                                companies.map((company: Company) => (
                                    <div
                                        key={company.id}
                                        onClick={() => handleViewDetail(company)}
                                        className={`p-3 rounded-lg cursor-pointer border transition-colors ${selectedCompany?.id === company.id ? 'bg-indigo-50 border-indigo-500' : 'hover:bg-gray-50 border-transparent'}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <h3 className="font-medium text-gray-900">{company.name}</h3>
                                            <span className="text-xs text-gray-500">{company.jobCount} 岗位</span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {company.industry && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{company.industry}</span>}
                                            {company.source && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-xs rounded">{company.source}</span>}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-4 border-t flex justify-between items-center text-sm text-gray-500">
                            <button disabled={page === 1} onClick={() => setPage((p: number) => p - 1)} className="disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
                            <span>第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
                            <button disabled={page * pageSize >= total} onClick={() => setPage((p: number) => p + 1)} className="disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col">
                        {selectedCompany ? (
                            <>
                                <div className="p-6 border-b flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-4 mb-2">
                                            {isEditing ? (
                                                <input
                                                    type="text"
                                                    value={editForm.name || selectedCompany.name}
                                                    onChange={e => setEditForm((prev: any) => ({ ...prev, name: e.target.value }))}
                                                    className="text-xl font-bold text-slate-900 border-b border-slate-300 focus:border-indigo-500 outline-none w-full"
                                                    placeholder="企业名称"
                                                />
                                            ) : (
                                                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                                    {selectedCompany.name}
                                                    {selectedCompany.url && (
                                                        <a href={selectedCompany.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-indigo-600">
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                </h2>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Globe className="w-4 h-4" />
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editForm.url || selectedCompany.url || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, url: e.target.value }))}
                                                        className="border-b border-slate-300 focus:border-indigo-500 outline-none flex-1"
                                                        placeholder="官网链接"
                                                    />
                                                ) : (
                                                    <a href={selectedCompany.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                                        {selectedCompany.url || '暂无官网'}
                                                    </a>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <Building2 className="w-4 h-4" />
                                                {isEditing ? (
                                                    <select
                                                        value={editForm.industry || selectedCompany.industry || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, industry: e.target.value }))}
                                                        className="border-b border-slate-300 focus:border-indigo-500 outline-none flex-1"
                                                    >
                                                        <option value="">选择行业</option>
                                                        <option value="互联网">互联网</option>
                                                        <option value="金融">金融</option>
                                                        <option value="医疗健康">医疗健康</option>
                                                        <option value="教育">教育</option>
                                                        <option value="制造业">制造业</option>
                                                        <option value="其他">其他</option>
                                                    </select>
                                                ) : (
                                                    <span>{selectedCompany.industry || '未知行业'}</span>
                                                )}
                                            </div>

                                            <div className="flex items-start gap-2 text-sm text-gray-600">
                                                <Briefcase className="w-4 h-4 mt-0.5" />
                                                {isEditing ? (
                                                    <textarea
                                                        value={editForm.description || selectedCompany.description || ''}
                                                        onChange={e => setEditForm((prev: any) => ({ ...prev, description: e.target.value }))}
                                                        className="border border-slate-300 rounded p-2 focus:border-indigo-500 outline-none flex-1 h-24"
                                                        placeholder="企业简介"
                                                    />
                                                ) : (
                                                    <p className="flex-1 line-clamp-3">{selectedCompany.description || '暂无简介'}</p>
                                                )}
                                            </div>

                                            <div className="flex items-start gap-2 text-sm text-gray-600">
                                                <Tag className="w-4 h-4 mt-1" />
                                                <div className="flex-1 flex flex-wrap gap-2">
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={typeof editForm.tags === 'string' ? editForm.tags : (editForm.tags || selectedCompany.tags || []).join(', ')}
                                                            onChange={e => setEditForm((prev: any) => ({ ...prev, tags: e.target.value }))}
                                                            className="border-b border-slate-300 focus:border-indigo-500 outline-none w-full"
                                                            placeholder="标签 (用逗号分隔)"
                                                        />
                                                    ) : (
                                                        selectedCompany.tags?.map((tag: string) => (
                                                            <span key={tag} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-xs">
                                                                {tag}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 ml-4">
                                        {!isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        setEditForm({});
                                                        setIsEditing(true);
                                                    }}
                                                    className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                                                >
                                                    编辑企业
                                                </button>
                                                <button
                                                    onClick={() => handleUpdateInfo(selectedCompany)}
                                                    disabled={updatingMap[selectedCompany.id]}
                                                    className="px-3 py-1.5 text-sm border border-indigo-600 text-indigo-600 rounded hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <RefreshCw className={`w-3 h-3 ${updatingMap[selectedCompany.id] ? 'animate-spin' : ''}`} />
                                                    {updatingMap[selectedCompany.id] ? '更新中' : '更新信息'}
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={handleSaveCompany}
                                                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                                >
                                                    保存
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsEditing(false);
                                                        setEditForm({});
                                                    }}
                                                    className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50 transition-colors"
                                                >
                                                    取消
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col">
                                    <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                                        <h3 className="font-bold text-gray-700">相关招聘岗位 ({companyJobs.length})</h3>
                                        <div className="relative w-64">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                            <input
                                                type="text"
                                                placeholder="搜索岗位..."
                                                value={jobSearchTerm}
                                                onChange={(e) => setJobSearchTerm(e.target.value)}
                                                className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-full focus:ring-2 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4">
                                        <div className="space-y-2">
                                            {companyJobs.map((job: Job) => (
                                                <div key={job.id} className="p-3 bg-white border rounded hover:shadow-sm flex justify-between items-center">
                                                    <div>
                                                        <div className="font-medium text-indigo-600">{job.title}</div>
                                                        <div className="text-sm text-gray-500 mt-1 flex gap-3">
                                                            <span>{job.location}</span>
                                                            {job.salary && (
                                                                <span>{job.salary.min}-{job.salary.max} {job.salary.currency}</span>
                                                            )}
                                                            <span>{new Date(job.postedAt).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                    {job.sourceUrl && (
                                                        <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-indigo-600">
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                            {companyJobs.length === 0 && (
                                                <div className="text-center py-8 text-gray-500">
                                                    暂无相关岗位数据
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                                <Building2 className="w-16 h-16 mb-4 opacity-20" />
                                <p>请选择左侧企业查看详情</p>
                            </div>
                        )}
                    </div>
                </div>
        </div>
    );
}
