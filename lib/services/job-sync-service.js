
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { writeJobsToNeon } from '../api-handlers/processed-jobs.js';
import { generateDedupKey } from '../utils/job-utils.js';
import { mergeWithIntegrity, validateIntegrity } from '../utils/data-integrity.js';

/**
 * Calculate Jaccard Similarity between two sets of tokens.
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} 0 to 1
 */
export function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Tokenize: lowercase, remove special chars, split by whitespace
    const tokenize = (text) => {
        return new Set(
            text.toLowerCase()
                .replace(/[^\w\s\u4e00-\u9fa5\+\#\.\-]/g, '') // Keep letters, numbers, Chinese, +, #, ., - (for tech stack like C++, C#, Node.js)
                .split(/\s+/)
                .filter(t => t.length > 1) // Ignore single chars
        );
    };

    const set1 = tokenize(str1);
    const set2 = tokenize(str2);

    if (set1.size === 0 || set2.size === 0) return 0;

    // Intersection
    let intersection = 0;
    for (const token of set1) {
        if (set2.has(token)) intersection++;
    }

    // Union
    const union = set1.size + set2.size - intersection;
    
    return intersection / union;
}

/**
 * Synchronize jobs for a trusted company.
 * Implements the "Fuzzy Match" logic to preserve manually edited jobs even if URL changes.
 * 
 * Logic:
 * 1. Fetch existing jobs for the company.
 * 2. Classify crawled jobs into "Direct Match" and "New Candidate".
 * 3. Classify existing jobs into "Matched" and "Obsolete Candidate".
 * 4. Fuzzy Match "New Candidate" vs "Obsolete Candidate" (Title + JD Similarity > 80%).
 * 5. If matched, update the "Obsolete" job with new URL/Timestamp but preserve manual edits.
 * 6. Delete truly obsolete jobs (unless manually added).
 * 7. Upsert new/updated jobs.
 * 
 * @param {string} companyId 
 * @param {string} companyName 
 * @param {Array} crawledJobs 
 * @returns {Promise<object>} { savedCount, deletedCount, migratedCount }
 */
export async function syncCompanyJobs(companyId, companyName, crawledJobs) {
    console.log(`[JobSync] Syncing ${crawledJobs.length} jobs for ${companyName} (${companyId})...`);

    if (!neonHelper.isConfigured) {
        throw new Error('Database not configured');
    }

    // 0. Filter crawled jobs by date (Max 30 days)
    // This ensures we don't import or retain old jobs from the source, enforcing the retention policy.
    // User Requirement: "爬虫数据限定为发布时间在一个月（30天）以内"
    // Use env var or default to 30
    const RETAIN_DAYS = Number(process.env.PROCESSED_JOBS_RETAIN_DAYS || process.env.RETAIN_DAYS || 30);
    const cutoff = new Date(Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000);
    
    const validCrawledJobs = crawledJobs.filter(j => {
        // Exception for AmpiFire (Allow old jobs)
        // Log for debugging
        if (companyName.toLowerCase().includes('ampifire')) {
             console.log(`[JobSync] Keeping AmpiFire job: ${j.title} (${j.publishedAt})`);
             return true;
        }
        // Exception for Osome (Allow old jobs)
        if (companyName.toLowerCase() === 'osome') return true;
        // Exception for Taskade (Allow old jobs)
        if (companyName === 'Taskade') return true;

        if (!j.publishedAt) return true; // Keep if no date
        const d = new Date(j.publishedAt);
        if (isNaN(d.getTime())) return true; // Keep if invalid date
        return d >= cutoff;
    });

    if (crawledJobs.length > validCrawledJobs.length) {
        console.log(`[JobSync] Date Filter: ${crawledJobs.length} -> ${validCrawledJobs.length} jobs (Limit: ${RETAIN_DAYS} days). Filtered out ${crawledJobs.length - validCrawledJobs.length} old jobs.`);
    }

    // 1. Fetch existing jobs
    // We fetch ALL columns to ensure integrity
    const existingJobs = await neonHelper.query(`
        SELECT *
        FROM jobs 
        WHERE (company_id = $1 OR (company = $2 AND company_id IS NULL))
    `, [companyId, companyName]);

    // Map DB rows to camelCase for consistent processing if needed
    // However, existingJobs currently returns snake_case rows.
    // Our mergeWithIntegrity expects consistent keys.
    // Let's create a helper to map snake_case row to camelCase Job object for the "existing" part.
    
    // Quick helper inside:
    const toCamelCase = (row) => ({
        id: row.job_id,
        title: row.title,
        url: row.url,
        description: row.description,
        isManuallyEdited: row.is_manually_edited,
        isApproved: row.is_approved,
        isFeatured: row.is_featured,
        tags: row.tags,
        translations: row.translations,
        isTranslated: row.is_translated,
        translatedAt: row.translated_at,
        requirements: row.requirements,
        benefits: row.benefits,
        haigooComment: row.haigoo_comment,
        hiddenFields: row.hidden_fields,
        riskRating: row.risk_rating,
        canRefer: row.can_refer,
        sourceType: row.source_type,
        companyId: row.company_id,
        location: row.location,
        timezone: row.timezone,
        publishedAt: row.published_at,
        salary: row.salary,
        jobType: row.job_type,
        experienceLevel: row.experience_level,
        category: row.category,
        region: row.region,
        industry: row.industry,
        // Keep raw row for reference if needed
        _raw: row
    });

    const existingMap = new Map();
    existingJobs.forEach(j => existingMap.set(j.url.toLowerCase(), toCamelCase(j))); // Map by URL for direct match
    // Also map by ID if URL check fails but ID matches (rare if ID is derived from URL)
    const existingIdMap = new Map();
    existingJobs.forEach(j => existingIdMap.set(j.job_id, toCamelCase(j)));

    // 2. Classify Crawled Jobs (Use Filtered List)
    const toUpsert = [];
    const newCandidates = [];
    const matchedExistingIds = new Set();

    for (const cJob of validCrawledJobs) {
        // Ensure ID generation consistency
        if (!cJob.id) {
            cJob.id = generateDedupKey(cJob).replace('id:', '').replace('hash:', '');
        }

        const urlKey = (cJob.url || '').toLowerCase();
        let directMatch = existingMap.get(urlKey);
        
        if (!directMatch && cJob.id) {
             directMatch = existingIdMap.get(cJob.id);
        }

        if (directMatch) {
            // Direct Match: It's an update
            matchedExistingIds.add(directMatch.id);
            
            // Calculate similarity to check if we should skip updating description
            const similarity = calculateSimilarity(cJob.description, directMatch.description);
            const isHighlySimilar = similarity > 0.8;

            // Use Integrity Guard to safely merge
            // This replaces the manual copy-paste logic and ensures ALL protected fields are preserved
            const mergedJob = mergeWithIntegrity(cJob, directMatch, { 
                isManualOverride: isHighlySimilar // Treat highly similar as "don't overwrite"
            });

            // If highly similar but not manual, log it
            if (isHighlySimilar && !directMatch.isManuallyEdited) {
                console.log(`[JobSync] Direct Match highly similar (${similarity.toFixed(2)}). Preserving existing data for ${cJob.id}`);
            }

            // Replace cJob with merged result
            Object.assign(cJob, mergedJob);
            
            toUpsert.push(cJob);
        } else {
            newCandidates.push(cJob);
        }
    }

    // 3. Identify Obsolete Candidates
    const obsoleteCandidates = existingJobs.filter(j => !matchedExistingIds.has(j.id));
    
    // 4. Fuzzy Matching
    let migratedCount = 0;
    const finalObsoleteIds = new Set(obsoleteCandidates.map(j => j.id));

    // We iterate new candidates and try to find a "home" in obsolete candidates
    for (let i = newCandidates.length - 1; i >= 0; i--) {
        const newJob = newCandidates[i];
        
        // Find best match in obsoleteCandidates
        // Criteria: Title Identical (case-insensitive) AND (Similarity > 0.8 OR Manual Job)
        let bestMatch = null;
        let bestScore = 0;

        for (const oldJob of obsoleteCandidates) {
            if (!finalObsoleteIds.has(oldJob.id)) continue; // Already migrated

            if (oldJob.title.toLowerCase().trim() === newJob.title.toLowerCase().trim()) {
                // For manual jobs OR featured jobs, Title match is sufficient (description might differ significantly)
                const isManual = oldJob.source_type === 'manual';
                const isFeatured = oldJob.is_featured;
                const score = calculateSimilarity(newJob.description, oldJob.description);
                
                // If manual or featured, we accept even low similarity (trust the title)
                // If not manual/featured, require high similarity (0.8)
                const threshold = (isManual || isFeatured) ? 0.1 : 0.8;

                if (score > threshold && score > bestScore) {
                    bestScore = score;
                    bestMatch = oldJob;
                }
                
                // If manual/featured and title matches, we can break early if we trust title enough
                // But keeping bestScore logic is safer if there are duplicates
            }
        }

        if (bestMatch) {
            // Found a fuzzy match! This is the "Same Job" but URL changed.
            // We want to KEEP the Old Job's ID/Identity if possible, OR migrate data to New Job ID.
            // Since `writeJobsToNeon` uses `ON CONFLICT (job_id)`, and `job_id` is derived from URL/Content...
            // If we use `newJob.id` (from new URL), it will be a NEW row.
            // If we want to "replace" the old job, we should probably DELETE the old job and INSERT the new one
            // BUT with the old job's manually edited content.
            
            console.log(`[JobSync] Fuzzy match found! '${newJob.title}' (New) matches '${bestMatch.title}' (Old, Manual=${bestMatch.source_type==='manual'}). Score: ${bestScore.toFixed(2)}`);

            // OPTIMIZATION: Reuse Old Job ID to preserve history (favorites, applications, etc.)
            newJob.id = bestMatch.id;

            // Merge old data into new job using Integrity Guard
            const mergedJob = mergeWithIntegrity(newJob, bestMatch, { 
                isManualOverride: true // Force preservation for fuzzy matches
            });
            
            Object.assign(newJob, mergedJob);

            // Move from New Candidates to Upsert
            toUpsert.push(newJob);
            newCandidates.splice(i, 1);

            // Remove from delete list (Since we are updating it)
            finalObsoleteIds.delete(bestMatch.id);
            migratedCount++;
        }
    }

    // 5. Upsert Jobs (Direct Matches + Migrated Matches + New Jobs)
    // Add remaining new candidates (truly new jobs)
    toUpsert.push(...newCandidates);

    // 6. Delete Obsolete Jobs
    // These are jobs in obsoleteCandidates that were NOT fuzzy matched.
    const idsToDelete = [];
    
    // Filter obsolete jobs:
    // - If it's a "Manual Entry" (source_type = 'manual' or is_manually_edited), DO NOT DELETE.
    // - If it's a "Featured Job" (is_featured = true), DO NOT DELETE.
    // - Instead, mark as Pending (is_approved = false) so admin can verify.
    // - Otherwise, delete.
    
    for (const id of finalObsoleteIds) {
        const job = existingIdMap.get(id);
        if (job && (job.sourceType === 'manual' || job.isManuallyEdited || job.isFeatured)) {
            console.log(`[JobSync] Protected job '${job.title}' (Manual/Featured) not found in crawl. Marking as Pending.`);
            // Update status to Pending (is_approved = false)
            // We need to upsert this change
            const updatedManualJob = { ...job };
            
            // Map DB row to Job object (simplified mapping for update)
            const mappedJob = {
                id: job.id,
                title: job.title,
                company: companyName,
                companyId: companyId,
                location: job.location,
                description: job.description,
                url: job.url,
                publishedAt: job.publishedAt,
                // ... other fields
                sourceType: job.sourceType,
                isManuallyEdited: true,
                isApproved: false, // MARK AS PENDING
                status: 'active' // Keep active
            };
            
            // Use Integrity Guard to preserve everything else
            const mergedJob = mergeWithIntegrity(mappedJob, job, { isManualOverride: true });
            
            toUpsert.push(mergedJob);
        } else {
            idsToDelete.push(id);
        }
    }
    
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
        // Batch delete
        // Use neonHelper directly
        // Note: idsToDelete might be large
        const CHUNK_SIZE = 50;
        for (let i = 0; i < idsToDelete.length; i += CHUNK_SIZE) {
            const chunk = idsToDelete.slice(i, i + CHUNK_SIZE);
            const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
            await neonHelper.query(`DELETE FROM jobs WHERE job_id IN (${placeholders})`, chunk);
            deletedCount += chunk.length;
        }
    }

    // 7. Write Upserts
    let savedCount = 0;
    if (toUpsert.length > 0) {
        // Use writeJobsToNeon with 'upsert' mode
        // Note: writeJobsToNeon expects "Job" objects (frontend/backend shared type)
        // Ensure keys match what writeJobsToNeon expects (camelCase)
        // cJob is already in that format from crawler.
        const saved = await writeJobsToNeon(toUpsert, 'upsert', true);
        savedCount = saved.length;
    }

    console.log(`[JobSync] Sync complete for ${companyName}. Saved: ${savedCount}, Deleted: ${deletedCount}, Migrated: ${migratedCount}`);

    return { savedCount, deletedCount, migratedCount };
}
