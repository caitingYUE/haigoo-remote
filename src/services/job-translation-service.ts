/**
 * 岗位翻译服务
 * 用于在数据加载时批量翻译岗位内容为中文
 */

import { Job } from '../types'
import { multiTranslationService } from './multi-translation-service'

interface TranslationCache {
  [key: string]: string
}

class JobTranslationService {
  private cache: TranslationCache = {}
  private translating = new Set<string>()
  
  /**
   * 批量翻译岗位数据
   * @param jobs 原始岗位数据（英文）
   * @returns 包含翻译字段的岗位数据
   */
  async translateJobs(jobs: Job[]): Promise<Job[]> {
    if (!jobs || jobs.length === 0) {
      return jobs
    }

    console.log(`开始批量翻译 ${jobs.length} 个岗位...`)
    
    const translatedJobs = await Promise.all(
      jobs.map(job => this.translateSingleJob(job))
    )
    
    console.log(`完成翻译 ${translatedJobs.length} 个岗位`)
    
    return translatedJobs
  }

  /**
   * 翻译单个岗位
   * @param job 原始岗位数据
   * @returns 包含翻译的岗位数据
   */
  async translateSingleJob(job: Job): Promise<Job> {
    // 如果已经有翻译，直接返回
    if (job.translations && job.translations.title) {
      return job
    }

    // 如果正在翻译，等待完成
    if (this.translating.has(job.id)) {
      await this.waitForTranslation(job.id)
      return job
    }

    try {
      this.translating.add(job.id)
      
      // 准备需要翻译的文本
      const textsToTranslate: string[] = []
      const textKeys: string[] = []
      
      // 标题
      if (job.title) {
        textsToTranslate.push(job.title)
        textKeys.push('title')
      }
      
      // 公司名（如果不是知名公司，可以翻译）
      if (job.company && !this.isWellKnownCompany(job.company)) {
        textsToTranslate.push(job.company)
        textKeys.push('company')
      }
      
      // 描述
      if (job.description) {
        // 限制描述长度，避免翻译太长的文本
        const descToTranslate = job.description.substring(0, 500)
        textsToTranslate.push(descToTranslate)
        textKeys.push('description')
      }
      
      // 地点
      if (job.location) {
        textsToTranslate.push(job.location)
        textKeys.push('location')
      }
      
      // 岗位类型
      if (job.type) {
        textsToTranslate.push(this.getJobTypeInEnglish(job.type))
        textKeys.push('type')
      }

      // 如果没有需要翻译的内容，直接返回
      if (textsToTranslate.length === 0) {
        this.translating.delete(job.id)
        return job
      }

      // 批量翻译
      const result = await multiTranslationService.batchTranslate(textsToTranslate, 'zh')
      
      if (result.success && result.data) {
        // 构建翻译对象
        const translations: Partial<Job['translations']> = {}
        
        result.data.forEach((translatedText, index) => {
          const key = textKeys[index] as keyof Job['translations']
          if (key === 'title' || key === 'company' || key === 'description' || key === 'location' || key === 'type') {
            (translations as any)[key] = translatedText
          }
        })
        
        // 如果公司名没有翻译（知名公司），保留原文
        if (job.company && !translations.company) {
          translations.company = job.company
        }
        
        // 返回包含翻译的岗位
        const translatedJob = {
          ...job,
          translations
        }
        
        this.translating.delete(job.id)
        return translatedJob
      } else {
        console.warn(`翻译岗位 ${job.id} 失败:`, result.error)
        this.translating.delete(job.id)
        return job
      }
    } catch (error) {
      console.error(`翻译岗位 ${job.id} 时出错:`, error)
      this.translating.delete(job.id)
      return job
    }
  }

  /**
   * 判断是否为知名公司（不需要翻译）
   */
  private isWellKnownCompany(company: string): boolean {
    const wellKnownCompanies = [
      'google', 'microsoft', 'apple', 'amazon', 'facebook', 'meta',
      'netflix', 'tesla', 'nvidia', 'intel', 'ibm', 'oracle',
      'salesforce', 'adobe', 'uber', 'airbnb', 'spotify', 'twitter',
      'linkedin', 'github', 'gitlab', 'docker', 'kubernetes'
    ]
    
    const lowerCompany = company.toLowerCase()
    return wellKnownCompanies.some(known => lowerCompany.includes(known))
  }

  /**
   * 获取岗位类型的英文描述
   */
  private getJobTypeInEnglish(type: string): string {
    const typeMap: Record<string, string> = {
      'full-time': 'Full-time',
      'part-time': 'Part-time',
      'contract': 'Contract',
      'remote': 'Remote',
      'freelance': 'Freelance',
      'internship': 'Internship'
    }
    return typeMap[type] || type
  }

  /**
   * 等待翻译完成
   */
  private async waitForTranslation(jobId: string): Promise<void> {
    const maxWait = 5000 // 最多等待5秒
    const startTime = Date.now()
    
    while (this.translating.has(jobId)) {
      if (Date.now() - startTime > maxWait) {
        console.warn(`等待翻译 ${jobId} 超时`)
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache = {}
  }

  /**
   * 根据显示模式获取文本
   * @param job 岗位数据
   * @param field 字段名
   * @param showOriginal 是否显示原文
   */
  getDisplayText(job: Job, field: keyof Job['translations'], showOriginal: boolean = false): string {
    if (showOriginal || !job.translations || !job.translations[field]) {
      // 显示原文或没有翻译时，返回原始字段
      return (job[field as keyof Job] as string) || ''
    }
    
    // 优先返回翻译
    return job.translations[field] || (job[field as keyof Job] as string) || ''
  }
}

export const jobTranslationService = new JobTranslationService()

