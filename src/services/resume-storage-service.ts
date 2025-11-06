/**
 * 简历存储服务
 * 支持本地 localStorage 和远程 API 存储
 */

import { ResumeItem } from '../types/resume-types'

const STORAGE_KEY = 'haigoo_resume_library'
const BACKUP_PREFIX = 'haigoo_resume_backup_'
const MAX_BACKUPS = 5
const API_ENDPOINT = '/api/resumes'

export class ResumeStorageService {
  /**
   * 保存简历（优先使用服务端，回退到 localStorage）
   */
  static async saveResumes(resumes: ResumeItem[]): Promise<void> {
    // 先尝试保存到服务端
    const serverSaved = await this.saveToServer(resumes, 'replace')
    
    if (serverSaved) {
      console.log('[ResumeStorage] Saved to server:', resumes.length, 'resumes')
      // 同时保存到本地作为缓存
      this.saveToLocalStorage(resumes)
    } else {
      // 服务端失败，保存到本地
      console.warn('[ResumeStorage] Server save failed, using localStorage')
      this.saveToLocalStorage(resumes)
    }
  }

  /**
   * 保存到服务端
   */
  private static async saveToServer(resumes: ResumeItem[], mode: 'append' | 'replace' = 'replace'): Promise<boolean> {
    try {
      // 移除 blobURL（不需要发送到服务器）
      const sanitizedResumes = resumes.map(({ blobURL, ...rest }) => rest)
      
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resumes: sanitizedResumes,
          mode
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      console.log('[ResumeStorage] Server save result:', result)
      return result.success
    } catch (error) {
      console.error('[ResumeStorage] Server save error:', error)
      return false
    }
  }

  /**
   * 保存到 localStorage
   */
  private static saveToLocalStorage(resumes: ResumeItem[]): void {
    try {
      const data = {
        resumes,
        lastUpdate: new Date().toISOString(),
        version: '1.0'
      }
      
      // 保存主数据
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      
      // 创建备份
      this.createBackup(data)
      
      // 清理旧备份
      this.cleanupOldBackups()
      
      console.log('[ResumeStorage] Saved to localStorage:', resumes.length, 'resumes')
    } catch (error) {
      console.error('[ResumeStorage] localStorage save failed:', error)
      throw new Error('保存简历失败：存储空间不足，请清理浏览器缓存或删除部分简历')
    }
  }

  /**
   * 加载简历（优先从服务端，回退到 localStorage）
   */
  static async loadResumes(): Promise<ResumeItem[]> {
    // 先尝试从服务端加载
    const serverResumes = await this.loadFromServer()
    
    if (serverResumes && serverResumes.length > 0) {
      console.log('[ResumeStorage] Loaded from server:', serverResumes.length, 'resumes')
      return serverResumes
    }
    
    // 服务端没有数据，从本地加载
    console.log('[ResumeStorage] Loading from localStorage')
    return this.loadFromLocalStorage()
  }

  /**
   * 从服务端加载
   */
  private static async loadFromServer(): Promise<ResumeItem[] | null> {
    try {
      const response = await fetch(API_ENDPOINT)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      if (result.success && Array.isArray(result.data)) {
        return result.data
      }
      
      return null
    } catch (error) {
      console.error('[ResumeStorage] Server load error:', error)
      return null
    }
  }

  /**
   * 从 localStorage 加载
   */
  private static loadFromLocalStorage(): ResumeItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        console.log('[ResumeStorage] No local data found')
        return []
      }
      
      const data = JSON.parse(stored)
      console.log('[ResumeStorage] Loaded from localStorage:', data.resumes?.length || 0, 'resumes')
      return data.resumes || []
    } catch (error) {
      console.error('[ResumeStorage] localStorage load failed:', error)
      
      // 尝试从备份恢复
      const backup = this.loadFromBackup()
      if (backup) {
        console.log('[ResumeStorage] Restored from backup')
        return backup
      }
      
      return []
    }
  }

  /**
   * 添加简历
   */
  static async addResume(resume: ResumeItem): Promise<void> {
    const resumes = await this.loadResumes()
    resumes.unshift(resume) // 添加到开头
    await this.saveResumes(resumes)
  }

  /**
   * 批量添加简历
   */
  static async addResumes(newResumes: ResumeItem[]): Promise<void> {
    const existingResumes = await this.loadResumes()
    const combinedResumes = [...newResumes, ...existingResumes]
    
    // 去重（基于文件名和大小）
    const uniqueResumes = this.deduplicateResumes(combinedResumes)
    
    await this.saveResumes(uniqueResumes)
  }

  /**
   * 删除简历
   */
  static async deleteResume(id: string): Promise<void> {
    const resumes = await this.loadResumes()
    const filtered = resumes.filter(r => r.id !== id)
    await this.saveResumes(filtered)
  }

  /**
   * 清空所有简历
   */
  static async clearAllResumes(): Promise<void> {
    // 清空服务端
    try {
      await fetch(API_ENDPOINT, { method: 'DELETE' })
    } catch (error) {
      console.error('[ResumeStorage] Server clear failed:', error)
    }
    
    // 清空本地
    localStorage.removeItem(STORAGE_KEY)
    console.log('[ResumeStorage] Cleared all resumes')
  }

  /**
   * 创建备份
   */
  private static createBackup(data: any): void {
    try {
      const backupKey = `${BACKUP_PREFIX}${Date.now()}`
      localStorage.setItem(backupKey, JSON.stringify(data))
    } catch (error) {
      console.warn('[ResumeStorage] Backup failed:', error)
    }
  }

  /**
   * 从备份恢复
   */
  private static loadFromBackup(): ResumeItem[] | null {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(BACKUP_PREFIX))
        .sort()
        .reverse()
      
      for (const key of backupKeys) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}')
          if (data.resumes && Array.isArray(data.resumes)) {
            return data.resumes
          }
        } catch (e) {
          // 跳过损坏的备份
        }
      }
    } catch (error) {
      console.error('[ResumeStorage] Backup restore failed:', error)
    }
    
    return null
  }

  /**
   * 清理旧备份
   */
  private static cleanupOldBackups(): void {
    try {
      const backupKeys = Object.keys(localStorage)
        .filter(key => key.startsWith(BACKUP_PREFIX))
        .sort()
      
      // 保留最新的 MAX_BACKUPS 个备份
      const toDelete = backupKeys.slice(0, -MAX_BACKUPS)
      toDelete.forEach(key => localStorage.removeItem(key))
      
      if (toDelete.length > 0) {
        console.log('[ResumeStorage] Cleaned up', toDelete.length, 'old backups')
      }
    } catch (error) {
      console.warn('[ResumeStorage] Cleanup failed:', error)
    }
  }

  /**
   * 去重
   */
  private static deduplicateResumes(resumes: ResumeItem[]): ResumeItem[] {
    const seen = new Set<string>()
    return resumes.filter(resume => {
      const key = `${resume.fileName}_${resume.size}`
      if (seen.has(key)) {
        return false
      }
      seen.add(key)
      return true
    })
  }

  /**
   * 获取存储统计信息
   */
  static getStats(): { count: number; size: number; lastUpdate: string | null } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return { count: 0, size: 0, lastUpdate: null }
      }
      
      const data = JSON.parse(stored)
      return {
        count: data.resumes?.length || 0,
        size: new Blob([stored]).size,
        lastUpdate: data.lastUpdate || null
      }
    } catch (error) {
      return { count: 0, size: 0, lastUpdate: null }
    }
  }

  /**
   * 导出所有简历为 JSON
   */
  static exportToJSON(): string {
    const resumes = this.loadResumes()
    return JSON.stringify({
      resumes,
      exportDate: new Date().toISOString(),
      version: '1.0'
    }, null, 2)
  }

  /**
   * 从 JSON 导入简历
   */
  static importFromJSON(json: string): number {
    try {
      const data = JSON.parse(json)
      if (!data.resumes || !Array.isArray(data.resumes)) {
        throw new Error('Invalid JSON format')
      }
      
      this.addResumes(data.resumes)
      return data.resumes.length
    } catch (error) {
      console.error('[ResumeStorage] Import failed:', error)
      throw new Error('导入失败，请检查 JSON 格式')
    }
  }
}

