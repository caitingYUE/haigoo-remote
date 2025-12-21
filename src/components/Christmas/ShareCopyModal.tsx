import React, { useState } from 'react';
import { X, Copy, Check, Sparkles } from 'lucide-react';

interface ShareCopyModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: string;
}

export const ShareCopyModal: React.FC<ShareCopyModalProps> = ({ isOpen, onClose, content }) => {
    const [copied, setCopied] = useState(false);

    if (!isOpen) return null;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative animate-in zoom-in duration-300 border border-slate-100">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 p-1 rounded-full hover:bg-slate-100"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header */}
                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-6 h-6 text-[#dc2626]" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 font-serif">
                        传递你的职业祝福
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                        复制下方内容，分享给你的朋友们
                    </p>
                </div>

                {/* Content Box */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 relative group">
                    <p className="text-slate-700 text-sm leading-relaxed font-medium break-all whitespace-pre-wrap">
                        {content}
                    </p>
                </div>

                {/* Action Button */}
                <button
                    onClick={handleCopy}
                    className={`w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                        copied 
                        ? 'bg-green-600 text-white shadow-lg shadow-green-200' 
                        : 'bg-[#dc2626] hover:bg-[#b91c1c] text-white shadow-lg shadow-red-200'
                    }`}
                >
                    {copied ? (
                        <>
                            <Check className="w-5 h-5" />
                            <span>已复制成功！</span>
                        </>
                    ) : (
                        <>
                            <Copy className="w-5 h-5" />
                            <span>一键复制内容</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
