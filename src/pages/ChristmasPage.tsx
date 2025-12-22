import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { TreeRenderer } from '../components/Christmas/TreeRenderer';
import { RotatingQuotes } from '../components/Christmas/RotatingQuotes';
import { ShareCopyModal } from '../components/Christmas/ShareCopyModal';
import { EmailCaptureModal } from '../components/Christmas/EmailCaptureModal';
import { HappinessCard } from '../components/Christmas/HappinessCard';
import { ChristmasErrorBoundary } from '../components/Christmas/ChristmasErrorBoundary';
import { Upload, Sparkles, Share2, Loader2, Download, Wand2, Gift, Trees, ShieldCheck, ArrowLeft, Briefcase } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

// Helper for corner decorations
const Corner = ({ className }: { className?: string }) => (
    <svg className={`w-16 h-16 absolute text-[#d4af37] opacity-80 ${className}`} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M 10 10 L 40 10 M 10 10 L 10 40 M 15 15 L 35 15 M 15 15 L 15 35" />
        <circle cx="10" cy="10" r="3" fill="currentColor" />
    </svg>
);

import { ChristmasBGM } from '../components/Christmas/ChristmasBGM';

export default function ChristmasPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    
    const [step, setStep] = useState<'upload' | 'processing' | 'result'>('upload');
    const [treeData, setTreeData] = useState<any>(null);
    const [error, setError] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasPublished, setHasPublished] = useState(false);
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [showHappinessCard, setShowHappinessCard] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [shareContent, setShareContent] = useState('');
    const treeRef = useRef<HTMLDivElement>(null);

    const publishToForest = async () => {
        if (hasPublished || !treeData) return;
        // Auto publish removed as forest is removed
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setStep('processing');
        setError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/campaign?type=christmas', {
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
            const res = await fetch('/api/campaign?type=christmas', {
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

    const handleEmailSubmit = async (email: string, allowResume: boolean) => {
        if (email) {
            try {
                await fetch('/api/campaign?type=christmas&action=lead', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        email, 
                        tree_id: treeData?.tree_id || Date.now(),
                        allow_resume_storage: allowResume 
                    })
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
                backgroundColor: '#fff7ed', // Match the warm theme
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
        const shareTexts = [
            "2025，我的职业关键词是成长与突破！来 Haigoo 生成你的专属圣诞树吧 🎄✨ https://haigooremote.com/christmas",
            "用一棵树记录我的职场高光时刻！Haigoo 远程工作社区，祝大家新年快乐 🎁 https://haigooremote.com/christmas",
            "这是我的职业圣诞树，每一片叶子都是努力的见证。快来领取你的新年祝福！🌟 https://haigooremote.com/christmas",
            "Work Remote, Live Better. 在 Haigoo 发现全球远程机会，顺便种了一棵树 🌲 https://haigooremote.com/christmas"
        ];
        const randomText = shareTexts[Math.floor(Math.random() * shareTexts.length)];
        
        setShareContent(randomText);
        setShowShareModal(true);
    };

    return (
        <ChristmasErrorBoundary>
            <style>{`
                @keyframes snow {
                    0% { transform: translateY(-10px); }
                    100% { transform: translateY(100vh); }
                }
                .snowflake {
                    position: absolute;
                    top: -10px;
                    color: white;
                    animation: snow linear infinite;
                    opacity: 0.8;
                }
            `}</style>
            
            {/* Background Music */}
            <ChristmasBGM />

            <div className="min-h-screen bg-[#fdfbf7] text-[#1e293b] font-serif relative overflow-x-hidden selection:bg-[#fca5a5] selection:text-white">
                
                {/* Warm Snowy Background Layers */}
                <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                    {/* 1. Base Gradient: Warm Top -> Icy Bottom */}
                    <div className="absolute inset-0 bg-gradient-to-b from-[#fff7ed] via-[#fefce8] to-[#e0f2fe] opacity-80"></div>
                    
                    {/* 2. Golden Sunlight Glow (Top Center) */}
                    <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[120%] h-[60%] bg-[radial-gradient(circle_at_50%_0%,#fef08a,transparent_70%)] opacity-40 blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>

                    {/* 3. Bokeh / Festive Lights (Soft Focus Background) */}
                    <div className="absolute top-[20%] left-[10%] w-72 h-72 bg-red-500/5 rounded-full blur-[80px]"></div>
                    <div className="absolute top-[30%] right-[15%] w-96 h-96 bg-green-500/5 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-[20%] left-[20%] w-80 h-80 bg-yellow-500/10 rounded-full blur-[90px]"></div>

                    {/* 4. Snow Texture (Subtle Grain) */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/snow.png')] opacity-20"></div>
                    
                    {/* 5. Falling Snowflakes (Darker for visibility on light bg) */}
                    {[...Array(50)].map((_, i) => (
                        <div 
                            key={i}
                            className="snowflake text-slate-300/60"
                            style={{
                                left: `${Math.random() * 100}%`,
                                animationDuration: `${Math.random() * 5 + 5}s`,
                                animationDelay: `${Math.random() * 5}s`,
                                fontSize: `${Math.random() * 20 + 10}px`,
                                textShadow: '0 0 5px rgba(255,255,255,0.8)'
                            }}
                        >
                            ❄
                        </div>
                    ))}
                </div>

                <div className="relative z-10 w-full max-w-6xl mx-auto px-4 py-8 md:py-16 flex flex-col items-center">
                    
                    {/* Navigation Buttons */}
                    <div className="w-full flex justify-between items-center mb-8 px-4">
                        <Link to="/" className="inline-flex items-center gap-2 text-slate-600 hover:text-[#dc2626] transition-colors font-medium bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-md">
                            <ArrowLeft className="w-4 h-4" />
                            <span>返回首页</span>
                        </Link>
                        
                        <Link to="/jobs" className="inline-flex items-center gap-2 text-slate-600 hover:text-[#15803d] transition-colors font-medium bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm border border-white/60 shadow-sm hover:shadow-md">
                            <Briefcase className="w-4 h-4" />
                            <span>找远程工作</span>
                        </Link>
                    </div>

                    {/* Header */}
                    <div className="text-center mb-16 relative">
                        {/* Title Decoration */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[150%] bg-white/40 blur-3xl -z-10 rounded-full"></div>
                        
                        <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#dc2626] to-[#991b1b] mb-6 tracking-wide drop-shadow-sm" style={{ fontFamily: 'Cinzel, serif' }}>
                            Christmas Career Tree
                        </h1>
                        <p className="text-xl md:text-2xl text-[#854d0e] font-light italic" style={{ fontFamily: 'Great Vibes, cursive' }}>
                            A warm winter tale of your growth...
                        </p>
                        
                        <div className="mt-8 max-w-xl mx-auto">
                            <RotatingQuotes />
                        </div>
                    </div>

                    {/* --- STEP: UPLOAD --- */}
                    {step === 'upload' && (
                        <div className="w-full max-w-2xl relative group">
                            {/* Card Glow - Warm Gold/Red */}
                            <div className="absolute -inset-1 bg-gradient-to-r from-[#fca5a5] via-[#fcd34d] to-[#fca5a5] rounded-3xl blur opacity-40 group-hover:opacity-70 transition duration-1000"></div>
                            
                            <div className="relative bg-white/80 backdrop-blur-xl border border-white/60 rounded-3xl p-8 md:p-12 text-center overflow-hidden shadow-2xl">
                                <Corner className="top-4 left-4 text-[#dc2626]" />
                                <Corner className="top-4 right-4 rotate-90 text-[#dc2626]" />
                                <Corner className="bottom-4 right-4 rotate-180 text-[#dc2626]" />
                                <Corner className="bottom-4 left-4 -rotate-90 text-[#dc2626]" />

                                <div className="mb-8">
                                    <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-50 to-orange-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-red-100">
                                        <Wand2 className="w-10 h-10 text-[#dc2626]" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-[#7f1d1d] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                                        开启你的冬日魔法
                                    </h2>
                                    <p className="text-slate-600">上传简历，让职业经历生长成树</p>
                                </div>

                                <div className="grid md:grid-cols-2 gap-6">
                                    <label className="relative cursor-pointer group/upload">
                                        <input type="file" accept=".pdf,.docx,.txt" onChange={handleFileUpload} className="hidden" />
                                        <div className="h-full border-2 border-dashed border-red-200 hover:border-[#dc2626] rounded-xl p-6 flex flex-col items-center justify-center transition-all bg-red-50/30 hover:bg-red-50/50">
                                            <Upload className="w-8 h-8 text-red-400 mb-3 group-hover/upload:text-[#dc2626] transition-colors" />
                                            <span className="text-sm font-medium text-slate-700">上传简历文件</span>
                                            <span className="text-xs text-slate-500 mt-1">支持 PDF, DOCX, TXT</span>
                                        </div>
                                    </label>

                                    <div className="relative">
                                        <div className="h-full border-2 border-slate-200 hover:border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/30 hover:bg-slate-50/50 transition-colors">
                                            <textarea 
                                                placeholder="或者在这里直接粘贴简历内容..."
                                                className="w-full h-24 bg-transparent border-none resize-none text-sm text-slate-700 focus:ring-0 placeholder-slate-400 text-center"
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && e.metaKey) {
                                                        handleTextSubmit(e.currentTarget.value);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (e.target.value.length > 50) handleTextSubmit(e.target.value);
                                                }}
                                            />
                                            <div className="mt-2 text-xs text-slate-400">粘贴后点击外部即可生成</div>
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
                                <div className="absolute inset-0 border-4 border-red-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-t-[#dc2626] rounded-full animate-spin"></div>
                                <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-[#dc2626] animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-bold text-[#7f1d1d] mb-2" style={{ fontFamily: 'Cinzel, serif' }}>
                                Gathering Snowflakes...
                            </h3>
                            <p className="text-slate-600 animate-pulse mb-4">Planting your career seeds</p>
                            
                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/50 rounded-full border border-red-100 shadow-sm">
                                <Loader2 className="w-4 h-4 text-[#dc2626] animate-spin" />
                                <span className="text-sm font-medium text-slate-500">
                                    预计需要 30-60 秒，请耐心等待...
                                </span>
                            </div>
                        </div>
                    )}

                    {/* --- STEP: RESULT --- */}
                    {step === 'result' && treeData && (
                        <div className="w-full animate-in fade-in zoom-in duration-1000">
                            <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
                                
                                {/* The Tree Frame */}
                                <div className="relative mx-auto lg:mx-0 max-w-2xl w-full">
                                    {/* Ornate Frame - Warm Wood / Gold */}
                                    <div className="relative bg-white p-4 md:p-8 rounded-sm shadow-2xl border-[8px] border-[#78350f]"
                                         style={{ 
                                             boxShadow: '0 0 0 1px #50250a, 0 0 0 4px #d4af37, 0 20px 60px rgba(185,28,28,0.15)',
                                             backgroundImage: 'url("https://www.transparenttextures.com/patterns/wood-pattern.png")'
                                         }}>
                                        {/* Tree Container - needs to match TreeRenderer BG (which we will set to transparent or matching gradient) */}
                                        <div ref={treeRef} className="bg-gradient-to-b from-[#fff7ed] to-[#eff6ff] relative overflow-hidden rounded-sm flex flex-col">
                                            
                                            {/* Tree */}
                                            <TreeRenderer data={treeData.tree_structure || treeData} width={600} height={800} />
                                            
                                            {/* AI Interpretation Section */}
                                            {treeData.interpretation && (
                                                <div className="px-8 pb-12 pt-4 relative z-10 text-center bg-gradient-to-t from-white/90 to-transparent -mt-20">
                                                    <div className="w-full h-px bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent mb-6"></div>
                                                    
                                                    <div className="space-y-4 font-serif">
                                                        <p className="text-[#b45309] text-lg italic font-bold">
                                                            "{treeData.interpretation.personality}"
                                                        </p>
                                                        <p className="text-slate-700 text-sm leading-relaxed">
                                                            {treeData.interpretation.uniqueness}
                                                        </p>
                                                        <p className="text-[#dc2626] text-sm mt-4 font-medium">
                                                            ✨ {treeData.interpretation.future_wish}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}


                                        </div>
                                    </div>

                                    {/* Action Bar */}
                                    <div className="mt-8 flex flex-wrap justify-center gap-4">
                                        <button 
                                            onClick={handleDownloadClick}
                                            disabled={isDownloading}
                                            className="group relative px-6 py-3 bg-[#dc2626] text-white font-bold rounded-full overflow-hidden shadow-[0_4px_14px_0_rgba(220,38,38,0.39)] hover:shadow-[0_6px_20px_rgba(220,38,38,0.23)] hover:bg-[#b91c1c] transition-all flex items-center gap-2 hover:-translate-y-1"
                                        >
                                            {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                                            <span>保存纪念</span>
                                        </button>

                                        <button 
                                            onClick={() => setShowHappinessCard(true)}
                                            className="px-6 py-3 bg-white border border-red-200 text-[#dc2626] font-bold rounded-full hover:bg-red-50 hover:border-red-300 transition-all flex items-center gap-2 hover:-translate-y-1 shadow-sm"
                                        >
                                            <Gift className="w-5 h-5" />
                                            <span>抽取祝福</span>
                                        </button>
                                        
                                        <button 
                                            onClick={handleShare}
                                            className="px-6 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-full hover:bg-slate-50 transition-all flex items-center gap-2 hover:-translate-y-1 shadow-sm"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <span>分享</span>
                                        </button>
                                    </div>
                                    
                                    <div className="mt-4 text-center">
                                        <button 
                                            onClick={() => setStep('upload')}
                                            className="text-sm text-slate-500 hover:text-[#dc2626] transition-colors underline decoration-dotted"
                                        >
                                            重新生成一棵
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mt-8 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3">
                            <span className="text-xl">⚠️</span>
                            {error}
                        </div>
                    )}

                    <EmailCaptureModal 
                        isOpen={showEmailModal} 
                        onClose={() => setShowEmailModal(false)} 
                        onSubmit={handleEmailSubmit} 
                    />

                    <ShareCopyModal
                        isOpen={showShareModal}
                        onClose={() => setShowShareModal(false)}
                        content={shareContent}
                    />
                    
                    {showHappinessCard && (
                        <HappinessCard onClose={() => setShowHappinessCard(false)} />
                    )}
                </div>
            </div>
        </ChristmasErrorBoundary>
    );
}
