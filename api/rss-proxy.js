// Simple in-memory rate limiter (per IP, per URL)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per URL

function checkRateLimit(ip, url) {
  const key = `${ip}:${url}`;
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    // Cleanup old entries periodically
    if (rateLimitStore.size > 1000) {
      for (const [k, v] of rateLimitStore.entries()) {
        if (v.resetAt < now) rateLimitStore.delete(k);
      }
    }
    return true;
  }
  
  if (record.resetAt < now) {
    record.count = 1;
    record.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }
  
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  record.count++;
  return true;
}

// Inject missing XML namespaces (same logic as frontend)
function injectMissingNamespaces(xml) {
  try {
    const knownNs = {
      content: 'http://purl.org/rss/1.0/modules/content/',
      media: 'http://search.yahoo.com/mrss/',
      atom: 'http://www.w3.org/2005/Atom',
      dc: 'http://purl.org/dc/elements/1.1/',
      wfw: 'http://wellformedweb.org/CommentAPI/',
      slash: 'http://purl.org/rss/1.0/modules/slash/',
      sy: 'http://purl.org/rss/1.0/modules/syndication/',
      himalayasJobs: 'https://himalayas.app/jobs/rss/namespace'
    };

    // Find all namespace prefixes used
    const prefixMatches = Array.from(xml.matchAll(/<\/?([a-zA-Z_][\w\-.]*)\:/g)).map(m => m[1]);
    const uniquePrefixes = Array.from(new Set(prefixMatches));

    if (uniquePrefixes.length === 0) return xml;

    // Locate root tag (rss or feed)
    const rootTagMatch = xml.match(/<\s*(rss|feed)([^>]*)>/i);
    if (!rootTagMatch) return xml;

    const rootTag = rootTagMatch[0];
    const rootName = rootTagMatch[1];
    let rootAttrs = rootTagMatch[2] || '';

    // Add xmlns declarations for missing prefixes
    for (const prefix of uniquePrefixes) {
      const xmlnsPattern = new RegExp(`xmlns:${prefix}\\s*=`, 'i');
      if (!xmlnsPattern.test(rootAttrs)) {
        const nsUri = knownNs[prefix] || `https://schemas.example.com/${prefix}`;
        rootAttrs += ` xmlns:${prefix}="${nsUri}"`;
      }
    }

    // Rebuild root tag
    const newRootTag = `<${rootName}${rootAttrs}>`;
    return xml.replace(rootTag, newRootTag);
  } catch {
    return xml; // Safe fallback
  }
}

// Clean and preprocess XML
function cleanXmlData(xmlData) {
  let cleaned = xmlData;
  
  // Remove BOM
  cleaned = cleaned.replace(/^\uFEFF/, '');
  
  // Ensure newline after XML declaration
  cleaned = cleaned.replace(/(<\?xml[^>]*\?>)(\s*<)/, '$1\n$2');
  
  // Fix missing newlines between tags
  cleaned = cleaned.replace(/(<\/[^>]+>)(<[^\/][^>]*>)/g, '$1\n$2');
  
  // Fix missing newlines between items
  cleaned = cleaned.replace(/(<\/item>)(\s*)(<item>)/g, '$1\n$3');
  
  // Inject missing namespaces
  cleaned = injectMissingNamespaces(cleaned);
  
  return cleaned;
}

// Vercel Serverless Function for RSS proxy
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  // URL验证
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Rate limiting
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                   req.headers['x-real-ip'] || 
                   req.socket?.remoteAddress || 
                   'unknown';
  if (!checkRateLimit(clientIp, url)) {
    console.warn(`[rss-proxy] Rate limit exceeded for ${clientIp} on ${url}`);
    return res.status(429).json({ 
      error: 'Rate limit exceeded', 
      message: 'Too many requests. Please try again later.',
      retryAfter: 60
    });
  }

  try {
    // 用户代理轮换
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (compatible; RSS-Reader/1.0; +http://example.com/bot)'
    ];

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    console.log(`[rss-proxy] Fetching: ${url}`);
    
    // 创建AbortController用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20秒超时

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': new URL(url).origin
      },
      signal: controller.signal,
      redirect: 'follow',
      compress: true
    });

    clearTimeout(timeoutId);

    console.log(`RSS proxy response status: ${response.status} for ${url}`);

    if (!response.ok) {
      // 特殊处理某些错误状态码
      if (response.status === 403) {
        console.warn(`Access forbidden for ${url}, trying with different headers`);
        return res.status(403).json({ 
          error: 'Access forbidden', 
          message: 'The RSS source blocked the request',
          status: response.status 
        });
      }
      
      if (response.status === 429) {
        console.warn(`Rate limited for ${url}`);
        return res.status(429).json({ 
          error: 'Rate limited', 
          message: 'Too many requests to the RSS source',
          status: response.status 
        });
      }

      if (response.status === 1015) {
        console.warn(`Cloudflare rate limit for ${url}`);
        return res.status(503).json({ 
          error: 'Service temporarily unavailable', 
          message: 'RSS source is temporarily blocked by Cloudflare',
          status: response.status 
        });
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType} for ${url}`);

    // 检查内容类型
    if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
      console.warn(`Unexpected content type for ${url}: ${contentType}`);
    }

    let data = await response.text();

    // 基本的XML格式验证
    if (!data.trim()) {
      throw new Error('Empty response received');
    }

    if (!data.trim().startsWith('<?xml') && !data.includes('<rss') && !data.includes('<feed')) {
      console.warn(`[rss-proxy] Response may not be valid XML/RSS for ${url}`);
      // 检查是否是HTML错误页面
      if (data.includes('<html') || data.includes('<!DOCTYPE html')) {
        throw new Error('Received HTML page instead of RSS feed');
      }
    }

    // Server-side XML cleaning and namespace injection
    const cleanedData = cleanXmlData(data);
    
    console.log(`[rss-proxy] Successfully fetched and cleaned RSS data from ${url}, original: ${data.length} bytes, cleaned: ${cleanedData.length} bytes`);

    // Set cache headers for RSS feeds (5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-XML-Cleaned', cleanedData.length !== data.length ? 'true' : 'false');
    res.status(200).send(cleanedData);

  } catch (error) {
    console.error(`[rss-proxy] Error for ${url}:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n')[0],
      ip: clientIp
    });

    if (error.name === 'AbortError') {
      return res.status(408).json({ 
        error: 'Request timeout', 
        message: 'The RSS source took too long to respond',
        url: url 
      });
    }

    // 返回详细的错误信息
    res.status(500).json({ 
      error: 'Failed to fetch RSS feed', 
      message: error.message,
      url: url,
      timestamp: new Date().toISOString()
    });
  }
}