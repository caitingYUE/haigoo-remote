import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Code2, PenTool, TrendingUp, Megaphone, Layers } from 'lucide-react'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import JobCardNew from './JobCardNew'
import { JobCardSkeleton } from './skeletons/JobCardSkeleton'

interface FeaturedJobsSectionProps {
  initialJobs?: Job[]
  onJobClick: (job: Job) => void
}

const CATEGORIES = [
  { id: 'all', label: '全部精选', icon: Sparkles },
  { id: 'Product', label: '产品经理', icon: Layers },
  { id: 'Engineering', label: '研发工程师', icon: Code2 },
  { id: 'Design', label: '设计与创意', icon: PenTool },
  { id: 'Growth', label: '增长与运营', icon: TrendingUp },
  { id: 'Marketing', label: '市场营销', icon: Megaphone },
]

export default function FeaturedJobsSection({ initialJobs = [], onJobClick }: FeaturedJobsSectionProps) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('all')
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [loading, setLoading] = useState(false)

  // Sync with initialJobs when they are loaded from parent (and tab is 'all')
  useEffect(() => {
    if (activeTab === 'all' && initialJobs.length > 0) {
      setJobs(initialJobs)
    }
  }, [initialJobs, activeTab])

  useEffect(() => {
    const fetchJobs = async () => {
      // If tab is 'all' and we already have initialJobs, skip fetch
      if (activeTab === 'all' && initialJobs.length > 0) {
        return
      }

      setLoading(true)
      try {
        // If tab is 'all', we might want to use the initialJobs if provided and valid, 
        // but to ensure consistency when switching back, we might just refetch or cache.
        // For simplicity, we fetch.
        
        const filters: any = { 
          isFeatured: true,
          limit: 6
        }

        if (activeTab !== 'all') {
          filters.category = activeTab
          // If we filter by category, we might want to relax isFeatured if we don't have enough featured jobs in that category.
          // But for now, let's keep isFeatured=true to ensure quality.
        }

        const res = await processedJobsService.getProcessedJobs(1, 6, filters)
        setJobs(res.jobs)
      } catch (error) {
        console.error('Failed to fetch jobs for tab:', activeTab, error)
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
  }, [activeTab])

  return (
    <div id="featured-jobs" className="py-16 border-t border-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">精选岗位</h2>
          <p className="text-slate-500">人工逐条筛选的高薪/高增长/好文化的优质远程机会</p>
        </div>
        
        <button
          onClick={() => navigate('/jobs?region=domestic')}
          className="hidden md:flex px-6 py-2.5 bg-white text-slate-700 font-medium rounded-full border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 transition-all duration-200 items-center gap-2 group whitespace-nowrap"
        >
          浏览所有岗位
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        {CATEGORIES.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-all whitespace-nowrap
                ${isActive 
                  ? 'bg-slate-900 text-white shadow-md ring-2 ring-slate-900 ring-offset-2' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                }
              `}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-300' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[...Array(4)].map((_, i) => (
            <JobCardSkeleton key={i} />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
          <Sparkles className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">该分类下暂无精选岗位，去看看其他分类吧</p>
          <button 
            onClick={() => setActiveTab('all')}
            className="mt-4 text-indigo-600 font-bold hover:underline"
          >
            查看全部精选
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in fade-in duration-500">
          {jobs.map((job) => (
            <JobCardNew
              key={job.id}
              job={job}
              variant="list"
              onClick={() => onJobClick(job)}
              // Pass a prop to indicate this is a featured list context if needed
            />
          ))}
        </div>
      )}

      <div className="mt-10 text-center md:hidden">
        <button
          onClick={() => navigate('/jobs?region=domestic')}
          className="px-8 py-3 bg-white text-slate-700 font-medium rounded-xl border border-slate-200 hover:bg-slate-50 transition-all duration-200 inline-flex items-center gap-2 shadow-sm"
        >
          浏览所有岗位
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
