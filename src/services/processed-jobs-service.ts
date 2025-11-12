import { Job } from '../types'

export interface ProcessedJobsResponse {
  jobs: Job[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface ProcessedJobsFilters {
  source?: string
  category?: string
  status?: string
  dateFrom?: string
  dateTo?: string
  company?: string
  isRemote?: boolean
  tags?: string[]
  search?: string
  location?: string
  type?: string
  skills?: string[]
}

class ProcessedJobsService {
  private baseUrl = '/api'

  async getProcessedJobs(
    page: number = 1,
    limit: number = 20,
    filters: ProcessedJobsFilters = {}
  ): Promise<ProcessedJobsResponse> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      // 添加筛选参数
      if (filters.source) params.append('source', filters.source)
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (filters.company) params.append('company', filters.company)
      if (filters.isRemote !== undefined) params.append('isRemote', filters.isRemote.toString())
      if (filters.search) params.append('search', filters.search)
      if (filters.location) params.append('location', filters.location)
      if (filters.type) params.append('type', filters.type)
      
      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag))
      }
      
      if (filters.skills && filters.skills.length > 0) {
        filters.skills.forEach(skill => params.append('skills', skill))
      }

      const response = await fetch(`${this.baseUrl}/data/processed-jobs?${params}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const contentType = response.headers.get('content-type') || ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.warn('Processed jobs API返回非JSON，使用安全回退。content-type:', contentType)
        // 返回占位结构，避免页面崩溃
        data = {
          jobs: [],
          total: 0,
          page: page,
          pageSize: limit,
          totalPages: 0
        }
      }
      
      // 转换后端数据格式为前端Job类型
      const jobs: Job[] = data.jobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        type: this.mapJobType(job.jobType),
        salary: job.salary ? {
          min: 0,
          max: 0,
          currency: 'USD',
          display: job.salary
        } : undefined,
        description: job.description,
        requirements: job.requirements || [],
        responsibilities: [],
        skills: job.tags || [],
        postedAt: job.publishedAt,
        expiresAt: undefined,
        source: job.source,
        sourceUrl: job.url,
        tags: job.tags || [],
        status: job.status,
        isRemote: job.isRemote,
        category: job.category,
        recommendationScore: 0,
        // 🆕 保留翻译字段，让前端组件可以使用
        translations: job.translations || undefined,
        isTranslated: job.isTranslated || false,
        translatedAt: job.translatedAt || undefined
      }))

      return {
        jobs,
        total: data.total,
        page: data.page,
        limit: data.pageSize,
        hasMore: data.page < data.totalPages
      }
    } catch (error) {
      console.error('获取处理后职位数据失败:', error)
      throw error
    }
  }

  async getAllProcessedJobs(limit: number = 200): Promise<Job[]> {
    try {
      // 限制数据量，优化性能（默认200条）
      // 避免一次性加载过多数据导致内存和带宽问题
      const response = await this.getProcessedJobs(1, limit)
      console.log(`[processed-jobs-service] 加载职位数据: ${response.jobs.length}/${response.total} 条`)
      return response.jobs
    } catch (error) {
      console.error('获取所有处理后职位数据失败:', error)
      return []
    }
  }

  async getRecommendedJobs(limit: number = 6): Promise<Job[]> {
    try {
      const response = await this.getProcessedJobs(1, limit, { status: 'active' })
      // 按推荐分数排序
      return response.jobs.sort((a, b) => (b.recommendationScore || 0) - (a.recommendationScore || 0))
    } catch (error) {
      console.error('获取推荐职位失败:', error)
      return []
    }
  }

  private mapJobType(type: string): Job['type'] {
    switch (type) {
      case 'full-time':
        return 'full-time'
      case 'part-time':
        return 'part-time'
      case 'contract':
        return 'contract'
      case 'freelance':
        return 'freelance'
      case 'internship':
        return 'internship'
      case 'remote':
        return 'remote'
      default:
        return 'full-time'
    }
  }
}

export const processedJobsService = new ProcessedJobsService()