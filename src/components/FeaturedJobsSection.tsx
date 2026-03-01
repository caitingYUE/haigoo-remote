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
  { id: 'Customer Service,Virtual Assistant,AI Trainer,Data Entry,Translator,Writer,Content,HR,Human Resources,Finance,Admin,Assistant,客服,客户服务,助理,行政,文员,人事,人力资源,财务,会计,内容创作,作家,文案,新媒体,社群,运营,标注,数据标注,AI训练师,翻译,录入,远程入门', label: '远程入门', icon: PenTool },
  { id: 'Product Manager,Product Owner,Product Marketing,Head of Product,产品经理,产品', label: '产品经理', icon: Layers },
  { id: 'Software Engineer,Frontend,Backend,Full Stack,DevOps,Data Engineer,Algorithm,Developer,研发,前端,后端,全栈,算法,工程师', label: '技术研发', icon: Code2 },
  { id: 'Marketing,Digital Marketing,Content,Social Media,Growth,Operations,Project Manager,市场,营销,运营,增长', label: '营销运营', icon: TrendingUp },
  { id: 'Sales,Account Manager,Business Development,Customer Success,销售,客户经理,BD,商务', label: '客户经理', icon: Megaphone },
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
        let fetchLimit = activeTab === CATEGORIES[1].id ? 60 : 6;

        const filters: any = {
          isFeatured: true, // Only fetch initially featured
          isApproved: true, // MANDATORY requirement for all homepage jobs
          limit: fetchLimit
        }

        if (activeTab !== 'all') {
          filters.category = activeTab
        }

        const res = await processedJobsService.getProcessedJobs(1, fetchLimit, filters)
        let finalJobs = res.jobs;

        if (activeTab === CATEGORIES[1].id) {
          // 条件一: CATEGORY ALREADY APPLIED IN THE QUERY String.
          // 条件二: 级别为【初级】
          const juniorKeywords = ['entry', 'junior', '初级', '实习', 'intern', '助理', 'assistant'];
          // Also explicitly exclude middle/senior
          const excludeKeywords = ['mid', 'senior', 'lead', 'manager', 'director', '中级', '高级', '资深', '专家', '管理'];

          finalJobs = finalJobs.filter(j => {
            const expStr = String(j.experienceLevel || '').toLowerCase();
            const titleStr = String(j.title || '').toLowerCase();

            // It must explicitly contain a junior keyword or be completely empty but NOT contain a senior keyword
            const hasJunior = juniorKeywords.some(k => expStr.includes(k) || titleStr.includes(k));
            const hasSenior = excludeKeywords.some(k => expStr.includes(k) || titleStr.includes(k));

            if (hasSenior) return false;

            // Allow if strictly junior OR if it's implicitly empty and safe
            return hasJunior || (!j.experienceLevel && !hasSenior);
          });

          // Sort by updated/published descending (processedJobsService usually sorts by recent or relevance, let's enforce recent)
          finalJobs.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());

          // 条件三: 针对企业做打散，每组（6个）相同企业数量不超过2个
          const companyCountMap = new Map<string, number>();
          const dispersedJobs: typeof finalJobs = [];

          for (const job of finalJobs) {
            const compName = job.company ? job.company.toLowerCase() : 'unknown';
            const count = companyCountMap.get(compName) || 0;
            if (count < 2) {
              dispersedJobs.push(job);
              companyCountMap.set(compName, count + 1);
            }
            if (dispersedJobs.length >= 6) break;
          }
          finalJobs = dispersedJobs;
        }

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
    </div>
  )
}
