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

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/data/trusted-companies?resource=tags');
            const data = await response.json();
            if (data.success) {
                setConfig(data.config);
            }
        } catch (error) {
            console.error('Failed to load tag config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (type: TagType) => {
        const value = newValue[type]?.trim();
        if (!value) return;

        try {
            const response = await fetch('/api/data/trusted-companies?resource=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ action: 'add', type, value })
            });

            const data = await response.json();
            if (data.success) {
                setConfig(data.config);
                setNewValue({ ...newValue, [type]: '' });
            }
        } catch (error) {
            console.error('Failed to add tag:', error);
        }
    };

    const handleDelete = async (type: TagType, index: number) => {
        if (!confirm('确定要删除这个标签吗？')) return;

        try {
            const response = await fetch('/api/data/trusted-companies?resource=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
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
            const response = await fetch('/api/data/trusted-companies?resource=tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
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

    const renderTagSection = (
        title: string,
        icon: React.ReactNode,
        type: TagType,
        tags: string[],
        description: string
    ) => (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                    {icon}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">{title}</h2>
                    <p className="text-sm text-gray-500">{description}</p>
                </div>
            </div>

            {/* Add new tag */}
            <div className="mb-4 flex gap-2">
                <input
                    type="text"
                    value={newValue[type] || ''}
                    onChange={(e) => setNewValue({ ...newValue, [type]: e.target.value })}
                    onKeyPress={(e) => e.key === 'Enter' && handleAdd(type)}
                    placeholder="输入新标签..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                    onClick={() => handleAdd(type)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    添加
                </button>
            </div>

            {/* Tag list */}
            <div className="space-y-2">
                {tags.map((tag, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        {editingIndex?.type === type && editingIndex?.index === index ? (
                            <>
                                <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEdit()}
                                    className="flex-1 px-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveEdit}
                                    className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                    title="保存"
                                >
                                    <Save className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => {
                                        setEditingIndex(null);
                                        setEditValue('');
                                    }}
                                    className="p-2 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                                    title="取消"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="flex-1 text-gray-900">{tag}</span>
                                <button
                                    onClick={() => handleEdit(type, index, tag)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                    title="编辑"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(type, index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="删除"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
                {tags.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        暂无标签，点击上方添加按钮创建
                    </div>
                )}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">标签管理</h1>
                    <p className="text-gray-600">
                        管理岗位分类、企业行业和企业标签，用于自动分类和筛选
                    </p>
                </div>

                {/* Tag sections */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {renderTagSection(
                        '岗位分类',
                        <Briefcase className="w-5 h-5" />,
                        'jobCategory',
                        config.jobCategories,
                        '用于岗位自动分类，如前端、后端、产品等'
                    )}

                    {renderTagSection(
                        '企业行业',
                        <Building2 className="w-5 h-5" />,
                        'companyIndustry',
                        config.companyIndustries,
                        '企业所属行业，如互联网、教育、医疗等'
                    )}

                    {renderTagSection(
                        '企业标签',
                        <Tag className="w-5 h-5" />,
                        'companyTag',
                        config.companyTags,
                        '企业细分领域标签，如AI+健康、远程优先等'
                    )}
                </div>
            </div>
        </div>
    );
}
