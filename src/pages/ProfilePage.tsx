import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { processJobDescription } from '../utils/text-formatter'
import {
  Mail,
  Phone,
  MapPin,
  Calendar,
  Save,
  X,
  Upload,
  Download,
  Camera,
  Globe,
  Linkedin,
  Github,
  TrendingUp,
  Target,
  CheckCircle,
  Clock,
  Briefcase,
  Edit3,
  Plus,
  Trash2,
  GraduationCap,
  Award,
  Star,
  User,
  Settings,
  Bell,
  LogOut,
  Search,
  Filter,
  MoreHorizontal,
  FileText,
  Brain,
  Zap,
  AlertCircle,
  Check,
  RefreshCw,
  Lightbulb,
  DollarSign,
  Eye,
  Heart,
  Building,
  Calendar as CalendarIcon,
  ExternalLink
} from 'lucide-react'

interface Experience {
  id: string
  company: string
  position: string
  startDate: string
  endDate: string
  current: boolean
  description: string
}

interface Education {
  id: string
  school: string
  degree: string
  field: string
  startDate: string
  endDate: string
  gpa?: string
}

interface Skill {
  id: string
  name: string
  level: number
  category: string
}

interface ResumeFile {
  id: string
  name: string
  size: number
  type: string
  uploadDate: string
  content?: string
  parsed?: boolean
  aiScore?: number
  suggestions?: string[]
}

interface AISuggestion {
  id: string
  type: 'add' | 'modify' | 'remove'
  section: string
  original?: string
  suggested: string
  reason: string
  accepted?: boolean
}

interface JobApplication {
  id: string
  jobTitle: string
  company: string
  status: 'applied' | 'interview' | 'offer' | 'rejected'
  appliedDate: string
  location: string
  salary?: string
}

interface SavedJob {
  id: string
  title: string
  company: string
  location: string
  salary: string
  type: string
  savedDate: string
  description: string
}

interface UserProfile {
  name: string
  email: string
  phone: string
  location: string
  title: string
  summary: string
  avatar: string
  website?: string
  linkedin?: string
  github?: string
  experience: Experience[]
  education: Education[]
  skills: Skill[]
  resumeFiles: ResumeFile[]
  aiSuggestions: AISuggestion[]
  resumeScore: number
  jobApplications: JobApplication[]
  savedJobs: SavedJob[]
  notifications: {
    email: boolean
    push: boolean
    jobAlerts: boolean
    applicationUpdates: boolean
  }
  privacy: {
    profileVisible: boolean
    contactInfoVisible: boolean
    resumeVisible: boolean
  }
}

export default function ProfilePage() {
  const location = useLocation()
  const { user: authUser } = useAuth()
  const [activeSection, setActiveSection] = useState('profile')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  
  // 从登录用户数据初始化，如果没有则使用默认值
  const [user, setUser] = useState<UserProfile>({
    name: authUser?.username || authUser?.profile?.fullName || '用户',
    email: authUser?.email || '',
    phone: authUser?.profile?.phone || '',
    location: authUser?.profile?.location || '',
    title: authUser?.profile?.title || '',
    summary: authUser?.profile?.bio || '',
    avatar: authUser?.avatar || '',
    website: '',
    linkedin: '',
    github: '',
    experience: [], // 用户自己添加工作经历
    education: [], // 用户自己添加教育经历

    skills: [
      { id: '1', name: 'React', level: 90, category: '前端框架' },
      { id: '2', name: 'TypeScript', level: 85, category: '编程语言' },
      { id: '3', name: 'Node.js', level: 75, category: '后端技术' },
      { id: '4', name: 'Vue.js', level: 80, category: '前端框架' },
      { id: '5', name: 'Python', level: 70, category: '编程语言' }
    ],
    resumeFiles: [
      {
        id: '1',
        name: '张三_前端工程师简历.pdf',
        size: 1024000,
        type: 'application/pdf',
        uploadDate: '2024-01-15',
        aiScore: 85,
        suggestions: ['添加更多项目经验', '优化技能描述', '增加量化成果']
      }
    ],
    aiSuggestions: [
      {
        id: '1',
        type: 'add',
        section: 'skills',
        suggested: 'GraphQL',
        reason: '基于您的前端经验，学习GraphQL将提升您的竞争力'
      },
      {
        id: '2',
        type: 'modify',
        section: 'summary',
        original: '拥有5年前端开发经验',
        suggested: '拥有5年+前端开发经验，专注于大型项目架构设计',
        reason: '更具体地描述您的专业领域'
      }
    ],
    resumeScore: 85,
    jobApplications: [
      {
        id: '1',
        jobTitle: '高级前端架构师',
        company: '字节跳动',
        status: 'interview',
        appliedDate: '2024-01-20',
        location: '北京',
        salary: '30-50K'
      },
      {
        id: '2',
        jobTitle: '前端技术专家',
        company: '美团',
        status: 'applied',
        appliedDate: '2024-01-18',
        location: '北京',
        salary: '35-55K'
      }
    ],
    savedJobs: [
      {
        id: '1',
        title: 'React高级工程师',
        company: '小米科技',
        location: '北京',
        salary: '25-40K',
        type: '全职',
        savedDate: '2024-01-22',
        description: '负责小米生态链产品的前端开发工作'
      },
      {
        id: '2',
        title: '前端架构师',
        company: '京东',
        location: '北京',
        salary: '40-60K',
        type: '全职',
        savedDate: '2024-01-21',
        description: '负责电商平台前端架构设计和团队管理'
      }
    ],
    notifications: {
      email: true,
      push: true,
      jobAlerts: true,
      applicationUpdates: true
    },
    privacy: {
      profileVisible: true,
      contactInfoVisible: false,
      resumeVisible: true
    }
  })

  // 监听登录用户变化，更新本地状态
  useEffect(() => {
    if (authUser) {
      setUser(prev => ({
        ...prev,
        name: authUser.username || authUser.profile?.fullName || '用户',
        email: authUser.email || '',
        phone: authUser.profile?.phone || '',
        location: authUser.profile?.location || '',
        title: authUser.profile?.title || '',
        summary: authUser.profile?.bio || '',
        avatar: authUser.avatar || ''
      }))
    }
  }, [authUser])

  const sidebarItems = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'resume', label: '简历管理', icon: FileText },
    { id: 'subscriptions', label: '职位订阅', icon: Bell },
    { id: 'recommendations', label: '推荐墙', icon: Star },
    { id: 'insights', label: 'AI职业洞察', icon: TrendingUp },
    { id: 'applications', label: '我的申请', icon: Briefcase },
    { id: 'settings', label: '设置', icon: Settings }
  ]

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    
    // 模拟文件上传和AI分析
    setTimeout(() => {
      const newResumeFile: ResumeFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date().toISOString().split('T')[0],
        aiScore: Math.floor(Math.random() * 20) + 80,
        suggestions: [
          '添加更多量化成果',
          '优化关键词匹配',
          '完善项目描述'
        ]
      }
      
      setUser(prev => ({
        ...prev,
        resumeFiles: [...prev.resumeFiles, newResumeFile]
      }))
      setIsUploading(false)
    }, 2000)
  }

  // 删除简历文件
  const deleteResumeFile = (fileId: string) => {
    setUser(prev => ({
      ...prev,
      resumeFiles: prev.resumeFiles.filter(file => file.id !== fileId)
    }))
  }

  // 采纳AI建议
  const acceptSuggestion = (suggestionId: string) => {
    setUser(prev => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.map(suggestion =>
        suggestion.id === suggestionId
          ? { ...suggestion, accepted: true }
          : suggestion
      )
    }))
  }

  // 拒绝AI建议
  const rejectSuggestion = (suggestionId: string) => {
    setUser(prev => ({
      ...prev,
      aiSuggestions: prev.aiSuggestions.filter(suggestion => suggestion.id !== suggestionId)
    }))
  }

  // 更新通知设置
  const updateNotificationSetting = (key: keyof typeof user.notifications, value: boolean) => {
    setUser(prev => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: value
      }
    }))
  }

  // 更新隐私设置
  const updatePrivacySetting = (key: keyof typeof user.privacy, value: boolean) => {
    setUser(prev => ({
      ...prev,
      privacy: {
        ...prev.privacy,
        [key]: value
      }
    }))
  }

  // 渲染个人资料卡片
  const renderUserProfileCard = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">个人资料</h3>
        <Edit3 
          className="w-5 h-5 text-gray-400 cursor-pointer hover:text-haigoo-primary" 
          onClick={() => setEditingProfile(!editingProfile)}
        />
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-gray-400" />
          <span className="text-gray-700">{user.email}</span>
        </div>
        <div className="flex items-center gap-3">
          <Phone className="w-5 h-5 text-gray-400" />
          <span className="text-gray-700">{user.phone}</span>
        </div>
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-gray-400" />
          <span className="text-gray-700">{user.location}</span>
        </div>
        {user.website && (
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-gray-400" />
            <a href={user.website} className="text-haigoo-primary hover:underline">{user.website}</a>
          </div>
        )}
      </div>
      
      <div className="mt-6 pt-6 border-t border-gray-100">
        <h4 className="font-medium text-gray-900 mb-3">个人简介</h4>
        <p className="text-gray-600 text-sm leading-relaxed">{user.summary}</p>
      </div>
    </div>
  )

  // 渲染简历卡片
  const renderResumeCard = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">简历文件</h3>
        <Upload 
          className="w-5 h-5 text-gray-400 cursor-pointer hover:text-haigoo-primary" 
          onClick={() => fileInputRef.current?.click()}
        />
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleFileUpload}
        className="hidden"
      />
      
      <div className="space-y-4">
        {user.resumeFiles.length > 0 ? (
          user.resumeFiles.map(file => (
            <div key={file.id} className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-haigoo-primary" />
                  <span className="font-medium text-gray-900">{file.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-400 cursor-pointer hover:text-haigoo-primary" />
                  <Download className="w-4 h-4 text-gray-400 cursor-pointer hover:text-haigoo-primary" />
                  <Trash2 
                    className="w-4 h-4 text-gray-400 cursor-pointer hover:text-red-500" 
                    onClick={() => deleteResumeFile(file.id)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500">
                <span>上传时间: {file.uploadDate}</span>
                {file.aiScore && (
                  <span className="text-haigoo-primary font-medium">AI评分: {file.aiScore}/100</span>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
            <div className="text-center">
              <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">点击上传简历文件</p>
              <p className="text-xs text-gray-500">支持 PDF、DOC、DOCX 格式</p>
            </div>
          </div>
        )}
        
        {isUploading && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-blue-700">正在上传并分析简历...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // 渲染职位订阅卡片
  const renderJobSubscriptionsCard = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">职位订阅</h3>
        <Plus className="w-5 h-5 text-gray-400 cursor-pointer hover:text-haigoo-primary" />
      </div>
      
      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">李经理</span>
            <span className="text-sm text-blue-700">技术总监</span>
          </div>
          <p className="text-sm text-blue-800">"张三是一位非常优秀的前端工程师，技术能力强，学习能力出色。"</p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">王总</span>
            <span className="text-sm text-green-700">产品总监</span>
          </div>
          <p className="text-sm text-green-800">"合作过程中展现出了极强的责任心和专业素养，值得推荐。"</p>
        </div>
      </div>
    </div>
  )

  // 渲染推荐墙
  const renderRecommendationWall = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">推荐墙</h3>
        <Star className="w-6 h-6 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-blue-900">李经理</span>
            <span className="text-sm text-blue-700">技术总监</span>
          </div>
          <p className="text-sm text-blue-800">"张三是一位非常优秀的前端工程师，技术能力强，学习能力出色。"</p>
        </div>
        
        <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-5 h-5 text-green-600" />
            <span className="font-medium text-green-900">王总</span>
            <span className="text-sm text-green-700">产品总监</span>
          </div>
          <p className="text-sm text-green-800">"合作过程中展现出了极强的responsibility和专业素养，值得推荐。"</p>
        </div>
      </div>
    </div>
  )

  // 渲染AI职业洞察
  const renderAICareerInsights = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-gray-900">AI职业洞察</h3>
        <Brain className="w-6 h-6 text-gray-400" />
      </div>
      
      <div className="space-y-4">
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Lightbulb className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-purple-900 mb-2">技能建议</h4>
              <p className="text-purple-700 text-sm">基于您的档案，考虑学习 <span className="font-semibold">GraphQL</span> 来增强您的前端技能。</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-2">职业路径</h4>
              <p className="text-blue-700 text-sm">您的经验符合向 <span className="font-semibold">解决方案架构师</span> 角色过渡的条件。</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <DollarSign className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-green-900 mb-2">薪资基准</h4>
              <p className="text-green-700 text-sm">您所在地区的高级软件工程师平均薪资为 <span className="font-semibold">¥300,000 - ¥450,000</span> 年薪。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // 渲染简历管理页面
  const renderResumeManagement = () => (
    <div className="space-y-6">
      {/* 简历文件管理 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-gray-900">简历文件管理</h3>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-haigoo-primary text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            上传新简历
          </button>
        </div>
        
        <div className="grid gap-4">
          {user.resumeFiles.map(file => (
            <div key={file.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-haigoo-primary" />
                  <div>
                    <h4 className="font-medium text-gray-900">{file.name}</h4>
                    <p className="text-sm text-gray-500">上传时间: {file.uploadDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {file.aiScore && (
                    <div className="text-center">
                      <div className="text-lg font-bold text-haigoo-primary">{file.aiScore}</div>
                      <div className="text-xs text-gray-500">AI评分</div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button className="p-2 text-gray-400 hover:text-haigoo-primary">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-haigoo-primary">
                      <Download className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => deleteResumeFile(file.id)}
                      className="p-2 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              {file.suggestions && file.suggestions.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h5 className="font-medium text-yellow-900 mb-2">AI优化建议:</h5>
                  <ul className="space-y-1">
                    {file.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-yellow-800 flex items-center gap-2">
                        <AlertCircle className="w-3 h-3" />
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI建议 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">AI优化建议</h3>
        
        <div className="space-y-4">
          {user.aiSuggestions.map(suggestion => (
            <div key={suggestion.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 mb-1">
                    {suggestion.type === 'add' && '添加建议'}
                    {suggestion.type === 'modify' && '修改建议'}
                    {suggestion.type === 'remove' && '删除建议'}
                  </h4>
                  <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                  <div className="text-sm">
                    {suggestion.original && (
                      <div className="mb-1">
                        <span className="text-gray-500">原文: </span>
                        <span className="text-red-600">{suggestion.original}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">建议: </span>
                      <span className="text-green-600">{suggestion.suggested}</span>
                    </div>
                  </div>
                </div>
                
                {!suggestion.accepted && (
                  <div className="flex gap-2 ml-4">
                    <button 
                      onClick={() => acceptSuggestion(suggestion.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => rejectSuggestion(suggestion.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
              
              {suggestion.accepted && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  已采纳
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // 渲染职位管理页面
  const renderJobManagement = () => (
    <div className="space-y-6">
      {/* 申请记录 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">申请记录</h3>
        
        <div className="space-y-4">
          {user.jobApplications.map(application => (
            <div key={application.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">{application.jobTitle}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {application.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {application.location}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarIcon className="w-4 h-4" />
                      {application.appliedDate}
                    </span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    application.status === 'applied' ? 'bg-blue-100 text-blue-800' :
                    application.status === 'interview' ? 'bg-yellow-100 text-yellow-800' :
                    application.status === 'offer' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {application.status === 'applied' && '已申请'}
                    {application.status === 'interview' && '面试中'}
                    {application.status === 'offer' && '已录用'}
                    {application.status === 'rejected' && '已拒绝'}
                  </div>
                  {application.salary && (
                    <div className="text-sm text-gray-500 mt-1">{application.salary}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 收藏职位 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">收藏职位</h3>
        
        <div className="space-y-4">
          {user.savedJobs.map(job => (
            <div key={job.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{job.title}</h4>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Building className="w-4 h-4" />
                      {job.company}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                    <span className="text-haigoo-primary font-medium">{job.salary}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {processJobDescription(job.description, { 
                      formatMarkdown: false, 
                      maxLength: 150, 
                      preserveHtml: false 
                    })}
                  </p>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button className="p-2 text-gray-400 hover:text-haigoo-primary">
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-red-400 hover:text-red-600">
                    <Heart className="w-4 h-4 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // 渲染账户设置页面
  const renderAccountSettings = () => (
    <div className="space-y-6">
      {/* 个人信息编辑 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">个人信息</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
            <input 
              type="text" 
              value={user.name}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input 
              type="email" 
              value={user.email}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">电话</label>
            <input 
              type="tel" 
              value={user.phone}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">所在地</label>
            <input 
              type="text" 
              value={user.location}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">职位</label>
            <input 
              type="text" 
              value={user.title}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">个人简介</label>
            <textarea 
              value={user.summary}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex justify-end mt-6">
          <button className="px-6 py-2 bg-haigoo-primary text-white rounded-lg hover:bg-purple-700 transition-colors">
            保存更改
          </button>
        </div>
      </div>

      {/* 隐私设置 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">隐私设置</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">公开个人资料</h4>
              <p className="text-sm text-gray-500">允许其他用户查看您的个人资料</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={user.privacy.profileVisible}
                onChange={(e) => updatePrivacySetting('profileVisible', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">显示联系信息</h4>
              <p className="text-sm text-gray-500">在个人资料中显示您的联系方式</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={user.privacy.contactInfoVisible}
                onChange={(e) => updatePrivacySetting('contactInfoVisible', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-gray-900">公开简历</h4>
              <p className="text-sm text-gray-500">允许招聘者查看您的简历</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={user.privacy.resumeVisible}
                onChange={(e) => updatePrivacySetting('resumeVisible', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  // 渲染通知设置页面
  const renderNotificationSettings = () => (
    <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
      <h3 className="text-xl font-semibold text-gray-900 mb-6">通知设置</h3>
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">邮件通知</h4>
            <p className="text-sm text-gray-500">接收重要更新的邮件通知</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={user.notifications.email}
              onChange={(e) => updateNotificationSetting('email', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">推送通知</h4>
            <p className="text-sm text-gray-500">接收浏览器推送通知</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={user.notifications.push}
              onChange={(e) => updateNotificationSetting('push', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">职位提醒</h4>
            <p className="text-sm text-gray-500">新的匹配职位推送</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={user.notifications.jobAlerts}
              onChange={(e) => updateNotificationSetting('jobAlerts', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-gray-900">申请状态更新</h4>
            <p className="text-sm text-gray-500">职位申请状态变化通知</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={user.notifications.applicationUpdates}
              onChange={(e) => updateNotificationSetting('applicationUpdates', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-haigoo-primary"></div>
          </label>
        </div>
      </div>
    </div>
  )

  // 渲染主内容
  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            {/* 个人资料概览卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">个人资料概览</h2>
                <Edit3 
                  className="w-5 h-5 text-gray-400 cursor-pointer hover:text-haigoo-primary transition-colors" 
                  onClick={() => setEditingProfile(!editingProfile)}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{user.phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-700">{user.location}</span>
                  </div>
                  {user.website && (
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-400" />
                      <a href={user.website} className="text-haigoo-primary hover:underline">{user.website}</a>
                    </div>
                  )}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">个人简介</h4>
                  <p className="text-gray-600 text-sm leading-relaxed">{user.summary}</p>
                </div>
              </div>
            </div>

            {/* 简历管理卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">简历管理</h2>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-haigoo-primary text-white rounded-lg hover:bg-haigoo-primary/90 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  上传简历
                </button>
              </div>
              
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              <div className="space-y-4">
                {user.resumeFiles.length > 0 ? (
                  user.resumeFiles.map(file => (
                    <div key={file.id} className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-haigoo-primary" />
                          <span className="font-medium text-gray-900">{file.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Eye className="w-4 h-4 text-gray-400 cursor-pointer hover:text-haigoo-primary transition-colors" />
                          <Download className="w-4 h-4 text-gray-400 cursor-pointer hover:text-haigoo-primary transition-colors" />
                          <Trash2 
                            className="w-4 h-4 text-gray-400 cursor-pointer hover:text-red-500 transition-colors" 
                            onClick={() => deleteResumeFile(file.id)}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>上传时间: {file.uploadDate}</span>
                        {file.aiScore && (
                          <div className="flex items-center gap-2">
                            <span className="text-haigoo-primary font-medium">AI评分: {file.aiScore}/100</span>
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-haigoo-primary to-purple-600 rounded-full transition-all duration-300"
                                style={{ width: `${file.aiScore}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">还没有上传简历</h3>
                    <p className="text-sm text-gray-600 mb-6">上传您的简历，让AI为您提供专业的优化建议</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-haigoo-primary text-white rounded-lg hover:bg-haigoo-primary/90 transition-colors"
                    >
                      选择文件
                    </button>
                    <p className="text-xs text-gray-500 mt-3">支持 PDF、DOC、DOCX 格式</p>
                  </div>
                )}
                
                {isUploading && (
                  <div className="p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                      <span className="text-blue-700">正在上传并分析简历...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AI职业洞察卡片 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-haigoo-primary" />
                  AI职业洞察
                </h2>
                <RefreshCw className="w-5 h-5 text-gray-400 cursor-pointer hover:text-haigoo-primary transition-colors" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-blue-900">简历匹配度</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{user.resumeScore}%</div>
                </div>
                
                <div className="p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                    <span className="font-medium text-green-900">市场竞争力</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">85%</div>
                </div>
                
                <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Lightbulb className="w-5 h-5 text-purple-600" />
                    <span className="font-medium text-purple-900">优化建议</span>
                  </div>
                  <div className="text-2xl font-bold text-purple-600">5条</div>
                </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">AI优化建议</h3>
                <div className="space-y-3">
                  {user.aiSuggestions.slice(0, 3).map(suggestion => (
                    <div key={suggestion.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            <span className="text-sm font-medium text-gray-700">{suggestion.section}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                          <p className="text-sm text-gray-900 font-medium">{suggestion.suggested}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => acceptSuggestion(suggestion.id)}
                            className="p-1 text-green-600 hover:bg-green-50 rounded transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => rejectSuggestion(suggestion.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )
      
      case 'resume':
        return renderResumeManagement()
      
      case 'subscriptions':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Bell className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">职位订阅</h2>
            <p className="text-gray-600">管理您的职位订阅和推送设置</p>
          </div>
        )
      
      case 'recommendations':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">推荐墙</h2>
            <p className="text-gray-600">查看为您推荐的优质职位</p>
          </div>
        )
      
      case 'insights':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">AI职业洞察</h2>
            <p className="text-gray-600">获取个性化的职业发展建议和市场洞察</p>
          </div>
        )
      
      case 'applications':
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">我的申请</h2>
            <p className="text-gray-600">查看和管理您的职位申请记录</p>
          </div>
        )
      
      case 'settings':
        return renderAccountSettings()
      
      case 'jobs':
        return renderJobManagement()
      
      case 'notifications':
        return renderNotificationSettings()
      
      default:
        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">功能开发中</h2>
            <p className="text-gray-600">该功能正在开发中，敬请期待！</p>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 统一的容器 - 移除阴影，使用更简洁的布局 */}
      <div className="flex max-w-7xl mx-auto">
        {/* 左侧边栏 - 固定宽度，与右侧内容对齐 */}
        <aside className="w-80 bg-white border-r border-gray-200 flex-shrink-0 min-h-screen">
          <div className="p-8 border-b border-gray-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-haigoo-primary to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">{user.name}</p>
                <p className="text-base text-gray-500">智能求职者</p>
              </div>
            </div>
          </div>
          
          <nav className="p-8">
            <div className="space-y-2">
              {sidebarItems.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                      activeSection === item.id
                        ? 'bg-haigoo-primary text-white shadow-md'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </aside>

        {/* 右侧主内容区域 - 充分利用剩余空间 */}
        <main className="flex-1 min-h-screen bg-gray-50">
          {/* 页面头部 - 与侧边栏顶部对齐 */}
          <div className="px-8 py-8 bg-white border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {sidebarItems.find(item => item.id === activeSection)?.label || '个人资料'}
                </h1>
                <p className="text-gray-600 mt-1">管理您的个人信息和设置</p>
              </div>
            </div>
          </div>
          
          {/* 内容区域 - 统一的内边距，与头部对齐 */}
          <div className="p-8">
            <div className="space-y-8">
              {renderContent()}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}