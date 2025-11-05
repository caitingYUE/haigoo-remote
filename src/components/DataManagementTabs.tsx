import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Upload, 
  Trash2, 
  Edit3, 
  Eye, 
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Briefcase,
  Globe,
  Database,
  Settings,
  AlertCircle,
  Info,
  Loader,
  Plus,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  BarChart3,
  PieChart,
  Activity,
  Rss,
  Tag,
  Calendar,
  Server,
  ExternalLink,
  Building,
  MapPin,
  DollarSign,
  FileText,
  Link as LinkIcon,
  FolderOpen
} from 'lucide-react';
import { Job, JobFilter, JobStats, SyncStatus, JobCategory, RSSSource } from '../types/rss-types';
import { dataManagementService, RawRSSData, ProcessedJobData, StorageStats } from '../services/data-management-service';
import { useNotificationHelpers } from './NotificationSystem';
// 简历库相关逻辑已迁移至独立页面

interface DataManagementTabsProps {
  className?: string;
}

const DataManagementTabs: React.FC<DataManagementTabsProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'raw' | 'processed' | 'storage'>('processed');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
  }>({});
  
  // 编辑状态
  const [editingJob, setEditingJob] = useState<ProcessedJobData | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<RawRSSData | ProcessedJobData | null>(null);

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
  
  // 同步数据
  const handleSyncData = async () => {
    try {
      setSyncing(true);
      await dataManagementService.syncAllRSSData();
      // 重新加载所有相关数据，确保两个页签都更新
      await loadRawData();
      await loadProcessedData();
      await loadStorageStats();
      showSuccess('同步完成', '已拉取最新RSS并更新原始与处理后数据');
    } catch (error) {
      console.error('同步数据失败:', error);
      showError('同步失败', '请检查后端服务或网络连接');
    } finally {
      setSyncing(false);
    }
  };

  // 手动刷新处理后数据（仅拉取RSS并更新“处理后数据”）
  const handleRefreshProcessedOnly = async () => {
    try {
      setSyncing(true);
      await dataManagementService.syncAllRSSData();
      await loadProcessedData();
      await loadStorageStats();
      showSuccess('刷新完成', '处理后数据已更新至最新');
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
  const handleExportData = async (type: 'raw' | 'processed') => {
    try {
      let data;
      if (type === 'raw') {
        const result = await dataManagementService.getRawData(1, 10000);
        data = result.data;
      } else {
        const result = await dataManagementService.getProcessedJobs(1, 10000);
        data = result.data;
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_data_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出数据失败:', error);
    }
  };
  
  // 删除职位
  const handleDeleteJob = async (jobId: string) => {
    if (!confirm('确定要删除这个职位吗？此操作不可撤销。')) {
      return;
    }
    
    try {
      await dataManagementService.deleteProcessedJob(jobId);
      await loadProcessedData();
    } catch (error) {
      console.error('删除职位失败:', error);
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
      if (editingJob.id) {
        // 更新现有职位
        await dataManagementService.updateProcessedJob(editingJob.id, updatedJob, 'admin');
      } else {
        // 新增职位 - 直接通过加载和保存来实现
        const allJobs = await dataManagementService.getProcessedJobs(1, 10000); // 获取所有职位
        const newJob: ProcessedJobData = {
          ...editingJob,
          ...updatedJob,
          id: `manual_${Date.now()}`, // 生成唯一ID
        } as ProcessedJobData;
        
        // 将新职位添加到现有职位列表中
        const updatedJobs = [newJob, ...allJobs.data];
        
        // 这里需要调用私有方法，暂时使用localStorage作为fallback
        if (typeof window !== 'undefined') {
          localStorage.setItem('processed_jobs_data', JSON.stringify(updatedJobs));
        }
      }
      setShowEditModal(false);
      setEditingJob(null);
      await loadProcessedData();
    } catch (error) {
      console.error('保存职位失败:', error);
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
      className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 ${
        activeTab === tabKey
          ? 'bg-blue-600 text-white shadow-lg'
          : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* 过滤器 */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">过滤条件：</span>
            </div>
            
            <select
              value={rawDataFilters.source || ''}
              onChange={(e) => setRawDataFilters({ ...rawDataFilters, source: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有状态</option>
              <option value="raw">原始</option>
              <option value="processed">已处理</option>
              <option value="error">错误</option>
            </select>
            
            <button
              onClick={() => setRawDataFilters({})}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              清除过滤
            </button>
          </div>
        </div>

        {/* 表格 */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-56 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位标题</th>
                <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">公司名称</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">工作类型</th>
                <th className="w-48 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">地点</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">来源</th>
                <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发布时间</th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span className="inline-flex items-center gap-1">
                    状态
                    <Tooltip 
                      content={'原始：尚未解析或标准化\n已处理：解析完成并入库\n错误：解析或入库失败'} 
                      maxLines={6} 
                      clampChildren={false} 
                      trigger="click" 
                      forceShow
                    >
                      <Info className="w-3 h-3 text-gray-400 cursor-pointer" />
                    </Tooltip>
                  </span>
                </th>
                <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">薪资</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rawData.map((item) => {
                const parsed = parseRawContent(item.rawContent || '{}');
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        <Tooltip content={item.title} maxLines={3}>
                          <div className="font-medium text-gray-900">
                            {item.title}
                          </div>
                        </Tooltip>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        {parsed.company ? (
                          <Tooltip content={parsed.company} maxLines={3}>
                            <div className="font-medium text-gray-900">
                              {parsed.company}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
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
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="max-w-xs">
                        {parsed.location || parsed.region ? (
                          <Tooltip content={parsed.location || parsed.region} maxLines={3}>
                            <div className="text-sm text-gray-900">
                              {parsed.location || parsed.region}
                            </div>
                          </Tooltip>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
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
                    <td className="px-3 py-2 text-sm text-gray-500">
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
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          item.status === 'processed' ? 'bg-green-100 text-green-800' :
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
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
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
                          <span className="text-gray-400 text-sm">-</span>
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
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            显示 {((rawDataPage - 1) * rawDataPageSize) + 1} 到 {Math.min(rawDataPage * rawDataPageSize, rawDataTotal)} 条，共 {rawDataTotal} 条
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRawDataPage(Math.max(1, rawDataPage - 1))}
              disabled={rawDataPage === 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="px-3 py-1 text-sm">
              第 {rawDataPage} 页，共 {Math.ceil(rawDataTotal / rawDataPageSize)} 页
            </span>
            <button
              onClick={() => setRawDataPage(rawDataPage + 1)}
              disabled={rawDataPage >= Math.ceil(rawDataTotal / rawDataPageSize)}
              className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProcessedDataTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      {/* 过滤器 */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">过滤条件：</span>
            </div>
            
            <select
              value={processedDataFilters.category || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, category: e.target.value as JobCategory || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有分类</option>
              <option value="全栈开发">全栈开发</option>
              <option value="前端开发">前端开发</option>
              <option value="后端开发">后端开发</option>
              <option value="UI/UX设计">UI/UX设计</option>
              <option value="数据分析">数据分析</option>
              <option value="DevOps">DevOps</option>
              <option value="产品管理">产品管理</option>
              <option value="市场营销">市场营销</option>
            </select>
            
            <select
              value={processedDataFilters.experienceLevel || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, experienceLevel: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">所有级别</option>
              <option value="Entry">初级</option>
              <option value="Mid">中级</option>
              <option value="Senior">高级</option>
              <option value="Lead">专家</option>
              <option value="Executive">管理层</option>
            </select>
            
            <input
              type="text"
              placeholder="搜索岗位名称或公司..."
              value={processedDataFilters.search || ''}
              onChange={(e) => setProcessedDataFilters({ ...processedDataFilters, search: e.target.value || undefined })}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            
            <button
              onClick={() => setProcessedDataFilters({})}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              清除过滤
            </button>
          </div>
          
          <button
            onClick={() => handleAddJob()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新增职位
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-56 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位名称</th>
              <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位分类</th>
              <th className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位级别</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">企业名称</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">行业类型</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位类型</th>
              <th className="w-32 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区域限制</th>
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">技能标签</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">语言要求</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">发布日期</th>
              <th className="w-28 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">岗位来源</th>
              <th className="w-24 px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {processedData.map((job) => (
              <tr key={job.id} className="hover:bg-gray-50">
                {/* 岗位名称 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.title} maxLines={3}>
                    <div className="font-medium text-gray-900 text-sm">
                      {job.title}
                    </div>
                  </Tooltip>
                  {job.salary && (
                    <div className="text-xs text-green-600 mt-1">
                      {job.salary}
                    </div>
                  )}
                </td>
                
                {/* 岗位分类 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.category || '未分类'} maxLines={1} clampChildren={false}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      job.category === '前端开发' ? 'bg-blue-100 text-blue-800' :
                      job.category === '后端开发' ? 'bg-green-100 text-green-800' :
                      job.category === '全栈开发' ? 'bg-purple-100 text-purple-800' :
                      job.category === 'UI/UX设计' ? 'bg-pink-100 text-pink-800' :
                      job.category === '数据分析' ? 'bg-yellow-100 text-yellow-800' :
                      job.category === 'DevOps' ? 'bg-indigo-100 text-indigo-800' :
                      job.category === '产品管理' ? 'bg-orange-100 text-orange-800' :
                      job.category === '市场营销' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.category || '未分类'}
                    </span>
                  </Tooltip>
                </td>
                
                {/* 岗位级别 */}
                <td className="px-3 py-2">
                  <Tooltip content={
                    job.experienceLevel === 'Entry' ? '初级' :
                    job.experienceLevel === 'Mid' ? '中级' :
                    job.experienceLevel === 'Senior' ? '高级' :
                    job.experienceLevel === 'Lead' ? '专家' :
                    job.experienceLevel === 'Executive' ? '管理层' : '未定义'
                  } maxLines={1} clampChildren={false}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      job.experienceLevel === 'Entry' ? 'bg-green-100 text-green-800' :
                      job.experienceLevel === 'Mid' ? 'bg-blue-100 text-blue-800' :
                      job.experienceLevel === 'Senior' ? 'bg-orange-100 text-orange-800' :
                      job.experienceLevel === 'Lead' ? 'bg-red-100 text-red-800' :
                      job.experienceLevel === 'Executive' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.experienceLevel === 'Entry' ? '初级' :
                       job.experienceLevel === 'Mid' ? '中级' :
                       job.experienceLevel === 'Senior' ? '高级' :
                       job.experienceLevel === 'Lead' ? '专家' :
                       job.experienceLevel === 'Executive' ? '管理层' : '未定义'}
                    </span>
                  </Tooltip>
                </td>
                
                {/* 企业名称 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.company} maxLines={3}>
                    <div className="flex items-center gap-1">
                      <Building className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="font-medium text-gray-900 text-sm">{job.company}</span>
                    </div>
                  </Tooltip>
                  {job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs mt-1"
                    >
                      <ExternalLink className="w-2 h-2" />
                      详情
                    </a>
                  )}
                </td>
                
                {/* 行业类型 */}
                <td className="px-3 py-2">
                  <Tooltip content="未定义" maxLines={1}>
                    <span className="text-xs text-gray-600">
                      未定义
                    </span>
                  </Tooltip>
                </td>
                
                {/* 岗位类型 */}
                <td className="px-3 py-2">
                  <Tooltip content={
                    job.jobType === 'full-time' ? '全职' :
                    job.jobType === 'part-time' ? '兼职' :
                    job.jobType === 'contract' ? '合同' :
                    job.jobType === 'freelance' ? '自由职业' :
                    job.jobType === 'internship' ? '实习' : job.jobType || '未定义'
                  } maxLines={1} clampChildren={false}>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                      job.jobType === 'full-time' ? 'bg-green-100 text-green-800' :
                      job.jobType === 'part-time' ? 'bg-blue-100 text-blue-800' :
                      job.jobType === 'contract' ? 'bg-orange-100 text-orange-800' :
                      job.jobType === 'freelance' ? 'bg-purple-100 text-purple-800' :
                      job.jobType === 'internship' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {job.jobType === 'full-time' ? '全职' :
                       job.jobType === 'part-time' ? '兼职' :
                       job.jobType === 'contract' ? '合同' :
                       job.jobType === 'freelance' ? '自由职业' :
                       job.jobType === 'internship' ? '实习' : job.jobType || '未定义'}
                    </span>
                  </Tooltip>
                </td>
                
                {/* 区域限制 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.remoteLocationRestriction || job.location || '不限地点'} maxLines={3} clampChildren={false}>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-2 h-2 text-gray-400 flex-shrink-0" />
                      <span className="text-xs text-gray-600">
                        {job.remoteLocationRestriction || job.location || '不限地点'}
                      </span>
                    </div>
                  </Tooltip>
                </td>
                
                {/* 技能标签 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.tags?.join(', ') || '无标签'} maxLines={2} clampChildren={false}>
                    <div className="flex flex-wrap gap-1">
                      {job.tags?.slice(0, 2).map((tag, index) => (
                        <span key={index} className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          {tag}
                        </span>
                      ))}
                      {job.tags && job.tags.length > 2 && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                          +{job.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </Tooltip>
                </td>
                
                {/* 语言要求 */}
                <td className="px-3 py-2">
                  <Tooltip content="英语" maxLines={1}>
                    <span className="text-xs text-gray-600">
                      英语
                    </span>
                  </Tooltip>
                </td>
                
                {/* 发布日期 */}
                <td className="px-3 py-2 text-xs text-gray-500">
                  <Tooltip content={new Date(job.publishedAt).toLocaleDateString()} maxLines={1} clampChildren={false}>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-2 h-2 flex-shrink-0" />
                      <span>
                        {new Date(job.publishedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </Tooltip>
                </td>
                
                {/* 岗位来源 */}
                <td className="px-3 py-2">
                  <Tooltip content={job.source} maxLines={1} clampChildren={false}>
                    <div className="flex flex-col gap-1">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                        {job.source}
                      </span>
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs"
                      >
                        <LinkIcon className="w-2 h-2" />
                        链接
                      </a>
                    </div>
                  </Tooltip>
                </td>
                
                {/* 操作 */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditJob(job)}
                      className="text-blue-600 hover:text-blue-800 text-xs p-1 hover:bg-blue-50 rounded transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleViewDetail(job)}
                      className="text-gray-600 hover:text-gray-800 text-xs p-1 hover:bg-gray-50 rounded transition-colors"
                      title="详情"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteJob(job.id)}
                      className="text-red-600 hover:text-red-800 text-xs p-1 hover:bg-red-50 rounded transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          显示 {((processedDataPage - 1) * processedDataPageSize) + 1} 到 {Math.min(processedDataPage * processedDataPageSize, processedDataTotal)} 条，共 {processedDataTotal} 条
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setProcessedDataPage(Math.max(1, processedDataPage - 1))}
            disabled={processedDataPage === 1}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            上一页
          </button>
          <span className="px-3 py-1 text-sm">
            第 {processedDataPage} 页，共 {Math.ceil(processedDataTotal / processedDataPageSize)} 页
          </span>
          <button
            onClick={() => setProcessedDataPage(processedDataPage + 1)}
            disabled={processedDataPage >= Math.ceil(processedDataTotal / processedDataPageSize)}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Database className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{storageStats.totalRawData}</div>
                <div className="text-sm text-gray-500">原始数据条数</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{storageStats.totalProcessedJobs}</div>
                <div className="text-sm text-gray-500">处理后职位</div>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Server className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {(storageStats.storageSize / 1024 / 1024).toFixed(2)} MB
                </div>
                <div className="text-sm text-gray-500">存储大小</div>
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
            <button
              onClick={handleSyncData}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-blue-300 text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同步中...' : '同步数据'}
            </button>
          )}
          {activeTab === 'processed' && (
            <button
              onClick={handleRefreshProcessedOnly}
              disabled={syncing}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '刷新中...' : '刷新处理后数据'}
            </button>
          )}
          {/* 按需：导出数据按钮已移除 */}
        </div>
      </div>

      {/* 内容区域 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">加载中...</span>
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
          onSave={handleSaveEdit}
          onClose={() => {
            setShowEditModal(false);
            setEditingJob(null);
          }}
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
}> = ({ job, onSave, onClose }) => {
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
     benefits: job.benefits?.join('\n') || ''
   });

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
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">编辑职位信息</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位名称</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">企业名称</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">工作地点</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">薪资</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如: $80,000 - $120,000"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位类型</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
                <option value="contract">合同</option>
                <option value="freelance">自由职业</option>
                <option value="internship">实习</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位级别</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Entry">初级</option>
                <option value="Mid">中级</option>
                <option value="Senior">高级</option>
                <option value="Lead">专家</option>
                <option value="Executive">管理层</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="全栈开发">全栈开发</option>
                <option value="前端开发">前端开发</option>
                <option value="后端开发">后端开发</option>
                <option value="UI/UX设计">UI/UX设计</option>
                <option value="数据分析">数据分析</option>
                <option value="DevOps">DevOps</option>
                <option value="产品管理">产品管理</option>
                <option value="市场营销">市场营销</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">技能标签（用逗号分隔）</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如: React, TypeScript, Node.js"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">岗位要求（每行一个）</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如:&#10;3+ years React experience&#10;TypeScript proficiency"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">福利待遇（每行一个）</label>
              <textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如:&#10;Remote work&#10;Health insurance"
              />
            </div>
          </div>
          
          <div className="flex gap-3 pt-6 border-t border-gray-200">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              保存更改
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
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
  content: string;
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
  }, [content, maxLines]);

  // 计算并更新 Portal 模式下的位置
  const updatePosition = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const viewportWidth = window.innerWidth;
    const maxWidth = 360; // 与样式的 max-w-sm 接近
    const placement = rect.top > 120 ? 'top' : 'bottom';
    let left = Math.min(Math.max(rect.left, 8), viewportWidth - maxWidth - 8);
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
                className={`p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg max-w-sm ${coords.placement === 'top' ? '' : ''}`}
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
              <div className="absolute z-50 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg max-w-sm -top-2 left-0 transform -translate-y-full">
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
}> = ({ item, onClose }) => {
  const isProcessedJob = 'rawDataId' in item;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isProcessedJob ? '处理后数据详情' : '原始数据详情'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          {isProcessedJob ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">基本信息</h3>
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
                  <h3 className="font-medium text-gray-900 mb-2">其他信息</h3>
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
                  <h3 className="font-medium text-gray-900 mb-2">技能标签</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map((tag, index) => (
                      <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {item.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">岗位描述</h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg">
                    {item.description}
                  </div>
                </div>
              )}
              
              {item.requirements && item.requirements.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">岗位要求</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    {item.requirements.map((req, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-blue-600 mt-1">•</span>
                        {req}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {item.benefits && item.benefits.length > 0 && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">福利待遇</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
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
                  <h3 className="font-medium text-gray-900 mb-2">基本信息</h3>
                  <div className="space-y-2 text-sm">
                    <div><span className="font-medium">标题:</span> {item.title}</div>
                    <div><span className="font-medium">来源:</span> {item.source}</div>
                    <div><span className="font-medium">分类:</span> {item.category}</div>
                    <div><span className="font-medium">状态:</span> {item.status}</div>
                    <div><span className="font-medium">获取时间:</span> {new Date(item.fetchedAt).toLocaleString()}</div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">链接</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">原文链接:</span>
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:text-blue-800">
                        查看原文
                      </a>
                    </div>
                    <div>
                      <span className="font-medium">RSS URL:</span>
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:text-blue-800 break-all">
                        {item.url}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
              
              {item.description && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">描述内容</h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                    {item.description}
                  </div>
                </div>
              )}
              
              {item.rawContent && (
                <div>
                  <h3 className="font-medium text-gray-900 mb-2">原始内容</h3>
                  <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto font-mono">
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