
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

        console.log("=== LEVEL FILTER SYNTAX TEST ===");
        // Simulate the exact query logic used in processed-jobs.js
        const levels = ['Senior', 'Entry'];
        const lowerLevels = levels.map(l => l.toLowerCase());
        
        const query = `
            SELECT experience_level, count(*) 
            FROM jobs 
            WHERE LOWER(experience_level) = ANY($1) 
            GROUP BY experience_level
        `;
        
        console.log(`Executing: ${query} with param:`, lowerLevels);
        const results = await neonHelper.query(query, [lowerLevels]);
        console.table(results);
        
        if (results.length > 0) {
            console.log("✅ Level filter query works correctly");
        } else {
            console.log("❌ Level filter query returned 0 results (unexpected)");
        }

        console.log("\n=== CHINESE REGEX TEST ===");
        // Test \y with Chinese
        const testStr = "中国北京";
        // Postgres regex test
        const regexQuery = `SELECT 'Match' as result WHERE $1 ~* $2`;
        const patternWithBoundary = `\\y中国\\y`;
        const patternWithoutBoundary = `中国`;
        
        const r1 = await neonHelper.query(regexQuery, [testStr, patternWithBoundary]);
        console.log(`'${testStr}' matches '\\y中国\\y':`, r1.length > 0);
        
        const r2 = await neonHelper.query(regexQuery, [testStr, patternWithoutBoundary]);
        console.log(`'${testStr}' matches '中国':`, r2.length > 0);

    } catch (e) {
        console.error("❌ Test failed:", e);
    }
}
run();
