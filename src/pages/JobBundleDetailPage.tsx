import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Briefcase, Crown, Lock,
  Share2, Check, ChevronRight, Sparkles, Package
} from 'lucide-react';
import JobCardNew from '../components/JobCardNew';
import JobDetailModal from '../components/JobDetailModal';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { trackingService } from '../services/tracking-service';

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
  const { isAuthenticated, isMember } = useAuth();

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
      const res = await fetch(`/api/data/processed-jobs?ids=${encodeURIComponent(JSON.stringify(ids))}`);
      const data = await res.json();
      if (data.jobs) {
        const jobMap = new Map(data.jobs.map((j: any) => [j.id, j]));
        const ordered = ids.map(id => jobMap.get(id) || jobMap.get(String(id))).filter(Boolean) as Job[];
        setJobs(ordered);
      }
    } catch (e) {
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
    try { await navigator.clipboard.writeText(window.location.href); }
    catch {
      const el = document.createElement('textarea');
      el.value = window.location.href;
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
  const assistantSupportPanel = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start gap-3">
        <img
          src="/series_assistant.png"
          alt="海狗小助手二维码"
          className="h-20 w-20 rounded-2xl border border-slate-200 bg-white object-contain p-1"
        />
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">海狗小助手</div>
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
            className="flex items-center text-slate-500 hover:text-blue-600 transition-colors text-sm mb-12">
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
                  <button onClick={() => navigate(`/login?redirect=/job-bundles/${bundle.id}`)}
                    className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors text-sm">
                    登录账号
                  </button>
                  <button onClick={() => navigate('/membership')}
                    className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors text-sm">
                    加入会员
                  </button>
                </>
              ) : (
                <button onClick={() => navigate('/membership')}
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_18%,#f4f7fb_100%)]">

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10">

          {/* Top action row */}
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate('/jobs')}
              className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" />返回职位列表
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr),260px] lg:items-start">
            <div className="min-w-0">
              {/* Meta badges */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
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

              {/* Title + subtitle */}
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 leading-tight mb-3">
                {bundle.title}
              </h1>
              <p className="text-lg text-slate-500 mb-6">{bundle.subtitle}</p>

              <div className="mb-6 lg:hidden space-y-3">
                <button onClick={handleShare}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                    }`}>
                  {copied ? <><Check className="w-3.5 h-3.5" />已复制！</> : <><Share2 className="w-3.5 h-3.5" />分享合集</>}
                </button>
                {assistantSupportPanel}
              </div>

              {/* Content description — full width */}
              {bundle.content && (
                <div className="rounded-2xl border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.06),transparent_40%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4 text-sm leading-relaxed text-slate-600 whitespace-pre-wrap shadow-sm">
                  {bundle.content}
                </div>
              )}
            </div>

            <div className="hidden lg:block space-y-3">
              <button onClick={handleShare}
                className={`w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-200 hover:text-blue-600'
                  }`}>
                {copied ? <><Check className="w-3.5 h-3.5" />已复制！</> : <><Share2 className="w-3.5 h-3.5" />分享合集</>}
              </button>
              {assistantSupportPanel}
            </div>
          </div>
        </div>
      </div>

      {/* ── Jobs Grid ──────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Bundle Jobs
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              包含职位
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              点击卡片查看详情，合集页沿用首页精选区的紧凑双栏卡片规则。
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm shadow-slate-200/40">
            <Briefcase className="h-4 w-4 text-slate-400" />
            {jobs.length} 个职位
          </div>
        </div>

        {/* 2-column grid — matches homepage card style */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:gap-7">
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
          <div className="text-center py-20 text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无职位数据</p>
          </div>
        )}
      </div>

      {/* ── Membership CTA — Haigoo brand navy + amber ─────────────────────── */}
      {!isMember && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div
            className="relative overflow-hidden rounded-2xl px-8 py-10 md:px-12 bg-[#0f172a]"
          >
            <div className="absolute right-0 top-0 w-96 h-96 rounded-full blur-3xl opacity-10 translate-x-1/3 -translate-y-1/3 pointer-events-none bg-indigo-500" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-400 tracking-wide">
                    Haigoo 会员权益
                  </span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  加入 Haigoo Remote Club 会员
                </h3>
                <p className="max-w-lg text-sm leading-relaxed text-slate-400">
                  解锁更多申请次数、邮箱直申、内推通道和关键联系人信息，
                  让你的远程求职推进更高效。
                </p>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={() => navigate('/membership')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-indigo-500/30 shadow-md bg-indigo-600 hover:bg-indigo-500"
                >
                  了解会员权益
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isMember && <div className="pb-16" />}

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
        />
      )}
    </div>
  );
}
