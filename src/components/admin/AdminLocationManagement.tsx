import React, { useState, useEffect } from 'react';
import { X, Loader, Save } from 'lucide-react';
import { Job } from '../../types/rss-types';

interface AdminLocationManagementProps {
    isOpen: boolean;
    onClose: () => void;
    jobs: Job[];
}

const AdminLocationManagement: React.FC<AdminLocationManagementProps> = ({ isOpen, onClose, jobs }) => {
    const [categories, setCategories] = useState<{
        domesticKeywords: string[];
        overseasKeywords: string[];
        globalKeywords: string[];
    }>({ domesticKeywords: [], overseasKeywords: [], globalKeywords: [] });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchLocationCategories();
        }
    }, [isOpen]);

    const fetchLocationCategories = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/user-profile?action=location_categories_get');
            if (res.ok) {
                const data = await res.json();
                setCategories(data.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] });
            }
        } catch (error) {
            console.error('Failed to fetch location categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const token = localStorage.getItem('haigoo_auth_token');
            const res = await fetch('/api/user-profile?action=location_categories_set', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token || ''}`
                },
                body: JSON.stringify(categories)
            });

            if (res.ok) {
                alert('地址分类保存成功');
                onClose();
                window.dispatchEvent(new Event('processed-jobs-updated'));
            } else {
                alert('保存失败');
            }
        } catch (error) {
            alert('保存出错: ' + error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative p-8 border w-full max-w-4xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-bold text-slate-900">地址分类管理</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 mb-6">
                            <p className="text-sm text-indigo-800">
                                在此配置"人在国内"和"人在海外"的匹配规则。系统将根据这些关键词自动将岗位分配到对应的标签页。
                                支持输入城市名、国家名、时区等关键词。多个关键词请用逗号分隔。
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                人在国内 (Domestic) - 关键词
                            </label>
                            <textarea
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                value={categories.domesticKeywords.join(', ')}
                                onChange={(e) => setCategories(prev => ({
                                    ...prev,
                                    domesticKeywords: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
                                }))}
                                placeholder="例如: China, 中国, Beijing, Shanghai, UTC+8..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                人在海外 (Overseas) - 关键词
                            </label>
                            <textarea
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                value={categories.overseasKeywords.join(', ')}
                                onChange={(e) => setCategories(prev => ({
                                    ...prev,
                                    overseasKeywords: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
                                }))}
                                placeholder="例如: USA, UK, Europe, Japan, Australia..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                全球通用 (Global) - 关键词
                            </label>
                            <textarea
                                rows={4}
                                className="w-full p-3 border border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                value={categories.globalKeywords.join(', ')}
                                onChange={(e) => setCategories(prev => ({
                                    ...prev,
                                    globalKeywords: e.target.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
                                }))}
                                placeholder="例如: Anywhere, Everywhere, Worldwide, 不限地点..."
                            />
                        </div>

                        {/* Save Button */}
                        <div className="flex justify-end pt-4">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? '保存中...' : '保存配置'}
                            </button>
                        </div>

                        {/* 现有地址分析与快速分类 */}
                        <div className="mt-8 border-t pt-6">
                            <h4 className="text-lg font-medium text-slate-900 mb-4">现有岗位地址分析</h4>
                            <p className="text-sm text-slate-500 mb-4">
                                以下列表展示了当前数据库中出现的所有唯一地址及其匹配状态。点击按钮可将其快速添加到对应分类。
                            </p>

                            <div className="bg-slate-50 rounded-lg border border-slate-200 max-h-96 overflow-y-auto p-4">
                                <div className="grid grid-cols-1 gap-2">
                                    {(() => {
                                        // 计算唯一地址及其出现次数
                                        const locationCounts = new Map<string, number>();
                                        jobs.forEach(job => {
                                            if (job.location) {
                                                locationCounts.set(job.location, (locationCounts.get(job.location) || 0) + 1);
                                            }
                                        });

                                        const sortedLocations = Array.from(locationCounts.entries())
                                            .sort((a, b) => b[1] - a[1]); // 按出现次数降序

                                        // 辅助函数：检查地址匹配状态
                                        const checkStatus = (loc: string) => {
                                            const normLoc = loc.toLowerCase();
                                            const isDomestic = categories.domesticKeywords.some(k => normLoc.includes(k.toLowerCase()));
                                            const isOverseas = categories.overseasKeywords.some(k => normLoc.includes(k.toLowerCase()));
                                            const isGlobal = categories.globalKeywords.some(k => normLoc.includes(k.toLowerCase()));

                                            if (isGlobal) return { label: '全球', color: 'bg-purple-100 text-purple-800' };
                                            if (isDomestic && isOverseas) return { label: '混合', color: 'bg-yellow-100 text-yellow-800' };
                                            if (isDomestic) return { label: '国内', color: 'bg-indigo-100 text-indigo-800' };
                                            if (isOverseas) return { label: '海外', color: 'bg-green-100 text-green-800' };
                                            return { label: '未分类', color: 'bg-slate-100 text-slate-600' };
                                        };

                                        return sortedLocations.map(([loc, count]) => {
                                            const status = checkStatus(loc);
                                            return (
                                                <div key={loc} className="flex items-center justify-between bg-white p-3 rounded border border-slate-100 hover:shadow-sm">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <span className={`px-2 py-0.5 text-xs rounded-full whitespace-nowrap ${status.color}`}>
                                                            {status.label}
                                                        </span>
                                                        <span className="text-sm font-medium text-slate-700 truncate" title={loc}>{loc}</span>
                                                        <span className="text-xs text-slate-400 whitespace-nowrap">({count}个岗位)</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {status.label === '未分类' && (
                                                            <>
                                                                <button
                                                                    onClick={() => setCategories(prev => ({
                                                                        ...prev,
                                                                        domesticKeywords: [...prev.domesticKeywords, loc]
                                                                    }))}
                                                                    className="text-xs px-2 py-1 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 border border-indigo-200"
                                                                >
                                                                    +国内
                                                                </button>
                                                                <button
                                                                    onClick={() => setCategories(prev => ({
                                                                        ...prev,
                                                                        overseasKeywords: [...prev.overseasKeywords, loc]
                                                                    }))}
                                                                    className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 border border-green-200"
                                                                >
                                                                    +海外
                                                                </button>
                                                                <button
                                                                    onClick={() => setCategories(prev => ({
                                                                        ...prev,
                                                                        globalKeywords: [...prev.globalKeywords, loc]
                                                                    }))}
                                                                    className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 border border-purple-200"
                                                                >
                                                                    +全球
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminLocationManagement;
