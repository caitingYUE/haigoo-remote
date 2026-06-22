import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Loader2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { User } from '../types/auth-types';
import brandLogoPng from '../assets/brandlogo.webp';
import { deriveMembershipCapabilities } from '../utils/membership';

interface MembershipCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

function formatCertificateName(name: string) {
  return name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Member|Partner)\)\s*/gi, '').trim() || name;
}

export const MembershipCertificateModal: React.FC<MembershipCertificateModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const certificateRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleDownload = async () => {
    if (!certificateRef.current) return;

    try {
      setDownloading(true);
      const canvas = await html2canvas(certificateRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `Haigoo_Member_Certificate_${user.memberDisplayId || '000000'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to generate certificate:', error);
      alert('证书生成失败，请稍后重试');
    } finally {
      setDownloading(false);
    }
  };

  // Format ID to 6 digits
  const displayId = (user.memberDisplayId || 0).toString().padStart(6, '0');
  const memberName = formatCertificateName(user.username || user.email.split('@')[0]);
  const joinDate = user.memberSince ? new Date(user.memberSince).toLocaleDateString() : new Date().toLocaleDateString();
  const capabilities = deriveMembershipCapabilities(user);
  const isAnnualMember = capabilities.memberType === 'annual' || capabilities.memberType === 'year';
  const isHalfYearMember = capabilities.memberType === 'half_year';
  const isQuarterMember = capabilities.memberType === 'quarter';
  const isDeepLegacyMember = capabilities.memberType === 'quarter_pro';
  const certificateTitle = 'Haigoo Remote Club Member';
  const memberLevelLabel = capabilities.isTrialMember
    ? 'Trial'
    : isAnnualMember
      ? 'Partner'
      : isHalfYearMember
        ? 'Member'
        : isQuarterMember || isDeepLegacyMember
          ? 'VIP'
          : 'Club';

  return createPortal(
    <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭会员证书弹窗"
        className="fixed inset-0 z-0 cursor-default bg-slate-950/70 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)]">
            {/* Toolbar */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">您的会员证书</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm disabled:opacity-70"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        保存证书
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label="关闭"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Certificate Preview Area */}
            <div className="p-8 bg-slate-100 flex justify-center overflow-auto">
                {/* The Certificate Card */}
                <div 
                    ref={certificateRef}
                    className="relative w-[600px] h-[350px] bg-gradient-to-br from-[#1a237e] via-[#0d47a1] to-[#006064] rounded-xl shadow-2xl overflow-hidden text-white flex-shrink-0"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                >
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_50%_120%,#ffffff_0%,transparent_50%)]" />
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16" />
                    <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl -ml-12 -mb-12" />
                    
                    {/* Content */}
                    <div className="relative z-10 h-full flex flex-col justify-between p-8">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight mb-1 text-white">{certificateTitle}</h1>
                                <p className="text-white/60 text-xs tracking-widest uppercase">Global Remote Work Club</p>
                            </div>
                            {/* Top-Right Large Logo */}
                            <div className="w-24 h-24 opacity-80">
                                <img src={brandLogoPng} alt="Haigoo Logo" className="w-full h-full object-contain brightness-0 invert" crossOrigin="anonymous" />
                            </div>
                        </div>

                        {/* Middle - Member Info */}
                        <div className="space-y-6 mt-2">
                            <div>
                                <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Member Name</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-4xl font-bold text-white tracking-wide">{memberName}</h2>
                                    <span className="inline-flex rounded-full border border-white/24 bg-white/14 px-3 py-1 text-xs font-black tracking-[0.18em] text-white">
                                        {memberLevelLabel}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-12">
                                <div>
                                    <p className="text-indigo-200 text-[10px] font-medium uppercase tracking-wider mb-0.5">Member ID</p>
                                    <p className="text-xl font-mono font-bold text-teal-300 tracking-wider">NO.{displayId}</p>
                                </div>
                                <div>
                                    <p className="text-indigo-200 text-[10px] font-medium uppercase tracking-wider mb-0.5">Member Since</p>
                                    <p className="text-lg font-medium text-white/90">{joinDate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-end border-t border-white/10 pt-6 mt-auto">
                            <div>
                                <p className="text-[10px] text-white/40 leading-relaxed">
                                    This certificate verifies the membership status within the Haigoo Remote Club.<br/>
                                    Access to exclusive global opportunities and premium resources.
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm font-bold text-white/90 tracking-wide mb-0.5">Haigoo Remote</p>
                                <p className="text-[10px] text-white/50 tracking-wider font-medium">haigooremote.com</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-4 text-center text-sm text-slate-500">
                点击上方"保存证书"按钮下载图片
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
