import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Database, RefreshCw, Trash2, CheckCircle,
  Filter,
  Briefcase, BarChart3, Loader, Edit3, Eye, Link as LinkIcon,
  MapPin, Calendar, Server, Star, ExternalLink, Info, Plus, Building, X,
  ChevronLeft, ChevronRight, HelpCircle, ArrowUp, ArrowDown
} from 'lucide-react';
import { JobCategory } from '../types/rss-types';
import { dataManagementService, RawRSSData, ProcessedJobData, StorageStats } from '../services/data-management-service';
import { processedJobsService } from '../services/processed-jobs-service';
import { useNotificationHelpers } from './NotificationSystem';
import { EditJobModal } from './EditJobModal';
// 简历库相关逻辑已迁移至独立页面

// Define skill keywords for recommendations
import MultiSelectDropdown from './MultiSelectDropdown';

const SKILL_KEYWORDS = [
  // Programming Languages
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust', 'PHP', 'Ruby', 'Swift', 'Kotlin',
  // Frontend
  'React', 'Vue', 'Angular', 'HTML', 'CSS', 'Sass', 'Less', 'Webpack', 'Vite', 'Next.js', 'TailwindCSS',
  // Backend
  'Node.js', 'Express', 'Django', 'Flask', 'Spring', 'Laravel', 'Rails', 'NestJS',
  // Database
  'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch',
  // Cloud & DevOps
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD',
  // Tools
  'Git', 'Jenkins', 'Jira', 'Confluence'
];

const LOCATION_OPTIONS = [
  { label: '远程', value: 'Remote' },
  { label: '中国', value: 'China' },
  { label: '美国', value: 'USA' },
  { label: '欧洲', value: 'Europe' },
  { label: '亚太', value: 'APAC' },
  { label: '全球', value: 'Global' }
];

const LEVEL_OPTIONS = [
  { label: '初级 (Entry)', value: 'Entry' },
  { label: '中级 (Mid)', value: 'Mid' },
  { label: '高级 (Senior)', value: 'Senior' },
  { label: '专家 (Lead)', value: 'Lead' },
  { label: '管理 (Executive)', value: 'Executive' }
];

const SOURCE_OPTIONS = [
  { label: 'WeWorkRemotely', value: 'WeWorkRemotely' },
  { label: 'Remotive', value: 'Remotive' },
  { label: 'Himalayas', value: 'Himalayas' },
  { label: 'NoDesk', value: 'NoDesk' },
  { label: '企业官网/认证企业', value: 'special:official' },
  { label: '人工录入', value: 'special:manual' }
];

const INDUSTRY_OPTIONS = [
  { label: '互联网/软件', value: '互联网/软件' },
  { label: '企业服务/SaaS', value: '企业服务/SaaS' },
  { label: '人工智能', value: '人工智能' },
  { label: '大健康/医疗', value: '大健康/医疗' },
  { label: '教育', value: '教育' },
  { label: '金融/Fintech', value: '金融/Fintech' },
  { label: 'Web3/区块链', value: 'Web3/区块链' },
  { label: '电子商务', value: '电子商务' },
  { label: '游戏', value: '游戏' },
  { label: '媒体/娱乐', value: '媒体/娱乐' },
  { label: '硬件/物联网', value: '硬件/物联网' },
  { label: '消费生活', value: '消费生活' }
];

interface DataManagementTabsProps {
  className?: string;
}

const DataManagementTabs: React.FC<DataManagementTabsProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<'processed' | 'jobstats'>('processed');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('');
  const { showSuccess, showError } = useNotificationHelpers();

  // Job stats state
  const [jobStatsJobs, setJobStatsJobs] = useState<any[]>([]); // raw job list for cross-filter
  const [jobStats, setJobStats] = useState<{
    byCategory: { label: string; count: number }[];
    byJobType: { label: string; count: number }[];
    byLevel: { label: string; count: number }[];
    total: number;
  } | null>(null);
  // Cross-filter selections (multi-select)
  const [sfLevels, setSfLevels] = useState<string[]>([]);
  const [sfJobTypes, setSfJobTypes] = useState<string[]>([]);
  const [sfCategories, setSfCategories] = useState<string[]>([]);

  // 原始数据状态
  const [rawData, setRawData] = useState<RawRSSData[]>([]);
  const [rawDataTotal, setRawDataTotal] = useState(0);
  const [rawDataPage, setRawDataPage] = useState(1);
  const [rawDataPageSize] = useState(20);

  // 处理后数据状态
  // 全部数据状态
  const [processedData, setProcessedData] = useState<ProcessedJobData[]>([]);
  const [processedDataTotal, setProcessedDataTotal] = useState(0);
  const [processedDataPage, setProcessedDataPage] = useState(1);
  const [processedDataPageSize] = useState(20);
  const [locationCategories, setLocationCategories] = useState<{ domesticKeywords: string[]; overseasKeywords: string[]; globalKeywords: string[] }>({ domesticKeywords: [], overseasKeywords: [], globalKeywords: [] });
  // Dynamic categories from backend
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // 存储统计状态 (legacy, kept for backward-compat)
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);

  // 过滤器状态
  const [processedDataFilters, setProcessedDataFilters] = useState<{
    category?: string[];
    company?: string;
    // 新增：关键词搜索（岗位名称/公司/描述/地点/标签）
    search?: string;
    experienceLevel?: string[];
    tags?: string[];
    industry?: string[];
    source?: string[];
    location?: string[];
    isFeatured?: boolean;
    isApproved?: boolean;
    sortBy?: string;
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
        setProcessedDataPage(1); // Reset to page 1 on search
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

  // 加载处理后数据
  const loadProcessedData = useCallback(async () => {
    try {
      setLoading(true);

      // Convert array filters to comma-separated strings
      const filters = {
        ...processedDataFilters,
        category: processedDataFilters.category?.join(','),
        industry: processedDataFilters.industry?.join(','),
        source: processedDataFilters.source?.join(','),
        experienceLevel: processedDataFilters.experienceLevel?.join(','),
        location: processedDataFilters.location?.join(','),
      };

      const result = await dataManagementService.getProcessedJobs(
        processedDataPage,
        processedDataPageSize,
        filters as any
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
          // Use hardcoded skill tags instead of company tags for recommendations
          setAvailableTags(SKILL_KEYWORDS);
        } else {
          setAvailableTags(SKILL_KEYWORDS);
        }
      } catch (error) {
        console.error('Failed to load job categories/tags:', error);
        setAvailableTags(SKILL_KEYWORDS);
      }
    };
    loadCategories();
  }, [activeTab]);

  // 加载岗位统计
  const loadJobStats = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch all approved jobs (up to 5000) for full-stats aggregation
      const res = await processedJobsService.getProcessedJobs(1, 5000, { isApproved: true });
      const jobs = res.jobs || [];
      setJobStatsJobs(jobs);

      const levelLabel: Record<string, string> = {
        Entry: '初级 (Entry)', Mid: '中级 (Mid)', Senior: '高级 (Senior)',
        Lead: '专家 (Lead)', Executive: '管理 (Executive)'
      };
      const typeLabel: Record<string, string> = {
        'full-time': '全职', 'fulltime': '全职', 'full time': '全职',
        'part-time': '兼职', 'parttime': '兼职', 'part time': '兼职',
        'contract': '合同工', 'freelance': '自由职业', 'intern': '实习', 'internship': '实习'
      };

      const catMap: Record<string, number> = {};
      const typeMap: Record<string, number> = {};
      const levelMap: Record<string, number> = {};

      for (const job of jobs) {
        // 岗位角色（category 字段）
        const cat = job.category || '未分类';
        catMap[cat] = (catMap[cat] || 0) + 1;

        // 工作类型（jobType 字段：全职/兼职/实习…）
        const rawType = ((job as any).jobType || (job as any).type || '').toLowerCase();
        let resolvedType = '其他';
        for (const [key, val] of Object.entries(typeLabel)) {
          if (rawType === key || rawType.includes(key)) { resolvedType = val; break; }
        }
        typeMap[resolvedType] = (typeMap[resolvedType] || 0) + 1;

        // 岗位级别（experienceLevel 字段）
        const lvl = job.experienceLevel || '';
        const resolvedLevel = levelLabel[lvl] || (lvl || '未定义');
        levelMap[resolvedLevel] = (levelMap[resolvedLevel] || 0) + 1;
      }

      const sort = (map: Record<string, number>) =>
        Object.entries(map).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);

      setJobStats({
        byCategory: sort(catMap),
        byJobType: sort(typeMap),
        byLevel: sort(levelMap),
        total: jobs.length
      });
      // Reset cross-filter selections
      setSfLevels([]); setSfJobTypes([]); setSfCategories([]);
    } catch (error) {
      console.error('加载岗位统计失败:', error);
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

      // 重新加载数据
      await loadProcessedData();
      await loadJobStats();

      showSuccess('同步完成', autoProcess ? '已拉取最新RSS并自动处理为岗位数据' : '已拉取最新RSS数据');
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
      const syncResult = await dataManagementService.syncAllRSSData(false);
      await loadProcessedData();
      await loadJobStats();
      showSuccess('刷新完成', `数据已更新，本次新增/更新 ${syncResult.newJobsAdded || 0} 条草稿岗位`);
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
  const handleSaveEdit = async (updatedJob: Partial<ProcessedJobData>, shouldClose: boolean = true) => {
    console.log('[Frontend] Saving job edit:', updatedJob); // Debug Log
    if (!editingJob) return;

    try {
      // 乐观更新：立即更新本地状态
      const updatedData = processedData.map(job =>
        job.id === editingJob.id ? { ...job, ...updatedJob } : job
      );
      setProcessedData(updatedData as ProcessedJobData[]);

      if (editingJob.id) {
        // 检查标题是否改变，如果改变则清除翻译
        if (updatedJob.title && updatedJob.title !== editingJob.title) {
          console.log('[Frontend] Title changed, clearing translation title');
          const currentTranslations = (updatedJob as any).translations || editingJob.translations || {};
          const newTranslations = { ...currentTranslations };
          delete newTranslations.title;
          (updatedJob as any).translations = newTranslations;
          (updatedJob as any).isTranslated = false;
        }

        // 检查公司名是否改变，如果改变则清除翻译
        if (updatedJob.company && updatedJob.company !== editingJob.company) {
          console.log('[Frontend] Company changed, clearing translation company');
          const currentTranslations = (updatedJob as any).translations || editingJob.translations || {};
          const newTranslations = { ...currentTranslations };
          delete newTranslations.company;
          (updatedJob as any).translations = newTranslations;
        }

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

      if (shouldClose) {
        setShowEditModal(false);
        setEditingJob(null);
      } else {
        showSuccess('保存成功', '职位信息已更新');
      }

      // 重新加载数据以显示最新状态
      // Use a slight delay to ensure DB write is propagated if reading from secondary or cache
      setTimeout(() => loadProcessedData(), 500);
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
    const currentList = processedData;
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
    if (activeTab === 'processed') {
      loadProcessedData();
    } else if (activeTab === 'jobstats') {
      loadJobStats();
    }
  }, [activeTab, loadProcessedData, loadJobStats]);

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


  const renderProcessedDataTable = () => (

    <div className="bg-white rounded-xl shadow-sm border border-slate-200">
      {/* 过滤器 */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="flex items-center gap-1 mr-2">
              <Filter className="w-4 h-4 text-slate-500" />
            </div>

            <MultiSelectDropdown
              label="分类"
              options={availableCategories.length > 0 ? availableCategories.map(c => ({ label: c, value: c })) : [
                { label: '前端开发', value: '前端开发' },
                { label: '后端开发', value: '后端开发' },
                { label: '全栈开发', value: '全栈开发' },
                { label: '产品经理', value: '产品经理' },
                { label: 'UI/UX设计', value: 'UI/UX设计' },
                { label: '数据分析', value: '数据分析' },
                { label: '运营', value: '运营' },
                { label: '市场营销', value: '市场营销' },
                { label: '其他', value: '其他' }
              ]}
              selected={processedDataFilters.category || []}
              onChange={(selected) => {
                setProcessedDataFilters({ ...processedDataFilters, category: selected });
                setProcessedDataPage(1);
              }}
            />

            <MultiSelectDropdown
              label="级别"
              options={LEVEL_OPTIONS}
              selected={processedDataFilters.experienceLevel || []}
              onChange={(selected) => {
                setProcessedDataFilters({ ...processedDataFilters, experienceLevel: selected });
                setProcessedDataPage(1);
              }}
            />

            <MultiSelectDropdown
              label="行业"
              options={INDUSTRY_OPTIONS}
              selected={processedDataFilters.industry || []}
              onChange={(selected) => {
                setProcessedDataFilters({ ...processedDataFilters, industry: selected });
                setProcessedDataPage(1);
              }}
            />

            <MultiSelectDropdown
              label="来源"
              options={SOURCE_OPTIONS}
              selected={processedDataFilters.source || []}
              onChange={(selected) => {
                setProcessedDataFilters({ ...processedDataFilters, source: selected });
                setProcessedDataPage(1);
              }}
            />

            <MultiSelectDropdown
              label="地点"
              options={LOCATION_OPTIONS}
              selected={processedDataFilters.location || []}
              onChange={(selected) => {
                setProcessedDataFilters({ ...processedDataFilters, location: selected });
                setProcessedDataPage(1);
              }}
            />

            <div className="w-48">
              <input
                type="text"
                placeholder="搜索岗位/公司..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <button
              onClick={() => setProcessedDataFilters({})}
              className="px-3 py-2.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              清除
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddJob()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
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
              <th className="w-32 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">地点/远程</th>
              {/* <th className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">区域分类</th> */}
              <th className="w-40 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">技能标签</th>
              <th
                className="w-24 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors group select-none"
                onClick={() => {
                  const currentSort = processedDataFilters.sortBy;
                  let nextSort;
                  if (currentSort === 'published_at_desc') {
                    nextSort = 'published_at_asc';
                  } else if (currentSort === 'published_at_asc') {
                    nextSort = undefined; // 取消排序，或者回到默认
                  } else {
                    nextSort = 'published_at_desc';
                  }
                  setProcessedDataFilters({ ...processedDataFilters, sortBy: nextSort });
                  setProcessedDataPage(1);
                }}
              >
                <div className="flex items-center gap-1">
                  发布日期
                  <div className="flex flex-col">
                    <ArrowUp className={`w-2 h-2 ${processedDataFilters.sortBy === 'published_at_asc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                    <ArrowDown className={`w-2 h-2 -mt-0.5 ${processedDataFilters.sortBy === 'published_at_desc' ? 'text-indigo-600' : 'text-slate-300'}`} />
                  </div>
                </div>
              </th>
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

                  {/* 8. 区域分类 (对应 DB region) - 已隐藏
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
                */}

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

  const renderJobStats = () => {
    if (!jobStats) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader className="w-7 h-7 animate-spin text-indigo-600 mr-2" />
          <span className="text-slate-500">加载中...</span>
        </div>
      );
    }

    // ── helpers ─────────────────────────────────────────────────────
    const levelLabel: Record<string, string> = {
      Entry: '初级 (Entry)', Mid: '中级 (Mid)', Senior: '高级 (Senior)',
      Lead: '专家 (Lead)', Executive: '管理 (Executive)'
    };
    const typeLabel: Record<string, string> = {
      'full-time': '全职', 'fulltime': '全职', 'full time': '全职',
      'part-time': '兼职', 'parttime': '兼职', 'part time': '兼职',
      'contract': '合同工', 'freelance': '自由职业', 'intern': '实习', 'internship': '实习'
    };
    const resolveType = (raw: string) => {
      const r = raw.toLowerCase();
      for (const [k, v] of Object.entries(typeLabel)) { if (r === k || r.includes(k)) return v; }
      return '其他';
    };
    const resolveLevel = (lvl: string) => levelLabel[lvl] || (lvl || '未定义');

    // ── compute cross-filter result ──────────────────────────────────
    const hasSfFilter = sfLevels.length > 0 || sfJobTypes.length > 0 || sfCategories.length > 0;
    const filteredJobs = hasSfFilter ? jobStatsJobs.filter(job => {
      const cat = job.category || '未分类';
      const lvl = resolveLevel(job.experienceLevel || '');
      const typ = resolveType((job as any).jobType || (job as any).type || '');
      const catOk = sfCategories.length === 0 || sfCategories.includes(cat);
      const lvlOk = sfLevels.length === 0 || sfLevels.includes(lvl);
      const typOk = sfJobTypes.length === 0 || sfJobTypes.includes(typ);
      return catOk && lvlOk && typOk;
    }) : [];

    // ── cross-filter breakdown table ─────────────────────────────────
    // Group by the dimensions NOT yet pinned, so user can see next level
    const crossBreakdown: { key: string; count: number }[] = [];
    if (hasSfFilter) {
      const breakMap: Record<string, number> = {};
      for (const job of filteredJobs) {
        // Show category if not filtered, else level, else type
        const part: string[] = [];
        if (sfCategories.length > 0) part.push(job.category || '未分类');
        if (sfLevels.length > 0) part.push(resolveLevel(job.experienceLevel || ''));
        if (sfJobTypes.length > 0) part.push(resolveType((job as any).jobType || (job as any).type || ''));
        const key = part.join(' · ');
        breakMap[key] = (breakMap[key] || 0) + 1;
      }
      Object.entries(breakMap)
        .sort((a, b) => b[1] - a[1])
        .forEach(([key, count]) => crossBreakdown.push({ key, count }));
    }

    // ── chip helpers ──────────────────────────────────────────────────
    const toggle = <T extends string>(arr: T[], v: T, set: (x: T[]) => void) => {
      set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);
    };

    const FilterChips = ({ title, items, selected, onToggle, colorClass }: {
      title: string; items: { label: string; count: number }[];
      selected: string[]; onToggle: (v: string) => void; colorClass: string;
    }) => (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-indigo-500" />{title}
          </h3>
          {selected.length > 0 && (
            <button onClick={() => onToggle('__clear__')} className="text-xs text-slate-400 hover:text-red-500">
              清除选择
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {items.map(({ label, count }) => {
            const active = selected.includes(label);
            return (
              <button
                key={label}
                onClick={() => onToggle(label)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-all ${active
                  ? `${colorClass} text-white border-transparent font-medium shadow-sm`
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
              >
                {label}
                <span className={`font-mono ${active ? 'text-white/80' : 'text-slate-400'}`}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    );

    const clearCategories = (v: string) => v === '__clear__' ? setSfCategories([]) : toggle(sfCategories, v, setSfCategories);
    const clearLevels = (v: string) => v === '__clear__' ? setSfLevels([]) : toggle(sfLevels, v, setSfLevels);
    const clearJobTypes = (v: string) => v === '__clear__' ? setSfJobTypes([]) : toggle(sfJobTypes, v, setSfJobTypes);

    // ── bar-chart stat group (overview) ───────────────────────────────
    const StatGroup = ({ title, rows, colorFn }: {
      title: string; rows: { label: string; count: number }[]; colorFn?: (l: string) => string;
    }) => (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-500" />{title}
        </h3>
        <div className="space-y-2.5">
          {rows.map(({ label, count }) => {
            const pct = jobStats.total > 0 ? Math.round((count / jobStats.total) * 100) : 0;
            return (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-slate-700 truncate max-w-[60%]">{label}</span>
                  <span className="text-slate-500 ml-2">{count} 件<span className="ml-1 text-slate-400">({pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${colorFn ? colorFn(label) : 'bg-indigo-400'}`}
                    style={{ width: `${Math.max(pct, 1)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    const typeColor = (l: string) => {
      if (l === '全职') return 'bg-green-400'; if (l === '兼职') return 'bg-indigo-400';
      if (l === '合同工') return 'bg-orange-400'; if (l === '自由职业') return 'bg-purple-400';
      if (l === '实习') return 'bg-yellow-400'; return 'bg-slate-400';
    };
    const levelColor = (l: string) => {
      if (l.includes('初级')) return 'bg-green-400'; if (l.includes('中级')) return 'bg-indigo-400';
      if (l.includes('高级')) return 'bg-orange-400'; if (l.includes('专家')) return 'bg-red-400';
      if (l.includes('管理')) return 'bg-purple-400'; return 'bg-slate-400';
    };

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            已审核通过岗位总计：<span className="font-bold text-slate-800">{jobStats.total}</span> 条
          </p>
          <button
            onClick={loadJobStats}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />刷新统计
          </button>
        </div>

        {/* ── Cross-filter section ── */}
        <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl border border-indigo-100 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-700">交叉筛选分析</span>
            <span className="text-xs text-slate-400">多选条件组合看岗位数量</span>
            {hasSfFilter && (
              <button
                onClick={() => { setSfLevels([]); setSfJobTypes([]); setSfCategories([]); }}
                className="ml-auto text-xs text-red-400 hover:text-red-600 border border-red-200 px-2 py-0.5 rounded-full"
              >
                清除全部
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <FilterChips
              title="岗位角色"
              items={jobStats.byCategory}
              selected={sfCategories}
              onToggle={clearCategories}
              colorClass="bg-indigo-500"
            />
            <FilterChips
              title="岗位级别"
              items={jobStats.byLevel}
              selected={sfLevels}
              onToggle={clearLevels}
              colorClass="bg-orange-500"
            />
            <FilterChips
              title="工作类型"
              items={jobStats.byJobType}
              selected={sfJobTypes}
              onToggle={clearJobTypes}
              colorClass="bg-green-500"
            />
          </div>

          {/* Cross-filter result */}
          {hasSfFilter && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-slate-700">
                  筛选结果：<span className="text-indigo-600">{filteredJobs.length}</span> 条符合条件的岗位
                </span>
                <div className="flex gap-1 flex-wrap justify-end">
                  {[...sfCategories.map(v => ({ v, color: 'bg-indigo-100 text-indigo-700' })),
                  ...sfLevels.map(v => ({ v, color: 'bg-orange-100 text-orange-700' })),
                  ...sfJobTypes.map(v => ({ v, color: 'bg-green-100 text-green-700' }))
                  ].map(({ v, color }) => (
                    <span key={v} className={`text-xs px-2 py-0.5 rounded-full ${color} font-medium`}>{v}</span>
                  ))}
                </div>
              </div>
              {crossBreakdown.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {crossBreakdown.map(({ key, count }) => {
                    const pct = filteredJobs.length > 0 ? Math.round((count / filteredJobs.length) * 100) : 0;
                    return (
                      <div key={key} className="flex items-center gap-3 text-xs">
                        <span className="text-slate-600 min-w-0 flex-1 truncate">{key}</span>
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                        </div>
                        <span className="text-slate-500 tabular-nums w-14 text-right">{count} 件 ({pct}%)</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {!hasSfFilter && (
            <p className="text-xs text-slate-400 text-center py-2">↑ 点击上方标签进行多选筛选，可组合查看任意条件下的岗位数量</p>
          )}
        </div>

        {/* ── Overview bar charts ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <StatGroup title="岗位角色分布（全量）" rows={jobStats.byCategory} />
          </div>
          <StatGroup title="工作类型分布" rows={jobStats.byJobType} colorFn={typeColor} />
          <StatGroup title="岗位级别分布" rows={jobStats.byLevel} colorFn={levelColor} />
        </div>
      </div>
    );
  };


  return (
    <div className={`space-y-6 ${className}`}>
      {/* 头部操作栏 */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          {renderTabButton('processed', '全部数据', <Briefcase className="w-4 h-4" />)}
          {renderTabButton('jobstats', '岗位统计', <BarChart3 className="w-4 h-4" />)}
        </div>

        <div className="flex gap-2">

          <div className="flex gap-2 items-center">
            <select
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={processedDataFilters.isApproved === undefined ? '' : processedDataFilters.isApproved.toString()}
              onChange={(e) => {
                const val = e.target.value;
                setProcessedDataFilters(prev => ({
                  ...prev,
                  isApproved: val === '' ? undefined : val === 'true'
                }));
                setProcessedDataPage(1);
              }}
            >
              <option value="">全部审核状态</option>
              <option value="true">已审核 (Approved)</option>
              <option value="false">待审核 (Pending)</option>
            </select>

            <Tooltip content={
              <div className="text-left space-y-2">
                <p className="font-semibold text-indigo-200">当前后台数据流程：</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li><span className="font-medium text-white">抓取 RSS：</span>拉取最近 7 天的 RSS 原始数据，写入后台参考池。</li>
                  <li><span className="font-medium text-white">处理草稿：</span>把原始 RSS 转成待审核岗位草稿，不会直接上前台。</li>
                  <li><span className="font-medium text-white">补翻译：</span>每日仅为最近 7 天的 RSS 草稿补翻译，方便后台编辑审核。</li>
                  <li><span className="font-medium text-white">可信企业爬取：</span>仅保留后台手动触发，用于人工补录和核查。</li>
                </ol>
                <p className="text-xs text-slate-400 mt-2 border-t border-slate-600 pt-2">
                  💡 当前自动任务以“后台参考与补数”为主，公开前台仍只展示人工审核通过的岗位。
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
          {activeTab === 'processed' && renderProcessedDataTable()}
          {activeTab === 'jobstats' && renderJobStats()}
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
