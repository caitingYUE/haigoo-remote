import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Upload, Send, Clock, CheckCircle } from 'lucide-react';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { trackingService } from '../services/tracking-service';

interface ReferralApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    job: Job;
    onSubmitSuccess: () => void;
}

interface Resume {
    id: string;
    fileName: string;
    createdAt: string;
}

export const ReferralApplicationModal: React.FC<ReferralApplicationModalProps> = ({
    isOpen,
    onClose,
    job,
    onSubmitSuccess
}) => {
    const { token } = useAuth();
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [selectedResumeId, setSelectedResumeId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingResumes, setIsLoadingResumes] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('文件大小不能超过 5MB');
            return;
        }

        // Check file type
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (!allowedTypes.includes(file.type)) {
            alert('仅支持 PDF, DOC, DOCX 格式');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('resume', file);
        formData.append('metadata', JSON.stringify({ source: 'job_application' }));

        trackingService.track('upload_resume', { 
            source: 'job_application', 
            file_type: file.type,
            file_size: file.size
        });

        try {
            const response = await fetch('/api/resumes', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                const data = await response.json();
                // Refresh list
                await fetchResumes();
                // Select the new resume
                if (data.data?.id) {
                    setSelectedResumeId(data.data.id);
                }
                alert('简历上传成功');
            } else {
                throw new Error('上传失败');
            }
        } catch (error) {
            console.error('Failed to upload resume:', error);
            alert('简历上传失败，请重试');
        } finally {
            setIsUploading(false);
            // Reset input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchResumes();
        }
    }, [isOpen]);

    const fetchResumes = async () => {
        setIsLoadingResumes(true);
        try {
            const response = await fetch('/api/resumes', {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.data && Array.isArray(data.data)) {
                    const resumeList = data.data.map((r: any) => ({
                        id: r.id || r.resume_id,
                        fileName: r.fileName || r.file_name || 'Resume',
                        createdAt: r.created_at || r.createdAt
                    }));
                    setResumes(resumeList);

                    // Auto-select the first resume if available
                    if (resumeList.length > 0) {
                        setSelectedResumeId(resumeList[0].id);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch resumes:', error);
        } finally {
            setIsLoadingResumes(false);
        }
    };

    const handleSubmit = async () => {
        if (!selectedResumeId) {
            alert('请选择一份简历');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/user-profile?action=submit_referral', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    jobId: job.id,
                    resumeId: selectedResumeId,
                    notes
                })
            });

            if (response.ok) {
                onSubmitSuccess();
                onClose();
                trackingService.track('submit_referral', { 
                    job_id: job.id, 
                    resume_id: selectedResumeId,
                    has_notes: !!notes
                });
            } else {
                throw new Error('提交失败');
            }
        } catch (error) {
            console.error('Failed to submit referral:', error);
            alert('提交失败，请稍后重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" role="dialog" aria-modal="true">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer"
                onClick={onClose}
            />

            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all">
                {/* Header */}
                <div className="bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 p-6 text-white relative overflow-hidden flex-shrink-0">
                    {/* Decorative background elements */}
                    <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
                    
                    <div className="relative z-10 flex items-center gap-3 mb-2">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Send className="w-6 h-6" />
                        </div>
                        <h2 className="text-xl font-bold text-white">申请内推</h2>
                    </div>
                    <p className="relative z-10 text-indigo-100 text-sm">
                        填写以下信息，我们将在 <strong>3个工作日内</strong> 审核您的申请
                    </p>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors z-50"
                >
                    <X className="w-5 h-5" />
                </button>


                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {/* Job Info */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                        <h3 className="font-bold text-slate-900 mb-1">{job.title}</h3>
                        <p className="text-sm text-slate-600">{job.company}</p>
                        <p className="text-sm text-slate-500 mt-1">{job.location}</p>
                    </div>

                    {/* Resume Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-semibold text-slate-900">
                                选择简历 <span className="text-red-500">*</span>
                            </label>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                            >
                                {isUploading ? (
                                    '上传中...'
                                ) : (
                                    <>
                                        <Upload className="w-3.5 h-3.5" />
                                        上传新简历
                                    </>
                                )}
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                            />
                        </div>

                        {isLoadingResumes ? (
                            <div className="text-center py-8 text-slate-500">
                                <div className="w-8 h-8 border-4 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
                                加载简历中...
                            </div>
                        ) : resumes.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
                                <FileText className="w-12 h-12 text-yellow-600 mx-auto mb-3" />
                                <p className="text-sm text-yellow-800 font-medium mb-3">
                                    您还没有上传简历
                                </p>
                                <button
                                    onClick={() => {
                                        onClose();
                                        // Navigate to profile center resume tab
                                        window.location.href = '/profile?tab=resume';
                                    }}
                                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-sm transition-colors inline-flex items-center gap-2"
                                >
                                    <Upload className="w-4 h-4" />
                                    前往上传简历
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                                {resumes.map((resume) => (
                                    <label
                                        key={resume.id}
                                        className={`flex items-start gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all hover:border-indigo-300 ${selectedResumeId === resume.id
                                                ? 'border-indigo-600 bg-indigo-50'
                                                : 'border-slate-200 bg-white'
                                            }`}
                                    >
                                        <input
                                            type="radio"
                                            name="resume"
                                            value={resume.id}
                                            checked={selectedResumeId === resume.id}
                                            onChange={(e) => setSelectedResumeId(e.target.value)}
                                            className="mt-1"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-indigo-600" />
                                                <span className="font-medium text-slate-900 text-sm">{resume.fileName}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1">
                                                上传时间: {new Date(resume.createdAt).toLocaleDateString('zh-CN')}
                                            </p>
                                        </div>
                                        {selectedResumeId === resume.id && (
                                            <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Additional Notes */}
                    <div>
                        <label className="block text-sm font-semibold text-slate-900 mb-2">
                            补充说明 <span className="text-slate-400 font-normal">(可选)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="例如: 特别感兴趣该岗位的某个方向，或者您认为自己特别适合的理由..."
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent resize-none text-sm"
                            rows={3}
                            maxLength={500}
                        />
                        <p className="text-xs text-slate-500 mt-1 text-right">
                            {notes.length}/500
                        </p>
                    </div>

                    {/* SLA Notice */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                        <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-1">审核时效承诺</p>
                            <p className="text-sm text-blue-700">
                                我们将在 <strong>3个工作日内</strong> 完成审核并转递您的简历。审核通过后，您将收到通知。
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer / Action Buttons */}
                <div className="p-6 pt-0 flex gap-3 flex-shrink-0 bg-white">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 px-6 border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                        disabled={isSubmitting}
                    >
                        取消
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedResumeId || resumes.length === 0}
                        className="flex-1 py-3 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                提交中...
                            </>
                        ) : (
                            <>
                                <Send className="w-5 h-5" />
                                提交申请
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
