import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  TrendingUp,
  Target,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Edit3,
  Zap,
  Award,
  AlertCircle,
  Bot,
  Sparkles,
  Brain,
  Send,
  Loader2,
  Activity,
  Code,
  Gauge,
  Building2,
  MapPin,
  Clock,
  DollarSign,
  Users,
  Briefcase,
  GraduationCap,
  Star,
  Save,
  User,
  Calendar
} from 'lucide-react'

// AI头像组件
const AIAvatar = ({ size = "w-5 h-5" }: { size?: string }) => {
  // 根据头像大小动态调整图标大小
  const getIconSize = (avatarSize: string) => {
    if (avatarSize.includes('w-4') || avatarSize.includes('h-4')) return 'w-2.5 h-2.5';
    if (avatarSize.includes('w-5') || avatarSize.includes('h-5')) return 'w-3 h-3';
    if (avatarSize.includes('w-6') || avatarSize.includes('h-6')) return 'w-3.5 h-3.5';
    if (avatarSize.includes('w-7') || avatarSize.includes('h-7')) return 'w-4 h-4';
    if (avatarSize.includes('w-8') || avatarSize.includes('h-8')) return 'w-4 h-4';
    return 'w-3 h-3'; // 默认大小
  };

  const iconSize = getIconSize(size);

  return (
    <div className={`${size} rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center shadow-sm relative flex-shrink-0`}>
      <Bot className={`${iconSize} text-white`} />
      <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full border border-white"></div>
    </div>
  );
};

interface JobDescription {
  title: string
  company: string
  location: string
  type: string
  salary: string
  description: string
  requirements: string[]
  responsibilities: string[]
  skills: string[]
}

interface ResumeSection {
  id: string
  type: 'personal' | 'experience' | 'education' | 'skills' | 'projects'
  title: string
  content: any
  isEditing?: boolean
}

interface OptimizationSuggestion {
  id: string
  type: 'add' | 'modify' | 'remove'
  section: string
  original?: string
  suggested: string
  impact: 'high' | 'medium' | 'low'
  reason: string
  applied?: boolean
}

interface ChatMessage {
  id: string
  type: 'user' | 'ai' | 'system'
  content: string
  timestamp: Date
  suggestions?: string[]
  actionType?: 'suggestion' | 'confirmation' | 'edit'
}

export default function ResumeOptimizationPage() {
  // State management
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [jobDescription, setJobDescription] = useState<JobDescription | null>({
    title: "高级前端工程师",
    company: "字节跳动",
    location: "北京/深圳",
    type: "全职",
    salary: "25-40K",
    description: "负责公司核心产品的前端开发工作，参与产品需求的设计和实现，要求具备扎实的前端基础，熟悉主流React生态系统，有大型项目经验。",
    requirements: [
      "3年以上前端开发经验",
      "精通React、TypeScript、HTML5、CSS3",
      "熟悉Webpack、Vite等构建工具",
      "有移动端开发经验优先",
      "良好的代码规范和团队协作能力"
    ],
    responsibilities: [
      "负责前端页面开发和维护",
      "与产品、设计团队协作完成需求",
      "优化前端性能和用户体验",
      "参与技术方案设计和评审"
    ],
    skills: ["React", "TypeScript", "JavaScript", "HTML5", "CSS3", "Webpack", "Git"]
  })
  const [resumeSections, setResumeSections] = useState<ResumeSection[]>([])
  const [matchScore, setMatchScore] = useState(77)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      type: 'ai',
      content: '你好！我是你的AI简历优化助手，请先上传目标职位的JD和你的简历，我将为你提供个性化的优化建议。我会在每次修改前都征求你的确认，确保优化方向符合你的期望。',
      timestamp: new Date()
    }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const jdInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Mock data for resume sections
  const mockResumeSections: ResumeSection[] = [
    {
      id: '1',
      type: 'personal',
      title: '个人信息',
      content: {
        name: '张三',
        title: '前端工程师',
        email: 'zhangsan@email.com',
        phone: '138****8888',
        location: '北京',
        summary: '3年前端开发经验，熟练掌握React技术栈，有大型项目开发经验'
      }
    },
    {
      id: '2',
      type: 'experience',
      title: '工作经验',
      content: [
        {
          company: '腾讯科技',
          position: '前端开发工程师',
          duration: '2022.03 - 至今',
          description: '负责微信小程序开发，参与用户增长项目，优化页面性能提升30%'
        },
        {
          company: '阿里巴巴',
          position: '初级前端工程师',
          duration: '2021.06 - 2022.02',
          description: '参与淘宝商家后台开发，使用React和TypeScript构建管理系统'
        }
      ]
    },
    {
      id: '3',
      type: 'skills',
      title: '技能专长',
      content: {
        technical: ['React', 'TypeScript', 'JavaScript', 'Vue.js', 'CSS3', 'HTML5'],
        tools: ['Webpack', 'Git', 'VSCode', 'Figma'],
        others: ['团队协作', '项目管理', '需求分析']
      }
    },
    {
      id: '4',
      type: 'education',
      title: '教育背景',
      content: {
        degree: '本科',
        major: '计算机科学与技术',
        school: '北京理工大学',
        duration: '2017.09 - 2021.06',
        gpa: '3.8/4.0'
      }
    }
  ]

  // Mock optimization suggestions
  const mockSuggestions: OptimizationSuggestion[] = [
    {
      id: '1',
      type: 'modify',
      section: 'personal',
      original: '3年前端开发经验，熟练掌握React技术栈，有大型项目开发经验',
      suggested: '3年前端开发经验，精通React生态系统，具备大型项目架构设计能力，熟悉微服务架构',
      impact: 'high',
      reason: '突出架构设计能力，更符合高级前端工程师要求'
    },
    {
      id: '2',
      type: 'add',
      section: 'skills',
      suggested: 'Node.js, Docker, Kubernetes',
      impact: 'medium',
      reason: '添加后端和容器化技能，提升全栈能力'
    }
  ]

  // Initialize with mock data
  useEffect(() => {
    setResumeSections(mockResumeSections)
    setSuggestions(mockSuggestions)
    setAnalysisComplete(true)
  }, [])

  // Helper function to highlight keywords
  const highlightKeywords = (text: string) => {
    const keywords = ['React', 'TypeScript', 'JavaScript', 'Vue', 'Node.js', 'Webpack', '前端', '开发', '经验']
    let highlightedText = text
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`(${keyword})`, 'gi')
      highlightedText = highlightedText.replace(regex, `<mark class="bg-yellow-200 px-1 rounded">${keyword}</mark>`)
    })
    
    return <span dangerouslySetInnerHTML={{ __html: highlightedText }} />
  }

  // File upload handlers
  const handleResumeUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      setIsAnalyzing(true)
      
      // Simulate analysis
      setTimeout(() => {
        setIsAnalyzing(false)
        setAnalysisComplete(true)
        setResumeSections(mockResumeSections)
        setMatchScore(77)
        
        // Generate suggestions
        generateOptimizationSuggestions()
      }, 3000)
    }
  }, [])

  const handleJDUpload = useCallback(() => {
    jdInputRef.current?.click()
  }, [])

  // Generate optimization suggestions
  const generateOptimizationSuggestions = useCallback(() => {
    const newSuggestions: OptimizationSuggestion[] = [
      {
        id: '1',
        type: 'modify',
        section: 'experience',
        original: '负责微信小程序开发，参与用户增长项目',
        suggested: '主导微信小程序开发，负责用户增长项目，通过性能优化提升用户留存率30%',
        impact: 'high',
        reason: '添加量化数据和主导性描述，更符合高级工程师要求'
      },
      {
        id: '2',
        type: 'add',
        section: 'skills',
        suggested: 'Next.js, Redux, Jest',
        impact: 'medium',
        reason: '补充JD中提到的相关技术栈'
      },
      {
        id: '3',
        type: 'modify',
        section: 'personal',
        original: '3年前端开发经验',
        suggested: '3年前端开发经验，专注React生态系统，具备大型项目架构设计能力',
        impact: 'high',
        reason: '突出架构设计能力，匹配JD要求'
      }
    ]
    
    setSuggestions(newSuggestions)
    
    // Add AI message with suggestions
    const aiMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'ai',
      content: '我为你准备了3个优化建议，点击下方建议可以查看详情并选择是否应用：',
      timestamp: new Date(),
      suggestions: newSuggestions.map(s => s.suggested),
      actionType: 'suggestion'
    }
    
    setChatMessages(prev => [...prev, aiMessage])
    return newSuggestions
  }, [])

  // Export resume as PDF
  const exportToPDF = useCallback(() => {
    const element = document.getElementById('resume-preview');
    if (!element) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Get the resume content
    const resumeContent = element.innerHTML;
    
    // Create print-friendly HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>简历 - ${resumeSections.find(s => s.type === 'personal')?.content?.name || '简历'}</title>
          <meta charset="utf-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              line-height: 1.6;
              color: #333;
              background: white;
              padding: 20px;
            }
            .resume-container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 40px;
              box-shadow: none;
            }
            h1 { font-size: 28px; margin-bottom: 10px; color: #2563eb; }
            h2 { font-size: 20px; margin: 20px 0 10px 0; color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 5px; }
            h3 { font-size: 16px; margin: 15px 0 5px 0; color: #374151; }
            p, li { font-size: 14px; margin-bottom: 5px; }
            .contact-info { display: flex; flex-wrap: wrap; gap: 20px; margin-bottom: 20px; }
            .contact-item { display: flex; align-items: center; gap: 5px; }
            .skills-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
            .skill-item { padding: 8px 12px; background: #f3f4f6; border-radius: 6px; font-size: 13px; }
            .experience-item, .education-item { margin-bottom: 20px; }
            .date-range { color: #6b7280; font-size: 13px; }
            @media print {
              body { padding: 0; }
              .resume-container { box-shadow: none; padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="resume-container">
            ${resumeContent}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
  }, [resumeSections]);

  // Save resume data to localStorage
  const saveResume = useCallback(() => {
    try {
      const resumeToSave = {
        sections: resumeSections,
        jobDescription,
        matchScore,
        lastModified: new Date().toISOString(),
        version: '1.0'
      };
      
      localStorage.setItem('resume_data', JSON.stringify(resumeToSave));
      localStorage.setItem('resume_backup_' + Date.now(), JSON.stringify(resumeToSave));
      
      // Show success message
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'ai',
        content: '✅ 简历已成功保存到本地存储！数据已备份，您可以随时恢复。',
        timestamp: new Date(),
        suggestions: ['导出PDF版本', '继续优化简历', '查看保存历史']
      }]);
    } catch (error) {
      console.error('保存简历失败:', error);
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'ai',
        content: '❌ 保存失败，请检查浏览器存储权限或稍后重试。',
        timestamp: new Date(),
        suggestions: ['重试保存', '导出PDF备份']
      }]);
    }
  }, [resumeSections, jobDescription, matchScore]);

  // Load resume from localStorage
  const loadResume = useCallback(() => {
    try {
      const savedResume = localStorage.getItem('resume_data');
      if (savedResume) {
        const parsedResume = JSON.parse(savedResume);
        setResumeSections(parsedResume.sections || []);
        setJobDescription(parsedResume.jobDescription || null);
        setMatchScore(parsedResume.matchScore || 0);
        
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'ai',
          content: `✅ 已成功加载保存的简历数据！\n最后修改时间: ${new Date(parsedResume.lastModified || Date.now()).toLocaleString()}`,
          timestamp: new Date(),
          suggestions: ['继续编辑', '导出PDF', '重新开始']
        }]);
      } else {
        setChatMessages(prev => [...prev, {
          id: Date.now().toString(),
          type: 'ai',
          content: '未找到保存的简历数据，将使用当前模板开始编辑。',
          timestamp: new Date(),
          suggestions: ['开始编辑简历', '上传现有简历']
        }]);
      }
    } catch (error) {
      console.error('加载简历失败:', error);
    }
  }, []);

  // Apply suggestion
  const applySuggestion = useCallback((suggestionId: string) => {
    const suggestion = suggestions.find(s => s.id === suggestionId)
    if (!suggestion) return

    setResumeSections(prev => prev.map(section => {
      if (section.type === suggestion.section) {
        let newContent = { ...section.content }
        
        switch (suggestion.type) {
          case 'modify':
            if (suggestion.section === 'experience' && Array.isArray(newContent)) {
              newContent = newContent.map((exp, index) => 
                index === 0 ? { ...exp, description: suggestion.suggested } : exp
              )
            } else if (suggestion.section === 'skills') {
              newContent.technical = [...newContent.technical, ...suggestion.suggested.split(', ')]
            } else if (suggestion.section === 'personal') {
              newContent.summary = suggestion.suggested
            }
            break
          case 'add':
            if (suggestion.section === 'skills') {
              newContent.technical = [...newContent.technical, ...suggestion.suggested.split(', ')]
            }
            break
        }
        
        return { ...section, content: newContent }
      }
      return section
    }))

    // Mark suggestion as applied
    setSuggestions(prev => prev.map(s => 
      s.id === suggestionId ? { ...s, applied: true } : s
    ))

    // Add confirmation message
    const confirmMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'ai',
      content: `已应用建议：${suggestion.suggested}。你觉得这个修改怎么样？还需要进一步调整吗？`,
      timestamp: new Date(),
      actionType: 'confirmation'
    }
    
    setChatMessages(prev => [...prev, confirmMessage])
  }, [suggestions])

  // Section editing functions
  const startEditing = useCallback((sectionId: string) => {
    setResumeSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, isEditing: true } : section
    ))
  }, [])

  const cancelEditing = useCallback((sectionId: string) => {
    setResumeSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, isEditing: false } : section
    ))
  }, [])

  const saveSection = useCallback((sectionId: string, newContent: any) => {
    setResumeSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, content: newContent, isEditing: false }
        : section
    ))

    // Send AI feedback
    const feedbackMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'ai',
      content: '很好！我看到你更新了简历内容。这个修改让你的简历更加突出了。还有其他需要优化的地方吗？',
      timestamp: new Date()
    }
    
    setChatMessages(prev => [...prev, feedbackMessage])
  }, [])

  // Chat functions
  const handleSendMessage = useCallback(() => {
    if (!chatInput.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    }

    setChatMessages(prev => [...prev, userMessage])
    setChatInput('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false)
      const currentInput = chatInput
      
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: generateAIResponse(currentInput),
        timestamp: new Date(),
        suggestions: generateSuggestions(currentInput)
      }
      
      setChatMessages(prev => [...prev, aiMessage])
    }, 1500)
  }, [chatInput])

  const generateAIResponse = useCallback((userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase()
    
    if (lowerMessage.includes('确认') || lowerMessage.includes('同意') || lowerMessage.includes('好的')) {
      return '太好了！我会立即为你应用这个修改。让我们继续优化其他部分，你希望接下来重点关注哪个方面？'
    }
    
    if (lowerMessage.includes('不') || lowerMessage.includes('取消') || lowerMessage.includes('不要')) {
      return '没问题，我们可以尝试其他的优化方向。你有什么具体的想法吗？或者我可以为你提供其他建议。'
    }
    
    if (lowerMessage.includes('经验')) {
      return '关于工作经验的优化，我建议：\n\n1. 添加具体的数据和成果\n2. 使用更有影响力的动词\n3. 突出与目标职位相关的技能\n\n你希望我详细展开哪一点？'
    }
    
    if (lowerMessage.includes('技能')) {
      return '技能部分的优化建议：\n\n1. 按重要性重新排序技能\n2. 添加JD中提到但你简历缺少的技能\n3. 移除过时或不相关的技能\n\n需要我帮你具体调整吗？'
    }
    
    if (lowerMessage.includes('格式') || lowerMessage.includes('排版')) {
      return '格式优化方面，我可以帮你：\n\n1. 调整各部分的顺序和布局\n2. 优化字体和间距\n3. 改进视觉层次结构\n\n你觉得当前格式哪里需要改进？'
    }
    
    // Default response with interactive suggestions
    return '我正在分析您的简历内容。基于当前的JD匹配情况，我建议我们可以从以下几个方面进行优化：\n\n1. 调整关键词以提高匹配度\n2. 重新组织经验描述的逻辑\n3. 优化技能展示的顺序\n\n您希望我详细解释哪个方面？我会在实施任何修改前都征求您的确认。'
  }, [])

  // Generate interactive suggestions based on context
  const generateSuggestions = useCallback((userMessage: string): string[] => {
    const lowerMessage = userMessage.toLowerCase()
    
    if (lowerMessage.includes('经验')) {
      return [
        '优化第一段工作经验',
        '添加量化数据',
        '调整经验顺序',
        '突出相关技能'
      ]
    }
    
    if (lowerMessage.includes('技能')) {
      return [
        '重新排序技能',
        '添加热门技能',
        '移除过时技能',
        '按重要性分类'
      ]
    }
    
    if (lowerMessage.includes('格式')) {
      return [
        '调整字体大小',
        '优化间距',
        '改进布局',
        '统一格式风格'
      ]
    }
    
    return [
      '开始全面优化',
      '分析匹配度',
      '查看具体建议',
      '预览修改效果'
    ]
  }, [])

  // Render JD Panel
  const renderJobDescriptionPanel = () => (
    <div className="h-full bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl border-r border-slate-600/50 flex flex-col relative overflow-hidden">
      {/* Panel Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5"></div>
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/10 rounded-full blur-2xl animate-pulse"></div>
      
      <div className="relative p-6 border-b border-slate-600/50 bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center animate-fadeIn">
            <div className="relative mr-3">
              <Briefcase className="w-5 h-5 text-cyan-400 animate-float" />
              <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
            </div>
            职位描述
          </h2>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-gradient-to-r from-emerald-500/20 to-green-500/20 px-3 py-1 rounded-full border border-emerald-400/30 shadow-lg animate-glow">
              <Gauge className="w-4 h-4 text-emerald-400 mr-1 animate-pulse" />
              <span className="text-sm font-medium text-emerald-300">匹配度 {matchScore}%</span>
            </div>
            <button
              onClick={() => jdInputRef.current?.click()}
              className="px-3 py-1 text-sm bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 rounded-lg transition-all duration-300 border border-purple-400/30 hover:border-purple-400/50 group relative flex items-center space-x-1"
              title="重新上传职位描述文件"
            >
              <RefreshCw className="w-3 h-3 text-purple-400 group-hover:animate-spin" />
              <span className="holographic-text">更换JD</span>
              <div className="absolute inset-0 bg-purple-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
            </button>
          </div>
        </div>
        
        {/* JD Analysis Summary */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="glass-card neon-border p-3 rounded-xl shadow-lg animate-fadeIn relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-cyan-500/5"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-300">关键技能匹配</span>
                <div className="relative">
                  <Target className="w-4 h-4 text-blue-400 animate-float" />
                  <div className="absolute inset-0 bg-blue-400/20 rounded-full animate-ping"></div>
                </div>
              </div>
              <div className="text-lg font-semibold holographic-text mt-1">8/10</div>
              <div className="absolute top-1 right-1 w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="glass-card neon-border p-3 rounded-xl shadow-lg animate-fadeIn relative overflow-hidden" style={{animationDelay: '0.1s'}}>
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/5"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-300">经验匹配</span>
                <div className="relative">
                  <TrendingUp className="w-4 h-4 text-green-400 animate-float" />
                  <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping"></div>
                </div>
              </div>
              <div className="text-lg font-semibold holographic-text mt-1">85%</div>
              <div className="absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="glass-card neon-border p-3 rounded-xl shadow-lg animate-fadeIn relative overflow-hidden" style={{animationDelay: '0.2s'}}>
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-yellow-500/5"></div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm text-orange-300">待优化项</span>
                <div className="relative">
                  <AlertCircle className="w-4 h-4 text-orange-400 animate-float" />
                  <div className="absolute inset-0 bg-orange-400/20 rounded-full animate-ping"></div>
                </div>
              </div>
              <div className="text-lg font-semibold holographic-text mt-1">3项</div>
              <div className="absolute top-1 right-1 w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative">
        {jobDescription ? (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-gradient-to-br from-slate-700/60 to-slate-600/60 backdrop-blur-sm border border-slate-500/30 p-4 rounded-xl shadow-xl animate-fadeIn">
              <h3 className="font-semibold text-white mb-2 flex items-center">
                <Briefcase className="w-5 h-5 mr-2 text-cyan-400" />
                {jobDescription.title}
              </h3>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-center">
                  <Building2 className="w-4 h-4 mr-2 text-blue-400" />
                  {jobDescription.company}
                </div>
                <div className="flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-green-400" />
                  {jobDescription.location}
                </div>
                <div className="flex items-center">
                  <DollarSign className="w-4 h-4 mr-2 text-yellow-400" />
                  {jobDescription.salary}
                </div>
              </div>
            </div>

            {/* Job Description */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">职位描述</h4>
              <p className="text-sm text-gray-600 leading-relaxed">{jobDescription.description}</p>
            </div>

            {/* Requirements with highlighting */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                任职要求
              </h4>
              <ul className="space-y-2">
                {jobDescription.requirements.map((req, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start">
                    <span className="w-2 h-2 bg-blue-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span className="leading-relaxed">{highlightKeywords(req)}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Responsibilities */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <Users className="w-4 h-4 mr-2 text-blue-600" />
                工作职责
              </h4>
              <ul className="space-y-2">
                {jobDescription.responsibilities.map((resp, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start">
                    <span className="w-2 h-2 bg-green-400 rounded-full mt-2 mr-3 flex-shrink-0"></span>
                    <span className="leading-relaxed">{resp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Skills with match indicators */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                <div className="relative mr-2">
                  <Code className="w-4 h-4 text-purple-600 animate-float" />
                  <div className="absolute inset-0 bg-purple-400/20 rounded-full animate-ping"></div>
                </div>
                <span className="holographic-text">技能要求</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {jobDescription.skills.map((skill, index) => {
                  const isMatched = resumeSections.find(s => s.type === 'skills')?.content?.technical?.includes(skill)
                  return (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 hover:scale-105 ${
                        isMatched
                          ? 'glass-card neon-border bg-gradient-to-r from-green-400/20 to-emerald-400/20 text-green-700 border-green-400/50 shadow-lg shadow-green-400/20 animate-pulse-glow'
                          : 'glass-card bg-gradient-to-r from-red-400/10 to-pink-400/10 text-red-600 border border-red-300/30 hover:border-red-400/50'
                      }`}
                    >
                      <div className="flex items-center">
                        {isMatched && (
                          <div className="relative mr-1">
                            <CheckCircle className="w-3 h-3 text-green-500 animate-float" />
                            <div className="absolute inset-0 bg-green-400/30 rounded-full animate-ping"></div>
                          </div>
                        )}
                        {!isMatched && (
                          <div className="relative mr-1">
                            <AlertCircle className="w-3 h-3 text-red-500 animate-pulse" />
                          </div>
                        )}
                        <span className={isMatched ? 'holographic-text' : ''}>{skill}</span>
                      </div>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 relative">
            {/* Empty State Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-700/20"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-full blur-3xl animate-pulse"></div>
            
            <div className="relative z-10 text-center">
              <div className="relative mb-6">
                <FileText className="w-16 h-16 mx-auto text-purple-400 animate-float" />
                <div className="absolute inset-0 bg-purple-400/20 rounded-full blur-xl animate-pulse"></div>
              </div>
              <p className="text-center mb-6 text-lg text-slate-300">请上传职位描述文件</p>
              <button
                onClick={() => jdInputRef.current?.click()}
                className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-300 shadow-lg hover:shadow-purple-500/25 animate-shimmer group relative overflow-hidden"
                title="点击上传职位描述文件 (支持PDF、DOC、DOCX、TXT格式)"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Upload className="w-5 h-5 inline mr-2 animate-bounce" />
                <span className="holographic-text">上传JD文件</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Render Resume Panel
  const renderResumePanel = () => (
    <div className="h-full bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl border-r border-slate-600/50 flex flex-col relative overflow-hidden">
      {/* Panel Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-blue-500/5"></div>
      <div className="absolute top-0 left-0 w-32 h-32 bg-green-400/10 rounded-full blur-2xl animate-pulse"></div>
      
      <div className="relative p-6 border-b border-slate-600/50 bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center animate-fadeIn">
            <div className="relative mr-3">
              <FileText className="w-5 h-5 text-green-400 animate-float" />
              <div className="absolute inset-0 bg-green-400/20 rounded-full animate-ping"></div>
            </div>
            简历预览
          </h2>
          <div className="flex items-center space-x-2">
            <button 
              onClick={exportToPDF}
              className="px-3 py-1 text-sm bg-gradient-to-r from-green-500/20 to-emerald-500/20 text-green-300 rounded-lg hover:from-green-500/30 hover:to-emerald-500/30 transition-all duration-300 border border-green-400/30 animate-shimmer"
            >
              <Download className="w-4 h-4 inline mr-1" />
              导出PDF
            </button>
            <button 
              onClick={saveResume}
              className="px-3 py-1 text-sm bg-gradient-to-r from-purple-500/20 to-violet-500/20 text-purple-300 rounded-lg hover:from-purple-500/30 hover:to-violet-500/30 transition-all duration-300 border border-purple-400/30"
            >
              <Save className="w-4 h-4 inline mr-1" />
              保存
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 text-sm bg-gradient-to-r from-blue-500/20 to-cyan-500/20 text-blue-300 rounded-lg hover:from-blue-500/30 hover:to-cyan-500/30 transition-all duration-300 border border-blue-400/30"
            >
              <Upload className="w-4 h-4 inline mr-1" />
              上传简历
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 relative" id="resume-preview">
        {/* Content Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-800/10 to-transparent pointer-events-none"></div>
        
        {analysisComplete ? (
          <div className="space-y-6 relative z-10">
            {resumeSections.map((section, index) => (
              <div key={section.id} className="bg-gradient-to-br from-slate-700/80 via-slate-600/80 to-slate-700/80 backdrop-blur-lg border border-slate-500/30 rounded-xl p-6 shadow-2xl hover:shadow-cyan-500/10 transition-all duration-500 animate-fadeIn relative overflow-hidden group" style={{animationDelay: `${index * 100}ms`}}>
                {/* Card Background Effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-400/10 to-purple-400/10 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                
                <div className="flex items-center justify-between mb-4 relative z-10">
                  <h3 className="text-lg font-semibold text-white flex items-center">
                    <div className="relative mr-3">
                      <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                      <div className="absolute inset-0 bg-cyan-400/30 rounded-full animate-ping"></div>
                    </div>
                    <span className="holographic-text">{section.title}</span>
                  </h3>
                  <button
                    onClick={() => startEditing(section.id)}
                    className="p-2 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-all duration-300 group/btn relative"
                  >
                    <div className="relative">
                      <Edit3 className="w-4 h-4 group-hover/btn:animate-pulse" />
                      <div className="absolute inset-0 bg-cyan-400/20 rounded-full opacity-0 group-hover/btn:opacity-100 animate-ping"></div>
                    </div>
                  </button>
                </div>

                {section.isEditing ? (
                  <div className="space-y-4 relative z-10">
                    {/* Render editable content based on section type */}
                    {section.type === 'personal' && (
                      <div className="space-y-3">
                        <input
                          type="text"
                          defaultValue={section.content.name}
                          className="w-full p-3 bg-slate-800/50 border border-slate-500/50 rounded-lg text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                          placeholder="姓名"
                        />
                        <input
                          type="text"
                          defaultValue={section.content.title}
                          className="w-full p-3 bg-slate-800/50 border border-slate-500/50 rounded-lg text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300"
                          placeholder="职位"
                        />
                        <textarea
                          defaultValue={section.content.summary}
                          className="w-full p-3 bg-slate-800/50 border border-slate-500/50 rounded-lg h-20 text-white placeholder-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 resize-none"
                          placeholder="个人总结"
                        />
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => saveSection(section.id, section.content)}
                        className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25"
                      >
                        保存
                      </button>
                      <button
                        onClick={() => cancelEditing(section.id)}
                        className="px-4 py-2 bg-slate-600/50 text-slate-300 rounded-lg hover:bg-slate-500/50 transition-all duration-300"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10">
                    {/* Render static content based on section type */}
                    {section.type === 'personal' && (
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-white flex items-center">
                          <div className="relative mr-2">
                            <User className="w-5 h-5 text-cyan-400 animate-float" />
                            <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
                          </div>
                          <span className="holographic-text">{section.content.name}</span>
                        </h4>
                        <p className="text-lg text-cyan-300 flex items-center">
                          <div className="relative mr-2">
                            <Briefcase className="w-4 h-4 text-cyan-400 animate-pulse" />
                          </div>
                          {section.content.title}
                        </p>
                        <p className="text-sm text-slate-300 flex items-start">
                          <div className="relative mr-2 mt-1">
                            <FileText className="w-3 h-3 text-slate-400" />
                          </div>
                          {section.content.summary}
                        </p>
                      </div>
                    )}
                    
                    {section.type === 'experience' && (
                      <div className="space-y-4">
                        {section.content.map((exp: any, index: number) => (
                          <div key={index} className="glass-card border-l-4 border-cyan-400/50 pl-4 hover:border-cyan-400 transition-all duration-300 p-3 rounded-r-lg">
                            <h5 className="font-semibold text-white flex items-center">
                              <div className="relative mr-2">
                                <Briefcase className="w-4 h-4 text-cyan-400 animate-float" />
                                <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
                              </div>
                              <span className="holographic-text">{exp.position}</span>
                            </h5>
                            <p className="text-sm text-cyan-300 flex items-center mt-1">
                              <div className="relative mr-2">
                                <Building2 className="w-3 h-3 text-cyan-400" />
                              </div>
                              {exp.company}
                              <div className="relative mx-2">
                                <Clock className="w-3 h-3 text-slate-400" />
                              </div>
                              {exp.duration}
                            </p>
                            <p className="text-sm text-slate-300 mt-2 flex items-start">
                              <div className="relative mr-2 mt-1">
                                <Activity className="w-3 h-3 text-slate-400 animate-pulse" />
                              </div>
                              {exp.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {section.type === 'skills' && (
                      <div className="space-y-3">
                        <div>
                          <h5 className="font-medium text-white mb-2 flex items-center">
                            <div className="relative mr-2">
                              <Code className="w-4 h-4 text-cyan-400 animate-float" />
                              <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
                            </div>
                            <span className="holographic-text">技术技能</span>
                          </h5>
                          <div className="flex flex-wrap gap-2">
                            {section.content.technical.map((skill: string, index: number) => (
                              <span key={index} className="glass-card neon-border px-3 py-1 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 rounded-full text-sm border-cyan-400/30 hover:from-cyan-500/30 hover:to-blue-500/30 transition-all duration-300 animate-pulse-glow hover:scale-105">
                                <div className="flex items-center">
                                  <div className="relative mr-1">
                                    <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                                  </div>
                                  <span className="holographic-text">{skill}</span>
                                </div>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {section.type === 'education' && (
                      <div className="glass-card p-4 rounded-lg">
                        <h5 className="font-semibold text-white flex items-center">
                          <div className="relative mr-2">
                            <GraduationCap className="w-4 h-4 text-cyan-400 animate-float" />
                            <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
                          </div>
                          <span className="holographic-text">{section.content.degree} • {section.content.major}</span>
                        </h5>
                        <p className="text-sm text-cyan-300 flex items-center mt-1">
                          <div className="relative mr-2">
                            <Building2 className="w-3 h-3 text-cyan-400" />
                          </div>
                          {section.content.school}
                          <div className="relative mx-2">
                            <Calendar className="w-3 h-3 text-slate-400" />
                          </div>
                          {section.content.duration}
                        </p>
                        <p className="text-sm text-slate-300 flex items-center mt-1">
                          <div className="relative mr-2">
                            <Star className="w-3 h-3 text-yellow-400 animate-pulse" />
                          </div>
                          GPA: {section.content.gpa}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 relative">
            {/* Empty State Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-700/20"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gradient-to-br from-cyan-500/5 to-purple-500/5 rounded-full blur-3xl animate-pulse"></div>
            
            <div className="relative z-10 text-center">
              <div className="relative mb-6">
                <Upload className="w-16 h-16 mx-auto text-cyan-400 animate-float" />
                <div className="absolute inset-0 bg-cyan-400/20 rounded-full blur-xl animate-pulse"></div>
              </div>
              <p className="text-center mb-6 text-lg text-slate-300">请上传你的简历文件</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 animate-shimmer group relative overflow-hidden"
                title="点击上传简历文件 (支持PDF、DOC、DOCX格式)"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Upload className="w-5 h-5 inline mr-2 animate-bounce" />
                <span className="holographic-text">选择简历文件</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  // Render AI Copilot Panel
  const renderAICopilotPanel = () => (
    <div className="h-full bg-gradient-to-br from-slate-800/90 via-slate-700/90 to-slate-800/90 backdrop-blur-xl flex flex-col relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-br from-cyan-400/30 to-purple-400/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 left-10 w-24 h-24 bg-gradient-to-br from-purple-400/30 to-pink-400/30 rounded-full blur-2xl animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </div>
      
      <div className="relative p-6 border-b border-slate-600/50 bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-white flex items-center animate-fadeIn">
            <div className="relative mr-3">
              <AIAvatar size="w-5 h-5" />
            </div>
            AI Copilot
          </h2>
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-gradient-to-r from-green-500/20 to-emerald-500/20 px-3 py-1 rounded-full border border-green-400/30 shadow-lg">
              <Activity className="w-4 h-4 text-green-400 mr-1 animate-pulse" />
              <span className="text-sm font-medium text-green-300">在线</span>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-purple-500/10 p-4 rounded-xl border border-cyan-400/30 shadow-lg backdrop-blur-sm">
          <div className="flex items-start space-x-3">
            <div className="relative">
              <Sparkles className="w-5 h-5 text-cyan-400 mt-0.5 animate-spin" style={{animationDuration: '3s'}} />
              <div className="absolute inset-0 w-5 h-5 bg-cyan-400/30 rounded-full animate-ping"></div>
            </div>
            <div>
              <p className="text-sm text-cyan-300 font-medium">AI 助手已就绪</p>
              <p className="text-xs text-slate-300 mt-1">我会帮你优化简历，每次修改都会征求你的确认</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="relative flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-transparent via-slate-800/10 to-transparent">
        {chatMessages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
            <div className={`max-w-[80%] rounded-2xl p-4 transform transition-all duration-300 hover:scale-[1.02] relative overflow-hidden ${
              message.type === 'user' 
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/30' 
                : 'bg-gradient-to-br from-slate-700/90 to-slate-600/90 backdrop-blur-lg border border-slate-500/30 text-white shadow-lg shadow-slate-900/50'
            }`}>
              {/* Message Background Effects */}
              {message.type === 'ai' && (
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5 opacity-50"></div>
              )}
              
              <div className="flex items-start space-x-2 relative z-10">
                {message.type === 'ai' && (
                  <div className="relative">
                    <Brain className="w-4 h-4 text-cyan-400 mt-0.5 flex-shrink-0 animate-pulse" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-ping"></div>
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-line leading-relaxed">{message.content}</p>
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-slate-300 flex items-center">
                        <Lightbulb className="w-3 h-3 mr-1 text-yellow-400 animate-pulse" />
                        建议操作:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {message.suggestions.map((suggestion, index) => (
                          <button
                            key={index}
                            onClick={() => setChatInput(suggestion)}
                            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 text-cyan-300 rounded-full text-xs font-medium border border-cyan-400/30 transition-all duration-200 hover:scale-105 hover:shadow-lg transform"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="text-xs opacity-70 mt-2 flex items-center relative z-10">
                <Clock className="w-3 h-3 mr-1" />
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start animate-fadeIn">
            <div className="bg-gradient-to-br from-slate-700/90 to-slate-600/90 backdrop-blur-lg border border-slate-500/30 rounded-2xl p-4 shadow-lg relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-purple-500/5"></div>
              <div className="flex items-center space-x-2 relative z-10">
                <AIAvatar size="w-4 h-4" />
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
                <span className="text-xs text-slate-300">AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="relative px-6 py-4 bg-white/60 backdrop-blur-sm border-b border-blue-100">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
          <Zap className="w-4 h-4 mr-2 text-yellow-500 animate-bounce" />
          快速操作
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Users, label: '优化个人信息', color: 'blue', action: () => setChatInput('请帮我优化个人信息部分') },
            { icon: Briefcase, label: '完善工作经验', color: 'green', action: () => setChatInput('请帮我完善工作经验') },
            { icon: Award, label: '突出技能优势', color: 'purple', action: () => setChatInput('请帮我突出技能优势') },
            { icon: Save, label: '保存简历', color: 'indigo', action: saveResume },
            { icon: Download, label: '导出PDF', color: 'emerald', action: exportToPDF },
            { icon: RefreshCw, label: '加载简历', color: 'orange', action: loadResume }
          ].map((item, index) => (
            <button
              key={index}
              onClick={item.action}
              className={`group relative p-3 rounded-xl border-2 border-${item.color}-200 bg-gradient-to-br from-${item.color}-50 to-${item.color}-100 hover:from-${item.color}-100 hover:to-${item.color}-200 transition-all duration-300 hover:scale-105 hover:shadow-lg transform`}
            >
              <div className="flex flex-col items-center space-y-2">
                <div className={`relative p-2 rounded-lg bg-${item.color}-200 group-hover:bg-${item.color}-300 transition-colors`}>
                  <item.icon className={`w-4 h-4 text-${item.color}-600`} />
                  <div className={`absolute inset-0 bg-${item.color}-400 rounded-lg opacity-0 group-hover:opacity-20 transition-opacity animate-pulse`}></div>
                </div>
                <span className={`text-xs font-medium text-${item.color}-700 text-center leading-tight`}>
                  {item.label}
                </span>
              </div>
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-r from-${item.color}-400 to-${item.color}-600 opacity-0 group-hover:opacity-10 transition-opacity`}></div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input */}
      <div className="relative p-6 bg-white/80 backdrop-blur-sm border-t border-blue-200">
        <div className="relative">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="描述你想要的简历优化..."
                className="w-full px-4 py-3 pr-12 border-2 border-blue-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white/90 backdrop-blur-sm shadow-inner transition-all duration-300 hover:shadow-lg"
                rows={3}
              />
              <div className="absolute right-3 bottom-3 flex items-center space-x-2">
                <div className="text-xs text-gray-400 flex items-center">
                  Enter发送
                </div>
              </div>
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || isTyping}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg transform disabled:scale-100 disabled:shadow-none flex items-center space-x-2 min-w-[100px] justify-center"
            >
              {isTyping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>发送中</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>发送</span>
                </>
              )}
            </button>
          </div>
          
          {/* Input suggestions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {['优化工作经验', '调整技能顺序', '改进个人总结', '检查格式'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setChatInput(suggestion)}
                className="px-3 py-1.5 bg-gradient-to-r from-gray-100 to-gray-200 hover:from-blue-100 hover:to-blue-200 text-gray-600 hover:text-blue-700 rounded-full text-xs font-medium border border-gray-200 hover:border-blue-300 transition-all duration-200 hover:scale-105 transform"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Advanced Background Effects */}
      <div className="absolute inset-0">
        {/* Animated Grid Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
            animation: 'grid-move 20s linear infinite'
          }}></div>
        </div>
        
        {/* Enhanced Floating Orbs */}
        <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-blue-500/30 to-cyan-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-32 w-48 h-48 bg-gradient-to-br from-purple-500/30 to-pink-500/20 rounded-full blur-2xl animate-pulse" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-32 left-1/3 w-56 h-56 bg-gradient-to-br from-cyan-500/30 to-blue-500/20 rounded-full blur-3xl animate-pulse" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-40 h-40 bg-gradient-to-br from-emerald-500/25 to-teal-500/15 rounded-full blur-2xl animate-pulse" style={{animationDelay: '6s'}}></div>
        
        {/* Data Flow Lines */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400/30 to-transparent animate-data-flow"></div>
          <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent animate-data-flow" style={{animationDelay: '2s'}}></div>
          <div className="absolute top-3/4 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-purple-400/30 to-transparent animate-data-flow" style={{animationDelay: '4s'}}></div>
        </div>
        
        {/* Neural Network Lines */}
        <svg className="absolute inset-0 w-full h-full opacity-15" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8"/>
              <stop offset="25%" stopColor="#3b82f6" stopOpacity="0.6"/>
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.6"/>
              <stop offset="75%" stopColor="#06b6d4" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4"/>
            </linearGradient>
            <linearGradient id="lineGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.6"/>
              <stop offset="50%" stopColor="#ef4444" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.6"/>
            </linearGradient>
          </defs>
          
          {/* Main network paths */}
          <path d="M100,200 Q300,100 500,200 T900,200" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse"/>
          <path d="M200,400 Q400,300 600,400 T1000,400" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" style={{animationDelay: '1s'}}/>
          <path d="M50,600 Q350,500 650,600 T1050,600" stroke="url(#lineGradient)" strokeWidth="2" fill="none" className="animate-pulse" style={{animationDelay: '2s'}}/>
          
          {/* Cross connections */}
          <path d="M150,150 Q400,250 650,150 Q900,250 1150,150" stroke="url(#lineGradient2)" strokeWidth="1.5" fill="none" className="animate-pulse" style={{animationDelay: '3s'}}/>
          <path d="M100,350 Q350,450 600,350 Q850,450 1100,350" stroke="url(#lineGradient2)" strokeWidth="1.5" fill="none" className="animate-pulse" style={{animationDelay: '4s'}}/>
          
          {/* Network nodes */}
          <circle cx="300" cy="200" r="4" fill="#22d3ee" opacity="0.6" className="animate-pulse"/>
          <circle cx="500" cy="200" r="3" fill="#3b82f6" opacity="0.5" className="animate-pulse" style={{animationDelay: '1s'}}/>
          <circle cx="700" cy="200" r="4" fill="#8b5cf6" opacity="0.6" className="animate-pulse" style={{animationDelay: '2s'}}/>
          <circle cx="400" cy="400" r="3" fill="#06b6d4" opacity="0.5" className="animate-pulse" style={{animationDelay: '3s'}}/>
          <circle cx="600" cy="400" r="4" fill="#10b981" opacity="0.6" className="animate-pulse" style={{animationDelay: '4s'}}/>
        </svg>
        
        {/* Particle System */}
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({length: 20}).map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-cyan-400/40 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${3 + Math.random() * 4}s`
              }}
            />
          ))}
        </div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        onChange={handleResumeUpload}
        className="hidden"
      />
      <input
        ref={jdInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt"
        onChange={handleJDUpload}
        className="hidden"
      />

      {/* Header Section */}
      <div className="relative z-20 glass-card border-b border-slate-600/30 backdrop-blur-xl">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center animate-pulse-glow">
                  <Brain className="w-6 h-6 text-white animate-float" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full animate-ping"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold holographic-text">AI 简历优化助手</h1>
                <p className="text-slate-300 text-sm mt-1">智能分析 · 精准匹配 · 专业优化</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Status Indicators */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-600/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-slate-300">AI 在线</span>
                </div>
                
                {analysisComplete && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-lg border border-cyan-400/30 animate-fadeIn">
                    <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                    <span className="text-xs text-cyan-300">分析完成</span>
                  </div>
                )}
                
                {matchScore > 0 && (
                  <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg border border-green-400/30 animate-fadeIn">
                    <Target className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-300">匹配度 {matchScore}%</span>
                  </div>
                )}
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => window.location.reload()}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 transition-all duration-300 hover:border-cyan-400/50 group relative"
                  title="刷新页面"
                >
                  <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors group-hover:animate-spin" />
                  <div className="absolute inset-0 bg-cyan-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
                <button 
                  onClick={exportToPDF}
                  className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-slate-600/30 transition-all duration-300 hover:border-cyan-400/50 group relative"
                  title="导出简历PDF"
                >
                  <Download className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                  <div className="absolute inset-0 bg-cyan-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 rounded-lg border border-cyan-400/30 transition-all duration-300 hover:border-cyan-400/50 group relative flex items-center space-x-2"
                  title="上传简历文件"
                >
                  <Upload className="w-4 h-4 text-cyan-400 group-hover:animate-bounce" />
                  <span className="text-sm text-cyan-300 holographic-text">上传简历</span>
                  <div className="absolute inset-0 bg-cyan-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
                <button 
                  onClick={() => jdInputRef.current?.click()}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 rounded-lg border border-purple-400/30 transition-all duration-300 hover:border-purple-400/50 group relative flex items-center space-x-2"
                  title="上传职位描述文件"
                >
                  <FileText className="w-4 h-4 text-purple-400 group-hover:animate-bounce" />
                  <span className="text-sm text-purple-300 holographic-text">上传JD</span>
                  <div className="absolute inset-0 bg-purple-400/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="h-[calc(100vh-120px)] flex relative z-10">
        {/* Left Panel - Job Description */}
        <div className="w-1/3 border-r border-slate-600/30 flex flex-col min-h-0">
          {renderJobDescriptionPanel()}
        </div>

        {/* Middle Panel - Resume Preview */}
        <div className="w-1/3 border-r border-slate-600/30 flex flex-col min-h-0">
          {renderResumePanel()}
        </div>

        {/* Right Panel - AI Copilot */}
        <div className="w-1/3 flex flex-col min-h-0">
          {renderAICopilotPanel()}
        </div>
      </div>
    </div>
  )
}