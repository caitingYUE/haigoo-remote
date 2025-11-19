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
  ChevronDown,
  BarChart3,
  PieChart,
  Activity,
  Rss,
  Menu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Job, JobFilter, JobStats, SyncStatus, JobCategory, RSSSource } from '../types/rss-types';
import { jobAggregator } from '../services/job-aggregator';
import { rssService } from '../services/rss-service';
import DataManagementTabs from '../components/DataManagementTabs';
import UserManagementPage from './UserManagementPage';
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
  const [sortBy, setSortBy] = useState<'publishedAt' | 'title' | 'company' | 'remoteLocationRestriction'>('publishedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
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

  const { user, logout } = useAuth();

  // 加载数据
  const loadData = useCallback(async () => {
    console.log('开始加载管理后台数据...');
    setLoading(true);
    try {
      // 加载RSS数据
      const rssJobs = jobAggregator.getJobs();
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
                    <td className="text-sm text-gray-500">{source.url}</td>
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

  // 渲染简历库
  const renderResumeLibrary = () => (
    <div className="card">
      <div className="card-header"><h2>简历库</h2></div>
      <div className="card-content">
        <p className="text-gray-500">该功能暂未启用。</p>
      </div>
    </div>
  );

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
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center">
              <PieChart className="w-12 h-12 mx-auto text-gray-400 mb-2" />
              <p className="text-gray-500">图表功能开发中...</p>
              <p className="text-sm text-gray-400 mt-1">将显示过去30天的职位发布趋势</p>
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
              {['技术开发', '产品设计', '市场营销', '运营管理', '其他'].map((category, index) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{category}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary" 
                        style={{ width: `${Math.random() * 80 + 20}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8">{Math.floor(Math.random() * 50 + 10)}</span>
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
                    <span className={`w-2 h-2 rounded-full ${source.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-500">{source.isActive ? '活跃' : '停用'}</span>
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
    { id: 'resumes', label: '简历库', icon: Users },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'analytics', label: '数据分析', icon: TrendingUp },
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
            <h1>海狗招聘团队管理后台</h1>
            <div className="flex items-center gap-4">
              {user && (
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  {user.avatar ? (
                    <img src={user.avatar} alt={user.username || ''} className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white">
                      {(user.username || 'U')[0].toUpperCase()}
                    </div>
                  )}
                  <span>{user.username}</span>
                  <span className="text-gray-400">|</span>
                  <span>{user.email}</span>
                </div>
              )}
              <button onClick={logout} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50">退出登录</button>
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
              {activeTab === 'analytics' && renderAnalytics()}
              {activeTab === 'users' && <UserManagementPage />}
              {activeTab === 'settings' && renderSettings()}
            </div>
          )}
        </div>
      </main>

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
                    onChange={(e) => setRssFormData({...rssFormData, name: e.target.value})}
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
                    onChange={(e) => setRssFormData({...rssFormData, url: e.target.value})}
                    className="form-input w-full"
                    placeholder="https://example.com/rss"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">分类</label>
                  <select 
                    value={rssFormData.category}
                    onChange={(e) => setRssFormData({...rssFormData, category: e.target.value})}
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