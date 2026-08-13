
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
      'reviewed': 'bg-[#dce9f5] text-[#2d4f73] border-[#c9dce8]',
      'referred': 'bg-[#fff8e8] text-[#6f4711] border-[#e7c98e]',
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
      'pending': '想申请',
      'pending_apply': '想申请',
      'applied': '已申请',
      'reviewed': '已申请',
      'referred': '已申请',
      'interviewing': '面试',
      'success': '已结束',
      'rejected': '已结束',
      'failed': '已结束',
      'offer': '已结束'
    }
    return labels[status] || status
  };

  if (loading) {
    return <div className="hg-application-loading py-16 text-sm text-gray-500">正在读取申请记录…</div>
  }

  if (applications.length === 0) {
    return (
      <div className="hg-profile-empty min-h-[260px] py-12 text-left">
        <Briefcase className="mb-4 h-5 w-5 text-[#466f9d]" />
        <h3 className="text-lg font-semibold text-gray-900">还没有申请记录</h3>
        <p className="mt-2 text-sm text-gray-500">通过官网直申后，可以在这里继续记录进展。</p>
      </div>
    )
  }

  return (
    <div className="hg-application-list space-y-4">
      <header className="hg-application-header flex items-end justify-between gap-5">
        <div>
          <div className="hg-product-kicker">APPLICATIONS</div>
          <h2>申请记录</h2>
          <p>记录你主动申请过的岗位，以及后续进展。</p>
        </div>
        <span className="text-xs font-normal text-gray-400">保留近 1 年</span>
      </header>
      <div className="hg-application-records">
        {applications.map((app) => {
          const statusNode = (
            <div className="flex items-center gap-2">
              <div className="relative">
                <select
                  value={app.status}
                  onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                  disabled={updatingId === app.id}
                  className={`h-11 appearance-none rounded-full border pl-3 pr-8 text-xs font-medium cursor-pointer transition-colors focus:ring-2 focus:ring-offset-1 focus:ring-[#587faa] disabled:opacity-70 ${getStatusColor(app.status)}`}
                >
                  <option value="applied">已申请</option>
                  <option value="interviewing">面试</option>
                  <option value="offer">结束 · 已录用</option>
                  <option value="rejected">结束 · 未继续</option>
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
              <div key={app.id} className="hg-application-row relative flex items-center justify-between py-5">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 mb-1.5 truncate">{app.jobTitle}</h3>
                  <div className="flex items-center gap-1.5 text-sm text-slate-600 font-medium">
                    {app.company}
                  </div>
                  <div className="mt-3 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md inline-block">
                    该职位已失效或信息不全
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="删除这条申请记录"
                  onClick={(e) => { e.stopPropagation(); handleDelete(app.id); }}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )
          }

          return (
            <div key={app.id} className="hg-application-row group relative flex flex-col gap-0 transition-colors">
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
                          className="flex items-center gap-1.5 text-[#466f9d] hover:text-[#345d88] hover:underline font-medium truncate max-w-[200px]"
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
