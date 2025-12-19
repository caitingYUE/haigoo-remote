import rssProxyHandler from '../lib/api-handlers/rss-proxy-handler.js';
import imageProxyHandler from '../lib/api-handlers/image-proxy-handler.js';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { type } = req.query;

    if (type === 'rss') {
        return rssProxyHandler(req, res);
    }

    if (type === 'image') {
        return imageProxyHandler(req, res);
    }

    // Default Fallback (Legacy support if needed, or error)
    // If no type, check URL for clues or return error
    const url = req.query.url;
    if (url && (url.endsWith('.rss') || url.includes('feed'))) {
        return rssProxyHandler(req, res);
    }

    // Legacy support for plain /api/images calls which might not have type=image but have action param
    if (req.query.action === 'process' || req.method === 'POST') {
        // Assume image processing if it's a POST and not clearly RSS
        return imageProxyHandler(req, res);
    }

    return res.status(400).json({
        error: 'Invalid proxy type',
        message: 'Please specify ?type=rss or ?type=image'
    });
}
