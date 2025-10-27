import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  Edit3, 
  Eye, 
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
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
  ChevronDown
} from 'lucide-react';
import { Job, JobFilter, JobStats, SyncStatus, JobCategory, RSSSource } from '../types/rss-types';
import { jobAggregator } from '../services/job-aggregator';
import { rssService } from '../services/rss-service';

const AdminDashboardPage: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [filter, setFilter] = useState<JobFilter>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [showFilters, setShowFilters] = useState(false);
  
  // 排序相关状态
  const [sortBy, setSortBy] = useState<'publishedAt' | 'title' | 'company'>('publishedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // RSS配置相关状态
  const [showRSSConfig, setShowRSSConfig] = useState(false);
  const [rssSources, setRssSources] = useState<RSSSource[]>([]);
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
  const [syncProgress, setSyncProgress] = useState<{
    total: number;
    completed: number;
    current: string;
    errors: string[];
    isRunning: boolean;
  }>({
    total: 0,
    completed: 0,
    current: '',
    errors: [],
    isRunning: false
  });

  // 加载数据 - 添加错误处理
  const loadData = useCallback(async () => {
    console.log('开始加载管理后台数据...');
    setLoading(true);
    try {
      const dashboardData = jobAggregator.getAdminDashboardData(filter);
      console.log('获取到的数据:', {
        jobsCount: dashboardData.jobs?.length || 0,
        stats: dashboardData.stats,
        syncStatus: dashboardData.syncStatus
      });
      
      setJobs(dashboardData.jobs || []);
      setStats(dashboardData.stats);
      setSyncStatus(dashboardData.syncStatus);
      
      // 加载RSS源配置
      const sources = rssService.getRSSSources();
      console.log('RSS源数量:', sources.length);
      setRssSources(sources || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      // 设置默认值防止组件崩溃
      setJobs([]);
      setStats(null);
      setSyncStatus(null);
      setRssSources([]);
    } finally {
      setLoading(false);
      console.log('数据加载完成');
    }
  }, [filter]);

  useEffect(() => {
    // 添加防抖和错误边界
    const timeoutId = setTimeout(() => {
      loadData();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [loadData]);

  // 同步RSS数据
  const handleSync = useCallback(async () => {
    console.log('开始同步数据...');
    setSyncing(true);
    setSyncProgress({
      total: rssSources.length,
      completed: 0,
      current: '正在初始化同步...',
      errors: [],
      isRunning: true
    });

    let timeoutId: NodeJS.Timeout | null = null;

    try {
      console.log('调用 jobAggregator.syncAllJobs()...');
      
      // 调用实际的RSS同步逻辑
      await jobAggregator.syncAllJobs();
      
      console.log('同步完成，重新加载数据...');
      
      // 完成后重新加载数据
      await loadData();

      setSyncProgress(prev => ({
        ...prev,
        current: '同步完成，数据已更新',
        isRunning: false,
        completed: prev.total
      }));

      console.log('数据重新加载完成');

    } catch (error) {
      console.error('Sync failed:', error);
      setSyncProgress(prev => ({
        ...prev,
        current: '同步失败',
        isRunning: false,
        errors: [...prev.errors, `全局错误: ${error instanceof Error ? error.message : '未知错误'}`]
      }));
    } finally {
      setSyncing(false);
      // 3秒后清除进度信息
      timeoutId = setTimeout(() => {
        setSyncProgress({
          total: 0,
          completed: 0,
          current: '',
          errors: [],
          isRunning: false
        });
      }, 3000);
    }

    // 清理定时器
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [rssSources.length, loadData]);

  // 搜索处理
  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    setFilter(prev => ({ ...prev, keywords: term }));
    setCurrentPage(1);
  }, []);

  // 批量操作
  const handleBatchDelete = useCallback(async () => {
    if (selectedJobs.length === 0) return;
    
    if (confirm(`确定要删除选中的 ${selectedJobs.length} 个岗位吗？`)) {
      selectedJobs.forEach(jobId => {
        jobAggregator.deleteJob(jobId);
      });
      setSelectedJobs([]);
      await loadData();
    }
  }, [selectedJobs, loadData]);

  const handleBatchUpdateCategory = useCallback(async (category: JobCategory) => {
    if (selectedJobs.length === 0) return;
    
    const updatedCount = jobAggregator.batchUpdateCategory(selectedJobs, category);
    alert(`已更新 ${updatedCount} 个岗位的分类`);
    setSelectedJobs([]);
    await loadData();
  }, [selectedJobs, loadData]);

  // 单个岗位操作
  const handleJobStatusUpdate = async (jobId: string, status: Job['status']) => {
    jobAggregator.updateJobStatus(jobId, status);
    await loadData();
  };

  // RSS源管理函数
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

  const handleDeleteRSSSource = (sourceToDelete: RSSSource) => {
    if (confirm(`确定要删除RSS源 "${sourceToDelete.name}" 吗？`)) {
      try {
        const sourceIndex = rssSources.findIndex(s => 
          s.name === sourceToDelete.name && 
          s.category === sourceToDelete.category && 
          s.url === sourceToDelete.url
        );
        if (sourceIndex !== -1) {
          rssService.deleteRSSSource(sourceIndex);
          const updatedSources = rssService.getRSSSources();
          setRssSources(updatedSources);
        }
      } catch (error) {
        alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  const handleSaveRSSSource = () => {
    if (!rssFormData.name.trim() || !rssFormData.url.trim() || !rssFormData.category.trim()) {
      alert('请填写完整的RSS源信息');
      return;
    }

    try {
      if (editingRSSSource) {
        // 编辑现有源
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
        // 添加新源
        rssService.addRSSSource({
          name: rssFormData.name,
          url: rssFormData.url,
          category: rssFormData.category
        });
      }
      
      const updatedSources = rssService.getRSSSources();
      setRssSources(updatedSources);
      setShowRSSForm(false);
      setEditingRSSSource(null);
      setRssFormData({ name: '', url: '', category: '' });
    } catch (error) {
      alert(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleCancelRSSForm = () => {
    setShowRSSForm(false);
    setEditingRSSSource(null);
    setRssFormData({ name: '', url: '', category: '' });
  };

  const handleJobDelete = async (jobId: string) => {
    if (confirm('确定要删除这个岗位吗？')) {
      jobAggregator.deleteJob(jobId);
      await loadData();
    }
  };

  // 排序和分页逻辑
  const sortedJobs = React.useMemo(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'publishedAt':
          aValue = new Date(a.publishedAt || 0).getTime();
          bValue = new Date(b.publishedAt || 0).getTime();
          break;
        case 'title':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'company':
          aValue = a.company?.toLowerCase() || '';
          bValue = b.company?.toLowerCase() || '';
          break;
        default:
          return 0;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
    
    return sorted;
  }, [jobs, sortBy, sortOrder]);

  // 分页 - 使用排序后的数据
  const totalPages = Math.max(1, Math.ceil(sortedJobs.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentJobs = sortedJobs.slice(startIndex, endIndex);

  // 处理排序
  const handleSort = (field: 'publishedAt' | 'title' | 'company') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setCurrentPage(1); // 重置到第一页
  };

  // 格式化日期
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return '无效日期';
    
    try {
      const dateObj = date instanceof Date ? date : new Date(date);
      
      // 检查日期是否有效
      if (isNaN(dateObj.getTime())) {
        return '无效日期';
      }
      
      return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      console.error('Date formatting error:', error);
      return '无效日期';
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'inactive': return 'text-yellow-600 bg-yellow-100';
      case 'deleted': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">岗位管理后台</h1>
              <p className="text-gray-600">RSS岗位数据聚合与管理</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowRSSConfig(!showRSSConfig)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Settings className="w-4 h-4 mr-2" />
                RSS配置
              </button>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? '同步中...' : '同步数据'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 同步进度显示 */}
        {syncProgress.isRunning && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <Loader className="w-5 h-5 animate-spin text-blue-600 mr-3" />
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-blue-900">
                    {syncProgress.current}
                  </p>
                  <span className="text-sm text-blue-700">
                    {syncProgress.completed}/{syncProgress.total}
                  </span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(syncProgress.completed / syncProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 同步完成状态 */}
        {!syncProgress.isRunning && syncProgress.total > 0 && (
          <div className={`border rounded-lg p-4 mb-6 ${
            syncProgress.errors.length > 0 
              ? 'bg-yellow-50 border-yellow-200' 
              : 'bg-green-50 border-green-200'
          }`}>
            <div className="flex items-center">
              {syncProgress.errors.length > 0 ? (
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-3" />
              ) : (
                <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
              )}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  syncProgress.errors.length > 0 ? 'text-yellow-900' : 'text-green-900'
                }`}>
                  {syncProgress.current} - 完成 {syncProgress.completed}/{syncProgress.total}
                </p>
                {syncProgress.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-yellow-800 mb-1">同步错误:</p>
                    <div className="max-h-32 overflow-y-auto">
                      {syncProgress.errors.map((error, index) => (
                        <div key={index} className="text-xs text-yellow-700 bg-yellow-100 p-2 rounded mb-1">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* RSS配置模块 */}
        {showRSSConfig && (
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">RSS数据源配置</h3>
                  <p className="text-sm text-gray-600">管理RSS数据源，共 {rssSources.length} 个源</p>
                </div>
                <button
                  onClick={handleAddRSSSource}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  添加RSS源
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                {rssSources.map((source, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{source.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">{source.category}</p>
                        <p className="text-xs text-gray-500 mt-2 break-all">{source.url}</p>
                      </div>
                      <div className="ml-2 flex flex-col space-y-2">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          活跃
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleEditRSSSource(source)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                            title="编辑"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteRSSSource(source)}
                            className="p-1 text-gray-400 hover:text-red-600"
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
          </div>
        )}

        {/* RSS源添加/编辑表单 */}
        {showRSSForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingRSSSource ? '编辑RSS源' : '添加RSS源'}
                  </h3>
                  <button
                    onClick={handleCancelRSSForm}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      源名称
                    </label>
                    <input
                      type="text"
                      value={rssFormData.name}
                      onChange={(e) => setRssFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: WeWorkRemotely"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      分类
                    </label>
                    <input
                      type="text"
                      value={rssFormData.category}
                      onChange={(e) => setRssFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="例如: 全栈开发"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      RSS URL
                    </label>
                    <input
                      type="url"
                      value={rssFormData.url}
                      onChange={(e) => setRssFormData(prev => ({ ...prev, url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="https://example.com/feed.rss"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={handleCancelRSSForm}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSaveRSSSource}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Briefcase className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">总岗位数</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">活跃岗位</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.activeJobs}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">24小时新增</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.recentlyAdded}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Globe className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">RSS数据源</p>
                  <p className="text-2xl font-semibold text-gray-900">{rssSources.length}</p>
                </div>
              </div>
            </div>

            {/* 存储容量卡片 */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Database className="h-8 w-8 text-orange-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">存储容量</p>
                  <div className="flex items-baseline space-x-2">
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.round((stats.total * 2) / 1024 * 100) / 100}MB
                    </p>
                    <p className="text-xs text-gray-500">/ 20MB</p>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          (stats.total * 2) / 1024 / 20 > 0.8 ? 'bg-red-500' : 
                          (stats.total * 2) / 1024 / 20 > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(((stats.total * 2) / 1024 / 20) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      预计可存储 {Math.floor(20 * 1024 / 2)} 个职位
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 同步状态 */}
        {syncStatus && (
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">同步状态</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500">上次同步</p>
                <p className="text-sm font-medium">
                  {syncStatus.lastSync ? formatDate(syncStatus.lastSync) : '从未同步'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">成功/总数</p>
                <p className="text-sm font-medium">
                  {syncStatus.successfulSources}/{syncStatus.totalSources}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">处理岗位数</p>
                <p className="text-sm font-medium">{syncStatus.totalJobsProcessed}</p>
              </div>
            </div>
            {syncStatus.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-red-600">同步错误 ({syncStatus.errors.length})</p>
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {syncStatus.errors.map((error, index) => (
                    <div key={`error-${index}-${error.source}`} className="text-xs text-red-500 bg-red-50 p-2 rounded mb-1">
                      {error.source}: {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 搜索和筛选 */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索岗位标题、公司或描述..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              筛选
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">岗位状态</label>
                  <select
                    value={filter.status?.[0] || ''}
                    onChange={(e) => setFilter(prev => ({ 
                      ...prev, 
                      status: e.target.value ? [e.target.value as Job['status']] : undefined 
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">全部状态</option>
                    <option value="active">活跃</option>
                    <option value="inactive">非活跃</option>
                    <option value="deleted">已删除</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">工作类型</label>
                  <select
                    value={filter.jobType?.[0] || ''}
                    onChange={(e) => setFilter(prev => ({ 
                      ...prev, 
                      jobType: e.target.value ? [e.target.value as Job['jobType']] : undefined 
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">全部类型</option>
                    <option value="Full-time">全职</option>
                    <option value="Part-time">兼职</option>
                    <option value="Contract">合同</option>
                    <option value="Freelance">自由职业</option>
                    <option value="Internship">实习</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">数据源</label>
                  <select
                    value={filter.source?.[0] || ''}
                    onChange={(e) => setFilter(prev => ({ 
                      ...prev, 
                      source: e.target.value ? [e.target.value] : undefined 
                    }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">全部来源</option>
                    <option value="WeWorkRemotely">WeWorkRemotely</option>
                    <option value="Remotive">Remotive</option>
                    <option value="JobsCollider">JobsCollider</option>
                    <option value="RealWorkFromAnywhere">RealWorkFromAnywhere</option>
                    <option value="Himalayas">Himalayas</option>
                    <option value="NoDesk">NoDesk</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 批量操作 */}
        {selectedJobs.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                已选择 {selectedJobs.length} 个岗位
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleBatchDelete}
                  className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  批量删除
                </button>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchUpdateCategory(e.target.value as JobCategory);
                      e.target.value = '';
                    }
                  }}
                  className="text-xs border border-gray-300 rounded px-2 py-1"
                >
                  <option value="">批量分类</option>
                  <option value="软件开发">软件开发</option>
                  <option value="前端开发">前端开发</option>
                  <option value="后端开发">后端开发</option>
                  <option value="产品管理">产品管理</option>
                  <option value="设计">设计</option>
                  <option value="市场营销">市场营销</option>
                  <option value="其他">其他</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 岗位列表 */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedJobs.length === currentJobs.length && currentJobs.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedJobs(currentJobs.map(job => job.id));
                        } else {
                          setSelectedJobs([]);
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('title')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>岗位信息</span>
                      {sortBy === 'title' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    分类
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    来源
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('publishedAt')}
                      className="flex items-center space-x-1 hover:text-gray-700"
                    >
                      <span>发布时间</span>
                      {sortBy === 'publishedAt' && (
                        sortOrder === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedJobs([...selectedJobs, job.id]);
                          } else {
                            setSelectedJobs(selectedJobs.filter(id => id !== job.id));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {job.sourceUrl ? (
                            <a
                              href={job.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              title="点击查看原始职位信息"
                            >
                              {job.title}
                            </a>
                          ) : (
                            <span>{job.title}</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500 truncate">
                          {job.company} • {job.location}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                           {job.salary && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                               {job.salary}
                             </span>
                           )}
                           {job.jobType && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                               {job.jobType}
                             </span>
                           )}
                           {job.isRemote && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                               远程
                             </span>
                           )}
                           {job.experienceLevel && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                               {job.experienceLevel}
                             </span>
                           )}
                           {job.remoteLocationRestriction && (
                             <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                               {job.remoteLocationRestriction}
                             </span>
                           )}
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {job.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.source}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status === 'active' ? '活跃' : job.status === 'inactive' ? '非活跃' : '已删除'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(job.publishedAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => window.open(job.applicationUrl, '_blank')}
                          className="text-blue-600 hover:text-blue-900"
                          title="查看详情"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleJobStatusUpdate(job.id, job.status === 'active' ? 'inactive' : 'active')}
                          className="text-yellow-600 hover:text-yellow-900"
                          title="切换状态"
                        >
                          {job.status === 'active' ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleJobDelete(job.id)}
                          className="text-red-600 hover:text-red-900"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  上一页
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  下一页
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    显示第 <span className="font-medium">{startIndex + 1}</span> 到{' '}
                    <span className="font-medium">{Math.min(endIndex, jobs.length)}</span> 条，
                    共 <span className="font-medium">{jobs.length}</span> 条结果
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      上一页
                    </button>
                    {totalPages > 0 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                            currentPage === page
                              ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                              : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      下一页
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardPage;