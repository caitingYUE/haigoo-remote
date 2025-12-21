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
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="w-8 h-8 text-white" />
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
                    留下邮箱，开启远程之旅
                </h2>
                <p className="text-slate-600 text-center mb-6 text-sm">
                    我们会将您的职业圣诞树发送到邮箱，同时为您关注全球远程工作机会
                </p>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="your@email.com"
                                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                disabled={isSubmitting}
                            />
                        </div>
                        {error && (
                            <p className="text-red-500 text-sm mt-2">{error}</p>
                        )}
                    </div>

                    <label className="flex items-start gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            checked={allowResume}
                            onChange={(e) => setAllowResume(e.target.checked)}
                            className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                            同时上传简历到 Haigoo 人才库，获取更多精准远程机会推荐
                        </span>
                    </label>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? '提交中...' : '开启旅程'}
                    </button>

                    <button
                        type="button"
                        onClick={handleSkip}
                        className="w-full text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                    >
                        暂不留邮箱，直接下载
                    </button>
                </form>

                {/* Privacy Note */}
                <p className="text-xs text-slate-400 text-center mt-4">
                    我们尊重您的隐私，不会将邮箱用于其他用途
                </p>
            </div>
        </div>
    );
};
