import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  Trash2,
  Edit3,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  Users,
  Briefcase,
  Globe,
  Settings,
  AlertCircle,
  Info,
  Loader,
  Plus,
  Save,
  X,
  BarChart3,
  PieChart,
  Activity,
  Rss,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Tag,
  Building,
  FileText
} from 'lucide-react';
import { Job, JobFilter, JobStats, SyncStatus, RSSSource } from '../types/rss-types';
import { jobAggregator } from '../services/job-aggregator';
import { rssService } from '../services/rss-service';
import DataManagementTabs from '../components/DataManagementTabs';
import UserManagementPage from './UserManagementPage';
import AdminCompanyManagementPage from './AdminCompanyManagementPage';
import AdminTagManagementPage from './AdminTagManagementPage';
import AdminFeedbackList from '../components/AdminFeedbackList';
import CronTestControl from '../components/CronTestControl';
import '../components/AdminPanel.css';
import { useAuth } from '../contexts/AuthContext';

// 扩展RSSSource接口以包含管理所需的字段
interface ExtendedRSSSource extends RSSSource {
  id: number;
  isActive: boolean;
  lastSync: Date | null;
}

const AdminTeamPage: React.FC = () => {
  // 主要状态管理
  const [activeTab, setActiveTab] = useState('dashboard');
  const [_jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [syncStatus, _setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [_selectedJobs, _setSelectedJobs] = useState<string[]>([]);
  const [filter, _setFilter] = useState<JobFilter>({});
  const [_searchTerm, _setSearchTerm] = useState('');
  const [_currentPage, _setCurrentPage] = useState(1);
  const [_itemsPerPage] = useState(20);
  const [_showFilters, _setShowFilters] = useState(false);

  // 排序相关状态
  const [_sortBy, _setSortBy] = useState<'publishedAt' | 'title' | 'company' | 'remoteLocationRestriction'>('publishedAt');
  const [_sortOrder, _setSortOrder] = useState<'asc' | 'desc'>('desc');

  // RSS配置相关状态
  const [rssSources, setRssSources] = useState<ExtendedRSSSource[]>([]);
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

  // 数据管理状态
  const [rawJobs, setRawJobs] = useState<any[]>([]);
  const [processedJobs, setProcessedJobs] = useState<any[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 简历管理状态
  const [resumes, setResumes] = useState<any[]>([]);
  const [resumeSearchTerm, setResumeSearchTerm] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [storageProvider, setStorageProvider] = useState<string>('');

  const { user, logout } = useAuth();

  // 加载数据
  const loadData = useCallback(async () => {
    console.log('开始加载管理后台数据...');
    setLoading(true);
    try {
      // 优先从API刷新最新数据
      const rssJobs = await jobAggregator.refreshJobsFromAPI();
      setJobs(rssJobs);

      // 加载统计数据
      const data = jobAggregator.getAdminDashboardData(filter);
      setStats(data.stats);

      // 加载RSS源配置
      const sources = rssService.getRSSSources();
      // 转换为ExtendedRSSSource格式
      const extendedSources: ExtendedRSSSource[] = sources.map((source, index) => ({
        ...source,
        id: index + 1,
        isActive: true,
        lastSync: new Date()
      }));
      setRssSources(extendedSources);

      // 加载原始和处理后的数据
      setRawJobs(rssJobs);
      setProcessedJobs(rssJobs);

      console.log('数据加载完成:', {
        jobsCount: rssJobs.length,
        sourcesCount: sources.length
      });
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 获取简历数据
  const fetchResumes = useCallback(async () => {
    setResumeLoading(true);
    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch('/api/resumes', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

    
      if (res.ok) {
        const data = await res.json();
        setResumes(data.data || []);
        setStorageProvider(data.provider || 'unknown');
      } else {
        console.error('Failed to fetch resumes');
      }
    } catch (error) {
      console.error('Error fetching resumes:', error);
    } finally {
      setResumeLoading(false);
    }
  }, []);

  // 加载简历数据当切换到简历库标签时
  useEffect(() => {
    if (activeTab === 'resumes') {
      fetchResumes();
    }
  }, [activeTab, fetchResumes]);

  // 同步RSS数据
  const handleSync = async () => {
    setSyncing(true);
    try {
      await jobAggregator.syncAllJobs();
      await loadData();
    } catch (error) {
      console.error('同步失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 导出数据
  const handleExport = (type: 'raw' | 'processed') => {
    const data = type === 'raw' ? rawJobs : processedJobs;
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}_jobs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 添加RSS源
  const handleAddRSSSource = async () => {
    try {
      rssService.addRSSSource(rssFormData);
      setShowRSSForm(false);
      setRssFormData({ name: '', url: '', category: '' });
      await loadData();
    } catch (error) {
      console.error('添加RSS源失败:', error);
    }
  };

  // 删除RSS源
  const handleDeleteRSSSource = async (sourceId: number) => {
    try {
      rssService.deleteRSSSource(sourceId - 1); // 转换为数组索引
      await loadData();
    } catch (error) {
      console.error('删除RSS源失败:', error);
    }
  };

  // 渲染数据概览
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* 统计卡片 */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3>总职位数</h3>
            <p className="stat-number">{stats?.total || 0}</p>
            <span className="stat-change positive">+{stats?.recentlyAdded || 0} 今日新增</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Rss className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3>RSS源数量</h3>
            <p className="stat-number">{rssSources.length}</p>
            <span className="stat-change">活跃源 {rssSources.filter(s => s.isActive).length}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3>活跃职位</h3>
            <p className="stat-number">{stats?.activeJobs || 0}</p>
            <span className="stat-change">同步成功率 95%</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <Clock className="w-6 h-6" />
          </div>
          <div className="stat-content">
            <h3>最后同步</h3>
            <p className="stat-number">{syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleTimeString() : '--'}</p>
            <span className="stat-change">自动同步</span>
          </div>
        </div>
      </div>

      {/* 快速操作 */}
      <div className="card">
        <div className="card-header">
          <h2>快速操作</h2>
        </div>
        <div className="card-content">
            <div className="flex flex-wrap gap-4">
            <button
              onClick={() => handleExport('processed')}
              className="btn-secondary"
            >
              <Download className="w-4 h-4" />
              导出数据
            </button>

              <button
                onClick={() => setShowRSSForm(true)}
                className="btn-secondary"
              >
                <Plus className="w-4 h-4" />
                添加RSS源
              </button>
              <button
                onClick={handleSync}
                className="btn-primary"
                disabled={syncing}
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                同步RSS数据
              </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染RSS管理
  const renderRSSManagement = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2>RSS源管理</h2>
          <button
            onClick={() => setShowRSSForm(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" />
            添加RSS源
          </button>
        </div>
        <div className="card-content">
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>URL</th>
                  <th>分类</th>
                  <th>状态</th>
                  <th>最后同步</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {rssSources.map((source) => (
                  <tr key={source.id}>
                    <td>{source.name}</td>
                    <td className="text-sm text-slate-500">{source.url}</td>
                    <td>
                      <span className="status-badge medium">{source.category}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${source.isActive ? 'high' : 'low'}`}>
                        {source.isActive ? '活跃' : '停用'}
                      </span>
                    </td>
                    <td>{source.lastSync ? new Date(source.lastSync).toLocaleString() : '--'}</td>
                    <td>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingRSSSource(source)}
                          className="action-btn"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRSSSource(source.id)}
                          className="action-btn danger"
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
        </div>
      </div>
    </div>
  );

  // 渲染职位数据管理
  const renderJobDataManagement = () => (
    <DataManagementTabs />
  );

  // 渲染反馈列表
  const renderFeedbackList = () => (
    <AdminFeedbackList />
  );

  

  // 删除简历
  const handleDeleteResume = async (id: string) => {
    if (!confirm('确定要删除这份简历吗？')) return;

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch(`/api/resumes?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (res.ok) {
        setResumes(prev => prev.filter(r => r.id !== id));
      } else {
        alert('删除失败');
      }
    } catch (error) {
      alert('删除出错: ' + error);
    }
  };

  // 清空所有简历
  const handleClearResumes = async () => {
    if (!confirm('确定要清空所有简历吗？此操作不可恢复！')) return;

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch('/api/resumes', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (res.ok) {
        setResumes([]);
        alert('所有简历已清空');
      } else {
        alert('清空失败');
      }
    } catch (error) {
      alert('清空出错: ' + error);
    }
  };

  // 渲染简历库
  const renderResumeLibrary = () => {
    const filteredResumes = resumes.filter(resume => {
      const term = resumeSearchTerm.toLowerCase();
      const name = resume.parsedData?.name?.toLowerCase() || '';
      const email = resume.parsedData?.email?.toLowerCase() || '';
      const fileName = resume.fileName?.toLowerCase() || '';
      return name.includes(term) || email.includes(term) || fileName.includes(term);
    });

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h2>简历数据</h2>
            <div className="flex space-x-2">
              <button
                onClick={handleClearResumes}
                className="px-4 py-2 bg-white border border-slate-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors flex items-center text-sm font-medium"
                disabled={resumeLoading || resumes.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                清空所有
              </button>
              <button
                onClick={fetchResumes}
                className="btn-primary"
                disabled={resumeLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${resumeLoading ? 'animate-spin' : ''}`} />
                刷新列表
              </button>
            </div>
          </div>
          <div className="card-content">
            {/* 搜索栏和统计 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center bg-slate-100 rounded-lg px-3 py-2 flex-1 max-w-md">
                <Search className="w-5 h-5 text-slate-400 mr-2" />
                <input
                  type="text"
                  placeholder="搜索姓名、邮箱或文件名..."
                  className="bg-transparent border-none focus:ring-0 w-full text-sm"
                  value={resumeSearchTerm}
                  onChange={(e) => setResumeSearchTerm(e.target.value)}
                />
              </div>
              <div className="text-sm text-slate-500">
                存储提供者: <span className="font-medium text-slate-900">{storageProvider}</span>
                <span className="mx-2">|</span>
                总计: <span className="font-medium text-slate-900">{resumes.length}</span>
              </div>
            </div>

            {/* 简历表格 */}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>候选人</th>
                    <th>文件信息</th>
                    <th>解析状态</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resumeLoading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-slate-500">加载中...</p>
                      </td>
                    </tr>
                  ) : filteredResumes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12">
                        <p className="text-slate-500">暂无简历数据</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResumes.map((resume) => (
                      <tr key={resume.id}>
                        <td>
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                              <Users className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-slate-900">
                                {resume.parsedData?.name || '未知姓名'}
                              </div>
                              <div className="text-sm text-slate-500">
                                {resume.parsedData?.email || '无邮箱'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm text-slate-900">{resume.fileName}</div>
                          <div className="text-sm text-slate-500">{formatSize(resume.size)}</div>
                        </td>
                        <td>
                          {resume.parseStatus === 'success' ? (
                            <span className="status-badge high">
                              <CheckCircle className="w-3 h-3 mr-1" /> 解析成功
                            </span>
                          ) : resume.parseStatus === 'partial' ? (
                            <span className="status-badge medium">
                              <AlertCircle className="w-3 h-3 mr-1" /> 部分解析
                            </span>
                          ) : (
                            <span className="status-badge low">
                              <XCircle className="w-3 h-3 mr-1" /> 解析失败
                            </span>
                          )}
                        </td>
                        <td className="text-sm text-slate-500">
                          {formatDate(resume.uploadedAt)}
                        </td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => {
                                alert(JSON.stringify(resume.parsedData, null, 2));
                              }}
                              className="action-btn"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {resume.localFilePath && (
                              <button
                                onClick={() => window.open(`/api/resumes?action=download&id=${resume.id}`, '_blank')}
                                className="action-btn"
                                title="下载原文件"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteResume(resume.id)}
                              className="action-btn danger"
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
          </div>
        </div>
      </div>
    );
  };

  // 渲染数据分析
  const renderAnalytics = () => (
    <div className="space-y-6">
      {/* 趋势图表 */}
      <div className="card">
        <div className="card-header">
          <h2>职位发布趋势</h2>
          <div className="flex space-x-2">
            <button className="btn-secondary">
              <BarChart3 className="w-4 h-4" />
              柱状图
            </button>
            <button className="btn-secondary">
              <Activity className="w-4 h-4" />
              折线图
            </button>
          </div>
        </div>
        <div className="card-content">
          <div className="h-64 flex items-center justify-center bg-slate-50 rounded-lg">
            <div className="text-center">
              <PieChart className="w-12 h-12 mx-auto text-slate-400 mb-2" />
              <p className="text-slate-500">图表功能开发中...</p>
              <p className="text-sm text-slate-400 mt-1">将显示过去30天的职位发布趋势</p>
            </div>
          </div>
        </div>
      </div>

      {/* 分类统计 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h2>职位分类分布</h2>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {['技术开发', '产品设计', '市场营销', '运营管理', '其他'].map((category) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.random() * 80 + 20}%` }}
                      />
                    </div>
                    <span className="text-sm text-slate-500 w-8">{Math.floor(Math.random() * 50 + 10)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>RSS源活跃度</h2>
          </div>
          <div className="card-content">
            <div className="space-y-3">
              {rssSources.slice(0, 5).map((source) => (
                <div key={source.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{source.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className={`w-2 h-2 rounded-full ${source.isActive ? 'bg-green-500' : 'bg-slate-300'}`} />
                    <span className="text-sm text-slate-500">{source.isActive ? '活跃' : '停用'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染系统设置
  const renderSettings = () => (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2>系统设置</h2>
        </div>
        <div className="card-content">
          <div className="space-y-4">
            <div className="setting-item">
              <label className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={isDarkMode}
                  onChange={(e) => setIsDarkMode(e.target.checked)}
                  className="form-checkbox"
                />
                <span>深色模式</span>
              </label>
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium mb-2">
                自动同步间隔 (分钟)
              </label>
              <input
                type="number"
                defaultValue={30}
                className="form-input w-32"
              />
            </div>

            <div className="setting-item">
              <label className="block text-sm font-medium mb-2">
                数据保留天数
              </label>
              <input
                type="number"
                defaultValue={30}
                className="form-input w-32"
              />
            </div>

            <button className="btn-primary">
              <Save className="w-4 h-4" />
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'dashboard', label: '数据概览', icon: BarChart3 },
    { id: 'rss', label: 'RSS管理', icon: Rss },
    { id: 'jobs', label: '职位数据', icon: Briefcase },
    { id: 'companies', label: '企业管理', icon: Building },
    { id: 'tag-management', label: '标签管理', icon: Tag },
    { id: 'resumes', label: '简历数据', icon: FileText },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'analytics', label: '数据分析', icon: TrendingUp },
    { id: 'feedback', label: '用户反馈', icon: MessageSquare },
    { id: 'settings', label: '系统设置', icon: Settings }
  ];

  return (
    <div className={`admin-panel ${isDarkMode ? 'dark' : ''}`}>
      {/* 侧边栏导航 */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-logo">
            <div className="logo-icon">海</div>
            {!sidebarCollapsed && (
              <div className="logo-text">
                <h1>海狗招聘</h1>
                <p>团队管理后台</p>
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="collapse-btn"
              title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          <nav className="sidebar-nav">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <a
                  key={tab.id}
                  href="#"
                  className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab(tab.id);
                  }}
                  title={sidebarCollapsed ? tab.label : ''}
                >
                  <Icon className="w-5 h-5" />
                  {!sidebarCollapsed && tab.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <a href="#" className="nav-item" title={sidebarCollapsed ? '帮助中心' : ''}>
            <Info className="w-5 h-5" />
            {!sidebarCollapsed && '帮助中心'}
          </a>
          <a href="/" className="nav-item" title={sidebarCollapsed ? '返回前台' : ''}>
            <Globe className="w-5 h-5" />
            {!sidebarCollapsed && '返回前台'}
          </a>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className={`admin-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <div className="admin-container">
          {/* 页面头部 */}
          <header className="admin-header">
            <h1>{activeTab === 'overview' ? '数据概览' : activeTab === 'data' ? '数据管理' : activeTab === 'rss' ? 'RSS源管理' : activeTab === 'companies' ? '企业管理' : activeTab === 'team' ? '团队管理' : activeTab === 'users' ? '用户管理' : activeTab === 'tags' ? '标签管理' : activeTab === 'feedback' ? '用户反馈' : activeTab === 'analytics' ? '数据分析' : activeTab === 'settings' ? '系统设置' : '海狗招聘团队管理后台'}</h1>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username || ''} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white">
                      {(user.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span>{user.username}</span>
                  <span className="text-slate-400">|</span>
                  <span>{user.email}</span>
                </div>
              )}
              <button onClick={logout} className="px-3 py-1.5 border rounded-lg hover:bg-slate-50">退出登录</button>
            </div>
          </header>

          {/* 内容区域 */}
          {loading ? (
            <div className="loading">
              <Loader className="w-6 h-6 animate-spin" />
              加载中...
            </div>
          ) : (
            <div className="admin-content">
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'rss' && renderRSSManagement()}
              {activeTab === 'jobs' && renderJobDataManagement()}
              {activeTab === 'resumes' && renderResumeLibrary()}
              {activeTab === 'users' && <UserManagementPage />}
              {activeTab === 'companies' && <AdminCompanyManagementPage />}
              {activeTab === 'tag-management' && <AdminTagManagementPage />}
              {activeTab === 'analytics' && renderAnalytics()}
              {activeTab === 'feedback' && renderFeedbackList()}
              {activeTab === 'settings' && renderSettings()}
            </div>
          )}
        </div>
      </main>

      {/* 定时任务测试控件 */}
      <CronTestControl />

      {/* RSS表单模态框 */}
      {showRSSForm && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRSSForm(false);
            }
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <h3>{editingRSSSource ? '编辑RSS源' : '添加RSS源'}</h3>
              <button
                onClick={() => {
                  setShowRSSForm(false);
                  setEditingRSSSource(null);
                  setRssFormData({ name: '', url: '', category: '' });
                }}
                className="modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-content">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">名称</label>
                  <input
                    type="text"
                    value={rssFormData.name}
                    onChange={(e) => setRssFormData({ ...rssFormData, name: e.target.value })}
                    className="form-input w-full"
                    placeholder="RSS源名称"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">URL</label>
                  <input
                    type="url"
                    value={rssFormData.url}
                    onChange={(e) => setRssFormData({ ...rssFormData, url: e.target.value })}
                    className="form-input w-full"
                    placeholder="https://example.com/rss"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">分类</label>
                  <select
                    value={rssFormData.category}
                    onChange={(e) => setRssFormData({ ...rssFormData, category: e.target.value })}
                    className="form-select w-full"
                  >
                    <option value="">选择分类</option>
                    <option value="tech">技术</option>
                    <option value="design">设计</option>
                    <option value="marketing">市场</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowRSSForm(false);
                  setEditingRSSSource(null);
                  setRssFormData({ name: '', url: '', category: '' });
                }}
                className="btn-secondary"
              >
                取消
              </button>
              <button
                onClick={handleAddRSSSource}
                className="btn-primary"
                disabled={!rssFormData.name || !rssFormData.url}
              >
                {editingRSSSource ? '更新' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTeamPage;
