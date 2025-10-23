// Vercel Serverless Function for RSS proxy
export default async function handler(req, res) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { url } = req.query;

  if (!url) {
    res.status(400).json({ error: 'URL parameter is required' });
    return;
  }

  try {
    console.log(`Fetching RSS from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS-Bot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 10000, // 10秒超时
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || (!contentType.includes('xml') && !contentType.includes('rss'))) {
      console.warn(`Unexpected content type: ${contentType} for URL: ${url}`);
    }

    const rssData = await response.text();
    
    // 返回RSS数据
    res.setHeader('Content-Type', 'application/xml');
    res.status(200).send(rssData);
    
  } catch (error) {
    console.error('Error fetching RSS:', error);
    
    // 返回详细错误信息
    res.status(500).json({
      error: 'Failed to fetch RSS feed',
      message: error.message,
      url: url
    });
  }
};