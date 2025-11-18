import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
// 搜索图标暂不使用，已按图2样式重构
import JobCard from '../components/JobCard'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import '../styles/landing.css'
import JobAlertSubscribe from '../components/JobAlertSubscribe'
import homeBgSvg from '../assets/home_bg.svg'

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('全部')
  const [displayLimit, setDisplayLimit] = useState<number>(24)
  const [titleQuery, setTitleQuery] = useState<string>('')
  const [locationQuery, setLocationQuery] = useState<string>('')
  const [typeQuery, setTypeQuery] = useState<string>('')
  const [showSubscribe, setShowSubscribe] = useState<boolean>(false)
  const membershipUrl: string = (import.meta as any).env?.VITE_MEMBERSHIP_FORM_URL || '/club/apply'

  const { data: jobs, loading, error } = usePageCache<Job[]>('landing-all-jobs-v2', {
    fetcher: async () => await processedJobsService.getAllProcessedJobsFull(100),
    ttl: 0,
    persist: false,
    namespace: 'landing'
  })
  const { data: fallbackJobs } = usePageCache<Job[]>('landing-fallback-jobs', {
    fetcher: async () => await processedJobsService.getAllProcessedJobs(200),
    ttl: 60000,
    persist: false,
    namespace: 'landing'
  })

  // categories 仅用于 Top6 逻辑，后续可复用

  // 地点别名与分词函数：将“中国, 美国 / Europe | Remote”等拆分为独立关键词
  const normalizeLocation = (raw: string) => {
    const s = (raw || '').trim().toLowerCase()
    const map: Record<string,string> = {
      'china': '中国', 'mainland china': '中国', 'cn': '中国', '中国': '中国',
      'usa': '美国', 'united states': '美国', 'u.s.': '美国', 'us': '美国', 'america': '美国', '美国': '美国',
      'remote': '远程', 'anywhere': '远程', 'worldwide': '全球', 'world wide': '全球', 'global': '全球', 'remote-friendly': '远程', '远程': '远程',
      'europe': '欧洲', 'eu': '欧洲', '欧洲': '欧洲',
      'uk': '英国', 'united kingdom': '英国', 'britain': '英国', 'england': '英国', '英国': '英国',
      'canada': '加拿大', 'ca': '加拿大', '加拿大': '加拿大'
    }
    return map[s] || raw.trim()
  }

  const tokenizeLocations = (location: string): string[] => {
    if (!location) return []
    // 按常见分隔符拆分
    const parts = location
      .split(/[,/|;、，·•\-–—\s]+/)
      .map(p => normalizeLocation(p))
      .filter(Boolean)
    // 去重
    const set = new Set<string>()
    parts.forEach(p => set.add(p))
    return Array.from(set)
  }

  // 聚合地点选项（去重、按出现次数排序，最多50项）
  const sourceJobs = useMemo(() => {
    const primary = jobs || []
    return primary.length > 0 ? primary : (fallbackJobs || [])
  }, [jobs, fallbackJobs])

  const locationOptions = useMemo(() => {
    const counter = new Map<string, number>()
    ;(sourceJobs || []).forEach(j => {
      tokenizeLocations(j.location || '').forEach(loc => {
        counter.set(loc, (counter.get(loc) || 0) + 1)
      })
    })
    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([loc]) => loc)
      .slice(0, 50)
  }, [sourceJobs])

  const dynamicTabs = useMemo(() => {
    const counts: Record<string, number> = {}
    ;(sourceJobs || []).forEach(j => { if (j.category) counts[j.category] = (counts[j.category]||0)+1 })
    const top = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,6)
    return ['全部', ...top]
  }, [sourceJobs])
  const latestJobs = useMemo(() => [...(sourceJobs || [])].sort((a,b)=>{
    const ta = new Date(a.postedAt || 0).getTime(); const tb = new Date(b.postedAt || 0).getTime(); return tb - ta
  }), [sourceJobs])
  const categoryJobs = useMemo(() => activeTab==='全部' ? (sourceJobs||[]) : (sourceJobs||[]).filter(j=>j.category===activeTab), [sourceJobs, activeTab])

  // 在首页就地搜索，不跳转页面
  const searchedJobs = useMemo(() => {
    const t = titleQuery.trim().toLowerCase()
    const lNorm = normalizeLocation(locationQuery.trim().toLowerCase())
    const type = typeQuery.trim()
    return (activeTab==='全部' ? latestJobs : categoryJobs).filter(job => {
      const matchTitle = t === '' ||
        job.title?.toLowerCase().includes(t) ||
        (job.company || '').toLowerCase().includes(t) ||
        (job.skills || []).some(s => s.toLowerCase().includes(t))
      const tokens = tokenizeLocations(job.location || '')
      const matchLoc = lNorm === '' || tokens.some(tok => tok === lNorm || tok.toLowerCase().includes(lNorm.toLowerCase()))
      const matchType = type === '' || job.type === type
      return matchTitle && matchLoc && matchType
    })
  }, [latestJobs, categoryJobs, activeTab, titleQuery, locationQuery, typeQuery])

  const displayedJobs = useMemo(()=> searchedJobs.slice(0, displayLimit), [searchedJobs, displayLimit])

  // 即时筛选，无需按钮
  // 输入变化时已通过 searchedJobs 生效

  const clearAll = () => {
    setTitleQuery('')
    setLocationQuery('')
    setTypeQuery('')
    setActiveTab('全部')
    setDisplayLimit(24)
  }

  return (
    <div className="min-h-screen landing-bg-page">
      {/* 新：渐变背景 + 前景SVG分层，文字使用安全区，避免遮挡 */}
      <div className="hero-gradient">
        <div className="hero-foreground"><img src={homeBgSvg} alt="illustration" /></div>
        <div className="hero-safe-content">
          <div className="title-wrap">
            <h1 className="landing-title">WORK YOUR BRAIN,<br /> LEAVE YOUR BODY TO BE HAPPY</h1>
          </div>
          {/* Feature strip */}
          <div className="feature-strip">
            <div className="feature-item">日更数千个远程岗位</div>
            <div className="feature-item">AI为你求职保驾护航</div>
            <div className="feature-item">全球岗位、全行业覆盖</div>
          </div>
          {/* CTA：订阅岗位推送 / 加入社群 */}
          <div className="hero-cta">
            <div className="flex items-center gap-4">
              <button
                className="px-4 py-2 rounded-lg bg-[#3182CE] text-white font-semibold shadow-md hover:bg-[#256bb0]"
                onClick={()=>setShowSubscribe(s=>!s)}
                aria-expanded={showSubscribe}
              >
                订阅岗位推送
              </button>
              <a
                href={membershipUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-lg bg-white text-[#1A365D] font-semibold border border-[#E2E8F0] shadow-sm hover:bg-[#f7fafc]"
              >
                加入俱乐部社群
              </a>
            </div>
            <div className="mt-2">
              <JobAlertSubscribe variant="compact" />
            </div>
            <div className="cta-benefits">
              <span className="cta-chip">每日精选</span>
              <span className="cta-chip">优先内推</span>
              <span className="cta-chip">远程经验交流</span>
              <span className="cta-chip">职业指导</span>
            </div>
            {showSubscribe && (
              <div className="mt-3 max-w-xl">
                <JobAlertSubscribe />
              </div>
            )}
          </div>
        </div>
        
      </div>

      <section className="container-fluid section-padding-sm list-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 list-tight">
          {/* 搜索区：放置于岗位分类Tab上方，左对齐 */}
          <div className="mb-6">
            <div className="filter-fig2" role="search" aria-label="职位筛选">
              <span className="filter-label">筛选</span>
              <input className="filter-input" placeholder="岗位名称" value={titleQuery} onChange={(e)=>setTitleQuery(e.target.value)} />
              <select className="filter-select" value={locationQuery} onChange={(e)=>setLocationQuery(e.target.value)}>
                <option value="">所有地点</option>
                {locationOptions.map(loc => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
              <select className="filter-select" value={typeQuery} onChange={(e)=>setTypeQuery(e.target.value)}>
                <option value="">全部类型</option>
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
                <option value="contract">合同工</option>
                <option value="remote">远程</option>
              </select>
              <button onClick={clearAll} className="filter-clear">清除</button>
            </div>
          </div>
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
                      const count = tab === '全部' ? (sourceJobs||[]).length : (sourceJobs||[]).filter(j=>j.category===tab).length
                      return (
                        <button key={tab} onClick={()=>setActiveTab(tab)} className={`tab-pill ${isActive ? 'active' : ''}`} role="tab" aria-selected={isActive}>
                          {tab}{count ? `（${count}）` : ''}
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-sm text-gray-500">共 {(sourceJobs||[]).length} 个职位</div>
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