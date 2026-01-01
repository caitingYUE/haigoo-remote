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
        // 1. Fetch Candidates (IDs only to ensure finite loop)
        console.log('Fetching candidate IDs...');
        const idQuery = `
            SELECT job_id FROM ${JOBS_TABLE} 
            WHERE status = 'active' 
            AND (is_manually_edited IS NOT TRUE)
            AND (
                location IS NULL OR location = 'Remote' OR location = 'Unspecified' 
                OR salary IS NULL OR salary = 'null' OR salary = 'Open' OR salary = 'Competitive' OR salary = '薪资面议'
                OR category = '其他' OR category = 'Other'
                OR source_type IS NULL
            )
            AND description IS NOT NULL
            ORDER BY created_at DESC
        `;
        
        const idResult = await neonHelper.query(idQuery);
        const allJobIds = idResult.map(r => r.job_id);
        console.log(`Found ${allJobIds.length} candidates to process.`);

        if (allJobIds.length === 0) {
            console.log('No jobs need processing.');
            process.exit(0);
        }

        let processedCount = 0;
        let updatedCount = 0;
        let aiSuccessCount = 0;
        let aiFailCount = 0;
        const failedJobs = [];

        // 2. Process in Chunks
        const chunkSize = 3; // Reduce chunk size to avoid timeouts
        for (let i = 0; i < allJobIds.length; i += chunkSize) {
            const chunkIds = allJobIds.slice(i, i + chunkSize);
            console.log(`Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(allJobIds.length/chunkSize)}...`);
            
            try {
                // Fetch full data for this chunk
                const placeholders = chunkIds.map((_, idx) => `$${idx + 1}`).join(',');
                const jobs = await neonHelper.query(`SELECT * FROM ${JOBS_TABLE} WHERE job_id IN (${placeholders})`, chunkIds);

                for (const row of jobs) {
                    try {
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
                    region: row.region,
                    timezone: row.timezone,
                    china_friendly: row.china_friendly
                };

                let changed = false;
                let aiFailed = false;

                try {
                    // AI Processing
                    const cleanDesc = (job.description || '').replace(/<[^>]*>?/gm, '\n').replace(/\s+/g, ' ').trim();
                    const jobForAI = { ...job, description: cleanDesc };
                    
                    const aiResult = await analyzeJobContent(jobForAI);
                    
                    if (aiResult) {
                        // Update Token Usage
                        if (aiResult.usage) {
                            await systemSettingsService.incrementTokenUsage(aiResult.usage, 'job_processing');
                        }

                        // Update Fields
                        if (aiResult.location && aiResult.location !== 'Unspecified') {
                            job.location = truncateString(aiResult.location, 200);
                            job.region = classifyRegion(job.location);
                            changed = true;
                        }

                        // Timezone & China Friendly Update
                        if (aiResult.timezone) {
                            job.timezone = truncateString(aiResult.timezone, 200);
                            changed = true;
                        }
                        
                        if (typeof aiResult.chinaFriendly === 'boolean') {
                            job.china_friendly = aiResult.chinaFriendly;
                            changed = true;
                            // If china friendly, force region to include domestic/both if not already
                            if (job.china_friendly && job.region === 'overseas') {
                                job.region = 'both';
                            }
                        }
                        
                        if (aiResult.salary) {
                            let s = aiResult.salary.trim();
                            // Filter out 0 values
                            if (s === '0' || s === '0k' || s === '$0' || s.match(/^0\s*-\s*0$/)) {
                                s = 'Open';
                            }
                            job.salary = truncateString(s, 200);
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
                    // Fallback Logic
                    const cleanDesc = (job.description || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
                    const combinedText = `${job.title} ${cleanDesc}`;
                    
                    const extractedSalary = extractSalary(combinedText);
                    if (extractedSalary && (!job.salary || job.salary === 'null' || job.salary === 'Open')) {
                        job.salary = truncateString(extractedSalary, 200);
                        changed = true;
                        console.log(`[Fallback] Extracted salary for ${job.id}: ${job.salary}`);
                    }

                    const extractedLocation = extractLocation(combinedText);
                    if (extractedLocation && (!job.location || job.location === 'Unspecified' || job.location === 'Remote')) {
                        job.location = truncateString(extractedLocation, 200);
                        job.region = classifyRegion(job.location);
                        changed = true;
                        console.log(`[Fallback] Extracted location for ${job.id}: ${job.location}`);
                    }
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
                            timezone = $7,
                            china_friendly = $8,
                            updated_at = NOW()
                        WHERE job_id = $9
                    `, [
                        job.location,
                        job.region,
                        job.salary,
                        job.category,
                        JSON.stringify(job.tags),
                        job.source_type,
                        job.timezone,
                        job.china_friendly,
                        job.id
                    ]);
                    updatedCount++;
                }
                
                processedCount++;
                // Add delay per job to be nice to API
                await new Promise(r => setTimeout(r, 500));
            } catch (e) {
                console.error(`Error processing job ${row.job_id}:`, e);
            }
        } // End for loop
        
        // Rate limit pause between chunks
        await new Promise(r => setTimeout(r, 2000));

    } catch (e) {
        console.error(`Error processing chunk:`, e);
    }
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
    }
}

main();
