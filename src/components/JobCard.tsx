import { MapPin, Clock, DollarSign, ExternalLink, Bookmark, Star, Building, Briefcase, Globe, Award } from 'lucide-react'
import { Job } from '../types'
import { DateFormatter } from '../utils/date-formatter'
import { processJobDescription } from '../utils/text-formatter'

interface JobCardProps {
  job: Job
  onSave?: (jobId: string) => void
  isSaved?: boolean
  onClick?: (job: Job) => void
}

export default function JobCard({ job, onSave, isSaved, onClick }: JobCardProps) {
  const formatSalary = (salary: Job['salary']) => {
    if (!salary || (salary.min === 0 && salary.max === 0)) return '薪资面议'
    
    const formatAmount = (amount: number) => {
      if (amount >= 10000) {
        return `${(amount / 10000).toFixed(1)}万`
      }
      return amount.toLocaleString()
    }
    
    const currencySymbol = salary.currency === 'CNY' ? '¥' : salary.currency === 'USD' ? '$' : '€'
    
    if (salary.min === salary.max) {
      return `${currencySymbol}${formatAmount(salary.min)}`
    }
    return `${currencySymbol}${formatAmount(salary.min)} - ${formatAmount(salary.max)}`
  }

  const getCompanyLogo = (company: string) => {
    // 生成公司logo的占位符 - 使用简洁的单色设计
    const colors = [
      'bg-blue-500',
      'bg-green-500', 
      'bg-purple-500',
      'bg-orange-500',
      'bg-pink-500',
      'bg-indigo-500'
    ]
    const colorIndex = company.length % colors.length
    return colors[colorIndex]
  }

  const getJobTypeLabel = (jobType: string) => {
    const labels = {
      'full-time': '全职',
      'part-time': '兼职',
      'contract': '合同',
      'freelance': '自由职业',
      'internship': '实习',
      'remote': '远程'
    }
    return labels[jobType as keyof typeof labels] || jobType
  }

  const getExperienceLevelLabel = (level?: string) => {
    if (!level) return null
    const labels = {
      'Entry': '初级',
      'Mid': '中级',
      'Senior': '高级',
      'Lead': '主管',
      'Executive': '总监'
    }
    return labels[level as keyof typeof labels] || level
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick(job)
    }
  }

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (onSave) {
      onSave(job.id)
    }
  }

  return (
    <div 
      className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-200 transition-all duration-300 cursor-pointer"
      onClick={handleCardClick}
    >
      {/* Header - 横向布局 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center flex-1 min-w-0">
          <div className={`w-12 h-12 rounded-lg ${getCompanyLogo(job.company)} flex items-center justify-center text-white font-semibold text-sm mr-4 flex-shrink-0`}>
            {job.company.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg group-hover:text-purple-600 transition-colors mb-1">
              {job.title}
            </h3>
            
            {/* 公司信息行 */}
            <div className="flex items-center gap-4 text-gray-500 text-sm mb-2 flex-wrap">
              <div className="flex items-center">
                <Building className="w-4 h-4 mr-1" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center">
                <Briefcase className="w-4 h-4 mr-1" />
                <span>{getJobTypeLabel(job.type)}</span>
              </div>
              {job.experienceLevel && (
                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-md">
                  <Award className="w-3 h-3 inline mr-1" />
                  {getExperienceLevelLabel(job.experienceLevel)}
                </span>
              )}
              {job.isRemote && (
                <span className="px-2 py-1 bg-green-50 text-green-600 text-xs font-medium rounded-md">
                  <Globe className="w-3 h-3 inline mr-1" />
                  远程
                </span>
              )}
              {job.category && (
                <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-md">
                  {job.category}
                </span>
              )}
            </div>
            
            {/* Job Details - 响应式布局 */}
            <div className="flex flex-wrap items-center gap-3 text-gray-500 text-sm">
              <div className="flex items-center min-w-0 max-w-[250px]">
                <MapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="truncate" title={job.location}>{job.location}</span>
              </div>
              {job.remoteLocationRestriction && (
                <div className="flex items-center min-w-0">
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-md truncate max-w-[200px]" title={`远程限制: ${job.remoteLocationRestriction}`}>
                    远程限制: {job.remoteLocationRestriction}
                  </span>
                </div>
              )}
              <div className="flex items-center min-w-0 max-w-[150px]">
                <DollarSign className="w-4 h-4 mr-1 flex-shrink-0" />
                <span className="truncate" title={formatSalary(job.salary)}>{formatSalary(job.salary)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="whitespace-nowrap">{DateFormatter.formatPublishTime(job.postedAt)}</span>
              </div>
            </div>
            
            {/* Skills */}
            <div className="flex flex-wrap gap-2 mt-3">
              {job.skills.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-md"
                >
                  {skill}
                </span>
              ))}
              {job.skills.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-md">
                  +{job.skills.length - 3}
                </span>
              )}
            </div>

            {/* Job Description Preview */}
            {job.description && (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-1">职位描述:</div>
                <p className="text-sm text-gray-700 line-clamp-2 leading-relaxed">
                  {processJobDescription(job.description, { 
                    formatMarkdown: true, 
                    maxLength: 150, 
                    preserveHtml: false 
                  })}
                </p>
              </div>
            )}

            {/* Benefits/Responsibilities */}
            {job.responsibilities && job.responsibilities.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-600 mb-1">职责/福利:</div>
                <div className="flex flex-wrap gap-1">
                  {job.responsibilities.slice(0, 2).map((item, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-emerald-50 text-emerald-600 text-xs rounded-md"
                    >
                      {item}
                    </span>
                  ))}
                  {job.responsibilities.length > 2 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-md">
                      +{job.responsibilities.length - 2}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Right side actions */}
        <div className="flex items-center gap-2 ml-4">
          <button 
            onClick={handleSaveClick}
            className={`p-2 rounded-lg transition-colors ${
              isSaved 
                ? 'text-purple-600 bg-purple-50' 
                : 'text-gray-400 hover:text-purple-600 hover:bg-purple-50'
            }`}
          >
            <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
          <a 
            href={job.sourceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200 flex items-center gap-1"
          >
            申请
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  )
}