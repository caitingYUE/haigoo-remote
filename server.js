import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;

// 启用CORS
app.use(cors());
app.use(express.json());

// RSS代理端点
app.get('/api/rss-proxy', async (req, res) => {
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

  // 用户代理轮换
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (compatible; RSS-Reader/1.0; +http://example.com/bot)'
  ];

  const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

  try {
    console.log(`RSS proxy fetching: ${url}`);
    
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
      redirect: 'follow'
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

      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    console.log(`Content-Type: ${contentType} for ${url}`);

    // 检查内容类型
    if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
      console.warn(`Unexpected content type for ${url}: ${contentType}`);
    }

    const data = await response.text();

    // 基本的XML格式验证
    if (!data.trim()) {
      throw new Error('Empty response received');
    }

    if (!data.trim().startsWith('<?xml') && !data.includes('<rss') && !data.includes('<feed')) {
      console.warn(`Response may not be valid XML/RSS for ${url}`);
      // 检查是否是HTML错误页面
      if (data.includes('<html') || data.includes('<!DOCTYPE html')) {
        throw new Error('Received HTML page instead of RSS feed');
      }
    }

    console.log(`Successfully fetched RSS data from ${url}, length: ${data.length}`);

    // 设置正确的内容类型并返回数据
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(data);

  } catch (error) {
    console.error(`RSS proxy error for ${url}:`, {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n')[0]
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
});

// Jobs API端点
app.get('/api/jobs', async (req, res) => {
  try {
    console.log('Jobs API called');
    
    // 模拟职位数据 - 在实际应用中，这里会从数据库获取数据
    const jobs = [
      {
        id: '1',
        title: 'Frontend Developer',
        company: 'Tech Corp',
        location: 'Remote',
        description: '<p>We are looking for a skilled Frontend Developer to join our team. You will be responsible for developing user interfaces using React, TypeScript, and modern web technologies.</p><ul><li>3+ years of React experience</li><li>Strong TypeScript skills</li><li>Experience with modern CSS frameworks</li></ul>',
        requirements: 'Bachelor\'s degree in Computer Science or related field',
        salary: '$80,000 - $120,000',
        type: 'Full-time',
        remote: true,
        experience: 'Mid-level',
        skills: ['React', 'TypeScript', 'CSS', 'JavaScript'],
        postedDate: new Date().toISOString(),
        source: 'test'
      },
      {
        id: '2',
        title: 'Backend Engineer',
        company: 'StartupXYZ',
        location: 'San Francisco, CA',
        description: '<p>Join our backend team to build scalable APIs and microservices. You\'ll work with Node.js, Python, and cloud technologies to create robust systems.</p><h3>What you\'ll do:</h3><ul><li>Design and implement RESTful APIs</li><li>Optimize database queries</li><li>Deploy services to AWS</li></ul>',
        requirements: 'Experience with Node.js and Python',
        salary: '$100,000 - $150,000',
        type: 'Full-time',
        remote: false,
        experience: 'Senior',
        skills: ['Node.js', 'Python', 'AWS', 'MongoDB'],
        postedDate: new Date().toISOString(),
        source: 'test'
      }
    ];

    res.json({
      success: true,
      data: jobs,
      total: jobs.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Jobs API error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch jobs',
      message: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`RSS Proxy server running on http://localhost:${PORT}`);
});