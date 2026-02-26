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
  id?: string
  region?: 'domestic' | 'overseas'
  isFeatured?: boolean
  canRefer?: boolean
  sourceFilter?: string
  sortBy?: 'recent' | 'relevance'
  isApproved?: boolean
  companyId?: string
  skipAggregations?: boolean
}

class ProcessedJobsService {
  private baseUrl = '/api'
  // 预发环境回退地址（仅用于本地服务无法获取数据时）
  private previewBaseUrl = 'https://haigoo-remote-git-develop-caitlinyct.vercel.app/api'

  async getProcessedJobs(
    page: number = 1,
    limit: number = 20,
    filters: ProcessedJobsFilters = {}
  ): Promise<ProcessedJobsResponse> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        _t: Date.now().toString() // Cache buster
      })

      // 添加筛选参数
      if (filters.source) params.append('source', filters.source)
      if (filters.category) params.append('category', filters.category)
      if (filters.status) params.append('status', filters.status)
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.append('dateTo', filters.dateTo)
      if (filters.company) params.append('company', filters.company)
      if (filters.companyId) params.append('companyId', filters.companyId)
      if (filters.isRemote !== undefined) params.append('isRemote', filters.isRemote.toString())
      if (filters.search) params.append('search', filters.search)
      if (filters.location) params.append('location', filters.location)
      if (filters.type) params.append('type', filters.type)
      if (filters.id) params.append('id', filters.id)
      if (filters.region) params.append('region', filters.region)
      if (filters.isFeatured !== undefined) params.append('isFeatured', filters.isFeatured.toString())
      if (filters.canRefer !== undefined) params.append('canRefer', filters.canRefer.toString())
      if (filters.isApproved !== undefined) params.append('isApproved', filters.isApproved.toString())
      if (filters.skipAggregations) params.append('skipAggregations', 'true')
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      // Append source filter if present
      if (filters.sourceFilter && filters.sourceFilter !== 'all') {
        params.append('sourceFilter', filters.sourceFilter)
      }

      // 🔍 Personalized Match Score Handling
      // If sorting by relevance and user is logged in (has token), use the match score endpoint
      const token = localStorage.getItem('haigoo_auth_token');
      if (filters.sortBy === 'relevance' && token) {
        params.append('action', 'jobs_with_match_score');
      }

      if (filters.tags && filters.tags.length > 0) {
        filters.tags.forEach(tag => params.append('tags', tag))
      }

      if (filters.skills && filters.skills.length > 0) {
        filters.skills.forEach(skill => params.append('skills', skill))
      }

      // 为网络请求添加超时与中止控制，避免请求卡住导致页面一直处于 loading
      const controller = new AbortController()
      const timeoutMs = 15000 // 15秒超时
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      let response: Response | null = null
      try {
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        // Use legacy API path for jobs
        params.append('resource', 'processed-jobs');
        // params.append('target', 'processed-jobs'); // Not needed for api/data.js routing
        response = await fetch(`${this.baseUrl}/data?${params}`, {
          headers,
          signal: controller.signal
        })
      } catch (e) {
        console.warn('[processed-jobs-service] 本地API请求失败，尝试回退到预发环境', e)
      } finally {
        clearTimeout(timer)
      }

      // 如果请求失败，直接抛出错误
      if (!response) {
        console.error('[processed-jobs-service] API request failed, no response received.');
        throw new Error('API request failed, no response received.');
      }

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Failed to read error body');
        console.error(`[processed-jobs-service] API request failed with status ${response.status}. Body: ${errorBody}`);
        throw new Error(`API request failed with status ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const text = await response.text()
        console.error('Processed jobs API返回非JSON，内容预览:', text.substring(0, 200))
        throw new Error(`API返回格式错误 (content-type: ${contentType}). 请检查后端日志。`)
      }

      // 转换后端数据格式为前端Job类型
      const jobs: Job[] = data.jobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        logo: job.logo,
        location: job.location,
        region: job.region,
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
        benefits: job.benefits || [],
        skills: job.tags || [],
        publishedAt: job.publishedAt,
        expiresAt: undefined,
        source: job.source,
        sourceUrl: job.url,
        tags: job.tags || [],
        status: job.status,
        isRemote: job.isRemote,
        category: job.category,
        experienceLevel: job.experienceLevel || job.experience_level,
        recommendationScore: job.matchScore || job.match_score || 0,
        matchScore: job.matchScore || job.match_score || 0,
        matchLevel: job.matchLevel || job.match_level || undefined,
        matchLabel: job.matchLabel || job.match_label || undefined,
        matchDetails: job.matchDetails || job.match_details || null,
        matchDetailsLocked: Boolean(job.matchDetailsLocked || job.match_details_locked),
        aiRecommended: Boolean(job.aiRecommended || job.ai_recommended),
        goalFitScore: job.goalFitScore || job.goal_fit_score || undefined,
        // 🆕 保留翻译字段，让前端组件可以使用
        translations: job.translations || undefined,
        isTranslated: job.isTranslated || false,
        translatedAt: job.translatedAt || undefined,
        companyId: job.companyId,
        sourceType: job.sourceType ? job.sourceType.toLowerCase() : undefined,
        isTrusted: job.isTrusted,
        canRefer: job.canRefer,
        isFeatured: job.isFeatured,
        companyIndustry: job.companyIndustry,
        companyTags: job.companyTags,
        companyWebsite: job.companyWebsite,
        companyDescription: job.companyDescription
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

  // 聚合所有分页数据：返回完整的岗位列表（数千条）
  async getAllProcessedJobsFull(pageSize: number = 100, maxPages?: number): Promise<Job[]> {
    try {
      const first = await this.getProcessedJobs(1, pageSize)
      let all: Job[] = [...first.jobs]
      let page = 2
      const totalPages = Math.ceil((first.total || 0) / (first.limit || pageSize)) || 1

      const finalMaxPages = typeof maxPages === 'number' ? Math.min(maxPages, totalPages) : totalPages

      while (page <= finalMaxPages && first.hasMore) {
        const resp = await this.getProcessedJobs(page, pageSize)
        all = all.concat(resp.jobs)
        page += 1
        if (!resp.hasMore) break
      }

      console.log(`[processed-jobs-service] 聚合完成，共 ${all.length}/${first.total} 条（${finalMaxPages} 页）`)
      return all
    } catch (error) {
      console.error('聚合所有处理后职位数据失败:', error)
      return []
    }
  }

  async getFeaturedHomeJobs(): Promise<Job[]> {
    try {
      const params = new URLSearchParams({
        resource: 'processed-jobs',
        action: 'featured_home',
        _t: Date.now().toString()
      })

      const response = await fetch(`${this.baseUrl}/data?${params}`)
      if (!response.ok) throw new Error('Failed to fetch featured jobs')

      const data = await response.json()

      return data.jobs.map((job: any) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        logo: job.logo || job.trusted_logo, // Use trusted logo if available
        location: job.location,
        region: job.region,
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
        benefits: job.benefits || [],
        skills: job.tags || [],
        publishedAt: job.publishedAt,
        source: job.source,
        sourceUrl: job.url,
        tags: job.tags || [],
        status: job.status,
        isRemote: job.isRemote,
        category: job.category,
        isTrusted: job.isTrusted,
        canRefer: job.canRefer,
        isFeatured: job.isFeatured,
        companyIndustry: job.companyIndustry,
        companyWebsite: job.companyWebsite || job.trusted_website, // Use trusted website if available
        companyId: job.companyId,
        sourceType: job.sourceType ? job.sourceType.toLowerCase() : undefined,
        translations: job.translations || undefined,
        isTranslated: job.isTranslated || false,
        translatedAt: job.translatedAt || undefined
      }))
    } catch (error) {
      console.error('获取首页精选职位失败:', error)
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

  async getLocationCategories(): Promise<{ domesticKeywords: string[]; overseasKeywords: string[]; globalKeywords: string[] }> {
    try {
      const r = await fetch(`${this.baseUrl}/location-categories`)
      if (!r.ok) throw new Error('categories fetch failed')
      const j = await r.json()
      return j.categories || { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] }
    } catch {
      return { domesticKeywords: [], overseasKeywords: [], globalKeywords: [] }
    }
  }

  async getJobById(id: string): Promise<Job | null> {
    try {
      const response = await this.getProcessedJobs(1, 1, { id })
      return response.jobs[0] || null
    } catch (error) {
      console.error('获取特定职位失败:', error)
      return null
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

  // 清除所有处理后的职位数据
  async clearAllJobs(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/data/processed-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobs: [],
          mode: 'replace'
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to clear jobs: ${response.statusText}`)
      }

      console.log('[processed-jobs-service] 所有职位数据已清除')
      return true
    } catch (error) {
      console.error('清除所有职位数据失败:', error)
      throw error
    }
  }
}

export const processedJobsService = new ProcessedJobsService()
