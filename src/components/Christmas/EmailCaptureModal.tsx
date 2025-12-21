import React, { useState } from 'react';
import { X, Mail, Sparkles } from 'lucide-react';

interface EmailCaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (email: string, allowResume: boolean) => void;
}

export const EmailCaptureModal: React.FC<EmailCaptureModalProps> = ({ isOpen, onClose, onSubmit }) => {
    const [email, setEmail] = useState('');
    const [allowResume, setAllowResume] = useState(true);
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setError('请输入有效的邮箱地址');
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(email, allowResume);
            onClose();
        } catch (err: any) {
            setError(err.message || '提交失败，请重试');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSkip = () => {
        onSubmit('', allowResume); // Empty email = skip
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in zoom-in duration-300">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="w-16 h-16 bg-gradient-to-br from-[#dc2626] to-[#b91c1c] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-100">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-slate-900 text-center mb-3" style={{ fontFamily: 'Cinzel, serif' }}>
                    不错过任何一个远程机会
                </h2>
                <p className="text-slate-600 text-center mb-8 text-sm leading-relaxed px-4">
                    留下邮箱，当有匹配您背景的优质远程工作时，我们会第一时间通知您。
                    <br/>
                    <span className="text-xs text-slate-400 block mt-2">（无需担心打扰，只推荐真正的好机会）</span>
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <div className="relative group">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#dc2626] transition-colors" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="请输入您的邮箱地址..."
                                className="w-full pl-10 pr-4 py-3.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-100 focus:border-[#dc2626] transition-all bg-slate-50 hover:bg-white"
                                disabled={isSubmitting}
                            />
                        </div>
                        {error && (
                            <p className="text-red-500 text-xs mt-2 ml-1 flex items-center gap-1">
                                <span>⚠️</span> {error}
                            </p>
                        )}
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-lg hover:bg-slate-50 transition-colors">
                        <div className="relative flex items-center">
                            <input 
                                type="checkbox" 
                                checked={allowResume}
                                onChange={(e) => setAllowResume(e.target.checked)}
                                className="w-5 h-5 border-2 border-slate-300 rounded text-[#dc2626] focus:ring-[#dc2626] transition-all cursor-pointer"
                            />
                        </div>
                        <span className="text-sm text-slate-600 group-hover:text-slate-900 transition-colors leading-tight pt-0.5">
                            同时加入 Haigoo 人才库，优先获取高薪远程职位的内推机会
                        </span>
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-[#dc2626] hover:bg-[#b91c1c] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-200 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                提交中...
                            </>
                        ) : '确认提交 & 下载'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSkip}
                        className="w-full text-slate-400 hover:text-slate-600 text-xs transition-colors py-2"
                    >
                        暂不留邮箱，直接下载图片
                    </button>
                </form>

                {/* Privacy Note */}
                <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                        您的信息将被严格保密，仅用于工作推荐
                    </p>
                </div>
            </div>
        </div>
    );
};
