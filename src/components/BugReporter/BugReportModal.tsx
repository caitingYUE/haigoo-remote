import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const BugReportModal: React.FC<BugReportModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [contactInfo, setContactInfo] = useState('');
    const [image, setImage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle paste event
    React.useEffect(() => {
        if (!isOpen) return;

        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) {
                        if (file.size > 5 * 1024 * 1024) {
                            setErrorMessage('图片大小不能超过 5MB');
                            return;
                        }
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            setImage(reader.result as string);
                            setErrorMessage('');
                        };
                        reader.readAsDataURL(file);
                        // Prevent default paste behavior if it's an image
                        e.preventDefault(); 
                    }
                    break;
                }
            }
        };

        document.addEventListener('paste', handlePaste);
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                setErrorMessage('图片大小不能超过 5MB');
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
                setErrorMessage('');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            const token = localStorage.getItem('token');
            
            const res = await fetch('/api/admin-ops?action=bug_report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    title,
                    description,
                    imageUrl: image,
                    userNickname: user?.username || user?.email?.split('@')[0],
                    contactInfo
                })
            });

            const data = await res.json();
            if (data.success) {
                setStatus('success');
                setTimeout(() => {
                    onClose();
                    setTitle('');
                    setDescription('');
                    setContactInfo('');
                    setImage(null);
                    setStatus('idle');
                }, 2000);
            } else {
                throw new Error(data.error || '提交失败');
            }
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div 
            id="bug-report-modal-overlay"
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        >
            <div 
                id="bug-report-modal-content"
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col transition-opacity duration-300"
            >
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg text-slate-800">提交反馈 / Bug</h3>
                        <a href="/bug-leaderboard" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full border border-indigo-100">
                            <Trophy className="w-3 h-3" />
                            贡献榜
                        </a>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {status === 'success' ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                        <h4 className="text-xl font-bold text-slate-800 mb-2">提交成功！</h4>
                        <p className="text-slate-600">感谢您的反馈，我们会尽快处理。</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    提报人
                                </label>
                                <input
                                    type="text"
                                    value={user?.username || user?.email?.split('@')[0] || '匿名用户'}
                                    disabled
                                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-slate-500 text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    联系方式 (可选)
                                </label>
                                <input
                                    type="text"
                                    value={contactInfo}
                                    onChange={(e) => setContactInfo(e.target.value)}
                                    placeholder="邮箱或微信"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                问题简述 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例如：点击登录按钮无反应"
                                required
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                详细描述
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="请详细描述复现步骤、期望结果等..."
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                截图 (可选)
                            </label>
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-200 rounded-lg p-2 text-center hover:bg-slate-50 transition-colors cursor-pointer relative h-20 flex flex-col items-center justify-center"
                            >
                                {image ? (
                                    <div className="relative group h-full w-full flex items-center justify-center">
                                        <img src={image} alt="Preview" className="max-h-full rounded object-contain" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded text-white text-xs">
                                            点击更换
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <Upload className="w-4 h-4" />
                                        <span className="text-xs">点击上传或粘贴图片</span>
                                    </div>
                                )}
                                <input 
                                    ref={fileInputRef}
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleImageUpload} 
                                    className="hidden" 
                                />
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 p-2 rounded-lg">
                                <AlertCircle className="w-3 h-3" />
                                {errorMessage}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-sm shadow-md shadow-indigo-200"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    提交中...
                                </>
                            ) : '提交反馈'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};
