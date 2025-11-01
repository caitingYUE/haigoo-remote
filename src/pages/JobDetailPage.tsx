import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  MapPin,
  DollarSign,
  Clock,
  Building,
  Users,
  Bookmark,
  BookmarkCheck,
  Share2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Award,
  Globe,
  X
} from 'lucide-react'
import { Job } from '../types'

// Mock job data - in real app, this would come from API
const mockJob: Job = {
  id: '1',
  title: 'Senior Product Designer',
  company: 'Innovate Inc.',
  location: 'San Francisco, CA',
  salary: { min: 80000, max: 120000, currency: 'USD' },
  type: 'full-time',
  description: `我们正在寻找一位经验丰富的产品设计师，负责构建现代化的用户体验。您将使用Figma、Sketch等设计工具，与产品经理和工程师紧密合作。

作为我们团队的一员，您将参与构建下一代产品，影响数百万用户的体验。我们提供灵活的工作环境、优秀的团队文化和丰富的学习机会。

这是一个绝佳的机会，让您在一个快速发展的公司中发挥您的技能，同时学习新技术并推动创新。`,
  requirements: [
    '5+ years of experience in product design.',
    'A strong portfolio showcasing your design process and skills.',
    'Proficiency in Figma, Sketch, or Adobe XD.',
    'Experience with design systems and front-end development.'
  ],
  responsibilities: [
    'Lead the design of new features from concept to launch.',
    'Create wireframes, prototypes, and high-fidelity mockups.',
    'Collaborate with product managers and engineers to define user experiences.',
    'Conduct user research and usability testing to inform design decisions.'
  ],
  skills: ['Figma', 'Sketch', 'Adobe XD', 'Prototyping', 'User Research', 'Design Systems'],
  postedAt: '2024-01-15',
  expiresAt: '2024-02-15',
  source: 'LinkedIn',
  sourceUrl: 'https://linkedin.com/jobs/123',
  logo: 'https://via.placeholder.com/80x80?text=TC'
}

export default function JobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [job, setJob] = useState<Job | null>(null)
  const [isBookmarked, setIsBookmarked] = useState(false)
  const [matchScore] = useState(92)
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(true)
  const [activeTab, setActiveTab] = useState('description')

  useEffect(() => {
    // 检查是否从申请页面返回，如果是，恢复状态
    if (location.state) {
      const state = location.state as any
      if (state.showModal !== undefined) setShowModal(state.showModal)
      if (state.activeTab) setActiveTab(state.activeTab)
      if (state.isBookmarked !== undefined) setIsBookmarked(state.isBookmarked)
    }
    
    // Simulate API call
    setTimeout(() => {
      setJob(mockJob)
      setIsLoading(false)
    }, 500)
  }, [id, location.state])

  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked)
  }

  const handleApply = () => {
    if (job) {
      // 导航到AI优化页面，传递当前岗位详情页的完整状态
      navigate(`/job/${job.id}/apply`, {
        state: {
          job,
          returnToModal: false, // 从岗位详情页进入，返回时不需要显示模态框
          previousPath: `/job/${job.id}`, // 返回到当前岗位详情页
          jobDetailPageState: {
            showModal: true,
            activeTab,
            isBookmarked,
            matchScore
          }
        }
      })
    }
  }

  const formatSalary = (salary: { min: number; max: number; currency: string }) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: salary.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    return `${formatter.format(salary.min)} - ${formatter.format(salary.max)}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 1) return '1天前'
    if (diffDays < 7) return `${diffDays}天前`
    if (diffDays < 30) return `${Math.ceil(diffDays / 7)}周前`
    return `${Math.ceil(diffDays / 30)}个月前`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-haigoo-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">职位未找到</h1>
          <p className="text-gray-600">抱歉，您查找的职位不存在。</p>
        </div>
      </div>
    )
  }

  if (!showModal) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">职位详情已关闭</h1>
          <button 
            onClick={() => setShowModal(true)}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            重新打开
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex justify-end">
      <div className="w-full max-w-[840px] h-screen bg-white flex flex-col border border-gray-200 shadow-lg">
         {/* Header */}
         <div className="p-4 md:p-6 border-b border-gray-200 flex justify-between items-center bg-white">
          <h2 className="text-lg md:text-2xl font-bold text-gray-900 truncate pr-4">{job.title}</h2>
          <button 
            onClick={() => setShowModal(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto">
          <div className="p-4 md:p-6">
            {/* Company Info Card */}
            <div className="bg-white rounded-xl shadow-sm mb-4 md:mb-6 p-4 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:justify-between items-start md:items-center">
                <div className="flex gap-3 md:gap-4 items-center w-full md:w-auto">
                  <div className="bg-purple-600 rounded-xl h-16 w-16 md:h-20 md:w-20 flex items-center justify-center text-white font-bold text-lg md:text-xl flex-shrink-0">
                    {job.company.charAt(0)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-gray-900 text-lg md:text-xl font-bold leading-tight truncate">{job.company}</p>
                    <p className="text-gray-500 text-sm md:text-base truncate">{job.location}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2">
                      <div className="flex items-center text-green-600 font-semibold text-sm md:text-base">
                        <DollarSign className="w-4 h-4 mr-1" />
                        <span>{formatSalary(job.salary)}</span>
                      </div>
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs md:text-sm rounded-md w-fit">
                        {job.type === 'full-time' ? '全职' : job.type === 'contract' ? '合同' : '兼职'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 md:gap-3 w-full md:w-auto justify-end">
                  <button 
                    onClick={handleBookmark}
                    className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  >
                    {isBookmarked ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={handleApply}
                    className="px-4 md:px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm md:text-base"
                  >
                    申请职位
                  </button>
                </div>
              </div>
              
              {/* AI Match Score */}
              <div className="mt-4 p-3 md:p-4 bg-white border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700 font-medium text-sm md:text-base">AI 匹配度</span>
                  <span className="text-xl md:text-2xl font-bold text-purple-600">{matchScore}%</span>
                </div>
              </div>
            </div>

            {/* 专业Tab导航 - 海狗品牌交互状态 */}
            <div className="bg-white rounded-xl shadow-sm mb-4 md:mb-6 overflow-hidden border border-haigoo-neutral-200">
              <div className="flex bg-haigoo-neutral-50 p-1 rounded-t-xl">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`tab-nav-item ${
                    activeTab === 'description' ? 'tab-nav-active' : 'tab-nav-default'
                  }`}
                >
                  Job Description
                </button>
                <button
                  onClick={() => setActiveTab('company')}
                  className={`tab-nav-item ${
                    activeTab === 'company' ? 'tab-nav-active' : 'tab-nav-default'
                  }`}
                >
                  Company Info
                </button>
                <button
                  onClick={() => setActiveTab('similar')}
                  className={`tab-nav-item ${
                    activeTab === 'similar' ? 'tab-nav-active' : 'tab-nav-default'
                  }`}
                >
                  Similar Jobs
                </button>
              </div>

              {/* Tab Content */}
              <div className="p-4 md:p-6">
                {activeTab === 'description' && (
                  <div className="space-y-4 md:space-y-6 text-gray-700">
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">Responsibilities</h3>
                      <ul className="list-disc list-inside space-y-1 md:space-y-2 text-sm md:text-base text-gray-600">
                        {job.responsibilities.map((responsibility, index) => (
                          <li key={index}>{responsibility}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">Qualifications</h3>
                      <ul className="list-disc list-inside space-y-1 md:space-y-2 text-sm md:text-base text-gray-600">
                        {job.requirements.map((requirement, index) => (
                          <li key={index}>{requirement}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-bold text-gray-900 mb-2 md:mb-3">Benefits</h3>
                      <ul className="list-disc list-inside space-y-1 md:space-y-2 text-sm md:text-base text-gray-600">
                        <li>Comprehensive health, dental, and vision insurance.</li>
                        <li>Flexible work hours and remote-first culture.</li>
                        <li>Generous paid time off and parental leave.</li>
                        <li>401(k) with company match.</li>
                      </ul>
                    </div>
                  </div>
                )}

                {activeTab === 'company' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Building className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{job.company}</div>
                        <div className="text-sm text-gray-600">科技公司</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">{job.location}</div>
                        <div className="text-sm text-gray-600">总部位置</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="font-medium text-gray-900">500-1000人</div>
                        <div className="text-sm text-gray-600">公司规模</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'similar' && (
                  <div className="space-y-3">
                    {[
                      { title: 'UX Designer', company: 'StartupXYZ', match: '88%' },
                      { title: 'Product Designer', company: 'WebCorp', match: '85%' },
                      { title: 'UI/UX Designer', company: 'DesignTech', match: '82%' }
                    ].map((similarJob, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{similarJob.title}</div>
                          <div className="text-xs text-gray-600">{similarJob.company}</div>
                        </div>
                        <span className="text-xs font-medium text-green-600">{similarJob.match}</span>
                      </div>
                    ))}
                    <Link to="/" className="block text-center text-purple-600 hover:text-purple-700 text-sm font-medium mt-4">
                      查看更多职位
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}