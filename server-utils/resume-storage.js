
/**
 * 简历数据存储服务
 * 支持存储到 Neon 数据库
 */

import neonHelper from './dal/neon-helper.js'

// 内存存储（作为最后的回退）
let memoryResumes = []

// 获取所有简历
export async function getResumes() {
    let provider = 'memory'
    let resumes = []

    // 优先尝试 Neon 数据库
    if (neonHelper.isConfigured) {
        try {
            const result = await neonHelper.query('SELECT * FROM resumes ORDER BY created_at DESC')
            if (result && result.length > 0) {
                resumes = result.map(row => ({
                    id: row.resume_id,
                    userId: row.user_id,
                    fileName: row.file_name,
                    size: row.file_size,
                    fileType: row.file_type,
                    parseStatus: row.parse_status,
                    parseResult: row.parse_result,
                    parseError: row.parse_error,
                    contentText: row.content_text,
                    metadata: row.metadata,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                }))
                provider = 'neon'
                // 同步到内存
                memoryResumes = resumes
            }
        } catch (error) {
            console.warn('[Resume Storage] Neon read failed:', error.message)
        }
    }

    // 回退到内存
    if (resumes.length === 0 && memoryResumes.length > 0) {
        resumes = memoryResumes
        provider = 'memory'
    }

    return { resumes, provider }
}

// 保存简历列表
export async function saveResumes(resumes) {
    let provider = 'memory'
    let success = false

    // 去重和清理
    const uniqueResumes = deduplicateResumes(resumes)
    const limitedResumes = uniqueResumes.slice(0, 10000) // 最多保留 10000 份

    // 更新内存
    memoryResumes = limitedResumes

    // 优先保存到 Neon 数据库
    if (neonHelper.isConfigured) {
        try {
            // 使用事务批量保存
            await neonHelper.transaction(async (sql) => {
                // 先清空现有数据
                await sql.query('DELETE FROM resumes')
                
                // 批量插入新数据
                for (const resume of limitedResumes) {
                    await sql.query(`
                        INSERT INTO resumes (
                            resume_id, user_id, file_name, file_size, file_type,
                            parse_status, parse_result, parse_error, content_text, metadata
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    `, [
                        resume.id || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        resume.userId,
                        resume.fileName,
                        resume.size,
                        resume.fileType,
                        resume.parseStatus || 'pending',
                        resume.parseResult || null,
                        resume.parseError || null,
                        resume.contentText || null,
                        resume.metadata || {}
                    ])
                }
            })
            
            provider = 'neon'
            success = true
        } catch (error) {
            console.error('[Resume Storage] Neon save failed:', error.message)
        }
    }

    // 如果都失败，至少内存里有
    if (!success) {
        success = true
        provider = 'memory'
    }

    // 更新统计信息
    if (success) {
        await updateStats(limitedResumes, provider)
    }

    return { success, provider, count: limitedResumes.length }
}

// 保存单个用户简历（覆盖旧的）
export async function saveUserResume(userId, resumeData) {
    // 优先尝试直接保存到 Neon 数据库
    if (neonHelper.isConfigured) {
        try {
            // 先删除该用户的旧简历
            await neonHelper.query('DELETE FROM resumes WHERE user_id = $1', [userId])
            
            // 插入新简历
            const newResume = {
                ...resumeData,
                userId,
                updatedAt: new Date().toISOString(),
                id: resumeData.id || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            }
            
            const result = await neonHelper.query(`
                INSERT INTO resumes (
                    resume_id, user_id, file_name, file_size, file_type,
                    parse_status, parse_result, parse_error, content_text, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            `, [
                newResume.id,
                newResume.userId,
                newResume.fileName,
                newResume.size,
                newResume.fileType,
                newResume.parseStatus || 'pending',
                newResume.parseResult || null,
                newResume.parseError || null,
                newResume.contentText || null,
                newResume.metadata || {}
            ])
            
            // 更新内存缓存
            const { resumes } = await getResumes()
            const otherResumes = resumes.filter(r => r.userId !== userId)
            memoryResumes = [newResume, ...otherResumes]
            
            // 更新统计信息
            await updateStats(memoryResumes, 'neon')
            
            return { success: true, provider: 'neon', count: memoryResumes.length }
        } catch (error) {
            console.error('[Resume Storage] Neon save user resume failed:', error.message)
        }
    }
    
    // 回退到原有逻辑
    const { resumes } = await getResumes()
    const otherResumes = resumes.filter(r => r.userId !== userId)
    
    const newResume = {
        ...resumeData,
        userId,
        updatedAt: new Date().toISOString(),
        id: resumeData.id || `resume_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
    
    const newResumes = [newResume, ...otherResumes]
    return await saveResumes(newResumes)
}

// 去重
function deduplicateResumes(resumes) {
    const seen = new Map()
    return resumes.filter(resume => {
        // 如果有 userId，优先按 userId 去重（每个用户只能有一份）
        if (resume.userId) {
            if (seen.has(resume.userId)) return false
            seen.set(resume.userId, true)
            return true
        }

        // 否则按文件名和大小（旧逻辑兼容）
        const key = `${resume.fileName}_${resume.size}`
        if (seen.has(key)) return false
        seen.set(key, true)
        return true
    })
}

// 更新统计信息
async function updateStats(resumes, provider) {
    const stats = {
        totalCount: resumes.length,
        successCount: resumes.filter(r => r.parseStatus === 'success').length,
        failedCount: resumes.filter(r => r.parseStatus === 'failed').length,
        lastUpdate: new Date().toISOString(),
        storageProvider: provider,
        estimatedSize: JSON.stringify(resumes).length
    }

    try {
        if (neonHelper.isConfigured) {
            // 先删除旧的统计信息
            await neonHelper.query('DELETE FROM resume_stats')
            
            // 插入新的统计信息
            await neonHelper.query(`
                INSERT INTO resume_stats (
                    total_count, success_count, failed_count, 
                    last_update, storage_provider, estimated_size
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                stats.totalCount,
                stats.successCount,
                stats.failedCount,
                stats.lastUpdate,
                stats.storageProvider,
                stats.estimatedSize
            ])
        }
    } catch (error) {
        console.warn('[Resume Storage] Stats update failed:', error.message)
    }
}
