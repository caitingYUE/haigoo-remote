import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Briefcase, Crown, Lock,
  Share2, Check, ChevronRight, Sparkles, Package, Megaphone
} from 'lucide-react';
import JobCardNew from '../components/JobCardNew';
import JobDetailModal from '../components/JobDetailModal';
import HaigooClubInfoCard from '../components/HaigooClubInfoCard';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { trackingService } from '../services/tracking-service';
import { getBundleDetailLink, getBundleDetailPath } from '../utils/share-link-helper';

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
}

export default function JobBundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated, isMember, isTrialMember } = useAuth();

  const [bundle, setBundle] = useState<JobBundle | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [savedJobs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => { if (id) fetchBundle(id); }, [id]);

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
      const res = await fetch(`/api/data/job-bundles?id=${bundleId}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const b = data.data[0];
        setBundle(b);
        if (b.job_ids?.length > 0) await fetchJobs(b.job_ids);
        else setJobs([]);
      } else {
        const res2 = await fetch(`/api/admin/job-bundles?id=${bundleId}`);
        const data2 = await res2.json();
        if (data2.success && data2.data) {
          setBundle(data2.data);
          if (data2.data.job_ids?.length > 0) await fetchJobs(data2.data.job_ids);
          else setJobs([]);
        } else {
          setError('组合包不存在');
        }
      }
    } catch {
      setError('加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
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
          <p className="text-sm">加载中...</p>
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
          <p className="text-lg font-medium">{error || '组合包不存在'}</p>
          <button onClick={() => navigate('/jobs')} className="mt-4 text-blue-600 text-sm hover:underline">
            ← 返回职位列表
          </button>
        </div>
      </div>
    );
  }

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;
  const memberExpireAt = (user as any)?.memberExpireAt || (user as any)?.member_expire_at || null;
  const memberExpireLabel = memberExpireAt ? new Date(memberExpireAt).toLocaleDateString('zh-CN') : '长期有效';
  const memberStatusLabel = isTrialMember ? '体验会员权益生效中' : 'Haigoo 会员权益生效中';
  const pageBackground = '/pic_lists/About_pics/about_bg.webp';
  const assistantSupportPanel = (
    <div className="rounded-[22px] border border-[#eadfcf] bg-[#fffdf8] p-3.5 shadow-[0_18px_44px_-34px_rgba(139,101,54,0.22)]">
      <div className="flex items-start gap-3">
        <img
          src="/series_assistant.png"
          alt="海狗小助手二维码"
          className="h-[76px] w-[76px] rounded-2xl border border-[#dfe8ef] bg-white object-contain p-1"
        />
        <div className="min-w-0">
          <div className="text-sm font-black text-slate-900">海狗小助手</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            扫码添加微信，咨询岗位、加入交流群、获取帮助。
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
          <button onClick={() => navigate('/jobs')}
            className="flex items-center text-slate-500 hover:text-[#3f7f67] transition-colors text-sm mb-12">
            <ArrowLeft className="w-4 h-4 mr-1" />返回职位列表
          </button>
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
              <Crown className="w-9 h-9 text-amber-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.title}</h1>
            <p className="text-slate-500 mb-2 text-sm">{bundle.subtitle}</p>
            <p className="text-sm text-amber-700 font-medium mb-8 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />此精选合集仅对 Haigoo 会员开放
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {!isAuthenticated ? (
                <>
                  <button onClick={() => navigate(`/login?redirect=${encodeURIComponent(getBundleDetailPath(bundle.id))}`)}
                    className="px-6 py-3 rounded-xl bg-[#2b3448] text-white font-semibold hover:bg-slate-800 transition-colors text-sm">
                    登录账号
                  </button>
                  <button onClick={() => navigate('/profile?tab=membership')}
                    className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm">
                    加入会员
                  </button>
                </>
              ) : (
                <button onClick={() => navigate('/profile?tab=membership')}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm">
                  升级会员，立即解锁
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
    <div className="relative min-h-screen overflow-hidden bg-[#fffdfa]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <img
          src={pageBackground}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-top opacity-[0.42] saturate-[0.96]"
        />
        <img src="/pic_lists/About_pics/grass_icon-transparent.webp" alt="" className="absolute bottom-10 left-3 hidden h-40 w-40 object-contain opacity-30 lg:block" />
        <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="absolute bottom-10 right-4 hidden h-40 w-40 object-contain opacity-30 lg:block" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.74)_0%,rgba(255,253,248,0.92)_38%,rgba(248,252,255,0.86)_100%)]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1420px] px-3.5 pb-12 pt-[84px] sm:px-8 sm:pb-16 sm:pt-[96px] lg:px-10">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button onClick={() => navigate('/jobs')}
            className="inline-flex items-center gap-1.5 text-slate-500 hover:text-[#6f63f6] transition-colors text-sm font-medium">
            <ArrowLeft className="w-4 h-4" />返回职位列表
          </button>
          <button
            type="button"
            onClick={() => document.getElementById('bundle-jobs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="hidden items-center gap-1.5 rounded-full border border-[#dfe8ef] bg-white/90 px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-[#cfc7ff] hover:text-[#6f63f6] sm:inline-flex"
          >
            查看全部岗位
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* ── Hero Header ───────────────────────────────────────────────────── */}
        <section className="relative mb-5 overflow-hidden rounded-[24px] border border-[#eadfcf] bg-[#fffdf8] p-4 shadow-[0_24px_72px_-62px_rgba(139,101,54,0.34)] sm:mb-6 sm:rounded-[30px] sm:p-6 lg:p-8">
          <div className="pointer-events-none absolute inset-0">
            <img src="/pic_lists/Home_pics/background04.webp" alt="" className="absolute inset-y-0 right-0 h-full w-[54%] object-cover object-[68%_54%] opacity-[0.48] saturate-[0.98]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#fffdf8_0%,rgba(255,253,248,0.94)_48%,rgba(255,253,248,0.48)_100%)]" />
          </div>

          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#eeeaff] text-[#6f63f6] text-xs font-bold border border-[#dfd8ff]">
                  <Package className="w-3 h-3" />
                  精选合集
                </span>
                {isMemberBundle && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold border border-amber-200">
                    <Crown className="w-3 h-3" />会员专属
                  </span>
                )}
                <span className="text-slate-400 text-xs flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {jobs.length} 个职位
                </span>
                {bundle.start_time && (
                  <span className="text-slate-400 text-xs flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(bundle.start_time).toLocaleDateString('zh-CN')}
                  </span>
                )}
              </div>

              <h1 className="mb-3 flex max-w-5xl flex-wrap items-center gap-3 text-[25px] font-black leading-[1.14] tracking-normal text-slate-950 sm:mb-4 sm:text-[38px] lg:text-[44px]">
                <span>{bundle.title}</span>
              </h1>
              <p className="mb-4 max-w-3xl text-sm leading-6 text-slate-500 sm:mb-5 sm:text-base sm:leading-7">{bundle.subtitle}</p>

              <div className="inline-flex w-full max-w-4xl items-start gap-2.5 rounded-2xl border border-[#eadfcf] bg-white px-3.5 py-3 text-sm font-semibold leading-6 text-slate-600 shadow-[0_18px_44px_-36px_rgba(139,101,54,0.28)] sm:items-center sm:gap-3 sm:px-4">
                <Megaphone className="h-4 w-4 shrink-0 text-[#8f83ff]" />
                <span>{bundle.content || '本期推荐岗位已整理完成，下一次更新后会同步更多适合远程申请的机会。'}</span>
              </div>

              <div className="mt-5 space-y-3 lg:hidden">
                <button onClick={handleShare}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" />已复制！</> : <><Share2 className="w-3.5 h-3.5" />分享合集</>}
                </button>
                {assistantSupportPanel}
              </div>

            </div>

            <div className="hidden space-y-3 self-start lg:block">
              <div className="flex justify-end">
                <button onClick={handleShare}
                  className={`inline-flex w-[190px] items-center justify-center gap-1.5 px-3.5 py-2 rounded-full border text-sm font-medium transition-all duration-200 ${copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white/86 border-[#dfe8ef] text-slate-600 hover:border-[#cfe0ea] hover:text-[#3f7f67]'
                    }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" />已复制！</> : <><Share2 className="w-3.5 h-3.5" />分享合集</>}
                </button>
              </div>
              {assistantSupportPanel}
            </div>
          </div>
        </section>

        {/* ── Jobs Grid ────────────────────────────────────────────────────── */}
        <section id="bundle-jobs" className="relative scroll-mt-24 overflow-hidden rounded-[24px] border border-[#eadfcf] bg-[#fffdf8] p-4 shadow-[0_24px_70px_-58px_rgba(139,101,54,0.24)] sm:rounded-[30px] sm:p-8">
          <div className="pointer-events-none absolute inset-0">
            <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="absolute bottom-0 right-5 h-28 w-28 object-contain opacity-18" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.72)_0%,rgba(255,255,255,0.96)_34%)]" />
          </div>
          <div className="relative mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.18em] text-[#8f83ff]">
                精选岗位合集
              </p>
              <h2 className="mt-2 flex items-center gap-2 text-xl font-bold text-slate-900 sm:text-2xl">
                <Sparkles className="h-5 w-5 text-[#8f83ff]" />
                包含职位
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                点击卡片查看岗位详情，可根据需要选择“前往申请”或“帮我内推”。
              </p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/40">
              <Briefcase className="h-4 w-4 text-slate-400" />
              {jobs.length} 个职位
            </div>
          </div>

          <div className="relative grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-5 xl:gap-7">
            {jobs.map((job) => (
              <JobCardNew
                key={job.id}
                job={job}
                variant="list"
                onClick={() => handleJobClick(job)}
                isActive={selectedJob?.id === job.id}
                showApplicationMethodIcons
                compactFeatured
              />
            ))}
          </div>

          {jobs.length === 0 && (
            <div className="relative overflow-hidden rounded-[24px] border border-[#e3edf4] bg-white py-12 text-center text-slate-400 shadow-sm">
              <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">暂无职位数据</p>
              <p className="mt-1 text-sm">下一次更新后会同步更多适合远程申请的机会。</p>
            </div>
          )}
        </section>

        <section className="relative mt-5 overflow-hidden rounded-[24px] border border-[#e3edf4] bg-[linear-gradient(135deg,#fffdf8_0%,#f7fbff_100%)] p-4 shadow-[0_24px_70px_-58px_rgba(64,78,102,0.24)] sm:mt-6 sm:rounded-[28px] sm:p-6">
          <img src="/pic_lists/Home_pics/background03.webp" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-32 w-full object-cover object-bottom opacity-30" />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="hidden h-16 w-16 items-center justify-center rounded-[20px] bg-[#f0edff] text-[#6f63f6] sm:flex">
                <Crown className="h-7 w-7" />
              </div>
              <div>
                <div className="text-sm font-black text-[#49a982]">Haigoo 会员权益</div>
                <h3 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">
                  {isMember ? memberStatusLabel : '想看更多高价值岗位和联系人？'}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  {isMember
                    ? `你已解锁会员岗位、邮箱直申、内推线索和精选推荐，有效期至 ${memberExpireLabel}。`
                    : '解锁会员岗位、邮箱直申、内推线索和精选推荐，让申请推进更高效。'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(isMember ? '/jobs?memberOnly=true' : '/profile?tab=membership')}
              className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#49a982] px-6 py-3 text-sm font-black text-white shadow-[0_18px_38px_-24px_rgba(73,169,130,0.6)] transition hover:-translate-y-0.5 sm:w-auto"
            >
              {isMember ? '继续查看会员岗位' : '了解会员权益'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </section>

        <HaigooClubInfoCard className="mt-6" />

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
