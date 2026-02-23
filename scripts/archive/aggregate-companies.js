import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// import neonHelper from '../server-utils/dal/neon-helper.js';

async function aggregateCompanies() {
    console.log('Starting company aggregation from jobs...');
    console.log('Environment variables check:');
    Object.keys(process.env).forEach(key => {
        if (key.includes('DATABASE') || key.includes('URL')) {
            console.log(`${key}: ${process.env[key] ? 'Set' : 'Not Set'}`);
        }
    });
    console.log('Current directory:', process.cwd());

    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

    if (!neonHelper.isConfigured) {
        console.error('Neon database is not configured');
        process.exit(1);
    }

    try {
        // 1. Get all jobs
        console.log('Fetching jobs from database...');
        const jobs = await neonHelper.query('SELECT * FROM jobs ORDER BY created_at DESC');
        console.log(`Found ${jobs.length} jobs`);

        if (jobs.length === 0) {
            console.log('No jobs found, nothing to aggregate');
            return;
        }

        // 2. Extract companies from jobs
        const companyMap = new Map();

        for (const job of jobs) {
            const companyName = job.company;
            if (!companyName) continue;

            const key = companyName.toLowerCase().trim();

            if (companyMap.has(key)) {
                const existing = companyMap.get(key);
                existing.jobCount++;
            } else {
                companyMap.set(key, {
                    id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    name: companyName,
                    url: job.company_website || '',
                    description: job.company_description || '',
                    logo: job.company_logo || '',
                    coverImage: '',
                    industry: job.industry || '其他',
                    tags: job.company_tags || [],
                    source: job.source || 'rss',
                    jobCount: 1,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            }
        }

        const companies = Array.from(companyMap.values());
        console.log(`Extracted ${companies.length} unique companies`);

        // 3. Save to extracted_companies table
        await neonHelper.transaction(async (client) => {
            // Clear existing
            await client.query('DELETE FROM extracted_companies');
            console.log('Cleared existing extracted_companies');

            // Insert new
            for (const company of companies) {
                await client.query(`
                    INSERT INTO extracted_companies 
                    (company_id, name, url, description, logo, cover_image, industry, tags, source, job_count, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [
                    company.id,
                    company.name,
                    company.url,
                    company.description,
                    company.logo,
                    company.coverImage,
                    company.industry,
                    JSON.stringify(company.tags),
                    company.source,
                    company.jobCount,
                    company.createdAt,
                    company.updatedAt
                ]);
            }
        });

        console.log(`✅ Successfully aggregated ${companies.length} companies`);
        console.log('Top 10 companies by job count:');
        companies
            .sort((a, b) => b.jobCount - a.jobCount)
            .slice(0, 10)
            .forEach(c => console.log(`  - ${c.name}: ${c.jobCount} jobs`));

    } catch (error) {
        console.error('Aggregation failed:', error);
        process.exit(1);
    }
}

aggregateCompanies();
