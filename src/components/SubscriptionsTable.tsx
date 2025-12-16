import React, { useState, useEffect } from 'react';
import { subscriptionsService, Subscription } from '../services/subscriptions-service';
import { SUBSCRIPTION_TOPICS, MAX_SUBSCRIPTION_TOPICS } from '../constants/subscription-topics';

export const SubscriptionsTable: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newTopics, setNewTopics] = useState<string[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const itemsPerPage = 20;

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const loadSubscriptions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await subscriptionsService.getAll();
      setSubscriptions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订阅列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newTopics.length === 0) {
        setAddError('请至少选择一个岗位类型');
        return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      await subscriptionsService.add(newEmail, newTopics.join(','));
      setNewEmail('');
      setNewTopics([]);
      setIsAddModalOpen(false);
      await loadSubscriptions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '添加订阅失败');
    } finally {
      setAddLoading(false);
    }
  };

  const toggleTopic = (value: string) => {
    if (newTopics.includes(value)) {
        setNewTopics(newTopics.filter(t => t !== value));
    } else {
        if (newTopics.length >= MAX_SUBSCRIPTION_TOPICS) return;
        setNewTopics([...newTopics, value]);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定要删除这个订阅吗？')) return;
    try {
      await subscriptionsService.delete(id);
      await loadSubscriptions();
    } catch (err) {
      alert('删除失败: ' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const handleStatusToggle = async (sub: Subscription) => {
      const newStatus = sub.status === 'active' ? 'inactive' : 'active';
      try {
          await subscriptionsService.updateStatus(sub.subscription_id, newStatus);
          await loadSubscriptions();
      } catch (err) {
          alert('更新状态失败: ' + (err instanceof Error ? err.message : '未知错误'));
      }
  }

  const renderTopics = (topicStr: string | undefined, channel: string, nickname?: string) => {
    if (channel === 'feishu') {
        return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                <span style={{ 
                    display: 'inline-block', 
                    padding: '2px 6px', 
                    background: '#e0f2fe', 
                    color: '#0369a1', 
                    fontSize: '12px', 
                    borderRadius: '4px',
                    border: '1px solid #bae6fd'
                }}>
                    飞书昵称: {nickname || '-'}
                </span>
            </div>
        )
    }

    if (!topicStr) return <span style={{ color: '#9ca3af' }}>-</span>
    const topics = topicStr.split(',')
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {topics.map(t => {
                const label = SUBSCRIPTION_TOPICS.find(opt => opt.value === t)?.label || t
                return (
                    <span key={t} style={{ 
                        display: 'inline-block', 
                        padding: '2px 6px', 
                        background: '#f3f4f6', 
                        color: '#4b5563', 
                        fontSize: '12px', 
                        borderRadius: '4px',
                        border: '1px solid #e5e7eb'
                    }}>
                        {label}
                    </span>
                )
            })}
        </div>
    )
  }

  // Pagination logic
  const totalPages = Math.ceil(subscriptions.length / itemsPerPage);
  const currentSubscriptions = subscriptions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="table-container">
      <div className="table-header">
        <h3 className="table-title">邮件订阅列表 ({subscriptions.length})</h3>
        <div className="table-controls">
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <span className="material-symbols-outlined">add</span>
            添加订阅
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>标识/联系方式</th>
                <th>主题/信息</th>
                <th>频率</th>
                <th>状态</th>
                <th>失败次数</th>
                <th>最后活跃</th>
                <th>创建时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {currentSubscriptions.map((sub) => (
                <tr key={sub.subscription_id}>
                  <td>{sub.subscription_id}</td>
                  <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                              fontSize: '10px',
                              padding: '1px 4px',
                              borderRadius: '4px',
                              backgroundColor: sub.channel === 'feishu' ? '#dbeafe' : '#f3f4f6',
                              color: sub.channel === 'feishu' ? '#1e40af' : '#4b5563',
                              border: sub.channel === 'feishu' ? '1px solid #bfdbfe' : '1px solid #e5e7eb'
                          }}>
                              {sub.channel === 'feishu' ? '飞书' : 'Email'}
                          </span>
                          {sub.identifier}
                      </div>
                  </td>
                  <td>{renderTopics(sub.topic, sub.channel, sub.nickname)}</td>
                  <td>{sub.frequency}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        sub.status === 'active'
                          ? 'success'
                          : sub.status === 'bounced'
                          ? 'danger'
                          : 'warning'
                      }`}
                      style={{
                          backgroundColor: sub.status === 'active' ? '#def7ec' : sub.status === 'bounced' ? '#fde8e8' : '#feecdc',
                          color: sub.status === 'active' ? '#03543f' : sub.status === 'bounced' ? '#9b1c1c' : '#8a2c0d',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 500
                      }}
                    >
                      {sub.status === 'active' ? '活跃' : sub.status === 'bounced' ? '退信' : '未激活'}
                    </span>
                  </td>
                  <td>{sub.fail_count}</td>
                  <td>{sub.last_active_at ? new Date(sub.last_active_at).toLocaleString() : '-'}</td>
                  <td>{new Date(sub.created_at).toLocaleDateString()}</td>
                  <td>
                    <button 
                        className="action-btn" 
                        title={sub.status === 'active' ? '禁用' : '激活'}
                        onClick={() => handleStatusToggle(sub)}
                    >
                        <span className="material-symbols-outlined">
                            {sub.status === 'active' ? 'block' : 'check_circle'}
                        </span>
                    </button>
                    <button 
                        className="action-btn danger" 
                        title="删除"
                        onClick={() => handleDelete(sub.subscription_id)}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination">
        <span>
          显示 {Math.min((currentPage - 1) * itemsPerPage + 1, subscriptions.length)}-
          {Math.min(currentPage * itemsPerPage, subscriptions.length)} 条，
          共 {subscriptions.length} 条记录
        </span>
        <div className="pagination-controls" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          <button
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          >
            上一页
          </button>
           {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
               // Simplified pagination for now
               (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) ? (
                <button
                    key={page}
                    className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                    style={currentPage === page ? { backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
                >
                    {page}
                </button>
               ) : (page === currentPage - 2 || page === currentPage + 2) ? <span key={`dots-${page}`}>...</span> : null
           ))}
          <button
            className="pagination-btn"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          >
            下一页
          </button>
        </div>
      </div>

      {isAddModalOpen && (
        <div className="modal-overlay" style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="modal-card" style={{
              background: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%'
          }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3>添加新订阅</h3>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
            <form onSubmit={handleAddSubscription}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>邮箱地址</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px' }}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                    岗位类型 <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '12px' }}>(最多选{MAX_SUBSCRIPTION_TOPICS}个)</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }}>
                    {SUBSCRIPTION_TOPICS.map(topic => {
                        const isSelected = newTopics.includes(topic.value);
                        return (
                            <div 
                                key={topic.value}
                                onClick={() => toggleTopic(topic.value)}
                                style={{
                                    padding: '6px 12px',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    border: isSelected ? '1px solid #4F46E5' : '1px solid #e5e7eb',
                                    background: isSelected ? '#eff6ff' : 'white',
                                    color: isSelected ? '#4F46E5' : '#374151',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {topic.label}
                            </div>
                        )
                    })}
                </div>
              </div>

              {addError && <div className="error" style={{ color: '#ef4444', marginBottom: '16px', fontSize: '14px' }}>{addError}</div>}
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', color: '#374151' }}>取消</button>
                <button type="submit" className="btn-primary" disabled={addLoading} style={{ padding: '8px 16px', border: 'none', borderRadius: '6px', background: '#4F46E5', color: 'white', cursor: 'pointer', opacity: addLoading ? 0.7 : 1 }}>
                  {addLoading ? '添加中...' : '添加'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
