
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { writeJobsToNeon } from '../api-handlers/processed-jobs.js';
import { generateDedupKey } from '../utils/job-utils.js';

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
        if (!j.publishedAt) return true; // Keep if no date
        const d = new Date(j.publishedAt);
        if (isNaN(d.getTime())) return true; // Keep if invalid date
        return d >= cutoff;
    });

    if (crawledJobs.length > validCrawledJobs.length) {
        console.log(`[JobSync] Date Filter: ${crawledJobs.length} -> ${validCrawledJobs.length} jobs (Limit: ${RETAIN_DAYS} days). Filtered out ${crawledJobs.length - validCrawledJobs.length} old jobs.`);
    }

    // 1. Fetch existing jobs
    // We fetch ALL jobs for this company, including manual entries
    const existingJobs = await neonHelper.query(`
        SELECT 
            job_id as id, title, url, description, 
            is_manually_edited, is_approved, is_featured,
            tags, translations, is_translated, translated_at,
            requirements, benefits, haigoo_comment, hidden_fields,
            risk_rating, can_refer, source_type, company_id,
            location, timezone, published_at, salary, job_type, experience_level, category, region
        FROM jobs 
        WHERE (company_id = $1 OR (company = $2 AND company_id IS NULL))
    `, [companyId, companyName]);

    const existingMap = new Map();
    existingJobs.forEach(j => existingMap.set(j.url.toLowerCase(), j)); // Map by URL for direct match
    // Also map by ID if URL check fails but ID matches (rare if ID is derived from URL)
    const existingIdMap = new Map();
    existingJobs.forEach(j => existingIdMap.set(j.id, j));

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
            // If similarity > 80%, we preserve old content to save resources and manual edits
            const similarity = calculateSimilarity(cJob.description, directMatch.description);
            const isHighlySimilar = similarity > 0.8;

            // Merge logic for Direct Match
            // ALWAYS PRESERVE Administrative Flags for Direct Matches
            cJob.isFeatured = directMatch.is_featured;
            cJob.riskRating = directMatch.risk_rating;
            cJob.haigooComment = directMatch.haigoo_comment;
            cJob.hiddenFields = directMatch.hidden_fields;
            // Preserve approval status unless it's a new crawl that needs re-approval? 
            // Usually we keep approval if it's the same job URL.
            cJob.isApproved = directMatch.is_approved; 
            
            // Preserve canRefer if it was true in DB (assume manual override or stable source)
            if (directMatch.can_refer) cJob.canRefer = true;

            // Conditional Preservation for Content Fields
            // If manually edited OR highly similar, preserve content to avoid overwriting human work
            if (directMatch.is_manually_edited || isHighlySimilar) {
                // Keep existing fields
                cJob.description = directMatch.description; 
                cJob.title = directMatch.title;
                cJob.tags = directMatch.tags;
                cJob.requirements = directMatch.requirements;
                cJob.benefits = directMatch.benefits;
                cJob.isManuallyEdited = directMatch.is_manually_edited;
                // cJob.isApproved = directMatch.is_approved; // Moved up
                cJob.translations = directMatch.translations;
                cJob.isTranslated = directMatch.is_translated;
                // cJob.haigooComment = directMatch.haigoo_comment; // Moved up
                // cJob.hiddenFields = directMatch.hidden_fields; // Moved up

                // 2026-01-18: Preserve fields that might have been manually corrected
                cJob.location = directMatch.location;
                cJob.timezone = directMatch.timezone;
                cJob.publishedAt = directMatch.published_at;
                cJob.salary = directMatch.salary;
                cJob.jobType = directMatch.job_type;
                cJob.experienceLevel = directMatch.experience_level;
                cJob.category = directMatch.category;
                cJob.region = directMatch.region;
                
                if (isHighlySimilar && !directMatch.is_manually_edited) {
                    console.log(`[JobSync] Direct Match highly similar (${similarity.toFixed(2)}). Preserving existing data for ${cJob.id}`);
                }
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
            // Instead of deleting old and inserting new, we update old with new URL and fresh fields.
            newJob.id = bestMatch.id;

            // Merge old data into new job (Preserve manual edits AND highly similar content)
            // Since we established similarity > 0.8 (or it's manual), we preserve the old content 
            // to avoid resource consumption and losing manual edits (User Rule).
            
            newJob.description = bestMatch.description; // Keep old description
            newJob.title = bestMatch.title;
            newJob.tags = bestMatch.tags;
            newJob.requirements = bestMatch.requirements;
            newJob.benefits = bestMatch.benefits;
            newJob.isManuallyEdited = bestMatch.is_manually_edited;
            newJob.isApproved = bestMatch.is_approved;
            newJob.translations = bestMatch.translations;
            newJob.isTranslated = bestMatch.is_translated;
            newJob.haigooComment = bestMatch.haigoo_comment;
            newJob.hiddenFields = bestMatch.hidden_fields;
            // Preserve manually set flags
            newJob.isFeatured = bestMatch.is_featured;
            newJob.riskRating = bestMatch.risk_rating;
            if (bestMatch.can_refer) newJob.canRefer = true;

            // 2026-01-18: Preserve fields that might have been manually corrected
            newJob.location = bestMatch.location;
            newJob.timezone = bestMatch.timezone;
            newJob.publishedAt = bestMatch.published_at;
            newJob.salary = bestMatch.salary;
            newJob.jobType = bestMatch.job_type;
            newJob.experienceLevel = bestMatch.experience_level;
            newJob.category = bestMatch.category;
            newJob.region = bestMatch.region;

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
        if (job && (job.source_type === 'manual' || job.is_manually_edited || job.is_featured)) {
            console.log(`[JobSync] Protected job '${job.title}' (Manual/Featured) not found in crawl. Marking as Pending.`);
            // Update status to Pending (is_approved = false)
            // We need to upsert this change
            const updatedManualJob = { ...job };
            // Ensure camelCase for writeJobsToNeon
            // Map back from DB columns if needed, but existingIdMap has raw DB rows? 
            // Wait, existingIdMap has DB rows. writeJobsToNeon expects Job object (camelCase).
            // We need to map it.
            
            // Map DB row to Job object (simplified mapping for update)
            const mappedJob = {
                id: job.id,
                title: job.title,
                company: companyName,
                companyId: companyId,
                location: job.location,
                description: job.description,
                url: job.url,
                publishedAt: job.published_at,
                // ... other fields
                sourceType: job.source_type,
                isManuallyEdited: true,
                isApproved: false, // MARK AS PENDING
                status: 'active' // Keep active
            };
            
            // Preserve other fields
            // Since writeJobsToNeon uses upsert, we should try to preserve all fields.
            // A better way is to rely on ON CONFLICT UPDATE in writeJobsToNeon, 
            // but we need to pass all fields to avoid overwriting with nulls if we missed some.
            // Actually, writeJobsToNeon takes a full object. 
            // Let's use the DB row and convert keys.
            
            mappedJob.tags = job.tags;
            mappedJob.requirements = job.requirements;
            mappedJob.benefits = job.benefits;
            mappedJob.translations = job.translations;
            mappedJob.isTranslated = job.is_translated;
            mappedJob.translatedAt = job.translated_at;
            mappedJob.canRefer = job.can_refer;
            mappedJob.isFeatured = job.is_featured;
            mappedJob.riskRating = job.risk_rating;
            mappedJob.haigooComment = job.haigoo_comment;
            mappedJob.hiddenFields = job.hidden_fields;
            mappedJob.salary = job.salary;
            mappedJob.jobType = job.job_type;
            mappedJob.experienceLevel = job.experience_level;
            mappedJob.category = job.category;
            mappedJob.region = job.region;
            mappedJob.timezone = job.timezone;
            
            toUpsert.push(mappedJob);
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
