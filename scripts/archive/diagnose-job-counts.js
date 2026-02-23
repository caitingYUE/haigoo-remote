
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
// Try .env.local first (as per local-server.js)
const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env.local') });
// Also try .env as fallback
dotenv.config({ path: path.join(rootDir, '.env') });

async function diagnose() {
    console.log('Connecting to DB...');
    
    // Dynamic import to ensure env vars are loaded first
    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

    if (!neonHelper.isConfigured) {
        console.error('[Error] Database URL is not configured!');
        console.error('Checked paths:', path.join(rootDir, '.env.local'), path.join(rootDir, '.env'));
        console.error('Env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE_URL')));
        process.exit(1);
    }

    // 1. Total Active Jobs
    const total = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active'");
    console.log('Total Active Jobs:', total[0].count);

    // 2. Approved Status
    const approved = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND is_approved = true");
    const pending = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND is_approved IS NULL");
    const rejected = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND is_approved = false");
    
    console.log('Approved:', approved[0].count);
    console.log('Pending (NULL):', pending[0].count);
    console.log('Rejected (FALSE):', rejected[0].count);

    // 3. Region Distribution
    const domestic = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND region IN ('domestic', 'both')");
    const global = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND region = 'global'");
    const overseas = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND region = 'overseas'");
    const unclassified = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE status = 'active' AND region NOT IN ('domestic', 'both', 'global', 'overseas')");

    console.log('Region Domestic/Both:', domestic[0].count);
    console.log('Region Global:', global[0].count);
    console.log('Region Overseas:', overseas[0].count);
    console.log('Region Unclassified:', unclassified[0].count);

    // 4. Combined Filter (Domestic + Global + Approved/Pending)
    // This simulates the Public Default View
    const publicView = await neonHelper.query(`
        SELECT COUNT(*) FROM jobs 
        WHERE status = 'active' 
        AND (is_approved IS NOT FALSE)
        AND region IN ('domestic', 'both', 'global')
    `);
    console.log('Public View (Domestic+Global & Not Rejected):', publicView[0].count);

    process.exit(0);
}

diagnose();
