import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, Lock, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getBundleDetailPath } from '../utils/share-link-helper';
import { useLanguage } from '../contexts/LanguageContext';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  job_ids: string[];
  visibility?: string;
}

interface JobBundleBannerProps {
  bundle: JobBundle;
}

interface JobBundleCarouselProps {
  bundles: JobBundle[];
}

// Default full-width banner (kept for compatibility)
export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();
  const { text } = useLanguage();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;
  const jobCount = bundle.job_ids?.length || 0;

  const handleClick = () => {
    const bundlePath = getBundleDetailPath(bundle.id);
    if (isLocked) {
      navigate(!isAuthenticated ? `/login?redirect=${encodeURIComponent(bundlePath)}` : '/profile?tab=membership#club-service-plans');
      return;
    }
    navigate(bundlePath);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="group relative overflow-hidden rounded-2xl cursor-pointer mb-0 border border-[#dfe8ef] shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 hover:border-[#cfe0ea] bg-[linear-gradient(135deg,#fffdf8_0%,#ffffff_58%,#f3fbf6_100%)]"
    >
      <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="pointer-events-none absolute bottom-0 right-5 h-20 opacity-20" />
      <div className="relative pl-4 pr-8 py-4 flex items-center gap-4 min-h-[104px]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur-md border border-slate-200 text-xs font-bold text-slate-800 shadow-sm">
              {isMemberBundle
                ? <><Crown className="w-3 h-3 fill-indigo-900/60" />{text('会员专属', 'Members only')}</>
                : <><Layers className="w-3 h-3" />{text('精选合集', 'Curated collection')}</>
              }
            </span>
            <span className="text-xs text-slate-600 font-medium">{text(`${jobCount} 个职位`, `${jobCount} roles`)}</span>
          </div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">{bundle.title}</h3>
        </div>
        <div className="flex-shrink-0">
          {isLocked ? (
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/60 border border-indigo-100 text-indigo-400 backdrop-blur-md">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex items-center justify-center w-9 h-9 rounded-full text-white shadow-md shadow-[#7b74ff]/20 transition-transform duration-200 group-hover:scale-105 bg-[#7b74ff]">
              <ArrowRight className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CAROUSEL_COLORS = [
  {
    shell: 'border-[#b9ead4] bg-[linear-gradient(135deg,#f7fff9_0%,#ffffff_58%,#f0fbf5_100%)]',
    badge: 'border-[#bde8d1] bg-white/86 text-[#26946b]',
    count: 'border-[#d7eee3] bg-white/92 text-[#43886c]',
    button: 'bg-[#38b985] hover:bg-[#2ca875] shadow-[#38b985]/20',
    image: '/pic_lists/Jobs_pics/bundle-nontech.webp'
  },
  {
    shell: 'border-[#c9dcf6] bg-[linear-gradient(135deg,#f7fbff_0%,#ffffff_58%,#f2f7ff_100%)]',
    badge: 'border-[#c9dcf6] bg-white/86 text-[#2f6ed8]',
    count: 'border-[#dce8f7] bg-white/92 text-[#587aa9]',
    button: 'bg-[#3f7ee8] hover:bg-[#2f6ed8] shadow-[#3f7ee8]/20',
    image: '/pic_lists/Jobs_pics/bundle-product.webp'
  },
  {
    shell: 'border-[#f4dda6] bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_58%,#fff6df_100%)]',
    badge: 'border-[#f0d89c] bg-white/86 text-[#c28222]',
    count: 'border-[#f5e5bd] bg-white/92 text-[#a9792c]',
    button: 'bg-[#e7a53b] hover:bg-[#d99322] shadow-[#e7a53b]/20',
    image: '/pic_lists/Jobs_pics/bundle-tech.webp'
  }
];

function getBundleVisualType(bundle: JobBundle) {
  const text = `${bundle.title || ''} ${bundle.subtitle || ''}`.toLowerCase();
  if (/技术|研发|开发|工程|engineer|developer|tech/.test(text) && !/非技术/.test(text)) return 'tech';
  if (/产品|运营|设计|product|design|operation/.test(text)) return 'product';
  return 'nontech';
}

function getBundleTheme(bundle: JobBundle, colorIndex: number) {
  const visualType = getBundleVisualType(bundle);
  const byType = {
    tech: {
      ...CAROUSEL_COLORS[0],
      image: '/pic_lists/Jobs_pics/bundle-tech.webp'
    },
    product: {
      ...CAROUSEL_COLORS[1],
      image: '/pic_lists/Jobs_pics/bundle-product.webp'
    },
    nontech: {
      ...CAROUSEL_COLORS[2],
      image: '/pic_lists/Jobs_pics/bundle-nontech.webp'
    }
  } as const;
  return byType[visualType] || CAROUSEL_COLORS[colorIndex % CAROUSEL_COLORS.length];
}

interface JobBundleCardProps extends JobBundleBannerProps {
  colorIndex: number;
}

export function JobBundleCard({ bundle, colorIndex }: JobBundleCardProps) {
  const navigate = useNavigate();
  const { isAuthenticated, isMember } = useAuth();
  const { text } = useLanguage();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;
  const jobCount = bundle.job_ids?.length || 0;

  const handleClick = () => {
    const bundlePath = getBundleDetailPath(bundle.id);
    if (isLocked) {
      navigate(!isAuthenticated ? `/login?redirect=${encodeURIComponent(bundlePath)}` : '/profile?tab=membership#club-service-plans');
      return;
    }
    navigate(bundlePath);
  };

  const theme = getBundleTheme(bundle, colorIndex);
  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className={`group relative h-full min-w-0 cursor-pointer select-none overflow-hidden rounded-[18px] border ${theme.shell} shadow-[0_14px_34px_-32px_rgba(52,76,92,0.26)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-36px_rgba(52,76,92,0.34)]`}
      style={{ minHeight: '122px' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(255,255,255,0.84)_62%,rgba(255,255,255,0.34)_100%)]" />
      <img
        src={theme.image}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-1/2 h-[58px] w-[138px] -translate-x-1/2 object-contain opacity-82 transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        decoding="async"
      />
      <div className="relative flex h-full flex-col p-3.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-3 min-h-[60px] max-w-[190px] text-[16px] font-black leading-snug tracking-tight text-slate-900">
            {bundle.title}
          </h3>
          <span className={`shrink-0 rounded-full border bg-white/86 px-2 py-0.5 text-[11px] font-bold shadow-sm ${theme.count}`}>
            {text(`${jobCount}个`, `${jobCount} roles`)}
          </span>
        </div>
      </div>
      {isLocked && (
        <div className="absolute inset-0 rounded-[18px] bg-white/34 backdrop-blur-[1px]" />
      )}
    </div>
  );
}

export function JobBundleCarousel({ bundles }: JobBundleCarouselProps) {
  if (!bundles.length) return null;

  return (
    <div className="relative w-full overflow-hidden rounded-[22px] bg-[#fffdf9]">
      <div
        className="flex touch-pan-x snap-x snap-mandatory gap-3 overflow-x-auto px-0.5 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {bundles.map((bundle, index) => (
          <div
            key={bundle.id}
            className="snap-start"
            style={{
              flex: bundles.length === 1
                ? '0 0 100%'
                : bundles.length === 2
                  ? '0 0 calc((100% - 12px) / 2)'
                  : '0 0 clamp(190px, calc((100% - 24px) / 2.35), 238px)'
            }}
          >
            <JobBundleCard
              bundle={bundle}
              colorIndex={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
