import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Briefcase, Crown, Lock,
  Share2, Check, Sparkles, Package, Megaphone, BookOpen, PlayCircle, PartyPopper
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

export default function JobBundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const handleBack = useReturnNavigation('/jobs');
  const { token, isAuthenticated, isMember } = useAuth();
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
        setError(text('组合包不存在或暂未对你开放', 'This collection is unavailable to your account.'));
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
        const ordered = ids.map(id => jobMap.get(id) || jobMap.get(String(id))).filter(Boolean) as Job[];
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
      <div className="min-h-screen bg-white flex items-center justify-center pt-20">
        <div className="text-center text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-blue-200 border-t-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-sm">{text('加载中...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !bundle) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center pt-20">
        <div className="text-center text-slate-400 p-8">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{error || text('组合包不存在', 'This collection does not exist.')}</p>
          <button onClick={handleBack} className="mt-4 text-blue-600 text-sm hover:underline">
            ← {text('返回', 'Back')}
          </button>
        </div>
      </div>
    );
  }

  if (bundle.access?.requires_login) {
    return (
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-md px-4 pb-10 pt-28 text-center sm:pt-32">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#ddd7ff] bg-[#f6f4ff] text-[#6f63f6]">
            <Lock className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black text-slate-950">{text('需登录验证后访问', 'Sign in to verify access')}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">{text('当前页面为指定用户可见，请先登录验证后再访问。', 'This page is visible to designated users only. Please sign in to verify access before continuing.')}</p>
          <button
            type="button"
            onClick={() => navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle.id))}`)}
            className="mt-7 inline-flex items-center justify-center rounded-full bg-[#6f63f6] px-6 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(95,99,246,0.62)] transition hover:bg-[#5d50df]"
          >
            {text('前往登录', 'Log in')}
          </button>
        </div>
      </div>
    );
  }

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = Boolean(bundle.access?.locked) || (isMemberBundle && !isMember);
  const isPrivateExperience = bundle.visibility === 'specified' || isMemberBundle;
  const careerItems = bundle.career_items || [];
  const completedVideoIds = new Set(progress.completed_video_ids || []);
  const completedCareerCount = careerItems.filter((item) => completedVideoIds.has(item.video_id)).length;
  const growthRecords = [...(progress.growth_records || [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const assistantSupportPanel = (
    <div className="rounded-[22px] border border-[#eadfcf] bg-[#fffdf8] p-3.5 shadow-[0_18px_44px_-34px_rgba(139,101,54,0.22)]">
      <div className="flex items-start gap-3">
        <img
          src="/series_assistant.png"
          alt={text('海狗小助手二维码', 'Haigoo assistant QR code')}
          className="h-[76px] w-[76px] rounded-2xl border border-[#dfe8ef] bg-white object-contain p-1"
        />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">{text('海狗小助手', 'Haigoo Assistant')}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {text('扫码添加微信，咨询岗位、加入交流群、获取帮助。', 'Scan to connect on WeChat for role questions, community access, and support.')}
          </p>
        </div>
      </div>
    </div>
  );

  // ── Member lock screen ────────────────────────────────────────────────────
  if (isLocked) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">
          <button onClick={handleBack}
            className="flex items-center text-slate-500 hover:text-[#3f7f67] transition-colors text-sm mb-12">
            <ArrowLeft className="w-4 h-4 mr-1" />{text('返回', 'Back')}
          </button>
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-9 h-9 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.title}</h1>
            <p className="text-slate-500 mb-2 text-sm">{bundle.subtitle}</p>
            <p className="text-sm text-amber-700 font-medium mb-8 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />{text('此精选合集仅对 Haigoo 会员开放', 'This curated collection is available to Haigoo members only.')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!isAuthenticated ? (
                <>
                  <button onClick={() => navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle.id))}`)}
                    className="px-6 py-3 rounded-xl bg-[#2b3448] text-white font-semibold hover:bg-slate-800 transition-colors text-sm">
                    {text('登录账号', 'Log in')}
                  </button>
                  <button onClick={() => navigate('/profile?tab=membership#club-service-plans')}
                    className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm">
                    {text('添加顾问了解', 'Contact an advisor')}
                  </button>
                </>
              ) : (
                <button onClick={() => navigate('/profile?tab=membership#club-service-plans')}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm">
                  {text('咨询权益方案', 'Ask about membership')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f7fc]">
      <main className="mx-auto max-w-[1720px] px-3 pb-3 pt-[76px] sm:px-5 sm:pt-[82px] lg:h-screen lg:overflow-hidden lg:pb-4">
        <div className="grid gap-3 lg:h-[calc(100vh-96px)] lg:min-h-0 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-4">
        <section className="min-w-0 overflow-hidden rounded-[24px] border border-[#dfe6f0] bg-white shadow-[0_24px_70px_-54px_rgba(33,47,70,0.20)] sm:rounded-[28px]">
        <div className="h-full min-h-0 overflow-y-auto p-3 sm:p-4 lg:p-4.5">
        <button onClick={handleBack}
          className="mb-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[#e0e7f0] bg-white px-3.5 py-1.5 text-sm font-black text-slate-600 shadow-sm transition hover:border-[#bdb3ff] hover:text-[#6251f5] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f63f6]">
          <ArrowLeft className="h-4 w-4" />{text('返回', 'Back')}
        </button>
        {/* ── Hero Header ───────────────────────────────────────────────────── */}
        <section className="relative mb-3 overflow-hidden rounded-[20px] border border-[#e5e2f8] bg-[#fcfbff] p-4 shadow-[0_24px_72px_-62px_rgba(58,67,112,0.2)] sm:rounded-[24px] sm:p-5">
          <img src="/pic_lists/Home_pics/background04.webp" alt="" className="pointer-events-none absolute bottom-0 right-0 h-[54%] w-[38%] object-cover object-[68%_100%] opacity-[0.08]" />

          <div className="relative">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {!isPrivateExperience && <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eeeaff] text-[#6f63f6] text-xs font-bold border border-[#dfd8ff]">
                  <Package className="w-3 h-3" />
                  {text('精选合集', 'Curated collection')}
                </span>}
                {bundle.visibility === 'specified' && <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e0d8ff] bg-[#f4f1ff] px-2.5 py-1 text-[11px] font-black tracking-[0.08em] text-[#6251f5]">
                  <Sparkles className="h-3.5 w-3.5" />{text('为你整理的求职准备', 'YOUR PERSONAL PREPARATION')}
                </span>}
                {isMemberBundle && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                    <Crown className="w-3 h-3" />{text('会员专属', 'Members only')}
                  </span>
                )}
              </div>

              <h1 className="mb-2 flex max-w-5xl flex-wrap items-center gap-3 text-[27px] font-black leading-[1.16] tracking-normal text-slate-950 sm:text-[32px] lg:text-[36px]">
                <span>{bundle.title}</span>
              </h1>
              <p className="mb-3 max-w-3xl text-sm font-medium leading-6 text-slate-500 sm:text-[15px]">{bundle.subtitle}</p>

              <div className="inline-flex max-w-4xl items-start gap-2.5 rounded-2xl border border-[#e9e6f7] bg-white/75 px-3 py-2.5 text-sm font-semibold leading-6 text-slate-600 sm:items-center">
                <Megaphone className="h-4 w-4 shrink-0 text-[#8f83ff]" />
                <span>{bundle.content || text('本期推荐岗位已整理完成，下一次更新后会同步更多适合远程申请的机会。', 'This collection is ready. More remote opportunities will be added in the next update.')}</span>
              </div>

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
        <section id="bundle-jobs" className="relative scroll-mt-24 overflow-hidden rounded-[20px] border border-[#e4e7f0] bg-[#fbfcff] p-4 shadow-[0_24px_70px_-58px_rgba(58,67,112,0.16)] sm:rounded-[24px] sm:p-5">
          <div className="relative mb-3 flex items-end justify-between gap-4">
            <div>
              {isPrivateExperience ? <p className="text-[11px] font-black tracking-[0.14em] text-[#7568ed]">
                {text('从这里开始', 'START HERE')}
              </p> : <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8f83ff]">
                {text('精选岗位合集', 'CURATED ROLE COLLECTION')}
              </p>}
              <h2 className="mt-1 flex items-center gap-2 text-xl font-black text-slate-900">
                <Sparkles className="h-5 w-5 text-[#8f83ff]" />
                {isPrivateExperience ? text('优先申请的职位', 'Your priority roles') : text('包含职位', 'Included roles')}
              </h2>
              {isPrivateExperience && <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{text('先查看最符合本次方向的机会，再决定你的申请节奏。', 'Start with the roles that best fit this direction, then decide your application pace.')}</p>}
            </div>
          </div>

          <div className="relative grid grid-cols-1 gap-3 md:grid-cols-2">
            {jobs.map((job, index) => (
              <div key={job.id} className="relative pt-0">
                {isPrivateExperience && index < 2 && <span className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-[#f0edff] px-2 py-1 text-[10px] font-black text-[#6251f5] shadow-sm">
                  {text(`优先 ${index + 1}`, `Priority ${index + 1}`)}
                </span>}
                <JobCardNew
                  job={job}
                  variant="list"
                  onClick={() => handleJobClick(job)}
                  isActive={selectedJob?.id === job.id}
                  showApplicationMethodIcons
                  compactFeatured
                />
              </div>
            ))}
          </div>

          {jobs.length === 0 && (
            <div className="relative overflow-hidden rounded-[20px] border border-[#e3edf4] bg-white py-8 text-center text-slate-400 shadow-sm">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{text('暂无职位数据', 'No roles available')}</p>
              <p className="mt-1 text-sm">{text('下一次更新后会同步更多适合远程申请的机会。', 'More remote opportunities will be added in the next update.')}</p>
            </div>
          )}
        </section>
        </div>
        </section>

        <aside className="relative min-h-0 overflow-y-auto rounded-[24px] border border-[#ddd7ff] bg-[#fdfcff] shadow-[0_24px_70px_-54px_rgba(95,99,246,0.22)] sm:rounded-[28px]">
          <div className="sticky top-0 z-10 border-b border-[#ebe8ff] bg-[#fdfcff] px-4 pb-3 pt-4 sm:px-5 sm:pt-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-[11px] font-black tracking-[0.12em] text-[#6f63f6]"><BookOpen className="h-4 w-4" />{isPrivateExperience ? text('为这次申请准备', 'PREPARE FOR THIS APPLICATION') : text('职业成长路径', 'CAREER LEARNING PATH')}</div>
                <h2 className="mt-1 text-xl font-black text-slate-950">{text('专属于你的准备方案', 'Your preparation plan')}</h2>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{text('按顺序完成准备，把每一次行动沉淀成自己的节奏。', 'Complete each step in order and build a rhythm that is yours.')}</p>
              </div>
              <span className="shrink-0 rounded-full border border-[#e0d9ff] bg-[#f4f1ff] px-3 py-1.5 text-xs font-black text-[#6251f5]">{completedCareerCount}/{careerItems.length}</span>
            </div>
            {careerItems.length > 0 && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eceafb]" aria-label={text(`准备进度：${completedCareerCount}/${careerItems.length}`, `Preparation progress: ${completedCareerCount}/${careerItems.length}`)}>
              <div className="h-full rounded-full bg-[#6f63f6] transition-all duration-500" style={{ width: `${(completedCareerCount / careerItems.length) * 100}%` }} />
            </div>}
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-black">
              <button type="button" onClick={() => setActiveCareerTab('learning')} className={`min-h-10 rounded-lg px-3 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f63f6] ${activeCareerTab === 'learning' ? 'bg-white text-[#5f52de] shadow-sm' : 'text-slate-500'}`}>{text('准备内容', 'Preparation')}</button>
              <button type="button" onClick={() => setActiveCareerTab('records')} className={`min-h-10 rounded-lg px-3 py-1.5 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f63f6] ${activeCareerTab === 'records' ? 'bg-white text-[#5f52de] shadow-sm' : 'text-slate-500'}`}>{text('成长记录', 'Growth log')}</button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {activeCareerTab === 'learning' ? (
              careerItems.length ? <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {careerItems.map((item, index) => {
                  const completed = completedVideoIds.has(item.video_id)
                  const introduction = item.guidance || item.description || text('打开视频，完成这一步的远程求职准备。', 'Open the video to complete this preparation step.')
                  const duration = formatVideoDuration(item.duration_ms, isEnglish)
                  return <article key={item.video_id} className={`overflow-hidden rounded-[18px] border p-2.5 transition ${completed ? 'border-[#d8d2ff] bg-[#faf9ff]' : 'border-[#e1e5ef] bg-white hover:border-[#cfc6ff]'}`}>
                    <a href={item.href || '/careerlearning'} target="_blank" rel="noreferrer" onClick={() => handleOpenVideo(item.video_id)} aria-label={text(`打开第 ${index + 1} 步准备内容：${item.title}`, `Open preparation step ${index + 1}: ${item.title}`)} className="group relative block aspect-video overflow-hidden rounded-[13px] border border-slate-100 bg-[#f5f3ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f63f6]">
                      {item.cover_image_url ? <img src={item.cover_image_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,#f5f3ff,#e8f4ff)]"><PlayCircle className="h-10 w-10 text-[#7a6ff7]" /></div>}
                      <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-slate-950 px-2.5 py-1 text-[11px] font-black text-white">{text(`第 ${index + 1} 步`, `Step ${index + 1}`)}</span>
                      <span className="absolute bottom-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/92 text-[#6251f5] shadow-sm"><PlayCircle className="h-5 w-5" /></span>
                    </a>
                    <div className="px-0.5 pt-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-800">{item.title}</h3>
                        {duration && <span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-slate-400">{duration}</span>}
                      </div>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs font-medium leading-5 text-slate-500">{introduction}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-slate-100 px-0.5 pt-2.5">
                      <span className={`text-xs font-black ${completed ? 'text-[#6251f5]' : 'text-slate-400'}`}>{completed ? text('准备完成，撒花！🎉', 'Ready to go! 🎉') : text('看完就来点亮它吧', 'Light this up when ready')}</span>
                      <button type="button" disabled={savingProgress} onClick={() => handleToggleVideoComplete(item.video_id)} className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6f63f6] disabled:cursor-not-allowed disabled:opacity-60 ${completed ? 'bg-[#eeeaff] text-[#6251f5] hover:bg-[#e4dfff]' : 'bg-[#6f63f6] text-white hover:bg-[#5d50df]'}`}>
                        {completed ? <><PartyPopper className="h-3.5 w-3.5" />{text('已点亮', 'Celebrated')}</> : <><Check className="h-3.5 w-3.5" />{text('完成准备', 'Mark ready')}</>}
                      </button>
                    </div>
                  </article>
                })}
              </div> : <div className="rounded-[20px] border border-dashed border-[#d8d2ff] bg-[#faf9ff] px-5 py-10 text-center"><BookOpen className="mx-auto h-8 w-8 text-[#8f83ff]" /><p className="mt-3 text-sm font-black text-slate-700">{text('顾问正在为你整理成长内容', 'Your career plan is being prepared')}</p><p className="mt-1 text-xs leading-5 text-slate-500">{text('组合更新后，视频和具体使用建议会显示在这里。', 'Videos and instructions will appear here once the plan is updated.')}</p></div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[20px] border border-[#e6e4ff] bg-[#faf9ff] p-3.5 text-sm leading-6 text-slate-600">{text('这里会自动收集你打开准备内容、迈出申请第一步的时刻。不用填写表格，专心往前走就好。', 'This log automatically captures the moments you open preparation content and take the first application step. Keep moving; we will keep the trail.')}</div>
                <div className="relative space-y-0 before:absolute before:bottom-5 before:left-[15px] before:top-5 before:w-px before:bg-[#ded9ff]">{growthRecords.length ? growthRecords.map((record, index) => <article key={record.id} className="relative pb-5 pl-10 last:pb-0"><span className="absolute left-0 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#d8d2ff] bg-[#f2efff] text-xs font-black text-[#6658ef] shadow-sm">{index + 1}</span><div className="rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-[0_16px_35px_-30px_rgba(48,58,95,0.42)]"><p className="text-sm leading-6 text-slate-700">{record.content}</p><time className="mt-2 block text-xs font-semibold text-slate-400">{new Date(record.created_at).toLocaleString(isEnglish ? 'en-US' : 'zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</time></div></article>) : <p className="relative px-2 py-7 text-center text-sm leading-6 text-slate-400">{text('第一条记录会在你打开准备内容或发起一次申请时自动出现。', 'Your first entry will appear automatically when you open preparation content or start an application.')}</p>}</div>
              </div>
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
