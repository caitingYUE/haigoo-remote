/**
 * 简历存储服务
 * 负责简历数据的本地持久化和同步
 */

import { ResumeItem } from '../types/resume-types'

const STORAGE_KEY = 'haigoo_resume_library'
const BACKUP_PREFIX = 'haigoo_resume_backup_'
const MAX_BACKUPS = 5

export class ResumeStorageService {
  /**
   * 保存简历到 localStorage
   */
  static saveResumes(resumes: ResumeItem[]): void {
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
      
      console.log('[ResumeStorage] Saved', resumes.length, 'resumes')
    } catch (error) {
      console.error('[ResumeStorage] Save failed:', error)
      throw new Error('保存简历失败，请检查浏览器存储空间')
    }
  }

  /**
   * 从 localStorage 加载简历
   */
  static loadResumes(): ResumeItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        console.log('[ResumeStorage] No data found')
        return []
      }
      
      const data = JSON.parse(stored)
      console.log('[ResumeStorage] Loaded', data.resumes?.length || 0, 'resumes')
      return data.resumes || []
    } catch (error) {
      console.error('[ResumeStorage] Load failed:', error)
      
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
  static addResume(resume: ResumeItem): void {
    const resumes = this.loadResumes()
    resumes.unshift(resume) // 添加到开头
    this.saveResumes(resumes)
  }

  /**
   * 批量添加简历
   */
  static addResumes(newResumes: ResumeItem[]): void {
    const existingResumes = this.loadResumes()
    const combinedResumes = [...newResumes, ...existingResumes]
    
    // 去重（基于文件名和上传时间）
    const uniqueResumes = this.deduplicateResumes(combinedResumes)
    
    this.saveResumes(uniqueResumes)
  }

  /**
   * 删除简历
   */
  static deleteResume(id: string): void {
    const resumes = this.loadResumes()
    const filtered = resumes.filter(r => r.id !== id)
    this.saveResumes(filtered)
  }

  /**
   * 清空所有简历
   */
  static clearAllResumes(): void {
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

