/**
 * Job Translation API
 * Translates job titles and descriptions page-by-page
 * Endpoint: POST /api/translate-jobs
 */

import { GoogleTranslateService } from '../src/services/google-translate-service'
import { MyMemoryTranslateService } from '../src/services/mymemory-translate-service'

// Initialize translation services
const googleTranslate = new GoogleTranslateService()
const myMemoryTranslate = new MyMemoryTranslateService()

// Storage configuration
const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const UPSTASH_REST_CONFIGURED = !!(UPSTASH_REST_URL && UPSTASH_REST_TOKEN)

const JOBS_KEY = 'haigoo:processed_jobs'

// Helper: Get jobs from storage
async function getJobs() {
    try {
        if (UPSTASH_REST_CONFIGURED) {
            const response = await fetch(`${UPSTASH_REST_URL}/get/${JOBS_KEY}`, {
                headers: { Authorization: `Bearer ${UPSTASH_REST_TOKEN}` }
            })
            const data = await response.json()
            if (data.result) {
                const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result
                return Array.isArray(parsed) ? parsed : []
            }
        }
        return []
    } catch (error) {
        console.error('[translate-jobs] Error fetching jobs:', error)
        return []
    }
}

// Helper: Save jobs to storage
async function saveJobs(jobs) {
    try {
        if (UPSTASH_REST_CONFIGURED) {
            await fetch(`${UPSTASH_REST_URL}/set/${JOBS_KEY}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${UPSTASH_REST_TOKEN}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(jobs)
            })
            return true
        }
        return false
    } catch (error) {
        console.error('[translate-jobs] Error saving jobs:', error)
        return false
    }
}

// Helper: Translate text with fallback
async function translateText(text, targetLang = 'zh-CN', sourceLang = 'en') {
    if (!text || text.trim().length === 0) {
        return { success: false, text: '' }
    }

    // Try Google Translate first
    try {
        const result = await googleTranslate.translateText(text, targetLang, sourceLang)
        if (result.success && result.data?.translatedText) {
            return { success: true, text: result.data.translatedText }
        }
    } catch (error) {
        console.warn('[translate-jobs] Google Translate failed:', error.message)
    }

    // Fallback to MyMemory
    try {
        const result = await myMemoryTranslate.translateText(text, targetLang, sourceLang)
        if (result.success && result.data?.translatedText) {
            return { success: true, text: result.data.translatedText }
        }
    } catch (error) {
        console.warn('[translate-jobs] MyMemory Translate failed:', error.message)
    }

    return { success: false, text: '' }
}

// Helper: Translate a single job
async function translateJob(job) {
    const translations = job.translations || {}
    let updated = false

    // Translate title if not already translated
    if (job.title && !translations.title) {
        const result = await translateText(job.title)
        if (result.success) {
            translations.title = result.text
            updated = true
        }
    }

    // Translate description if not already translated
    if (job.description && !translations.description) {
        // Limit description length to avoid API limits
        const descToTranslate = job.description.substring(0, 1000)
        const result = await translateText(descToTranslate)
        if (result.success) {
            translations.description = result.text
            updated = true
        }
    }

    if (updated) {
        return {
            ...job,
            translations,
            translatedAt: new Date().toISOString()
        }
    }

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

        // Get all jobs
        const allJobs = await getJobs()
        if (!allJobs || allJobs.length === 0) {
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

        // Save updated jobs
        const saved = await saveJobs(allJobs)
        if (!saved) {
            console.error('[translate-jobs] Failed to save translated jobs')
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
