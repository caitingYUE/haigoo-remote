import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, Briefcase } from 'lucide-react';
import JobCardNew from '../components/JobCardNew';
import JobDetailModal from '../components/JobDetailModal';
import { Job } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  content: string;
  job_ids: string[]; // JSON array of strings
  priority: number;
  start_time: string | null;
  end_time: string | null;
  is_public: boolean;
  is_active: boolean;
  created_at: string;
}

export default function JobBundleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [bundle, setBundle] = useState<JobBundle | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false);
  const [currentJobIndex, setCurrentJobIndex] = useState(0);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      fetchBundle(id);
    }
  }, [id]);

  const fetchBundle = async (bundleId: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/job-bundles?id=${bundleId}`);
      if (!res.ok) throw new Error('Failed to fetch bundle');
      const data = await res.json();
      if (data.success && data.data) {
        setBundle(data.data);
        if (data.data.job_ids && data.data.job_ids.length > 0) {
            await fetchJobs(data.data.job_ids);
        } else {
            setJobs([]);
        }
      } else {
        setError('Bundle not found');
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
          console.log('[JobBundle] Fetching jobs with IDs:', ids);
          // 确保ids参数正确编码
          const res = await fetch(`/api/data/processed-jobs?ids=${encodeURIComponent(ids.join(','))}`);
          const data = await res.json();
          console.log('[JobBundle] API response:', data);
          
          if (data.jobs) {
              // Reorder
              const jobMap = new Map(data.jobs.map((j: any) => [j.id, j]));
              // 兼容可能存在的不同ID类型（string/number）
              const ordered = ids.map(id => jobMap.get(id) || jobMap.get(String(id)) || jobMap.get(Number(id))).filter(Boolean) as Job[];
              console.log('[JobBundle] Ordered jobs:', ordered);
              setJobs(ordered);
          } else {
              console.warn('[JobBundle] No jobs found in response');
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

  const toggleSaveJob = (jobId: string, job: Job) => {
      // Placeholder for save functionality
      console.log('Toggle save', jobId);
  };

  if (loading) return <div className="p-8 text-center">加载中...</div>;
  if (error || !bundle) return <div className="p-8 text-center text-red-500">{error || '组合包不存在'}</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <button 
                onClick={() => navigate('/jobs')}
                className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors mb-6"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                返回职位列表
            </button>
            
            <div className="max-w-3xl">
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold tracking-wide uppercase">
                        精选合集
                    </span>
                    {bundle.start_time && (
                        <div className="flex items-center text-slate-500 text-sm">
                            <Calendar className="w-4 h-4 mr-1" />
                            {new Date(bundle.start_time).toLocaleDateString()}
                        </div>
                    )}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">{bundle.title}</h1>
                <p className="text-xl text-slate-600 mb-6">{bundle.subtitle}</p>
                {bundle.content && (
                    <div className="prose prose-slate max-w-none text-slate-600 bg-slate-50 p-6 rounded-xl border border-slate-100 whitespace-pre-wrap">
                        {bundle.content}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-600" />
                  包含职位 ({jobs.length})
              </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map(job => (
                  <JobCardNew
                    key={job.id}
                    job={job}
                    onClick={() => handleJobClick(job)}
                    className="h-full"
                  />
              ))}
          </div>
          
          {jobs.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                  暂无职位数据
              </div>
          )}
      </div>
      
      {/* Detail Modal */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal
            job={selectedJob}
            isOpen={isJobDetailOpen}
            onClose={() => setIsJobDetailOpen(false)}
            onSave={() => toggleSaveJob(selectedJob.id, selectedJob)}
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
