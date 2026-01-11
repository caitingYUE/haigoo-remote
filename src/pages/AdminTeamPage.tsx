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
  FileText,
  Mail
} from 'lucide-react';
import { JobFilter, JobStats, SyncStatus, RSSSource } from '../types/rss-types';
import { rssService } from '../services/rss-service';
import { dataManagementService } from '../services/data-management-service';
import DataManagementTabs from '../components/DataManagementTabs';
import UserManagementPage from './UserManagementPage';
import AdminCompanyManagementPage from './AdminCompanyManagementPage';
import AdminTrustedCompaniesPage from './AdminTrustedCompaniesPage';
import AdminTagManagementPage from './AdminTagManagementPage';
import AdminApplicationsPage from './AdminApplicationsPage';
import AdminMemberApplicationsPage from './AdminMemberApplicationsPage';
import AdminFeedbackList from '../components/AdminFeedbackList';
import { SubscriptionsTable } from '../components/SubscriptionsTable';
import AdminSystemSettings from '../components/admin/AdminSystemSettings';
import CronTestControl from '../components/CronTestControl';
import '../components/AdminPanel.css';
import { useAuth } from '../contexts/AuthContext';
import { processedJobsService } from '../services/processed-jobs-service';

import AdminTrackingManagement from '../components/admin/AdminTrackingManagement';
import AdminTrackingDashboard from '../components/admin/AdminTrackingDashboard';
import logoPng from '../assets/logo.png';

// 扩展RSSSource接口以包含管理所需的字段
interface ExtendedRSSSource extends RSSSource {
  id: number;
  isActive: boolean;
  lastSync: Date | null;
}

const AdminTeamPage: React.FC = () => {
  // 主要状态管理
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<JobStats | null>(null);
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

  // 侧边栏折叠状态
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // 简历管理状态
  const [resumes, setResumes] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({}); // Store full user object
  const [resumeSearchTerm, setResumeSearchTerm] = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [storageProvider, setStorageProvider] = useState<string>('');
  
  // 简历筛选状态
  const [resumeSourceFilter, setResumeSourceFilter] = useState<string>('all');
  const [resumeUserTypeFilter, setResumeUserTypeFilter] = useState<string>('all');
  const [resumeTalentPoolFilter, setResumeTalentPoolFilter] = useState<string>('all');
  const [resumeSort, setResumeSort] = useState<'newest' | 'oldest'>('newest');

  const { user, logout } = useAuth();

  // 简历详情模态框状态
  const [selectedResume, setSelectedResume] = useState<any | null>(null);

  // 修复乱码的辅助函数
  const fixEncoding = (str: string) => {
    try {
      // 尝试将 Latin1 编码的字符串转换为 UTF-8
      return decodeURIComponent(escape(str));
    } catch (e) {
      return str;
    }
  };

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 从后端接口获取统计数据
      const statsResponse = await fetch('/api/data/processed-jobs?action=stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats({
          total: statsData.totalJobs || 0,
          activeJobs: statsData.activeJobs || 0,
          recentlyAdded: statsData.recentlyAdded || 0,
          byCategory: statsData.byCategory || {},
          bySource: statsData.bySource || {},
          byJobType: statsData.byJobType || {},
          byExperienceLevel: statsData.byExperienceLevel || {},
          lastSync: statsData.lastSync ? new Date(statsData.lastSync) : null
        });
      } else {
        console.error('获取统计数据失败:', statsResponse.status);
      }

      // 加载RSS源配置
      await rssService.refreshSources();
      // Ensure we get the latest sources after refresh
      const sources = rssService.getRSSSources();
      console.log('Loaded RSS Sources:', sources);
      
      // 转换为ExtendedRSSSource格式
      const extendedSources: ExtendedRSSSource[] = sources.map((source, index) => ({
        ...source,
        id: source.id || index + 1,
        isActive: source.isActive ?? true,
        lastSync: new Date()
      }));
      setRssSources(extendedSources);
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
      // Request scope=all_users explicitly for Admin Panel
      const res = await fetch('/api/resumes?scope=all_users', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        const rawResumes = data.data || [];
        // 处理数据：修复乱码，补充字段
        const processedResumes = rawResumes.map((resume: any) => ({
            ...resume,
            fileName: fixEncoding(resume.fileName),
            source: resume.metadata?.source || 'unknown',
            // 如果 user_id 存在，尝试关联用户昵称（这里需要后端支持，暂时用 user_id 代替）
            // 可以通过 user_id 判断是 registered 还是 lead
            userType: resume.userId?.startsWith('lead_') || resume.userId?.startsWith('anon_') ? 'Lead' : 'Registered',
            uploadedAt: resume.createdAt || resume.uploadedAt || new Date().toISOString()
        }));
        
        setResumes(processedResumes);
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

  // 获取用户映射表
  const fetchUsersMap = useCallback(async () => {
    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch('/api/users', {
        headers: {
            'Authorization': `Bearer ${token || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
            const map: Record<string, any> = {};
            data.users.forEach((u: any) => {
                map[u.id] = u; // Store full user object
            });
            setUserMap(map);
        }
      }
    } catch (e) {
      console.error('Failed to fetch users map', e);
    }
  }, []);

  // 加载简历数据当切换到简历库标签时
  useEffect(() => {
    if (activeTab === 'resumes') {
      fetchResumes();
      fetchUsersMap();
    }
  }, [activeTab, fetchResumes, fetchUsersMap]);

  // 同步RSS数据
  const handleSync = async () => {
    setSyncing(true);
    try {
      await dataManagementService.syncAllRSSData(false);
      await loadData();
    } catch (error) {
      console.error('同步失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 导出数据
  const handleExport = async (type: 'raw' | 'processed') => {
    const processedJobs = await processedJobsService.getAllProcessedJobs(1000);
    const dataStr = JSON.stringify(processedJobs, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}_jobs_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 保存RSS源 (添加或更新)
  const handleSaveRSSSource = async () => {
    try {
      if (editingRSSSource) {
        const sources = rssService.getRSSSources();
        const index = sources.findIndex(s => s.id === editingRSSSource.id);
        if (index !== -1) {
             await rssService.updateRSSSource(index, { ...rssFormData, isActive: (editingRSSSource as ExtendedRSSSource).isActive });
        }
      } else {
        await rssService.addRSSSource(rssFormData);
      }
      setShowRSSForm(false);
      setEditingRSSSource(null);
      setRssFormData({ name: '', url: '', category: '' });
      await loadData();
    } catch (error) {
      console.error('保存RSS源失败:', error);
      alert('保存失败: ' + error);
    }
  };

  // 删除RSS源
  const handleDeleteRSSSource = async (sourceId: number) => {
    try {
      const sources = rssService.getRSSSources();
      const index = sources.findIndex(s => s.id === sourceId);
      if (index !== -1) {
          await rssService.deleteRSSSource(index);
          await loadData();
      }
    } catch (error) {
      console.error('删除RSS源失败:', error);
      alert('删除失败: ' + error);
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
            <p className="stat-number">{stats?.lastSync ? new Date(stats.lastSync).toLocaleTimeString() : '--'}</p>
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
              onClick={() => window.location.href = '/admin_team/bug-reports'}
              className="btn-secondary"
            >
              <MessageSquare className="w-4 h-4" />
              Bug反馈管理
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
    // 1. Filter
    const filteredResumes = resumes.filter(resume => {
      // Search
      const term = resumeSearchTerm.toLowerCase();
      const fileName = resume.fileName?.toLowerCase() || '';
      const userId = resume.userId?.toLowerCase() || '';
      const email = (resume.metadata?.email || userMap[resume.userId]?.email || '').toLowerCase();
      const matchesSearch = fileName.includes(term) || userId.includes(term) || email.includes(term);

      // Filters
      const matchesSource = resumeSourceFilter === 'all' || 
        (resumeSourceFilter === 'christmas' && resume.source === 'christmas_tree') ||
        (resumeSourceFilter === 'personal' && resume.source === 'personal_center') ||
        (resumeSourceFilter === 'application' && resume.source === 'job_application') ||
        (resumeSourceFilter === 'unknown' && !resume.source);

      const matchesUserType = resumeUserTypeFilter === 'all' || 
        (resumeUserTypeFilter === 'lead' && resume.userType === 'Lead') ||
        (resumeUserTypeFilter === 'registered' && resume.userType === 'Registered');

      const matchesTalentPool = resumeTalentPoolFilter === 'all' || 
        (resumeTalentPoolFilter === 'yes' && resume.metadata?.joinTalentPool === true) ||
        (resumeTalentPoolFilter === 'no' && resume.metadata?.joinTalentPool !== true);

      return matchesSearch && matchesSource && matchesUserType && matchesTalentPool;
    });

    // 2. Sort
    filteredResumes.sort((a, b) => {
      const dateA = new Date(a.uploadedAt).getTime();
      const dateB = new Date(b.uploadedAt).getTime();
      return resumeSort === 'newest' ? dateB - dateA : dateA - dateB;
    });

    const formatSize = (bytes: number) => {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatDate = (dateStr: string) => {
      if (!dateStr) return '未知时间';
      try {
        return new Date(dateStr).toLocaleString('zh-CN');
      } catch (e) {
        return dateStr;
      }
    };

    const getSourceLabel = (source: string, userType: string) => {
      if (source === 'christmas_tree') return <span className="status-badge high">圣诞树活动</span>;
      if (source === 'personal_center') return <span className="status-badge medium">个人中心</span>;
      if (source === 'job_application') return <span className="status-badge low">职位申请</span>;
      
      // Inference fallback
      if (userType === 'Registered') return <span className="status-badge medium">个人中心(推测)</span>;
      
      return <span className="status-badge text-slate-500 bg-slate-100">未知来源</span>;
    };

    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-header flex-col items-start gap-4">
            <div className="flex w-full justify-between items-center">
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
            
            {/* 筛选工具栏 */}
            <div className="w-full grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
              {/* 搜索 */}
              <div className="md:col-span-2">
                <div className="flex items-center bg-white rounded-md px-3 py-2 border border-slate-300">
                  <Search className="w-4 h-4 text-slate-400 mr-2" />
                  <input
                    type="text"
                    placeholder="搜索文件名/ID/邮箱..."
                    className="bg-transparent border-none focus:ring-0 w-full text-sm p-0"
                    value={resumeSearchTerm}
                    onChange={(e) => setResumeSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              {/* 来源筛选 */}
              <select 
                className="form-select text-sm py-2"
                value={resumeSourceFilter}
                onChange={(e) => setResumeSourceFilter(e.target.value)}
              >
                <option value="all">所有来源</option>
                <option value="christmas">圣诞树活动</option>
                <option value="personal">个人中心</option>
                <option value="application">职位申请</option>
                <option value="unknown">未知</option>
              </select>

              {/* 用户类型筛选 */}
              <select 
                className="form-select text-sm py-2"
                value={resumeUserTypeFilter}
                onChange={(e) => setResumeUserTypeFilter(e.target.value)}
              >
                <option value="all">所有用户类型</option>
                <option value="lead">潜在用户 (Lead)</option>
                <option value="registered">注册用户</option>
              </select>

              {/* 排序 */}
              <select 
                className="form-select text-sm py-2"
                value={resumeSort}
                onChange={(e) => setResumeSort(e.target.value as 'newest' | 'oldest')}
              >
                <option value="newest">最新上传</option>
                <option value="oldest">最早上传</option>
              </select>
            </div>
          </div>

          <div className="card-content">
            <div className="flex justify-between items-center mb-4 text-sm text-slate-500">
               <div>
                 <span className="mr-4">总计: <span className="font-medium text-slate-900">{resumes.length}</span></span>
                 <span>筛选结果: <span className="font-medium text-slate-900">{filteredResumes.length}</span></span>
               </div>
               <div>
                 存储提供者: <span className="font-medium text-slate-900">{storageProvider}</span>
               </div>
            </div>

            {/* 简历表格 */}
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>用户ID</th>
                    <th>用户类型</th>
                    <th>邮箱</th>
                    <th>简历来源</th>
                    <th>人才库</th>
                    <th>文件信息</th>
                    <th>上传时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {resumeLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Loader className="w-6 h-6 animate-spin mx-auto mb-2" />
                        <p className="text-slate-500">加载中...</p>
                      </td>
                    </tr>
                  ) : filteredResumes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <p className="text-slate-500">暂无符合条件的简历数据</p>
                      </td>
                    </tr>
                  ) : (
                    filteredResumes.map((resume) => {
                      const userObj = userMap[resume.userId];
                      const displayEmail = resume.metadata?.email || userObj?.email || '无邮箱';
                      const isTalentPool = resume.metadata?.joinTalentPool === true;
                      
                      return (
                      <tr key={resume.id}>
                        <td className="font-mono text-xs text-slate-500">
                          {resume.userId ? (
                            <div title={resume.userId}>
                              {resume.userId.slice(0, 8)}...
                            </div>
                          ) : '无ID'}
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            resume.userType === 'Lead' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {resume.userType === 'Lead' ? '潜在' : '注册'}
                          </span>
                        </td>
                        <td className="text-sm text-slate-700">
                          {displayEmail}
                        </td>
                        <td>
                          {getSourceLabel(resume.source, resume.userType)}
                        </td>
                        <td>
                          {isTalentPool ? (
                            <span className="text-green-600 flex items-center text-xs font-medium">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              已加入
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td>
                          <div className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={resume.fileName}>
                            {resume.fileName}
                          </div>
                          <div className="text-xs text-slate-500">{formatSize(resume.size)}</div>
                        </td>
                        <td className="text-sm text-slate-500">
                          {formatDate(resume.uploadedAt)}
                        </td>
                        <td>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => setSelectedResume(resume)}
                              className="action-btn"
                              title="查看详情"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => {
                                  const token = localStorage.getItem('haigoo_auth_token');
                                  window.open(`/api/resumes?action=download&id=${resume.id}&token=${token}`, '_blank');
                                }}
                                className="action-btn"
                                title="下载"
                              >
                                <Download className="w-4 h-4" />
                              </button>
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
                    )})
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
    <AdminSystemSettings />
  );

  const tabs = [
    { id: 'dashboard', label: '数据概览', icon: BarChart3 },
    { id: 'rss', label: 'RSS管理', icon: Rss },
    { id: 'jobs', label: '职位数据', icon: Briefcase },
    { id: 'companies', label: '全部企业', icon: Building },
    { id: 'trusted-companies', label: '可信企业', icon: CheckCircle },
    { id: 'tag-management', label: '标签管理', icon: Tag },
    { id: 'resumes', label: '简历数据', icon: FileText },
    { id: 'subscriptions', label: '订阅管理', icon: Mail },
    { id: 'users', label: '用户管理', icon: Users },
    { id: 'job-applications', label: '岗位申请', icon: Briefcase },
    { id: 'member-applications', label: '会员申请', icon: FileText },
    { id: 'analytics', label: '数据分析', icon: TrendingUp },
    { id: 'core-metrics', label: '核心看板', icon: Activity }, // New Tab
    { id: 'feedback', label: '用户反馈', icon: MessageSquare },
    { id: 'settings', label: '系统设置', icon: Settings },
    { id: 'tracking', label: '埋点管理', icon: Activity }
  ];

  return (
    <div className={`admin-panel`}>
      {/* 侧边栏导航 */}
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div>
          <div className="sidebar-logo">
            <img src={logoPng} alt="Haigoo" className="w-10 h-10 object-contain" />
            {!sidebarCollapsed && (
              <div className="logo-text">
                <h1>Haigoo</h1>
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
            <h1>{tabs.find(t => t.id === activeTab)?.label || 'Haigoo Team Admin System'}</h1>
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
            </div>
          ) : (
            <div className="admin-content">
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'rss' && renderRSSManagement()}
              {activeTab === 'jobs' && renderJobDataManagement()}
              {activeTab === 'resumes' && renderResumeLibrary()}
              {activeTab === 'subscriptions' && <SubscriptionsTable />}
              {activeTab === 'users' && <UserManagementPage />}
              {activeTab === 'job-applications' && <AdminApplicationsPage />}
              {activeTab === 'member-applications' && <AdminMemberApplicationsPage />}
              {activeTab === 'companies' && <AdminCompanyManagementPage />}
              {activeTab === 'trusted-companies' && <AdminTrustedCompaniesPage />}
              {activeTab === 'tag-management' && <AdminTagManagementPage />}
              {activeTab === 'analytics' && renderAnalytics()}
              {activeTab === 'core-metrics' && <AdminTrackingDashboard />}
              {activeTab === 'feedback' && renderFeedbackList()}
              {activeTab === 'settings' && renderSettings()}
              {activeTab === 'tracking' && <AdminTrackingManagement />}
            </div>
          )}
        </div>
      </main>

      {/* 定时任务测试控件 */}
      <CronTestControl />

      {/* 简历详情模态框 */}
      {selectedResume && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedResume(null);
            }
          }}
        >
          <div className="modal" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>简历详情</h3>
              <button
                onClick={() => setSelectedResume(null)}
                className="modal-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="modal-content">
              <div className="space-y-6">
                {/* 基本信息 */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-slate-500">文件名</label>
                    <div className="font-medium">{selectedResume.fileName}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">文件大小</label>
                    <div className="font-medium">{selectedResume.size ? (selectedResume.size / 1024).toFixed(1) + ' KB' : '未知'}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">上传时间</label>
                    <div className="font-medium">{new Date(selectedResume.uploadedAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">来源</label>
                    <div className="font-medium">
                      {selectedResume.source === 'christmas_tree' ? '圣诞树活动' :
                       selectedResume.source === 'personal_center' ? '个人中心' :
                       selectedResume.source === 'job_application' ? '职位申请' :
                       selectedResume.source || '未知'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">用户ID</label>
                    <div className="font-medium text-xs font-mono bg-slate-100 p-1 rounded">{selectedResume.userId || '无'}</div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-500">用户类型</label>
                    <div className="font-medium">{selectedResume.userType === 'Lead' ? '潜在用户' : '注册用户'}</div>
                  </div>
                </div>

                {/* 原始元数据 */}
                <div>
                  <label className="text-sm text-slate-500 mb-2 block">原始元数据 (Metadata)</label>
                  <pre className="bg-slate-900 text-slate-50 p-4 rounded-lg overflow-x-auto text-xs font-mono max-h-60">
                    {JSON.stringify(selectedResume.metadata || {}, null, 2)}
                  </pre>
                </div>

                {/* 解析结果 (如果有) - 已弃用，不再展示 */}
                
                {/* 原始文本预览 (如果存在) */}
                {selectedResume.contentText && (
                   <div>
                    <label className="text-sm text-slate-500 mb-2 block">文本内容预览 (前500字符)</label>
                    <div className="bg-slate-50 p-4 rounded-lg text-xs text-slate-600 border border-slate-200 whitespace-pre-wrap font-mono">
                      {selectedResume.contentText.slice(0, 500)}
                      {selectedResume.contentText.length > 500 && '...'}
                    </div>
                   </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setSelectedResume(null)}
                className="btn-secondary"
              >
                关闭
              </button>
              {selectedResume.id && (
                <button
                    onClick={() => {
                      const token = localStorage.getItem('haigoo_auth_token');
                      window.open(`/api/resumes?action=download&id=${selectedResume.id}&token=${token}`, '_blank');
                    }}
                    className="btn-primary"
                >
                    <Download className="w-4 h-4 mr-2" />
                    下载原文件
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
                onClick={handleSaveRSSSource}
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
