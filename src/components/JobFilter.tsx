import { useState } from 'react'
import { Search, Filter, X, DollarSign, Briefcase, Sparkles } from 'lucide-react'
import { JobFilter as JobFilterType } from '../types'

interface JobFilterProps {
  filters: JobFilterType
  onFiltersChange: (filters: JobFilterType) => void
}

export default function JobFilter({ filters, onFiltersChange }: JobFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [skillInput, setSkillInput] = useState('')

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || ''
    })
  }

  const handleTypeChange = (type: string) => {
    const currentTypes = filters.type ? filters.type.split(',').filter(Boolean) : []
    const newTypes = currentTypes.includes(type)
      ? currentTypes.filter((t: string) => t !== type)
      : [...currentTypes, type]
    
    onFiltersChange({
      ...filters,
      type: newTypes.join(',')
    })
  }

  const handleSalaryChange = (field: 'salaryMin' | 'salaryMax', value: string) => {
    onFiltersChange({
      ...filters,
      [field]: value ? parseInt(value) : 0
    })
  }

  const handleSkillAdd = (skill: string) => {
    if (skill && !filters.skills.includes(skill)) {
      onFiltersChange({
        ...filters,
        skills: [...filters.skills, skill]
      })
    }
    setSkillInput('')
  }

  const handleSkillRemove = (skillToRemove: string) => {
    onFiltersChange({
      ...filters,
      skills: filters.skills.filter(skill => skill !== skillToRemove)
    })
  }

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      type: '',
      salaryMin: 0,
      salaryMax: 0,
      skills: []
    })
  }

  const jobTypes = [
    { value: 'full-time', label: '全职' },
    { value: 'part-time', label: '兼职' },
    { value: 'contract', label: '合同' },
    { value: 'remote', label: '远程' }
  ]

  const popularSkills = [
    'React', 'TypeScript', 'JavaScript', 'Python', 'Node.js',
    'AWS', 'Docker', 'Kubernetes', 'GraphQL', 'MongoDB'
  ]

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-100 sticky top-24 overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-3">
              <Filter className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">智能筛选</h3>
              <p className="text-xs text-slate-500">精准匹配理想职位</p>
            </div>
          </div>
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 text-xs text-slate-500 hover:text-white hover:bg-red-500 rounded-lg transition-all duration-200 border border-slate-200 hover:border-red-500"
          >
            清除全部
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            <Search className="w-4 h-4 inline mr-2 text-blue-500" />
            搜索关键词
          </label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="职位、公司、技能..."
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            {filters.search && (
              <button
                onClick={() => handleSearchChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Job Types */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            <Briefcase className="w-4 h-4 inline mr-2 text-blue-500" />
            工作类型
          </label>
          <div className="grid grid-cols-2 gap-2">
            {jobTypes.map((type) => {
              const isSelected = filters.type.split(',').includes(type.value)
              return (
                <button
                  key={type.value}
                  onClick={() => handleTypeChange(type.value)}
                  className={`p-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white border-transparent shadow-lg transform scale-105'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'
                  }`}
                >
                  <span className="mr-2">{type.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Salary Range */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            <DollarSign className="w-4 h-4 inline mr-2 text-blue-500" />
            薪资范围 (USD)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="number"
                value={filters.salaryMin || ''}
                onChange={(e) => handleSalaryChange('salaryMin', e.target.value)}
                placeholder="最低薪资"
                className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white text-sm"
                min="0"
                step="1000"
              />
              <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
            <div className="relative">
              <input
                type="number"
                value={filters.salaryMax || ''}
                onChange={(e) => handleSalaryChange('salaryMax', e.target.value)}
                placeholder="最高薪资"
                className="w-full pl-8 pr-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white text-sm"
                min="0"
                step="1000"
              />
              <DollarSign className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3 h-3 text-slate-400" />
            </div>
          </div>
          <div className="mt-3 flex items-center text-xs text-slate-500">
            <Sparkles className="w-3 h-3 mr-1" />
            年薪范围，留空表示不限制
          </div>
        </div>

        {/* Skills */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-3">
            <span className="inline-flex items-center">
              <span className="w-4 h-4 bg-gradient-to-br from-green-400 to-blue-500 rounded mr-2 flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
              </span>
              技能要求
            </span>
          </label>
          
          {/* Skill Input */}
          <div className="relative mb-4">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSkillAdd(skillInput.trim())
                }
              }}
              placeholder="输入技能并按回车添加"
              className="w-full pl-4 pr-12 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-slate-50 hover:bg-white text-sm"
            />
            {skillInput && (
              <button
                onClick={() => handleSkillAdd(skillInput.trim())}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>

          {/* Popular Skills */}
          <div className="mb-4">
            <div className="flex items-center text-xs text-slate-500 mb-3">
              <Sparkles className="w-3 h-3 mr-1" />
              热门技能推荐:
            </div>
            <div className="flex flex-wrap gap-2">
              {popularSkills.map((skill) => {
                const isSelected = filters.skills.includes(skill)
                return (
                  <button
                    key={skill}
                    onClick={() => handleSkillAdd(skill)}
                    disabled={isSelected}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                      isSelected
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 border border-blue-200 hover:border-blue-300'
                    }`}
                  >
                    {skill}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Selected Skills */}
          {filters.skills.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
              <div className="flex items-center text-xs text-slate-600 mb-3">
                <Sparkles className="w-3 h-3 mr-1" />
                已选择的技能 ({filters.skills.length}):
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-medium rounded-lg shadow-sm"
                  >
                    {skill}
                    <button
                      onClick={() => handleSkillRemove(skill)}
                      className="ml-2 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="lg:hidden">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium flex items-center justify-center hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
          >
            {isExpanded ? '收起筛选' : '展开筛选'}
            <Filter className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  )
}