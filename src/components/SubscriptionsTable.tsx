import React, { useState, useEffect } from 'react';
import { subscriptionsService, Subscription } from '../services/subscriptions-service';

export const SubscriptionsTable: React.FC = () => {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
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
    setAddLoading(true);
    setAddError(null);
    try {
      await subscriptionsService.add(newEmail);
      setNewEmail('');
      setIsAddModalOpen(false);
      await loadSubscriptions();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '添加订阅失败');
    } finally {
      setAddLoading(false);
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
                <th>邮箱</th>
                <th>主题</th>
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
                  <td>{sub.identifier}</td>
                  <td>{sub.topic}</td>
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
                <label style={{ display: 'block', marginBottom: '8px' }}>邮箱地址</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@example.com"
                  required
                  style={{ width: '100%', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px' }}
                />
              </div>
              {addError && <div className="error" style={{ color: 'red', marginBottom: '16px' }}>{addError}</div>}
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: '4px', background: 'white', cursor: 'pointer' }}>取消</button>
                <button type="submit" className="btn-primary" disabled={addLoading} style={{ padding: '8px 16px', border: 'none', borderRadius: '4px', background: '#4F46E5', color: 'white', cursor: 'pointer' }}>
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
