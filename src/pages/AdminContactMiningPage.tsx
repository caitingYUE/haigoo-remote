
import React, { useState } from 'react';
import { 
    Search, Mail, Building2, Globe, ExternalLink, 
    ShieldCheck, ShieldAlert, Loader2, CheckCircle2, AlertCircle,
    Linkedin, Twitter, Facebook, Youtube, Github
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ContactResult {
    email: string;
    role: string;
    source: string;
    confidence: number;
    context: string;
}

interface MiningResponse {
    success: boolean;
    company: string;
    stats: {
        pagesCrawled: number;
        emailsFound: number;
        socialLinksFound: number;
    };
    contacts: ContactResult[];
    socialLinks: string[];
    error?: string;
}

export default function AdminContactMiningPage() {
    const { token } = useAuth();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<MiningResponse | null>(null);
    const [error, setError] = useState('');

    const handleMine = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setLoading(true);
        setError('');
        setResult(null);

        try {
            const response = await fetch(`/api/admin-ops?action=contact_mining`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ input: input.trim() })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Mining failed');
            }

            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const getConfidenceColor = (score: number) => {
        if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
        if (score >= 60) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
        return 'text-red-600 bg-red-50 border-red-200';
    };

    const getRoleBadge = (role: string) => {
        const styles: Record<string, string> = {
            HR: 'bg-purple-100 text-purple-700',
            Sales: 'bg-blue-100 text-blue-700',
            Support: 'bg-orange-100 text-orange-700',
            Info: 'bg-gray-100 text-gray-700',
            Executive: 'bg-red-100 text-red-700',
            General: 'bg-gray-100 text-gray-600',
            Tech: 'bg-cyan-100 text-cyan-700',
            Legal: 'bg-slate-100 text-slate-700'
        };
        return styles[role] || styles.General;
    };

    const getSocialIcon = (url: string) => {
        if (url.includes('linkedin')) return <Linkedin className="w-4 h-4" />;
        if (url.includes('twitter') || url.includes('x.com')) return <Twitter className="w-4 h-4" />;
        if (url.includes('facebook')) return <Facebook className="w-4 h-4" />;
        if (url.includes('youtube')) return <Youtube className="w-4 h-4" />;
        if (url.includes('github')) return <Github className="w-4 h-4" />;
        return <Globe className="w-4 h-4" />;
    };

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <Search className="w-8 h-8 text-blue-600" />
                    企业联系方式挖掘 (Contact Miner)
                </h1>
                <p className="text-gray-500 mt-2">
                    输入公司官网或域名，自动爬取公开的邮箱联系方式、社交媒体，并进行角色归类和置信度评分。
                </p>
            </div>

            {/* Input Section */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-8">
                <form onSubmit={handleMine} className="flex gap-4">
                    <div className="relative flex-1">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="输入公司域名 (e.g., airbnb.com) 或 官网 URL"
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !input.trim()}
                        className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                正在挖掘...
                            </>
                        ) : (
                            <>
                                <Search className="w-5 h-5" />
                                开始挖掘
                            </>
                        )}
                    </button>
                </form>

                {error && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-center gap-2 border border-red-100">
                        <AlertCircle className="w-5 h-5" />
                        {error}
                    </div>
                )}
            </div>

            {/* Results Section */}
            {result && (
                <div className="space-y-6">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">目标公司</div>
                            <div className="font-semibold text-lg flex items-center gap-2 truncate" title={result.company}>
                                <Building2 className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                {result.company}
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">爬取页面数</div>
                            <div className="font-semibold text-lg flex items-center gap-2">
                                <Globe className="w-5 h-5 text-blue-400" />
                                {result.stats.pagesCrawled} 页
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">发现联系方式</div>
                            <div className="font-semibold text-lg flex items-center gap-2">
                                <Mail className="w-5 h-5 text-green-400" />
                                {result.stats.emailsFound} 个
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="text-sm text-gray-500 mb-1">发现社交媒体</div>
                            <div className="font-semibold text-lg flex items-center gap-2">
                                <Linkedin className="w-5 h-5 text-blue-600" />
                                {result.stats.socialLinksFound} 个
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Contacts Table (Left - 2 cols) */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-blue-600" />
                                    挖掘结果
                                </h3>
                            </div>
                            
                            {result.contacts.length === 0 ? (
                                <div className="p-12 text-center text-gray-500">
                                    <div className="mb-4 bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                                        <Mail className="w-8 h-8 text-gray-400" />
                                    </div>
                                    未找到公开的邮箱联系方式。
                                    <br />尝试检查官网是否有 "Contact Us" 页面，或者该网站使用了反爬虫保护。
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500 text-sm">
                                                <th className="px-6 py-3 font-medium">邮箱地址</th>
                                                <th className="px-6 py-3 font-medium">角色归类</th>
                                                <th className="px-6 py-3 font-medium">置信度</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {result.contacts.map((contact, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-gray-900 flex items-center gap-2">
                                                            <Mail className="w-4 h-4 text-gray-400" />
                                                            {contact.email}
                                                        </div>
                                                        <div className="text-xs text-gray-400 mt-1 truncate max-w-[200px]" title={contact.context}>
                                                            {contact.context}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadge(contact.role)}`}>
                                                            {contact.role}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getConfidenceColor(contact.confidence)}`}>
                                                            {contact.confidence >= 80 ? <CheckCircle2 className="w-3 h-3" /> : <ShieldAlert className="w-3 h-3" />}
                                                            {contact.confidence}%
                                                        </div>
                                                        {contact.source.startsWith('http') ? (
                                                            <a 
                                                                href={contact.source} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:text-blue-800 text-xs block mt-1 flex items-center gap-1"
                                                            >
                                                                来源 <ExternalLink className="w-3 h-3" />
                                                            </a>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs block mt-1 flex items-center gap-1">
                                                                {contact.source}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Social Links (Right - 1 col) */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-blue-600" />
                                    社交媒体 & 链接
                                </h3>
                            </div>
                            
                            {result.socialLinks.length === 0 ? (
                                <div className="p-8 text-center text-gray-500 text-sm">
                                    未发现社交媒体链接
                                </div>
                            ) : (
                                <div className="p-2">
                                    {result.socialLinks.map((link, idx) => (
                                        <a 
                                            key={idx}
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group"
                                        >
                                            <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
                                                {getSocialIcon(link)}
                                            </div>
                                            <span className="text-sm text-gray-600 group-hover:text-gray-900 truncate flex-1">
                                                {link.replace(/^https?:\/\/(www\.)?/, '')}
                                            </span>
                                            <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-400" />
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
