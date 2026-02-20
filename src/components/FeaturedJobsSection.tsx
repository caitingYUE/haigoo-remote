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
        const filters: any = { 
          isFeatured: true,
          limit: 6
        }

        if (activeTab !== 'all') {
          filters.category = activeTab
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
    <div id="featured-jobs" className="py-12">
      {/* Tabs */}
      <div className="flex flex-col items-center mb-10">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-b border-slate-200 pb-1 w-full max-w-3xl">
          {CATEGORIES.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-2 py-3 text-base font-bold transition-all
                  ${isActive 
                    ? 'text-indigo-600' 
                    : 'text-slate-500 hover:text-slate-800'
                  }
                `}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-[-5px] left-0 right-0 h-1 bg-indigo-600 rounded-t-full shadow-sm shadow-indigo-200"></span>
                )}
              </button>
            )
          })}
        </div>
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
