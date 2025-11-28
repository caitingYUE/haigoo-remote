import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

export default async function handler(req, res) {
    // 只允许 GET 请求
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // 添加协议头如果缺失
        let targetUrl = url;
        if (!targetUrl.startsWith('http')) {
            targetUrl = `https://${targetUrl}`;
        }

        console.log(`Crawling company info from: ${targetUrl}`);

        const response = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 10000 // 10秒超时
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // 提取 Logo
        let logo = $('meta[property="og:image"]').attr('content') ||
            $('meta[name="twitter:image"]').attr('content') ||
            $('link[rel="icon"]').attr('href') ||
            $('link[rel="shortcut icon"]').attr('href');

        // 处理相对路径的 Logo
        if (logo && !logo.startsWith('http')) {
            const baseUrl = new URL(targetUrl);
            if (logo.startsWith('//')) {
                logo = `https:${logo}`;
            } else if (logo.startsWith('/')) {
                logo = `${baseUrl.origin}${logo}`;
            } else {
                logo = `${baseUrl.origin}/${logo}`;
            }
        }

        // 提取描述
        const description = $('meta[property="og:description"]').attr('content') ||
            $('meta[name="description"]').attr('content') ||
            $('meta[name="twitter:description"]').attr('content') ||
            '';

        // 提取标题
        const title = $('meta[property="og:title"]').attr('content') ||
            $('title').text() ||
            '';

        return res.status(200).json({
            url: targetUrl,
            logo,
            description: description?.trim(),
            title: title?.trim()
        });

    } catch (error) {
        console.error('Crawler error:', error);
        return res.status(500).json({
            error: 'Failed to crawl company info',
            details: error.message
        });
    }
}
