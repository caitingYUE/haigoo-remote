import React, { useState } from 'react'
import { X, Share2, Bookmark, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Job } from '../types'

interface JobDetailModalProps {
  job: Job | null
  isOpen: boolean
  onClose: () => void
  onSave?: (jobId: string) => void
  isSaved?: boolean
  onApply?: (jobId: string) => void
}

const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onSave,
  isSaved = false,
  onApply
}) => {
  const [activeTab, setActiveTab] = useState<'description' | 'company' | 'similar'>('description')
  const navigate = useNavigate()

  if (!job) return null

  const handleSave = () => {
    if (onSave) {
      onSave(job.id)
    }
  }

  const handleApply = () => {
    if (onApply) {
      onApply(job.id)
    } else {
      // 导航到AI优化页面，并传递当前页面信息以便正确返回
      navigate(`/job/${job.id}/apply`, { 
        state: { 
          job,
          returnToModal: true,
          previousPath: window.location.pathname
        } 
      })
    }
  }

  const matchPercentage = Math.floor(Math.random() * 20) + 75 // 75-95% match

  return (
    <div className={`fixed inset-0 z-50 transition-all duration-300 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0'}`}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-transparent transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={`absolute right-0 top-0 h-full w-full max-w-[840px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-lg transform transition-transform duration-300 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-haigoo-primary/20 to-haigoo-primary/10 rounded-xl flex items-center justify-center">
                <span className="text-haigoo-primary font-bold text-lg">
                  {job.company.charAt(0)}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100">{job.title}</h2>
                <p className="text-zinc-600 dark:text-zinc-400">{job.company} • {job.location}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-zinc-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full overflow-y-auto pb-20">
          <div className="p-6 space-y-8">
            {/* Company Info Card */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-700 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Company Logo & Basic Info */}
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-haigoo-primary to-haigoo-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                    <span className="text-white font-bold text-xl">
                      {job.company.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">{job.company}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                      <span className="flex items-center gap-1">
                         {job.location}
                       </span>
                       <span className="flex items-center gap-1">
                         {job.type}
                       </span>
                       <span className="flex items-center gap-1">
                          {typeof job.salary === 'object' ? `${job.salary.currency}${job.salary.min.toLocaleString()} - ${job.salary.currency}${job.salary.max.toLocaleString()}` : job.salary}
                        </span>
                    </div>
                  </div>
                </div>

                {/* AI Match Score */}
                <div className="flex items-center gap-4 bg-white dark:bg-zinc-800 rounded-xl p-4 border border-zinc-200 dark:border-zinc-600">
                  <div className="relative w-16 h-16">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${matchPercentage}, 100`}
                        className="text-haigoo-primary"
                      />
                      <path
                        d="M18 2.0845
                          a 15.9155 15.9155 0 0 1 0 31.831
                          a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray="100, 100"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-haigoo-primary">
                        {matchPercentage}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">AI 匹配度</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">基于你的技能和经验</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleApply}
                  className="flex-1 bg-gradient-to-r from-haigoo-primary to-haigoo-primary/90 hover:from-haigoo-primary/90 hover:to-haigoo-primary text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  立即申请
                </button>
                <button
                  onClick={handleSave}
                  className={`flex-1 border-2 font-semibold py-3 px-6 rounded-xl transition-all duration-200 ${
                    isSaved
                      ? 'border-haigoo-primary bg-haigoo-primary/10 text-haigoo-primary'
                      : 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:border-haigoo-primary hover:text-haigoo-primary'
                  }`}
                >
                  <Bookmark className={`inline-block w-4 h-4 mr-2 ${isSaved ? 'fill-current' : ''}`} />
                  {isSaved ? '已保存' : '保存职位'}
                </button>
              </div>
              
              <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <button className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-haigoo-primary transition-colors">
                  <Share2 className="w-4 h-4" />
                  分享推荐链接
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm overflow-hidden">
              <div className="flex border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50">
                {[
                  { key: 'description', label: '职位描述' },
                  { key: 'company', label: '公司信息' },
                  { key: 'similar', label: '相似职位' }
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'text-haigoo-primary bg-white dark:bg-zinc-800 border-b-2 border-haigoo-primary'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="p-6 space-y-6">
                {activeTab === 'description' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        职位描述
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed">
                        我们正在寻找一位才华横溢的专业人士加入我们充满活力的团队。这个职位在协作环境中提供了出色的成长和发展机会。
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        工作职责
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "从概念到完成领导项目",
                          "与跨职能团队协作",
                          "开发和实施创新解决方案",
                          "指导初级团队成员",
                          "确保达到质量标准"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                            <div className="w-2 h-2 bg-haigoo-primary rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        任职要求
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "3年以上相关工作经验",
                          "在相关技术方面具有强大的技术技能",
                          "出色的沟通和团队合作能力",
                          "学士学位或同等工作经验",
                          "解决问题的思维方式"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        技能要求
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {job.skills.map((skill, index) => (
                          <span 
                            key={index} 
                            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm rounded-full border border-zinc-200 dark:border-zinc-600 hover:border-haigoo-primary hover:text-haigoo-primary transition-colors"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-emerald-400 rounded-full"></div>
                        福利待遇
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          "全面的健康、牙科和视力保险",
                          "灵活的工作时间和远程优先文化",
                          "慷慨的带薪休假和育儿假",
                          "专业发展机会",
                          "有竞争力的薪资和股权包"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200/50 dark:border-emerald-700/30">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'company' && (
                  <>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-3 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        关于 {job.company}
                      </h3>
                      <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed mb-6">
                        {job.company} 是技术领域的领先公司，致力于创新和卓越。
                        我们营造一个协作环境，让有才华的个人能够茁壮成长并产生有意义的影响。
                      </p>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        公司文化
                      </h3>
                      <div className="space-y-3">
                        {[
                          "创新驱动和前瞻性思维",
                          "协作和包容的工作环境",
                          "致力于工作与生活的平衡",
                          "持续学习和发展",
                          "多元化和包容性倡议"
                        ].map((item, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/30">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <span className="text-zinc-600 dark:text-zinc-300 leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-4 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        公司规模与行业
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 block mb-1">行业</span>
                          <p className="text-zinc-600 dark:text-zinc-300">科技</p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 block mb-1">公司规模</span>
                          <p className="text-zinc-600 dark:text-zinc-300">100-500 员工</p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 block mb-1">成立时间</span>
                          <p className="text-zinc-600 dark:text-zinc-300">2015年</p>
                        </div>
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-700/30 rounded-lg">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100 block mb-1">地点</span>
                          <p className="text-zinc-600 dark:text-zinc-300">{job.location}</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeTab === 'similar' && (
                  <>
                    <div>
                      <h3 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 mb-6 flex items-center gap-2">
                        <div className="w-1 h-6 bg-gradient-to-b from-haigoo-primary to-haigoo-primary/60 rounded-full"></div>
                        你可能喜欢的相似职位
                      </h3>
                      <div className="space-y-4">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="p-6 bg-gradient-to-r from-white to-zinc-50 dark:from-zinc-800 dark:to-zinc-800/80 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 hover:shadow-md transition-all duration-200">
                            <div className="flex justify-between items-start mb-3">
                              <h4 className="font-bold text-zinc-800 dark:text-zinc-100 text-lg">
                                相似的 {job.title} 职位
                              </h4>
                              <ExternalLink className="h-5 w-5 text-zinc-400 hover:text-haigoo-primary transition-colors cursor-pointer" />
                            </div>
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-8 h-8 bg-gradient-to-br from-zinc-400 to-zinc-500 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">C</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">其他科技公司</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{job.location}</p>
                              </div>
                            </div>
                            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-4 leading-relaxed">
                              具有相似要求和福利的职位，为你的职业发展提供更多选择
                            </p>
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-gradient-to-r from-haigoo-primary to-emerald-500 rounded-full"></div>
                                <span className="text-sm font-semibold text-haigoo-primary">
                                  {Math.floor(Math.random() * 15) + 80}% 匹配
                                </span>
                              </div>
                              <button className="text-sm font-medium text-haigoo-primary hover:text-haigoo-primary/80 hover:underline transition-colors">
                                查看详情 →
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default JobDetailModal