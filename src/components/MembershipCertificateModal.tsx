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
  return name.replace(/\s*\((Old Quarter|New Quarter|Quarter|VIP|Starter|Member|Partner)\)\s*/gi, '').trim() || name;
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
  const isStarterMember = capabilities.memberType === 'starter';
  const isQuarterMember = capabilities.memberType === 'quarter';
  const isDeepLegacyMember = capabilities.memberType === 'quarter_pro';
  const memberLevelLabel = capabilities.isTrialMember
    ? 'Trial'
    : isAnnualMember
      ? 'Partner'
      : isHalfYearMember
        ? 'Member'
        : isStarterMember
          ? 'Starter'
          : isQuarterMember || isDeepLegacyMember
            ? 'VIP'
            : 'Club';
  const certificateTitle = `Haigoo Remote Club ${memberLevelLabel}`;
  const levelToneClass = isAnnualMember
    ? 'border-[#e2d7ff] bg-[#f3efff] text-[#6f63f6]'
    : isHalfYearMember
      ? 'border-[#f0dfbf] bg-[#fff7e8] text-[#9a6a2d]'
      : isStarterMember
        ? 'border-[#dce7ff] bg-[#f2f6ff] text-[#4669d8]'
        : 'border-[#dcebdd] bg-[#f2fbf3] text-[#4f8a59]';

  return createPortal(
    <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="关闭会员证书弹窗"
        className="fixed inset-0 z-0 cursor-default bg-slate-950/50 backdrop-blur-md"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl transform transition-all scale-100 animate-in fade-in zoom-in duration-200">
        <div className="overflow-hidden rounded-[28px] border border-[#e4edf5] bg-[#fffdf8] shadow-[0_30px_90px_-52px_rgba(64,78,102,0.36)]">
            {/* Toolbar */}
            <div className="flex items-center justify-between border-b border-[#edf2f6] bg-white/88 px-6 py-4">
                <div>
                    <h3 className="text-lg font-black text-slate-950">您的会员证书</h3>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">再颠簸的生活，也要闪亮地过！</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleDownload}
                        disabled={downloading}
                        className="flex items-center gap-2 rounded-full bg-[#6f63f6] px-4 py-2 text-sm font-black text-white shadow-[0_14px_32px_-18px_rgba(95,99,246,0.72)] transition-colors hover:bg-[#5d50df] disabled:opacity-70"
                    >
                        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        保存证书
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-[#edf2f6] bg-white text-slate-400 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700"
                        aria-label="关闭"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Certificate Preview Area */}
            <div className="flex justify-center overflow-auto bg-[linear-gradient(180deg,#f7fbff_0%,#fffdf8_100%)] p-6 sm:p-8">
                {/* The Certificate Card */}
                <div 
                    ref={certificateRef}
                    className="relative h-[350px] w-[600px] flex-shrink-0 overflow-hidden rounded-[28px] border border-[#dbe8f4] bg-[#fffdf8] text-slate-950 shadow-[0_24px_70px_-46px_rgba(64,78,102,0.42)]"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                >
                    {/* Site illustration background */}
                    <div className="absolute inset-0">
                        <img
                            src="/pic_lists/About_pics/background03.webp"
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-bottom opacity-70"
                            crossOrigin="anonymous"
                        />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,253,248,0.9)_0%,rgba(248,252,255,0.82)_48%,rgba(244,241,255,0.78)_100%)]" />
                        <img
                            src="/pic_lists/About_pics/sun-transparent.webp"
                            alt=""
                            className="absolute -right-5 top-8 h-20 w-20 object-contain opacity-75"
                            crossOrigin="anonymous"
                        />
                        <img
                            src="/pic_lists/About_pics/grass_icon-transparent.webp"
                            alt=""
                            className="absolute bottom-[74px] right-14 h-12 w-12 object-contain opacity-28"
                            crossOrigin="anonymous"
                        />
                        <div className="absolute left-0 right-0 top-0 h-24 bg-[linear-gradient(180deg,rgba(239,248,255,0.86)_0%,rgba(255,255,255,0)_100%)]" />
                    </div>
                    
                    {/* Content */}
                    <div className="relative z-10 flex h-full flex-col justify-between p-8">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="max-w-[410px] text-3xl font-black tracking-tight text-slate-950">{certificateTitle}</h1>
                            </div>
                            <div className="h-12 w-40 overflow-hidden">
                                <img
                                    src={brandLogoPng}
                                    alt="HaigooRemote"
                                    className="h-full w-full scale-[1.34] object-contain object-center"
                                    crossOrigin="anonymous"
                                />
                            </div>
                        </div>

                        {/* Middle - Member Info */}
                        <div className="mt-2 space-y-5">
                            <div>
                                <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-slate-400">Member Name</p>
                                <div className="flex flex-wrap items-center gap-3">
                                    <h2 className="text-4xl font-black tracking-wide text-slate-950">{memberName}</h2>
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black tracking-[0.16em] ${levelToneClass}`}>
                                        {memberLevelLabel}
                                    </span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-4">
                                <div className="rounded-2xl border border-[#edf2f6] bg-white/70 px-4 py-3 shadow-sm">
                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Member ID</p>
                                    <p className="font-mono text-xl font-black tracking-wider text-[#6f63f6]">NO.{displayId}</p>
                                </div>
                                <div className="rounded-2xl border border-[#edf2f6] bg-white/70 px-4 py-3 shadow-sm">
                                    <p className="mb-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Member Since</p>
                                    <p className="text-lg font-black text-slate-800">{joinDate}</p>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-auto flex items-end justify-between gap-6 border-t border-[#e6edf3] pt-4">
                            <p className="text-[11px] font-semibold leading-relaxed text-slate-500">用你喜欢的方式过一生。</p>
                            <p className="text-right text-[10px] font-bold tracking-[0.08em] text-slate-400">
                                Be free. Work anywhere. Live fully.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="bg-white p-4 text-center text-sm font-semibold text-slate-500">
                点击上方"保存证书"按钮下载图片
            </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
