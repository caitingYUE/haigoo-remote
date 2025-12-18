import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Tag, Briefcase, Building2 } from 'lucide-react';

interface TagConfig {
    jobCategories: string[];
    companyIndustries: string[];
    companyTags: string[];
}

type TagType = 'jobCategory' | 'companyIndustry' | 'companyTag';

export default function AdminTagManagementPage() {
    const [config, setConfig] = useState<TagConfig>({
        jobCategories: [],
        companyIndustries: [],
        companyTags: []
    });
    const [loading, setLoading] = useState(true);
    const [editingIndex, setEditingIndex] = useState<{ type: TagType; index: number } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newValue, setNewValue] = useState<{ [key in TagType]?: string }>({});
    const [reclassifying, setReclassifying] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/data/trusted-companies?target=tags');
            const data = await response.json();
            if (data.success) {
                setConfig(data.config || {
                    jobCategories: [],
                    companyIndustries: [],
                    companyTags: []
                });
            }
        } catch (error) {
            console.error('Failed to load tag config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (type: TagType) => {
        const value = newValue[type]?.trim();
        if (!value) {
            alert('请输入标签内容');
            return;
        }

        try {
            console.log('[Tag Management] Adding tag:', { type, value });

            const response = await fetch('/api/data/trusted-companies?target=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                },
                body: JSON.stringify({ action: 'add', type, value })
            });

            console.log('[Tag Management] Response status:', response.status);
            const data = await response.json();
            console.log('[Tag Management] Response data:', data);

            if (data.success) {
                setConfig(data.config);
                setNewValue({ ...newValue, [type]: '' });
                alert('添加成功！');
            } else {
                alert('添加失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Failed to add tag:', error);
            alert('添加失败，请检查网络连接');
        }
    };

    const handleDelete = async (type: TagType, index: number) => {
        if (!confirm('确定要删除这个标签吗？')) return;

        try {
            const response = await fetch('/api/data/trusted-companies?target=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                },
                body: JSON.stringify({ action: 'delete', type, index })
            });

            const data = await response.json();
            if (data.success) {
                setConfig(data.config);
            }
        } catch (error) {
            console.error('Failed to delete tag:', error);
        }
    };

    const handleEdit = (type: TagType, index: number, currentValue: string) => {
        setEditingIndex({ type, index });
        setEditValue(currentValue);
    };

    const handleSaveEdit = async () => {
        if (!editingIndex || !editValue.trim()) return;

        try {
            const response = await fetch('/api/data/trusted-companies?target=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                },
                body: JSON.stringify({
                    action: 'update',
                    type: editingIndex.type,
                    index: editingIndex.index,
                    value: editValue.trim()
                })
            });

            const data = await response.json();
            if (data.success) {
                setConfig(data.config);
                setEditingIndex(null);
                setEditValue('');
            }
        } catch (error) {
            console.error('Failed to update tag:', error);
        }
    };

    const handleReclassify = async () => {
        if (!confirm('确定要重新分类所有线上岗位数据吗？\n\n这将根据当前的标签配置重新分类所有岗位，可能需要一些时间。')) {
            return;
        }

        try {
            setReclassifying(true);
            const response = await fetch('/api/data/trusted-companies?action=reclassify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                }
            });

            const data = await response.json();
            if (data.success) {
                alert(data.message || '重新分类完成！');
            } else {
                alert('重新分类失败：' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('Failed to reclassify:', error);
            alert('重新分类失败，请稍后重试');
        } finally {
            setReclassifying(false);
        }
    };

    const renderTagSection = (
        title: string,
        icon: React.ReactNode,
        type: TagType,
        tags: string[],
        description: string,
        color: string
    ) => (
        <div className="bg-white rounded-lg border border-slate-200 flex flex-col">
            {/* Header */}
            <div className={`${color} p-4`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-white">
                        {icon}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{title}</h3>
                        <p className="text-sm text-white/80">{description}</p>
                    </div>
                    <div className="text-white/80 text-sm font-medium">
                        {tags.length} 项
                    </div>
                </div>
            </div>

            {/* Add new tag */}
            <div className="p-4 border-b border-slate-200 bg-slate-50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newValue[type] || ''}
                        onChange={(e) => setNewValue({ ...newValue, [type]: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && handleAdd(type)}
                        placeholder="输入新标签..."
                        className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <button
                        onClick={() => handleAdd(type)}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" />
                        添加
                    </button>
                </div>
            </div>

            {/* Tag list */}
            <div className="p-4 space-y-2">
                {tags.map((tag, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors group"
                    >
                        {editingIndex?.type === type && editingIndex?.index === index ? (
                            <>
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                    className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveEdit}
                                    className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="保存"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingIndex(null);
                                        setEditValue('');
                                    }}
                                    className="p-1.5 text-slate-600 hover:bg-slate-200 rounded transition-colors"
                                    title="取消"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="flex-1 text-sm text-slate-900">{tag}</span>
                                <button
                                    onClick={() => handleEdit(type, index, tag)}
                                    className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="编辑"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(type, index)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                                    title="删除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
                {tags.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <div className="text-4xl mb-2 text-indigo-500"><Tag className="w-10 h-10" /></div>
                        <p className="text-sm">暂无标签</p>
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 p-6">
            {/* Top Actions */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-900">标签配置</h2>
                    <p className="text-sm text-slate-600 mt-1">管理岗位分类、企业行业和企业标签</p>
                </div>
                <button
                    onClick={handleReclassify}
                    disabled={reclassifying}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                    {reclassifying ? (
                        <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>应用中...</span>
                        </>
                    ) : (
                        <span>应用到线上</span>
                    )}
                </button>
            </div>

            {/* Tag Sections Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {renderTagSection(
                    '岗位分类',
                    <Briefcase className="w-5 h-5" />,
                    'jobCategory',
                    config.jobCategories,
                    '用于岗位自动分类',
                    'bg-gradient-to-r from-indigo-500 to-indigo-600'
                )}

                {renderTagSection(
                    '企业行业',
                    <Building2 className="w-5 h-5" />,
                    'companyIndustry',
                    config.companyIndustries,
                    '企业所属行业',
                    'bg-gradient-to-r from-purple-500 to-purple-600'
                )}

                {renderTagSection(
                    '企业标签',
                    <Tag className="w-5 h-5" />,
                    'companyTag',
                    config.companyTags,
                    '企业细分领域标签',
                    'bg-gradient-to-r from-green-500 to-green-600'
                )}
            </div>
        </div>
    );
}
