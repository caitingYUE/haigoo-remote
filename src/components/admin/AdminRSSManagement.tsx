import React, { useState } from 'react';
import { Plus, Trash2, Edit3, X, Save } from 'lucide-react';
import { RSSSource } from '../../types/rss-types';
import { rssService } from '../../services/rss-service';

interface AdminRSSManagementProps {
    rssSources: RSSSource[];
    onRefresh: () => void;
    onClose?: () => void; // Optional if we want to add a close button to the card itself
}

const AdminRSSManagement: React.FC<AdminRSSManagementProps> = ({ rssSources, onRefresh, onClose }) => {
    const [showRSSForm, setShowRSSForm] = useState(false);
    const [editingRSSSource, setEditingRSSSource] = useState<RSSSource | null>(null);
    const [rssFormData, setRssFormData] = useState<{
        name: string;
        url: string;
        category: string;
    }>({
        name: '',
        url: '',
        category: ''
    });

    const [batchRSSForms, setBatchRSSForms] = useState<Array<{
        name: string;
        url: string;
        category: string;
    }>>([{ name: '', url: '', category: '' }]);

    const [selectedSources, setSelectedSources] = useState<number[]>([]);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [sourceToDelete, setSourceToDelete] = useState<RSSSource | null>(null);
    const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);

    // RSS Form Handlers
    const handleAddRSSSource = () => {
        setEditingRSSSource(null);
        setRssFormData({ name: '', url: '', category: '' });
        setShowRSSForm(true);
    };

    const handleEditRSSSource = (source: RSSSource) => {
        setEditingRSSSource(source);
        setRssFormData({
            name: source.name,
            url: source.url,
            category: source.category
        });
        setShowRSSForm(true);
    };

    const handleDisplayDeleteConfirm = (source: RSSSource) => {
        setSourceToDelete(source);
        setShowDeleteConfirm(true);
    };

    const handleCancelRSSForm = () => {
        setShowRSSForm(false);
        setEditingRSSSource(null);
        setRssFormData({ name: '', url: '', category: '' });
    };

    const handleSaveRSSSource = () => {
        if (!rssFormData.name.trim() || !rssFormData.url.trim() || !rssFormData.category.trim()) {
            alert('请填写完整的RSS源信息');
            return;
        }

        try {
            if (editingRSSSource) {
                // Find existing source index (simple matching)
                const sourceIndex = rssSources.findIndex(s =>
                    s.name === editingRSSSource.name &&
                    s.category === editingRSSSource.category &&
                    s.url === editingRSSSource.url
                );
                if (sourceIndex !== -1) {
                    rssService.updateRSSSource(sourceIndex, {
                        name: rssFormData.name,
                        url: rssFormData.url,
                        category: rssFormData.category
                    });
                }
            } else {
                rssService.addRSSSource({
                    name: rssFormData.name,
                    url: rssFormData.url,
                    category: rssFormData.category
                });
            }

            onRefresh();
            setShowRSSForm(false);
            setEditingRSSSource(null);
            setRssFormData({ name: '', url: '', category: '' });
        } catch (error) {
            alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    // Batch Form Handlers
    const addBatchRSSForm = () => {
        setBatchRSSForms(prev => [...prev, { name: '', url: '', category: '' }]);
    };

    const removeBatchRSSForm = (index: number) => {
        if (batchRSSForms.length > 1) {
            setBatchRSSForms(prev => prev.filter((_, i) => i !== index));
        }
    };

    const updateBatchRSSForm = (index: number, field: string, value: string) => {
        setBatchRSSForms(prev => prev.map((form, i) =>
            i === index ? { ...form, [field]: value } : form
        ));
    };

    const handleBatchSaveRSSSource = async () => {
        try {
            for (const formData of batchRSSForms) {
                if (formData.name && formData.url && formData.category) {
                    rssService.addRSSSource({
                        name: formData.name,
                        url: formData.url,
                        category: formData.category
                    });
                }
            }
            onRefresh();
            setBatchRSSForms([{ name: '', url: '', category: '' }]);
            setShowRSSForm(false);
        } catch (error) {
            alert(`批量保存RSS源失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    // Batch Selection Handlers
    const handleSelectSource = (index: number) => {
        setSelectedSources(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    const handleSelectAllSources = () => {
        if (selectedSources.length === rssSources.length) {
            setSelectedSources([]);
        } else {
            setSelectedSources(rssSources.map((_, index) => index));
        }
    };

    const handleDeleteBatch = () => {
        if (selectedSources.length === 0) return;
        setShowBatchDeleteConfirm(true);
    };

    const confirmBatchDelete = async () => {
        try {
            const sortedIndices = selectedSources.sort((a, b) => b - a);
            for (const index of sortedIndices) {
                rssService.deleteRSSSource(index);
            }
            onRefresh();
            setSelectedSources([]);
            setShowBatchDeleteConfirm(false);
        } catch (error) {
            alert(`批量删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    const confirmDeleteRSSSource = async () => {
        if (!sourceToDelete) return;

        try {
            const sourceIndex = rssSources.findIndex(s =>
                s.name === sourceToDelete.name &&
                s.category === sourceToDelete.category &&
                s.url === sourceToDelete.url
            );
            if (sourceIndex !== -1) {
                rssService.deleteRSSSource(sourceIndex);
                onRefresh();
            }
            setShowDeleteConfirm(false);
            setSourceToDelete(null);
        } catch (error) {
            alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
    };

    return (
        <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-slate-200">
                <div className="flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-medium text-slate-900">RSS数据源配置</h3>
                        <p className="text-sm text-slate-600">管理RSS数据源，共 {rssSources.length} 个源</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handleAddRSSSource}
                            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            添加RSS源
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-6">
                {/* Bulk Action Toolbar */}
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            checked={selectedSources.length === rssSources.length && rssSources.length > 0}
                            onChange={handleSelectAllSources}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-600">
                            {selectedSources.length > 0 ? `已选择 ${selectedSources.length} 个` : '全选'}
                        </span>
                    </div>
                    {selectedSources.length > 0 && (
                        <button
                            onClick={handleDeleteBatch}
                            className="inline-flex items-center px-3 py-1 border border-transparent rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                        >
                            <Trash2 className="w-4 h-4 mr-1" />
                            批量删除
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {rssSources.map((source, index) => (
                        <div key={index} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                            <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedSources.includes(index)}
                                        onChange={() => handleSelectSource(index)}
                                        className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="flex-1">
                                        <h4 className="text-sm font-medium text-slate-900">{source.name}</h4>
                                        <p className="text-xs text-slate-600 mt-1">{source.category}</p>
                                        <p className="text-xs text-slate-500 mt-2 break-all">{source.url}</p>
                                    </div>
                                </div>
                                <div className="ml-2 flex flex-col space-y-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                        活跃
                                    </span>
                                    <div className="flex space-x-1">
                                        <button
                                            onClick={() => handleEditRSSSource(source)}
                                            className="p-1 text-slate-400 hover:text-indigo-600"
                                            title="编辑"
                                        >
                                            <Edit3 className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDisplayDeleteConfirm(source)}
                                            className="p-1 text-slate-400 hover:text-red-600"
                                            title="删除"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RSS Source Form (Add/Edit) */}
            {showRSSForm && (
                <div className="fixed inset-0 bg-slate-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
                        <div className="mt-3">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-slate-900">
                                    {editingRSSSource ? '编辑RSS源' : '批量添加RSS源'}
                                </h3>
                                <button
                                    onClick={handleCancelRSSForm}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Batch Add Mode */}
                            {!editingRSSSource && (
                                <div className="space-y-4">
                                    {batchRSSForms.map((form, index) => (
                                        <div key={index} className="border border-slate-200 rounded-lg p-4">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="text-sm font-medium text-slate-700">RSS源 {index + 1}</h4>
                                                <div className="flex space-x-2">
                                                    {index === batchRSSForms.length - 1 && (
                                                        <button
                                                            onClick={addBatchRSSForm}
                                                            className="p-1 text-green-600 hover:text-green-800"
                                                            title="添加更多"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {batchRSSForms.length > 1 && (
                                                        <button
                                                            onClick={() => removeBatchRSSForm(index)}
                                                            className="p-1 text-red-600 hover:text-red-800"
                                                            title="删除"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                        源名称
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={form.name}
                                                        onChange={(e) => updateBatchRSSForm(index, 'name', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="例如: WeWorkRemotely"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                        分类
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={form.category}
                                                        onChange={(e) => updateBatchRSSForm(index, 'category', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="例如: 全栈开发"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                                        RSS URL
                                                    </label>
                                                    <input
                                                        type="url"
                                                        value={form.url}
                                                        onChange={(e) => updateBatchRSSForm(index, 'url', e.target.value)}
                                                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="https://example.com/feed.rss"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Single Edit Mode */}
                            {editingRSSSource && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            源名称
                                        </label>
                                        <input
                                            type="text"
                                            value={rssFormData.name}
                                            onChange={(e) => setRssFormData(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="例如: WeWorkRemotely"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            分类
                                        </label>
                                        <input
                                            type="text"
                                            value={rssFormData.category}
                                            onChange={(e) => setRssFormData(prev => ({ ...prev, category: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="例如: 全栈开发"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            RSS URL
                                        </label>
                                        <input
                                            type="url"
                                            value={rssFormData.url}
                                            onChange={(e) => setRssFormData(prev => ({ ...prev, url: e.target.value }))}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            placeholder="https://example.com/feed.rss"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-3 mt-6">
                                <button
                                    onClick={handleCancelRSSForm}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={editingRSSSource ? handleSaveRSSSource : handleBatchSaveRSSSource}
                                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                                >
                                    <Save className="w-4 h-4 mr-2" />
                                    {editingRSSSource ? '保存' : '批量保存'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && sourceToDelete && (
                <div className="fixed inset-0 bg-slate-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg font-medium text-slate-900 mt-4">确认删除RSS源</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-slate-500">
                                    确定要删除RSS源 "<span className="font-medium">{sourceToDelete.name}</span>" 吗？
                                </p>
                                <p className="text-xs text-slate-400 mt-1">此操作无法撤销</p>
                            </div>
                            <div className="flex justify-center space-x-3 mt-4">
                                <button
                                    onClick={() => setShowDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmDeleteRSSSource}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                                >
                                    确认删除
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Batch Delete Confirmation Modal */}
            {showBatchDeleteConfirm && (
                <div className="fixed inset-0 bg-slate-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
                    <div className="relative p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div className="mt-3 text-center">
                            <h3 className="text-lg font-medium text-slate-900 mt-4">确认批量删除</h3>
                            <div className="mt-2 px-7 py-3">
                                <p className="text-sm text-slate-500">
                                    确定要删除选中的 <span className="font-medium">{selectedSources.length}</span> 个RSS源吗？
                                </p>
                                <p className="text-xs text-slate-400 mt-1">此操作无法撤销</p>
                            </div>
                            <div className="flex justify-center space-x-3 mt-4">
                                <button
                                    onClick={() => setShowBatchDeleteConfirm(false)}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={confirmBatchDelete}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700"
                                >
                                    确认删除
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminRSSManagement;
