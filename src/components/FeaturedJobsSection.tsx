import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Code2, PenTool, TrendingUp, Megaphone, Layers } from 'lucide-react'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import JobCardNew from './JobCardNew'
import { JobCardSkeleton } from './skeletons/JobCardSkeleton'
import HomeQuickSearch from './HomeQuickSearch'
import { TrustedCompany } from '../services/trusted-companies-service'

interface FeaturedJobsSectionProps {
  initialJobs?: Job[]
  onJobClick: (job: Job) => void
  trustedCompanies?: TrustedCompany[]
  companyJobStats?: Record<string, { total: number; categories: Record<string, number> }>
}

const CATEGORIES = [
  { id: 'all', label: '综合推荐', icon: Sparkles },
  { id: '人力资源,招聘,财务,会计,法务,行政,管理,客户服务,HR,Recruiter,Talent Acquisition,Finance,Legal,Admin', label: '人事行政', icon: PenTool },
  { id: '产品经理,产品设计,营销设计,网站和营销设计,视觉设计,平面设计,创意设计,UI/UX设计,用户研究,增长黑客,Product Manager,Product Designer,Marketing Designer,Visual Designer,Graphic Designer,Creative Designer,UI,UX,Growth', label: '产品设计', icon: Layers },
  { id: '前端开发,后端开发,全栈开发,软件开发,移动开发,算法工程师,测试/QA,数据开发,数据库工程师,平台工程师,服务器开发,运维/SRE,网络安全,架构师,技术支持,工程,开发,Engineer,Developer,Frontend,Backend,Full Stack,Software,QA,DevOps,Data Engineer', label: '技术研发', icon: Code2 },
  { id: 'Marketing,Digital Marketing,Content,Social Media,Growth,Operations,Project Manager,市场,营销,运营,增长', label: '运营营销', icon: TrendingUp },
  { id: 'Sales,Account Manager,Business Development,Customer Success,销售,客户经理,BD,商务', label: '销售商务', icon: Megaphone },
]

function spreadFeaturedJobs(jobs: Job[], limit = 6) {
  const companyCounts = new Map<string, number>()
  const seen = new Set<string>()
  return [...jobs]
    .filter(job => {
      if (!job.id || seen.has(job.id)) return false
      seen.add(job.id)
      return true
    })
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .filter(job => {
      const companyKey = (job.company || 'unknown').trim().toLowerCase()
      const count = companyCounts.get(companyKey) || 0
      if (count >= 2) return false
      companyCounts.set(companyKey, count + 1)
      return true
    })
    .slice(0, limit)
}

export default function FeaturedJobsSection({
  initialJobs = [],
  onJobClick,
  trustedCompanies = [],
  companyJobStats = {}
}: FeaturedJobsSectionProps) {
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
        const fetchLimit = activeTab === 'all' ? 6 : 24;

        const filters: any = {
          isFeatured: true, // Only fetch initially featured
          isApproved: true, // MANDATORY requirement for all homepage jobs
          limit: fetchLimit,
          sortBy: 'recent',
          skipAggregations: true
        }

        if (activeTab !== 'all') {
          filters.category = activeTab
        }

        const res = await processedJobsService.getProcessedJobs(1, fetchLimit, filters)
        let finalJobs = spreadFeaturedJobs(res.jobs, 6);

        setJobs(finalJobs)
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10">
          <div className="mx-auto mb-8 max-w-5xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              搜索你想找的岗位，也可以直接浏览精选机会
            </h2>
          </div>

          <HomeQuickSearch
            variant="embedded"
            featuredJobs={jobs}
            trustedCompanies={trustedCompanies}
            companyJobStats={companyJobStats}
          />
        </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(6)].map((_, i) => (
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
            {jobs.map((job) => (
              <JobCardNew
                key={job.id}
                job={job}
                variant="list"
                onClick={() => onJobClick(job)}
                showApplicationMethodIcons
                compactFeatured
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
    </div>
  )
}
