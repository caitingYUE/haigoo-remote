
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Briefcase, Clock, CheckCircle, XCircle, MoreHorizontal, AlertCircle, MessageSquare, FileText, Trash2 } from 'lucide-react';

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
      <div className="grid gap-4">
        {applications.map((app) => (
          <div key={app.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-lg text-gray-900 mb-1">{app.jobTitle}</h3>
                <div className="flex items-center gap-2 text-gray-600 text-sm mb-3">
                    <span className="font-medium">{app.company}</span>
                    <span>•</span>
                    <span className="text-gray-400 text-xs">
                        {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    {app.applicationSource === 'referral' && (
                        <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs">内推</span>
                    )}
                    {(app.applicationSource === 'official' || app.applicationSource === 'trusted_platform') && (
                        <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full text-xs">自投</span>
                    )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(app.status)}`}>
                  {getStatusLabel(app.status)}
                </span>
              </div>
            </div>
            
            {app.notes && (
                <div className="mt-3 bg-gray-50 p-3 rounded-lg text-sm text-gray-600 flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-400" />
                    <p>{app.notes}</p>
                </div>
            )}
            
            {app.resumeName && (
                <div className="mt-2 flex items-center gap-2 text-sm text-indigo-600">
                    <FileText className="w-4 h-4" />
                    <a 
                        href={`/api/resumes/${app.resumeId}/download`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="hover:underline"
                    >
                        {app.resumeName}
                    </a>
                </div>
            )}

            {/* Status Update Actions for Non-Referral or User-Editable statuses */}
            {/* Allowing users to update status for ANY application to track their own progress if they want, 
                but maybe restrict 'referral' status updates if admin controls it? 
                User requirement: "User manually updates status... these statuses also sync to admin"
                "Admin records referral status... sync to user"
                
                So:
                - Referral: Admin updates, User views (Maybe User can update to 'interviewing'/'offer' if they hear back before admin?)
                  Let's allow User to update mainly 'interviewing', 'offer', 'rejected' for all types.
            */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end gap-2">
                <select 
                    value={app.status}
                    onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                    disabled={updatingId === app.id}
                    className="text-sm border-gray-200 rounded-lg px-3 py-1.5 bg-gray-50 hover:bg-white focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                    <option value="applied">已投递</option>
                    <option value="interviewing">面试中</option>
                    <option value="offer">已录用</option>
                    <option value="rejected">已拒绝</option>
                    {/* Only show specific admin statuses if current status is already that, to display correctly, but user can't select them? 
                        Actually user shouldn't select 'referred' manually usually.
                    */}
                    {(app.status === 'referred' || app.status === 'reviewed' || app.status === 'pending' || app.status === 'success' || app.status === 'failed') && (
                        <option value={app.status} disabled>{getStatusLabel(app.status)}</option>
                    )}
                </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
