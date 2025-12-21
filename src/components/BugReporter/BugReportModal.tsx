import React, { useState, useRef } from 'react';
import { X, Upload, Loader2, AlertCircle, CheckCircle, Camera, Trophy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import html2canvas from 'html2canvas';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// 压缩图片函数
const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1200;
                const MAX_HEIGHT = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                // 压缩质量 0.6
                const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                resolve(dataUrl);
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

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
    const [isCapturing, setIsCapturing] = useState(false);

    if (!isOpen) return null;

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) { // 10MB limit before compression
                setErrorMessage('图片大小不能超过 10MB');
                return;
            }
            try {
                const compressed = await compressImage(file);
                setImage(compressed);
            } catch (err) {
                console.error('Image compression failed:', err);
                setErrorMessage('图片处理失败');
            }
        }
    };

    const handleCaptureScreen = async () => {
        try {
            setIsCapturing(true);
            // 隐藏 Modal 避免截取到自己
            const modalElement = document.getElementById('bug-report-modal-content');
            if (modalElement) modalElement.style.opacity = '0';
            
            // 等待一小段时间让 Modal 消失
            await new Promise(resolve => setTimeout(resolve, 300));

            const canvas = await html2canvas(document.body, {
                useCORS: true,
                ignoreElements: (element) => {
                    // 忽略 bug report 相关的元素
                    return element.id === 'bug-report-modal-overlay' || element.tagName === 'IFRAME';
                }
            });

            // 恢复 Modal
            if (modalElement) modalElement.style.opacity = '1';

            // 压缩截图
            const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
            setImage(dataUrl);
        } catch (err) {
            console.error('Screenshot failed:', err);
            setErrorMessage('自动截图失败，请尝试手动上传');
            // 恢复 Modal
            const modalElement = document.getElementById('bug-report-modal-content');
            if (modalElement) modalElement.style.opacity = '1';
        } finally {
            setIsCapturing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus('idle');
        setErrorMessage('');

        try {
            const token = localStorage.getItem('token'); // Or get from AuthContext if available
            
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
                    userNickname: user?.username
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
                className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] transition-opacity duration-300"
            >
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg text-slate-800">提交反馈 / Bug</h3>
                        <a href="/bug-leaderboard" target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full">
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
                    <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                提报人
                            </label>
                            <input
                                type="text"
                                value={user?.username || '未登录用户'}
                                disabled
                                className="w-full px-3 py-2 bg-slate-100 border border-slate-300 rounded-lg text-slate-500 text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                问题简述 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="例如：点击登录按钮无反应"
                                required
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                详细描述
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="请详细描述复现步骤、期望结果等..."
                                rows={4}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                联系方式 (可选)
                            </label>
                            <input
                                type="text"
                                value={contactInfo}
                                onChange={(e) => setContactInfo(e.target.value)}
                                placeholder="邮箱或微信号，方便我们联系您"
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                截图 (可选)
                            </label>
                            <div className="flex gap-2">
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex-1 border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:bg-slate-50 transition-colors cursor-pointer relative min-h-[120px] flex flex-col items-center justify-center"
                                >
                                    {image ? (
                                        <div className="relative group w-full h-full">
                                            <img src={image} alt="Preview" className="max-h-32 mx-auto rounded shadow-sm object-contain" />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded">
                                                <span className="text-white text-sm">点击更换</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-2 text-slate-500">
                                            <Upload className="w-8 h-8 mb-2 text-slate-400" />
                                            <span className="text-sm">上传图片</span>
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
                                
                                {!image && (
                                    <button
                                        type="button"
                                        onClick={handleCaptureScreen}
                                        disabled={isCapturing}
                                        className="w-24 border border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors gap-2"
                                        title="自动截取当前屏幕"
                                    >
                                        {isCapturing ? (
                                            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                                        ) : (
                                            <Camera className="w-6 h-6" />
                                        )}
                                        <span className="text-xs">截屏</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {errorMessage && (
                            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                                <AlertCircle className="w-4 h-4" />
                                {errorMessage}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || isCapturing}
                                className="w-full py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        提交中...
                                    </>
                                ) : '提交反馈'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};
