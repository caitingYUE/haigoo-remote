import * as cheerio from 'cheerio';

// RSS Sources Configuration
const RSS_SOURCES = [
  // WeWorkRemotely
  { name: 'WeWorkRemotely', category: '全部', url: 'https://weworkremotely.com/remote-jobs.rss' },
  { name: 'WeWorkRemotely', category: '客户支持', url: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss' },
  { name: 'WeWorkRemotely', category: '产品职位', url: 'https://weworkremotely.com/categories/remote-product-jobs.rss' },
  { name: 'WeWorkRemotely', category: '全栈编程', url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '后端编程', url: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '前端编程', url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '所有编程', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss' },
  { name: 'WeWorkRemotely', category: '销售和市场营销', url: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss' },
  { name: 'WeWorkRemotely', category: '管理和财务', url: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss' },
  { name: 'WeWorkRemotely', category: '设计', url: 'https://weworkremotely.com/categories/remote-design-jobs.rss' },
  { name: 'WeWorkRemotely', category: 'DevOps和系统管理员', url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss' },
  { name: 'WeWorkRemotely', category: '其他', url: 'https://weworkremotely.com/categories/all-other-remote-jobs.rss' },

  // Remotive
  { name: 'Remotive', category: '全部', url: 'https://remotive.com/remote-jobs/feed' },
  { name: 'Remotive', category: '软件开发', url: 'https://remotive.com/remote-jobs/feed/software-dev' },
  { name: 'Remotive', category: '客户服务', url: 'https://remotive.com/remote-jobs/feed/customer-support' },
  { name: 'Remotive', category: '设计', url: 'https://remotive.com/remote-jobs/feed/design' },
  { name: 'Remotive', category: '营销', url: 'https://remotive.com/remote-jobs/feed/marketing' },
  { name: 'Remotive', category: '销售/业务', url: 'https://remotive.com/remote-jobs/feed/sales-business' },
  { name: 'Remotive', category: '产品', url: 'https://remotive.com/remote-jobs/feed/product' },
  { name: 'Remotive', category: '项目管理', url: 'https://remotive.com/remote-jobs/feed/project-management' },
  { name: 'Remotive', category: '数据分析', url: 'https://remotive.com/remote-jobs/feed/data' },
  { name: 'Remotive', category: 'DevOps/系统管理员', url: 'https://remotive.com/remote-jobs/feed/devops' },
  { name: 'Remotive', category: '金融/法律', url: 'https://remotive.com/remote-jobs/feed/finance-legal' },
  { name: 'Remotive', category: '人力资源', url: 'https://remotive.com/remote-jobs/feed/hr' },
  { name: 'Remotive', category: '质量保证', url: 'https://remotive.com/remote-jobs/feed/qa' },
  { name: 'Remotive', category: '写作', url: 'https://remotive.com/remote-jobs/feed/writing' },
  { name: 'Remotive', category: '所有其他', url: 'https://remotive.com/remote-jobs/feed/all-others' },

  // Himalayas
  { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' },

  // NoDesk
  { name: 'NoDesk', category: '全部', url: 'https://nodesk.substack.com/feed' }
];

/**
 * Fetch and parse a single RSS feed
 */
async function fetchAndParseFeed(source) {
  try {
    console.log(`[RSSFetcher] Fetching ${source.name} (${source.category})...`);
    const response = await fetch(source.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HaigooBot/1.0; +https://haigoo.io)'
      },
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const items = [];

    $('item').each((i, elem) => {
      const $item = $(elem);
      const title = $item.find('title').text().trim();
      const link = $item.find('link').text().trim();
      const description = $item.find('description').text().trim();
      const pubDate = $item.find('pubDate').text().trim();
      const guid = $item.find('guid').text().trim();
      
      // Try to extract extra fields if available
      const category = $item.find('category').text().trim() || source.category;
      
      if (title && link) {
        items.push({
          title,
          link,
          description,
          pubDate,
          guid: guid || link,
          source: source.name,
          category: category,
          fetchedAt: new Date().toISOString()
        });
      }
    });

    console.log(`[RSSFetcher] Parsed ${items.length} items from ${source.name}`);
    return items;
  } catch (error) {
    console.error(`[RSSFetcher] Error fetching ${source.name}:`, error.message);
    return [];
  }
}

/**
 * Fetch all RSS feeds
 */
export async function fetchAllFeeds() {
  console.log(`[RSSFetcher] Starting fetch for ${RSS_SOURCES.length} sources...`);
  const allItems = [];
  
  // Process in chunks to avoid overwhelming network
  const chunkSize = 3;
  for (let i = 0; i < RSS_SOURCES.length; i += chunkSize) {
    const chunk = RSS_SOURCES.slice(i, i + chunkSize);
    const results = await Promise.all(chunk.map(source => fetchAndParseFeed(source)));
    results.forEach(items => allItems.push(...items));
  }

  console.log(`[RSSFetcher] Total items fetched: ${allItems.length}`);
  return allItems;
}
