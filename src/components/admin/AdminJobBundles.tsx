
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Calendar, Eye, EyeOff, Search, X, Check } from 'lucide-react';
import './AdminJobBundles.css';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  job_ids: string[];
  priority: number;
  start_time: string | null;
  end_time: string | null;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
}

const AdminJobBundles: React.FC = () => {
  const [bundles, setBundles] = useState<JobBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBundle, setCurrentBundle] = useState<Partial<JobBundle>>({});
  
  // Job Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState<any[]>([]); // Full job objects for display

  useEffect(() => {
    fetchBundles();
  }, []);

  const fetchBundles = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/job-bundles');
      const data = await res.json();
      if (data.success) {
        setBundles(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch bundles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch full job details for the selected IDs when editing
  const fetchJobDetails = async (ids: string[]) => {
    if (!ids || ids.length === 0) {
      setSelectedJobs([]);
      return;
    }
    try {
      // We can reuse the processed-jobs API with a filter or ID list if supported
      // For now, let's just fetch them one by one or modify the API to support ID list
      // Optimization: Fetch all at once if API supports `ids` param
      // Assuming /api/data/processed-jobs supports ?ids=1,2,3 or we filter client side (bad for performance)
      
      // Let's implement a simple search by ID loop for now or search endpoint
      // Better: Use the search endpoint with ID filter if available. 
      // If not, we might need to display just IDs until we load them.
      
      // For this MVP, let's search by ID one by one or batch if possible.
      // Actually, let's just use the search API to find them by title if we can't get by ID easily? No.
      
      // Let's assume we can fetch job details. For now, we will just show IDs in the list until we search.
      // Or we can fetch them using `fetch('/api/data/processed-jobs?ids=' + ids.join(','))` if implemented.
      // Let's implement a helper in the backend later.
      
      // Temporary: Just set empty details, populate via search
      setSelectedJobs(ids.map(id => ({ job_id: id, title: 'Loading...', company: '...' })));
      
      // Real fetch
      const res = await fetch(`/api/data/processed-jobs?ids=${ids.join(',')}`);
      const data = await res.json();
      if (data.jobs) {
          // Reorder according to ids
          const jobMap = new Map(data.jobs.map((j: any) => [j.job_id, j]));
          const ordered = ids.map(id => jobMap.get(id)).filter(Boolean);
          setSelectedJobs(ordered);
      }
    } catch (e) {
      console.error('Failed to fetch job details', e);
    }
  };

  const handleEdit = (bundle: JobBundle) => {
    setCurrentBundle(bundle);
    fetchJobDetails(bundle.job_ids || []);
    setIsEditing(true);
  };

  const handleCreate = () => {
    setCurrentBundle({
      title: '',
      subtitle: '',
      content: '',
      job_ids: [],
      priority: 10,
      is_public: true,
      is_active: true
    });
    setSelectedJobs([]);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const url = '/api/admin/job-bundles';
      const method = currentBundle.id ? 'PUT' : 'POST';
      const body = {
        ...currentBundle,
        job_ids: selectedJobs.map(j => j.job_id)
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setIsEditing(false);
        fetchBundles();
      } else {
        alert('Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这个组合包吗？')) return;
    try {
      await fetch(`/api/admin/job-bundles?id=${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/data/processed-jobs?search=${encodeURIComponent(searchTerm)}&limit=20`);
      const data = await res.json();
      if (data.jobs) {
        setSearchResults(data.jobs);
      }
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setSearching(false);
    }
  };

  const addJobToBundle = (job: any) => {
    if (selectedJobs.find(j => j.job_id === job.job_id)) return;
    setSelectedJobs([...selectedJobs, job]);
  };

  const removeJobFromBundle = (jobId: string) => {
    setSelectedJobs(selectedJobs.filter(j => j.job_id !== jobId));
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

  if (isEditing) {
    return (
      <div className="job-bundle-editor">
        <div className="editor-header">
          <h2>{currentBundle.id ? '编辑职位组合' : '新建职位组合'}</h2>
          <button onClick={() => setIsEditing(false)} className="btn-secondary">取消</button>
          <button onClick={handleSave} className="btn-primary">保存</button>
        </div>

        <div className="editor-content">
          {/* Basic Info */}
          <div className="form-section">
            <h3>基本信息</h3>
            <div className="form-row">
              <label>标题</label>
              <input 
                type="text" 
                value={currentBundle.title || ''} 
                onChange={e => setCurrentBundle({...currentBundle, title: e.target.value})}
                placeholder="例如：2024春招精选"
              />
            </div>
            <div className="form-row">
              <label>副标题</label>
              <input 
                type="text" 
                value={currentBundle.subtitle || ''} 
                onChange={e => setCurrentBundle({...currentBundle, subtitle: e.target.value})}
                placeholder="简短描述"
              />
            </div>
            <div className="form-row">
              <label>详细内容</label>
              <textarea 
                value={currentBundle.content || ''} 
                onChange={e => setCurrentBundle({...currentBundle, content: e.target.value})}
                placeholder="组合包详细介绍..."
                rows={4}
              />
            </div>
            <div className="form-row two-col">
              <div>
                <label>开始时间</label>
                <input 
                  type="datetime-local" 
                  value={currentBundle.start_time ? new Date(currentBundle.start_time).toISOString().slice(0, 16) : ''}
                  onChange={e => setCurrentBundle({...currentBundle, start_time: e.target.value ? new Date(e.target.value).toISOString() : null})}
                />
              </div>
              <div>
                <label>结束时间</label>
                <input 
                  type="datetime-local" 
                  value={currentBundle.end_time ? new Date(currentBundle.end_time).toISOString().slice(0, 16) : ''}
                  onChange={e => setCurrentBundle({...currentBundle, end_time: e.target.value ? new Date(e.target.value).toISOString() : null})}
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
                  onChange={e => setCurrentBundle({...currentBundle, priority: parseInt(e.target.value)})}
                />
              </div>
              <div className="checkbox-row">
                <label>
                  <input 
                    type="checkbox" 
                    checked={currentBundle.is_public !== false}
                    onChange={e => setCurrentBundle({...currentBundle, is_public: e.target.checked})}
                  />
                  公开可见
                </label>
                <label>
                  <input 
                    type="checkbox" 
                    checked={currentBundle.is_active !== false}
                    onChange={e => setCurrentBundle({...currentBundle, is_active: e.target.checked})}
                  />
                  启用
                </label>
              </div>
            </div>
          </div>

          {/* Job Selection */}
          <div className="form-section">
            <h3>职位选择</h3>
            
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
                <div className="search-results">
                  {searchResults.map(job => (
                    <div key={job.job_id} className="search-item">
                      <div className="job-info">
                        <div className="job-title">{job.title}</div>
                        <div className="job-company">{job.company}</div>
                      </div>
                      <button 
                        onClick={() => addJobToBundle(job)}
                        className="btn-add"
                        disabled={!!selectedJobs.find(j => j.job_id === job.job_id)}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Panel */}
              <div className="selected-panel">
                <h4>已选职位 ({selectedJobs.length})</h4>
                <div className="selected-list">
                  {selectedJobs.map((job, index) => (
                    <div key={job.job_id} className="selected-item">
                      <div className="item-order">{index + 1}</div>
                      <div className="job-info">
                        <div className="job-title">{job.title}</div>
                        <div className="job-company">{job.company}</div>
                      </div>
                      <div className="item-actions">
                        <button onClick={() => moveJob(index, 'up')} disabled={index === 0}>↑</button>
                        <button onClick={() => moveJob(index, 'down')} disabled={index === selectedJobs.length - 1}>↓</button>
                        <button onClick={() => removeJobFromBundle(job.job_id)} className="text-red-500">
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
                <th>有效期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-4">加载中...</td></tr>
              ) : bundles.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-4">暂无数据</td></tr>
              ) : (
                bundles.map(bundle => (
                  <tr key={bundle.id}>
                    <td>
                      <div className="font-medium">{bundle.title}</div>
                      <div className="text-xs text-gray-500">{bundle.subtitle}</div>
                    </td>
                    <td>{bundle.priority}</td>
                    <td>{bundle.job_ids?.length || 0}</td>
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
                      {!bundle.is_public && (
                        <span className="status-badge medium ml-2">私有</span>
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
