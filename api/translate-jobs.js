/**
 * Job Translation API
 * Translates job titles and descriptions page-by-page
 * Endpoint: POST /api/translate-jobs
 */

// Import storage functions from processed-jobs handler to ensure consistency
import { getAllJobs, saveAllJobs } from '../lib/api-handlers/processed-jobs.js'

// Simple translation using Google Translate API (free, no key required)
async function translateWithGoogle(text, targetLang = 'zh-CN', sourceLang = 'en') {
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`
        const response = await fetch(url)
        const data = await response.json()

        if (data && data[0]) {
            const translatedText = data[0].map(item => item[0]).join('')
            return { success: true, text: translatedText }
        }
        return { success: false, text: '' }
    } catch (error) {
        console.error('[translate-jobs] Google Translate error:', error)
        return { success: false, text: '' }
    }
}

// Fallback translation using MyMemory API
async function translateWithMyMemory(text, targetLang = 'zh-CN', sourceLang = 'en') {
    try {
        const langPair = `${sourceLang}|${targetLang}`
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langPair}`
        const response = await fetch(url)
        const data = await response.json()

        if (data && data.responseData && data.responseData.translatedText) {
            return { success: true, text: data.responseData.translatedText }
        }
        return { success: false, text: '' }
    } catch (error) {
        console.error('[translate-jobs] MyMemory error:', error)
        return { success: false, text: '' }
    }
}

// Helper: Translate text with fallback
async function translateText(text, targetLang = 'zh-CN', sourceLang = 'en') {
    if (!text || text.trim().length === 0) {
        return { success: false, text: '' }
    }

    // Try Google Translate first
    const googleResult = await translateWithGoogle(text, targetLang, sourceLang)
    if (googleResult.success) {
        return googleResult
    }

    // Fallback to MyMemory
    const myMemoryResult = await translateWithMyMemory(text, targetLang, sourceLang)
    if (myMemoryResult.success) {
        return myMemoryResult
    }

    return { success: false, text: '' }
}

// Helper: Translate a single job
async function translateJob(job) {
    const translations = job.translations || {}
    let updated = false

    // Get title field (could be 'title' or 'jobTitle')
    const titleField = job.title || job.jobTitle
    const descField = job.description || job.jobDescription

    console.log(`[translate-jobs] Processing job ${job.id}:`, {
        hasTitle: !!titleField,
        hasDesc: !!descField,
        hasTranslations: !!job.translations,
        existingTransTitle: !!translations.title,
        existingTransDesc: !!translations.description
    })

    // Translate title if not already translated
    if (titleField && !translations.title) {
        console.log(`[translate-jobs] Translating title: "${titleField.substring(0, 50)}..."`)
        const result = await translateText(titleField)
        if (result.success) {
            translations.title = result.text
            updated = true
            console.log(`[translate-jobs] Title translated: "${result.text.substring(0, 50)}..."`)
        } else {
            console.warn(`[translate-jobs] Failed to translate title for job ${job.id}`)
        }
    }

    // Translate description if not already translated
    if (descField && !translations.description) {
        // Limit description length to avoid API limits
        const descToTranslate = descField.substring(0, 1000)
        console.log(`[translate-jobs] Translating description (${descToTranslate.length} chars)...`)
        const result = await translateText(descToTranslate)
        if (result.success) {
            translations.description = result.text
            updated = true
            console.log(`[translate-jobs] Description translated (${result.text.length} chars)`)
        } else {
            console.warn(`[translate-jobs] Failed to translate description for job ${job.id}`)
        }
    }

    if (updated) {
        console.log(`[translate-jobs] Job ${job.id} updated with translations`)
        return {
            ...job,
            translations,
            translatedAt: new Date().toISOString()
        }
    }

    console.log(`[translate-jobs] Job ${job.id} not updated (already translated or no content)`)
    return job
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    try {
        const { page = 1, pageSize = 20 } = req.body || {}

        console.log(`[translate-jobs] Starting translation for page ${page}, pageSize ${pageSize}`)

        // Get all jobs using shared storage function
        const allJobs = await getAllJobs()
        if (!allJobs || allJobs.length === 0) {
            console.log('[translate-jobs] No jobs found in storage')
            return res.status(200).json({
                success: true,
                message: 'No jobs to translate',
                translated: 0,
                failed: 0,
                skipped: 0,
                page,
                totalJobs: 0
            })
        }

        console.log(`[translate-jobs] Found ${allJobs.length} total jobs`)

        // Log first job structure for debugging
        if (allJobs.length > 0) {
            const firstJob = allJobs[0]
            console.log('[translate-jobs] First job structure:', {
                id: firstJob.id,
                hasTitle: !!firstJob.title,
                hasJobTitle: !!firstJob.jobTitle,
                hasDescription: !!firstJob.description,
                hasJobDescription: !!firstJob.jobDescription,
                hasTranslations: !!firstJob.translations,
                titleValue: firstJob.title || firstJob.jobTitle || 'N/A',
                fields: Object.keys(firstJob).slice(0, 10)
            })
        }

        // Calculate pagination
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const jobsToTranslate = allJobs.slice(startIndex, endIndex)

        if (jobsToTranslate.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No jobs on this page',
                translated: 0,
                failed: 0,
                skipped: 0,
                page,
                totalJobs: allJobs.length
            })
        }

        console.log(`[translate-jobs] Translating ${jobsToTranslate.length} jobs (${startIndex + 1} to ${endIndex})`)

        // Translate jobs
        let translated = 0
        let failed = 0
        let skipped = 0

        for (let i = 0; i < jobsToTranslate.length; i++) {
            const job = jobsToTranslate[i]

            // Skip if already translated
            if (job.translations?.title && job.translations?.description) {
                skipped++
                continue
            }

            try {
                const translatedJob = await translateJob(job)

                // Update in allJobs array
                const jobIndex = allJobs.findIndex(j => j.id === job.id)
                if (jobIndex !== -1) {
                    allJobs[jobIndex] = translatedJob

                    // Check if translation was successful
                    if (translatedJob.translations?.title || translatedJob.translations?.description) {
                        translated++
                    } else {
                        failed++
                    }
                }

                // Add small delay to avoid rate limiting
                if (i < jobsToTranslate.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500))
                }
            } catch (error) {
                console.error(`[translate-jobs] Error translating job ${job.id}:`, error)
                failed++
            }
        }

        // Save updated jobs using shared storage function
        const saved = await saveAllJobs(allJobs)
        if (!saved || saved.length === 0) {
            console.error('[translate-jobs] Failed to save translated jobs')
        } else {
            console.log(`[translate-jobs] Saved ${saved.length} jobs to storage`)
        }

        const totalPages = Math.ceil(allJobs.length / pageSize)

        console.log(`[translate-jobs] Completed: ${translated} translated, ${failed} failed, ${skipped} skipped`)

        return res.status(200).json({
            success: true,
            message: `Translated ${translated} jobs on page ${page}`,
            translated,
            failed,
            skipped,
            page,
            totalPages,
            totalJobs: allJobs.length,
            pageSize
        })
    } catch (error) {
        console.error('[translate-jobs] Error:', error)
        return res.status(500).json({
            success: false,
            error: error.message || 'Translation failed'
        })
    }
}
