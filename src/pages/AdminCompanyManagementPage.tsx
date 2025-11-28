import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Building2, Search, Filter, RefreshCw, Plus, Trash2, Edit2,
    ExternalLink, Globe, Tag, Briefcase, ArrowLeft
} from 'lucide-react';
import AdminTrustedCompaniesPage from './AdminTrustedCompaniesPage';
import { CompanyService } from '../services/company-service';
import { ClassificationService } from '../services/classification-service';

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
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'all' | 'trusted'>('all');
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [extracting, setExtracting] = useState(false);
    const [updatingMap, setUpdatingMap] = useState<Record<string, boolean>>({});
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [pageSize] = useState(20);
    const [searchQuery, setSearchQuery] = useState('');
    const [industryFilter, setIndustryFilter] = useState('');

    useEffect(() => {
        if (activeTab === 'all') {
            loadCompanies();
        }
    }, [activeTab, page, searchQuery, industryFilter]);

    const loadCompanies = async () => {
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
                setCompanies(data.companies || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('Failed to load companies:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExtractCompanies = async () => {
        if (!confirm('确定要从岗位数据中提取企业信息吗？\n\n这将分析所有岗位并创建企业列表。')) {
            return;
        }

        try {
            setExtracting(true);
            const response = await fetch('/api/data/trusted-companies?resource=companies&action=extract');
            const data = await response.json();

            if (data.success) {
                alert(data.message || '企业提取完成！');
                await loadCompanies();
            } else {
                alert('提取失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Failed to extract companies:', error);
            alert('提取失败，请稍后重试');
        } finally {
            setExtracting(false);
        }
    };

    const handleUpdateInfo = async (company: Company) => {
        if (!company.url) {
            alert('该企业没有官网链接，无法更新信息');
            return;
        }

        try {
            setUpdatingMap(prev => ({ ...prev, [company.id]: true }));

            // 1. 抓取官网信息
            const info = await CompanyService.fetchCompanyInfo(company.url);

            if (!info.description && !info.logo) {
                alert('未抓取到有效信息，请检查官网链接是否可访问');
                return;
            }

            // 2. 重新分类行业
            const classification = ClassificationService.classifyCompany(
                company.name,
                info.description || company.description || ''
            );

            // 3. 更新企业信息
            const updatedCompany = {
                ...company,
                description: info.description || company.description,
                logo: info.logo || company.logo,
                industry: classification.industry !== '其他' ? classification.industry : company.industry,
                tags: Array.from(new Set([...(company.tags || []), ...classification.tags]))
            };

            const response = await fetch('/api/data/trusted-companies?resource=companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCompany)
            });

            const data = await response.json();
            if (data.success) {
                // 更新本地列表
                setCompanies(prev => prev.map(c => c.id === company.id ? { ...c, ...updatedCompany } : c));
                alert('企业信息更新成功！');
            } else {
                alert('更新失败：' + (data.error || '未知错误'));
            }

        } catch (error) {
            console.error('Failed to update company info:', error);
            alert('更新失败，请稍后重试');
        } finally {
            setUpdatingMap(prev => ({ ...prev, [company.id]: false }));
        }
    };

    const renderAllCompaniesTab = () => (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex items-center justify-between">
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
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadCompanies}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        刷新
                    </button>

                    <button
                        onClick={handleExtractCompanies}
                        disabled={extracting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {extracting ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                <span>提取中...</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                <span>从岗位提取企业</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Company List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    企业名称
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    行业
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    标签
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    岗位数
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    来源
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    操作
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex items-center justify-center gap-2 text-gray-500">
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                            <span>加载中...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : companies.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
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
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                {company.logo ? (
                                                    <img
                                                        src={company.logo}
                                                        alt={company.name}
                                                        className="w-10 h-10 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
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
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                {company.industry || '未分类'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
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
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm text-gray-900">
                                                <Briefcase className="w-4 h-4 text-gray-400" />
                                                {company.jobCount || 0}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                {company.source}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
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
                                                    className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                                                    title="抓取并更新企业信息"
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
                {total > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-500">
                            显示 {((page - 1) * pageSize) + 1} 到 {Math.min(page * pageSize, total)} 条，共 {total} 条
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page === 1}
                                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1 text-sm">
                                第 {page} 页，共 {Math.ceil(total / pageSize)} 页
                            </span>
                            <button
                                onClick={() => setPage(page + 1)}
                                disabled={page >= Math.ceil(total / pageSize)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                            >
                                下一页
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="h-full bg-gray-50">
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
        </div>
    );
}
