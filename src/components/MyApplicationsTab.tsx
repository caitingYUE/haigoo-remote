
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Clock, CheckCircle, XCircle, MoreHorizontal, AlertCircle, MessageSquare, FileText, Trash2, ChevronDown } from 'lucide-react';
import JobCardNew from './JobCardNew';
import { Job } from '../types';

interface Application {
  id: number;
  jobId: string;
  jobTitle: string;
  company: string;
  job: Job;
  interactionType: string;
  status: string;
  updatedAt: string;
  notes: string;
  applicationSource?: string;
  resumeId?: string;
  resumeName?: string;
}

export default function MyApplicationsTab({ onViewJob }: { onViewJob?: (job: Job) => void }) {
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
        setApplications(data.applications || []);
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
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'pending_apply': 'bg-blue-50 text-blue-600 border-blue-200',
      'applied': 'bg-blue-100 text-blue-800 border-blue-200',
      'reviewed': 'bg-indigo-100 text-indigo-800 border-indigo-200',
      'referred': 'bg-purple-100 text-purple-800 border-purple-200',
      'interviewing': 'bg-orange-100 text-orange-800 border-orange-200',
      'success': 'bg-green-100 text-green-800 border-green-200',
      'rejected': 'bg-red-100 text-red-800 border-red-200',
      'failed': 'bg-red-50 text-red-900 border-red-200',
      'offer': 'bg-green-100 text-green-800 border-green-200'
    }
    return styles[status] || 'bg-gray-100 text-gray-800 border-gray-200'
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
      <div className="space-y-4">
        {applications.map((app) => {
          const statusNode = (
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={app.status}
                  onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                  disabled={updatingId === app.id}
                  className={`appearance-none pl-3 pr-7 py-0.5 rounded-full text-xs font-medium border cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 disabled:opacity-70 ${getStatusColor(app.status)}`}
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
            </div>
          );

          if (!app.job?.id) {
            return (
              <div key={app.id} className="relative bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1.5 truncate">{app.jobTitle}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                    {app.company}
                  </div>
                  <div className="mt-3 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md inline-block">
                    该职位已失效或信息不全
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }} className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )
          }

          return (
            <div key={app.id} className="relative group flex flex-col gap-0 bg-white rounded-2xl shadow-sm border border-slate-100 hover:border-indigo-200 hover:shadow-md transition-all">
              <JobCardNew
                job={{ ...app.job, isFeatured: false, appliedAt: app.updatedAt } as any}
                variant="list"
                onClick={() => onViewJob && onViewJob(app.job)}
                onDelete={() => handleDelete(app.id)}
                applicationStatusNode={statusNode}
                className="border-0 shadow-none hover:shadow-none bg-transparent hover:bg-slate-50/30"
              />
              {(app.notes || app.resumeName) && (
                <div className="px-5 pb-4 bg-transparent mt-0">
                  <div className="border-t border-slate-100 pt-3 flex flex-col gap-3">
                    {app.resumeName && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-slate-400 font-medium">使用的简历：</span>
                        <a
                          href={`/api/resumes/${app.resumeId}/download`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-700 hover:underline font-medium truncate max-w-[200px]"
                        >
                          <FileText className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{app.resumeName}</span>
                        </a>
                      </div>
                    )}
                    {app.notes && (
                      <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                        <p className="line-clamp-3 leading-relaxed">{app.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
