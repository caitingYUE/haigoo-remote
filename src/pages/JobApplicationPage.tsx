import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, FileText, CheckCircle, Bot } from 'lucide-react';
import { aiService } from '../services/ai-service';

interface JobDetail {
  id: number;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
}

interface ChatMessage {
  id: number;
  type: 'ai' | 'user' | 'suggestion';
  content: string;
  suggestions?: string[];
}

const JobApplicationPage: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [matchScore] = useState(85);
  const [isLoading, setIsLoading] = useState(false);
  const [apiProgress, setApiProgress] = useState<string>('');
  const [apiError, setApiError] = useState<string>('');
  
  // 获取导航状态信息
  const navigationState = location.state as {
    job?: any;
    returnToModal?: boolean;
    previousPath?: string;
    jobDetailPageState?: {
      showModal?: boolean;
      activeTab?: string;
      isBookmarked?: boolean;
      matchScore?: number;
    };
  } | null;

  // 从导航状态或默认数据获取岗位信息
  const getJobDetail = (): JobDetail => {
    if (navigationState?.job) {
      // 使用从模态框传递的真实岗位数据
      const job = navigationState.job;
      return {
        id: parseInt(job.id),
        title: job.title,
        company: job.company,
        location: job.location,
        salary: job.salary.currency === 'CNY' 
          ? `${(job.salary.min / 1000).toFixed(0)}-${(job.salary.max / 1000).toFixed(0)}K`
          : `${job.salary.min}-${job.salary.max} ${job.salary.currency}`,
        description: job.description,
        requirements: job.requirements || [],
        responsibilities: job.responsibilities || [],
        benefits: [
          '五险一金 + 补充商业保险',
          '年终奖金 + 股票期权',
          '弹性工作制，支持远程办公',
          '技术培训 + 会议学习机会',
          '团队建设活动 + 年度旅游',
          '免费三餐 + 下午茶',
          '健身房 + 按摩椅',
          '带薪年假 + 生日假',
          '内推奖励 + 晋升通道'
        ]
      };
    }
    
    // 默认数据（作为后备）
    return {
      id: 1,
      title: '高级前端工程师',
      company: '字节跳动',
      location: '北京/远程',
      salary: '25-40K',
      description: '负责公司核心产品的前端开发工作，参与产品架构设计和技术选型。我们正在寻找一位有经验的前端工程师，加入我们的技术团队，共同打造下一代互联网产品。你将有机会参与从0到1的产品开发，使用最新的前端技术栈，与优秀的团队成员一起工作。',
      requirements: [
        '3年以上前端开发经验，有扎实的JavaScript基础',
        '熟练掌握React/Vue等现代前端框架，了解其原理',
        '有大型项目经验，能够独立负责复杂功能模块',
        '熟悉前端工程化工具，如Webpack、Vite等',
        '了解TypeScript，有实际项目经验优先',
        '具备良好的代码规范和团队协作能力',
        '对新技术有敏锐度，学习能力强'
      ],
      responsibilities: [
        '负责前端架构设计，制定技术方案和开发规范',
        '参与产品需求分析，与产品、设计团队紧密配合',
        '代码审查和优化，保证代码质量和性能',
        '指导初级开发者，分享技术经验',
        '参与技术选型，推动前端技术栈升级',
        '负责关键功能模块的开发和维护',
        '优化用户体验，提升产品性能'
      ],
      benefits: [
        '五险一金 + 补充商业保险',
        '年终奖金 + 股票期权',
        '弹性工作制，支持远程办公',
        '技术培训 + 会议学习机会',
        '团队建设活动 + 年度旅游',
        '免费三餐 + 下午茶',
        '健身房 + 按摩椅',
        '带薪年假 + 生日假',
        '内推奖励 + 晋升通道'
      ]
    };
  };

  const jobDetail = getJobDetail();
  
  // AI头像组件
  const AIAvatar = ({ size = 'w-7 h-7' }: { size?: string }) => {
    // 根据头像大小动态调整图标大小
    const getIconSize = (avatarSize: string) => {
      if (avatarSize.includes('w-5') || avatarSize.includes('h-5')) return 'w-3 h-3';
      if (avatarSize.includes('w-6') || avatarSize.includes('h-6')) return 'w-3.5 h-3.5';
      if (avatarSize.includes('w-7') || avatarSize.includes('h-7')) return 'w-4 h-4';
      if (avatarSize.includes('w-8') || avatarSize.includes('h-8')) return 'w-4 h-4';
      return 'w-4 h-4'; // 默认大小
    };

    const iconSize = getIconSize(size);

    return (
      <div className={`${size} bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0`}>
        <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
        <Bot className={`${iconSize} text-white relative z-10`} />
        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
      </div>
    );
  };

  // 格式化AI消息内容的组件
  const FormattedAIMessage = ({ content }: { content: string }) => {
    // 将内容按段落分割
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    const formatParagraph = (text: string) => {
      // 检测是否为列表项
      if (text.includes('•') || text.includes('-') || text.includes('*')) {
        const items = text.split(/[•\-*]/).filter(item => item.trim());
        if (items.length > 1) {
          return (
            <ul className="space-y-1 ml-4">
              {items.slice(1).map((item, index) => (
                <li key={index} className="flex items-start">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                  <span className="text-gray-700">{item.trim()}</span>
                </li>
              ))}
            </ul>
          );
        }
      }
      
      // 检测是否为标题（包含冒号或全大写）
      if (text.includes('：') || text.includes(':')) {
        const parts = text.split(/[：:]/);
        if (parts.length === 2) {
          return (
            <div className="mb-2">
              <h4 className="font-semibold text-gray-900 mb-1">{parts[0].trim()}</h4>
              <p className="text-gray-700 leading-relaxed">{parts[1].trim()}</p>
            </div>
          );
        }
      }
      
      // 普通段落
      return <p className="text-gray-700 leading-relaxed mb-2">{text}</p>;
    };

    return (
      <div className="space-y-3">
        {paragraphs.map((paragraph, index) => (
          <div key={index}>
            {formatParagraph(paragraph)}
          </div>
        ))}
      </div>
    );
  };

  // 进度指示器组件
  const ProgressIndicator = () => (
    <div className="flex items-center space-x-2 text-xs text-gray-500 bg-blue-50 px-3 py-2 rounded-lg border border-blue-200">
      <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span>{apiProgress || '正在处理您的请求...'}</span>
    </div>
  );

  // 错误指示器组件
  const ErrorIndicator = ({ error }: { error: string }) => (
    <div className="flex items-center space-x-2 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-200">
      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
      <span>错误: {error}</span>
    </div>
  );

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      type: 'ai',
      content: '你好！我已经分析了你的简历和这个岗位的匹配度，让我来帮助你优化申请材料，提高成功率。'
    },
    {
      id: 2,
      type: 'suggestion',
      content: '基于你的简历分析，我发现了一些可以优化的地方：',
      suggestions: [
        '补充Webpack项目经验',
        '完善大型项目经验',
        '更新技术栈描述'
      ]
    },
    {
      id: 3,
      type: 'user',
      content: '我想了解一下这个岗位的具体要求'
    },
    {
      id: 4,
      type: 'ai',
      content: '这个岗位主要需要：1）3年以上前端开发经验 2）精通React和TypeScript 3）有大型项目经验。根据你的简历，匹配度很高，建议重点突出你的React项目经验。'
    }
  ]);

  const handleBack = () => {
    console.log('handleBack called');
    console.log('navigationState:', navigationState);
    console.log('jobId:', jobId);
    
    // 优先：直接回退到上一页，避免创建新的历史记录
    if (navigationState?.previousPath?.startsWith('/job/')) {
      console.log('Go back to previous job detail via history');
      navigate(-1);
      return;
    }

    // 从岗位列表进入的情况：需要带状态返回列表并重开模态
    if (navigationState?.previousPath === '/jobs') {
      console.log('Returning to jobs page with modal');
      navigate('/jobs', { 
        state: { 
          reopenJobDetail: true, 
          jobId: jobId 
        } 
      });
      return;
    }

    // 其他从模态进入的情况：返回到之前页面并重开模态
    if (navigationState?.returnToModal && navigationState?.previousPath) {
      console.log('Returning to modal path:', navigationState.previousPath);
      navigate(navigationState.previousPath, { 
        state: { 
          reopenJobDetail: true, 
          jobId: jobId,
          job: navigationState.job // 直接传递完整岗位对象，首页可即刻渲染模态
        } 
      });
      return;
    }

    // 兜底：历史回退，避免创建新页面
    console.log('Fallback: go back one step in history');
    navigate(-1);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now(),
      type: 'user',
      content: message.trim()
    };

    // 添加用户消息
    setChatMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsLoading(true);
    setApiError('');
    setApiProgress('正在连接AI服务...');

    try {
      // 构建职位描述上下文
      const jobContext = `
职位：${jobDetail.title}
公司：${jobDetail.company}
职位描述：${jobDetail.description}
技能要求：${jobDetail.requirements.join('; ')}
工作职责：${jobDetail.responsibilities.join('; ')}
      `;

      setApiProgress('正在分析您的问题...');
      
      // 调用AI服务
      const aiResponse = await aiService.sendMessage([
        {
          role: 'system',
          content: `你是一个专业的求职顾问AI助手。请根据用户的问题提供结构化的回答。

回答格式要求：
1. 使用清晰的段落分隔（用双换行符\\n\\n分隔）
2. 重要信息用标题形式呈现（格式：标题：内容）
3. 列表项使用 • 符号开头
4. 保持专业、友好的语调

示例格式：
主要建议：这里是主要建议内容

具体步骤：
• 第一个步骤说明
• 第二个步骤说明
• 第三个步骤说明

注意事项：这里是需要注意的事项`
        },
        {
          role: 'user',
          content: `职位信息：\n${jobContext}\n\n用户问题：${message.trim()}`
        }
      ]);

      setApiProgress('正在生成回复...');

      if (aiResponse.success && aiResponse.data) {
        // 添加AI回复
        const aiMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: aiResponse.data.output.text
        };

        setChatMessages(prev => [...prev, aiMessage]);
      } else {
        // 处理错误情况
        const errorMessage: ChatMessage = {
          id: Date.now() + 1,
          type: 'ai',
          content: aiResponse.error || '抱歉，我暂时无法回复您的消息。请检查网络连接或稍后再试。'
        };

        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setApiError(errorMessage);
      
      // 添加错误消息
      const errorChatMessage: ChatMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: '抱歉，我暂时无法回复您的消息。请检查网络连接或稍后再试。'
      };

      setChatMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
      setApiProgress('');
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    setApiError('');
    setApiProgress('正在准备生成求职信...');
    
    try {
      const jobContext = `
职位：${jobDetail.title}
公司：${jobDetail.company}
职位描述：${jobDetail.description}
技能要求：${jobDetail.requirements.join('; ')}
      `;

      setApiProgress('正在分析职位要求...');

      const aiResponse = await aiService.sendMessage([
        {
          role: 'system',
          content: `你是一个专业的求职信写作助手。请根据职位信息生成一份专业的求职信，突出候选人的相关经验和技能匹配度。

输出格式要求：
1. 使用清晰的段落结构
2. 包含以下部分（用标题：内容的格式）：
   - 开头问候：简洁的开场白
   - 自我介绍：简要介绍背景和经验
   - 技能匹配：针对职位要求的技能展示
   - 价值贡献：能为公司带来的价值
   - 结尾表达：表达期待和感谢

3. 每个部分用双换行符分隔
4. 保持专业、诚恳的语调`
        },
        {
          role: 'user',
          content: `请为以下职位生成一份求职信：\n${jobContext}`
        }
      ]);

      setApiProgress('正在生成求职信内容...');

      if (aiResponse.success && aiResponse.data) {
        const coverLetterMessage: ChatMessage = {
          id: Date.now(),
          type: 'ai',
          content: `我为你生成了一份求职信：\n\n${aiResponse.data.output.text}`
        };

        setChatMessages(prev => [...prev, coverLetterMessage]);
      } else {
        const errorMessage: ChatMessage = {
          id: Date.now(),
          type: 'ai',
          content: aiResponse.error || '抱歉，生成求职信失败。请稍后再试。'
        };

        setChatMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('生成求职信失败:', error);
      
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setApiError(errorMessage);
      
      const errorChatMessage: ChatMessage = {
        id: Date.now(),
        type: 'ai',
        content: '抱歉，求职信生成失败。请检查网络连接或稍后再试。'
      };

      setChatMessages(prev => [...prev, errorChatMessage]);
    } finally {
      setIsLoading(false);
      setApiProgress('');
    }
  };

  const handleSubmitApplication = () => {
    // 模拟提交申请
    alert('申请已提交！我们会尽快为您处理。');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-purple-50 via-white to-blue-50 overflow-hidden">
      {/* 顶部导航 */}
      <div className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 px-6 py-4 shadow-sm">
        <div className="flex items-center">
          <button 
            onClick={handleBack}
            className="p-2 hover:bg-purple-100 rounded-full transition-all duration-200 group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 group-hover:text-haigoo-primary transition-colors" />
          </button>
          <div className="flex items-center ml-4">
             <div className="w-10 h-10 bg-gradient-to-r from-haigoo-primary to-purple-600 rounded-xl flex items-center justify-center mr-3 shadow-lg">
               <span className="text-white text-sm font-bold">H</span>
             </div>
             <div>
               <h1 className="text-xl font-bold text-gray-900">Hai Copilot</h1>
               <p className="text-xs text-gray-500">智能简历优化助手</p>
             </div>
           </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className="flex h-[calc(100vh-80px)]">
        {/* 左侧：职位描述 */}
        <div className="w-1/2 bg-white border-r border-gray-100">
          <div className="h-full overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {/* 职位标题 */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900 mb-3">{jobDetail.title}</h1>
              <div className="flex items-center space-x-4 text-xs text-gray-600">
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5"></span>
                  <span>{jobDetail.company}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5"></span>
                  <span>{jobDetail.location}</span>
                </div>
                <div className="flex items-center">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5"></span>
                  <span>{jobDetail.salary}</span>
                </div>
              </div>
            </div>

            {/* 职位描述 */}
            <div className="mb-6 p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">
                职位描述
              </h2>
              <p className="text-sm text-gray-700 leading-relaxed">
                {jobDetail.description}
              </p>
            </div>

            {/* 工作要求 */}
            <div className="mb-6 p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                工作要求
              </h3>
              <ul className="space-y-2">
                {jobDetail.requirements.map((req, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{req}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 任职要求 */}
            <div className="mb-6 p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                任职要求
              </h3>
              <ul className="space-y-2">
                {jobDetail.responsibilities.map((resp, index) => (
                  <li key={index} className="flex items-start">
                    <CheckCircle className="w-4 h-4 text-orange-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{resp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 福利待遇 */}
            <div className="p-5 bg-white rounded-lg border border-gray-200 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                福利待遇
              </h3>
              <div className="flex flex-wrap gap-2">
                {jobDetail.benefits.map((benefit, index) => (
                  <span 
                    key={index}
                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 text-gray-700 rounded-full text-xs font-medium"
                  >
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：AI Copilot */}
        <div className="w-1/2 bg-white flex flex-col">
          {/* Copilot 头部 */}
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <AIAvatar size="w-8 h-8" />
                <div className="ml-3">
                  <h2 className="text-base font-semibold text-gray-900">Your new match score is</h2>
                  <p className="text-xs text-haigoo-primary">Improved from 68%</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="text-2xl font-bold text-gray-900 mr-3">{matchScore}%</div>
                <div className="w-12 h-12 relative">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="#e5e7eb"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="20"
                      stroke="#8b5cf6"
                      strokeWidth="6"
                      fill="none"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - matchScore / 100)}`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* 聊天区域 */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {/* 显示进度或错误指示器 */}
            {isLoading && apiProgress && (
              <div className="flex justify-start">
                <ProgressIndicator />
              </div>
            )}
            
            {apiError && (
              <div className="flex justify-start">
                <ErrorIndicator error={apiError} />
              </div>
            )}

            {chatMessages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.type === 'ai' && (
                   <div className="flex items-start max-w-[85%]">
                     <AIAvatar />
                     <div className="bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 ml-2">
                       <div className="text-sm">
                         <FormattedAIMessage content={msg.content} />
                       </div>
                     </div>
                   </div>
                 )}

                 {msg.type === 'suggestion' && (
                   <div className="w-full max-w-[95%]">
                     <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                       <div className="flex items-center mb-3">
                         <AIAvatar size="w-6 h-6" />
                         <span className="font-semibold text-gray-900 text-sm ml-2">AI 优化建议</span>
                       </div>
                       <div className="text-sm mb-3">
                         <FormattedAIMessage content={msg.content} />
                       </div>
                       {msg.suggestions && (
                         <div className="bg-white rounded-lg p-3 border border-purple-100">
                           <h5 className="font-medium text-gray-800 mb-2 text-sm">具体建议：</h5>
                           <div className="space-y-2">
                             {msg.suggestions.map((suggestion, index) => (
                               <div key={index} className="flex items-start text-sm">
                                 <span className="w-5 h-5 bg-gradient-to-br from-purple-500 to-blue-600 text-white rounded-full flex items-center justify-center text-xs font-medium mr-3 mt-0.5 flex-shrink-0">
                                   {index + 1}
                                 </span>
                                 <span className="text-gray-700 leading-relaxed">{suggestion}</span>
                               </div>
                             ))}
                           </div>
                         </div>
                       )}
                     </div>
                   </div>
                 )}

                 {msg.type === 'user' && (
                   <div className="bg-haigoo-primary text-white rounded-lg px-3 py-2 max-w-[80%]">
                     <p className="text-sm leading-relaxed">{msg.content}</p>
                   </div>
                 )}
              </div>
            ))}
          </div>

          {/* 输入区域 */}
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex items-center space-x-2 mb-3">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="输入你的问题或需求..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-haigoo-primary focus:border-transparent text-sm"
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button
                 onClick={handleSendMessage}
                 disabled={isLoading}
                 className={`p-2 rounded-lg transition-colors ${
                   isLoading 
                     ? 'bg-gray-300 cursor-not-allowed' 
                     : 'bg-haigoo-primary text-white hover:bg-purple-600'
                 }`}
               >
                 {isLoading ? (
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 ) : (
                   <Send className="w-4 h-4" />
                 )}
               </button>
             </div>

             {/* 操作按钮 */}
             <div className="flex space-x-2">
               <button
                 onClick={handleGenerateCoverLetter}
                 disabled={isLoading}
                 className={`flex-1 flex items-center justify-center px-3 py-2 border border-haigoo-primary rounded-lg font-medium text-xs transition-colors ${
                   isLoading 
                     ? 'bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed' 
                     : 'bg-white text-haigoo-primary hover:bg-purple-50'
                 }`}
               >
                 <FileText className="w-3 h-3 mr-1" />
                 Generate Cover Letter
               </button>
               <button
                 onClick={handleSubmitApplication}
                 disabled={isLoading}
                 className={`flex-1 flex items-center justify-center px-3 py-2 rounded-lg font-medium text-xs transition-colors ${
                   isLoading 
                     ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                     : 'bg-haigoo-primary text-white hover:bg-purple-600'
                 }`}
               >
                 <CheckCircle className="w-3 h-3 mr-1" />
                 Submit Application
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobApplicationPage;