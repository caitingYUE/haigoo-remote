import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Crown, Lock,
  Share2, Check, Package, BookOpen, PlayCircle
} from 'lucide-react';
import JobCardNew from '../components/JobCardNew';
import JobDetailModal from '../components/JobDetailModal';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { trackingService } from '../services/tracking-service';
import { getBundleDetailLink, getBundleDetailPath } from '../utils/share-link-helper';
import { useReturnNavigation } from '../hooks/useReturnNavigation';
import { useLanguage } from '../contexts/LanguageContext';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  job_ids: string[];
  priority: number;
  start_time: string | null;
  end_time: string | null;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
  visibility?: string;
  allowed_emails?: string[];
  career_items?: CareerPlanItem[];
  progress?: BundleProgress | null;
  access?: { visible: boolean; locked: boolean; requires_login?: boolean };
}

interface CareerPlanItem {
  video_id: string;
  title: string;
  description?: string;
  guidance?: string;
  module_key?: string;
  category?: string;
  difficulty_level?: string;
  duration_ms?: number;
  href?: string;
  cover_image_url?: string;
}

interface BundleProgress {
  completed_video_ids: string[];
  growth_records: Array<{ id: string; content: string; created_at: string }>;
  updated_at?: string | null;
}

const formatVideoDuration = (durationMs: number | undefined, isEnglish: boolean) => {
  if (!durationMs || durationMs < 60_000) return '';
  const minutes = Math.max(1, Math.round(durationMs / 60_000));
  return isEnglish ? `About ${minutes} min` : `约 ${minutes} 分钟`;
};

const getDisplayName = (user: ReturnType<typeof useAuth>['user']) => {
  const candidate = user?.profile?.fullName || user?.username || user?.email?.split('@')[0] || '';
  return candidate.trim();
};

export default function JobBundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useReturnNavigation('/jobs');
  const { token, isAuthenticated, isMember, user } = useAuth();
  const { isEnglish, text } = useLanguage();

  const [bundle, setBundle] = useState<JobBundle | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [savedJobs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);
  const [activeCareerTab, setActiveCareerTab] = useState<'learning' | 'records'>('learning');
  const [progress, setProgress] = useState<BundleProgress>({ completed_video_ids: [], growth_records: [] });
  const [savingProgress, setSavingProgress] = useState(false);

  useEffect(() => { if (id) fetchBundle(id); }, [id, token]);

  useEffect(() => {
    const bundleId = bundle?.id;
    if (!bundleId || !token) return;
    const handleBundleApplicationStarted = async (event: Event) => {
      const detail = (event as CustomEvent<{ bundleId?: number; jobId?: string }>).detail;
      if (Number(detail?.bundleId) !== bundleId || !detail?.jobId) return;
      try {
        const res = await fetch('/api/data/job-bundles?action=progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            bundle_id: bundleId,
            progress_action: 'auto_event',
            event_type: 'application_started',
            job_id: detail.jobId
          })
        });
        const data = await res.json();
        if (res.ok && data.success) setProgress(data.progress || { completed_video_ids: [], growth_records: [] });
      } catch (eventError) {
        console.warn('Failed to record bundle application event', eventError);
      }
    };
    window.addEventListener('haigoo:bundle-application-started', handleBundleApplicationStarted);
    return () => window.removeEventListener('haigoo:bundle-application-started', handleBundleApplicationStarted);
  }, [bundle?.id, token]);

  // Fire page-view tracking after bundle loads
  useEffect(() => {
    if (bundle) {
      trackingService.track('view_job_bundle', {
        bundle_id: bundle.id,
        bundle_title: bundle.title,
        job_count: jobs.length,
      });
    }
  }, [bundle?.id]);

  const fetchBundle = async (bundleId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/data/job-bundles?id=${bundleId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const b = data.data[0];
        setBundle(b);
        setProgress(b.progress || { completed_video_ids: [], growth_records: [] });
        if (b.job_ids?.length > 0) await fetchJobs(b.job_ids);
        else setJobs([]);
      } else {
        setError(text('岗位合集不存在或暂未开放', 'This collection is currently unavailable.'));
      }
    } catch {
      setError(text('加载失败，请稍后重试', 'Could not load this collection. Please try again later.'));
    } finally {
      setLoading(false);
    }
  };

  const saveProgress = async (payload: Record<string, string>) => {
    if (!bundle || !token) {
      navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle?.id || Number(id || 0)))}`);
      return;
    }
    try {
      setSavingProgress(true);
      const res = await fetch('/api/data/job-bundles?action=progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bundle_id: bundle.id, ...payload })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || '保存失败')
      setProgress(data.progress || { completed_video_ids: [], growth_records: [] });
      return true;
    } catch (error) {
      setError(error instanceof Error ? error.message : text('保存失败，请稍后重试', 'Could not save progress.'));
      return false;
    } finally {
      setSavingProgress(false);
    }
  };

  const handleToggleVideoComplete = (videoId: string) => saveProgress({ progress_action: 'toggle_video', video_id: videoId });
  const handleOpenVideo = (videoId: string) => {
    void saveProgress({ progress_action: 'auto_event', event_type: 'video_open', video_id: videoId });
  };

  const fetchJobs = async (ids: string[]) => {
    try {
      const params = new URLSearchParams({
        ids: JSON.stringify(ids),
        limit: String(Math.max(ids.length, 50)),
        skipAggregations: 'true'
      });
      const res = await fetch(`/api/data/processed-jobs?${params.toString()}`);
      const data = await res.json();
      if (data.jobs) {
        const jobMap = new Map(data.jobs.map((j: any) => [j.id, j]));
        const ordered = ids
          .map((jobId) => (jobMap.get(jobId) || jobMap.get(String(jobId))) as Job | undefined)
          .filter((job): job is Job => Boolean(job))
          .sort((a, b) => {
            const aAddedAt = new Date((a as any).createdAt || (a as any).created_at || (a as any).publishedAt || 0).getTime();
            const bAddedAt = new Date((b as any).createdAt || (b as any).created_at || (b as any).publishedAt || 0).getTime();
            return bAddedAt - aAddedAt;
          }) as Job[];
        setJobs(ordered);
      }
    } catch (e) {
      setJobs([]);
      console.error('Failed to fetch jobs', e);
    }
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setCurrentJobIndex(jobs.findIndex(j => j.id === job.id));
    setIsJobDetailOpen(true);
    trackingService.track('click_job_bundle_job', {
      bundle_id: bundle?.id,
      job_id: job.id,
      job_title: job.title,
      company: (job as any).company,
    });
  };

  const handleNavigateJob = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? (currentJobIndex - 1 + jobs.length) % jobs.length
      : (currentJobIndex + 1) % jobs.length;
    setCurrentJobIndex(newIndex);
    setSelectedJob(jobs[newIndex]);
  };

  const handleShare = async () => {
    const shareUrl = bundle?.id ? getBundleDetailLink(bundle.id) : window.location.href;
    try { await navigator.clipboard.writeText(shareUrl); }
    catch {
      const el = document.createElement('textarea');
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    trackingService.track('click_job_bundle_share', {
      bundle_id: bundle?.id,
      bundle_title: bundle?.title,
    });
  };

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="hg-bundle-page flex min-h-screen items-center justify-center pt-20">
        <div className="text-center text-slate-400">
          <div className="mx-auto mb-3 h-8 w-8 rounded-full border-2 border-[#ffd9c7] border-t-[#e96832] animate-spin" />
          <p className="text-sm">{text('正在读取合集…', 'Loading collection…')}</p>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !bundle) {
    return (
      <div className="hg-bundle-page flex min-h-screen items-center justify-center pt-20">
        <div className="hg-bundle-state p-8 text-center">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{error || text('岗位合集不存在', 'This collection does not exist.')}</p>
          <button onClick={handleBack} className="mt-5 border-b border-[#e96832] pb-1 text-sm font-semibold text-[#c94f22] hover:text-[#182033]">
            ← {text('返回', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  if (bundle.access?.requires_login) {
    return (
      <div className="hg-bundle-page min-h-screen">
        <div className="mx-auto max-w-md px-4 pb-10 pt-28 text-center sm:pt-32">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-[#f0c8b4] bg-[#fff4ec] text-[#c94f22]">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-950">{text('需登录验证后访问', 'Sign in to verify access')}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{text('当前页面为指定用户可见，请先登录验证后再访问。', 'This page is visible to designated users only. Please sign in to verify access before continuing.')}</p>
          <button
            type="button"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle.id))}`)}
            className="mt-7 inline-flex items-center justify-center bg-[#1b2440] px-6 py-3 text-sm font-black text-white transition hover:bg-[#313d62]"
          >
            {text('前往登录', 'Log in')}
          </button>
        </div>
      </div>
    );
  }

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = Boolean(bundle.access?.locked) || (isMemberBundle && !isAuthenticated);
  const isPrivateExperience = bundle.visibility === 'specified' || isMemberBundle;
  const displayName = bundle.visibility === 'specified' ? getDisplayName(user) : '';
  const careerItems = bundle.career_items || [];
  const completedVideoIds = new Set(progress.completed_video_ids || []);
  const completedCareerCount = careerItems.filter((item) => completedVideoIds.has(item.video_id)).length;
  const growthRecords = [...(progress.growth_records || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const assistantSupportPanel = (
    <div className="hg-bundle-assistant border-y border-[#eadfcf] bg-[#fffdf8] py-3.5">
      <div className="flex items-start gap-3">
        <img
          src="/series_assistant.png"
          alt={text('海狗小助手二维码', 'Haigoo assistant QR code')}
          className="h-[76px] w-[76px] border border-[#dfe8ef] bg-white object-contain p-1"
        />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">{text('海狗小助手', 'Haigoo Assistant')}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {text('扫码联系 Haigoo，获取页面使用帮助。', 'Scan to contact Haigoo for help using this page.')}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Member lock screen ────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="hg-bundle-page min-h-screen">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <button onClick={handleBack}
            className="flex items-center text-slate-500 hover:text-[#3f7f67] transition-colors text-sm mb-12">
            <ArrowLeft className="w-4 h-4 mr-1" />{text('返回', 'Back')}
          </button>
          <div className="max-w-md mx-auto text-center py-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center border border-[#f0c8b4] bg-[#fff4ec]">
              <Crown className="w-9 h-9 text-[#c94f22]" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.title}</h1>
            <p className="text-slate-500 mb-2 text-sm">{bundle.subtitle}</p>
            <p className="mb-8 flex items-center justify-center gap-1.5 text-sm font-medium text-[#c94f22]">
              <Lock className="w-3.5 h-3.5" />{text('登录后可查看完整信息合集', 'Sign in to view the full information collection.')}
            </p>
            <div className="flex justify-center">
              <button onClick={() => navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle.id))}`)}
                className="bg-[#2b3448] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800">
                {text('登录账号', 'Log in')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div className="hg-bundle-page min-h-screen">
      <main className="hg-bundle-shell mx-auto max-w-[1560px] px-4 pb-16 pt-24 sm:px-8">
        <div className="hg-bundle-columns grid min-h-0 gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch">
        <section className="hg-bundle-column min-w-0">
        <div>
        <button onClick={handleBack}
          className="hg-bundle-back mb-8 inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-slate-600 transition hover:text-[#466f9d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466f9d]">
          <ArrowLeft className="h-4 w-4" />{text('返回', 'Back')}
        </button>
        {/* ── Hero Header ───────────────────────────────────────────────────── */}
        <section className="hg-bundle-hero relative mb-10 overflow-hidden border-y border-[#deddd7] py-8">

          <div className="relative">
            <div className="min-w-0">
              <h1 className="mb-2 flex max-w-5xl flex-wrap items-center gap-3 text-[25px] font-bold leading-[1.28] tracking-[-0.018em] text-slate-900 sm:text-[29px] lg:text-[30px]">
                <span>{bundle.title}</span>
              </h1>
              {bundle.subtitle && <p className="mb-3 max-w-3xl text-sm font-medium leading-6 text-slate-500">{bundle.subtitle}</p>}

              <p className="max-w-4xl border-l-2 border-[#466f9d] pl-3.5 text-sm leading-6 text-slate-600 sm:pl-4">
                {bundle.content || text('本期岗位信息已整理完成，后续更新会继续补充到这里。', 'This collection is ready. Future updates will continue to appear here.')}
              </p>

              {!isPrivateExperience && <div className="mt-5 space-y-3 lg:hidden">
                <button onClick={handleShare}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" />{text('已复制！', 'Copied!')}</> : <><Share2 className="w-3.5 h-3.5" />{text('分享合集', 'Share collection')}</>}
                </button>
                {assistantSupportPanel}
              </div>}

            </div>

            {!isPrivateExperience && <div className="hidden space-y-3 self-start lg:block">
              <div className="flex justify-end">
                <button onClick={handleShare}
                  className={`inline-flex w-[190px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white/86 border-[#dfe8ef] text-slate-600 hover:border-[#cfe0ea] hover:text-[#3f7f67]'
                    }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" />{text('已复制！', 'Copied!')}</> : <><Share2 className="w-3.5 h-3.5" />{text('分享合集', 'Share collection')}</>}
                </button>
              </div>
              {assistantSupportPanel}
            </div>}
          </div>
        </section>

        {/* ── Jobs Grid ────────────────────────────────────────────────────── */}
        <section id="bundle-jobs" className="hg-bundle-jobs relative scroll-mt-24 border-t border-[#deddd7] py-7">
          <div className="relative mb-3 flex items-end justify-between gap-4">
            <div>
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="shrink-0 whitespace-nowrap text-[18px] font-bold text-slate-900 sm:text-xl">{text('合集中的岗位', 'Roles in this collection')}</h2>
                <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-xs font-semibold text-slate-500">{jobs.length}</span>
                {displayName && <span title={displayName} className="min-w-0 max-w-[10rem] truncate whitespace-nowrap text-sm font-semibold text-[#466f9d] sm:text-base">@{displayName}</span>}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{text('按合集主题整理，点击岗位可查看公开信息与官方申请入口。', 'Organised by collection theme. Open a role to view public information and its official application link.')}</p>
            </div>
          </div>

          <div className="relative grid grid-cols-1 gap-3">
            {jobs.map((job) => (
              <div key={job.id}>
                <JobCardNew
                  job={job}
                  variant="list"
                  onClick={() => handleJobClick(job)}
                  isActive={selectedJob?.id === job.id}
                  showApplicationMethodIcons
                  expandedDetails
                />
              </div>
            ))}
          </div>

          {jobs.length === 0 && (
            <div className="relative border-y border-[#e3edf4] bg-white py-10 text-center text-slate-400">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{text('暂无职位数据', 'No roles available')}</p>
              <p className="mt-1 text-sm">{text('下一次更新后会同步更多适合远程申请的机会。', 'More remote opportunities will be added in the next update.')}</p>
            </div>
          )}
        </section>
        </div>
        </section>

        <aside className="hg-bundle-plan relative border-l border-[#deddd7] pl-7">
          <div className="border-y border-[#deddd7] py-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="mb-1 text-[11px] font-bold tracking-[0.1em] text-[#466f9d]">{text('求职准备', 'JOB PREPARATION')}</p>
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="shrink-0 whitespace-nowrap text-[18px] font-bold text-slate-900 sm:text-xl">{text('配套准备内容', 'Preparation material')}</h2>
                  {displayName && <span title={displayName} className="min-w-0 max-w-[8rem] truncate whitespace-nowrap text-sm font-semibold text-[#466f9d] sm:text-base">@{displayName}</span>}
                </div>
              </div>
              <span className="shrink-0 border border-[#c9dce8] bg-[#eff5fb] px-3 py-1.5 text-xs font-bold text-[#466f9d]">{completedCareerCount}/{careerItems.length}</span>
            </div>
            {careerItems.length > 0 && <div className="mt-3 h-1.5 overflow-hidden bg-[#dce9f5]" aria-label={text(`准备进度：${completedCareerCount}/${careerItems.length}`, `Preparation progress: ${completedCareerCount}/${careerItems.length}`)}>
              <div className="h-full bg-[#466f9d] transition-all duration-500" style={{ width: `${(completedCareerCount / careerItems.length) * 100}%` }} />
            </div>}
            <div className="mt-4 grid grid-cols-2 border-b border-[#deddd7] text-sm font-bold">
              <button type="button" onClick={() => setActiveCareerTab('learning')} className={`min-h-11 border-b-2 px-3 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466f9d] ${activeCareerTab === 'learning' ? 'border-[#466f9d] text-[#345d88]' : 'border-transparent text-slate-500'}`}>{text('准备内容', 'Preparation')}</button>
              <button type="button" onClick={() => setActiveCareerTab('records')} className={`min-h-11 border-b-2 px-3 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466f9d] ${activeCareerTab === 'records' ? 'border-[#466f9d] text-[#345d88]' : 'border-transparent text-slate-500'}`}>{text('成长记录', 'Growth log')}</button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {activeCareerTab === 'learning' ? (
              careerItems.length ? <div className="grid grid-cols-1 gap-5">
                {careerItems.map((item) => {
                  const completed = completedVideoIds.has(item.video_id)
                  const introduction = item.guidance || item.description || text('打开视频，完成这一步的远程求职准备。', 'Open the video to complete this preparation step.')
                  const duration = formatVideoDuration(item.duration_ms, isEnglish)
                  return <article key={item.video_id} className={`overflow-hidden border-b pb-5 transition ${completed ? 'border-[#9fbbd2]' : 'border-[#deddd7]'}`}>
                    <a href={item.href || '/careerlearning'} target="_blank" rel="noreferrer" onClick={() => handleOpenVideo(item.video_id)} aria-label={text(`打开准备内容：${item.title}`, `Open preparation: ${item.title}`)} className="group relative block aspect-video overflow-hidden border border-[#dce9f5] bg-[#eff5fb] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466f9d]">
                      {item.cover_image_url ? <img src={item.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#eff5fb,#fffdf8)]"><PlayCircle className="h-10 w-10 text-[#466f9d]" /></div>}
                      <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center bg-white/92 text-[#466f9d] shadow-sm"><PlayCircle className="h-5 w-5" /></span>
                    </a>
                    <div className="px-0.5 pt-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-800">{item.title}</h3>
                        {duration && <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-slate-400">{duration}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-slate-500">{introduction}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-0.5 pt-2.5">
                      <span className={`text-xs font-bold ${completed ? 'text-[#466f9d]' : 'text-slate-400'}`}>{completed ? text('已完成这项准备', 'This step is complete') : text('完成后可在这里记录进度', 'Mark this step when complete')}</span>
                      <button type="button" disabled={savingProgress} onClick={() => handleToggleVideoComplete(item.video_id)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#466f9d] disabled:cursor-not-allowed disabled:opacity-60 ${completed ? 'bg-[#dce9f5] text-[#466f9d] hover:bg-[#c9dce8]' : 'bg-[#466f9d] text-white hover:bg-[#345d88]'}`}>
                        <Check className="h-3.5 w-3.5" />{completed ? text('已完成', 'Completed') : text('完成准备', 'Mark ready')}
                      </button>
                    </div>
                  </article>
                })}
              </div> : <div className="border-y border-dashed border-[#c9dce8] px-5 py-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#587faa]" /><p className="mt-3 text-sm font-black text-slate-700">{text('配套内容正在整理中', 'Preparation material is being organised')}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text('合集更新后，视频和使用建议会显示在这里。', 'Videos and guidance will appear here after the collection is updated.')}</p></div>
            ) : (
              <div className="relative space-y-0 before:absolute before:bottom-5 before:left-[15px] before:top-5 before:w-px before:bg-[#c9dce8]">{growthRecords.length ? growthRecords.map((record, index) => <article key={record.id} className="relative pb-5 pl-10 last:pb-0"><span className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center border border-[#c9dce8] bg-[#eff5fb] text-xs font-black text-[#466f9d] shadow-sm">{index + 1}</span><div className="border border-slate-200 bg-white p-3.5 shadow-[0_16px_35px_-30px_rgba(48,58,95,0.42)]"><p className="text-sm leading-6 text-slate-700">{record.content}</p><time className="mt-2 block text-xs font-semibold text-slate-400">{new Date(record.created_at).toLocaleString(isEnglish ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></article>) : <p className="relative px-2 py-10 text-center text-sm leading-6 text-slate-400">{text('你的申请经历和学习成长会记录在这里，开始你的远程之旅吧！', 'Your applications and learning milestones will appear here. Start your remote journey!')}</p>}</div>
            )}
          </div>
        </aside>
        </div>

      </main>

      {/* ── Detail Modal ──────────────────────────────────────────────────── */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={isJobDetailOpen}
          onClose={() => setIsJobDetailOpen(false)}
          onSave={() => { }}
          isSaved={savedJobs.has(selectedJob.id)}
          jobs={jobs}
          currentJobIndex={currentJobIndex}
          onNavigateJob={handleNavigateJob}
          variant="center"
          trackingPageKey="job_bundle_detail"
          trackingSourceKey="job_bundle_detail"
          trackingModule="job_bundle_detail"
          trackingExtra={{
            bundle_id: bundle?.id,
            bundle_title: bundle?.title,
          }}
        />
      )}
    </div>
  );
}
