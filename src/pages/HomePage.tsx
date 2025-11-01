import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, ChevronDown, MapPin, Clock, DollarSign, Users, Briefcase, TrendingUp, Star, Bookmark, Building, Calendar } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import JobCard from '../components/JobCard'
import JobFilter from '../components/JobFilter'
import JobDetailModal from '../components/JobDetailModal'
import { Job, JobFilter as JobFilterType } from '../types'

// Import company logos
import techCorpLogo from '../assets/company-logos/techcorp-logo.svg'
import innovateIncLogo from '../assets/company-logos/innovate-inc-logo.svg'
import dataCoLogo from '../assets/company-logos/dataco-logo.svg'

// Company logos mapping
const companyLogos: { [key: string]: string } = {
  'TechCorp': techCorpLogo,
  'Innovate Inc.': innovateIncLogo,
  'DataCo': dataCoLogo
}

// Mock data for demonstration
const mockJobs: Job[] = [
  {
    id: '1',
    title: 'Senior Product Designer',
    company: 'TechCorp',
    location: 'Remote - Global',
    type: 'full-time',
    salary: { min: 60000, max: 90000, currency: 'USD' },
    description: 'We are looking for a talented UI/UX designer to join our team. You will be responsible for creating user-friendly interfaces and improving user experience.',
    requirements: ['Figma', 'Sketch', 'Adobe XD'],
    responsibilities: ['Design user interfaces', 'Create prototypes', 'Conduct user research'],
    skills: ['UI/UX', 'Figma', 'Prototyping'],
    postedAt: '2024-01-15',
    expiresAt: '2024-02-15',
    source: 'Dribbble',
    sourceUrl: 'https://dribbble.com'
  },
  {
    id: '2',
    title: 'Lead Software Engineer',
    company: 'Innovate Inc.',
    location: 'Remote - US',
    type: 'contract',
    salary: { min: 80000, max: 120000, currency: 'USD' },
    description: 'Join our engineering team to build scalable web applications using modern technologies.',
    requirements: ['React', 'Node.js', 'AWS'],
    responsibilities: ['Lead development team', 'Architect solutions', 'Code review'],
    skills: ['React', 'Node.js', 'AWS'],
    postedAt: '2024-01-14',
    expiresAt: '2024-02-14',
    source: 'LinkedIn',
    sourceUrl: 'https://linkedin.com'
  },
  {
    id: '3',
    title: 'Data Scientist',
    company: 'DataCo',
    location: 'Remote - EU',
    type: 'full-time',
    salary: { min: 70000, max: 100000, currency: 'USD' },
    description: 'Analyze complex datasets and build machine learning models to drive business insights.',
    requirements: ['Python', 'Machine Learning', 'SQL'],
    responsibilities: ['Data analysis', 'Model building', 'Business insights'],
    skills: ['Python', 'Machine Learning', 'SQL'],
    postedAt: '2024-01-13',
    expiresAt: '2024-02-13',
    source: 'AngelList',
    sourceUrl: 'https://angel.co'
  }
]

export default function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  const handleApply = (jobId: string) => {
    console.log('Apply button clicked for job:', jobId)
    const job = jobs.find(j => j.id === jobId) || null
    // 保存首页当前快照，返回时直接恢复，避免背景闪烁
    try {
      sessionStorage.setItem('HOME_PAGE_SNAPSHOT', JSON.stringify({
        jobs,
        filters,
        savedJobs: Array.from(savedJobs),
        selectedJob: job,
        isJobDetailOpen: true
      }))
    } catch (e) {
      console.warn('Failed to save home snapshot:', e)
    }
    console.log('Navigating to:', `/job/${jobId}/apply`)
    navigate(`/job/${jobId}/apply`, {
      state: {
        job: job || undefined,
        previousPath: '/',
        returnToModal: true
      }
    })
  }

  const [jobs, setJobs] = useState<Job[]>([])
  const [filters, setFilters] = useState<JobFilterType>({
    search: '',
    type: '',
    salaryMin: 0,
    salaryMax: 0,
    skills: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState('relevance')
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())

  // 根据 location.state 初始化模态与选中岗位，避免首次渲染闪烁
  const initialNavState = location.state as any
  const [selectedJob, setSelectedJob] = useState<Job | null>(initialNavState?.job ?? null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState<boolean>(Boolean(initialNavState?.reopenJobDetail && initialNavState?.job))
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

  // 处理从AI优化页面返回时重新打开模态框（后备：仅有jobId时）
  useEffect(() => {
    const state = location.state as any
    // 优先：若存在快照，直接恢复，避免背景刷新
    try {
      const snapStr = sessionStorage.getItem('HOME_PAGE_SNAPSHOT')
      if (state?.reopenJobDetail && snapStr) {
        const snap = JSON.parse(snapStr)
        if (Array.isArray(snap.jobs)) setJobs(snap.jobs)
        if (Array.isArray(snap.savedJobs)) setSavedJobs(new Set(snap.savedJobs))
        setSelectedJob(snap.selectedJob || state.job || null)
        setIsJobDetailOpen(true)
        setIsLoading(false)
        sessionStorage.removeItem('HOME_PAGE_SNAPSHOT')
        navigate(location.pathname, { replace: true, state: {} })
        return
      }
    } catch (e) {
      console.warn('Failed to restore home snapshot:', e)
    }

    if (!isJobDetailOpen && state?.reopenJobDetail && state?.jobId && !state?.job) {
      const job = jobs.find(j => j.id === state.jobId)
      if (job) {
        setSelectedJob(job)
        setIsJobDetailOpen(true)
        // 清除状态，避免重复触发
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
    // 如果传递了完整job对象，初始化后立即清除state，避免重复打开
    if (state?.job && state?.reopenJobDetail) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state, jobs, navigate, location.pathname, isJobDetailOpen])

  // Memoize filtered jobs for better performance
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = !filters.search || 
        job.title.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.company.toLowerCase().includes(filters.search.toLowerCase()) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(filters.search.toLowerCase()))
      
      const matchesType = !filters.type || job.type === filters.type
      
      const matchesSalary = (!filters.salaryMin || job.salary.min >= filters.salaryMin) &&
        (!filters.salaryMax || job.salary.max <= filters.salaryMax)
      
      const matchesSkills = filters.skills.length === 0 || 
        filters.skills.some((skill: string) => job.skills.some((jobSkill: string) => 
          jobSkill.toLowerCase().includes(skill.toLowerCase())
        ))
      
      return matchesSearch && matchesType && matchesSalary && matchesSkills
    })
  }, [jobs, filters])

  useEffect(() => {
    // Simulate API call with faster loading
    const timer = setTimeout(() => {
      setJobs(mockJobs)
      setIsLoading(false)
    }, 500) // Reduced from 1000ms to 500ms

    return () => clearTimeout(timer)
  }, [])

  const toggleSaveJob = (jobId: string) => {
     setSavedJobs(prev => {
       const newSet = new Set(prev)
       if (newSet.has(jobId)) {
         newSet.delete(jobId)
       } else {
         newSet.add(jobId)
       }
       return newSet
     })
   }

   const openJobDetail = (job: Job) => {
     console.log('Opening job detail for:', job.title, job.id)
     const jobIndex = filteredJobs.findIndex(j => j.id === job.id)
     setCurrentJobIndex(jobIndex >= 0 ? jobIndex : 0)
     setSelectedJob(job)
     setIsJobDetailOpen(true)
   }

   const closeJobDetail = () => {
     setIsJobDetailOpen(false)
     setSelectedJob(null)
   }

   const handleNavigateJob = (direction: 'prev' | 'next') => {
     if (direction === 'prev' && currentJobIndex > 0) {
       const newIndex = currentJobIndex - 1
       setCurrentJobIndex(newIndex)
       setSelectedJob(filteredJobs[newIndex])
     } else if (direction === 'next' && currentJobIndex < filteredJobs.length - 1) {
       const newIndex = currentJobIndex + 1
       setCurrentJobIndex(newIndex)
       setSelectedJob(filteredJobs[newIndex])
     }
   }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Main Content */}
      <main className="px-6 md:px-10 lg:px-20 py-10 flex flex-1 justify-center">
        <div className="layout-content-container flex flex-col max-w-7xl w-full flex-1 gap-8">
          {/* Hero Section - Tool-focused */}
          <div className="flex flex-wrap justify-between items-center gap-6">
            <div className="flex min-w-72 flex-col gap-2">
              <div className="mb-2">
                <span className="inline-block px-3 py-1 bg-haigoo-primary/10 text-haigoo-primary text-xs font-medium rounded-full">
                  够快、够广、够理想
                </span>
              </div>
              <p className="text-zinc-800 dark:text-zinc-100 text-4xl font-black leading-tight tracking-[-0.033em]">
                Haigoo 帮你找到理想的远程工作
              </p>
              <p className="text-zinc-500 dark:text-zinc-400 text-base font-normal leading-normal">
                专业的远程工作求职工具，精准匹配优质职位
              </p>
            </div>
            
            {/* Search Bar - Integrated into header */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-zinc-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜索职位、公司或技能..."
                  value={filters.search}
                  onChange={(e) => setFilters((prev: JobFilterType) => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-12 pr-4 py-3 text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 placeholder-zinc-500 dark:placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-haigoo-primary/50 focus:border-haigoo-primary shadow-sm"
                />
              </div>
            </div>
          </div>

          {/* Filter Buttons */}
          <div className="flex gap-3 flex-wrap items-center">
            <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-zinc-800 pl-4 pr-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <p className="text-sm font-medium leading-normal">工作类型</p>
              <ChevronDown className="h-4 w-4" />
            </button>
            <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-zinc-800 pl-4 pr-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <p className="text-sm font-medium leading-normal">经验要求</p>
              <ChevronDown className="h-4 w-4" />
            </button>
            <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-zinc-800 pl-4 pr-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <p className="text-sm font-medium leading-normal">薪资范围</p>
              <ChevronDown className="h-4 w-4" />
            </button>
            <div className="flex-grow"></div>
            <button className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-lg bg-white dark:bg-zinc-800 pl-4 pr-3 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <p className="text-sm font-medium leading-normal">排序: 相关性</p>
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Job Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {isLoading ? (
              // Loading skeleton
              [...Array(6)].map((_, i) => (
                <div key={i} className="group relative bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-xl transition-all duration-300 animate-pulse">
                  <div className="p-6">
                    {/* Company Logo Skeleton */}
                    <div className="w-16 h-16 bg-zinc-200 dark:bg-zinc-700 rounded-xl mb-4"></div>
                    
                    {/* Content Skeleton */}
                    <div className="space-y-3">
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3"></div>
                      <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-4/5"></div>
                      <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3"></div>
                      <div className="flex gap-2 mt-4">
                        <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-16"></div>
                        <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-20"></div>
                        <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded w-14"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
               filteredJobs.map((job) => (
                 <div 
                   key={job.id} 
                   className="group relative bg-white dark:bg-zinc-900/80 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm hover:shadow-xl hover:border-haigoo-primary/20 dark:hover:border-haigoo-primary/30 transition-all duration-300 cursor-pointer overflow-hidden"
                   onClick={() => openJobDetail(job)}
                 >
                   {/* Gradient overlay for visual appeal */}
                   <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-haigoo-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                   
                   <div className="relative p-6">
                     {/* Header with Company Logo and Save Button */}
                     <div className="flex items-start justify-between mb-4">
                       <div className="flex items-center gap-4">
                         {/* Company Logo */}
                         <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-br from-haigoo-primary/10 to-haigoo-secondary/10 flex items-center justify-center flex-shrink-0">
                           {companyLogos[job.company] ? (
                             <img 
                               src={companyLogos[job.company]} 
                               alt={`${job.company} logo`}
                               className="w-full h-full object-cover"
                               loading="lazy"
                             />
                           ) : (
                             <span className="text-xl font-bold text-haigoo-primary">
                               {job.company.charAt(0)}
                             </span>
                           )}
                         </div>
                         
                         {/* Company and Job Type */}
                         <div className="flex-1 min-w-0">
                           <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-1">{job.company}</p>
                           <div className="flex items-center gap-2">
                             <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                               job.type === 'full-time' 
                                 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                 : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                             }`}>
                               {job.type === 'full-time' ? '全职' : '合同'}
                             </span>
                           </div>
                         </div>
                       </div>
                       
                       {/* Save Button */}
                       <button 
                         onClick={(e) => {
                           e.stopPropagation()
                           toggleSaveJob(job.id)
                         }}
                         className="flex items-center justify-center w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors opacity-0 group-hover:opacity-100"
                       >
                         <Bookmark className={`h-4 w-4 ${savedJobs.has(job.id) ? 'text-haigoo-primary fill-current' : 'text-zinc-500 dark:text-zinc-400'}`} />
                       </button>
                     </div>

                     {/* Job Title */}
                     <h3 className="text-zinc-900 dark:text-zinc-100 text-xl font-bold leading-tight mb-3 group-hover:text-haigoo-primary transition-colors">
                       {job.title}
                     </h3>

                     {/* Job Details */}
                     <div className="space-y-3 mb-6">
                       <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                         <MapPin className="h-4 w-4 flex-shrink-0" />
                         <span className="truncate">{job.location}</span>
                       </div>
                       
                       <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 text-sm">
                         <DollarSign className="h-4 w-4 flex-shrink-0" />
                         <span className="font-medium text-zinc-800 dark:text-zinc-200">
                           ${job.salary.min.toLocaleString()} - ${job.salary.max.toLocaleString()}
                         </span>
                       </div>
                     </div>

                     {/* Skills Tags */}
                     <div className="flex flex-wrap gap-2 mb-6">
                       {job.skills.slice(0, 3).map((skill, index) => (
                         <span 
                           key={index} 
                           className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-haigoo-primary/10 text-haigoo-primary border border-haigoo-primary/20"
                         >
                           {skill}
                         </span>
                       ))}
                       {job.skills.length > 3 && (
                         <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                           +{job.skills.length - 3}
                         </span>
                       )}
                     </div>

                     {/* Apply Button */}
                     <button 
                       onClick={(e) => {
                         console.log('Apply button clicked - preventing default and stopping propagation')
                         e.preventDefault()
                         e.stopPropagation()
                         handleApply(job.id)
                       }}
                       className="w-full h-12 bg-haigoo-primary hover:bg-haigoo-primary/90 text-white font-semibold rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:shadow-md"
                     >
                       立即申请
                     </button>
                   </div>
                 </div>
               ))
             )}
          </div>

          {/* Load More Button */}
          {!isLoading && filteredJobs.length > 0 && (
            <div className="text-center">
              <button className="px-8 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 rounded-lg font-medium hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
                加载更多职位
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Job Detail Modal */}
      {isJobDetailOpen && selectedJob && (
        <JobDetailModal 
          job={selectedJob} 
          isOpen={isJobDetailOpen}
          onClose={closeJobDetail}
          onSave={() => toggleSaveJob(selectedJob.id)}
          isSaved={savedJobs.has(selectedJob.id)}
          onApply={handleApply}
          jobs={filteredJobs}
          currentJobIndex={currentJobIndex}
          onNavigateJob={handleNavigateJob}
        />
      )}
    </div>
  )
}