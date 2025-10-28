import { MapPin, Clock, DollarSign, ExternalLink, Bookmark, Star, Building, Briefcase } from 'lucide-react'
import { Job } from '../types/rss-types'
import { DateFormatter } from '../utils/date-formatter'

interface JobCardProps {
  job: Job
}

export default function JobCard({ job }: JobCardProps) {
  const formatSalary = (salary?: string) => {
    if (!salary) return '薪资面议'
    return salary
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
      'internship': '实习'
    }
    return labels[jobType as keyof typeof labels] || jobType
  }

  const getExperienceLevelLabel = (level: string) => {
    const labels = {
      'Entry': '初级',
      'Mid': '中级',
      'Senior': '高级',
      'Lead': '主管',
      'Executive': '总监'
    }
    return labels[level as keyof typeof labels] || level
  }

  return (
    <div className="group bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md hover:border-purple-200 transition-all duration-300 cursor-pointer">
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
            <div className="flex items-center gap-4 text-gray-500 text-sm mb-2">
              <div className="flex items-center">
                <Building className="w-4 h-4 mr-1" />
                <span>{job.company}</span>
              </div>
              <div className="flex items-center">
                <Briefcase className="w-4 h-4 mr-1" />
                <span>{getJobTypeLabel(job.jobType)}</span>
              </div>
              <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-md">
                {getExperienceLevelLabel(job.experienceLevel)}
              </span>
            </div>
            
            {/* Job Details - 响应式布局 */}
            <div className="flex flex-wrap items-center gap-3 text-gray-500 text-sm">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                <span className="break-words">{job.location}</span>
              </div>
              {job.remoteLocationRestriction && (
                <div className="flex items-center">
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-md break-words max-w-[200px]">
                    远程: {job.remoteLocationRestriction}
                  </span>
                </div>
              )}
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                <span className="break-words">{formatSalary(job.salary)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span className="whitespace-nowrap">{DateFormatter.formatPublishTime(job.publishedAt)}</span>
              </div>
            </div>
            
            {/* Skills */}
            <div className="flex flex-wrap gap-2 mt-3">
              {job.tags.slice(0, 3).map((skill, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-md"
                >
                  {skill}
                </span>
              ))}
              {job.tags.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-md">
                  +{job.tags.length - 3}
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right side actions */}
        <div className="flex items-center gap-2 ml-4">
          <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>
          <a 
            href={job.url} 
            target="_blank" 
            rel="noopener noreferrer"
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