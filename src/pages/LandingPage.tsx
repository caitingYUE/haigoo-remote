import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search } from 'lucide-react'
import JobCard from '../components/JobCard'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import '../styles/landing.css'
import homeBg from '../assets/home_bg.png'
import homeBgSvg from '../assets/home_bg.svg'

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('全部')
  const [displayLimit, setDisplayLimit] = useState<number>(24)

  const { data: jobs, loading, error } = usePageCache<Job[]>('landing-all-jobs', {
    fetcher: async () => await processedJobsService.getAllProcessedJobsFull(100),
    ttl: 0,
    persist: true,
    namespace: 'landing'
  })

  const categories = useMemo(() => {
    const set = new Set<string>()
    ;(jobs || []).forEach(j => { if (j.category) set.add(j.category) })
    return Array.from(set).sort()
  }, [jobs])

  const dynamicTabs = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(jobs || []).forEach(j => { if (j.category) counts[j.category] = (counts[j.category]||0)+1 })
    const top = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,6)
    return ['全部', ...top]
  }, [jobs])
  const latestJobs = useMemo(() => [...(jobs || [])].sort((a,b)=>{
    const ta = new Date(a.postedAt || 0).getTime(); const tb = new Date(b.postedAt || 0).getTime(); return tb - ta
  }), [jobs])
  const categoryJobs = useMemo(() => activeTab==='全部' ? (jobs||[]) : (jobs||[]).filter(j=>j.category===activeTab), [jobs, activeTab])
  const displayedJobs = useMemo(()=> (activeTab==='全部'? latestJobs : categoryJobs).slice(0, displayLimit), [activeTab, latestJobs, categoryJobs, displayLimit])

  return (
    <div className="min-h-screen landing-bg-page">
      {/* 新：渐变背景 + 前景SVG分层，文字使用安全区，避免遮挡 */}
      <div className="hero-gradient">
        <div className="hero-foreground"><img src={homeBgSvg} alt="illustration" /></div>
        <div className="hero-safe-content">
          <div className="title-wrap">
            <h1 className="landing-title">WORK YOUR BRAIN,<br /> LEAVE YOUR BODY TO BE HAPPY</h1>
            <p className="landing-subtitle">Open to the world · Remote jobs · Global opportunities</p>
          </div>
          <div className="landing-search mt-4">
            <div className="landing-search-bar">
              <Search className="w-5 h-5 text-gray-500" />
              <input className="landing-search-input" placeholder="Search for remote jobs..." />
              <button onClick={() => navigate('/jobs')} className="landing-explore">
                <span>Explore Jobs</span>
              </button>
            </div>
            
          </div>
          {/* Feature strip */}
          <div className="feature-strip">
            <div className="feature-item"><div className="icon">⚡</div><div className="text">日更数千个远程岗位</div></div>
            <div className="feature-item"><div className="icon">🤖</div><div className="text">AI为你求职保驾护航</div></div>
            <div className="feature-item"><div className="icon">🌍</div><div className="text">全球岗位、全行业覆盖</div></div>
          </div>
        </div>
        
      </div>

      <section className="container-fluid section-padding list-section">
        <div className="landing-hero">
          <div className="mt-4 w-full">
            {loading ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#3182CE]"></div></div>
              ) : error ? (
              <div className="text-center py-12 text-red-600">{String(error)}</div>
            ) : displayedJobs.length === 0 ? (
              <div className="text-center py-16 text-gray-600">暂无匹配的职位</div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex gap-2 overflow-x-auto whitespace-nowrap py-1" role="tablist" aria-label="岗位分类切换">
                    {dynamicTabs.map(tab => {
                      const isActive = activeTab === tab
                      const count = tab === '全部' ? (jobs||[]).length : (jobs||[]).filter(j=>j.category===tab).length
                      return (
                        <button key={tab} onClick={()=>setActiveTab(tab)} className={`tab-pill ${isActive ? 'active' : ''}`} role="tab" aria-selected={isActive}>
                          {tab}{count ? `（${count}）` : ''}
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-sm text-gray-500">共 {(jobs||[]).length} 个职位</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-10 mt-2">
                  {displayedJobs.map(job => (
                    <JobCard key={job.id} job={job} onClick={()=>navigate(`/job/${job.id}`)} />
                  ))}
                </div>
                {displayedJobs.length < (activeTab==='全部'? latestJobs.length : categoryJobs.length) && (
                  <div className="flex justify-center"><button onClick={()=>setDisplayLimit(dl=>dl+24)} className="text-sm font-medium text-gray-600 hover:text-gray-900">加载更多</button></div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 页脚由全局 Footer 统一渲染，这里不重复 */}
    </div>
  )
}