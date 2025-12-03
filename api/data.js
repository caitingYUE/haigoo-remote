
import processedJobsHandler from '../lib/api-handlers/processed-jobs.js';
import rawRssHandler from '../lib/api-handlers/raw-rss.js';
import trustedCompaniesHandler from '../lib/api-handlers/trusted-companies.js';

export default async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    console.log('[API:Data] Request Path:', path);
    
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

    // Fallback: check resource query param
    const resource = url.searchParams.get('resource');
    if (resource && (resource === 'processed-jobs' || resource.startsWith('processed-jobs/'))) return await processedJobsHandler(req, res);
    if (resource && (resource === 'raw-rss' || resource.startsWith('raw-rss/'))) return await rawRssHandler(req, res);
    if (resource === 'companies' || resource === 'tags' || resource?.startsWith('trusted-companies')) return await trustedCompaniesHandler(req, res);

    return res.status(404).json({ error: 'Data resource not found' });
}
