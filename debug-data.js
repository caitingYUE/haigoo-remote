
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js');

async function run() {
    try {
        if (!neonHelper.isConfigured) {
            console.error('❌ Neon not configured');
            return;
        }

        console.log("=== EXPERIENCE LEVEL DIAGNOSTIC ===");
        // 1. Check distinct values and counts
        const levelStats = await neonHelper.query(`
            SELECT experience_level, COUNT(*) as count 
            FROM jobs 
            GROUP BY experience_level 
            ORDER BY count DESC
        `);
        console.table(levelStats);

        // 2. Check for potential whitespace/case issues
        const weirdLevels = await neonHelper.query(`
            SELECT job_id, experience_level 
            FROM jobs 
            WHERE experience_level IS NOT NULL 
            AND LOWER(experience_level) NOT IN ('entry', 'mid', 'senior', 'lead', 'executive')
            LIMIT 10
        `);
        if (weirdLevels.length > 0) {
            console.log("⚠️ Found non-standard levels:", weirdLevels);
        } else {
            console.log("✅ All levels match standard set (case-insensitive)");
        }

        console.log("\n=== LOCATION DIAGNOSTIC ===");
        // 1. Sample locations
        const locStats = await neonHelper.query(`
            SELECT location, COUNT(*) as count 
            FROM jobs 
            WHERE location IS NOT NULL
            GROUP BY location 
            ORDER BY count DESC 
            LIMIT 20
        `);
        console.table(locStats);

        // 2. Test "China" filter logic simulation
        // Using the regex logic I just implemented
        const chinaKeywords = ['china', '中国', 'cn', 'chinese', 'mainland china', 'prc', 'beijing', 'shanghai', 'shenzhen', 'guangzhou', 'hangzhou', 'chengdu', 'hong kong', 'hongkong', 'hk', '香港', 'taiwan', 'taipei', '台湾'];
        // Construct regex pattern: \y(k1|k2|...)\y
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = `\\y(${chinaKeywords.map(escapeRegex).join('|')})\\y`;
        
        console.log(`\nTesting Regex Pattern for China: ${pattern.substring(0, 50)}...`);
        
        const chinaJobs = await neonHelper.query(`
            SELECT count(*) as match_count 
            FROM jobs 
            WHERE location ~* $1
        `, [pattern]);
        console.log("Jobs matching 'China' filter:", chinaJobs[0].match_count);

        // 3. Test "USA" filter logic simulation
        const usaKeywords = ['usa', 'united states', 'america', 'san francisco', 'new york', 'california', 'texas', 'florida']; // partial list
        const usaPattern = `\\y(${usaKeywords.map(escapeRegex).join('|')})\\y`;
        const usaJobs = await neonHelper.query(`
            SELECT count(*) as match_count 
            FROM jobs 
            WHERE location ~* $1
        `, [usaPattern]);
        console.log("Jobs matching 'USA' filter:", usaJobs[0].match_count);

    } catch (e) {
        console.error("❌ Diagnostic failed:", e);
    }
}
run();
