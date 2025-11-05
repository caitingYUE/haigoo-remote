import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = 3001;
// 简单的内存存储：开发环境下保存“处理后职位”数据，替代原有 mock
let processedJobsStore = [];

// 启用CORS
app.use(cors());
// 提高 JSON 与表单体积上限，避免大批量职位保存时报 413
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

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

// 数据管理API路由
// RSS同步
app.post('/api/data/sync', async (req, res) => {
  try {
    console.log('RSS同步API被调用');
    // 模拟同步过程
    const syncResult = {
      success: true,
      message: '同步完成',
      totalSources: 5,
      successfulSources: 5,
      failedSources: 0,
      totalJobsProcessed: 150,
      newJobsAdded: 25,
      timestamp: new Date().toISOString()
    };
    
    res.json(syncResult);
  } catch (error) {
    console.error('RSS同步错误:', error);
    res.status(500).json({
      success: false,
      error: '同步失败',
      message: error.message
    });
  }
});

// 获取处理后的职位数据
app.get('/api/data/processed-jobs', async (req, res) => {
  try {
    const { page = 1, pageSize, limit, source, category, company, isRemote, search } = req.query;
    const size = parseInt(pageSize || limit || 50);

    console.log('获取处理后职位数据API被调用', { page, pageSize: size, source, category });

    // 使用内存存储替代 mock
    let filteredJobs = processedJobsStore;
    if (source) {
      filteredJobs = filteredJobs.filter(job => job.source === source);
    }
    if (category) {
      filteredJobs = filteredJobs.filter(job => job.category === category);
    }
    if (company) {
      filteredJobs = filteredJobs.filter(job => (job.company || '').toLowerCase().includes(String(company).toLowerCase()));
    }
    if (isRemote === 'true') {
      filteredJobs = filteredJobs.filter(job => job.isRemote);
    }
    if (search) {
      const s = String(search).toLowerCase();
      filteredJobs = filteredJobs.filter(job => 
        (job.title || '').toLowerCase().includes(s) ||
        (job.description || '').toLowerCase().includes(s)
      );
    }

    const startIndex = (parseInt(page) - 1) * size;
    const endIndex = startIndex + size;
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    res.json({
      success: true,
      jobs: paginatedJobs,
      total: filteredJobs.length,
      page: parseInt(page),
      pageSize: size,
      totalPages: Math.ceil(filteredJobs.length / size)
    });

  } catch (error) {
    console.error('获取处理后职位数据错误:', error);
    res.status(500).json({
      success: false,
      error: '获取数据失败',
      message: error.message
    });
  }
});

// 获取所有处理后的职位数据
app.get('/api/data/all-processed-jobs', async (req, res) => {
  try {
    console.log('获取所有处理后职位数据API被调用');
    res.json(processedJobsStore);
  } catch (error) {
    console.error('获取所有处理后职位数据错误:', error);
    res.status(500).json({
      success: false,
      error: '获取数据失败',
      message: error.message
    });
  }
});

// 获取推荐职位
app.get('/api/data/recommended-jobs', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    console.log('获取推荐职位API被调用', { limit });
    
    // 模拟推荐职位数据
    const recommendedJobs = [
      {
        id: 'rec-1',
        title: 'Full Stack Developer',
        company: 'InnovateTech',
        location: 'Remote',
        description: 'Join our innovative team as a Full Stack Developer...',
        url: 'https://example.com/job/rec-1',
        publishedAt: new Date().toISOString(),
        source: 'Himalayas',
        category: '全栈开发',
        salary: '$90,000 - $130,000',
        jobType: 'full-time',
        experienceLevel: 'Mid',
        tags: ['React', 'Node.js', 'MongoDB'],
        requirements: ['Full stack experience', 'React & Node.js'],
        benefits: ['Remote work', 'Learning budget'],
        isRemote: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        recommendationScore: 0.95
      }
    ];

    res.json({
      success: true,
      jobs: recommendedJobs.slice(0, parseInt(limit)),
      total: recommendedJobs.length
    });

  } catch (error) {
    console.error('获取推荐职位错误:', error);
    res.status(500).json({
      success: false,
      error: '获取推荐职位失败',
      message: error.message
    });
  }
});

// 数据导出API
app.get('/api/data/export/raw', async (req, res) => {
  try {
    console.log('导出原始数据API被调用');
    
    // 模拟原始数据
    const rawData = [
      {
        id: 'raw-1',
        source: 'WeWorkRemotely',
        category: '前端开发',
        url: 'https://example.com/job/1',
        title: 'Senior Frontend Developer',
        description: 'We are looking for an experienced Frontend Developer...',
        link: 'https://example.com/job/1',
        pubDate: new Date().toISOString(),
        rawContent: '<item><title>Senior Frontend Developer</title>...</item>',
        fetchedAt: new Date(),
        status: 'processed'
      },
      {
        id: 'raw-2',
        source: 'Remotive',
        category: '后端开发',
        url: 'https://example.com/job/2',
        title: 'Backend Engineer',
        description: 'Join our backend team to build scalable APIs...',
        link: 'https://example.com/job/2',
        pubDate: new Date().toISOString(),
        rawContent: '<item><title>Backend Engineer</title>...</item>',
        fetchedAt: new Date(),
        status: 'processed'
      }
    ];

    // 设置CSV下载头
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="raw_data.csv"');
    
    // 生成CSV内容
    const csvHeader = 'ID,Source,Category,Title,URL,Status,Fetched At\n';
    const csvRows = rawData.map(item => 
      `"${item.id}","${item.source}","${item.category}","${item.title}","${item.url}","${item.status}","${item.fetchedAt}"`
    ).join('\n');
    
    res.send(csvHeader + csvRows);

  } catch (error) {
    console.error('导出原始数据错误:', error);
    res.status(500).json({
      success: false,
      error: '导出失败',
      message: error.message
    });
  }
});

app.get('/api/data/export/processed', async (req, res) => {
  try {
    console.log('导出处理后数据API被调用');

    const processedData = processedJobsStore;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="processed_jobs.csv"');

    const csvHeader = 'ID,Title,Company,Location,Source,Category,Salary,Job Type,Experience Level,Is Remote,Status,Created At\n';
    const csvRows = processedData.map(item => 
      `"${item.id}","${item.title}","${item.company}","${item.location}","${item.source}","${item.category}","${item.salary || ''}","${item.jobType || ''}","${item.experienceLevel || ''}","${item.isRemote}","${item.status || ''}","${item.createdAt || ''}"`
    ).join('\n');

    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error('导出处理后数据错误:', error);
    res.status(500).json({
      success: false,
      error: '导出失败',
      message: error.message
    });
  }
});

// CRUD操作API
// 更新职位
app.put('/api/data/processed-jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body || {};

    console.log('更新职位API被调用', { id });

    const idx = processedJobsStore.findIndex(j => String(j.id) === String(id));
    if (idx === -1) {
      return res.status(404).json({ success: false, error: '职位不存在' });
    }

    const updatedJob = {
      ...processedJobsStore[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
      isManuallyEdited: true
    };
    processedJobsStore[idx] = updatedJob;

    res.json({ success: true, message: '职位更新成功', job: updatedJob });
  } catch (error) {
    console.error('更新职位错误:', error);
    res.status(500).json({ success: false, error: '更新失败', message: error.message });
  }
});

// 删除职位
app.delete('/api/data/processed-jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('删除职位API被调用', { id });

    const before = processedJobsStore.length;
    processedJobsStore = processedJobsStore.filter(j => String(j.id) !== String(id));
    const after = processedJobsStore.length;

    res.json({ success: true, message: '职位删除成功', deletedId: id, total: after, removed: before - after });
  } catch (error) {
    console.error('删除职位错误:', error);
    res.status(500).json({ success: false, error: '删除失败', message: error.message });
  }
});

// 保存处理后职位（支持 replace/append 模式）
app.post('/api/data/processed-jobs', async (req, res) => {
  try {
    let body = req.body;
    if (!body || typeof body !== 'object') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
        });
      });
    }

    const { jobs, mode: bodyMode } = body || {};
    const mode = (bodyMode || req.query.mode || 'replace').toString();
    if (!Array.isArray(jobs)) {
      return res.status(400).json({ success: false, error: 'jobs must be an array' });
    }

    // 轻量规范化，保证常用字段存在
    const normalized = jobs.map(j => ({
      id: j.id || j.uuid || j.url || `job-${Date.now()}-${Math.random()}`,
      title: j.title || '',
      company: j.company || '',
      location: j.location || '',
      description: j.description || '',
      url: j.url || j.link || '',
      publishedAt: j.publishedAt || j.pubDate || new Date().toISOString(),
      source: j.source || '',
      category: j.category || '',
      salary: j.salary || '',
      jobType: j.jobType || j.type || '',
      experienceLevel: j.experienceLevel || j.level || '',
      tags: Array.isArray(j.tags) ? j.tags : [],
      requirements: Array.isArray(j.requirements) ? j.requirements : [],
      benefits: Array.isArray(j.benefits) ? j.benefits : [],
      isRemote: typeof j.isRemote === 'boolean' ? j.isRemote : false,
      status: j.status || 'active',
      createdAt: j.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      rawDataId: j.rawDataId || null,
      processedAt: new Date(),
      processingVersion: j.processingVersion || 'dev',
      isManuallyEdited: !!j.isManuallyEdited,
      editHistory: Array.isArray(j.editHistory) ? j.editHistory : []
    }));

    // 合并策略
    if (mode === 'append') {
      // 先合并，再按 id 去重；无 id 的用 title+company+location 作为键
      const existing = Array.isArray(processedJobsStore) ? processedJobsStore : [];
      const merged = [...existing, ...normalized];
      const seen = new Set();
      processedJobsStore = merged.filter(j => {
        const key = j.id || `${j.title}-${j.company}-${j.location}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else {
      // replace（默认）
      processedJobsStore = normalized;
    }

    res.json({ success: true, total: processedJobsStore.length, mode });
  } catch (error) {
    console.error('保存处理后职位数据错误:', error);
    res.status(500).json({ success: false, error: '保存失败', message: error.message });
  }
});

// ========================
// 推荐历史（开发环境存储）
// ========================
// 说明：为本地开发环境提供 /api/recommendations 接口，存储在内存中
// 生产环境由 Vercel 函数使用 KV 持久化

// 简单内存存储：key 为 `${uuid}:${date}`
const recommendationStore = new Map();

// CORS 预检处理（与 vercel.json 保持一致）
app.options('/api/recommendations', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Authorization');
  res.status(200).end();
});

// 查询某日推荐
app.get('/api/recommendations', (req, res) => {
  try {
    const { date, uuid = 'default' } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: 'date is required' });
    }
    const key = `${uuid}:${date}`;
    const data = recommendationStore.get(key) || null;
    return res.json({ success: true, data });
  } catch (error) {
    console.error('GET /api/recommendations error:', error);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

// 保存某日推荐
app.post('/api/recommendations', async (req, res) => {
  try {
    let body = req.body;
    // 兼容原始流
    if (!body || typeof body !== 'object') {
      body = await new Promise((resolve) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => {
          try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
        });
      });
    }

    const { date, jobs, uuid = 'default' } = body || {};
    if (!date || !Array.isArray(jobs)) {
      return res.status(400).json({ success: false, error: 'date and jobs are required' });
    }

    const payload = {
      date,
      uuid,
      jobs,
      timestamp: Date.now()
    };
    const key = `${uuid}:${date}`;
    recommendationStore.set(key, payload);
    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('POST /api/recommendations error:', error);
    return res.status(500).json({ success: false, error: 'internal error' });
  }
});

app.listen(PORT, () => {
  console.log(`RSS Proxy server running on http://localhost:${PORT}`);
});