
import processedJobsHandler from '../lib/api-handlers/processed-jobs.js';
import rawRssHandler from '../lib/api-handlers/raw-rss.js';
import trustedCompaniesHandler from '../lib/api-handlers/trusted-companies.js';
import publicMembersHandler from '../lib/api-handlers/public-members.js';
import statsHandler from '../lib/api-handlers/stats.js';

export default async function handler(req, res) {
    // ⚠️ Deprecated: This handler is being phased out.
    // New endpoints:
    // - /api/admin/jobs (Processed Jobs)
    // - /api/admin/companies (Trusted Companies & Tags)
    // - /api/admin/raw-rss (Raw RSS - TODO)
    // - /api/admin/stats (Stats - TODO)

    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    console.log('[API:Data] Request Path (Legacy):', path);
    
    // Dispatch based on path or query
    // /api/data/processed-jobs
    if (path.includes('processed-jobs')) {
        return await processedJobsHandler(req, res);
    }
    
    // /api/data/raw-rss
    if (path.includes('raw-rss')) {
        return await rawRssHandler(req, res);
    }
    
    // /api/data/trusted-companies
    if (path.includes('trusted-companies')) {
        return await trustedCompaniesHandler(req, res);
    }

    // /api/data/public-members
    if (path.includes('public-members')) {
        return await publicMembersHandler(req, res);
    }

    // /api/data/stats
    if (path.includes('stats')) {
        return await statsHandler(req, res);
    }

    // Fallback: check resource query param
    const resource = url.searchParams.get('resource');
    if (resource && (resource === 'processed-jobs' || resource.startsWith('processed-jobs/'))) return await processedJobsHandler(req, res);
    if (resource && (resource === 'raw-rss' || resource.startsWith('raw-rss/'))) return await rawRssHandler(req, res);
    if (resource === 'companies' || resource === 'tags' || resource?.startsWith('trusted-companies')) return await trustedCompaniesHandler(req, res);
    if (resource === 'stats') return await statsHandler(req, res);

    return res.status(404).json({ error: 'Data resource not found (Legacy API)' });
}
