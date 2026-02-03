
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Clock, CheckCircle, XCircle, MoreHorizontal, AlertCircle, MessageSquare, FileText, Trash2, ChevronDown } from 'lucide-react';

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
  resumeId?: string;
  resumeName?: string;
}

export default function MyApplicationsTab() {
  const { token } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    fetchApplications();
  }, [token]);

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

  const getStatusColor = (status: string) => {
    const styles: Record<string, string> = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'pending_apply': 'bg-blue-50 text-blue-600 border border-blue-100', // 待申请
        'applied': 'bg-blue-100 text-blue-800',
        'reviewed': 'bg-indigo-100 text-indigo-800',
        'referred': 'bg-purple-100 text-purple-800',
        'interviewing': 'bg-orange-100 text-orange-800',
        'success': 'bg-green-100 text-green-800',
        'rejected': 'bg-red-100 text-red-800',
        'failed': 'bg-red-50 text-red-900',
        'offer': 'bg-green-100 text-green-800'
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
        'pending': '待处理',
        'pending_apply': '待投递',
        'applied': '已申请',
        'reviewed': '简历已阅',
        'referred': '已内推',
        'interviewing': '面试中',
        'success': '内推成功',
        'rejected': '已拒绝',
        'failed': '内推失败',
        'offer': '已录用'
    }
    return labels[status] || status
  };

  if (loading) {
      return <div className="p-8 text-center text-gray-500">加载中...</div>
  }

  if (applications.length === 0) {
      return (
          <div className="p-12 text-center bg-white rounded-xl border border-gray-100 shadow-sm">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">暂无申请记录</h3>
              <p className="text-gray-500 mt-2">您还没有投递过任何岗位，快去看看吧！</p>
          </div>
      )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-6 h-6" />
            我的申请
          </div>
          <span className="text-xs font-normal text-gray-400">仅保留近1年的申请记录</span>
      </h2>
      <div className="grid gap-3">
        {applications.map((app) => (
          <div key={app.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 group">
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base text-gray-900 mb-1.5 truncate pr-2" title={app.jobTitle}>{app.jobTitle}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mb-2">
                    <span className="font-medium text-gray-700 flex items-center gap-1">
                        <Briefcase className="w-3 h-3" />
                        {app.company}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    
                    {app.applicationSource === 'referral' && (
                        <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-medium border border-purple-100">内推</span>
                    )}
                    {(app.applicationSource === 'official' || app.applicationSource === 'trusted_platform') && (
                        <span className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-100">自投</span>
                    )}
                </div>
                
                {(app.notes || app.resumeName) && (
                    <div className="flex flex-col gap-1.5 mt-2.5">
                        {app.resumeName && (
                            <div className="flex items-center gap-1.5 text-xs text-indigo-600">
                                <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                                <a 
                                    href={`/api/resumes/${app.resumeId}/download`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="hover:underline truncate"
                                >
                                    {app.resumeName}
                                </a>
                            </div>
                        )}
                        {app.notes && (
                            <div className="flex items-start gap-1.5 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100/50">
                                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
                                <p className="line-clamp-2">{app.notes}</p>
                            </div>
                        )}
                    </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="relative">
                    <select 
                        value={app.status}
                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                        disabled={updatingId === app.id}
                        className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-medium border-0 cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-70 ${getStatusColor(app.status)}`}
                    >
                        <option value="applied">已投递</option>
                        <option value="interviewing">面试中</option>
                        <option value="offer">已录用</option>
                        <option value="rejected">已拒绝</option>
                        {['referred', 'reviewed', 'pending', 'pending_apply', 'success', 'failed'].includes(app.status) && (
                            <option value={app.status} disabled>{getStatusLabel(app.status)}</option>
                        )}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-50" />
                </div>
                
                <button 
                    onClick={() => handleDelete(app.id)}
                    className="text-gray-300 hover:text-red-500 transition-colors p-1.5 rounded-md hover:bg-red-50"
                    title="删除记录"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
