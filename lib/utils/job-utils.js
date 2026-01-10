
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Generate deduplication key for job
// Used by: processed-jobs.js, raw-rss.js, job-sync-service.js
export function generateDedupKey(job) {
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
