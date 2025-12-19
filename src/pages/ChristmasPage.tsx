import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TreeRenderer } from '../components/Christmas/TreeRenderer';
import { RotatingQuotes } from '../components/Christmas/RotatingQuotes';
import { EmailCaptureModal } from '../components/Christmas/EmailCaptureModal';
import { HappinessCard } from '../components/Christmas/HappinessCard';
import { ChristmasErrorBoundary } from '../components/Christmas/ChristmasErrorBoundary';
import { Upload, Sparkles, Share2, Loader2, Download, Wand2, Gift, Trees } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import html2canvas from 'html2canvas';

// Helper for corner decorations
const Corner = ({ className }: { className?: string }) => (
    <svg className={`w-16 h-16 absolute text-[#d4af37] opacity-80 ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M 10 10 L 40 10 M 10 10 L 10 40 M 15 15 L 35 15 M 15 15 L 15 35" />
        <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
);

export default function ChristmasPage() {
    const { user } = useAuth();
    
    const [step, setStep] = useState<'upload' | 'processing' | 'result'>('upload');
    const [treeData, setTreeData] = useState<any>(null);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasPublished, setHasPublished] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showHappinessCard, setShowHappinessCard] = useState(false);
    const treeRef = useRef<HTMLDivElement>(null);

    const publishToForest = async () => {
        if (hasPublished || !treeData) return;
        try {
            await fetch('/api/campaign/forest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tree_id: treeData.tree_id || Date.now().toString(),
                    tree_data: treeData,
                    star_label: treeData.tree_structure?.star_label || 'Star',
                    user_nickname: user?.username || 'Guest'
                })
            });
            setHasPublished(true);
        } catch (err) {
            console.error('Failed to publish to forest:', err);
        }
    };

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
            // Auto-publish when generated successfully
            publishToForest();
        } catch (err: any) {
            setError(err.message);
            setStep('upload');
        }
    };

    const handleTextSubmit = async (text: string) => {
        if (text.length < 50) {
            setError('请输入至少50个字符');
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
            // Auto-publish when generated successfully
            publishToForest();
        } catch (err: any) {
            setError(err.message);
            setStep('upload');
        }
    };

    const handleDownloadClick = () => {
        setShowEmailModal(true);
    };

    const handleEmailSubmit = async (email: string) => {
        if (email) {
            try {
                await fetch('/api/campaign/christmas?action=lead', {
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
                backgroundColor: '#0a0a1a', // Match the dark theme
                scale: 2,
                logging: false,
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `haigoo-magic-tree-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Download failed:', err);
            alert('下载失败，请重试');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleShare = async () => {
        if (navigator.share && treeRef.current) {
            try {
                const canvas = await html2canvas(treeRef.current, { scale: 2, backgroundColor: '#0a0a1a', useCORS: true });
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
            alert('请使用浏览器自带分享功能，或截图分享');
        }
    };

    return (
        <ChristmasErrorBoundary>
            <div className="min-h-screen bg-[#050510] text-[#e2e8f0] font-serif relative overflow-x-hidden selection:bg-[#d4af37] selection:text-black">
                
                {/* Magical Background Layers */}
                <div className="fixed inset-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b,transparent_70%)] opacity-60"></div>
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 animate-pulse"></div>
                    {/* Floating Glows */}
                    <div className="absolute top-20 left-[10%] w-64 h-64 bg-purple-500/10 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-20 right-[10%] w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]"></div>
                </div>

                <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 md:py-16 flex flex-col items-center">
                    
                    {/* Header */}
                    <div className="text-center mb-16 relative">
                        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-px h-12 bg-gradient-to-b from-transparent to-[#d4af37]/50"></div>
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#fcd34d] to-[#b45309] mb-6 tracking-wide" style={{ fontFamily: 'Cinzel, serif' }}>
                            Magical Career Tree
                        </h1>
                        <p className="text-xl md:text-2xl text-[#94a3b8] font-light italic" style={{ fontFamily: 'Great Vibes, cursive' }}>
                            Transform your resume into a festive masterpiece
                        </p>
                        
                        <div className="mt-8 max-w-xl mx-auto opacity-80">
                            <RotatingQuotes />
                        </div>
                    </div>

                    {/* --- STEP: UPLOAD --- */}
                    {step === 'upload' && (
                        <div className="w-full max-w-2xl relative group">
                            {/* Card Glow */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#d4af37] rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                            
                            <div className="relative bg-[#0f172a] border border-[#d4af37]/30 rounded-3xl p-8 md:p-12 text-center overflow-hidden">
                                <Corner className="top-4 left-4" />
                                <Corner className="top-4 right-4 rotate-90" />
                                <Corner className="bottom-4 right-4 rotate-180" />
                                <Corner className="bottom-4 left-4 -rotate-90" />

                                <div className="mb-8">
                                    <div className="w-20 h-20 mx-auto bg-[#1e293b] rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(212,175,55,0.2)]">
                                        <Wand2 className="w-10 h-10 text-[#d4af37]" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-[#f1f5f9] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                                        Begin the Magic
                                    </h2>
                                    <p className="text-slate-400">Upload your resume to generate your unique tree</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <label className="relative cursor-pointer group/upload">
                                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                                        <div className="h-full border-2 border-dashed border-slate-700 hover:border-[#d4af37] rounded-xl p-6 flex flex-col items-center justify-center transition-all bg-slate-900/50 hover:bg-slate-800/80">
                                            <Upload className="w-8 h-8 text-slate-400 mb-3 group-hover/upload:text-[#d4af37] transition-colors" />
                                            <span className="text-sm font-medium text-slate-300">Upload Resume</span>
                                            <span className="text-xs text-slate-500 mt-1">PDF, DOCX, TXT</span>
                                        </div>
                                    </label>

                                    <div className="relative">
                                        <div className="h-full border-2 border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-900/50">
                                            <textarea 
                                                placeholder="Or paste your resume content here..."
                                                className="w-full h-24 bg-transparent border-none resize-none text-sm text-slate-300 focus:ring-0 placeholder-slate-600 text-center"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.metaKey) {
                                                        handleTextSubmit(e.currentTarget.value);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (e.target.value.length > 50) handleTextSubmit(e.target.value);
                                                }}
                                            />
                                            <div className="mt-2 text-xs text-slate-500">Paste & Click Outside</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- STEP: PROCESSING --- */}
                    {step === 'processing' && (
                        <div className="text-center py-20">
                            <div className="relative w-24 h-24 mx-auto mb-8">
                                <div className="absolute inset-0 border-4 border-[#d4af37]/20 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-[#d4af37] rounded-full animate-spin"></div>
                                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-[#d4af37] animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-bold text-[#e2e8f0] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                                Weaving Spells...
                            </h3>
                            <p className="text-slate-400 animate-pulse">Analyzing your career path</p>
                        </div>
                    )}

                    {/* --- STEP: RESULT --- */}
                    {step === 'result' && treeData && (
                        <div className="w-full animate-in fade-in zoom-in duration-1000">
                            <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
                                
                                {/* The Tree Frame */}
                                <div className="relative mx-auto lg:mx-0 max-w-2xl w-full">
                                    {/* Ornate Frame */}
                                    <div className="relative bg-[#0a0a1a] p-4 md:p-8 rounded-sm shadow-2xl border-[8px] border-[#1e1e1e]"
                                         style={{ 
                                             boxShadow: '0 0 0 1px #444, 0 0 0 4px #d4af37, 0 0 50px rgba(0,0,0,0.8)',
                                             backgroundImage: 'url("https://www.transparenttextures.com/patterns/dark-wood.png")'
                                         }}>
                                        <div ref={treeRef} className="bg-[#0a0a1a] relative overflow-hidden rounded-sm flex flex-col">
                                            {/* Inner Glow */}
                                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(212,175,55,0.05),transparent_80%)] pointer-events-none z-0"></div>
                                            
                                            {/* Tree */}
                                            <TreeRenderer data={treeData.tree_structure || treeData} width={600} height={800} />
                                            
                                            {/* AI Interpretation Section (Inside the frame for download) */}
                                            {treeData.interpretation && (
                                                <div className="px-8 pb-12 pt-4 relative z-10 text-center">
                                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4af37]/30 to-transparent mb-6"></div>
                                                    
                                                    <div className="space-y-4 font-serif">
                                                        <p className="text-[#fcd34d] text-lg italic">
                                                            "{treeData.interpretation.personality}"
                                                        </p>
                                                        <p className="text-slate-400 text-sm leading-relaxed">
                                                            {treeData.interpretation.uniqueness}
                                                        </p>
                                                        <p className="text-[#d4af37] text-sm mt-4 font-medium">
                                                            ✨ {treeData.interpretation.future_wish}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Branding Watermark */}
                                            <div className="absolute bottom-2 right-4 text-[#d4af37]/30 font-serif text-xs tracking-widest uppercase z-10">
                                                Haigoo · Christmas
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                                        <button 
                                            onClick={handleDownloadClick}
                                            disabled={isDownloading}
                                            className="group relative px-6 py-3 bg-[#d4af37] text-[#0f172a] font-bold rounded-full overflow-hidden shadow-[0_0_20px_rgba(212,175,55,0.3)] hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] transition-all flex items-center gap-2"
                                        >
                                            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                            <span>保存纪念</span>
                                        </button>

                                        <button 
                                            onClick={() => setShowHappinessCard(true)}
                                            className="px-6 py-3 bg-red-900/30 border border-red-500/30 text-red-200 font-bold rounded-full hover:bg-red-900/50 hover:border-red-500/60 transition-all flex items-center gap-2"
                                        >
                                            <Gift className="w-5 h-5" />
                                            <span>抽取祝福</span>
                                        </button>
                                        
                                        <button 
                                            onClick={handleShare}
                                            className="px-6 py-3 bg-slate-800/50 border border-slate-600/50 text-slate-300 font-bold rounded-full hover:bg-slate-700/50 transition-all flex items-center gap-2"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <span>分享</span>
                                        </button>

                                        <Link to="/campaign/forest" className="px-6 py-3 bg-green-900/30 border border-green-500/30 text-green-200 font-bold rounded-full hover:bg-green-900/50 hover:border-green-500/60 transition-all flex items-center gap-2">
                                            <Trees className="w-5 h-5" />
                                            <span>参观森林</span>
                                        </Link>
                                    </div>
                                    
                                    <div className="mt-4 text-center">
                                        <button 
                                            onClick={() => setStep('upload')}
                                            className="text-sm text-slate-500 hover:text-[#d4af37] transition-colors underline decoration-dotted"
                                        >
                                            重新生成一棵
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-8 p-4 bg-red-900/50 border border-red-500/50 text-red-200 rounded-xl flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            {error}
                        </div>
                    )}

                    <EmailCaptureModal 
                        isOpen={showEmailModal} 
                        onClose={() => setShowEmailModal(false)} 
                        onSubmit={handleEmailSubmit} 
                    />
                    
                    {showHappinessCard && (
                        <HappinessCard onClose={() => setShowHappinessCard(false)} />
                    )}
                </div>
            </div>
        </ChristmasErrorBoundary>
    );
}
