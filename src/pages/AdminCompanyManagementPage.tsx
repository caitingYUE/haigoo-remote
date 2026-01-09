import { useState, useEffect, useCallback } from 'react';
import {
    Building2, Search, RefreshCw, Download, Upload,
    ExternalLink, Globe, Tag, Briefcase, Eye, X, ChevronLeft, ChevronRight,
    Edit2, Wand2, Loader2, Save
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
    // source: string; // Removed source field
    jobCount: number;
    createdAt: string;
    updatedAt: string;
    isTrusted?: boolean;
    order?: number;
    translations?: any;
    linkedin?: string;
    address?: string;
    employeeCount?: string;
    foundedYear?: string;
    specialties?: string[];
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
    
    // Selection & Modals
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isJobsModalOpen, setIsJobsModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<Partial<Company>>({});
    const [companyJobs, setCompanyJobs] = useState<Job[]>([]);
    const [jobSearchTerm, setJobSearchTerm] = useState('');
    
    // Tag Config State
    const [tagConfig, setTagConfig] = useState<{
        jobCategories: string[];
        companyIndustries: string[];
        companyTags: string[];
    }>({ jobCategories: [], companyIndustries: [], companyTags: [] });

    // Load tag configuration
    const loadTagConfig = async () => {
        try {
            const response = await fetch('/api/data/trusted-companies?target=tags');
            const data = await response.json();
            if (data.success && data.config) {
                setTagConfig(data.config);
            }
        } catch (error) {
            console.error('Failed to load tag config:', error);
        }
    };

    useEffect(() => {
        loadTagConfig();
    }, []);

    // Load companies ONLY from trusted_companies database table
    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const params = {
                page,
                limit: pageSize,
                search: searchQuery,
                industry: industryFilter
            };

            const data = await trustedCompaniesService.getAllCompanies(params);
            
            if (Array.isArray(data)) {
                // Handle array response (should match Company interface)
                const list = data.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    url: tc.website,
                    description: tc.description,
                    logo: tc.logo,
                    industry: tc.industry,
                    tags: tc.tags,
                    // source: 'database', // Removed source field
                    jobCount: tc.jobCount || 0,
                    createdAt: tc.createdAt,
                    updatedAt: tc.updatedAt,
                    isTrusted: tc.isTrusted,
                    translations: (tc as any).translations,
                    linkedin: tc.linkedin,
                    address: tc.address,
                    employeeCount: tc.employeeCount,
                    foundedYear: tc.foundedYear,
                    specialties: tc.specialties
                }));
                setCompanies(list as any);
                setTotal(data.length);
            } else {
                // Handle paginated response
                const list = data.companies.map(tc => ({
                    id: tc.id,
                    name: tc.name,
                    url: tc.website,
                    description: tc.description,
                    logo: tc.logo,
                    industry: tc.industry,
                    tags: tc.tags,
                    // source: 'database', // Removed source field
                    jobCount: tc.jobCount || 0,
                    createdAt: tc.createdAt,
                    updatedAt: tc.updatedAt,
                    isTrusted: tc.isTrusted,
                    translations: (tc as any).translations,
                    linkedin: tc.linkedin,
                    address: tc.address,
                    employeeCount: tc.employeeCount,
                    foundedYear: tc.foundedYear,
                    specialties: tc.specialties
                }));
                setCompanies(list as any);
                setTotal(data.total);
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

    const handleUpdateInfo = async (company: Company, options: { translate?: boolean } = {}) => {
        if (!company.url) {
            alert('该企业没有官网链接，无法更新信息');
            return;
        }

        try {
            setUpdatingMap((prev: Record<string, boolean>) => ({ ...prev, [company.id]: true }));
            const info = await CompanyService.fetchCompanyInfo(company.url, options);
            const classification = ClassificationService.classifyCompany(
                company.name,
                info.description || company.description || ''
            );

            const updatedCompany = {
                ...company,
                description: info.description || company.description,
                logo: info.logo || company.logo,
                industry: classification.industry !== '其他' ? classification.industry : company.industry,
                tags: Array.from(new Set([...(company.tags || []), ...classification.tags])),
                translations: info.translations || company.translations
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
                if (selectedCompany?.id === company.id) {
                    setSelectedCompany(updatedCompany);
                    setEditForm(updatedCompany);
                }
            }
        } catch (error) {
            console.error(`Failed to update ${company.name}:`, error);
            alert('更新失败，请检查网络或稍后重试');
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

        if (!confirm(`发现 ${companiesToCrawl.length} 个企业需要补充信息。\n\n是否立即开始自动抓取并翻译？`)) {
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
                    // Enable translation for auto crawl
                    await handleUpdateInfo(company, { translate: true });
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

    const handleViewJobs = async (company: Company) => {
        setSelectedCompany(company);
        setCompanyJobs([]); // Clear previous jobs
        setIsJobsModalOpen(true);
        try {
            const response = await fetch(`/api/data/processed-jobs?company=${encodeURIComponent(company.name)}&limit=200`);
            const data = await response.json();
            setCompanyJobs(data.jobs || []);
        } catch (error) {
            console.error('Failed to load company jobs:', error);
            setCompanyJobs([]);
        }
    };

    const handleEditClick = (company: Company) => {
        setSelectedCompany(company);
        setEditForm({ ...company });
        setIsEditModalOpen(true);
    };

    const handleFetchLinkedInInfo = async () => {
        if (!editForm.linkedin) {
            alert('请先输入LinkedIn链接');
            return;
        }

        try {
            // Use the same update info logic but point to LinkedIn URL
            // Since our crawler is generic, it might work if LinkedIn page is public
            // Or we can add specific logic here if we had a dedicated endpoint
            const response = await fetch(`/api/data/trusted-companies?action=crawl&url=${encodeURIComponent(editForm.linkedin)}&translate=true`);
            const data = await response.json();

            if (data.error) {
                alert('获取失败: ' + data.error);
                return;
            }

            setEditForm(prev => ({
                ...prev,
                description: data.description || prev.description,
                logo: data.logo || prev.logo,
                address: data.address || prev.address,
                // Note: Generic crawler might not get employee count/founded year/specialties
                // We leave them for manual entry or future enhancement
            }));
            
            alert('获取成功！请检查并补充信息。');
        } catch (error) {
            console.error('Fetch LinkedIn error:', error);
            alert('获取失败，请稍后重试');
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
                setIsEditModalOpen(false);
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
                        <Download className={`w-4 h-4 ${extracting ? 'animate-bounce' : ''}`} />
                        {extracting ? '提取中...' : '刷新数据'}
                    </button>
                    <button onClick={handleSyncToJobs} disabled={syncing} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                        <Upload className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
                        {syncing ? '同步中...' : '同步到岗位'}
                    </button>
                    <button onClick={handleAutoCrawl} disabled={crawling} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                        <Wand2 className={`w-4 h-4 ${crawling ? 'animate-spin' : ''}`} />
                        {crawling ? '抓取中...' : '自动补全并翻译'}
                    </button>
                    <button onClick={handleAnalyzeIndustryAndTags} disabled={analyzing} className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50">
                        {analyzing ? '分析中...' : 'AI分析标签'}
                    </button>
                </div>
            </div>

            <div className="mb-6 flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[260px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="搜索企业名称、行业..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setPage(1);
                        }}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                <select
                    value={industryFilter}
                    onChange={(e) => {
                        setIndustryFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                    <option value="">所有行业</option>
                    {tagConfig.companyIndustries.length > 0 ? (
                        tagConfig.companyIndustries.map(industry => (
                            <option key={industry} value={industry}>{industry}</option>
                        ))
                    ) : (
                        <>
                            <option value="互联网">互联网</option>
                            <option value="金融">金融</option>
                            <option value="医疗健康">医疗健康</option>
                            <option value="教育">教育</option>
                            <option value="制造业">制造业</option>
                            <option value="其他">其他</option>
                        </>
                    )}
                </select>
            </div>

            <div className="mb-4 text-gray-500 text-sm">
                共 {total} 家企业
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">行业/简介</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">标签</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">在招岗位</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">链接</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {companies.map(company => (
                                <tr key={company.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            {company.logo ? (
                                                <img src={company.logo} alt="" className="h-8 w-8 rounded object-contain mr-3" />
                                            ) : (
                                                <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center mr-3">
                                                    <Building2 className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="font-medium text-gray-900">{company.name}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {company.industry || '未分类'}
                                            </span>
                                            <div className="text-xs text-gray-500 truncate max-w-xs" title={company.description}>
                                                {company.description || '暂无简介'}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-wrap gap-1 max-w-xs">
                                            {company.tags?.slice(0, 3).map((tag: string) => (
                                                <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    {tag}
                                                </span>
                                            ))}
                                            {(company.tags?.length || 0) > 3 && (
                                                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                                    +{company.tags!.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                        <div className="flex items-center gap-2">
                                            <span>{company.jobCount}</span>
                                            <button 
                                                onClick={() => handleViewJobs(company)}
                                                className="text-indigo-600 hover:text-indigo-800"
                                                title="查看岗位"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <div className="flex gap-2">
                                            {company.url && (
                                                <a href={company.url} target="_blank" rel="noreferrer" title="官网" className="text-gray-400 hover:text-indigo-600">
                                                    <Globe className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => handleUpdateInfo(company)}
                                                disabled={updatingMap[company.id]}
                                                className="text-gray-600 hover:text-green-600 disabled:opacity-50"
                                                title="更新信息"
                                            >
                                                <RefreshCw className={`w-4 h-4 ${updatingMap[company.id] ? 'animate-spin' : ''}`} />
                                            </button>
                                            <button 
                                                onClick={() => handleEditClick(company)} 
                                                className="text-gray-600 hover:text-indigo-600"
                                                title="编辑"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="p-4 flex justify-between items-center text-sm text-gray-500">
                <button disabled={page === 1} onClick={() => setPage((p: number) => p - 1)} className="disabled:opacity-50 flex items-center gap-1 hover:text-gray-900">
                    <ChevronLeft className="w-4 h-4" /> 上一页
                </button>
                <span>第 {page} 页 / 共 {Math.ceil(total / pageSize)} 页</span>
                <button disabled={page * pageSize >= total} onClick={() => setPage((p: number) => p + 1)} className="disabled:opacity-50 flex items-center gap-1 hover:text-gray-900">
                    下一页 <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedCompany && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold">编辑企业信息</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">企业名称</label>
                                <input
                                    type="text"
                                    value={editForm.name || ''}
                                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">行业</label>
                                    <select
                                        value={editForm.industry || ''}
                                        onChange={e => setEditForm({ ...editForm, industry: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="">选择行业</option>
                                        {tagConfig.companyIndustries.length > 0 ? (
                                            tagConfig.companyIndustries.map(industry => (
                                                <option key={industry} value={industry}>{industry}</option>
                                            ))
                                        ) : (
                                            <>
                                                <option value="互联网">互联网</option>
                                                <option value="金融">金融</option>
                                                <option value="医疗健康">医疗健康</option>
                                                <option value="教育">教育</option>
                                                <option value="制造业">制造业</option>
                                                <option value="其他">其他</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">官网链接</label>
                                    <input
                                        type="url"
                                        value={editForm.url || ''}
                                        onChange={e => setEditForm({ ...editForm, url: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn 链接</label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={editForm.linkedin || ''}
                                        onChange={e => setEditForm({ ...editForm, linkedin: e.target.value })}
                                        className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="https://www.linkedin.com/company/..."
                                    />
                                    <button
                                        onClick={handleFetchLinkedInInfo}
                                        className="px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 whitespace-nowrap"
                                        title="尝试抓取公开信息"
                                    >
                                        <Wand2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">总部地址</label>
                                    <input
                                        type="text"
                                        value={editForm.address || ''}
                                        onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">员工人数</label>
                                    <input
                                        type="text"
                                        value={editForm.employeeCount || ''}
                                        onChange={e => setEditForm({ ...editForm, employeeCount: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 1000+"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">成立年份</label>
                                    <input
                                        type="text"
                                        value={editForm.foundedYear || ''}
                                        onChange={e => setEditForm({ ...editForm, foundedYear: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="e.g. 2010"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">领域/专长 (JSON数组或逗号分隔)</label>
                                <input
                                    type="text"
                                    value={Array.isArray(editForm.specialties) ? editForm.specialties.join(', ') : (editForm.specialties || '')}
                                    onChange={e => setEditForm({ ...editForm, specialties: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean) })}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. SaaS, AI, Cloud Computing"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="url"
                                        value={editForm.logo || ''}
                                        onChange={e => setEditForm({ ...editForm, logo: e.target.value })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {editForm.logo && <img src={editForm.logo} alt="Logo" className="w-10 h-10 object-contain border rounded" />}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">简介</label>
                                <textarea
                                    value={editForm.description || ''}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    rows={4}
                                    className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">标签 (逗号分隔)</label>
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={typeof editForm.tags === 'string' ? editForm.tags : (editForm.tags || []).join(', ')}
                                        onChange={e => setEditForm({ ...editForm, tags: e.target.value as any })}
                                        className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="例如: SaaS, AI, B2B"
                                    />
                                    {tagConfig.companyTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            <span className="text-xs text-gray-500 flex items-center">推荐标签:</span>
                                            {tagConfig.companyTags.map(tag => (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => {
                                                        const rawTags = editForm.tags as any;
                                                        let currentTags: string[] = [];
                                                        
                                                        if (Array.isArray(rawTags)) {
                                                            currentTags = rawTags;
                                                        } else if (typeof rawTags === 'string') {
                                                            currentTags = rawTags.split(',').map((t: string) => t.trim()).filter(Boolean);
                                                        }
                                                        
                                                        if (!currentTags.includes(tag)) {
                                                            const newTags = [...currentTags, tag].join(', ');
                                                            setEditForm({ ...editForm, tags: newTags as any });
                                                        }
                                                    }}
                                                    className="px-2 py-0.5 bg-gray-100 hover:bg-indigo-50 text-gray-600 hover:text-indigo-600 text-xs rounded transition-colors"
                                                >
                                                    + {tag}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
                            <button
                                onClick={() => setIsEditModalOpen(false)}
                                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-50"
                            >
                                取消
                            </button>
                            <button
                                onClick={handleSaveCompany}
                                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Jobs Modal */}
            {isJobsModalOpen && selectedCompany && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                {selectedCompany.name} - 在招岗位 ({companyJobs.length})
                            </h2>
                            <button onClick={() => setIsJobsModalOpen(false)} className="text-gray-500 hover:text-gray-700">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-4 border-b bg-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="搜索岗位..."
                                    value={jobSearchTerm}
                                    onChange={(e) => setJobSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-2">
                                {companyJobs
                                    .filter(job => !jobSearchTerm || job.title.toLowerCase().includes(jobSearchTerm.toLowerCase()))
                                    .map(job => (
                                        <div key={job.id} className="p-3 bg-white border rounded hover:shadow-sm flex justify-between items-center">
                                            <div>
                                                <div className="font-medium text-indigo-600">{job.title}</div>
                                                <div className="text-sm text-gray-500 mt-1 flex gap-3">
                                                    <span>{job.location}</span>
                                                    {job.salary && (
                                                        <span>
                                                            {typeof job.salary === 'string' 
                                                                ? job.salary 
                                                                : `${job.salary.min}-${job.salary.max} ${job.salary.currency}`}
                                                        </span>
                                                    )}
                                                    <span>{new Date(job.publishedAt).toLocaleDateString()}</span>
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
                                    <div className="text-center py-12 text-gray-500">
                                        暂无岗位数据
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
