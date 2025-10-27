import { useState, useEffect } from 'react'
import { Search, MapPin, Building, DollarSign, Bookmark, Calendar } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import JobDetailModal from '../components/JobDetailModal'
import { Job } from '../types'
import { jobAggregator } from '../services/job-aggregator'
import { Job as RSSJob } from '../types/rss-types'

// 转换RSS Job类型到页面Job类型的函数
const convertRSSJobToPageJob = (rssJob: RSSJob): Job => {
  return {
    id: rssJob.id,
    title: rssJob.title,
    company: rssJob.company,
    location: rssJob.location,
    type: rssJob.isRemote ? 'remote' : 'full-time',
    salary: {
      min: 0,
      max: 0,
      currency: 'USD'
    },
    description: rssJob.description,
    requirements: rssJob.requirements,
    responsibilities: [], // RSS数据中没有这个字段
    skills: rssJob.tags,
    postedAt: rssJob.publishedAt.toISOString().split('T')[0],
    expiresAt: '', // RSS数据中没有这个字段
    source: rssJob.source,
    sourceUrl: rssJob.sourceUrl
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
        
        // 获取RSS岗位数据
        const rssJobs = jobAggregator.getJobs()
        console.log('获取到RSS岗位数据:', rssJobs.length, '个')
        
        if (rssJobs.length > 0) {
          const convertedJobs = rssJobs.map(convertRSSJobToPageJob)
          setJobs(convertedJobs)
          console.log('转换后的岗位数据:', convertedJobs.length, '个')
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
    setSelectedJob(job)
    setIsJobDetailOpen(true)
  }

  const closeJobDetail = () => {
    setIsJobDetailOpen(false)
    setSelectedJob(null)
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
    
    // 工作类型匹配 - 统一使用RSS Job的jobType字段
    const matchesType = filters.type === 'all' || 
      (job as any).jobType?.toLowerCase() === filters.type.toLowerCase() || 
      job.type === filters.type
    
    // 岗位分类匹配 - 使用RSS Job的category字段
    const matchesCategory = filters.category === 'all' || 
      (job as any).category === filters.category ||
      (job.skills && job.skills.some(skill => skill.toLowerCase().includes(filters.category.toLowerCase())))
    
    // 地点匹配 - 支持远程工作判断
    const matchesLocation = filters.location === 'all' || 
      job.location.includes(filters.location) ||
      (filters.location === 'Remote' && ((job as any).isRemote || job.location.includes('远程'))) ||
      (filters.location === 'Worldwide' && (job.location.includes('全球') || job.location.includes('远程')))
    
    // 经验等级匹配
    const matchesExperience = filters.experience === 'all' || 
      (job as any).experienceLevel === filters.experience
    
    // 远程工作匹配
    const matchesRemote = filters.remote === 'all' || 
      (filters.remote === 'yes' && ((job as any).isRemote || job.location.includes('远程'))) ||
      (filters.remote === 'no' && !((job as any).isRemote || job.location.includes('远程')))
    
    return matchesSearch && matchesType && matchesCategory && matchesLocation && matchesExperience && matchesRemote
  })

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'full-time': return '全职'
      case 'part-time': return '兼职'
      case 'contract': return '合同工'
      case 'remote': return '远程工作'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'full-time': return 'bg-green-100 text-green-700'
      case 'part-time': return 'bg-blue-100 text-blue-700'
      case 'contract': return 'bg-purple-100 text-purple-700'
      case 'remote': return 'bg-orange-100 text-orange-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  const activeFiltersCount = Object.values(filters).filter(value => value !== 'all').length

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-x-hidden">
      {/* 主内容区域 */}
      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* 页面标题与搜索 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">全部岗位</h1>
            <p className="text-gray-600 text-sm">发现适合你的工作机会</p>
          </div>
          <div className="max-w-2xl mx-auto mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 transition-colors duration-200" />
              <input
                type="text"
                placeholder="搜索岗位、公司或地点..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-haigoo-primary focus:border-transparent text-base bg-white/90 backdrop-blur-sm shadow-sm transition-all duration-300 hover:shadow-md focus:shadow-lg transform hover:scale-[1.01] focus:scale-[1.01]"
              />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex gap-6">
            {/* 侧边栏筛选 - 优化固定定位 */}
            <div className="w-72 shrink-0">
              <div className="sticky top-24 w-72 h-[calc(100vh-120px)] will-change-transform">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-gray-200/60 overflow-hidden h-full flex flex-col">
                  <div className="p-5 border-b border-gray-100">
                    <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-haigoo-primary rounded-full"></div>
                      筛选条件
                    </h3>
                  </div>
                  
                  <div className="p-5 flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
                    {/* 工作类型 */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">工作类型</label>
                      <div className="space-y-2">
                        {jobTypes.map((type) => (
                          <label key={type.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="type"
                              value={type.value}
                              checked={filters.type === type.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200">{type.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 岗位类别 */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">岗位类别</label>
                      <div className="space-y-2">
                        {jobCategories.map((category) => (
                          <label key={category.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="category"
                              value={category.value}
                              checked={filters.category === category.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200">{category.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 工作地点 */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">工作地点</label>
                      <div className="space-y-2">
                        {locations.map((location) => (
                          <label key={location.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="location"
                              value={location.value}
                              checked={filters.location === location.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200">{location.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 经验等级 */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">经验等级</label>
                      <div className="space-y-2">
                        {experienceLevels.map((level) => (
                          <label key={level.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="experience"
                              value={level.value}
                              checked={filters.experience === level.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, experience: e.target.value }))}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200">{level.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 远程工作 */}
                    <div className="mb-5">
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">远程工作</label>
                      <div className="space-y-2">
                        {remoteOptions.map((option) => (
                          <label key={option.value} className="flex items-center group cursor-pointer">
                            <input
                              type="radio"
                              name="remote"
                              value={option.value}
                              checked={filters.remote === option.value}
                              onChange={(e) => setFilters(prev => ({ ...prev, remote: e.target.value }))}
                              className="h-4 w-4 text-haigoo-primary focus:ring-haigoo-primary border-gray-300 rounded transition-colors duration-200"
                            />
                            <span className="ml-3 text-sm text-gray-700 group-hover:text-gray-900 transition-colors duration-200">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

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
                        className="w-full px-4 py-2.5 bg-gradient-to-r from-haigoo-primary to-haigoo-primary/90 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 transform"
                      >
                        清除所有筛选
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 主要内容区域 */}
            <div className="flex-1 min-w-0 relative">
              {/* 结果统计 */}
              <div className="flex items-center justify-between mb-6">
                <div className="text-gray-600 text-sm">
                  找到 <span className="font-semibold text-gray-900 text-base">{filteredJobs.length}</span> 个岗位
                </div>
              </div>

              {/* 岗位列表 */}
              <div className="space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-haigoo-primary"></div>
                    <span className="ml-3 text-gray-600">正在加载职位数据...</span>
                  </div>
                ) : filteredJobs.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 text-lg mb-2">暂无符合条件的职位</div>
                    <div className="text-gray-400 text-sm">请尝试调整筛选条件或搜索关键词</div>
                  </div>
                ) : (
                  filteredJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/60 p-6 hover:shadow-xl hover:border-haigoo-primary/30 hover:bg-white transition-all duration-300 cursor-pointer group will-change-transform hover:scale-[1.01] active:scale-[0.99]"
                    onClick={() => openJobDetail(job)}
                  >
                    {/* 卡片头部 */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 group-hover:text-haigoo-primary transition-colors duration-200 mb-2 truncate">
                          {job.title}
                        </h3>
                        <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Building className="h-4 w-4 text-gray-400 transition-colors duration-200" />
                            <span className="font-medium">{job.company}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-gray-400 transition-colors duration-200" />
                            <span>{job.location}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-4 w-4 text-gray-400 transition-colors duration-200" />
                            <span>{job.postedAt}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaveJob(job.id);
                          }}
                          className="p-2.5 rounded-xl hover:bg-gray-100 active:bg-gray-200 transition-all duration-300 group/bookmark transform hover:scale-110 active:scale-95"
                        >
                          <Bookmark
                            className={`h-5 w-5 transition-all duration-200 ${
                              savedJobs.has(job.id) ? 'text-haigoo-primary fill-current' : 'text-gray-400 group-hover/bookmark:text-gray-600'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* 标签 */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200 ${getTypeColor(job.type)}`}>
                        {getTypeLabel(job.type)}
                      </span>
                      {job.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium hover:bg-gray-200 active:bg-gray-300 transition-all duration-300 cursor-pointer transform hover:scale-105 active:scale-95">
                          {skill}
                        </span>
                      ))}
                      {job.skills.length > 3 && (
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                          +{job.skills.length - 3}
                        </span>
                      )}
                    </div>

                    {/* 描述 */}
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2 leading-relaxed">
                      {job.description}
                    </p>

                    {/* 底部信息 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-haigoo-primary font-semibold">
                        <DollarSign className="h-4 w-4" />
                        <span className="text-lg">
                          {job.salary.min === job.salary.max 
                            ? `${job.salary.min / 1000}K` 
                            : `${job.salary.min / 1000}-${job.salary.max / 1000}K`
                          }
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApply(job.id);
                        }}
                        className="px-4 py-2 bg-haigoo-primary text-white text-sm font-medium rounded-lg hover:bg-haigoo-primary/90 hover:shadow-lg active:scale-[0.95] transition-all duration-300 transform hover:scale-105"
                      >
                        查看详情
                      </button>
                    </div>
                  </div>
                )))}

                {/* 空状态 - 移除重复的空状态检查 */}
              </div>
            </div>
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
        />
      )}
    </div>
  )
}