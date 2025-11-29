import { useState, useEffect, useCallback } from 'react';
import {
    Building2, Search, RefreshCw,
    ExternalLink, Globe, Tag, Briefcase, Eye, X, ChevronLeft, ChevronRight
} from 'lucide-react';
import AdminTrustedCompaniesPage from './AdminTrustedCompaniesPage';
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
    const [activeTab, setActiveTab] = useState<'all' | 'trusted'>('all');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [crawling, setCrawling] = useState(false);
    const [analyzing, setAnalyzing] = useState(false);
    const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize, setPageSize] = useState(20);
    const [searchQuery, setSearchQuery] = useState('');
    const [industryFilter, setIndustryFilter] = useState('');
    const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
    const [companyJobs, setCompanyJobs] = useState<Job[]>([]);
    const [jobSearchTerm, setJobSearchTerm] = useState('');
    const [rowDensity, setRowDensity] = useState<'cozy' | 'compact'>('cozy');

    const loadCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                pageSize: pageSize.toString(),
                ...(searchQuery && { search: searchQuery }),
                ...(industryFilter && { industry: industryFilter })
            });

            const response = await fetch(`/api/data/trusted-companies?resource=companies&${params}`);
            const data = await response.json();

            if (data.success) {
                let list: Company[] = data.companies || [];

                try {
                    const trustedList = await trustedCompaniesService.getAllCompanies();
                    const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[,._\-]/g, '');
                    const trustedMap = new Map<string, TrustedCompany>();
                    trustedList.forEach(tc => trustedMap.set(normalize(tc.name), tc));

                    list = list.map(c => {
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
        if (activeTab === 'all') {
            loadCompanies();
        }
    }, [activeTab, loadCompanies]);


    const handleRefresh = async () => {
        if (!confirm('确定要重新从岗位数据中提取企业信息吗？\n\n这将更新企业的岗位数、来源等统计信息。')) {
            return;
        }

        try {
            setExtracting(true);
            const response = await fetch('/api/data/trusted-companies?resource=companies&action=extract');
            const data = await response.json();

            if (data.success) {
                alert(`刷新成功！共提取 ${data.companies?.length || 0} 个企业`);
                await loadCompanies();
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
                console.log(`Crawling ${i + 1}/${companiesToCrawl.length}: ${company.name}`);

                try {
                    await handleUpdateInfo(company);
                    successCount++;
                } catch (e) {
                    failureCount++;
                    failures.push(company.name);
                    console.error(`Failed to crawl ${company.name}`, e);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            let summary = `自动抓取完成！\n\n成功: ${successCount}\n失败: ${failureCount}`;
            if (failures.length > 0 && failures.length <= 5) {
                summary += `\n\n失败的企业:\n${failures.join('\n')}`;
            } else if (failures.length > 5) {
                summary += `\n\n失败的企业:\n${failures.slice(0, 5).join('\n')}\n...及其他 ${failures.length - 5} 个`;
            }
            alert(summary);
            await loadCompanies();
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
            alert('没有企业有简介信息，无法进行分析！\n\n请先执行"自动抓取企业信息"。');
            return;
        }

        if (!confirm(`将对 ${companiesToAnalyze.length} 个企业进行行业和标签分析。\n\n是否继续？`)) {
            return;
        }

        try {
            setAnalyzing(true);
            let successCount = 0;

            for (const company of companiesToAnalyze) {
                try {
                    const classification = ClassificationService.classifyCompany(
                        company.name,
                        company.description || ''
                    );

                    const token = localStorage.getItem('haigoo_auth_token');
                    if (!token) {
                        throw new Error('未登录');
                    }

                    const updatedCompany = {
                        ...company,
                        industry: classification.industry !== '其他' ? classification.industry : company.industry,
                        tags: Array.from(new Set([...(company.tags || []), ...classification.tags]))
                    };

                    const response = await fetch('/api/data/trusted-companies?resource=companies', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(updatedCompany)
                    });

                    if (response.ok) {
                        successCount++;
                    }
                } catch (e) {
                    console.error(`Failed to analyze ${company.name}`, e);
                }
            }

            alert(`分析完成！\n\n成功分析 ${successCount} 个企业`);
            await loadCompanies();
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
            const jobs: Job[] = data.jobs || [];
            setCompanyJobs(jobs);
        } catch (error) {
            console.error('Failed to load company jobs:', error);
            setCompanyJobs([]);
        }
    };

    const handleUpdateInfo = async (company: Company) => {
        if (!company.url) {
            console.log(`Skipping ${company.name} - no URL available`);
            throw new Error('该企业没有官网链接，无法更新信息');
        }

        try {
            setUpdatingMap(prev => ({ ...prev, [company.id]: true }));

            console.log(`[${company.name}] Step 1: Crawling company website...`);
            // 1. 抓取官网信息
            const info = await CompanyService.fetchCompanyInfo(company.url);

            if (!info.description && !info.logo) {
                console.warn(`[${company.name}] No info crawled from ${company.url}`);
                // Don't return here - still try to update with classification
            } else {
                console.log(`[${company.name}] Crawled: logo=${!!info.logo}, description=${!!info.description}`);
            }

            console.log(`[${company.name}] Step 2: Classifying industry and tags...`);
            // 2. 重新分类行业
            const classification = ClassificationService.classifyCompany(
                company.name,
                info.description || company.description || ''
            );
            console.log(`[${company.name}] Classification: industry=${classification.industry}, tags=[${classification.tags.join(', ')}]`);

            // 3. 更新企业信息
            const updatedCompany = {
                ...company,
                description: info.description || company.description,
                logo: info.logo || company.logo,
                industry: classification.industry !== '其他' ? classification.industry : company.industry,
                tags: Array.from(new Set([...(company.tags || []), ...classification.tags]))
            };

            console.log(`[${company.name}] Step 3: Saving to database...`);

            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) {
                throw new Error('未登录或登录已过期，请重新登录');
            }

            const response = await fetch('/api/data/trusted-companies?resource=companies', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedCompany)
            });

            const data = await response.json();
            if (data.success) {
                // 更新本地列表
                setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, ...updatedCompany } : c));
                console.log(`[${company.name}] ✓ Successfully updated!`);
            } else {
                console.error(`[${company.name}] Failed to save:`, data.error);
                throw new Error(data.error || '保存失败');
            }

        } catch (error) {
            console.error(`Failed to update company info for ${company.name}:`, error);
            throw error;
        } finally {
            setUpdatingMap(prev => ({ ...prev, [company.id]: false }));
        }
    };

    const renderPagination = () => {
        const totalPages = Math.ceil(total / pageSize);
        if (totalPages <= 1) return null;

        const maxPagesToShow = 7;
        let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
        const endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

        if (endPage - startPage + 1 < maxPagesToShow) {
            startPage = Math.max(1, endPage - maxPagesToShow + 1);
        }

        const pages = [];
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }

        return (
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="text-sm text-gray-500">
                        显示 {((page - 1) * pageSize) + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">每页</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                const size = parseInt(e.target.value, 10) || 20;
                                setPageSize(size);
                                setPage(1);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-sm text-gray-600">条</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        上一页
                    </button>

                    {startPage > 1 && (
                        <>
                            <button
                                onClick={() => setPage(1)}
                                className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 ${page === 1 ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                            >
                                1
                            </button>
                            {startPage > 2 && <span className="px-2 text-gray-400">...</span>}
                        </>
                    )}

                    {pages.map(p => (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className={`px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 ${page === p
                                ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
                                : 'border-gray-300 text-gray-700'
                                }`}
                        >
                            {p}
                        </button>
                    ))}

                    {endPage < totalPages && (
                        <>
                            {endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}
                            <button
                                onClick={() => setPage(totalPages)}
                                className={`px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 ${page === totalPages ? 'bg-blue-50 text-blue-600 border-blue-200' : ''}`}
                            >
                                {totalPages}
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => setPage(Math.min(totalPages, page + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                        下一页
                    </button>
                </div>
            </div>
        );
    };

    useEffect(() => {
        if (selectedCompany) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        const handleKey = (e: KeyboardEvent) => {
            if (!selectedCompany) return;
            if (e.key === 'ArrowLeft') {
                const idx = companies.findIndex(c => c.id === selectedCompany.id);
                if (idx > 0) setSelectedCompany(companies[idx - 1]);
            } else if (e.key === 'ArrowRight') {
                const idx = companies.findIndex(c => c.id === selectedCompany.id);
                if (idx >= 0 && idx < companies.length - 1) setSelectedCompany(companies[idx + 1]);
            }
        };
        document.addEventListener('keydown', handleKey);
        return () => {
            document.body.style.overflow = 'unset';
            document.removeEventListener('keydown', handleKey);
        };
    }, [selectedCompany, companies]);

    const renderCompanyDetailModal = () => {
        if (!selectedCompany) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-4">
                            {selectedCompany.logo ? (
                                <img src={selectedCompany.logo} alt={selectedCompany.name} className="w-12 h-12 rounded-lg object-contain bg-gray-50" />
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <Building2 className="w-6 h-6 text-gray-400" />
                                </div>
                            )}
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    {selectedCompany.url && (
                                        <a href={selectedCompany.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                                            <Globe className="w-3 h-3" />
                                            官网
                                        </a>
                                    )}
                                    <span className="text-sm text-gray-500">•</span>
                                    <span className="text-sm text-gray-500">{selectedCompany.industry || '未分类'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const idx = companies.findIndex(c => c.id === selectedCompany.id);
                                    if (idx > 0) setSelectedCompany(companies[idx - 1]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="上一条"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => {
                                    const idx = companies.findIndex(c => c.id === selectedCompany.id);
                                    if (idx >= 0 && idx < companies.length - 1) setSelectedCompany(companies[idx + 1]);
                                }}
                                className="text-gray-500 hover:text-gray-700"
                                aria-label="下一条"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                            <button onClick={() => setSelectedCompany(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-3">企业简介</h3>
                            <p className="text-gray-600 leading-relaxed">
                                {selectedCompany.description || '暂无简介'}
                            </p>
                            {selectedCompany.tags && selectedCompany.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {selectedCompany.tags.map(tag => (
                                        <span key={tag} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="border-t border-gray-100">
                            <div className="p-4 bg-gray-50 flex items-center gap-4">
                                <div className="flex-1 relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        placeholder="搜索职位..."
                                        value={jobSearchTerm}
                                        onChange={(e) => setJobSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2 rounded-lg border-gray-300 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div className="text-sm text-gray-500">共 {companyJobs.length} 个职位</div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">职位名称</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">地点</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">发布时间</th>
                                            <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">来源</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {companyJobs.filter(j => j.title.toLowerCase().includes(jobSearchTerm.toLowerCase())).length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">暂无职位数据</td>
                                            </tr>
                                        ) : (
                                            companyJobs
                                                .filter(j => j.title.toLowerCase().includes(jobSearchTerm.toLowerCase()))
                                                .map(job => (
                                                    <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                                                        <td className="px-6 py-4">
                                                            <div className="font-medium text-gray-900">{job.title}</div>
                                                            <div className="text-xs text-gray-500 mt-0.5">{job.type}</div>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-gray-600">{job.location}</td>
                                                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(job.postedAt).toLocaleDateString()}</td>
                                                        <td className="px-6 py-4 text-right">
                                                            {job.sourceUrl && (
                                                                <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 text-sm">查看原文</a>
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
            </div>
        );
    };

    const renderAllCompaniesTab = () => (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between sticky top-0 z-20 bg-gray-50/80 backdrop-blur supports-[backdrop-filter]:bg-gray-50/60 border-b py-2">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="搜索企业名称..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <select
                        value={industryFilter}
                        onChange={(e) => {
                            setIndustryFilter(e.target.value);
                            setPage(1);
                        }}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        <option value="">所有行业</option>
                        <option value="互联网/软件">互联网/软件</option>
                        <option value="人工智能">人工智能</option>
                        <option value="大健康/医疗">大健康/医疗</option>
                        <option value="教育">教育</option>
                        <option value="金融/Fintech">金融/Fintech</option>
                        <option value="电子商务">电子商务</option>
                        <option value="Web3/区块链">Web3/区块链</option>
                        <option value="游戏">游戏</option>
                        <option value="媒体/娱乐">媒体/娱乐</option>
                        <option value="企业服务/SaaS">企业服务/SaaS</option>
                        <option value="硬件/物联网">硬件/物联网</option>
                        <option value="消费生活">消费生活</option>
                        <option value="其他">其他</option>
                    </select>

                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setIndustryFilter('');
                            setPage(1);
                        }}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        清除筛选
                    </button>

                    <div className="flex items-center gap-2 ml-2">
                        <span className="text-sm text-gray-600">每页</span>
                        <select
                            value={pageSize}
                            onChange={(e) => {
                                const size = parseInt(e.target.value, 10) || 20;
                                setPageSize(size);
                                setPage(1);
                            }}
                            className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                        <span className="text-sm text-gray-600">条</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setRowDensity(prev => prev === 'compact' ? 'cozy' : 'compact')}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        title="切换行密度"
                    >
                        {rowDensity === 'compact' ? '紧凑行距' : '标准行距'}
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={extracting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        title="从岗位数据重新提取企业信息，更新统计数据"
                    >
                        <RefreshCw className={`w-4 h-4 ${extracting ? 'animate-spin' : ''}`} />
                        刷新
                    </button>

                    <button
                        onClick={handleAutoCrawl}
                        disabled={crawling}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                        title="批量爬取企业Logo和简介"
                    >
                        {crawling ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <RefreshCw className="w-4 h-4" />
                        )}
                        自动抓取企业信息
                    </button>

                    <button
                        onClick={handleAnalyzeIndustryAndTags}
                        disabled={analyzing}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                        title="基于简介分析行业和标签"
                    >
                        {analyzing ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                            <Tag className="w-4 h-4" />
                        )}
                        分析行业与标签
                    </button>
                </div>
            </div>

            {/* Company List */}
            <div className="bg-white rounded-xl border border-gray-200">
                <div className="overflow-x-auto group" data-density={rowDensity}>
                    <table className="w-full group-data-[density=compact]:text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    企业名称
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    简介
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    行业
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    标签
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    岗位数
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    来源
                                </th>
                                <th className="px-6 py-3 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 group-data-[density=compact]:px-4 group-data-[density=compact]:py-8 text-center">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                            <span>加载中...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 group-data-[density=compact]:px-4 group-data-[density=compact]:py-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Building2 className="w-12 h-12 text-gray-300" />
                                            <p>暂无企业数据</p>
                                            <p className="text-sm">点击"从岗位提取企业"按钮开始</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                companies.map((company) => (
                                    <tr key={company.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <div className="flex items-center gap-3">
                                                {company.logo ? (
                                                    <img
                                                        src={company.logo}
                                                        alt={company.name}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 group-data-[density=compact]:w-8 group-data-[density=compact]:h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                                                        <Building2 className="w-5 h-5 text-gray-400" />
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium text-gray-900">{company.name}</div>
                                                    {company.url && (
                                                        <a
                                                            href={company.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                                        >
                                                            <Globe className="w-3 h-3" />
                                                            {new URL(company.url).hostname}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <div className="text-sm text-gray-600 max-w-xs truncate" title={company.description}>
                                                {company.description || <span className="text-gray-400">-</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                {company.industry || '未分类'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <div className="flex flex-wrap gap-1">
                                                {company.tags && company.tags.length > 0 ? (
                                                    company.tags.slice(0, 3).map((tag, index) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-sm text-gray-400">-</span>
                                                )}
                                                {company.tags && company.tags.length > 3 && (
                                                    <span className="text-xs text-gray-500">+{company.tags.length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <div className="flex items-center gap-1 text-sm text-gray-900">
                                                <Briefcase className="w-4 h-4 text-gray-400" />
                                                {company.jobCount || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                {company.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 group-data-[density=compact]:px-4 group-data-[density=compact]:py-2">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleViewDetail(company)}
                                                    className="text-gray-600 hover:text-gray-800"
                                                    title="查看企业详情"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {company.url && (
                                                    <a
                                                        href={company.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800"
                                                        title="访问网站"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                    </a>
                                                )}
                                                <button
                                                    onClick={() => handleUpdateInfo(company)}
                                                    disabled={updatingMap[company.id]}
                                                    className="text-green-600 hover:text-green-800 disabled:opacity-50"
                                                    title="重新爬取企业信息"
                                                >
                                                    <RefreshCw className={`w-4 h-4 ${updatingMap[company.id] ? 'animate-spin' : ''}`} />
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
                {renderPagination()}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'all'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5" />
                            <span>全部企业</span>
                        </div>
                    </button>
                    <button
                        onClick={() => setActiveTab('trusted')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${activeTab === 'trusted'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        <div className="flex items-center gap-2">
                            <Tag className="w-5 h-5" />
                            <span>可信企业管理</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="px-6 py-8">
                {activeTab === 'all' ? renderAllCompaniesTab() : <AdminTrustedCompaniesPage />}
            </div>

            {/* Modals */}
            {renderCompanyDetailModal()}
        </div>
    );
}
