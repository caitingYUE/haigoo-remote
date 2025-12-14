import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processedJobsService } from '../services/processed-jobs-service'
import { Job as RSSJob } from '../types/rss-types';
import { dataRetentionService, RetentionStats } from '../services/data-retention-service';
import './AdminPanel.css';

interface AdminPanelProps {
  className?: string;
}

type TabType = 'raw' | 'processed' | 'stats' | 'retention';

interface SimpleUnifiedJob {
  id: string;
  jobTitle: string;
  category: string;
  level: string;
  companyName: string;
  industryType: string;
  jobType: string;
  region?: 'domestic' | 'overseas';
  locationRestriction: string;
  skillTags: string[];
  languageRequirements: string;
  dataQuality: number;
  sourceUrl: string;
  publishDate: string;
}

interface SimpleStats {
  totalRaw: number;
  totalProcessed: number;
  successRate: number;
  averageQuality: number;
  categoryDistribution: Record<string, number>;
  sourceDistribution: Record<string, number>;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ className }) => {
  const [activeTab, setActiveTab] = useState<TabType>('raw');
  const [rawJobs, setRawJobs] = useState<RSSJob[]>([]);
  const [processedJobs, setProcessedJobs] = useState<SimpleUnifiedJob[]>([]);
  const [stats, setStats] = useState<SimpleStats | null>(null);
  const [retentionStats, setRetentionStats] = useState<RetentionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 模拟RSS原始数据
      const mockRawJobs: RSSJob[] = [
        {
          id: '1',
          title: 'Senior React Developer',
          company: 'Tech Corp',
          location: 'Remote',
          description: 'We are looking for a senior React developer with 5+ years of experience...',
          url: 'https://example.com/job/1',
          requirements: ['React', 'TypeScript', 'Node.js', 'AWS'],
          salary: '$120,000 - $150,000',
          publishedAt: '2024-01-15',
          source: 'https://example.com/job/1',
          tags: ['React', 'TypeScript', 'Remote'],
          category: '前端开发',
          jobType: 'full-time',
          experienceLevel: 'Senior',
          benefits: ['Health Insurance', 'Remote Work'],
          isRemote: true,
          status: 'active',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z'
        },
        {
          id: '2',
          title: '产品经理',
          company: '创新科技公司',
          location: '北京',
          description: '负责产品规划和管理，需要3年以上产品经验...',
          url: 'https://example.com/job/2',
          requirements: ['产品管理', '数据分析', '用户研究'],
          salary: '25万-35万',
          publishedAt: '2024-01-14',
          source: 'https://example.com/job/2',
          tags: ['产品管理', '数据分析'],
          category: '产品经理',
          jobType: 'full-time',
          experienceLevel: 'Mid',
          benefits: ['五险一金', '年终奖'],
          isRemote: false,
          status: 'active',
          createdAt: '2024-01-14T10:00:00Z',
          updatedAt: '2024-01-14T10:00:00Z'
        },
        {
          id: '3',
          title: 'DevOps Engineer - Remote',
          company: 'Cloud Solutions Inc',
          location: 'Anywhere',
          description: 'Join our DevOps team to manage cloud infrastructure and CI/CD pipelines...',
          url: 'https://example.com/job/3',
          requirements: ['Docker', 'Kubernetes', 'AWS', 'Jenkins', 'Python'],
          salary: '$100,000 - $130,000',
          publishedAt: '2024-01-13',
          source: 'https://example.com/job/3',
          tags: ['DevOps', 'AWS', 'Docker'],
          category: '运维/SRE',
          jobType: 'full-time',
          experienceLevel: 'Mid',
          benefits: ['Stock Options', 'Flexible Hours'],
          isRemote: true,
          status: 'active',
          createdAt: '2024-01-13T10:00:00Z',
          updatedAt: '2024-01-13T10:00:00Z'
        }
      ];

      setRawJobs(mockRawJobs);

      // 模拟处理后的统一数据
      const mockProcessedJobs: SimpleUnifiedJob[] = [
        {
          id: '1',
          jobTitle: 'Senior React Developer',
          category: 'DEVELOPMENT',
          level: 'SENIOR',
          companyName: 'Tech Corp',
          industryType: 'TECHNOLOGY',
          jobType: 'FULL_TIME',
          region: 'overseas',
          locationRestriction: 'NO_RESTRICTION',
          skillTags: ['React', 'TypeScript', 'Node.js', 'AWS'],
          languageRequirements: 'English (Business)',
          dataQuality: 85,
          sourceUrl: 'https://example.com/job/1',
          publishDate: '2024-01-15'
        },
        {
          id: '2',
          jobTitle: '产品经理',
          category: 'PRODUCT',
          level: 'MID',
          companyName: '创新科技公司',
          industryType: 'TECHNOLOGY',
          jobType: 'FULL_TIME',
          region: 'domestic',
          locationRestriction: 'SPECIFIC_REGIONS',
          skillTags: ['产品管理', '数据分析', '用户研究'],
          languageRequirements: '中文 (母语)',
          dataQuality: 78,
          sourceUrl: 'https://example.com/job/2',
          publishDate: '2024-01-14'
        },
        {
          id: '3',
          jobTitle: 'DevOps Engineer',
          category: 'DEVOPS',
          level: 'MID',
          companyName: 'Cloud Solutions Inc',
          industryType: 'TECHNOLOGY',
          jobType: 'FULL_TIME',
          region: 'overseas',
          locationRestriction: 'NO_RESTRICTION',
          skillTags: ['Docker', 'Kubernetes', 'AWS', 'Jenkins', 'Python'],
          languageRequirements: 'English (Fluent)',
          dataQuality: 92,
          sourceUrl: 'https://example.com/job/3',
          publishDate: '2024-01-13'
        }
      ];

      setProcessedJobs(mockProcessedJobs);

      // 生成统计信息
      const categoryDist: Record<string, number> = {};
      const sourceDist: Record<string, number> = {};

      mockProcessedJobs.forEach(job => {
        categoryDist[job.category] = (categoryDist[job.category] || 0) + 1;
        const domain = new URL(job.sourceUrl).hostname;
        sourceDist[domain] = (sourceDist[domain] || 0) + 1;
      });

      const simpleStats: SimpleStats = {
        totalRaw: mockRawJobs.length,
        totalProcessed: mockProcessedJobs.length,
        successRate: (mockProcessedJobs.length / mockRawJobs.length) * 100,
        averageQuality: mockProcessedJobs.reduce((sum, job) => sum + job.dataQuality, 0) / mockProcessedJobs.length,
        categoryDistribution: categoryDist,
        sourceDistribution: sourceDist
      };

      setStats(simpleStats);

      // 获取数据保留统计
      const retention = await dataRetentionService.getRetentionStats();
      setRetentionStats(retention);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const cleanupStats = await dataRetentionService.manualCleanup();
      setRetentionStats(cleanupStats);
      await loadData(); // 重新加载数据
    } catch (err) {
      setError(err instanceof Error ? err.message : '清理数据失败');
    } finally {
      setLoading(false);
    }
  };

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

  const renderTabContent = () => {
    if (loading) {
      return <div className="loading">加载中...</div>;
    }

    if (error) {
      return <div className="error">错误: {error}</div>;
    }

    switch (activeTab) {
      case 'raw':
        return <RawJobsTable jobs={rawJobs} onExport={() => handleExport('raw')} />;
      case 'processed':
        return <ProcessedJobsTable jobs={processedJobs} onExport={() => handleExport('processed')} />;
      case 'stats':
        return <StatsPanel stats={stats} />;
      case 'retention':
        return <RetentionPanel stats={retentionStats} onCleanup={handleCleanup} loading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className={`admin-panel ${className || ''}`}>
      {/* 侧边栏导航 */}
      <aside className="admin-sidebar">
        <div>
          <div className="sidebar-logo">
            <div className="logo-icon">海</div>
            <div className="logo-text">
              <h1>海狗招聘</h1>
              <p>数据管理后台</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link to="/admin_team" className="nav-item">
              <span className="material-symbols-outlined">dashboard</span>
              数据概览
            </Link>
            <Link to="/admin/data" className="nav-item active">
              <span className="material-symbols-outlined">rss_feed</span>
              职位数据
            </Link>
            <Link to="/admin/companies" className="nav-item">
              <span className="material-symbols-outlined">business</span>
              企业管理
            </Link>
            <Link to="/admin/tag-management" className="nav-item">
              <span className="material-symbols-outlined">label</span>
              标签管理
            </Link>
            <Link to="/admin/users" className="nav-item">
              <span className="material-symbols-outlined">people</span>
              求职者管理
            </Link>
            <Link to="/admin/applications" className="nav-item">
              <span className="material-symbols-outlined">assignment_ind</span>
              会员申请
            </Link>
            <a href="#" className="nav-item">
              <span className="material-symbols-outlined">storage</span>
              数据保留
            </a>
            <a href="#" className="nav-item">
              <span className="material-symbols-outlined">analytics</span>
              数据分析
            </a>
            <a href="#" className="nav-item">
              <span className="material-symbols-outlined">settings</span>
              系统设置
            </a>
          </nav>
        </div>

        <div className="sidebar-footer">
          <a href="#" className="nav-item">
            <span className="material-symbols-outlined">help</span>
            帮助中心
          </a>
          <a href="#" className="nav-item">
            <span className="material-symbols-outlined">logout</span>
            退出登录
          </a>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="admin-main">
        <div className="admin-container">
          {/* 页面头部 */}
          <header className="admin-header">
            <h1>海狗招聘数据管理后台</h1>
            <div className="header-actions">
              <button
                className="btn-primary"
                onClick={handleRefresh}
                disabled={loading}
              >
                <span className="material-symbols-outlined">refresh</span>
                {loading ? '刷新中...' : '刷新数据'}
              </button>
            </div>
          </header>

          {/* 标签页导航 */}
          <div className="admin-tabs">
            <nav className="tabs-nav">
              <a
                href="#"
                className={`tab-item ${activeTab === 'raw' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setActiveTab('raw'); }}
              >
                RSS原始数据 ({rawJobs.length})
              </a>
              <a
                href="#"
                className={`tab-item ${activeTab === 'processed' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setActiveTab('processed'); }}
              >
                处理后数据 ({processedJobs.length})
              </a>
              <a
                href="#"
                className={`tab-item ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setActiveTab('stats'); }}
              >
                统计信息
              </a>
              <a
                href="#"
                className={`tab-item ${activeTab === 'retention' ? 'active' : ''}`}
                onClick={(e) => { e.preventDefault(); setActiveTab('retention'); }}
              >
                数据保留
              </a>
            </nav>
          </div>

          {/* 内容区域 */}
          <div className="tab-content">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

// RSS原始数据表格组件
const RawJobsTable: React.FC<{ jobs: RSSJob[]; onExport: () => void }> = ({ jobs, onExport }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(jobs.length / itemsPerPage);
  
  const currentJobs = jobs.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // Reset to page 1 when jobs change
  useEffect(() => {
    setCurrentPage(1);
  }, [jobs]);

  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">RSS原始数据 (近7天)</h3>
        <div className="table-controls">
          <div className="search-input">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="搜索岗位..." />
          </div>
          <button className="filter-btn">
            <span className="material-symbols-outlined">filter_list</span>
            筛选
          </button>
          <button onClick={onExport} className="btn-primary">
            <span className="material-symbols-outlined">download</span>
            导出数据
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>岗位标题</th>
              <th>公司</th>
              <th>地点</th>
              <th>分类</th>
              <th>类型</th>
              <th>级别</th>
              <th>薪资</th>
              <th>发布时间</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {currentJobs.map(job => (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td className="job-title">{job.title}</td>
                <td>{job.company}</td>
                <td>{job.location}</td>
                <td>
                  <span className="status-badge medium">{job.category}</span>
                </td>
                <td>{job.jobType}</td>
                <td>{job.experienceLevel}</td>
                <td>{job.salary}</td>
                <td>{new Date(job.publishedAt).toLocaleDateString()}</td>
                <td>
                  <a href={job.source} target="_blank" rel="noopener noreferrer">
                    查看原文
                  </a>
                </td>
                <td>
                  <button className="action-btn">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button className="action-btn danger">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span>
          显示 {Math.min((currentPage - 1) * itemsPerPage + 1, jobs.length)}-
          {Math.min(currentPage * itemsPerPage, jobs.length)} 条，
          共 {jobs.length} 条记录
        </span>
        <div className="pagination-controls" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button 
            className="pagination-btn" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            上一页
          </button>
          
          {(() => {
            const pages = [];
            if (totalPages > 0) {
                pages.push(
                <button 
                    key={1} 
                    className={`pagination-btn ${currentPage === 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(1)}
                    style={currentPage === 1 ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >1</button>
                );
            }

            if (currentPage > 3) {
              pages.push(<span key="dots1" style={{ margin: '0 4px' }}>...</span>);
            }

            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
              pages.push(
                <button 
                  key={i} 
                  className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i)}
                  style={currentPage === i ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >{i}</button>
              );
            }

            if (currentPage < totalPages - 2) {
              pages.push(<span key="dots2" style={{ margin: '0 4px' }}>...</span>);
            }

            if (totalPages > 1) {
              pages.push(
                <button 
                  key={totalPages} 
                  className={`pagination-btn ${currentPage === totalPages ? 'active' : ''}`}
                  onClick={() => setCurrentPage(totalPages)}
                  style={currentPage === totalPages ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >{totalPages}</button>
              );
            }
            return pages;
          })()}

          <button 
            className="pagination-btn" 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};


// 处理后数据表格组件
const ProcessedJobsTable: React.FC<{ jobs: SimpleUnifiedJob[]; onExport: () => void }> = ({ jobs, onExport }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(jobs.length / itemsPerPage);
  
  const currentJobs = jobs.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  // Reset to page 1 when jobs change (e.g. filter)
  useEffect(() => {
    setCurrentPage(1);
  }, [jobs]);

  const [regionDetailOpen, setRegionDetailOpen] = useState(false);
  const [regionDetailLoading, setRegionDetailLoading] = useState(false)
  const [regionDetailError, setRegionDetailError] = useState<string | null>(null)
  const [regionDetail, setRegionDetail] = useState<{
    jobId: string
    title: string
    company: string
    region?: 'domestic' | 'overseas' | 'both'
    location: string
    tags: string[]
    hits: { type: 'domestic' | 'overseas' | 'global'; keywords: string[] }
    decision: 'global' | 'domestic' | 'overseas' | 'heuristic' | 'unknown'
  } | null>(null)

  const openRegionDetail = async (jobId: string) => {
    setRegionDetailOpen(true)
    setRegionDetailLoading(true)
    setRegionDetailError(null)
    try {
      const job = await processedJobsService.getJobById(jobId)
      const cats = await processedJobsService.getLocationCategories()
      const norm = (v: string) => (v || '').toLowerCase()
      const loc = norm(job?.location || '')
      const tagList = (job?.skills || []).map((t: string) => t || '')
      const pool = new Set([loc, ...tagList.map((t: string) => norm(t))])
      const hit = (keys: string[]) => {
        const matched = (keys || []).filter(k => pool.has(norm(k)) || loc.includes(norm(k)))
        return { matched, any: matched.length > 0 }
      }
      const g = hit(cats.globalKeywords)
      const d = hit(cats.domesticKeywords)
      const o = hit(cats.overseasKeywords)
      const isGlobalText = /anywhere|everywhere|worldwide|不限地点/.test(loc)
      let decision: 'global' | 'domestic' | 'overseas' | 'heuristic' | 'unknown' = 'unknown'
      if (g.any || isGlobalText) decision = 'global'
      else if (d.any) decision = 'domestic'
      else if (o.any) decision = 'overseas'
      else if (loc.includes('china') || loc.includes('cn') || loc.includes('中国') || loc.includes('beijing') || loc.includes('shanghai') || loc.includes('深圳') || loc.includes('杭州')) decision = 'heuristic'
      else decision = 'heuristic'

      setRegionDetail({
        jobId,
        title: job?.title || '',
        company: job?.company || '',
        region: job?.region,
        location: job?.location || '',
        tags: tagList,
        hits: decision === 'global' ? { type: 'global', keywords: g.matched } : decision === 'domestic' ? { type: 'domestic', keywords: d.matched } : decision === 'overseas' ? { type: 'overseas', keywords: o.matched } : { type: 'global', keywords: [] },
        decision
      })
    } catch (e) {
      setRegionDetailError('加载分类详情失败')
    } finally {
      setRegionDetailLoading(false)
    }
  }

  const closeRegionDetail = () => {
    setRegionDetailOpen(false)
    setRegionDetail(null)
    setRegionDetailError(null)
  }

  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">处理后数据 (近7天)</h3>
        <div className="table-controls">
          <div className="search-input">
            <span className="material-symbols-outlined">search</span>
            <input type="text" placeholder="搜索岗位..." />
          </div>
          <button className="filter-btn">
            <span className="material-symbols-outlined">filter_list</span>
            筛选
          </button>
          <button onClick={onExport} className="btn-primary">
            <span className="material-symbols-outlined">download</span>
            导出数据
          </button>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>岗位名称</th>
              <th>分类</th>
              <th>级别</th>
              <th>企业名称</th>
              <th>岗位类型</th>
              <th>区域分类</th>
              <th>区域限制</th>
              <th>技能标签</th>
              <th>语言要求</th>
              <th>数据质量</th>
              <th>来源</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {currentJobs.map(job => (
              <tr key={job.id}>
                <td>{job.id}</td>
                <td className="job-title">{job.jobTitle}</td>
                <td>{job.category}</td>
                <td>{job.level}</td>
                <td>{job.companyName}</td>
                <td>
                  <span className={`tag type ${job.jobType === '全职' ? 'full-time' : job.jobType === '兼职' ? 'part-time' : 'contract'}`}>
                    {job.jobType}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${job.region === 'domestic' ? 'badge-success' : job.region === 'overseas' ? 'badge-info' : 'badge-default'}`}>
                      {job.region === 'domestic' ? '国内' : job.region === 'overseas' ? '海外' : '未分类'}
                    </span>
                    <button className="action-btn" onClick={() => openRegionDetail(job.id)}>
                      详情
                    </button>
                  </div>
                </td>
                <td>{job.locationRestriction}</td>
                <td>
                  <div className="skill-tags">
                    {job.skillTags.slice(0, 3).map(skill => (
                      <span key={skill} className="skill-tag">{skill}</span>
                    ))}
                    {job.skillTags.length > 3 && <span className="more-skills">+{job.skillTags.length - 3}</span>}
                  </div>
                </td>
                <td>{job.languageRequirements}</td>
                <td>
                  <div className="quality-score">
                    <span className={`score ${job.dataQuality >= 80 ? 'high' : job.dataQuality >= 60 ? 'medium' : 'low'}`}>
                      {job.dataQuality}%
                    </span>
                  </div>
                </td>
                <td>
                  <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                    查看原文
                  </a>
                </td>
                <td>
                  <button className="action-btn">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button className="action-btn">
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                  <button className="action-btn danger">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {regionDetailOpen && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h4>区域分类匹配详情</h4>
                <button className="close-btn" onClick={closeRegionDetail}>×</button>
              </div>
              <div className="modal-body">
                {regionDetailLoading && <div className="loading">加载中...</div>}
                {!regionDetailLoading && regionDetailError && <div className="error">{regionDetailError}</div>}
                {!regionDetailLoading && !regionDetailError && regionDetail && (
                  <div className="detail-grid">
                    <div><strong>岗位：</strong>{regionDetail.title}</div>
                    <div><strong>企业：</strong>{regionDetail.company}</div>
                    <div><strong>区域分类：</strong>{regionDetail.region === 'domestic' ? '国内' : regionDetail.region === 'overseas' ? '海外' : '未分类'}</div>
                    <div><strong>地点：</strong>{regionDetail.location || '-'}</div>
                    <div><strong>标签：</strong>{regionDetail.tags.length > 0 ? regionDetail.tags.slice(0, 6).join(' / ') : '-'}</div>
                    <div><strong>命中：</strong>{regionDetail.hits.keywords.length > 0 ? `${regionDetail.hits.type}：${regionDetail.hits.keywords.join(', ')}` : '无直接命中，使用启发式'}</div>
                    <div><strong>判定来源：</strong>{regionDetail.decision}</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn-primary" onClick={closeRegionDetail}>关闭</button>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="pagination">
        <span>
          显示 {Math.min((currentPage - 1) * itemsPerPage + 1, jobs.length)}-
          {Math.min(currentPage * itemsPerPage, jobs.length)} 条，
          共 {jobs.length} 条记录
        </span>
        <div className="pagination-controls" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button 
            className="pagination-btn" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            上一页
          </button>
          
          {(() => {
            const pages = [];
            // Always show first
            if (totalPages > 0) {
                pages.push(
                <button 
                    key={1} 
                    className={`pagination-btn ${currentPage === 1 ? 'active' : ''}`}
                    onClick={() => setCurrentPage(1)}
                    style={currentPage === 1 ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >1</button>
                );
            }

            if (currentPage > 3) {
              pages.push(<span key="dots1" style={{ margin: '0 4px' }}>...</span>);
            }

            // Middle pages
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
              pages.push(
                <button 
                  key={i} 
                  className={`pagination-btn ${currentPage === i ? 'active' : ''}`}
                  onClick={() => setCurrentPage(i)}
                  style={currentPage === i ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >{i}</button>
              );
            }

            if (currentPage < totalPages - 2) {
              pages.push(<span key="dots2" style={{ margin: '0 4px' }}>...</span>);
            }

            // Always show last if > 1
            if (totalPages > 1) {
              pages.push(
                <button 
                  key={totalPages} 
                  className={`pagination-btn ${currentPage === totalPages ? 'active' : ''}`}
                  onClick={() => setCurrentPage(totalPages)}
                  style={currentPage === totalPages ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >{totalPages}</button>
              );
            }
            return pages;
          })()}

          <button 
            className="pagination-btn" 
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
};

// 统计信息面板组件
const StatsPanel: React.FC<{ stats: SimpleStats | null }> = ({ stats }) => {
  if (!stats) {
    return <div>暂无统计数据</div>;
  }

  return (
    <div className="stats-panel">
      <div className="stats-grid">
        <div className="stat-card">
          <h4>RSS原始数据</h4>
          <div className="stat-value">{stats.totalRaw}</div>
        </div>
        <div className="stat-card">
          <h4>处理后数据</h4>
          <div className="stat-value">{stats.totalProcessed}</div>
        </div>
        <div className="stat-card">
          <h4>处理成功率</h4>
          <div className="stat-value">{Math.round(stats.successRate)}%</div>
        </div>
        <div className="stat-card">
          <h4>平均质量分</h4>
          <div className="stat-value">{Math.round(stats.averageQuality)}%</div>
        </div>
      </div>

      <div className="distribution-charts">
        <div className="chart-section">
          <h4>岗位分类分布</h4>
          <div className="chart-bars">
            {Object.entries(stats.categoryDistribution).map(([category, count]) => (
              <div key={category} className="chart-bar">
                <span className="bar-label">{category}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${(count / stats.totalProcessed) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-section">
          <h4>数据来源分布</h4>
          <div className="chart-bars">
            {Object.entries(stats.sourceDistribution).map(([source, count]) => (
              <div key={source} className="chart-bar">
                <span className="bar-label">{source}</span>
                <div className="bar-container">
                  <div
                    className="bar-fill"
                    style={{ width: `${(count / stats.totalProcessed) * 100}%` }}
                  ></div>
                </div>
                <span className="bar-value">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// 数据保留管理面板组件
const RetentionPanel: React.FC<{
  stats: RetentionStats | null;
  onCleanup: () => void;
  loading: boolean;
}> = ({ stats, onCleanup, loading }) => {
  if (!stats) {
    return <div className="loading">加载数据保留信息中...</div>;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return '从未执行';
    return new Date(date).toLocaleString('zh-CN');
  };

  return (
    <div className="retention-panel">
      <div className="retention-header">
        <h3>数据保留策略管理</h3>
        <button
          onClick={onCleanup}
          className="cleanup-btn"
          disabled={loading}
        >
          {loading ? '清理中...' : '手动清理'}
        </button>
      </div>

      <div className="retention-stats-grid">
        <div className="retention-card">
          <h4>总记录数</h4>
          <div className="retention-value">{stats.totalRecords}</div>
          <div className="retention-desc">RSS + 统一数据</div>
        </div>

        <div className="retention-card">
          <h4>过期记录</h4>
          <div className="retention-value expired">{stats.expiredRecords}</div>
          <div className="retention-desc">超过7天的数据</div>
        </div>

        <div className="retention-card">
          <h4>已清理记录</h4>
          <div className="retention-value cleaned">{stats.cleanedRecords}</div>
          <div className="retention-desc">本次清理删除</div>
        </div>

        <div className="retention-card">
          <h4>存储使用</h4>
          <div className="retention-value">{formatBytes(stats.storageUsage.total)}</div>
          <div className="retention-desc">总存储空间</div>
        </div>
      </div>

      <div className="retention-details">
        <div className="retention-section">
          <h4>清理时间</h4>
          <div className="time-info">
            <div className="time-item">
              <span className="time-label">上次清理:</span>
              <span className="time-value">{formatDate(stats.lastCleanup)}</span>
            </div>
            <div className="time-item">
              <span className="time-label">下次清理:</span>
              <span className="time-value">{formatDate(stats.nextCleanup)}</span>
            </div>
          </div>
        </div>

        <div className="retention-section">
          <h4>存储详情</h4>
          <div className="storage-breakdown">
            <div className="storage-item">
              <span className="storage-label">RSS原始数据:</span>
              <span className="storage-value">{formatBytes(stats.storageUsage.rssData)}</span>
            </div>
            <div className="storage-item">
              <span className="storage-label">统一岗位数据:</span>
              <span className="storage-value">{formatBytes(stats.storageUsage.unifiedData)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="retention-config">
        <h4>保留策略配置</h4>
        <div className="config-info">
          <div className="config-item">
            <span className="config-label">保留天数:</span>
            <span className="config-value">7天</span>
          </div>
          <div className="config-item">
            <span className="config-label">清理间隔:</span>
            <span className="config-value">24小时</span>
          </div>
          <div className="config-item">
            <span className="config-label">最大记录数:</span>
            <span className="config-value">10,000条</span>
          </div>
          <div className="config-item">
            <span className="config-label">自动清理:</span>
            <span className="config-value enabled">已启用</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
