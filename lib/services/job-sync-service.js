
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { writeJobsToNeon } from '../api-handlers/processed-jobs.js';
import { generateDedupKey } from '../utils/job-utils.js';

/**
 * Calculate Jaccard Similarity between two sets of tokens.
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} 0 to 1
 */
function calculateSimilarity(str1, str2) {
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
 * Generate deduplication key for job (simplified version of processed-jobs.js)
 * Note: This must match the logic in processed-jobs.js to ensure consistency.
 * However, since we are handling crawling, we often deal with raw data.
 * @param {object} job 
 */
function generateDedupKey(job) {
    if (job.id && typeof job.id === 'string' && job.id.length > 0 && !job.id.includes('random')) {
        return `id:${job.id}`;
    }
    const title = (job.title || '').toLowerCase().trim();
    const company = (job.company || '').toLowerCase().trim();
    const url = (job.url || '').toLowerCase().trim();
    const sourceType = (job.sourceType || 'unknown').toLowerCase().trim();

    const key = `${title}|${company}|${url}|${sourceType}`;

    let hash = 0;
    for (let i = 0; i < key.length; i++) {
        const char = key.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return `hash:${Math.abs(hash).toString(36)}`;
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

    // 1. Fetch existing jobs
    // We fetch ALL jobs for this company (except source='manual')
    // We need description for fuzzy matching
    const existingJobs = await neonHelper.query(`
        SELECT 
            job_id as id, title, url, description, 
            is_manually_edited, is_approved, is_featured,
            tags, translations, is_translated, translated_at,
            requirements, benefits, haigoo_comment, hidden_fields,
            risk_rating, can_refer, source_type, company_id
        FROM jobs 
        WHERE (company_id = $1 OR (company = $2 AND company_id IS NULL))
        AND source != 'manual'
    `, [companyId, companyName]);

    const existingMap = new Map();
    existingJobs.forEach(j => existingMap.set(j.url.toLowerCase(), j)); // Map by URL for direct match
    // Also map by ID if URL check fails but ID matches (rare if ID is derived from URL)
    const existingIdMap = new Map();
    existingJobs.forEach(j => existingIdMap.set(j.id, j));

    // 2. Classify Crawled Jobs
    const toUpsert = [];
    const newCandidates = [];
    const matchedExistingIds = new Set();

    for (const cJob of crawledJobs) {
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
            
            // Merge logic for Direct Match
            // If manually edited, preserve protected fields
            if (directMatch.is_manually_edited) {
                // Keep manual fields
                cJob.description = directMatch.description; // Preserve edited description? User said: "Avoid crawler data replacing..."
                // Actually, for direct match, if it's manually edited, we usually assume the manual edit is better.
                // But if the JD changed significantly?
                // The user requirement implies we prioritize manual edits.
                // So we KEEP the old description, title, etc. if manually edited.
                cJob.title = directMatch.title;
                cJob.tags = directMatch.tags; // Parse if needed? DB returns JSON usually? neonHelper returns object?
                cJob.requirements = directMatch.requirements;
                cJob.benefits = directMatch.benefits;
                cJob.isManuallyEdited = true;
                cJob.isApproved = directMatch.is_approved;
                cJob.translations = directMatch.translations;
                cJob.isTranslated = directMatch.is_translated;
            }
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
        // Criteria: Title Identical (case-insensitive) AND Similarity > 0.8
        let bestMatch = null;
        let bestScore = 0;

        for (const oldJob of obsoleteCandidates) {
            if (!finalObsoleteIds.has(oldJob.id)) continue; // Already migrated

            if (oldJob.title.toLowerCase().trim() === newJob.title.toLowerCase().trim()) {
                const score = calculateSimilarity(newJob.description, oldJob.description);
                if (score > 0.8 && score > bestScore) {
                    bestScore = score;
                    bestMatch = oldJob;
                }
            }
        }

        if (bestMatch) {
            // Found a fuzzy match! This is the "Same Job" but URL changed.
            // We want to KEEP the Old Job's ID/Identity if possible, OR migrate data to New Job ID.
            // Since `writeJobsToNeon` uses `ON CONFLICT (job_id)`, and `job_id` is derived from URL/Content...
            // If we use `newJob.id` (from new URL), it will be a NEW row.
            // If we want to "replace" the old job, we should probably DELETE the old job and INSERT the new one
            // BUT with the old job's manually edited content.
            
            console.log(`[JobSync] Fuzzy match found! '${newJob.title}' (New) matches '${bestMatch.title}' (Old). Score: ${bestScore.toFixed(2)}`);

            // OPTIMIZATION: Reuse Old Job ID to preserve history (favorites, applications, etc.)
            // Instead of deleting old and inserting new, we update old with new URL and fresh fields.
            newJob.id = bestMatch.id;

            // Merge old data into new job (Preserve manual edits)
            if (bestMatch.is_manually_edited) {
                newJob.description = bestMatch.description; // Keep old description
                newJob.title = bestMatch.title;
                newJob.tags = bestMatch.tags;
                newJob.requirements = bestMatch.requirements;
                newJob.benefits = bestMatch.benefits;
                newJob.isManuallyEdited = true;
                newJob.isApproved = bestMatch.is_approved;
                newJob.translations = bestMatch.translations;
                newJob.isTranslated = bestMatch.is_translated;
                newJob.haigooComment = bestMatch.haigoo_comment;
                newJob.hiddenFields = bestMatch.hidden_fields;
            } else {
                // If not manually edited, we take the NEW description (as it might be a slight update)
                // But we treat it as the "same" job, so we keep the old ID.
            }

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
    const idsToDelete = Array.from(finalObsoleteIds);
    
    // Safety check: Filter out manually edited jobs that were NOT matched?
    // User: "otherwise represents this job is invalid and can be deleted".
    // So we delete them even if manually edited, because they are gone and no match found.
    
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
