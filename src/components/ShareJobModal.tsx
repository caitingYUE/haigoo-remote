import React, { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';
import { trackingService } from '../services/tracking-service';

interface ShareJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle: string;
  companyName: string;
}

export const ShareJobModal: React.FC<ShareJobModalProps> = ({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  companyName
}) => {
  const [copied, setCopied] = useState(false);
  
  if (!isOpen) return null;

  const shareUrl = `${window.location.origin}/job/${jobId}?source=share`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      trackingService.track('share_job_copy', { jobId, from: 'modal' });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            分享职位
          </h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <p className="text-sm text-slate-500 mb-1">正在分享：</p>
            <p className="font-medium text-slate-900 line-clamp-2">{jobTitle} @ {companyName}</p>
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <input 
              type="text" 
              readOnly 
              value={shareUrl} 
              className="flex-1 bg-transparent border-none text-sm text-slate-600 focus:ring-0 px-2 outline-none w-full"
              onClick={(e) => e.currentTarget.select()}
            />
            <button 
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
                copied 
                  ? 'bg-green-500 text-white shadow-green-200 shadow-md' 
                  : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-lg hover:shadow-indigo-200'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  复制
                </>
              )}
            </button>
          </div>
          
          <p className="text-xs text-slate-400 mt-3 text-center">
            复制链接发送给好友，他们可以直接访问此职位详情
          </p>
        </div>
      </div>
    </div>
  );
};
