import { useState, useEffect, useMemo } from 'react'
import { Search, Filter, ChevronDown, MapPin, Clock, DollarSign, Users, Briefcase, TrendingUp, Star, Bookmark, Building, Calendar, AlertTriangle } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import JobCard from '../components/JobCard'
import JobFilter from '../components/JobFilter'
import JobDetailModal from '../components/JobDetailModal'
import SearchBar from '../components/SearchBar'
import FilterDropdown from '../components/FilterDropdown'
import RSSStatusIndicator from '../components/RSSStatusIndicator'
import NotificationProvider from '../components/NotificationSystem'
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
  
  // State management
  const [jobs, setJobs] = useState<Job[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    jobType: 'all',
    salary: 'all',
    location: 'all'
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)

  // Filter options
  const jobTypeOptions = [
    { value: 'all', label: '全部类型' },
    { value: 'full-time', label: '全职', count: 45 },
    { value: 'contract', label: '合同工', count: 23 },
    { value: 'part-time', label: '兼职', count: 12 }
  ]

  const salaryOptions = [
    { value: 'all', label: '全部薪资' },
    { value: '0-50000', label: '$0 - $50K', count: 15 },
    { value: '50000-80000', label: '$50K - $80K', count: 32 },
    { value: '80000-120000', label: '$80K - $120K', count: 28 },
    { value: '120000+', label: '$120K+', count: 18 }
  ]

  const locationOptions = [
    { value: 'all', label: '全部地区' },
    { value: 'remote-global', label: '全球远程', count: 56 },
    { value: 'remote-us', label: '美国远程', count: 34 },
    { value: 'remote-eu', label: '欧洲远程', count: 23 },
    { value: 'remote-asia', label: '亚洲远程', count: 12 }
  ]

  // Load jobs data
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLoading(true)
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000))
        setJobs(mockJobs)
        setError(null)
      } catch (err) {
        setError('加载职位信息失败，请稍后重试')
      } finally {
        setLoading(false)
      }
    }

    loadJobs()
  }, [])

  // Filter jobs based on search and filters
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        const matchesSearch = 
          job.title.toLowerCase().includes(searchLower) ||
          job.company.toLowerCase().includes(searchLower) ||
          job.skills.some(skill => skill.toLowerCase().includes(searchLower)) ||
          job.description.toLowerCase().includes(searchLower)
        
        if (!matchesSearch) return false
      }

      // Job type filter
      if (filters.jobType !== 'all' && job.type !== filters.jobType) {
        return false
      }

      // Salary filter
      if (filters.salary !== 'all') {
        const [min, max] = filters.salary.split('-').map(s => s.replace('+', '').replace('$', '').replace('K', '000'))
        const jobSalaryMin = job.salary?.min || 0
        const jobSalaryMax = job.salary?.max || 0
        
        if (filters.salary.includes('+')) {
          if (jobSalaryMin < parseInt(min)) return false
        } else {
          if (jobSalaryMin < parseInt(min) || jobSalaryMax > parseInt(max)) return false
        }
      }

      // Location filter
      if (filters.location !== 'all') {
        const locationMap: { [key: string]: string[] } = {
          'remote-global': ['Remote - Global', 'Global Remote'],
          'remote-us': ['Remote - US', 'US Remote'],
          'remote-eu': ['Remote - EU', 'EU Remote'],
          'remote-asia': ['Remote - Asia', 'Asia Remote']
        }
        
        const allowedLocations = locationMap[filters.location] || []
        if (!allowedLocations.some(loc => job.location.includes(loc))) {
          return false
        }
      }

      return true
    })
  }, [jobs, searchTerm, filters])

  const handleApply = (jobId: string) => {
    const job = jobs.find(j => j.id === jobId)
    if (job) {
      navigate(`/job/${jobId}/apply`, {
        state: { job, previousPath: '/' }
      })
    }
  }

  const openJobDetail = (job: Job) => {
    setSelectedJob(job)
    setIsJobDetailOpen(true)
  }

  const closeJobDetail = () => {
    setSelectedJob(null)
    setIsJobDetailOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="mb-4">
            <span className="inline-block px-4 py-2 bg-haigoo-primary/10 text-haigoo-primary text-sm font-medium rounded-full">
              够快、够广、够理想
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Haigoo 帮你找到理想的远程工作
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            专业的远程工作求职工具，精准匹配优质职位
          </p>
        </div>

        {/* 搜索和筛选区域 */}
        <div className="mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            <div className="flex-1">
              <SearchBar 
                value={searchTerm}
                onChange={setSearchTerm}
                onSearch={(query) => setSearchTerm(query)}
                placeholder="搜索职位、公司或技能..."
                className="w-full"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterDropdown
                label="工作类型"
                options={jobTypeOptions}
                selectedValues={filters.jobType === 'all' ? [] : [filters.jobType]}
                onChange={(values) => setFilters(prev => ({ ...prev, jobType: values.length > 0 ? values[0] : 'all' }))}
                multiple={false}
              />
              <FilterDropdown
                label="薪资范围"
                options={salaryOptions}
                selectedValues={filters.salary === 'all' ? [] : [filters.salary]}
                onChange={(values) => setFilters(prev => ({ ...prev, salary: values.length > 0 ? values[0] : 'all' }))}
                multiple={false}
              />
              <FilterDropdown
                label="地点"
                options={locationOptions}
                selectedValues={filters.location === 'all' ? [] : [filters.location]}
                onChange={(values) => setFilters(prev => ({ ...prev, location: values.length > 0 ? values[0] : 'all' }))}
                multiple={false}
              />
            </div>
          </div>
        </div>

        {/* 职位列表 */}
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {/* 改进的加载状态 */}
              <div className="text-center py-8">
                <div className="inline-flex items-center space-x-2 text-gray-600">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-haigoo-primary"></div>
                  <span>正在加载最新职位信息...</span>
                </div>
              </div>
              {/* 骨架屏 */}
              {[...Array(3)].map((_, index) => (
                <div key={index} className="card p-6 animate-pulse">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                      <div className="w-8 h-8 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                    <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="h-6 bg-gray-200 rounded w-16"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">加载失败</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary px-6 py-2"
              >
                重新加载
              </button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">未找到匹配的职位</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || Object.values(filters).some(f => f !== 'all') 
                  ? '尝试调整搜索条件或筛选器' 
                  : '暂时没有可用的职位信息'
                }
              </p>
              {(searchTerm || Object.values(filters).some(f => f !== 'all')) && (
                <button
                  onClick={() => {
                    setSearchTerm('')
                    setFilters({ jobType: 'all', salary: 'all', location: 'all' })
                  }}
                  className="btn-secondary px-6 py-2"
                >
                  清除筛选条件
                </button>
              )}
            </div>
          ) : (
            <>
              {/* 结果统计 */}
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                  找到 <span className="font-semibold text-gray-900">{filteredJobs.length}</span> 个职位
                  {searchTerm && (
                    <span> 包含 "<span className="font-semibold">{searchTerm}</span>"</span>
                  )}
                </p>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span>实时更新</span>
                </div>
              </div>

              {/* 职位卡片列表 */}
              <div className="space-y-4">
                 {filteredJobs.map((job) => (
                   <JobCard 
                     key={job.id} 
                     job={job} 
                     onClick={openJobDetail}
                     isSaved={savedJobs.has(job.id)}
                     onSave={(jobId: string) => {
                       setSavedJobs(prev => {
                         const newSet = new Set(prev)
                         if (newSet.has(jobId)) {
                           newSet.delete(jobId)
                         } else {
                           newSet.add(jobId)
                         }
                         return newSet
                       })
                     }}
                   />
                 ))}
               </div>

               {/* 加载更多按钮 */}
               {filteredJobs.length >= 20 && (
                 <div className="text-center pt-8">
                   <button className="btn-secondary px-8 py-3">
                     加载更多职位
                   </button>
                 </div>
               )}
             </>
           )}
         </div>
       </main>

       {/* RSS状态指示器 */}
       <RSSStatusIndicator />

       {/* 职位详情模态框 */}
       {isJobDetailOpen && selectedJob && (
         <JobDetailModal
           job={selectedJob}
           isOpen={isJobDetailOpen}
           onClose={closeJobDetail}
           onApply={handleApply}
           isSaved={savedJobs.has(selectedJob.id)}
           onSave={(jobId: string) => {
             setSavedJobs(prev => {
               const newSet = new Set(prev)
               if (newSet.has(jobId)) {
                 newSet.delete(jobId)
               } else {
                 newSet.add(jobId)
               }
               return newSet
             })
           }}
         />
       )}
    </div>
  )
}