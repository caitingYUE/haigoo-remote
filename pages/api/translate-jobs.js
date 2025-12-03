/**
 * API endpoint for manual translation triggers from admin panel
 * Handles page-by-page translation of jobs
 */

import { readJobsFromNeon, writeJobsToNeon } from '../../lib/api-handlers/processed-jobs.js'

// Dynamically import translation service
let translateJobs = null
try {
    const translationService = await import('../../lib/services/translation-service.cjs')
    translateJobs = translationService.default?.translateJobs || translationService.translateJobs
} catch (error) {
    console.warn('[translate-jobs API] Translation service not available:', error.message)
}

export default async function handler(req, res) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    // Check if translation service is available
    if (!translateJobs) {
        return res.status(500).json({
            error: 'Translation service not available',
            message: 'Translation service could not be loaded'
        })
    }

    // Get page and pageSize from request body
    const { page = 1, pageSize = 20 } = req.body || {}

    console.log(`[translate-jobs API] Translating page ${page}, pageSize ${pageSize}`)

    try {
        // 1. Read jobs from database for this page
        const jobs = await readJobsFromNeon({}, { page, limit: pageSize })

        if (!jobs || jobs.length === 0) {
            return res.status(200).json({
                success: true,
                translated: 0,
                skipped: 0,
                failed: 0,
                totalPages: 0,
                message: 'No jobs found'
            })
        }

        // 2. Filter untranslated jobs
        const untranslated = jobs.filter(job => !job.isTranslated)
        const alreadyTranslated = jobs.length - untranslated.length

        console.log(`[translate-jobs API] Page ${page}: ${untranslated.length} to translate, ${alreadyTranslated} already translated`)

        if (untranslated.length === 0) {
            return res.status(200).json({
                success: true,
                translated: 0,
                skipped: alreadyTranslated,
                failed: 0,
                totalPages: Math.ceil(jobs.length / pageSize),
                message: 'All jobs on this page are already translated'
            })
        }

        // 3. Translate jobs
        let translated = []
        try {
            translated = await translateJobs(untranslated)
        } catch (translationError) {
            console.error(`[translate-jobs API] Translation failed:`, translationError)
            return res.status(500).json({
                success: false,
                error: 'Translation failed',
                message: translationError.message
            })
        }

        // 4. Save translated jobs back to database (upsert mode)
        const successCount = translated.filter(j => j.isTranslated).length
        const failCount = translated.length - successCount

        if (successCount > 0) {
            const toSave = translated.filter(j => j.isTranslated)
            try {
                await writeJobsToNeon(toSave, 'upsert')
                console.log(`[translate-jobs API] Saved ${toSave.length} translated jobs`)
            } catch (saveError) {
                console.error(`[translate-jobs API] Save failed:`, saveError)
                return res.status(500).json({
                    success: false,
                    error: 'Failed to save translations',
                    message: saveError.message
                })
            }
        }

        // 5. Return success
        return res.status(200).json({
            success: true,
            translated: successCount,
            skipped: alreadyTranslated,
            failed: failCount,
            totalPages: Math.ceil(jobs.length / pageSize),
            message: `Translated ${successCount} jobs on page ${page}`
        })

    } catch (error) {
        console.error('[translate-jobs API] Error:', error)
        return res.status(500).json({
            success: false,
            error: 'Translation failed',
            message: error.message
        })
    }
}
