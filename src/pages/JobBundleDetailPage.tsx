import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Briefcase, Crown, Lock, Share2, Check, ExternalLink } from 'lucide-react';
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
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) fetchBundle(id);
  }, [id]);

  const fetchBundle = async (bundleId: string) => {
    try {
      setLoading(true);
      // Use public endpoint to avoid adblocker issues
      const res = await fetch(`/api/data/job-bundles?id=${bundleId}`);
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const data = await res.json();
      if (data.success && data.data && data.data.length > 0) {
        const b = data.data[0];
        setBundle(b);
        if (b.job_ids && b.job_ids.length > 0) {
          await fetchJobs(b.job_ids);
        } else {
          setJobs([]);
        }
      } else {
        // Fallback to admin endpoint (for admins)
        const res2 = await fetch(`/api/admin/job-bundles?id=${bundleId}`);
        const data2 = await res2.json();
        if (data2.success && data2.data) {
          setBundle(data2.data);
          if (data2.data.job_ids && data2.data.job_ids.length > 0) {
            await fetchJobs(data2.data.job_ids);
          } else {
            setJobs([]);
          }
        } else {
          setError('Bundle not found');
        }
      }
    } catch (err) {
      console.error(err);
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
        const ordered = ids
          .map(id => jobMap.get(id) || jobMap.get(String(id)) || jobMap.get(Number(id)))
          .filter(Boolean) as Job[];
        setJobs(ordered);
      } else {
        setJobs([]);
      }
    } catch (e) {
      console.error('Failed to fetch jobs', e);
    }
  };

  const handleJobClick = (job: Job) => {
    const index = jobs.findIndex(j => j.id === job.id);
    setSelectedJob(job);
    setCurrentJobIndex(index);
    setIsJobDetailOpen(true);
  };

  const handleNavigateJob = (direction: 'prev' | 'next') => {
    let newIndex = direction === 'prev' ? currentJobIndex - 1 : currentJobIndex + 1;
    if (newIndex < 0) newIndex = jobs.length - 1;
    if (newIndex >= jobs.length) newIndex = 0;
    setCurrentJobIndex(newIndex);
    setSelectedJob(jobs[newIndex]);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-500">
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

  // Member lock fallback screen
  if (isLocked) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <button
              onClick={() => navigate('/jobs')}
              className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors mb-0"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回职位列表
            </button>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-6">
            <Crown className="w-9 h-9 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">{bundle.title}</h1>
          <p className="text-slate-500 mb-2">{bundle.subtitle}</p>
          <p className="text-sm text-amber-600 font-medium mb-8">
            <Lock className="w-3.5 h-3.5 inline mr-1 mb-0.5" />
            此精选合集仅对 Haigoo 会员开放
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!isAuthenticated ? (
              <>
                <button
                  onClick={() => navigate(`/login?redirect=/job-bundles/${bundle.id}`)}
                  className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
                >
                  登录账号
                </button>
                <button
                  onClick={() => navigate('/membership')}
                  className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
                >
                  加入会员
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/membership')}
                className="px-6 py-3 rounded-xl bg-amber-500 text-white font-semibold hover:bg-amber-600 transition-colors"
              >
                升级会员，立即解锁
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-start justify-between gap-4">
            <button
              onClick={() => navigate('/jobs')}
              className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors mt-1"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              返回职位列表
            </button>

            {/* Share button */}
            <button
              onClick={handleShare}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all duration-200 ${copied
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  链接已复制！
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  分享合集
                </>
              )}
            </button>
          </div>

          <div className="mt-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-wide uppercase">
                精选合集
              </span>
              {isMemberBundle && (
                <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold border border-amber-200">
                  <Crown className="w-3 h-3" />
                  会员专属
                </span>
              )}
              {bundle.start_time && (
                <div className="flex items-center text-slate-400 text-sm">
                  <Calendar className="w-4 h-4 mr-1" />
                  {new Date(bundle.start_time).toLocaleDateString('zh-CN')}
                </div>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2 leading-tight">
              {bundle.title}
            </h1>
            <p className="text-lg text-slate-500 mb-5">{bundle.subtitle}</p>
            {bundle.content && (
              <div className="prose prose-slate max-w-none text-slate-600 bg-slate-50 px-5 py-4 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm leading-relaxed">
                {bundle.content}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-500" />
            包含职位
            <span className="text-slate-400 font-normal">({jobs.length})</span>
          </h2>
        </div>

        {/* List layout — matches JobsPage style */}
        <div className="flex flex-col gap-2">
          {jobs.map((job, index) => (
            <JobCardNew
              key={job.id}
              job={job}
              variant="list"
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

      {/* Detail Modal */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
          job={selectedJob}
          isOpen={isJobDetailOpen}
          onClose={() => setIsJobDetailOpen(false)}
          onSave={() => console.log('Toggle save', selectedJob.id)}
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
