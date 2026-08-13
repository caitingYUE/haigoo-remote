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

function getDisplayName(user: ReturnType<typeof useAuth>['user']) {
  const candidate = user?.profile?.fullName || user?.username || user?.email?.split('@')[0] || '';
  return candidate.trim();
}

// Default full-width banner (kept for compatibility)
export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { text } = useLanguage();

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isAuthenticated;
  const accessBadge = bundle.visibility === 'specified'
    ? text('仅你可见', 'Only you')
    : bundle.visibility === 'member'
      ? text('信息合集', 'Information collection')
      : null;

  const handleClick = () => {
    const bundlePath = getBundleDetailPath(bundle.id);
    navigate(bundlePath);
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="group relative mb-0 cursor-pointer overflow-hidden border border-[#ead9d0] border-t-2 border-t-[#e96832] bg-[#fffaf6] shadow-[0_16px_38px_-32px_rgba(24,32,51,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#f0c8b4] hover:shadow-[0_22px_44px_-32px_rgba(24,32,51,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96832]"
    >
      <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="pointer-events-none absolute bottom-0 right-5 h-20 opacity-20" />
      <div className="relative pl-4 pr-8 py-4 flex items-center gap-4 min-h-[104px]">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 border border-[#f0c8b4] bg-white px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] text-[#c94f22]">
              {isMemberBundle
                ? <><Layers className="w-3 h-3" />{text('信息合集', 'Information collection')}</>
                : <><Layers className="w-3 h-3" />{text('精选合集', 'Curated collection')}</>
              }
            </span>
            {accessBadge && <span className="text-xs text-slate-600 font-medium">{accessBadge}</span>}
          </div>
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900">{bundle.title}</h3>
        </div>
        <div className="flex-shrink-0">
          {isLocked ? (
            <div className="flex h-9 w-9 items-center justify-center border border-[#f0c8b4] bg-white text-[#c94f22]">
              <Lock className="w-4 h-4" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center bg-[#182033] text-white shadow-md transition-transform duration-200 group-hover:translate-x-0.5">
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
    shell: 'border-[#ead9d0] border-t-[#e96832] bg-[#fffaf6]',
    count: 'border-[#f0c8b4] bg-white text-[#c94f22]',
    image: '/pic_lists/Jobs_pics/bundle-nontech.webp'
  },
  {
    shell: 'border-[#ead9d0] border-t-[#e96832] bg-[#fffaf6]',
    count: 'border-[#f0c8b4] bg-white text-[#c94f22]',
    image: '/pic_lists/Jobs_pics/bundle-product.webp'
  },
  {
    shell: 'border-[#ead9d0] border-t-[#e96832] bg-[#fffaf6]',
    count: 'border-[#f0c8b4] bg-white text-[#c94f22]',
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
  const { text } = useLanguage();
  const { user } = useAuth();
  const isPrivateBundle = bundle.visibility === 'specified';
  const displayName = isPrivateBundle ? getDisplayName(user) : '';

  const accessBadge = bundle.visibility === 'specified'
    ? text('仅你可见', 'Only you')
    : bundle.visibility === 'member'
      ? text('信息合集', 'Information collection')
      : null;

  const handleClick = () => {
    const bundlePath = getBundleDetailPath(bundle.id);
    navigate(bundlePath);
  };

  const theme = getBundleTheme(bundle, colorIndex);

  if (isPrivateBundle) {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${text('打开专属求职准备', 'Open personal preparation plan')}：${bundle.title}`}
        className="group relative h-full min-h-[176px] w-full min-w-0 overflow-hidden border border-[#ead9d0] border-t-2 border-t-[#e96832] bg-[#fffaf6] text-left shadow-[0_18px_44px_-36px_rgba(24,32,51,0.28)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#f0c8b4] hover:shadow-[0_22px_48px_-34px_rgba(24,32,51,0.34)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96832]"
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[42%] bg-[linear-gradient(90deg,rgba(255,253,248,0)_0%,rgba(255,248,232,0.9)_100%)]" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 h-36 w-36 rounded-full border-[26px] border-[#ffd9c7]/60" />
        <div className="relative flex h-full min-h-[176px] flex-col p-4 sm:p-[18px]">
          <div className="flex items-start justify-between gap-3">
            <h3 className="line-clamp-2 max-w-[70%] text-[17px] font-bold leading-[1.4] tracking-[-0.01em] text-slate-900 sm:text-[18px]">
              {bundle.title}
            </h3>
            {accessBadge && <span className="shrink-0 border border-[#f0c8b4] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#c94f22]">{accessBadge}</span>}
          </div>
          <div className="mt-2 flex max-w-[70%] min-w-0 items-center gap-1.5 text-xs leading-5">
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#c94f22]">
              <Crown className="h-3.5 w-3.5 fill-current" />
              {text('专属准备方案', 'Personal plan')}
            </span>
            {displayName && <span title={displayName} className="min-w-0 truncate font-semibold text-[#c94f22]">@{displayName}</span>}
          </div>
          {bundle.subtitle && <p className="mt-1 max-w-[70%] truncate text-xs font-medium leading-5 text-slate-500">{bundle.subtitle}</p>}
          <span className="mt-auto inline-flex w-fit items-center gap-1.5 bg-[#182033] px-3.5 py-2 text-xs font-bold text-white shadow-[0_12px_24px_-16px_rgba(24,32,51,0.55)] transition group-hover:bg-[#c94f22]">
            {text('打开准备方案', 'Open plan')}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative h-full min-w-0 cursor-pointer overflow-hidden border border-t-2 text-left ${theme.shell} shadow-[0_14px_34px_-32px_rgba(24,32,51,0.26)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#f0c8b4] hover:shadow-[0_20px_44px_-34px_rgba(24,32,51,0.32)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e96832]`}
      style={{ minHeight: '166px' }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(255,250,246,0.98),rgba(255,255,255,0.96))]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-10 -right-8 h-28 w-28 rounded-full border-[22px] border-[#ffd9c7]/50" />
      <div className="relative flex h-full min-h-[166px] flex-col p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 max-w-[78%] text-[17px] font-bold leading-snug tracking-tight text-slate-900">
            {bundle.title}
          </h3>
          {accessBadge && <span className={`shrink-0 border px-2 py-1 text-[10px] font-bold ${bundle.visibility === 'member' ? 'border-[#e7c98e] bg-[#fff8e8] text-[#8f5e19]' : theme.count}`}>
            {accessBadge}
          </span>}
        </div>
        {bundle.subtitle ? <p className="mt-2 line-clamp-2 max-w-[82%] text-xs leading-5 text-slate-500">{bundle.subtitle}</p> : null}
        <span className="mt-auto inline-flex items-center gap-1 text-xs font-bold text-[#c94f22]">
          {text('查看合集', 'View collection')}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export function JobBundleCarousel({ bundles }: JobBundleCarouselProps) {
  if (!bundles.length) return null;

  return (
    <div className="relative w-full overflow-hidden bg-[#fffdf8]">
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
