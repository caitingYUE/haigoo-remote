
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Send, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
}

export const ReferralModal: React.FC<ReferralModalProps> = ({ isOpen, onClose, jobId, jobTitle }) => {
  const { user, token } = useAuth();
  const [resumes, setResumes] = useState<any[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && token) {
      fetchResumes();
    }
  }, [isOpen, token]);

  const fetchResumes = async () => {
    setLoadingResumes(true);
    try {
      const res = await fetch('/api/resumes', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data) {
        setResumes(data.data);
        if (data.data.length > 0) {
          setSelectedResumeId(data.data[0].id || data.data[0].resume_id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch resumes', e);
    } finally {
      setLoadingResumes(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedResumeId) {
      setError('请选择一份简历');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/user-profile?action=submit_referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          jobId,
          resumeId: selectedResumeId,
          notes
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setNotes('');
        }, 2000);
      } else {
        setError(data.error || '提交失败，请重试');
      }
    } catch (e) {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
          <h3 className="font-bold text-slate-900">内推申请</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">申请已提交</h4>
              <p className="text-slate-600">我们会尽快处理您的内推请求，请留意后续通知。</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">申请职位</p>
                <div className="p-3 bg-slate-50 rounded-lg text-slate-900 text-sm border border-slate-200">
                  {jobTitle}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">选择简历</label>
                {loadingResumes ? (
                  <div className="text-center py-4 text-slate-500 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                    加载简历中...
                  </div>
                ) : resumes.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-slate-200 rounded-lg text-center">
                    <p className="text-sm text-slate-500 mb-2">暂无简历</p>
                    <a href="/profile?tab=resume" className="text-indigo-600 text-sm font-medium hover:underline">
                      前往上传简历
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {resumes.map(resume => (
                      <div 
                        key={resume.id || resume.resume_id}
                        onClick={() => setSelectedResumeId(resume.id || resume.resume_id)}
                        className={`p-3 rounded-lg border cursor-pointer flex items-center gap-3 transition-colors ${
                          selectedResumeId === (resume.id || resume.resume_id)
                            ? 'border-indigo-600 bg-indigo-50'
                            : 'border-slate-200 hover:border-indigo-300'
                        }`}
                      >
                        <FileText className={`w-5 h-5 ${selectedResumeId === (resume.id || resume.resume_id) ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${selectedResumeId === (resume.id || resume.resume_id) ? 'text-indigo-900' : 'text-slate-700'}`}>
                            {resume.fileName || resume.file_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(resume.created_at || resume.createdAt || resume.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                        {selectedResumeId === (resume.id || resume.resume_id) && (
                          <CheckCircle className="w-5 h-5 text-indigo-600" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  补充说明 (可选)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="简单介绍您的优势，或对该职位的特殊问题..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm h-24 resize-none"
                />
              </div>

              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!success && (
          <div className="p-6 pt-0 bg-white flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={loading || resumes.length === 0}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  提交中...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  确认提交内推申请
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
