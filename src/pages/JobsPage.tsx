import { useState, useEffect, useRef } from 'react'
import { Search, MapPin, Building, DollarSign, Bookmark, Calendar, Briefcase } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import JobDetailModal from '../components/JobDetailModal'
import JobCard from '../components/JobCard'
import { Job } from '../types'
import { jobAggregator } from '../services/job-aggregator'
import { Job as RSSJob } from '../types/rss-types'
import { DateFormatter } from '../utils/date-formatter'

// 转换RSS Job类型到页面Job类型的函数
const convertRSSJobToPageJob = (rssJob: RSSJob): Job => {
  // 处理薪资信息 - 统一薪资格式
  let salary = {
    min: 0,
    max: 0,
    currency: 'USD'
  };
  
  if (rssJob.salary) {
    if (typeof rssJob.salary === 'string') {
      // 尝试从字符串中解析薪资信息
      const salaryMatch = rssJob.salary.match(/(\d+(?:,\d+)*(?:\.\d+)?)\s*[-–—到至]\s*(\d+(?:,\d+)*(?:\.\d+)?)/);
      if (salaryMatch) {
        salary.min = parseInt(salaryMatch[1].replace(/,/g, ''));
        salary.max = parseInt(salaryMatch[2].replace(/,/g, ''));
      } else {
        // 尝试解析单个数字
        const singleMatch = rssJob.salary.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
        if (singleMatch) {
          const amount = parseInt(singleMatch[1].replace(/,/g, ''));
          salary.min = amount;
          salary.max = amount;
        }
      }
      
      // 检测货币类型
      if (rssJob.salary.includes('¥') || rssJob.salary.includes('CNY') || rssJob.salary.includes('人民币')) {
        salary.currency = 'CNY';
      } else if (rssJob.salary.includes('$') || rssJob.salary.includes('USD')) {
        salary.currency = 'USD';
      } else if (rssJob.salary.includes('€') || rssJob.salary.includes('EUR')) {
        salary.currency = 'EUR';
      }
    }
  }

  // 处理发布日期
  let postedAt = '';
  if (rssJob.publishedAt) {
    try {
      const date = new Date(rssJob.publishedAt);
      if (!isNaN(date.getTime())) {
        postedAt = date.toISOString().split('T')[0];
      } else {
        postedAt = rssJob.publishedAt;
      }
    } catch {
      postedAt = rssJob.publishedAt || '';
    }
  }

  // 确定工作类型
  let jobType: Job['type'] = 'full-time';
  if (rssJob.jobType) {
    switch (rssJob.jobType) {
      case 'full-time':
        jobType = 'full-time';
        break;
      case 'part-time':
        jobType = 'part-time';
        break;
      case 'contract':
        jobType = 'contract';
        break;
      case 'freelance':
        jobType = 'freelance';
        break;
      case 'internship':
        jobType = 'internship';
        break;
      default:
        jobType = rssJob.isRemote ? 'remote' : 'full-time';
    }
  } else if (rssJob.isRemote) {
    jobType = 'remote';
  }

  return {
    id: rssJob.id,
    title: rssJob.title,
    company: rssJob.company,
    location: rssJob.location,
    type: jobType,
    salary,
    description: rssJob.description,
    requirements: rssJob.requirements || [],
    responsibilities: rssJob.benefits || [],
    skills: rssJob.tags || [],
    postedAt,
    expiresAt: '',
    source: rssJob.source,
    sourceUrl: rssJob.url,
    // RSS特有字段
    experienceLevel: rssJob.experienceLevel,
    category: rssJob.category,
    isRemote: rssJob.isRemote,
    remoteLocationRestriction: rssJob.remoteLocationRestriction
  }
}

const mockJobs: Job[] = [
  {
    id: '1',
    title: '高级前端工程师',
    company: '字节跳动',
    location: '北京/远程',
    type: 'remote',
    salary: {
      min: 25000,
      max: 40000,
      currency: 'CNY'
    },
    description: '负责公司核心产品的前端开发工作，参与产品架构设计和技术选型。',
    requirements: ['3年以上前端开发经验', '熟练掌握React/Vue', '有大型项目经验'],
    responsibilities: ['负责前端架构设计', '参与产品需求分析', '代码审查和优化'],
    skills: ['React', 'Vue', 'TypeScript', 'JavaScript'],
    postedAt: '2024-01-15',
    expiresAt: '2024-02-15',
    source: 'Haigoo',
    sourceUrl: 'https://haigoo.com/jobs/1'
  },
  {
    id: '2',
    title: 'React 开发工程师',
    company: '腾讯',
    location: '深圳/远程',
    type: 'remote',
    salary: {
      min: 20000,
      max: 35000,
      currency: 'CNY'
    },
    description: '参与微信生态相关产品的前端开发，负责用户界面的设计和实现。',
    requirements: ['熟练使用React', 'TypeScript经验', '移动端开发经验'],
    responsibilities: ['开发微信生态产品', '用户界面设计', '性能优化'],
    skills: ['React', 'TypeScript', 'Mobile Development'],
    postedAt: '2024-01-14',
    expiresAt: '2024-02-14',
    source: 'Haigoo',
    sourceUrl: 'https://haigoo.com/jobs/2'
  },
  {
    id: '3',
    title: 'UI/UX 设计师',
    company: '小红书',
    location: '上海',
    type: 'full-time',
    salary: {
      min: 18000,
      max: 30000,
      currency: 'CNY'
    },
    description: '负责产品的用户体验设计，包括界面设计、交互设计等。',
    requirements: ['3年以上设计经验', '熟练使用Figma/Sketch', '有移动端设计经验'],
    responsibilities: ['用户体验设计', '界面设计', '交互设计'],
    skills: ['Figma', 'Sketch', 'UI Design', 'UX Design'],
    postedAt: '2024-01-13',
    expiresAt: '2024-02-13',
    source: 'Haigoo',
    sourceUrl: 'https://haigoo.com/jobs/3'
  },
  {
    id: '4',
    title: '全栈工程师（兼职）',
    company: '创新科技',
    location: '全球远程',
    type: 'part-time',
    salary: {
      min: 200,
      max: 400,
      currency: 'CNY'
    },
    description: '参与创新项目的全栈开发，包括前端、后端和数据库设计。',
    requirements: ['全栈开发经验', 'Node.js/Python', '数据库设计能力'],
    responsibilities: ['全栈开发', '数据库设计', '项目架构'],
    skills: ['Node.js', 'Python', 'Database Design', 'Full Stack'],
    postedAt: '2024-01-12',
    expiresAt: '2024-02-12',
    source: 'Haigoo',
    sourceUrl: 'https://haigoo.com/jobs/4'
  }
]

const jobTypes = [
  { value: 'all', label: '全部类型' },
  { value: 'full-time', label: '全职' },
  { value: 'part-time', label: '兼职' },
  { value: 'contract', label: '合同工' },
  { value: 'freelance', label: '自由职业' },
  { value: 'internship', label: '实习' }
]

const jobCategories = [
  { value: 'all', label: '全部岗位' },
  { value: '软件开发', label: '软件开发' },
  { value: '前端开发', label: '前端开发' },
  { value: '后端开发', label: '后端开发' },
  { value: '全栈开发', label: '全栈开发' },
  { value: 'DevOps', label: 'DevOps' },
  { value: '数据科学', label: '数据科学' },
  { value: '数据分析', label: '数据分析' },
  { value: '产品管理', label: '产品管理' },
  { value: '项目管理', label: '项目管理' },
  { value: 'UI/UX设计', label: 'UI/UX设计' },
  { value: '平面设计', label: '平面设计' },
  { value: '市场营销', label: '市场营销' },
  { value: '数字营销', label: '数字营销' },
  { value: '销售', label: '销售' },
  { value: '客户服务', label: '客户服务' },
  { value: '客户支持', label: '客户支持' },
  { value: '人力资源', label: '人力资源' },
  { value: '财务', label: '财务' },
  { value: '法律', label: '法律' },
  { value: '写作', label: '写作' },
  { value: '内容创作', label: '内容创作' },
  { value: '质量保证', label: '质量保证' },
  { value: '测试', label: '测试' },
  { value: '运营', label: '运营' },
  { value: '商务拓展', label: '商务拓展' },
  { value: '咨询', label: '咨询' },
  { value: '教育培训', label: '教育培训' },
  { value: '其他', label: '其他' }
]

const experienceLevels = [
  { value: 'all', label: '全部经验' },
  { value: 'Entry', label: '入门级' },
  { value: 'Mid', label: '中级' },
  { value: 'Senior', label: '高级' },
  { value: 'Lead', label: '技术负责人' },
  { value: 'Executive', label: '管理层' }
]

const locations = [
  { value: 'all', label: '全部地点' },
  { value: '北京', label: '北京' },
  { value: '上海', label: '上海' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '广州', label: '广州' },
  { value: '成都', label: '成都' },
  { value: '西安', label: '西安' },
  { value: '南京', label: '南京' },
  { value: '武汉', label: '武汉' },
  { value: '苏州', label: '苏州' },
  { value: 'Remote', label: '远程工作' },
  { value: 'Worldwide', label: '全球远程' }
]

const remoteOptions = [
  { value: 'all', label: '全部' },
  { value: 'yes', label: '仅远程' },
  { value: 'no', label: '非远程' }
]

export default function JobsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Refs for focus management
  const searchInputRef = useRef<HTMLInputElement>(null)
  const filterSectionRef = useRef<HTMLDivElement>(null)
  const jobListRef = useRef<HTMLDivElement>(null)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    location: 'all',
    experience: 'all',
    remote: 'all'
  })
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isJobDetailOpen, setIsJobDetailOpen] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [currentJobIndex, setCurrentJobIndex] = useState(0)

  // Keyboard navigation handler
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      if (isJobDetailOpen) {
        closeJobDetail()
      }
    }
  }

  // Filter keyboard navigation
  const handleFilterKeyDown = (event: React.KeyboardEvent, filterType: string, value: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setFilters(prev => ({ ...prev, [filterType]: value }))
    }
  }

  // Clear filters keyboard handler
  const handleClearFiltersKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setFilters({
        type: 'all',
        category: 'all',
        location: 'all',
        experience: 'all',
        remote: 'all'
      })
    }
  }

  // 从URL参数中获取初始搜索词
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const search = params.get('search')
    if (search) {
      setSearchTerm(search)
    }
  }, [location.search])

  // 加载存储的职位数据
  useEffect(() => {
    const loadJobs = async () => {
      try {
        setLoading(true)
        
        // 等待一小段时间让jobAggregator初始化完成
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // 获取RSS岗位数据并转换为页面Job类型
        const rssJobs = jobAggregator.getJobs()
        console.log('获取到RSS岗位数据:', rssJobs.length, '个')
        
        if (rssJobs.length > 0) {
          // 转换RSS Job数据为页面Job类型
          const convertedJobs = rssJobs.map(convertRSSJobToPageJob)
          setJobs(convertedJobs)
          console.log('转换后的岗位数据:', convertedJobs.length, '个')
          console.log('示例岗位数据:', convertedJobs.slice(0, 2).map(job => ({
            title: job.title,
            company: job.company,
            description: job.description.substring(0, 100) + '...'
          })))
        } else {
          // 如果没有RSS数据，尝试触发同步
          console.log('没有找到RSS数据，尝试同步...')
          await jobAggregator.syncAllJobs()
          
          // 同步后再次获取数据
          const syncedJobs = jobAggregator.getJobs()
          if (syncedJobs.length > 0) {
            const convertedJobs = syncedJobs.map(convertRSSJobToPageJob)
            setJobs(convertedJobs)
            console.log('同步后获取到岗位数据:', convertedJobs.length, '个')
          } else {
            // 如果仍然没有数据，使用mock数据
            console.log('同步后仍无数据，使用mock数据')
            setJobs(mockJobs)
          }
        }
      } catch (error) {
        console.error('Failed to load jobs:', error)
        // 如果加载失败，使用mock数据作为后备
        setJobs(mockJobs)
      } finally {
        setLoading(false)
      }
    }

    loadJobs()
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

  const handleApply = (jobId: string) => {
    navigate(`/job/${jobId}/apply`)
  }

  // 筛选逻辑
  const filteredJobs = jobs.filter(job => {
    // 搜索匹配
    const matchesSearch = searchTerm === '' || 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase())))
    
    // 工作类型匹配
    const matchesType = filters.type === 'all' || job.type === filters.type
    
    // 岗位分类匹配 - 支持RSS数据的category字段和技能标签匹配
    const matchesCategory = filters.category === 'all' || 
      (job.category && job.category === filters.category) ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(filters.category.toLowerCase())))
    
    // 地点匹配 - 支持远程工作判断和RSS数据的isRemote字段
    const matchesLocation = filters.location === 'all' || 
      job.location.includes(filters.location) ||
      (filters.location === 'Remote' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.location === 'Worldwide' && (job.location.includes('全球') || job.location.includes('远程') || job.isRemote))
    
    // 经验等级匹配 - 支持RSS数据的experienceLevel字段
    const matchesExperience = filters.experience === 'all' || 
      (job.experienceLevel && job.experienceLevel === filters.experience)
    
    // 远程工作匹配 - 支持RSS数据的isRemote字段
    const matchesRemote = filters.remote === 'all' || 
      (filters.remote === 'yes' && (job.type === 'remote' || job.location.includes('远程') || job.isRemote)) ||
      (filters.remote === 'no' && !(job.type === 'remote' || job.location.includes('远程') || job.isRemote))
    
    return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesExperience && matchesRemote
  })

  const activeFiltersCount = Object.values(filters).filter(value => value !== 'all').length

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-x-hidden"
      onKeyDown={handleKeyDown}
      role="main"
      aria-label="职位搜索页面"
    >
      {/* 主内容区域 */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 页面标题与搜索 */}
          <header className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">全部岗位</h1>
            <p className="text-gray-600 text-sm">发现适合你的工作机会</p>
          </header>
          
          <div className="max-w-2xl mx-auto mb-6">
            <div className="relative">
              <Search 
                className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors duration-200" 
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索岗位、公司或地点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-haigoo-primary focus:border-transparent text-base bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md focus:shadow-lg transform hover:scale-[1.01] focus:scale-[1.01]"
                role="searchbox"
                aria-label="搜索职位"
                aria-describedby="search-help"
              />
              <div id="search-help" className="sr-only">
                输入关键词搜索职位、公司名称或工作地点
              </div>
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-6">
            {/* 侧边栏筛选 - 优化固定定位 */}
            <aside className="w-72 shrink-0" aria-label="职位筛选器">
              <div className="sticky top-24 w-72 h-[calc(100vh-120px)] will-change-transform">
                <div 
                  ref={filterSectionRef}
                  className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden h-full flex flex-col"
                  role="region"
                  aria-label="筛选条件"
                >
                  <div className="p-5 border-b border-gray-100">
                    <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-haigoo-primary rounded-full" aria-hidden="true"></div>
                      筛选条件
                    </h2>
                  </div>
                  
                  <div className="p-5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {/* 工作类型 */}
                    <fieldset className="mb-5">
                      <legend className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        工作类型
                      </legend>
                      <div className="space-y-2" role="radiogroup" aria-label="选择工作类型">
                        {jobTypes.map((type) => (
                          <label key={type.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="type"
                              value={type.value}
                              checked={filters.type === type.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                              onKeyDown={(e) => handleFilterKeyDown(e, 'type', type.value)}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                              aria-describedby={`type-${type.value}-desc`}
                            />
                            <span 
                              className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200"
                              id={`type-${type.value}-desc`}
                            >
                              {type.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* 岗位类别 */}
                    <fieldset className="mb-5">
                      <legend className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        岗位类别
                      </legend>
                      <div className="space-y-2" role="radiogroup" aria-label="选择岗位类别">
                        {jobCategories.map((category) => (
                          <label key={category.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="category"
                              value={category.value}
                              checked={filters.category === category.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                              onKeyDown={(e) => handleFilterKeyDown(e, 'category', category.value)}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                              aria-describedby={`category-${category.value}-desc`}
                            />
                            <span 
                              className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200"
                              id={`category-${category.value}-desc`}
                            >
                              {category.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* 工作地点 */}
                    <fieldset className="mb-5">
                      <legend className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        工作地点
                      </legend>
                      <div className="space-y-2" role="radiogroup" aria-label="选择工作地点">
                        {locations.map((location) => (
                          <label key={location.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="location"
                              value={location.value}
                              checked={filters.location === location.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                              onKeyDown={(e) => handleFilterKeyDown(e, 'location', location.value)}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                              aria-describedby={`location-${location.value}-desc`}
                            />
                            <span 
                              className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200"
                              id={`location-${location.value}-desc`}
                            >
                              {location.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* 经验等级 */}
                    <fieldset className="mb-5">
                      <legend className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        经验等级
                      </legend>
                      <div className="space-y-2" role="radiogroup" aria-label="选择经验等级">
                        {experienceLevels.map((level) => (
                          <label key={level.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="experience"
                              value={level.value}
                              checked={filters.experience === level.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, experience: e.target.value }))}
                              onKeyDown={(e) => handleFilterKeyDown(e, 'experience', level.value)}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                              aria-describedby={`experience-${level.value}-desc`}
                            />
                            <span 
                              className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200"
                              id={`experience-${level.value}-desc`}
                            >
                              {level.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* 远程工作 */}
                    <fieldset className="mb-5">
                      <legend className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        远程工作
                      </legend>
                      <div className="space-y-2" role="radiogroup" aria-label="选择远程工作选项">
                        {remoteOptions.map((option) => (
                          <label key={option.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="remote"
                              value={option.value}
                              checked={filters.remote === option.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, remote: e.target.value }))}
                              onKeyDown={(e) => handleFilterKeyDown(e, 'remote', option.value)}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                              aria-describedby={`remote-${option.value}-desc`}
                            />
                            <span 
                              className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200"
                              id={`remote-${option.value}-desc`}
                            >
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>

                    {/* 清除筛选按钮 */}
                    {activeFiltersCount > 0 && (
                      <button
                        onClick={() => {
                          setFilters({
                            type: 'all',
                            category: 'all',
                            location: 'all',
                            experience: 'all',
                            remote: 'all'
                          });
                        }}
                        onKeyDown={handleClearFiltersKeyDown}
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-haigoo-primary to-haigoo-primary/90 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 transform focus:ring-2 focus:ring-haigoo-primary focus:ring-offset-2"
                        aria-label={`清除所有筛选条件，当前已选择 ${activeFiltersCount} 个筛选条件`}
                      >
                        清除所有筛选
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </aside>

            {/* 主要内容区域 */}
            <main className="flex-1 min-w-0 relative" role="main" aria-label="职位列表">
              {/* 结果统计 */}
              <div className="flex items-center justify-between mb-6">
                <div 
                  className="text-gray-600 text-sm"
                  role="status"
                  aria-live="polite"
                  aria-label={`搜索结果统计：找到 ${filteredJobs.length} 个岗位`}
                >
                  找到 <span className="font-semibold text-gray-900 text-base">{filteredJobs.length}</span> 个岗位
                </div>
              </div>

              {/* 岗位列表 */}
              <div 
                ref={jobListRef}
                className="space-y-4"
                role="list"
                aria-label="职位列表"
                aria-describedby="job-list-help"
              >
                <div id="job-list-help" className="sr-only">
                  使用方向键导航职位列表，按回车键查看职位详情
                </div>
                
                {loading ? (
                  <div 
                    className="flex items-center justify-center py-12"
                    role="status"
                    aria-live="polite"
                    aria-label="正在加载职位数据"
                  >
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-haigoo-primary" aria-hidden="true"></div>
                    <span className="ml-3 text-gray-600">正在加载职位数据...</span>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div 
                    className="text-center py-12"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="text-gray-500 text-lg mb-2">暂无符合条件的职位</div>
                    <div className="text-gray-400 text-sm">请尝试调整筛选条件或搜索关键词</div>
                  </div>
                ) : (
                  filteredJobs.map((job, index) => (
                    <div key={job.id} role="listitem">
                      <JobCard
                        job={job}
                        onSave={() => toggleSaveJob(job.id)}
                        isSaved={savedJobs.has(job.id)}
                        onClick={() => openJobDetail(job)}
                        aria-label={`职位 ${index + 1}：${job.title} - ${job.company}`}
                      />
                    </div>
                  ))
                )}
              </div>
            </main>
          </div>
        </div>
      </div>

      {/* 岗位详情弹窗 */}
      {selectedJob && (
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