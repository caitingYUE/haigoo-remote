/**
 * API endpoint for manual translation triggers from admin panel
 * Handles page-by-page translation of jobs
 */

// 🔧 FIX: 直接导入，不使用动态导入
const { translateJobs } = require('../../lib/services/translation-service.cjs')
const { getAllJobs, saveJobs } = require('../../lib/api-handlers/processed-jobs.js')

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Get page and pageSize from request body
    const { page = 1, pageSize = 20 } = req.body || {}

    console.log(`[translate-jobs API] ========== 开始翻译 ==========`)
    console.log(`[translate-jobs API] 页码: ${page}, 每页: ${pageSize}`)

    try {
        // 🔧 FIX: 使用 getAllJobs 然后手动分页
        console.log(`[translate-jobs API] Step 1: 读取所有岗位...`)
        const allJobs = await getAllJobs()
        console.log(`[translate-jobs API] ✅ 读取到 ${allJobs.length} 个岗位`)

        if (!allJobs || allJobs.length === 0) {
            console.log(`[translate-jobs API] ⚠️ 数据库中没有岗位`)
            return res.status(200).json({
                success: true,
                translated: 0,
                skipped: 0,
                failed: 0,
                totalPages: 0,
                message: 'No jobs found in database'
            })
        }

        // 手动分页
        const start = (page - 1) * pageSize
        const end = start + pageSize
        const jobs = allJobs.slice(start, end)
        const totalPages = Math.ceil(allJobs.length / pageSize)

        console.log(`[translate-jobs API] Step 2: 分页数据 - 第${page}/${totalPages}页, ${jobs.length}个岗位`)

        // 过滤未翻译的岗位
        const untranslated = jobs.filter(job => !job.isTranslated)
        const alreadyTranslated = jobs.length - untranslated.length

        console.log(`[translate-jobs API] Step 3: 过滤 - ${untranslated.length}个待翻译, ${alreadyTranslated}个已翻译`)

        if (untranslated.length === 0) {
            console.log(`[translate-jobs API] ✅ 本页所有岗位已翻译`)
            return res.status(200).json({
                success: true,
                translated: 0,
                skipped: alreadyTranslated,
                failed: 0,
                totalPages,
                message: 'All jobs on this page are already translated'
            })
        }

        // 翻译岗位
        console.log(`[translate-jobs API] Step 4: 开始翻译 ${untranslated.length} 个岗位...`)
        let translated = []
        try {
            translated = await translateJobs(untranslated)
            console.log(`[translate-jobs API] ✅ 翻译完成`)
        } catch (translationError) {
            console.error(`[translate-jobs API] ❌ 翻译失败:`, translationError)
            return res.status(500).json({
                success: false,
                error: 'Translation failed',
                message: translationError.message,
                details: translationError.stack
            })
        }

        // 统计结果
        const successCount = translated.filter(j => j.isTranslated).length
        const failCount = translated.length - successCount

        console.log(`[translate-jobs API] Step 5: 翻译结果 - 成功:${successCount}, 失败:${failCount}`)

        // 保存翻译结果
        if (successCount > 0) {
            const toSave = translated.filter(j => j.isTranslated)
            console.log(`[translate-jobs API] Step 6: 保存 ${toSave.length} 个翻译结果...`)
            try {
                await saveJobs(toSave)
                console.log(`[translate-jobs API] ✅ 保存成功`)
            } catch (saveError) {
                console.error(`[translate-jobs API] ❌ 保存失败:`, saveError)
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save translations',
                    message: saveError.message,
                    details: saveError.stack
                })
            }
        }

        // 返回成功
        console.log(`[translate-jobs API] ========== 翻译完成 ==========`)
        return res.status(200).json({
            success: true,
            translated: successCount,
            skipped: alreadyTranslated,
            failed: failCount,
            totalPages,
            currentPage: page,
            message: `Translated ${successCount} jobs on page ${page}/${totalPages}`
        })

    } catch (error) {
        console.error('[translate-jobs API] ❌ 未知错误:', error)
        return res.status(500).json({
            success: false,
            error: 'Translation failed',
            message: error.message,
            details: error.stack
        })
    }
}
