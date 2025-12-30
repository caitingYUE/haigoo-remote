import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Dynamic imports to ensure env is loaded first
const neonHelper = (await import('../server-utils/dal/neon-helper.js')).default;
const { analyzeJobContent } = await import('../lib/bailian-parser.js');
const { sendEmail } = await import('../server-utils/email-service.js');

// Replicate helpers from processed-jobs.js (simplified)
const JOBS_TABLE = 'jobs';

// Location Keywords for Region Classification
const OVERSEAS_KEYWORDS = ['usa', 'united states', 'uk', 'london', 'europe', 'germany', 'france', 'japan', 'singapore', 'australia', 'canada'];
const MAINLAND_KEYWORDS = ['china', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chengdu'];
const APAC_KEYWORDS = ['apac', 'asia pacific', 'utc+8', 'gmt+8'];

function classifyRegion(location) {
    const loc = (location || '').toLowerCase().trim();
    if (!loc) return 'both';
    
    if (MAINLAND_KEYWORDS.some(k => loc.includes(k))) return 'domestic';
    if (APAC_KEYWORDS.some(k => loc.includes(k))) return 'both';
    if (OVERSEAS_KEYWORDS.some(k => loc.includes(k))) return 'overseas';
    if (loc.includes('remote')) return 'both'; // Default remote to both
    
    return 'overseas'; // Default fallback
}

function truncateString(str, maxBytes) {
    if (!str) return '';
    return str.length > maxBytes ? str.substring(0, maxBytes) : str;
}

// Main Function
async function main() {
    console.log('🚀 Starting AI Job Reprocessing Script...');
    
    if (!neonHelper.isConfigured) {
        console.error('❌ Neon DB not configured');
        process.exit(1);
    }

    try {
        // 1. Fetch Candidates
        // Select active jobs that have bad data
        const query = `
            SELECT * FROM ${JOBS_TABLE} 
            WHERE status = 'active' 
            AND (is_manually_edited IS NOT TRUE)
            AND (
                location IS NULL OR location = 'Remote' OR location = 'Unspecified' 
                OR salary IS NULL OR salary = 'null' OR salary = 'Open'
                OR category = '其他' OR category = 'Other'
                OR source_type IS NULL
            )
            AND description IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 1000
        `;
        
        console.log('Fetching candidates...');
        const jobs = await neonHelper.query(query);
        console.log(`Found ${jobs.length} candidates.`);

        if (jobs.length === 0) {
            console.log('No jobs need processing.');
            process.exit(0);
        }

        let processedCount = 0;
        let updatedCount = 0;
        let aiSuccessCount = 0;
        let aiFailCount = 0;
        const failedJobs = [];

        // 2. Process in Chunks
        const chunkSize = 5;
        for (let i = 0; i < jobs.length; i += chunkSize) {
            const chunk = jobs.slice(i, i + chunkSize);
            console.log(`Processing chunk ${i/chunkSize + 1}/${Math.ceil(jobs.length/chunkSize)}...`);
            
            await Promise.all(chunk.map(async (row) => {
                // Map DB row to Job object (simplified)
                const job = {
                    id: row.job_id,
                    title: row.title,
                    description: row.description,
                    location: row.location,
                    salary: row.salary,
                    category: row.category,
                    tags: row.tags ? (typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags) : [],
                    source_type: row.source_type,
                    can_refer: row.can_refer,
                    is_trusted: row.is_trusted,
                    region: row.region
                };

                let changed = false;
                let aiFailed = false;

                try {
                    // AI Processing
                    const cleanDesc = (job.description || '').replace(/<[^>]*>?/gm, '\n').replace(/\s+/g, ' ').trim();
                    const jobForAI = { ...job, description: cleanDesc };
                    
                    const aiResult = await analyzeJobContent(jobForAI);
                    
                    if (aiResult) {
                        // Update Fields
                        if (aiResult.location && aiResult.location !== 'Unspecified') {
                            job.location = truncateString(aiResult.location, 200);
                            job.region = classifyRegion(job.location);
                            changed = true;
                        }
                        
                        if (aiResult.salary) {
                            job.salary = truncateString(aiResult.salary, 200);
                            changed = true;
                        }

                        if (aiResult.category && aiResult.category !== '其他') {
                            job.category = truncateString(aiResult.category, 100);
                            changed = true;
                        }

                        if (aiResult.tags && Array.isArray(aiResult.tags) && aiResult.tags.length > 0) {
                            const newTags = aiResult.tags.map(t => truncateString(t, 50));
                            job.tags = [...new Set([...job.tags, ...newTags])].slice(0, 20);
                            changed = true;
                        }

                        aiSuccessCount++;
                    } else {
                        aiFailed = true;
                    }
                } catch (e) {
                    console.error(`AI failed for job ${job.id}:`, e.message);
                    aiFailed = true;
                    failedJobs.push({ id: job.id, title: job.title, error: e.message });
                }

                if (aiFailed) {
                    aiFailCount++;
                    // Fallback Logic (Simplified regex)
                    // ... (Skip complex regex here for brevity, assume API handles it better or AI will succeed eventually)
                }

                // Source Type Fallback
                if (!job.source_type) {
                    if (job.can_refer) job.source_type = 'club-referral';
                    else if (job.is_trusted) job.source_type = 'official';
                    else job.source_type = 'rss';
                    changed = true;
                }

                if (changed) {
                    // Update DB
                    await neonHelper.query(`
                        UPDATE ${JOBS_TABLE} SET
                            location = $1,
                            region = $2,
                            salary = $3,
                            category = $4,
                            tags = $5,
                            source_type = $6,
                            updated_at = NOW()
                        WHERE job_id = $7
                    `, [
                        job.location,
                        job.region,
                        job.salary,
                        job.category,
                        JSON.stringify(job.tags),
                        job.source_type,
                        job.id
                    ]);
                    updatedCount++;
                }
                
                processedCount++;
            }));
            
            // Rate limit pause
            await new Promise(r => setTimeout(r, 1000));
        }

        console.log('-----------------------------------');
        console.log(`✅ Processed: ${processedCount}`);
        console.log(`🔄 Updated: ${updatedCount}`);
        console.log(`🤖 AI Success: ${aiSuccessCount}`);
        console.log(`⚠️ AI Fail: ${aiFailCount}`);

        // Notification
        if (failedJobs.length > 0) {
            console.log(`Sending notification for ${failedJobs.length} failures...`);
            const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'caitlinyct@gmail.com';
            const subject = `[Script Alert] AI Job Processing Failed for ${failedJobs.length} jobs`;
            const content = `
                <h3>AI Processing Script Report</h3>
                <p>Total Processed: ${processedCount}</p>
                <p>AI Success: ${aiSuccessCount}</p>
                <p>AI Failed: ${aiFailCount}</p>
            `;
            await sendEmail(adminEmail, subject, content);
        }

    } catch (e) {
        console.error('Script Error:', e);
    }
}

main();
