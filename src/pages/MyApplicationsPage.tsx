
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Clock, CheckCircle, XCircle, MoreHorizontal, AlertCircle, MessageSquare, Trash2 } from 'lucide-react';

interface Application {
  id: number;
  jobId: string;
  jobTitle: string;
  company: string;
  interactionType: string;
  status: string;
  updatedAt: string;
  notes: string;
  applicationSource?: string;
}

export default function MyApplicationsPage() {
  const { user, token, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/my-applications');
      return;
    }
    fetchApplications();
  }, [isAuthenticated, token]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-profile?action=my_applications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setApplications(data.applications);
      }
    } catch (error) {
      console.error('Failed to fetch applications', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (id: number, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch('/api/user-profile?action=update_application_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id, status: newStatus })
      });
      
      if (res.ok) {
        setApplications(prev => prev.map(app => 
          app.id === id ? { ...app, status: newStatus, updatedAt: new Date().toISOString() } : app
        ));
      }
    } catch (error) {
      console.error('Failed to update status', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除这条申请记录吗？')) return;
    
    try {
      const res = await fetch('/api/user-profile?action=delete_application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ id })
      });
      
      if (res.ok) {
        setApplications(prev => prev.filter(app => app.id !== id));
      } else {
        alert('删除失败，请重试');
      }
    } catch (error) {
      console.error('Failed to delete application', error);
      alert('删除失败，请检查网络');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'applied': return 'bg-blue-100 text-blue-800';
      case 'interviewing': return 'bg-purple-100 text-purple-800';
      case 'offer': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '待处理';
      case 'applied': return '已投递';
      case 'interviewing': return '面试中';
      case 'offer': return '已录用';
      case 'rejected': return '已拒绝';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">我的投递</h1>
            <p className="mt-2 text-slate-600">管理您的所有求职申请记录</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
            <span className="text-sm text-slate-500">共投递</span>
            <span className="ml-2 text-xl font-bold text-indigo-600">{applications.length}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-indigo-600 border-t-transparent mx-auto"></div>
            <p className="mt-4 text-slate-500">加载记录中...</p>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">暂无投递记录</h3>
            <p className="text-slate-500 mb-6">您还没有申请过任何职位，快去浏览机会吧！</p>
            <button 
              onClick={() => navigate('/jobs')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              浏览职位
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="divide-y divide-slate-100">
              {applications.map((app) => (
                <div key={app.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 
                          className="text-lg font-bold text-slate-900 hover:text-indigo-600 cursor-pointer"
                          onClick={() => navigate(`/jobs/${app.jobId}`)}
                        >
                          {app.jobTitle || '未知职位'}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          (app.applicationSource === 'referral' || app.interactionType === 'referral') ? 'bg-purple-100 text-purple-700' :
                          app.applicationSource === 'official' ? 'bg-orange-100 text-orange-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          { (app.applicationSource === 'referral' || app.interactionType === 'referral') ? '内推' :
                            app.applicationSource === 'official' ? '官网直投' :
                            '第三方投递'}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600 mb-2">{app.company}</div>
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(app.updatedAt).toLocaleDateString()}
                        </span>
                        {app.notes && (
                          <span className="flex items-center gap-1" title={app.notes}>
                            <MessageSquare className="w-3 h-3" />
                            有备注
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative group">
                        <button className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${getStatusColor(app.status)}`}>
                          {getStatusLabel(app.status)}
                          <MoreHorizontal className="w-4 h-4 opacity-50" />
                        </button>
                        
                        {/* Status Dropdown */}
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-slate-100 overflow-hidden z-10 hidden group-hover:block">
                          {['applied', 'interviewing', 'offer', 'rejected'].map(status => (
                            <button
                              key={status}
                              onClick={() => handleStatusUpdate(app.id, status)}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${app.status === status ? 'text-indigo-600 font-medium' : 'text-slate-600'}`}
                            >
                              {getStatusLabel(status)}
                            </button>
                          ))}
                          <div className="h-px bg-slate-100 my-1"></div>
                          <button
                            onClick={() => handleDelete(app.id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            删除记录
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
