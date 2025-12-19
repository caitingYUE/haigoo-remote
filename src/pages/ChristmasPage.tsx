import React, { useState, useRef } from 'react';
import { TreeRenderer } from '../components/Christmas/TreeRenderer';
import { EmailCaptureModal } from '../components/Christmas/EmailCaptureModal';
import { Upload, Sparkles, Share2, Loader2, FileText, Download } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

export default function ChristmasPage() {
    const { user } = useAuth();
    const navigate = useNavigate();

    const [step, setStep] = useState<'upload' | 'processing' | 'result'>('upload');
    const [treeData, setTreeData] = useState<any>(null);
    const [error, setError] = useState('');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const treeRef = useRef<HTMLDivElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStep('processing');
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/campaign/christmas', {
                method: 'POST',
                body: formData,
            });

            const json = await res.json();
            if (!json.success) throw new Error(json.error || 'Generation failed');

            setTreeData(json.data);
            setStep('result');
        } catch (err: any) {
            setError(err.message);
            setStep('upload');
        }
    };

    const handleTextSubmit = async (text: string) => {
        if (text.length < 50) {
            setError('Please enter at least 50 characters');
            return;
        }
        setStep('processing');
        setError('');

        try {
            const res = await fetch('/api/campaign/christmas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const json = await res.json();
            if (!json.success) throw new Error(json.error);

            setTreeData(json.data);
            setStep('result');
        } catch (err: any) {
            setError(err.message);
            setStep('upload');
        }
    };

    const handleEmailSubmit = async (email: string) => {
        if (email) {
            try {
                await fetch('/api/campaign/christmas-lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, tree_id: treeData?.tree_id || Date.now() })
                });
            } catch (err) {
                console.error('Failed to save email:', err);
            }
        }
        // Proceed with download regardless
        await downloadTree();
    };

    const downloadTree = async () => {
        if (!treeRef.current) return;

        setIsDownloading(true);
        try {
            const canvas = await html2canvas(treeRef.current, {
                backgroundColor: null,
                scale: 2, // High resolution
                logging: false
            });

            const link = document.createElement('a');
            link.download = `haigoo-christmas-tree-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
            alert('下载失败，请重试');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadClick = () => {
        setShowEmailModal(true);
    };

    const handleShare = async () => {
        if (navigator.share && treeRef.current) {
            try {
                const canvas = await html2canvas(treeRef.current, { scale: 2 });
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        const file = new File([blob], 'my-christmas-tree.png', { type: 'image/png' });
                        await navigator.share({
                            title: '我的职业圣诞树 - Haigoo',
                            text: '看看我的职业成长树！',
                            files: [file]
                        });
                    }
                });
            } catch (err) {
                console.error('Share failed:', err);
            }
        } else {
            // Fallback: copy link or show share modal
            alert('分享功能开发中...');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                <div className="absolute top-10 left-10 w-32 h-32 bg-red-300 rounded-full blur-3xl"></div>
                <div className="absolute bottom-20 right-20 w-64 h-64 bg-green-300 rounded-full blur-3xl"></div>
            </div>

            <div className="flex-1 w-full max-w-4xl mx-auto px-4 py-12 relative z-10 flex flex-col items-center justify-center">

                {/* Header */}
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-4 tracking-tight">
                        您的职业圣诞树
                    </h1>
                    <p className="text-xl text-slate-600 font-light">
                        Resume Christmas Tree — 这是你亲手照料的一棵树 🌲
                    </p>
                </div>

                {/* --- STEP: UPLOAD --- */}
                {step === 'upload' && (
                    <div className="w-full max-w-lg bg-white rounded-3xl shadow-xl p-8 border border-white/50 backdrop-blur-sm">
                        <div className="flex flex-col gap-6">
                            {/* File Upload */}
                            <div className="relative group cursor-pointer">
                                <input
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                />
                                <div className="border-2 border-dashed border-slate-300 group-hover:border-indigo-500 rounded-2xl p-10 flex flex-col items-center justify-center transition-all bg-slate-50 group-hover:bg-indigo-50/30">
                                    <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8 text-indigo-600" />
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">上传简历 PDF/Word</h3>
                                    <p className="text-sm text-slate-500 mt-2">支持拖拽上传</p>
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-2 bg-white text-slate-500">或粘贴文本</span>
                                </div>
                            </div>


                            <textarea
                                className="w-full h-32 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                                placeholder="在此粘贴简历内容..."
                                onBlur={(e) => {
                                    if (e.target.value.length > 50) handleTextSubmit(e.target.value)
                                }}
                            ></textarea>

                            {error && (
                                <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded-lg">
                                    {error}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- STEP: PROCESSING --- */}
                {step === 'processing' && (
                    <div className="text-center">
                        <div className="w-24 h-24 mx-auto mb-8 relative">
                            <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                            <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-8 h-8 animate-pulse" />
                        </div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">正在栽种您的圣诞树...</h2>
                        <p className="text-slate-500 animate-pulse">解析职业年轮 · 提取技能养分 · 编写治愈解读</p>
                    </div>
                )}

                {/* --- STEP: RESULT --- */}
                {step === 'result' && treeData && (
                    <div className="w-full flex flex-col items-center animate-in fade-in zoom-in duration-500">

                        {/* Visual - Wrapped for Screenshot */}
                        <div ref={treeRef} className="relative group mb-8 bg-white p-8 rounded-2xl">
                            <TreeRenderer data={treeData.tree_structure} />

                            {/* Hover Actions (Desktop) */}
                            <div className="absolute -right-16 top-0 flex flex-col gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={handleDownloadClick}
                                    disabled={isDownloading}
                                    className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-50 text-indigo-600 disabled:opacity-50"
                                    title="下载高清图"
                                >
                                    {isDownloading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Download className="w-5 h-5" />
                                    )}
                                </button>
                                <button
                                    onClick={handleShare}
                                    className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-pink-50 text-pink-500"
                                    title="分享"
                                >
                                    <Share2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Interpretation Card */}
                        <div className="w-full max-w-2xl bg-white/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-white/50 text-center">
                            <div className="flex justify-center mb-6">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-wider uppercase">
                                    AI 深度解读
                                </span>
                            </div>

                            <div className="space-y-6 font-medium text-slate-700 text-lg leading-relaxed">
                                <p>"{treeData.interpretation.personality}"</p>
                                <p>"{treeData.interpretation.uniqueness}"</p>
                                <p className="text-indigo-600 font-semibold">"{treeData.interpretation.future_wish}"</p>
                            </div>

                            <div className="mt-8 flex justify-center gap-4">
                                <button
                                    onClick={() => window.location.reload()}
                                    className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all"
                                >
                                    再试一次
                                </button>
                                <button
                                    onClick={handleDownloadClick}
                                    disabled={isDownloading}
                                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    {isDownloading ? '生成中...' : '下载我的树'}
                                </button>
                            </div>
                        </div>

                        {/* Email Capture Modal */}
                        <EmailCaptureModal
                            isOpen={showEmailModal}
                            onClose={() => setShowEmailModal(false)}
                            onSubmit={handleEmailSubmit}
                        />

                    </div>
                )}

            </div>
        </div>
    );
}
