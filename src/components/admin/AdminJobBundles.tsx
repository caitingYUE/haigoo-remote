
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, Search, X, Check, Copy, BookOpen, Video, Users, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminJobBundles.css';

const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
  'internship': '实习',
  'entry': '初级',
  'mid': '中级',
  'senior': '高级',
  'lead': '主导',
  'manager': '经理',
  'director': '总监',
  'executive': '高管'
};

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  job_ids: string[];
  priority: number;
  start_time: string | null;
  end_time: string | null;
  visibility: string;
  allowed_user_ids?: string[];
  allowed_emails?: string[];
  allowed_users?: RegisteredUser[];
  career_items?: Array<{ video_id: string; guidance?: string; sort_order?: number }>;
  is_active: boolean;
  created_at: string;
}

interface RegisteredUser {
  user_id: string;
  email: string;
  username?: string;
  member_status?: string;
  member_type?: string;
}

interface CareerVideo {
  video_id: string;
  video_title: string;
  module_key: string;
  description?: string;
  category?: string;
  difficulty_level?: string;
}

const getDisplayJobTitle = (job: any) => {
  return String(job?.translations?.title || job?.title || '未命名岗位').trim();
};

const getDisplayJobCompany = (job: any) => {
  return String(job?.translations?.company || job?.company || '未知企业').trim();
};

const AdminJobBundles: React.FC = () => {
  const { token } = useAuth();
  const [bundles, setBundles] = useState<JobBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBundle, setCurrentBundle] = useState<Partial<JobBundle>>({});

  // Job Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]); // Full job objects for display
  const [isCopied, setIsCopied] = useState(false);
  const [careerVideos, setCareerVideos] = useState<CareerVideo[]>([]);
  const [loadingCareerVideos, setLoadingCareerVideos] = useState(false);
  const [allowedUserSearch, setAllowedUserSearch] = useState('');
  const [allowedUserResults, setAllowedUserResults] = useState<RegisteredUser[]>([]);
  const [selectedAllowedUsers, setSelectedAllowedUsers] = useState<RegisteredUser[]>([]);
  const [searchingAllowedUsers, setSearchingAllowedUsers] = useState(false);
  const [saveError, setSaveError] = useState('');

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const handleCopyAll = () => {
    if (selectedJobs.length === 0) return;
    const text = selectedJobs
      .map((job, i) => `${i + 1}. ${getDisplayJobTitle(job)} - ${getDisplayJobCompany(job)}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  useEffect(() => {
    if (currentBundle.visibility !== 'specified') {
      setAllowedUserSearch('');
      setAllowedUserResults([]);
      return;
    }
    const query = allowedUserSearch.trim();
    if (query.length < 2) {
      setAllowedUserResults([]);
      setSearchingAllowedUsers(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        setSearchingAllowedUsers(true);
        const res = await fetch(`/api/admin/job-bundles?resource=registered-users&search=${encodeURIComponent(query)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        const data = await res.json();
        setAllowedUserResults(data.success ? (data.data || []) : []);
      } catch (error) {
        console.error('Failed to search registered users:', error);
        setAllowedUserResults([]);
      } finally {
        setSearchingAllowedUsers(false);
      }
    }, 260);
    return () => window.clearTimeout(timer);
  }, [allowedUserSearch, currentBundle.visibility, token]);

  const fetchCareerVideos = useCallback(async () => {
    try {
      setLoadingCareerVideos(true);
      const res = await fetch('/api/admin/job-bundles?resource=career-videos', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await res.json();
      if (data.success) setCareerVideos(data.data || []);
    } catch (error) {
      console.error('Failed to fetch career videos:', error);
    } finally {
      setLoadingCareerVideos(false);
    }
  }, [token]);

  const fetchBundles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/job-bundles', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await res.json();
      if (data.success) {
        setBundles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchBundles();
    void fetchCareerVideos();
  }, [fetchBundles, fetchCareerVideos]);

  // Format date for datetime-local input (YYYY-MM-DDThh:mm)
  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const offset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Parse datetime-local input to ISO string
  const parseDateFromInput = (value: string) => {
    if (!value) return null;
    return new Date(value).toISOString();
  };
  const fetchJobDetails = async (ids: string[]) => {
    if (!ids || ids.length === 0) {
      setSelectedJobs([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/job-bundles?resource=publishable-jobs&ids=${encodeURIComponent(JSON.stringify(ids))}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        // Reorder according to ids
        const jobMap = new Map((data.data || []).map((j: any) => [j.id, j]));
        const ordered = ids.map(id => jobMap.get(id) || ({
          id,
          title: '该岗位当前不能公开展示',
          company: '已下线、未审核或本地预览数据',
          unavailable: true
        }));
        setSelectedJobs(ordered);
      }
    } catch (e) {
      console.error('Failed to fetch job details', e);
    }
  };

  const handleEdit = (bundle: JobBundle) => {
    setSaveError('');
    setCurrentBundle({ ...bundle, allowed_user_ids: bundle.allowed_user_ids || [], allowed_emails: bundle.allowed_emails || [], career_items: bundle.career_items || [] });
    setSelectedAllowedUsers(bundle.allowed_users || []);
    setAllowedUserSearch('');
    setAllowedUserResults([]);
    fetchJobDetails(bundle.job_ids || []);
    setIsEditing(true);
  };

  const handleCreate = () => {
    setSaveError('');
    setCurrentBundle({
      title: '',
      subtitle: '',
      content: '',
      job_ids: [],
      priority: 10,
      visibility: 'public',
      allowed_user_ids: [],
      allowed_emails: [],
      career_items: [],
      is_active: true
    });
    setSelectedJobs([]);
    setSelectedAllowedUsers([]);
    setAllowedUserSearch('');
    setAllowedUserResults([]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setSaveError('');
    if (!String(currentBundle.title || '').trim()) {
      setSaveError('请填写组合标题。');
      return;
    }
    if (currentBundle.visibility === 'specified' && selectedAllowedUsers.length === 0) {
      setSaveError('请通过站内搜索添加至少一位已注册用户。');
      return;
    }
    try {
      const url = '/api/admin/job-bundles';
      const method = currentBundle.id ? 'PUT' : 'POST';
      // The API resolves access by either user ID or email. Build both fields from
      // the same selection so a removed user cannot remain authorized through a
      // stale email retained from an earlier edit.
      const selectedUserIds = [...new Set(selectedAllowedUsers
        .map(user => String(user.user_id || '').trim())
        .filter(Boolean))];
      const selectedUserEmails = [...new Set(selectedAllowedUsers
        .map(user => String(user.email || '').trim().toLowerCase())
        .filter(Boolean))];
      const body = {
        ...currentBundle,
        job_ids: selectedJobs.map(j => j.id), // Use j.id consistently
        allowed_user_ids: currentBundle.visibility === 'specified' ? selectedUserIds : [],
        allowed_emails: currentBundle.visibility === 'specified' ? selectedUserEmails : [],
        career_items: currentBundle.career_items || []
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body)
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setIsEditing(false);
        fetchBundles();
      } else {
        setSaveError(data.error || '保存失败，请稍后重试。');
      }
    } catch (error) {
      console.error('Save error:', error);
      setSaveError('网络异常，未能保存。请检查连接后重试。');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个组合包吗？')) return;
    try {
      await fetch(`/api/admin/job-bundles?id=${id}`, { method: 'DELETE', headers: authHeaders });
      fetchBundles();
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // Search Jobs
  const handleSearchJobs = async () => {
    if (!searchTerm) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/admin/job-bundles?resource=publishable-jobs&search=${encodeURIComponent(searchTerm)}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.data || []);
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setSearching(false);
    }
  };

  const addJobToBundle = (job: any) => {
    // Check if job is already selected
    if (selectedJobs.some(j => j.id === job.id)) return;
    setSelectedJobs([...selectedJobs, job]);
  };

  const removeJobFromBundle = (jobId: string) => {
    setSelectedJobs(selectedJobs.filter(j => j.id !== jobId));
  };

  const moveJob = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newJobs = [...selectedJobs];
      [newJobs[index - 1], newJobs[index]] = [newJobs[index], newJobs[index - 1]];
      setSelectedJobs(newJobs);
    } else if (direction === 'down' && index < selectedJobs.length - 1) {
      const newJobs = [...selectedJobs];
      [newJobs[index], newJobs[index + 1]] = [newJobs[index + 1], newJobs[index]];
      setSelectedJobs(newJobs);
    }
  };

  const careerItems = currentBundle.career_items || [];
  const addCareerVideo = (video: CareerVideo) => {
    if (careerItems.some(item => item.video_id === video.video_id)) return;
    setCurrentBundle({ ...currentBundle, career_items: [...careerItems, { video_id: video.video_id, guidance: '' }] });
  };
  const updateCareerGuidance = (index: number, guidance: string) => {
    setCurrentBundle({ ...currentBundle, career_items: careerItems.map((item, itemIndex) => itemIndex === index ? { ...item, guidance } : item) });
  };
  const removeCareerVideo = (videoId: string) => {
    setCurrentBundle({ ...currentBundle, career_items: careerItems.filter(item => item.video_id !== videoId) });
  };
  const addAllowedUser = (user: RegisteredUser) => {
    if (selectedAllowedUsers.some(item => item.user_id === user.user_id)) return;
    setSelectedAllowedUsers([...selectedAllowedUsers, user]);
    setAllowedUserSearch('');
    setAllowedUserResults([]);
  };
  const removeAllowedUser = (userId: string) => {
    setSelectedAllowedUsers(selectedAllowedUsers.filter(user => user.user_id !== userId));
  };

  if (isEditing) {
    return (
      <div className="job-bundle-editor">
        <div className="editor-header">
          <h2>{currentBundle.id ? '编辑职位组合' : '新建职位组合'}</h2>
          <button onClick={() => setIsEditing(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">保存</button>
        </div>

        {saveError && <div className="job-bundle-save-error" role="alert">{saveError}</div>}

        <div className="editor-content">
          {/* Basic Info */}
          <div className="form-section">
            <h3>基本信息</h3>
            <div className="form-row">
              <label>标题</label>
              <input
                type="text"
                value={currentBundle.title || ''}
                onChange={e => setCurrentBundle({ ...currentBundle, title: e.target.value })}
                placeholder="例如：2024春招精选"
              />
            </div>
            <div className="form-row">
              <label>副标题</label>
              <input
                type="text"
                value={currentBundle.subtitle || ''}
                onChange={e => setCurrentBundle({ ...currentBundle, subtitle: e.target.value })}
                placeholder="简短描述"
              />
            </div>
            <div className="form-row">
              <label>详细内容</label>
              <textarea
                value={currentBundle.content || ''}
                onChange={e => setCurrentBundle({ ...currentBundle, content: e.target.value })}
                placeholder="组合包详细介绍..."
                rows={4}
              />
            </div>
            <div className="form-row two-col">
              <div>
                <label>开始时间</label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(currentBundle.start_time || null)}
                  onChange={e => setCurrentBundle({ ...currentBundle, start_time: parseDateFromInput(e.target.value) })}
                />
              </div>
              <div>
                <label>结束时间</label>
                <input
                  type="datetime-local"
                  value={formatDateForInput(currentBundle.end_time || null)}
                  onChange={e => setCurrentBundle({ ...currentBundle, end_time: parseDateFromInput(e.target.value) })}
                />
              </div>
            </div>
            <div className="form-row two-col">
              <div>
                <label>优先级 (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={currentBundle.priority || 10}
                  onChange={e => setCurrentBundle({ ...currentBundle, priority: parseInt(e.target.value) })}
                />
              </div>
              <div className="checkbox-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label>可见范围</label>
                  <select
                    value={currentBundle.visibility || 'public'}
                    onChange={e => setCurrentBundle({ ...currentBundle, visibility: e.target.value })}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #e2e8f0', minWidth: '120px' }}
                  >
                    <option value="public">公开可见</option>
                    <option value="member">Club 可申</option>
                    <option value="specified">指定注册邮箱可见</option>
                    <option value="admin">仅管理员可见</option>
                  </select>
                </div>
                <label>
                  <input
                    type="checkbox"
                    checked={currentBundle.is_active !== false}
                    onChange={e => setCurrentBundle({ ...currentBundle, is_active: e.target.checked })}
                  />
                  启用
                </label>
              </div>
            </div>
            {currentBundle.visibility === 'specified' && (
              <div className="form-row allowed-users-field">
                <label>指定注册用户</label>
                <p className="allowed-users-hint">按邮箱或用户名搜索已注册用户；选择后将关联账户 ID，邮箱变更后权限仍会保留。</p>
                <div className="allowed-user-search-wrap">
                  <Search className="allowed-user-search-icon" aria-hidden="true" />
                  <input
                    type="search"
                    value={allowedUserSearch}
                    onChange={e => setAllowedUserSearch(e.target.value)}
                    placeholder="输入至少 2 个字符搜索邮箱或用户名"
                    aria-label="搜索注册用户"
                  />
                  {searchingAllowedUsers && <Loader2 className="allowed-user-loading animate-spin" aria-label="搜索中" />}
                </div>
                {allowedUserSearch.trim().length >= 2 && (
                  <div className="allowed-user-results" aria-live="polite">
                    {allowedUserResults.length === 0 && !searchingAllowedUsers ? (
                      <div className="allowed-user-empty">没有匹配的已注册用户</div>
                    ) : allowedUserResults.map(user => {
                      const alreadySelected = selectedAllowedUsers.some(item => item.user_id === user.user_id);
                      return <button type="button" key={user.user_id} className="allowed-user-option" onClick={() => addAllowedUser(user)} disabled={alreadySelected}>
                        <span className="allowed-user-avatar"><Users className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1 text-left"><b>{user.username || '未设置昵称'}</b><small>{user.email}</small></span>
                        <span className="allowed-user-add">{alreadySelected ? '已添加' : '添加'}</span>
                      </button>;
                    })}
                  </div>
                )}
                <div className="selected-allowed-users">
                  {selectedAllowedUsers.length === 0 ? <span className="allowed-user-empty">尚未指定用户</span> : selectedAllowedUsers.map(user => (
                    <span className="allowed-user-chip" key={user.user_id}>
                      <span className="min-w-0"><b>{user.username || '未设置昵称'}</b><small>{user.email}</small></span>
                      <button type="button" onClick={() => removeAllowedUser(user.user_id)} aria-label={`移除 ${user.email}`}><X className="h-3.5 w-3.5" /></button>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">仅这些已登录账户可以打开该组合；支持重复搜索并添加多个用户。</p>
              </div>
            )}
          </div>

          <div className="form-section">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="mb-1 flex items-center gap-2"><BookOpen className="h-4 w-4 text-indigo-500" />职业成长内容</h3>
                <p className="text-xs text-slate-500">从已发布的职业成长视频中选择，并为每一项补充仅在本组合页显示的观看说明。</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">已选 {careerItems.length}</span>
            </div>
            <div className="career-plan-editor">
              <div className="career-video-picker">
                <div className="career-picker-title">可添加的视频</div>
                <div className="career-video-list">
                  {loadingCareerVideos ? <div className="p-3 text-sm text-slate-400">加载中...</div> : careerVideos.map(video => (
                    <button type="button" key={video.video_id} onClick={() => addCareerVideo(video)} disabled={careerItems.some(item => item.video_id === video.video_id)} className="career-video-option">
                      <Video className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 text-left"><b>{video.video_title}</b><small>{video.module_key} {video.category ? `· ${video.category}` : ''}</small></span>
                      <Plus className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="career-selected-list">
                <div className="career-picker-title">组合内的成长路径</div>
                {careerItems.length === 0 ? <div className="p-4 text-sm text-slate-400">选择视频后，可给用户写下正确打开与使用方式。</div> : careerItems.map((item, index) => {
                  const video = careerVideos.find(candidate => candidate.video_id === item.video_id);
                  return <div className="career-selected-item" key={item.video_id}>
                    <div className="career-item-order">{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-800">{video?.video_title || item.video_id}</div>
                      <textarea value={item.guidance || ''} onChange={e => updateCareerGuidance(index, e.target.value)} placeholder="例如：先看这一节，再把自己的经历写成 3 个可复用案例。" rows={2} />
                    </div>
                    <button type="button" onClick={() => removeCareerVideo(item.video_id)} className="text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
                  </div>
                })}
              </div>
            </div>
          </div>

          {/* Job Selection */}
          <div className="form-section">
            <h3>职位选择</h3>
            <p className="mb-3 text-xs text-slate-500">仅可添加已审核且正在公开展示的真实岗位；本地预览数据不会进入合集。</p>

            <div className="job-selector">
              {/* Search Panel */}
              <div className="search-panel">
                <div className="search-bar">
                  <input
                    type="text"
                    placeholder="搜索职位名称或公司..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchJobs()}
                  />
                  <button onClick={handleSearchJobs} disabled={searching}>
                    {searching ? '...' : <Search className="w-4 h-4" />}
                  </button>
                </div>
                <div className="search-results max-h-[300px] overflow-y-auto custom-scrollbar border-b border-slate-100 pb-2">
                  {searchResults.map(job => (
                    <div key={job.id} className="search-item">
                      <div className="job-info">
                        <div className="job-title">{getDisplayJobTitle(job)}</div>
                        <div className="job-company text-xs text-gray-500 font-medium flex items-center flex-wrap gap-2 mt-1">
                          {getDisplayJobCompany(job)}
                          {job.experienceLevel && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              {EXPERIENCE_LEVEL_MAP[job.experienceLevel] || job.experienceLevel}
                            </span>
                          )}
                          <span className="text-gray-400 font-normal">ID: {job.id}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => addJobToBundle(job)}
                        className="btn-add"
                        disabled={!!selectedJobs.find(j => j.id === job.id)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Panel */}
              <div className="selected-panel">
                <div className="selected-header">
                  <h4>已选职位 ({selectedJobs.length})</h4>
                  {selectedJobs.length > 0 && (
                    <button
                      className={`btn-copy-all${isCopied ? ' copied' : ''}`}
                      onClick={handleCopyAll}
                      title="复制所有职位信息"
                    >
                      {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {isCopied ? '已复制' : '一键复制'}
                    </button>
                  )}
                </div>
                <div className="selected-list">
                  {selectedJobs.map((job, index) => (
                    <div key={job.id} className="selected-item">
                      <div className="item-order">{index + 1}</div>
                      <div className="job-info">
                        <div className="job-title">{getDisplayJobTitle(job)}</div>
                        <div className="job-company">{getDisplayJobCompany(job)}{job.unavailable ? ' · 无法公开展示，请移除' : ''}</div>
                      </div>
                      <div className="item-actions">
                        <button onClick={() => moveJob(index, 'up')} disabled={index === 0}>↑</button>
                        <button onClick={() => moveJob(index, 'down')} disabled={index === selectedJobs.length - 1}>↓</button>
                        <button onClick={() => removeJobFromBundle(job.id)} className="text-red-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header">
          <h2>职位组合管理</h2>
          <button onClick={handleCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> 新增组合
          </button>
        </div>
        <div className="card-content">
          <table className="data-table">
            <thead>
              <tr>
                <th>标题</th>
                <th>优先级</th>
                <th>职位数</th>
                <th>成长内容</th>
                <th>授权用户</th>
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-4">加载中...</td></tr>
              ) : bundles.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-4">暂无数据</td></tr>
              ) : (
                bundles.map(bundle => (
                  <tr key={bundle.id}>
                    <td>
                      <div className="font-medium">{bundle.title}</div>
                      <div className="text-xs text-gray-500">{bundle.subtitle}</div>
                    </td>
                    <td>{bundle.priority}</td>
                    <td>{bundle.job_ids?.length || 0}</td>
                    <td>{bundle.career_items?.length || 0}</td>
                    <td>{bundle.visibility === 'specified' ? (bundle.allowed_user_ids?.length || bundle.allowed_users?.length || bundle.allowed_emails?.length || 0) : '—'}</td>
                    <td className="text-sm">
                      {bundle.start_time ? new Date(bundle.start_time).toLocaleDateString() : '即时'}
                      {' - '}
                      {bundle.end_time ? new Date(bundle.end_time).toLocaleDateString() : '永久'}
                    </td>
                    <td>
                      {bundle.is_active ? (
                        <span className="status-badge high">启用</span>
                      ) : (
                        <span className="status-badge low">停用</span>
                      )}
                      {bundle.visibility === 'member' && (
                        <span className="status-badge medium ml-2">Club 可申</span>
                      )}
                      {bundle.visibility === 'admin' && (
                        <span className="status-badge medium ml-2">仅管理员</span>
                      )}
                      {bundle.visibility === 'specified' && (
                        <span className="status-badge medium ml-2">指定用户</span>
                      )}
                    </td>
                    <td>
                      <div className="flex space-x-2">
                        <button onClick={() => handleEdit(bundle)} className="action-btn">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(bundle.id)} className="action-btn danger">
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
  );
};

export default AdminJobBundles;
