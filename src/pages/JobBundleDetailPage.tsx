import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Briefcase, Crown, Lock,
  Share2, Check, ChevronRight, Sparkles
} from 'lucide-react';
import JobCardNew from '../components/JobCardNew';
import JobDetailModal from '../components/JobDetailModal';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';

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

  const fetchBundle = async (bundleId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/data/job-bundles?id=${bundleId}`);
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const b = data.data[0];
        setBundle(b);
        if (b.job_ids?.length > 0) await fetchJobs(b.job_ids);
        else setJobs([]);
      } else {
        // Admin fallback
        const res2 = await fetch(`/api/admin/job-bundles?id=${bundleId}`);
        const data2 = await res2.json();
        if (data2.success && data2.data) {
          setBundle(data2.data);
          if (data2.data.job_ids?.length > 0) await fetchJobs(data2.data.job_ids);
          else setJobs([]);
        } else {
          setError('Bundle not found');
        }
      }
    } catch (err) {
      setError('Error loading bundle');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async (ids: string[]) => {
    try {
      const res = await fetch(`/api/data/processed-jobs?ids=${encodeURIComponent(ids.join(','))}`);
      const data = await res.json();
      if (data.jobs) {
        const jobMap = new Map(data.jobs.map((j: any) => [j.id, j]));
        const ordered = ids.map(id => jobMap.get(id) || jobMap.get(String(id))).filter(Boolean) as Job[];
        setJobs(ordered);
      } else {
        setJobs([]);
      }
    } catch (e) {
      console.error('Failed to fetch jobs', e);
    }
  };

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setCurrentJobIndex(jobs.findIndex(j => j.id === job.id));
    setIsJobDetailOpen(true);
  };

  const handleNavigateJob = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev'
      ? (currentJobIndex - 1 + jobs.length) % jobs.length
      : (currentJobIndex + 1) % jobs.length;
    setCurrentJobIndex(newIndex);
    setSelectedJob(jobs[newIndex]);
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      const el = document.createElement('textarea');
      el.value = window.location.href;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-400">
          <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-500 animate-spin mx-auto mb-3" />
          加载中...
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-400 p-8">
          <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">{error || '组合包不存在'}</p>
        </div>
      </div>
    );
  }

  const isMemberBundle = bundle.visibility === 'member';
  const isLocked = isMemberBundle && !isMember;

  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200 px-4 py-5">
          <div className="max-w-4xl mx-auto">
            <button onClick={() => navigate('/jobs')} className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />返回职位列表
            </button>
          </div>
        </div>
        <div className="max-w-md mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <Crown className="w-9 h-9 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.title}</h1>
          <p className="text-slate-500 mb-2">{bundle.subtitle}</p>
          <p className="text-sm text-amber-600 font-medium mb-8">
            <Lock className="w-3.5 h-3.5 inline mr-1" />此精选合集仅对 Haigoo 会员开放
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isAuthenticated ? (
              <>
                <button onClick={() => navigate(`/login?redirect=/job-bundles/${bundle.id}`)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors">
                  登录账号
                </button>
                <button onClick={() => navigate('/membership')}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors">
                  加入会员
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/membership')}
                className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors">
                升级会员，立即解锁
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-0">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10">

          {/* Top row: back + share */}
          <div className="flex items-center justify-between mb-8">
            <button onClick={() => navigate('/jobs')}
              className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors text-sm">
              <ArrowLeft className="w-4 h-4 mr-1" />返回职位列表
            </button>
            <button onClick={handleShare}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                }`}>
              {copied ? <><Check className="w-4 h-4" />已复制！</> : <><Share2 className="w-4 h-4" />分享合集</>}
            </button>
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wide">
              精选合集
            </span>
            {isMemberBundle && (
              <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 text-xs font-bold border border-amber-200">
                <Crown className="w-3 h-3" />会员专属
              </span>
            )}
            {bundle.start_time && (
              <span className="flex items-center gap-1 text-slate-400 text-xs">
                <Calendar className="w-3.5 h-3.5" />
                {new Date(bundle.start_time).toLocaleDateString('zh-CN')}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-2">
            {bundle.title}
          </h1>
          <p className="text-lg text-slate-500 mb-6">{bundle.subtitle}</p>

          {/* Content block */}
          {bundle.content && (
            <div className="text-sm text-slate-600 bg-slate-50 border border-slate-100 px-5 py-4 rounded-xl whitespace-pre-wrap leading-relaxed max-w-2xl">
              {bundle.content}
            </div>
          )}
        </div>
      </div>

      {/* ── Jobs Grid ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-5 flex items-center gap-2">
          <Briefcase className="w-4 h-4" />
          包含职位 ({jobs.length})
        </h2>

        {/* 2-column grid matching site style */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job, idx) => (
            <JobCardNew
              key={job.id}
              job={job}
              variant="grid"
              onClick={() => handleJobClick(job)}
              isActive={selectedJob?.id === job.id}
            />
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无职位数据</p>
          </div>
        )}
      </div>

      {/* ── Membership CTA Banner ── */}
      {!isMember && (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div
            className="relative overflow-hidden rounded-2xl px-8 py-10 md:px-12"
            style={{ background: 'linear-gradient(135deg, #1A365D 0%, #2d3a8c 50%, #3730a3 100%)' }}
          >
            {/* Decorative orb */}
            <div className="absolute right-0 top-0 w-64 h-64 rounded-full opacity-10 blur-3xl"
              style={{ background: '#818cf8', transform: 'translate(30%, -30%)' }} />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 text-sm font-semibold">Haigoo 会员权益</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  加入 Haigoo Club 会员
                </h3>
                <p className="text-indigo-200 text-sm leading-relaxed max-w-md">
                  获取内部推荐渠道、简历优化指导、1-on-1 远程求职咨询。专为追求全球化职业发展的求职者打造。
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
                <button
                  onClick={() => navigate('/membership')}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-indigo-800 font-bold text-sm hover:bg-indigo-50 transition-colors"
                >
                  了解会员权益
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* spacer when member (no CTA) */}
      {isMember && <div className="pb-16" />}

      {/* ── Detail Modal ── */}
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
