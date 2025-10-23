import { MapPin, Clock, DollarSign, ExternalLink, Bookmark, Star } from 'lucide-react'
import { Job } from '../types'

interface JobCardProps {
  job: Job
}

export default function JobCard({ job }: JobCardProps) {
  const formatSalary = (min: number, max: number, currency: string) => {
    return `$${min.toLocaleString()} - $${max.toLocaleString()} ${currency}`
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
            <p className="text-gray-500 text-sm mb-2">{job.company}</p>
            
            {/* Job Details - 水平排列 */}
            <div className="flex items-center gap-4 text-gray-500 text-sm">
              <div className="flex items-center">
                <MapPin className="w-4 h-4 mr-1" />
                <span>{job.location}</span>
              </div>
              <div className="flex items-center">
                <DollarSign className="w-4 h-4 mr-1" />
                <span>{formatSalary(job.salary.min, job.salary.max, job.salary.currency)}</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-1" />
                <span>{formatDate(job.postedAt)}</span>
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
          </div>
        </div>
        
        {/* Right side actions */}
        <div className="flex items-center gap-2 ml-4">
          <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200">
            申请
          </button>
        </div>
      </div>
    </div>
  )
}