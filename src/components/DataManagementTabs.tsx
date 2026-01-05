import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Database, RefreshCw, Trash2, CheckCircle,
  Filter,
  Briefcase, BarChart3, Loader, Edit3, Eye, Link as LinkIcon,
  MapPin, Calendar, Server, Star, ExternalLink, Info, Plus, Building, X,
  ChevronLeft, ChevronRight, HelpCircle
} from 'lucide-react';
import { JobCategory } from '../types/rss-types';
import { dataManagementService, RawRSSData, ProcessedJobData, StorageStats } from '../services/data-management-service';
import { processedJobsService } from '../services/processed-jobs-service';
import { useNotificationHelpers } from './NotificationSystem';
// 简历库相关逻辑已迁移至独立页面

interface DataManagementTabsProps {
  className?: string;
}

const DataManagementTabs: React.FC<DataManagementTabsProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'raw' | 'processed' | 'storage'>('processed');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const { showSuccess, showError } = useNotificationHelpers();

  // 原始数据状态
  const [rawData, setRawData] = useState<RawRSSData[]>([]);
  const [rawDataTotal, setRawDataTotal] = useState(0);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize] = useState(20);

  // 处理后数据状态
  const [processedData, setProcessedData] = useState<ProcessedJobData[]>([]);
  const [processedDataTotal, setProcessedDataTotal] = useState(0);
  const [processedDataPage, setProcessedDataPage] = useState(1);
  const [processedDataPageSize] = useState(20);
  const [locationCategories, setLocationCategories] = useState<{ domesticKeywords: string[]; overseasKeywords: string[]; globalKeywords: string[] }>({ domesticKeywords: [], overseasKeywords: [], globalKeywords: [] });
  // Dynamic categories from backend
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // 存储统计状态
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // 过滤器状态
  const [rawDataFilters, setRawDataFilters] = useState<{
    source?: string;
    category?: string;
    status?: 'raw' | 'processed' | 'error';
    dateRange?: { start: Date; end: Date };
  }>({});

  const [processedDataFilters, setProcessedDataFilters] = useState<{
    category?: JobCategory;
    company?: string;
    // 新增：关键词搜索（岗位名称/公司/描述/地点/标签）
    search?: string;
    experienceLevel?: string;
    tags?: string[];
    industry?: string;
    source?: string;
    isFeatured?: boolean;
  }>({});

  // Search debounce state
  const [searchTerm, setSearchTerm] = useState(processedDataFilters.search || '');

  // Sync local search term when filters are updated externally (e.g. clear filters)
  useEffect(() => {
    setSearchTerm(processedDataFilters.search || '');
  }, [processedDataFilters.search]);

  // Debounce search: update filters when searchTerm changes after delay
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== (processedDataFilters.search || '')) {
        setProcessedDataFilters(prev => ({ ...prev, search: searchTerm || undefined }));
      }
    }, 800); // 800ms delay for better user experience
    return () => clearTimeout(timer);
  }, [searchTerm, processedDataFilters.search]);

  // 编辑状态
  const [editingJob, setEditingJob] = useState<ProcessedJobData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<RawRSSData | ProcessedJobData | null>(null);

  // 新增：控制是否自动处理原始数据
  const [autoProcess, setAutoProcess] = useState(true);

  // 简历库已拆分为独立页面，不在此组件维护状态

  // 加载原始数据
  const loadRawData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await dataManagementService.getRawData(
        rawDataPage,
        rawDataPageSize,
        rawDataFilters
      );
      setRawData(result.data);
      setRawDataTotal(result.total);
    } catch (error) {
      console.error('加载原始数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [rawDataPage, rawDataPageSize, rawDataFilters]);

  // 加载处理后数据
  const loadProcessedData = useCallback(async () => {
    try {
      setLoading(true);
      const result = await dataManagementService.getProcessedJobs(
        processedDataPage,
        processedDataPageSize,
        processedDataFilters
      );
      setProcessedData(result.data);
      setProcessedDataTotal(result.total);
    } catch (error) {
      console.error('加载处理后数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [processedDataPage, processedDataPageSize, processedDataFilters]);

  useEffect(() => {
    if (activeTab === 'processed') {
      processedJobsService.getLocationCategories().then((c) => setLocationCategories(c)).catch(() => { });
    }

    // Load dynamic categories
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/data/trusted-companies?target=tags');
        const data = await response.json();
        if (data.success && data.config) {
          if (data.config.jobCategories) {
            setAvailableCategories(data.config.jobCategories);
          }
          if (data.config.companyTags) {
            setAvailableTags(data.config.companyTags);
          }
        }
      } catch (error) {
        console.error('Failed to load job categories/tags:', error);
      }
    };
    loadCategories();
  }, [activeTab]);

  // 加载存储统计
  const loadStorageStats = useCallback(async () => {
    try {
      setLoading(true);
      const stats = await dataManagementService.getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('加载存储统计失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 重新处理URL


  // 同步数据
  const handleSyncData = async () => {
    try {
      setSyncing(true);
      // 根据 autoProcess 状态决定是否跳过处理
      await dataManagementService.syncAllRSSData(!autoProcess);

      // 重新加载所有相关数据，确保两个页签都更新
      await loadRawData();
      if (autoProcess) {
        await loadProcessedData();
      }
      await loadStorageStats();

      const msg = autoProcess
        ? '已拉取最新RSS并自动处理为岗位数据'
        : '已拉取最新RSS原始数据（未处理）';
      showSuccess('同步完成', msg);
    } catch (error) {
      console.error('同步数据失败:', error);
      showError('同步失败', '请检查后端服务或网络连接');
    } finally {
      setSyncing(false);
    }
  };

  // 手动刷新处理后数据（仅拉取RSS并更新"处理后数据"）
  const handleRefreshProcessedOnly = async () => {
    try {
      setSyncing(true);
      // 强制处理，因为这是在"处理后数据"页签
      const syncResult = await dataManagementService.syncAllRSSData(false);
      await loadProcessedData();
      await loadStorageStats();
      
      const aiCount = syncResult.aiUpdatedJobs || 0;
      const regexCount = syncResult.regexUpdatedJobs || 0;
      
      showSuccess('刷新完成', `数据已更新。正则优化: ${regexCount}条, AI深度优化: ${aiCount}条`);
      // 广播全局事件，通知前台页面刷新处理后数据
      try {
        window.dispatchEvent(new Event('processed-jobs-updated'));
      } catch (e) {
        console.warn('广播处理后数据更新事件失败', e);
      }
    } catch (error) {
      console.error('刷新处理后数据失败:', error);
      showError('刷新失败', '请检查后端服务或网络连接');
    } finally {
      setSyncing(false);
    }
  };
  // 导出数据


  // 删除职位
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('确定要删除这个职位吗？此操作不可撤销。')) {
      return;
    }

    try {
      const success = await dataManagementService.deleteProcessedJob(jobId);
      if (success) {
        showSuccess('删除成功', '职位已删除');
        await loadProcessedData();
      } else {
        showError('删除失败', '删除操作未成功，请检查网络或日志');
      }
    } catch (error) {
      console.error('删除职位失败:', error);
      showError('删除失败', '发生未知错误');
    }
  };

  // 编辑职位
  const handleEditJob = (job: ProcessedJobData) => {
    setEditingJob(job);
    setShowEditModal(true);
  };

  // 新增职位
  const handleAddJob = () => {
    // 创建一个空的职位模板
    const newJob: ProcessedJobData = {
      id: '',
      title: '',
      company: '',
      location: '',
      description: '',
      url: '',
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'manual',
      category: '全栈开发' as JobCategory,
      salary: '',
      jobType: 'full-time',
      experienceLevel: 'Mid',
      isRemote: true,
      remoteLocationRestriction: '',
      tags: [],
      requirements: [],
      benefits: [],
      status: 'active',
      rawDataId: '',
      processedAt: new Date(),
      processingVersion: '1.0',
      isManuallyEdited: true,
      editHistory: []
    };
    setEditingJob(newJob);
    setShowEditModal(true);
  };

  // 保存编辑
  const handleSaveEdit = async (updatedJob: Partial<ProcessedJobData>) => {
    if (!editingJob) return;

    try {
      // 乐观更新：立即更新本地状态
      const updatedData = processedData.map(job =>
        job.id === editingJob.id ? { ...job, ...updatedJob } : job
      );
      setProcessedData(updatedData as ProcessedJobData[]);

      if (editingJob.id) {
        // 更新现有职位
        await dataManagementService.updateProcessedJob(editingJob.id, updatedJob, 'admin');
      } else {
        // 新增职位 - 调用API保存
        const newJob: ProcessedJobData = {
          ...editingJob,
          ...updatedJob,
          id: `manual_${Date.now()}`, // 生成唯一ID
          isManuallyEdited: true,
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as ProcessedJobData;

        await dataManagementService.addProcessedJob(newJob);
      }
      setShowEditModal(false);
      setEditingJob(null);

      // 重新加载数据以显示最新状态
      loadProcessedData();
    } catch (error) {
      console.error('保存职位失败:', error);
      showError('保存失败', '请重试');
      // 如果失败，回滚状态
      loadProcessedData();
    }
  };

  // 切换精选状态（乐观更新）
  const handleToggleFeatured = async (jobId: string, currentStatus: boolean) => {
    try {
      const newStatus = !currentStatus;

      // 1. 乐观更新：立即更新UI
      setProcessedData(prev => prev.map(job =>
        job.id === jobId ? { ...job, isFeatured: newStatus } : job
      ));

      // 2. 如果当前正在查看详情，也更新详情数据
      if (viewingItem && 'rawDataId' in viewingItem && viewingItem.id === jobId) {
        setViewingItem({ ...viewingItem, isFeatured: newStatus } as ProcessedJobData);
      }

      // 3. 调用API
      await dataManagementService.updateProcessedJob(jobId, { isFeatured: newStatus }, 'admin');

      showSuccess(newStatus ? '已设为精选' : '已取消精选', '');
    } catch (error) {
      console.error('更新精选状态失败:', error);
      showError('更新失败', '请重试');
      // 失败回滚
      loadProcessedData();
    }
  };

  // 导航切换
  const handleNavigate = (direction: 'prev' | 'next') => {
    const currentList = activeTab === 'processed' ? processedData : rawData;
    const currentItem = showEditModal ? editingJob : viewingItem;

    if (!currentItem || !currentList.length) return;

    const currentIndex = currentList.findIndex(item => item.id === currentItem.id);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'prev') {
      nextIndex = currentIndex - 1;
    } else {
      nextIndex = currentIndex + 1;
    }

    if (nextIndex >= 0 && nextIndex < currentList.length) {
      const nextItem = currentList[nextIndex];
      if (showEditModal) {
        setEditingJob(nextItem as ProcessedJobData);
      } else {
        setViewingItem(nextItem);
      }
    }
  };

  // 查看详情
  const handleViewDetail = (item: RawRSSData | ProcessedJobData) => {
    setViewingItem(item);
    setShowDetailModal(true);
  };

  useEffect(() => {
    if (activeTab === 'raw') {
      loadRawData();
    } else if (activeTab === 'processed') {
      loadProcessedData();
    } else if (activeTab === 'storage') {
      loadStorageStats();
    }
  }, [activeTab, loadRawData, loadProcessedData, loadStorageStats]);

  const renderTabButton = (tabKey: string, label: string, icon: React.ReactNode) => (
    <button
      key={tabKey}
      onClick={() => setActiveTab(tabKey as any)}
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${activeTab === tabKey
        ? 'bg-indigo-600 text-white shadow-lg'
        : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
        }`}
    >
      {icon}
      {label}
    </button>
  );

  // 简历库渲染逻辑已迁移至独立页面

  const renderRawDataTable = () => {
    // 从rawContent中解析字段的辅助函数
    const parseRawContent = (rawContent: string) => {
      try {
        return JSON.parse(rawContent);
      } catch (e) {
        return {};
      }
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {/* 过滤器 */}
        <div className="p-6 border-b border-slate-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">过滤条件：</span>
            </div>

            <select
              value={rawDataFilters.source || ''}
              onChange={(e) => setRawDataFilters({ ...rawDataFilters, source: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-300 rounded-lg textsm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">所有来源</option>
              <option value="WeWorkRemotely">WeWorkRemotely</option>
              <option value="Remotive">Remotive</option>
              <option value="Himalayas">Himalayas</option>
              <option value="NoDesk">NoDesk</option>
            </select>

            <select
              value={rawDataFilters.status || ''}
              onChange={(e) => setRawDataFilters({ ...rawDataFilters, status: e.target.value as any || undefined })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">所有状态</option>
              <option value="raw">原始</option>
              <option value="processed">已处理</option>
              <option value="error">错误</option>
            </select>

            <button
              onClick={() => setRawDataFilters({})}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              清除过滤
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-slate-50">
              <tr>
                <th className="w-56 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位标题</th>
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">公司名称</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">工作类型</th>
                <th className="w-48 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">地点</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">来源</th>
                <th className="w-16 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">精选</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">发布时间</th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    状态
                    <Tooltip
                      content={'原始：尚未解析或标准化\n已处理：解析完成并入库\n错误：解析或入库失败'}
                      maxLines={6}
                      clampChildren={false}
                      trigger="click"
                      forceShow
                    >
                      <Info className="w-3 h-3 text-slate-400 cursor-pointer" />
                    </Tooltip>
                  </span>
                </th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">薪资</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rawData.map((item) => {
                const parsed = parseRawContent(item.rawContent || '{}');
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        <Tooltip content={item.title} maxLines={3}>
                          <div className="font-medium text-slate-900">
                            {item.title}
                          </div>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        {parsed.company ? (
                          <Tooltip content={parsed.company} maxLines={3}>
                            <div className="font-medium text-slate-900">
                              {parsed.company}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      {parsed.jobType || parsed.type ? (
                        <Tooltip content={parsed.jobType || parsed.type} maxLines={1} clampChildren={false}>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                            {parsed.jobType || parsed.type}
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        {parsed.location || parsed.region ? (
                          <Tooltip content={parsed.location || parsed.region} maxLines={3}>
                            <div className="text-sm text-slate-900">
                              {parsed.location || parsed.region}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Tooltip content={item.source} maxLines={1} clampChildren={false}>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                          {item.source}
                        </span>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2 text-sm text-slate-500">
                      <Tooltip content={item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '-'} maxLines={1}>
                        <span>
                          {item.pubDate ? new Date(item.pubDate).toLocaleDateString() : '-'}
                        </span>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      <Tooltip content={
                        item.status === 'processed' ? '已处理' :
                          item.status === 'error' ? '错误' : '原始'
                      } maxLines={1} clampChildren={false}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${item.status === 'processed' ? 'bg-green-100 text-green-800' :
                          item.status === 'error' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                          {item.status === 'processed' ? '已处理' :
                            item.status === 'error' ? '错误' : '原始'}
                        </span>
                      </Tooltip>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetail(item)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          详情
                        </button>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                        >
                          <ExternalLink className="w-3 h-3" />
                          链接
                        </a>
                      </div>
                    </td>
                    {/* 薪资（移动到最后一列） */}
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        {parsed.salary ? (
                          <Tooltip content={parsed.salary} maxLines={3}>
                            <div className="text-green-600 font-medium text-sm">
                              {parsed.salary}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-sm text-slate-500">
            显示 {((rawDataPage - 1) * rawDataPageSize) + 1} 到 {Math.min(rawDataPage * rawDataPageSize, rawDataTotal)} 条，共 {rawDataTotal} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRawDataPage(Math.max(1, rawDataPage - 1))}
              disabled={rawDataPage === 1}
              className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm">
              第 {rawDataPage} 页，共 {Math.ceil(rawDataTotal / rawDataPageSize)} 页
            </span>
            <button
              onClick={() => setRawDataPage(rawDataPage + 1)}
              disabled={rawDataPage >= Math.ceil(rawDataTotal / rawDataPageSize)}
              className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProcessedDataTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* 过滤器 */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">过滤条件：</span>
            </div>

            <select
              value={processedDataFilters.category || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, category: e.target.value as JobCategory || undefined })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">所有分类</option>
              {availableCategories.length > 0 ? availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              )) : (
                <>
                  <option value="前端开发">前端开发</option>
                  <option value="后端开发">后端开发</option>
                  <option value="全栈开发">全栈开发</option>
                  <option value="产品经理">产品经理</option>
                  <option value="UI/UX设计">UI/UX设计</option>
                  <option value="数据分析">数据分析</option>
                  <option value="运营">运营</option>
                  <option value="市场营销">市场营销</option>
                  <option value="其他">其他</option>
                </>
              )}
            </select>

            <select
              value={processedDataFilters.isFeatured === undefined ? '' : processedDataFilters.isFeatured.toString()}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, isFeatured: e.target.value === '' ? undefined : e.target.value === 'true' })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">所有岗位</option>
              <option value="true">精选岗位</option>
              <option value="false">非精选</option>
            </select>

            <select
              value={processedDataFilters.industry || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, industry: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">所有行业</option>
              <option value="互联网/软件">互联网/软件</option>
              <option value="企业服务/SaaS">企业服务/SaaS</option>
              <option value="人工智能">人工智能</option>
              <option value="大健康/医疗">大健康/医疗</option>
              <option value="教育">教育</option>
              <option value="金融/Fintech">金融/Fintech</option>
              <option value="Web3/区块链">Web3/区块链</option>
              <option value="电子商务">电子商务</option>
              <option value="游戏">游戏</option>
              <option value="媒体/娱乐">媒体/娱乐</option>
              <option value="硬件/物联网">硬件/物联网</option>
              <option value="消费生活">消费生活</option>
            </select>

            {/* 来源筛选 */}
            <select
              value={processedDataFilters.source || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, source: e.target.value || undefined })}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-40"
            >
              <option value="">所有来源</option>
              <option value="WeWorkRemotely">WeWorkRemotely</option>
              <option value="Remotive">Remotive</option>
              <option value="Himalayas">Himalayas</option>
              <option value="NoDesk">NoDesk</option>
              <option value="special:official">企业官网/认证企业</option>
              <option value="special:manual">人工录入</option>
            </select>

            <input
              type="text"
              placeholder="搜索岗位名称或公司..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />

            <button
              onClick={() => setProcessedDataFilters({})}
              className="px-3 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              清除过滤
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddJob()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              新增职位
            </button>
          </div>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-56 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位名称</th>
              <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位分类</th>
              <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">行业</th>
              <th className="w-20 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位级别</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">企业名称</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位类型</th>
              <th className="w-32 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">区域限制</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">区域分类</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">技能标签</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">发布日期</th>
              <th className="w-28 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">岗位来源</th>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">精选</th>
              <th className="w-16 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">审核</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.length === 0 ? (
              <tr>
                <td colSpan={14} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <Database className="w-8 h-8 text-slate-300" />
                    <p>暂无数据</p>
                  </div>
                </td>
              </tr>
            ) : (
              processedData.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50">
                {/* 1. 岗位名称 */}
                <td className="px-3 py-2 w-56">
                  <Tooltip content={job.title} maxLines={3}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-slate-900 text-sm truncate">{job.title}</span>
                        {job.isFeatured && (
                          <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
                        )}
                      </div>
                      {(job as any).translations?.title && (
                        <span className="text-xs text-slate-600 italic truncate">
                          {(job as any).translations.title}
                        </span>
                      )}
                    </div>
                  </Tooltip>
                  {job.salary && (
                    <div className="text-xs text-green-600 mt-1 truncate">
                      {job.salary}
                    </div>
                  )}
                </td>

                {/* 2. 岗位分类 */}
                <td className="px-3 py-2 w-28">
                  <Tooltip content={job.category || '未分类'} maxLines={1} clampChildren={false}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs truncate ${job.category === '前端开发' ? 'bg-indigo-100 text-indigo-800' :
                      job.category === '后端开发' ? 'bg-green-100 text-green-800' :
                        job.category === '全栈开发' ? 'bg-purple-100 text-purple-800' :
                          job.category === 'UI/UX设计' ? 'bg-pink-100 text-pink-800' :
                            job.category === '数据分析' ? 'bg-yellow-100 text-yellow-800' :
                              job.category === '运维/SRE' ? 'bg-indigo-100 text-indigo-800' :
                                job.category === '产品经理' ? 'bg-orange-100 text-orange-800' :
                                  job.category === '市场营销' ? 'bg-red-100 text-red-800' :
                                    'bg-slate-100 text-slate-800'
                      }`}>
                      {job.category || '未分类'}
                    </span>
                  </Tooltip>
                </td>

                {/* 3. 行业 */}
                <td className="px-3 py-2 w-28 truncate">
                  <Tooltip content={job.industry || '-'} maxLines={1} clampChildren={false}>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-slate-100 text-slate-800 truncate">
                      {job.industry || '-'}
                    </span>
                  </Tooltip>
                </td>

                {/* 4. 岗位级别 */}
                <td className="px-3 py-2 w-20 truncate">
                  <Tooltip content={
                    job.experienceLevel === 'Entry' ? '初级' :
                      job.experienceLevel === 'Mid' ? '中级' :
                        job.experienceLevel === 'Senior' ? '高级' :
                          job.experienceLevel === 'Lead' ? '专家' :
                            job.experienceLevel === 'Executive' ? '管理层' : '未定义'
                  } maxLines={1} clampChildren={false}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs truncate ${job.experienceLevel === 'Entry' ? 'bg-green-100 text-green-800' :
                      job.experienceLevel === 'Mid' ? 'bg-indigo-100 text-indigo-800' :
                        job.experienceLevel === 'Senior' ? 'bg-orange-100 text-orange-800' :
                          job.experienceLevel === 'Lead' ? 'bg-red-100 text-red-800' :
                            job.experienceLevel === 'Executive' ? 'bg-purple-100 text-purple-800' :
                              'bg-slate-100 text-slate-800'
                      }`}>
                      {job.experienceLevel === 'Entry' ? '初级' :
                        job.experienceLevel === 'Mid' ? '中级' :
                          job.experienceLevel === 'Senior' ? '高级' :
                            job.experienceLevel === 'Lead' ? '专家' :
                              job.experienceLevel === 'Executive' ? '管理层' : '未定义'}
                    </span>
                  </Tooltip>
                </td>

                {/* 5. 企业名称 */}
                <td className="px-3 py-2 w-40 truncate">
                  <Tooltip content={job.company} maxLines={3}>
                    <div className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400 flex-shrink-0" />
                      <span className="font-medium text-slate-900 text-sm truncate">{job.company}</span>
                    </div>
                  </Tooltip>
                  {job.companyWebsite && (
                    <a
                      href={job.companyWebsite}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs mt-1 truncate"
                    >
                      <ExternalLink className="w-2 h-2" />
                      企业官网
                    </a>
                  )}
                </td>

                {/* 6. 岗位类型 */}
                <td className="px-3 py-2 w-24 truncate">
                  {(() => {
                    const normalizeJobType = (type: string | undefined): string => {
                      if (!type) return '未定义';
                      const lower = type.toLowerCase();
                      if (lower.includes('full') || lower === '全职') return '全职';
                      if (lower.includes('part') || lower === '兼职') return '兼职';
                      if (lower.includes('contract') || lower === '合同') return '合同工';
                      if (lower.includes('freelance') || lower === '自由') return '自由职业';
                      if (lower.includes('intern') || lower === '实习') return '实习';
                      return type;
                    };
                    const normalizedType = normalizeJobType(job.jobType);

                    return (
                      <Tooltip content={normalizedType} maxLines={1} clampChildren={false}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs truncate ${normalizedType === '全职' ? 'bg-green-100 text-green-800' :
                          normalizedType === '兼职' ? 'bg-indigo-100 text-indigo-800' :
                            normalizedType === '合同工' ? 'bg-orange-100 text-orange-800' :
                              normalizedType === '自由职业' ? 'bg-purple-100 text-purple-800' :
                                normalizedType === '实习' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-slate-100 text-slate-800'
                          }`}>
                          {normalizedType}
                        </span>
                      </Tooltip>
                    );
                  })()}
                </td>

                {/* 7. 区域限制 (对应 DB location) */}
                <td className="px-3 py-2 w-32 truncate">
                  <Tooltip content={job.location || '不限地点'} maxLines={3} clampChildren={false}>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2 h-2 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-600 truncate">
                        {job.location || '不限地点'}
                      </span>
                    </div>
                  </Tooltip>
                </td>

                {/* 8. 区域分类 (对应 DB region) */}
                <td className="px-3 py-2 w-24 truncate">
                  {(() => {
                    const r = job.region;
                    const label = r === 'domestic' ? '国内' : r === 'overseas' ? '海外' : '未分类';
                    const cls = r === 'domestic'
                      ? 'bg-indigo-100 text-indigo-800'
                      : r === 'overseas'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-800';
                    return (
                      <Tooltip content={label} maxLines={1} clampChildren={false}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs truncate ${cls}`}>
                          {label}
                        </span>
                      </Tooltip>
                    );
                  })()}
                </td>

                {/* 9. 技能标签 (对应 DB tags) */}
                <td className="px-3 py-2 w-40 truncate">
                  <Tooltip content={job.tags?.join(', ') || '无标签'} maxLines={2} clampChildren={false}>
                    <div className="flex flex-wrap gap-1">
                      {job.tags?.slice(0, 2).map((tag, index) => (
                        <span key={index} className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-slate-100 text-slate-700 truncate max-w-full">
                          {tag}
                        </span>
                      ))}
                      {job.tags && job.tags.length > 2 && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                          +{job.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </td>

                {/* 10. 发布日期 (对应 DB published_at) */}
                <td className="px-3 py-2 text-xs text-slate-500 w-24">
                  <Tooltip content={new Date(job.publishedAt).toLocaleDateString()} maxLines={1} clampChildren={false}>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-2 h-2 flex-shrink-0" />
                      <span className="truncate">
                        {new Date(job.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Tooltip>
                </td>

                {/* 11. 岗位来源 (对应 DB source) */}
                <td className="px-3 py-2 w-28">
                  <Tooltip content={job.source} maxLines={1} clampChildren={false}>
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 truncate">
                        {job.source}
                      </span>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs truncate"
                      >
                        <LinkIcon className="w-2 h-2" />
                        链接
                      </a>
                    </div>
                  </Tooltip>
                </td>

                {/* 12. 精选 (对应 DB is_featured) */}
                <td className="px-3 py-2 w-16 text-center">
                  {job.isFeatured ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-yellow-100 text-yellow-600" title="精选岗位">
                      <Star className="w-4 h-4 fill-current" />
                    </span>
                  ) : (
                    <span className="text-slate-300">-</span>
                  )}
                </td>

                {/* 13. 审核 (对应 DB is_approved) */}
                <td className="px-3 py-2 w-16 text-center">
                  {(job as any).isApproved ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600" title="已审核通过">
                      <CheckCircle className="w-4 h-4" />
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400" title="待审核">
                      <Info className="w-4 h-4" />
                    </span>
                  )}
                </td>

                {/* 14. 操作 */}
                <td className="px-3 py-2 w-24">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewDetail(job)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEditJob(job)}
                      className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>


      {/* 分页 */}
      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          显示 {((processedDataPage - 1) * processedDataPageSize) + 1} 到 {Math.min(processedDataPage * processedDataPageSize, processedDataTotal)} 条，共 {processedDataTotal} 条
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProcessedDataPage(Math.max(1, processedDataPage - 1))}
            disabled={processedDataPage === 1}
            className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            上一页
          </button>

          {(() => {
            const totalPages = Math.ceil(processedDataTotal / processedDataPageSize);
            const maxVisiblePages = 5;
            const pages = [];

            if (totalPages <= maxVisiblePages) {
              for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
              }
            } else {
              if (processedDataPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push(-1); // Ellipsis
                pages.push(totalPages);
              } else if (processedDataPage >= totalPages - 2) {
                pages.push(1);
                pages.push(-1); // Ellipsis
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                pages.push(-1);
                pages.push(processedDataPage - 1);
                pages.push(processedDataPage);
                pages.push(processedDataPage + 1);
                pages.push(-1);
                pages.push(totalPages);
              }
            }

            return pages.map((p, i) => (
              p === -1 ? (
                <span key={`ellipsis-${i}`} className="px-2 text-slate-400">...</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setProcessedDataPage(p)}
                  className={`px-3 py-1 text-sm border rounded-lg transition-colors ${processedDataPage === p
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}
                >
                  {p}
                </button>
              )
            ));
          })()}

          <button
            onClick={() => setProcessedDataPage(processedDataPage + 1)}
            disabled={processedDataPage >= Math.ceil(processedDataTotal / processedDataPageSize)}
            className="px-3 py-1 text-sm border border-slate-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );

  const renderStorageStats = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {storageStats && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-indigo-100 rounded-lg">
                <Database className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{storageStats.totalRawData}</div>
                <div className="text-sm text-slate-500">原始数据条数</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">{storageStats.totalProcessedJobs}</div>
                <div className="text-sm text-slate-500">处理后职位</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Server className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-900">
                  {(storageStats.storageSize / 1024 / 1024).toFixed(2)} MB
                </div>
                <div className="text-sm text-slate-500">存储大小</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {renderTabButton('processed', '处理后数据', <Briefcase className="w-4 h-4" />)}
          {renderTabButton('raw', '原始数据', <Database className="w-4 h-4" />)}
          {renderTabButton('storage', '存储统计', <BarChart3 className="w-4 h-4" />)}
        </div>

        <div className="flex gap-2">
          {activeTab === 'raw' && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoProcess}
                  onChange={(e) => setAutoProcess(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                自动处理为岗位
              </label>
              <button
                onClick={handleSyncData}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中...' : '同步数据'}
              </button>
            </div>
          )}
          {activeTab === 'processed' && (
            <div className="flex gap-2 items-center">
              <Tooltip content={
                <div className="text-left space-y-2">
                  <p className="font-semibold text-indigo-200">全量数据清洗逻辑：</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li><span className="font-medium text-white">同步数据：</span>拉取最新的 RSS 订阅源数据。</li>
                    <li><span className="font-medium text-white">正则清洗：</span>对全库（含爬虫）最近 200 条职位进行快速正则处理（提取地点、薪资、分类）。</li>
                    <li><span className="font-medium text-white">AI 深度优化：</span>筛选出 20 个“疑难杂症”职位（优先处理地点/薪资缺失），调用 DeepSeek/Bailian 大模型进行深度解析和 JD 格式化。</li>
                    <li><span className="font-medium text-white">数据清理：</span>自动移除过期的历史数据。</li>
                  </ol>
                  <p className="text-xs text-slate-400 mt-2 border-t border-slate-600 pt-2">
                    💡 建议每天点击一次，持续优化数据库质量。AI 处理成本较高，每次仅处理少量高价值数据。
                  </p>
                </div>
              } maxLines={20} clampChildren={false} forceShow>
                <HelpCircle className="w-4 h-4 text-slate-400 cursor-help" />
              </Tooltip>
              <button
                onClick={handleRefreshProcessedOnly}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '刷新中...' : '刷新处理后数据'}
              </button>
              {syncing && syncStatusText && (
                <span className="text-xs text-indigo-600 animate-pulse hidden md:inline-block">{syncStatusText}</span>
              )}
            </div>
          )}
          {/* 按需：导出数据按钮已移除 */}
        </div>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-indigo-600" />
          <span className="ml-2 text-slate-600">加载中...</span>
        </div>
      ) : (
        <>
          {activeTab === 'raw' && renderRawDataTable()}
          {activeTab === 'processed' && renderProcessedDataTable()}
          {activeTab === 'storage' && renderStorageStats()}
        </>
      )}

      {/* 编辑模态框 */}
      {showEditModal && editingJob && (
        <EditJobModal
          job={editingJob}
          availableCategories={availableCategories}
          availableTags={availableTags}
          onSave={handleSaveEdit}
          onClose={() => {
            setShowEditModal(false);
            setEditingJob(null);
          }}
          onNavigate={handleNavigate}
          hasPrev={(activeTab === 'processed' ? processedData : rawData).findIndex(i => i.id === editingJob.id) > 0}
          hasNext={(activeTab === 'processed' ? processedData : rawData).findIndex(i => i.id === editingJob.id) < (activeTab === 'processed' ? processedData : rawData).length - 1}
        />
      )}

      {/* 详情模态框 */}
      {showDetailModal && viewingItem && (
        <DetailModal
          item={viewingItem}
          onClose={() => {
            setShowDetailModal(false);
            setViewingItem(null);
          }}
          onToggleFeatured={activeTab === 'processed' ? handleToggleFeatured : undefined}
          onNavigate={handleNavigate}
          hasPrev={(activeTab === 'processed' ? processedData : rawData).findIndex(i => i.id === viewingItem.id) > 0}
          hasNext={(activeTab === 'processed' ? processedData : rawData).findIndex(i => i.id === viewingItem.id) < (activeTab === 'processed' ? processedData : rawData).length - 1}
        />
      )}

      {/* 简历详情弹框：已迁移至独立页面 */}
    </div>
  );
};

// 编辑职位模态框组件
const EditJobModal: React.FC<{
  job: ProcessedJobData;
  onSave: (updatedJob: Partial<ProcessedJobData>) => void;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  availableCategories?: string[];
  availableTags?: string[];
}> = ({ job, onSave, onClose, onNavigate, hasPrev, hasNext, availableCategories = [], availableTags = [] }) => {
  const [formData, setFormData] = useState({
    title: job.title,
    company: job.company,
    location: job.location,
    salary: job.salary || '',
    jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
    experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
    category: job.category,
    description: job.description,
    tags: job.tags?.join(', ') || '',
    requirements: job.requirements?.join('\n') || '',
    benefits: job.benefits?.join('\n') || '',
    region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
    isFeatured: job.isFeatured || false,
    isApproved: (job as any).isApproved || false
  });

  // 监听job变化，更新表单数据 (当导航切换时)
  useEffect(() => {
    setFormData({
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary || '',
      jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
      experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
      category: job.category,
      description: job.description,
      tags: job.tags?.join(', ') || '',
      requirements: job.requirements?.join('\n') || '',
      benefits: job.benefits?.join('\n') || '',
      region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
      isFeatured: job.isFeatured || false,
      isApproved: (job as any).isApproved || false
    });
  }, [job]);

  // 监听键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onNavigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      requirements: formData.requirements.split('\n').filter(Boolean),
      benefits: formData.benefits.split('\n').filter(Boolean)
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900">编辑职位信息</h2>
              {/* 导航按钮 */}
              {onNavigate && (
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('prev')}
                    disabled={!hasPrev}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="上一条 (←)"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => onNavigate('next')}
                    disabled={!hasNext}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="下一条 (→)"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Approval Action Bar */}
          <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.isApproved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                {formData.isApproved ? <CheckCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {formData.isApproved ? '已通过审核' : '待审核'}
                </h3>
                <p className="text-sm text-slate-500">
                  {formData.isApproved ? '该岗位已对外展示' : '该岗位尚未通过人工审核，仅管理员可见'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newStatus = !formData.isApproved;
                setFormData(prev => ({ ...prev, isApproved: newStatus }));
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                formData.isApproved 
                  ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              }`}
            >
              {formData.isApproved ? '撤销审核' : '通过审核'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位名称</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">企业名称</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">工作地点</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">薪资</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: $80,000 - $120,000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位类型</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
                <option value="contract">合同</option>
                <option value="freelance">自由职业</option>
                <option value="internship">实习</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">区域分类</label>
              <select
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: (e.target.value || undefined) as 'domestic' | 'overseas' | undefined })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">未设置</option>
                <option value="domestic">国内</option>
                <option value="overseas">海外</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位级别</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Entry">初级</option>
                <option value="Mid">中级</option>
                <option value="Senior">高级</option>
                <option value="Lead">专家</option>
                <option value="Executive">管理层</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {/* Dynamically populated categories or fallback */}
                {availableCategories.length > 0 ? (
                  availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))
                ) : (
                  <>
                    <option value="全栈开发">全栈开发</option>
                    <option value="前端开发">前端开发</option>
                    <option value="后端开发">后端开发</option>
                    <option value="UI/UX设计">UI/UX设计</option>
                    <option value="数据分析">数据分析</option>
                    <option value="DevOps">DevOps</option>
                    <option value="产品管理">产品管理</option>
                    <option value="市场营销">市场营销</option>
                  </>
                )}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">设为精选岗位 (Featured)</span>
                <Star className={`w-4 h-4 ${formData.isFeatured ? 'text-yellow-500 fill-current' : 'text-slate-400'}`} />
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">技能标签（用逗号分隔）</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如: React, TypeScript, Node.js"
                />
                {availableTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-500 flex items-center">推荐标签:</span>
                    {availableTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
                          if (!currentTags.includes(tag)) {
                            const newTags = [...currentTags, tag].join(', ');
                            setFormData({ ...formData, tags: newTags });
                          }
                        }}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs rounded transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              {(job as any).translations?.description && (
                <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2 text-indigo-800 font-medium">
                    <span className="text-xs bg-indigo-200 px-2 py-0.5 rounded text-indigo-800">中文翻译 (参考)</span>
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {(job as any).translations.description}
                  </div>
                </div>
              )}
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位要求（每行一个）</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如:&#10;3+ years React experience&#10;TypeScript proficiency"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">福利待遇（每行一个）</label>
              <textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如:&#10;Remote work&#10;Health insurance"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-6 border-t border-slate-200">
            <button
              type="submit"
              className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              保存更改
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-200 text-slate-800 py-2 px-4 rounded-lg hover:bg-slate-300 transition-colors"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 悬浮提示组件
const Tooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactNode;
  maxLines?: number;
  clampChildren?: boolean; // 为包含徽章/图标的内容关闭多行截断
  trigger?: 'hover' | 'click';
  forceShow?: boolean; // 不依赖溢出检测，强制允许显示
  usePortal?: boolean; // 使用 Portal 渲染，避免被表格/容器裁剪
}> = ({ content, children, maxLines = 3, clampChildren = true, trigger = 'hover', forceShow = false, usePortal }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [shouldShowTooltip, setShouldShowTooltip] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const usePortalResolved = typeof usePortal === 'boolean' ? usePortal : (trigger === 'click');

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;

    const checkOverflow = () => {
      if (!clampChildren) {
        // 不对徽章/图标内容做截断与 Tooltip
        setShouldShowTooltip(false);
        return;
      }
      const verticalOverflow = el.scrollHeight > el.clientHeight + 1;
      const horizontalOverflow = el.scrollWidth > el.clientWidth + 1;
      setShouldShowTooltip(verticalOverflow || horizontalOverflow);
    };

    // 初始检测
    checkOverflow();

    // 响应尺寸变化（字体或容器变动）
    let ro: any = null;
    const RO = (window as any).ResizeObserver;
    if (typeof RO === 'function') {
      ro = new RO(checkOverflow);
      ro.observe(el);
    } else {
      // 备用方案：在下一帧再次检测一次
      requestAnimationFrame(checkOverflow);
    }

    return () => {
      if (ro) ro.disconnect();
    };
  }, [content, maxLines, clampChildren]);

  // 计算并更新 Portal 模式下的位置
  const updatePosition = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const maxWidth = 360; // 与样式的 max-w-sm 接近
    const placement = rect.top > 120 ? 'top' : 'bottom';
    const left = Math.min(Math.max(rect.left, 8), viewportWidth - maxWidth - 8);
    const top = placement === 'top' ? rect.top - margin : rect.bottom + margin;
    setCoords({ top, left, placement });
  }, []);

  useEffect(() => {
    if (!usePortalResolved) return;
    if (!showTooltip) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [showTooltip, usePortalResolved, updatePosition]);

  // 点击模式：点击外部关闭
  useEffect(() => {
    if (trigger !== 'click') return;
    const handleDocClick = (e: MouseEvent) => {
      const el = textRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, [trigger]);

  const handleClick = () => {
    if (trigger === 'click') {
      setShowTooltip((prev) => !prev);
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={trigger === 'hover' ? (() => shouldShowTooltip && setShowTooltip(true)) : undefined}
      onMouseLeave={trigger === 'hover' ? (() => setShowTooltip(false)) : undefined}
      onClick={trigger === 'click' ? handleClick : undefined}
    >
      <div
        ref={textRef}
        className={clampChildren ? 'overflow-hidden text-ellipsis' : ''}
        style={clampChildren ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          lineHeight: '1.6em',
          maxHeight: `${maxLines * 1.6}em`
        } : undefined}
      >
        {children}
      </div>
      {showTooltip && (shouldShowTooltip || forceShow) && (
        usePortalResolved && coords
          ? createPortal(
            <div
              style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 1000 }}
              className={`p-3 bg-slate-900 text-white text-sm rounded-lg shadow-lg max-w-sm ${coords.placement === 'top' ? '' : ''}`}
            >
              <div className="whitespace-pre-wrap break-words">{content}</div>
              {coords.placement === 'top' ? (
                <div className="absolute" style={{ top: '100%', left: '16px' }}>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                </div>
              ) : (
                <div className="absolute" style={{ bottom: '100%', left: '16px' }}>
                  <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900"></div>
                </div>
              )}
            </div>,
            document.body
          )
          : (
            <div className="absolute z-50 p-3 bg-slate-900 text-white text-sm rounded-lg shadow-lg max-w-sm -top-2 left-0 transform -translate-y-full">
              <div className="whitespace-pre-wrap break-words">{content}</div>
              <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
            </div>
          )
      )}
    </div>
  );
};

// 详情模态框组件
const DetailModal: React.FC<{
  item: RawRSSData | ProcessedJobData;
  onClose: () => void;
  onToggleFeatured?: (id: string, currentStatus: boolean) => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}> = ({ item, onClose, onToggleFeatured, onNavigate, hasPrev, hasNext }) => {
  const isProcessedJob = 'rawDataId' in item;
  const processedJob = isProcessedJob ? (item as ProcessedJobData) : null;

  // 监听键盘事件支持左右键切换
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onNavigate]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="p-6 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900">
                {isProcessedJob ? '处理后数据详情' : '原始数据详情'}
              </h2>
              {/* 导航按钮 */}
              {onNavigate && (
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    onClick={() => onNavigate('prev')}
                    disabled={!hasPrev}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="上一条 (←)"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button
                    onClick={() => onNavigate('next')}
                    disabled={!hasNext}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="下一条 (→)"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* 精选按钮 */}
              {isProcessedJob && onToggleFeatured && (
                <button
                  onClick={() => onToggleFeatured(item.id, !!processedJob?.isFeatured)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors ${processedJob?.isFeatured
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Star className={`w-4 h-4 ${processedJob?.isFeatured ? 'fill-current' : ''}`} />
                  <span className="text-sm font-medium">{processedJob?.isFeatured ? '已精选' : '设为精选'}</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {isProcessedJob ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">基本信息</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">岗位名称:</span> {item.title}</div>
                    <div><span className="font-medium">企业名称:</span> {item.company}</div>
                    <div><span className="font-medium">工作地点:</span> {item.location}</div>
                    <div><span className="font-medium">薪资:</span> {item.salary || '未提供'}</div>
                    <div><span className="font-medium">岗位类型:</span> {item.jobType}</div>
                    <div><span className="font-medium">经验等级:</span> {item.experienceLevel}</div>
                    <div><span className="font-medium">岗位分类:</span> {item.category}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-slate-900 mb-2">其他信息</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">来源:</span> {item.source}</div>
                    <div><span className="font-medium">发布时间:</span> {new Date(item.publishedAt).toLocaleString()}</div>
                    <div><span className="font-medium">是否远程:</span> {item.isRemote ? '是' : '否'}</div>
                    <div><span className="font-medium">状态:</span> {item.status}</div>
                    <div><span className="font-medium">是否手动编辑:</span> {item.isManuallyEdited ? '是' : '否'}</div>
                  </div>
                </div>
              </div>

              {item.tags && item.tags.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">技能标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.description && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">岗位描述</h3>

                  {/* 翻译内容展示 */}
                  {(item as any).translations?.description && (
                    <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2 text-indigo-800 font-medium">
                        <span className="text-xs bg-indigo-200 px-2 py-0.5 rounded text-indigo-800">中文翻译</span>
                      </div>
                      <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                        {(item as any).translations.description}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg">
                    {item.description}
                  </div>
                </div>
              )}

              {item.requirements && item.requirements.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">岗位要求</h3>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {item.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-indigo-600 mt-1">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.benefits && item.benefits.length > 0 && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">福利待遇</h3>
                  <ul className="text-sm text-slate-700 space-y-1">
                    {item.benefits.map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-green-600 mt-1">•</span>
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">基本信息</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">标题:</span> {item.title}</div>
                    <div><span className="font-medium">来源:</span> {item.source}</div>
                    <div><span className="font-medium">分类:</span> {item.category}</div>
                    <div><span className="font-medium">状态:</span> {item.status}</div>
                    <div><span className="font-medium">获取时间:</span> {new Date(item.fetchedAt).toLocaleString()}</div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium text-slate-900 mb-2">链接</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">原文链接:</span>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800">
                        查看原文
                      </a>
                    </div>
                    <div>
                      <span className="font-medium">RSS URL:</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-indigo-600 hover:text-indigo-800 break-all">
                        {item.url}
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {item.description && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">描述内容</h3>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    {item.description}
                  </div>
                </div>
              )}

              {item.rawContent && (
                <div>
                  <h3 className="font-medium text-slate-900 mb-2">原始内容</h3>
                  <div className="text-xs text-slate-600 bg-slate-50 p-4 rounded-lg max-h-60 overflow-y-auto font-mono">
                    {item.rawContent}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// 简历详情弹框组件已迁移至独立页面

export default DataManagementTabs;
