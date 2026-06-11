import { useState } from 'react';
import { ArrowRight, MapPin, ShieldCheck } from 'lucide-react';
import clubLogo from '../assets/logo.webp';
import { LinkedInLogo, OutlookLogo, WeChatLogo, XiaohongshuLogo } from './SocialIcons';

interface HaigooClubInfoCardProps {
  className?: string;
}

export default function HaigooClubInfoCard({ className = '' }: HaigooClubInfoCardProps) {
  const [showWechatQr, setShowWechatQr] = useState(false);

  return (
    <div className={`relative overflow-hidden rounded-[34px] border border-[#e3edf4] bg-white p-7 shadow-[0_26px_76px_-60px_rgba(62,91,120,0.42)] lg:p-8 ${className}`}>
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-t-[100%] bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(231,244,222,0.34)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_12%,rgba(255,232,170,0.16),transparent_17%),radial-gradient(circle_at_52%_72%,rgba(206,236,247,0.18),transparent_18%)]" />
      <img src="/pic_lists/Home_pics/background04.webp" alt="" loading="lazy" decoding="async" className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full object-cover object-bottom opacity-[0.13]" />
      <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr_0.9fr] lg:items-start lg:divide-x lg:divide-[#e5edf3]">
        <div className="lg:pr-8">
          <div className="flex items-center gap-4">
            <img src={clubLogo} alt="海狗远程俱乐部" loading="lazy" decoding="async" className="h-[92px] w-[92px] object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-950">海狗远程俱乐部</h3>
                <span className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full">
                  <img src="/pic_lists/Home_pics/love-transparent.webp" alt="" loading="lazy" decoding="async" className="h-14 w-14 object-contain opacity-85" />
                </span>
              </div>
              <div className="mt-2 h-2 w-20 rounded-full bg-[linear-gradient(90deg,#a9a3ff,#d8d4ff)]" />
            </div>
          </div>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-600">
            连接全球机遇，打开无限可能。Haigoo 帮助中国专业人才探索远程工作机会，实现工作与生活的更好平衡。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="/profile?tab=about" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d8e5f0] bg-white px-5 py-2.5 text-sm font-black text-slate-700 shadow-sm hover:text-[#2f6ed8]">
              关于我们
              <ArrowRight className="h-4 w-4 text-[#c99535]" />
            </a>
          </div>
        </div>
        <div className="lg:px-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#eef7ff] text-[#65a15d]">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="text-lg font-black text-slate-950">公司地址</div>
          <div className="mt-2 h-2 w-14 rounded-full bg-[linear-gradient(90deg,#a9a3ff,#d8d4ff)]" />
          <p className="mt-6 text-sm leading-8 text-slate-600">
            行渡科技（杭州）有限公司<br />
            杭州市余杭区仓前街道景兴路999号<br />
            10幢403-31室
          </p>
        </div>
        <div className="lg:pl-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff1ef] text-[#d89183]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="text-lg font-black text-slate-950">联系方式</div>
          <div className="mt-2 h-2 w-14 rounded-full bg-[linear-gradient(90deg,#a9a3ff,#d8d4ff)]" />
          <a href="mailto:hi@haigooremote.com" className="mt-6 block text-lg font-black text-[#2f6ed8]">hi@haigooremote.com</a>
          <p className="mt-2 text-sm text-slate-500">周一至周日 9:00-22:00</p>
        </div>
      </div>
      <div className="relative mt-10 flex flex-col gap-4 border-t border-[#e5edf3] pt-5 text-sm font-semibold text-slate-500 md:grid md:grid-cols-[1fr_auto_1fr] md:items-end">
        <div>
          <div>© 2026 Haigoo. All rights reserved.</div>
        </div>
        <div className="flex items-center gap-2 md:justify-center md:text-center">
          <span className="sr-only">Be free. Work anywhere. Live fully.</span>
          <img
            src="/pic_lists/Handwriting/hand-be-free.webp"
            alt=""
            loading="lazy"
            decoding="async"
            className="h-auto w-[260px] max-w-full opacity-85"
          />
          <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full">
            <img src="/pic_lists/Home_pics/love-transparent.webp" alt="" loading="lazy" decoding="async" className="h-10 w-10 object-contain opacity-80" />
          </span>
        </div>
        <div className="flex items-center gap-3 md:justify-end">
          <a
            href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#e4e9ff] bg-white/90 px-3 text-xs font-black text-[#8a86e8] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f6f4ff]"
            aria-label="小红书"
          >
            <XiaohongshuLogo className="h-4 w-4" />
            小红书
          </a>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowWechatQr((value) => !value)}
              onMouseEnter={() => setShowWechatQr(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e9ff] bg-white/90 text-[#8a86e8] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f6f4ff]"
              aria-label="微信公众号二维码"
              aria-expanded={showWechatQr}
            >
              <WeChatLogo className="h-4 w-4" />
            </button>
            {showWechatQr ? (
              <div
                className="absolute bottom-[calc(100%+12px)] left-1/2 z-30 w-[220px] -translate-x-1/2 rounded-[22px] border border-[#e4e9ff] bg-white p-3 text-center shadow-[0_20px_50px_-34px_rgba(61,89,120,0.7)]"
                onMouseEnter={() => setShowWechatQr(true)}
                onMouseLeave={() => setShowWechatQr(false)}
              >
                <div className="text-xs font-black text-slate-700">微信公众号</div>
                <div className="mx-auto mt-2 w-40 rounded-[16px] border border-[#eef2f7] bg-[#fbfdff] p-2">
                  <img src="/qrcode.webp" alt="Haigoo Remote 微信公众号二维码" className="h-full w-full object-contain" />
                </div>
                <div className="mt-2 text-[11px] font-bold leading-5 text-slate-500">扫码或微信搜索“海狗远程”</div>
                <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#e4e9ff] bg-white" />
              </div>
            ) : null}
          </div>
          <a
            href="https://www.linkedin.com/company/haigoo/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e9ff] bg-white/90 text-[#8a86e8] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f6f4ff]"
            aria-label="LinkedIn"
          >
            <LinkedInLogo className="h-4 w-4" />
          </a>
          <a
            href="mailto:hi@haigooremote.com"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#e4e9ff] bg-white/90 text-[#8a86e8] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[#f6f4ff]"
            aria-label="邮箱"
          >
            <OutlookLogo className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
