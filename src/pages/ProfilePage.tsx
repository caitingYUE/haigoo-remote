import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import '../styles/landing.css'
import {
  Mail,
  Phone,
  MapPin,
  Globe,
  Edit3,
  Eye,
  Trash2,
  Plus,
  Star,
  Lightbulb,
  TrendingUp,
  DollarSign,
  Building,
  Calendar as CalendarIcon,
  Briefcase,
  Heart
} from 'lucide-react'
import { Upload, FileText, Download, X, AlertCircle, ExternalLink, RefreshCw, Brain, Check, CheckCircle } from 'lucide-react'
import JobCard from '../components/JobCard'
import { Job } from '../types'
import { processedJobsService } from '../services/processed-jobs-service'
import { usePageCache } from '../hooks/usePageCache'
import { resumeService } from '../services/resume-service'
import { parseResumeFileEnhanced } from '../services/resume-parser-enhanced'
import { useAuth } from '../contexts/AuthContext'
import { processJobDescription } from '../utils/text-formatter'
 

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
  jobId: string
  jobTitle: string
  company: string
  savedAt: string
  id?: string
  title?: string
  location?: string
  salary?: string
  description?: string
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
  const { user: authUser } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'resume' | 'favorites'>('resume')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const t = params.get('tab')
    if (t === 'resume' || t === 'favorites') {
      setActiveTab(t as 'resume' | 'favorites')
    } else if (t === 'profile') {
      setActiveTab('resume')
    }
  }, [location.search])

  const switchTab = (t: 'resume' | 'favorites') => {
    setActiveTab(t)
    const sp = new URLSearchParams(location.search)
    sp.set('tab', t)
    navigate({ pathname: '/profile', search: `?${sp.toString()}` }, { replace: true })
  }
  
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

    skills: [], // 清空默认技能
    resumeFiles: [], // 清空默认简历文件
    aiSuggestions: [], // 清空默认AI建议
    resumeScore: 0, // 清空默认评分
    jobApplications: [], // 清空默认申请记录
    savedJobs: [], // 清空默认收藏职位
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

  const { data: jobs, loading: jobsLoading, error: jobsError } = usePageCache<Job[]>('profile-favorites-source', {
    fetcher: async () => await processedJobsService.getAllProcessedJobs(200),
    ttl: 60000,
    persist: false,
    namespace: 'profile'
  })

  useEffect(() => {
    ;(async () => {
      try {
        const resp = await fetch('/api/user-profile', { method: 'GET' })
        const json = await resp.json()
        if (json.success && json.profile) {
          setUser(prev => ({
            ...prev,
            name: json.profile.username || prev.name,
            email: json.profile.email || prev.email,
            phone: json.profile.phone || prev.phone,
            location: json.profile.location || prev.location,
            title: json.profile.title || prev.title,
            summary: json.profile.summary || prev.summary,
            avatar: json.profile.avatar || prev.avatar,
            savedJobs: Array.isArray(json.profile.savedJobs) ? json.profile.savedJobs : []
          }))
        }
      } catch (e) {
        console.warn('加载用户资料失败', e)
      }
    })()
  }, [])

  

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

  

  // 文件上传处理
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    
    try {
      const parsed = await parseResumeFileEnhanced(file)
      const newResumeFile: ResumeFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date().toISOString().split('T')[0],
        content: parsed.textContent,
        parsed: parsed.success
      }
      setUser(prev => ({ ...prev, resumeFiles: [...prev.resumeFiles, newResumeFile] }))
      setIsUploading(false)

      if (parsed.textContent && parsed.textContent.length > 50) {
        const analysis = await resumeService.analyzeResume(parsed.textContent)
        if (analysis.success && analysis.data) {
          const data = analysis.data
          setUser(prev => ({
            ...prev,
            resumeScore: data.score,
            resumeFiles: prev.resumeFiles.map(f => (
              f.id === newResumeFile.id
                ? { ...f, aiScore: data.score, suggestions: data.suggestions }
                : f
            ))
          }))
        }
      }
    } catch (e) {
      console.error('简历解析/分析失败', e)
      setIsUploading(false)
    }
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

  const renderResumeSection = () => {
    const latest = user.resumeFiles[user.resumeFiles.length - 1]
    const suggestions = latest?.suggestions || []
    const score = typeof latest?.aiScore === 'number' ? latest.aiScore : (user.resumeScore || 0)
    const applyAllSuggestions = () => {}
    const resetSuggestions = () => {
      setUser(prev => ({
        ...prev,
        resumeFiles: prev.resumeFiles.map(f => f.id === latest?.id ? { ...f, suggestions: [] } : f)
      }))
    }
    return (
      <div className="space-y-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between">
            <div className="w-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">简历优化</h2>
                <button className="brand-btn-outline">
                  <Download className="w-4 h-4" />
                  下载优化简历
                </button>
              </div>
              <div className="mb-2 text-sm text-gray-700">总体简历评分</div>
              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-[var(--brand-blue)] rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
              </div>
              <div className="mt-1 text-right text-sm text-gray-600">{Math.max(0, Math.min(100, score))}%</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">我的简历</h3>
            </div>
            {user.resumeFiles.length === 0 ? (
              <div className="p-10 bg-white/70 rounded-lg border-2 border-dashed border-[var(--brand-border)] text-center">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <div className="text-sm text-gray-600 mb-2">还没有上传简历</div>
                <button onClick={() => fileInputRef.current?.click()} className="brand-btn">
                  <Upload className="w-4 h-4" />
                  上传简历
                </button>
                <p className="text-xs text-gray-500 mt-3">支持 PDF、DOC、DOCX、TXT</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-[var(--brand-blue)]" />
                      <span className="font-medium text-gray-900">{latest?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Download className="w-4 h-4 text-gray-400 cursor-pointer hover:text-[var(--brand-blue)] transition-colors" />
                      <button onClick={() => latest && deleteResumeFile(latest.id)} className="p-2 text-gray-400 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span>上传时间: {latest?.uploadDate}</span>
                    {typeof latest?.aiScore === 'number' && (
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--brand-blue)] font-medium">AI评分: {latest.aiScore}/100</span>
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-[var(--brand-blue)] rounded-full transition-all" style={{ width: `${latest.aiScore}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" onChange={handleFileUpload} className="hidden" />
          </div>

          <div className="glass-card p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">AI建议</h3>
            </div>
            {suggestions.length === 0 ? (
              <div className="p-10 bg-white/70 rounded-lg border border-[var(--brand-border)] text-center">
                <Lightbulb className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <div className="text-sm text-gray-600">上传简历后将展示优化建议</div>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <div className="text-sm text-gray-700">{s}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-6 flex items-center gap-3">
              <button onClick={applyAllSuggestions} className="brand-btn">应用建议</button>
              <button onClick={resetSuggestions} className="brand-btn-outline">重置建议</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderFavoritesSection = () => {
    const savedIds = new Set<string>((user.savedJobs || []).map(s => s.jobId))
    const favorites = (jobs || []).filter(j => savedIds.has(j.id))
    return (
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">我的收藏</h2>
          <div className="text-sm text-gray-500">{favorites.length} 个职位</div>
        </div>
        {jobsLoading ? (
          <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand-blue)]"></div></div>
        ) : jobsError ? (
          <div className="text-center py-12 text-red-600">{String(jobsError)}</div>
        ) : favorites.length === 0 ? (
          <div className="p-8 bg-white/70 rounded-lg border-2 border-dashed border-[var(--brand-border)] text-center">
            <ExternalLink className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">还没有收藏职位</h3>
            <p className="text-sm text-gray-600">在首页浏览职位时点击收藏按钮，这里将展示已收藏的职位</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favorites.map(job => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // 渲染个人资料卡片
  const renderUserProfileCard = () => null

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

  // 推荐墙功能已移除

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
          {user.resumeFiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">还没有上传简历</h4>
              <p className="text-gray-500 mb-6">
                上传您的简历，AI 将为您提供专业的优化建议
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#3182CE] text-white rounded-lg hover:bg-[#256bb0] transition-colors"
              >
                <Upload className="w-5 h-5" />
                立即上传简历
              </button>
            </div>
          ) : (
            user.resumeFiles.map(file => (
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
            ))
          )}
        </div>
      </div>

      {/* AI建议 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">AI优化建议</h3>
        
        <div className="space-y-4">
          {user.aiSuggestions.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <Lightbulb className="w-8 h-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">暂无AI优化建议</h4>
              <p className="text-gray-500">
                上传简历后，AI 将自动分析并提供专业的优化建议
              </p>
            </div>
          ) : (
            user.aiSuggestions.map(suggestion => (
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
            ))
          )}
        </div>
      </div>
    </div>
  )

  // 渲染职位管理页面
  const renderJobManagement = () => null

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

  

  return (
    <div className="min-h-screen landing-bg-page">
      <div className="max-w-7xl mx-auto px-8 py-10">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">个人中心</h1>
            <p className="text-gray-600">简历管理与我的收藏</p>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[180px_1fr] gap-8">
          <aside>
            <div className="glass-card p-3">
              <div className="flex flex-col gap-2" role="tablist" aria-label="个人中心切换">
                <button className={`tab-pill ${activeTab==='resume' ? 'active' : ''}`} role="tab" aria-selected={activeTab==='resume'} onClick={() => switchTab('resume')}>简历管理</button>
                <button className={`tab-pill ${activeTab==='favorites' ? 'active' : ''}`} role="tab" aria-selected={activeTab==='favorites'} onClick={() => switchTab('favorites')}>我的收藏</button>
              </div>
            </div>
          </aside>
          <main>
            {activeTab === 'resume' ? (
              <div className="space-y-8">{renderResumeSection()}</div>
            ) : (
              <div className="space-y-8">{renderFavoritesSection()}</div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}