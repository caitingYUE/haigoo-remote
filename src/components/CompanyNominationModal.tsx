import React, { useState } from 'react';
import { X, Building2, Link as LinkIcon, User, MessageSquare, Loader2 } from 'lucide-react';
import { useNotificationHelpers } from './NotificationSystem';

interface CompanyNominationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CompanyNominationModal: React.FC<CompanyNominationModalProps> = ({ isOpen, onClose }) => {
    const { showSuccess, showError } = useNotificationHelpers();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        companyWebsite: '',
        contact: '',
        recruitmentNeeds: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.companyName || !formData.companyWebsite || !formData.contact) {
            showError('请填写必要信息', '企业名称、官网和联系方式为必填项');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('haigoo_auth_token');
            if (!token) {
                showError('请先登录', '登录后即可提交招聘需求');
                return;
            }

            // Using submit_feedback API but with source=recruitment_request
            const res = await fetch('/api/user-profile?action=submit_feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    source: 'recruitment_request',
                    content: `[招聘需求] ${formData.recruitmentNeeds || '无详细描述'}`, // Fallback content for older clients/admins
                    // Extra fields will be ignored by old API unless we update backend
                })
            });

            const data = await res.json();

            if (data.success) {
                showSuccess('提交成功', '我们已收到由于您的招聘需求，工作人员将尽快与您联系。');
                onClose();
                setFormData({ companyName: '', companyWebsite: '', contact: '', recruitmentNeeds: '' });
            } else {
                showError('提交失败', data.error || '请稍后重试');
            }
        } catch (error) {
            console.error('Submission error:', error);
            showError('提交失败', '网络请求错误，请稍后重试');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900">我要招聘</h3>
                        <p className="text-sm text-slate-500">发布远程岗位，对接全球人才</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-slate-200/50 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                企业名称 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.companyName}
                                    onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                                    placeholder="请输入企业名称"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                官网链接 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="url"
                                    value={formData.companyWebsite}
                                    onChange={(e) => setFormData(prev => ({ ...prev, companyWebsite: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                                    placeholder="https://..."
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                联系方式 <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    value={formData.contact}
                                    onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all"
                                    placeholder="HR 邮箱、微信或电话"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                招聘需求 <span className="text-slate-400 font-normal">(可选)</span>
                            </label>
                            <div className="relative">
                                <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                                <textarea
                                    value={formData.recruitmentNeeds}
                                    onChange={(e) => setFormData(prev => ({ ...prev, recruitmentNeeds: e.target.value }))}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none transition-all min-h-[100px] resize-none"
                                    placeholder="简述需要招聘的岗位、人数或特殊要求..."
                                />
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm shadow-indigo-500/20 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                提交需求
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};
