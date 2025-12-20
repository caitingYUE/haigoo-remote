import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Helper to normalize names for comparison
const normalizeName = (name) => {
    if (!name) return '';
    let norm = name.toLowerCase();
    const suffixes = [
        ' corporation', ' incorporated', ' limited', ' company', ' group', ' holdings', ' technologies', ' technology', ' solutions', ' systems', ' services', ' labs', ' software', ' interactive', ' entertainment', ' studios', ' networks', ' media',
        ' corp', ' inc', ' ltd', ' llc', ' co', ' gmbh', ' s.a.', ' s.a.r.l.', ' b.v.', ' plc'
    ];
    for (const suffix of suffixes) {
        if (norm.endsWith(suffix) || norm.endsWith(suffix + '.')) {
            norm = norm.substring(0, norm.lastIndexOf(suffix));
        }
    }
    return norm.replace(/[^a-z0-9]/g, '');
};

async function relinkCompanies() {
    console.log('🔄 Starting company relinking process...');
    
    // Dynamic import to ensure env is loaded first
    const neonHelper = (await import('../server-utils/dal/neon-helper.js')).default;
    
    if (!neonHelper.isConfigured) {
        console.error('❌ Neon database not configured');
        // process.exit(1); // Don't exit, just return to allow debugging
        return;
    }

    try {
        // 1. Fetch all trusted companies
        console.log('📥 Fetching trusted companies...');
        const companies = await neonHelper.query(`
            SELECT company_id, name, website 
            FROM trusted_companies 
            ORDER BY name
        `);
        console.log(`   Found ${companies.length} trusted companies`);

        let totalUpdated = 0;

        // 2. Process each company
        for (const company of companies) {
            // const aliases = company.aliases || [];
            // const searchTerms = [company.name, ...aliases];
            
            // Simplified: Only use company name
            const searchTerms = [company.name];
            
            // Build normalization matchers
            // const normalizedTerms = searchTerms.map(t => normalizeName(t)).filter(Boolean);
            
            // Construct SQL for matching
            // We'll use a direct SQL update for efficiency and accuracy based on normalized names
            
            let matchCount = 0;
            
            for (const alias of searchTerms) {
                // Skip short aliases to avoid false positives
                if (alias.length < 3) continue;
                
                const result = await neonHelper.query(`
                    WITH updated AS (
                        UPDATE jobs
                        SET company_id = $1, is_trusted = true
                        WHERE 
                            (company_id IS NULL OR is_trusted IS NOT true)
                            AND (
                                -- Exact case-insensitive match
                                company ILIKE $2
                                -- OR Normalized match (remove spaces/special chars)
                                OR LOWER(REGEXP_REPLACE(company, '[^a-zA-Z0-9]', '', 'g')) = LOWER(REGEXP_REPLACE($2, '[^a-zA-Z0-9]', '', 'g'))
                            )
                        RETURNING id
                    )
                    SELECT COUNT(*) FROM updated;
                `, [company.company_id, alias]);
                
                matchCount += parseInt(result[0].count);
            }
            
            if (matchCount > 0) {
                console.log(`   ✅ Linked ${matchCount} jobs to ${company.name}`);
                totalUpdated += matchCount;
            }

            // 3. Update job_count for this company (Live Count)
            const countResult = await neonHelper.query(`
                SELECT COUNT(*) FROM jobs WHERE company_id = $1
            `, [company.company_id]);
            
            const realCount = parseInt(countResult[0].count);
            
            await neonHelper.query(`
                UPDATE trusted_companies SET job_count = $1, last_crawled_at = NOW() WHERE company_id = $2
            `, [realCount, company.company_id]);
            
            if (realCount > 0) {
                console.log(`      Current real count: ${realCount}`);
            }
        }

        console.log(`\n🎉 Relinking complete! Total jobs updated: ${totalUpdated}`);

    } catch (error) {
        console.error('❌ Relinking failed:', error);
    }
}

relinkCompanies();
