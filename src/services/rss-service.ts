import { Job, RSSSource, JobCategory } from '../types/rss-types.js';
import { ClassificationService } from './classification-service.js';

export interface RSSFeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  category?: string;
  company?: string;
  location?: string;
  salary?: string;
  jobType?: string;
  workType?: 'remote' | 'hybrid' | 'onsite';
  experienceLevel?: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  salaryRange?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: 'hourly' | 'monthly' | 'yearly';
  };
  skills?: string[];
  remoteLocationRestriction?: string;
}

export interface ParsedRSSData {
  source: string;
  category: string;
  items: RSSFeedItem[];
  lastUpdated: Date;
}

class RSSService {
  private RSS_SOURCES: RSSSource[] = [
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

    // JobsCollider - 暂时移除，RSS源为空
    // { name: 'JobsCollider', category: '全部', url: 'https://jobscollider.com/remote-jobs.rss' },

    // RealWorkFromAnywhere - 暂时禁用，因为RSS源不可用
    // { name: 'RealWorkFromAnywhere', category: '全部', url: 'https://www.realworkfromanywhere.com/rss.xml' },

    // Himalayas
    { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' },

    // NoDesk - 更新为正确的RSS源
    { name: 'NoDesk', category: '全部', url: 'https://nodesk.substack.com/feed' }
  ];

  constructor() {
    // 初始化时从本地存储加载RSS源配置
    this.loadRSSSourcesFromStorage();
  }

  /**
   * 获取所有RSS源
   */
  getRSSSources(): RSSSource[] {
    return this.RSS_SOURCES;
  }

  /**
   * 添加RSS源
   */
  addRSSSource(source: RSSSource): void {
    // 检查是否已存在相同的RSS源
    const exists = this.RSS_SOURCES.some(
      s => s.name === source.name && s.category === source.category && s.url === source.url
    );

    if (!exists) {
      this.RSS_SOURCES.push(source);
      this.saveRSSSourcesToStorage();
    }
  }

  /**
   * 更新RSS源
   */
  updateRSSSource(index: number, source: RSSSource): void {
    if (index >= 0 && index < this.RSS_SOURCES.length) {
      this.RSS_SOURCES[index] = source;
      this.saveRSSSourcesToStorage();
    }
  }

  /**
   * 删除RSS源
   */
  deleteRSSSource(index: number): void {
    if (index >= 0 && index < this.RSS_SOURCES.length) {
      this.RSS_SOURCES.splice(index, 1);
      this.saveRSSSourcesToStorage();
    }
  }

  /**
   * 保存RSS源到本地存储
   */
  private saveRSSSourcesToStorage(): void {
    try {
      localStorage.setItem('rss_sources', JSON.stringify(this.RSS_SOURCES));
    } catch (error) {
      console.error('保存RSS源配置失败:', error);
    }
  }

  /**
   * 从本地存储加载RSS源
   */
  private loadRSSSourcesFromStorage(): void {
    try {
      const stored = localStorage.getItem('rss_sources');
      if (stored) {
        const sources = JSON.parse(stored);
        if (Array.isArray(sources) && sources.length > 0) {
          this.RSS_SOURCES = sources;
        }
      }
    } catch (error) {
      console.error('加载RSS源配置失败:', error);
    }
  }

  /**
   * 重置为默认RSS源
   */
  resetToDefaultSources(): void {
    this.RSS_SOURCES = this.getDefaultSources();
    this.saveRSSSourcesToStorage();
  }

  /**
   * 获取默认RSS源
   */
  private getDefaultSources(): RSSSource[] {
    return [
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

      // JobsCollider
      { name: 'JobsCollider', category: '全部', url: 'https://jobscollider.com/remote-jobs.rss' },
      { name: 'JobsCollider', category: '软件开发', url: 'https://jobscollider.com/remote-software-development-jobs.rss' },
      { name: 'JobsCollider', category: '网络安全', url: 'https://jobscollider.com/remote-software-development-jobs.rss' },
      { name: 'JobsCollider', category: '客户服务', url: 'https://jobscollider.com/remote-customer-service-jobs.rss' },
      { name: 'JobsCollider', category: '设计', url: 'https://jobscollider.com/remote-design-jobs.rss' },
      { name: 'JobsCollider', category: '营销', url: 'https://jobscollider.com/remote-marketing-jobs.rss' },
      { name: 'JobsCollider', category: '销售', url: 'https://jobscollider.com/remote-sales-jobs.rss' },
      { name: 'JobsCollider', category: '产品', url: 'https://jobscollider.com/remote-product-jobs.rss' },
      { name: 'JobsCollider', category: '商业', url: 'https://jobscollider.com/remote-business-jobs.rss' },
      { name: 'JobsCollider', category: '数据', url: 'https://jobscollider.com/remote-data-jobs.rss' },
      { name: 'JobsCollider', category: 'DevOps', url: 'https://jobscollider.com/remote-devops-jobs.rss' },
      { name: 'JobsCollider', category: '财务与法律', url: 'https://jobscollider.com/remote-finance-legal-jobs.rss' },
      { name: 'JobsCollider', category: '人力资源', url: 'https://jobscollider.com/remote-human-resources-jobs.rss' },
      { name: 'JobsCollider', category: '质量保证', url: 'https://jobscollider.com/remote-qa-jobs.rss' },
      { name: 'JobsCollider', category: '写作', url: 'https://jobscollider.com/remote-writing-jobs.rss' },
      { name: 'JobsCollider', category: '项目管理', url: 'https://jobscollider.com/remote-project-management-jobs.rss' },
      { name: 'JobsCollider', category: '所有其他', url: 'https://jobscollider.com/remote-all-others-jobs.rss' },

      // RealWorkFromAnywhere
      { name: 'RealWorkFromAnywhere', category: '全部', url: 'https://www.realworkfromanywhere.com/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '产品', url: 'https://www.realworkfromanywhere.com/remote-product-manager-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '开发人员', url: 'https://www.realworkfromanywhere.com/remote-developer-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '工程师', url: 'https://www.realworkfromanywhere.com/remote-engineer-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '前端', url: 'https://www.realworkfromanywhere.com/remote-frontend-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '后端', url: 'https://www.realworkfromanywhere.com/remote-backend-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '全栈开发', url: 'https://www.realworkfromanywhere.com/remote-fullstack-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '设计', url: 'https://www.realworkfromanywhere.com/remote-design-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '数据', url: 'https://www.realworkfromanywhere.com/remote-data-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '研究', url: 'https://www.realworkfromanywhere.com/remote-research-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '金融', url: 'https://www.realworkfromanywhere.com/remote-finance-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '营销', url: 'https://www.realworkfromanywhere.com/remote-marketing-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '高级岗位', url: 'https://www.realworkfromanywhere.com/remote-senior-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '销售', url: 'https://www.realworkfromanywhere.com/remote-sales-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '客户服务', url: 'https://www.realworkfromanywhere.com/remote-customer-service-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '客户支持', url: 'https://www.realworkfromanywhere.com/remote-customer-support-jobs/rss.xml' },
      { name: 'RealWorkFromAnywhere', category: '行政', url: 'https://www.realworkfromanywhere.com/remote-admin-jobs/rss.xml' },

      // Himalayas
      { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' },

      // NoDesk
      { name: 'NoDesk', category: '全部', url: 'https://nodesk.substack.com/feed' }
    ];
  }

  /**
   * 获取单个RSS源的数据
   */
  async fetchRSSFeed(url: string): Promise<string> {
    let responseText = '';

    // 按顺序尝试多个代理基址：开发环境优先本地，其次线上；生产环境仅线上
    const baseCandidates = process.env.NODE_ENV === 'development'
      ? ['http://localhost:3001', 'https://haigoo.vercel.app']
      : ['https://haigoo.vercel.app'];

    let lastError: unknown = null;

    for (const baseUrl of baseCandidates) {
      try {
        const proxyUrl = `${baseUrl}/api/rss-proxy?url=${encodeURIComponent(url)}`;
        console.log(`Fetching RSS via proxy: ${proxyUrl}`);

        const response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(20000) // 20秒超时
        });

        if (!response.ok) {
          // 检查响应类型
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(`Proxy error: ${errorData.message || errorData.error}`);
          } else {
            throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
          }
        }

        responseText = await response.text();

        // 验证响应是否为有效的XML
        if (!responseText || responseText.trim().length === 0) {
          throw new Error('Empty response received');
        }

        // 检查是否为XML格式
        const trimmed = responseText.trim();
        if (!trimmed.startsWith('<?xml') && !trimmed.startsWith('<rss') && !trimmed.startsWith('<feed')) {
          throw new Error('Response is not valid XML/RSS format');
        }

        // 当前基址成功，直接返回
        return responseText;
      } catch (err) {
        lastError = err;
        console.warn(`RSS proxy failed at base ${baseUrl}:`, err instanceof Error ? err.message : String(err));
        // 尝试下一个候选基址
        continue;
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    console.error(`Failed to fetch RSS from ${url}:`, errorMessage);
    throw new Error(`RSS fetch failed: ${errorMessage}`);
  }

  /**
   * 解析RSS XML数据
   */
  parseRSSFeed(xmlData: string, source: RSSSource): RSSFeedItem[] {
    try {
      // 预处理XML数据，修复常见的格式问题
      let cleanedXmlData = xmlData;

      // 移除可能的BOM标记
      cleanedXmlData = cleanedXmlData.replace(/^\uFEFF/, '');

      // 确保XML声明后有换行
      cleanedXmlData = cleanedXmlData.replace(/(<\?xml[^>]*\?>)(\s*<)/, '$1\n$2');

      // 修复缺少换行的标签
      cleanedXmlData = cleanedXmlData.replace(/(<\/[^>]+>)(<[^\/][^>]*>)/g, '$1\n$2');

      // 修复item标签之间缺少换行的问题
      cleanedXmlData = cleanedXmlData.replace(/(<\/item>)(\s*)(<item>)/g, '$1\n$3');

      const parser = new DOMParser();
      // 首次尝试标准解析
      const xmlDoc = parser.parseFromString(cleanedXmlData, 'text/xml');

      // 检查解析错误
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error:', parseError.textContent);

        // 尝试使用application/xml MIME类型重新解析
        const xmlDoc2 = parser.parseFromString(cleanedXmlData, 'application/xml');
        const parseError2 = xmlDoc2.querySelector('parsererror');
        if (!parseError2) {
          return this.extractItemsFromXmlDoc(xmlDoc2, source);
        }

        // 进一步容错：自动注入常见命名空间声明后重试
        const injectedXml = this.injectMissingNamespaces(cleanedXmlData);
        const xmlDoc3 = parser.parseFromString(injectedXml, 'application/xml');
        const parseError3 = xmlDoc3.querySelector('parsererror');
        if (!parseError3) {
          return this.extractItemsFromXmlDoc(xmlDoc3, source);
        }

        console.warn('XML still invalid after namespace injection, falling back to regex parser');
        // 最后退路：使用正则解析基础字段，避免整体失败导致无数据
        return this.parseItemsByRegex(cleanedXmlData, source);
      }

      return this.extractItemsFromXmlDoc(xmlDoc, source);
    } catch (error) {
      console.error('Error parsing RSS feed from', source.name, ':', error);
      console.error('XML data preview:', xmlData.substring(0, 500));
      return [];
    }
  }

  /**
   * 为缺失的命名空间前缀注入默认xmlns声明
   */
  private injectMissingNamespaces(xml: string): string {
    try {
      const knownNs: Record<string, string> = {
        content: 'http://purl.org/rss/1.0/modules/content/',
        media: 'http://search.yahoo.com/mrss/',
        atom: 'http://www.w3.org/2005/Atom',
        dc: 'http://purl.org/dc/elements/1.1/',
        wfw: 'http://wellformedweb.org/CommentAPI/',
        slash: 'http://purl.org/rss/1.0/modules/slash/',
        sy: 'http://purl.org/rss/1.0/modules/syndication/',
        himalayasJobs: 'https://himalayas.app/jobs/rss/namespace'
      };

      // 找出所有使用的前缀
      const prefixMatches = Array.from(xml.matchAll(/<\/?([a-zA-Z_][\w\-.]*)\:/g)).map(m => m[1]);
      const uniquePrefixes = Array.from(new Set(prefixMatches));

      if (uniquePrefixes.length === 0) return xml;

      // 定位根节点（rss或feed）
      const rootTagMatch = xml.match(/<\s*(rss|feed)([^>]*)>/i);
      if (!rootTagMatch) return xml;

      const rootTag = rootTagMatch[0];
      const rootName = rootTagMatch[1];
      let rootAttrs = rootTagMatch[2] || '';

      // 为每个缺失前缀添加xmlns声明
      for (const prefix of uniquePrefixes) {
        const xmlnsPattern = new RegExp(`xmlns:${prefix}\\s*=`, 'i');
        if (!xmlnsPattern.test(rootAttrs)) {
          const nsUri = knownNs[prefix] || `https://schemas.example.com/${prefix}`;
          rootAttrs += ` xmlns:${prefix}="${nsUri}"`;
        }
      }

      // 重建根标签
      const newRootTag = `<${rootName}${rootAttrs}>`;
      return xml.replace(rootTag, newRootTag);
    } catch {
      return xml; // 安全回退
    }
  }

  /**
   * 容错正则解析：提取基础字段，忽略命名空间标签
   */
  private parseItemsByRegex(xml: string, source: RSSSource): RSSFeedItem[] {
    const items: RSSFeedItem[] = [];
    const itemRegex = /<item[\s\S]*?<\/item>/gi;
    const titleRegex = /<title>([\s\S]*?)<\/title>/i;
    const linkRegex = /<link>([\s\S]*?)<\/link>/i;
    const pubDateRegex = /<pubDate>([\s\S]*?)<\/pubDate>/i;
    const descRegex = /<description[\s\S]*?>[\s\S]*?<\/description>/i;

    const matches = xml.match(itemRegex) || [];
    for (const block of matches) {
      const title = (block.match(titleRegex)?.[1] || '').trim();
      const link = (block.match(linkRegex)?.[1] || '').trim();
      const pubDate = (block.match(pubDateRegex)?.[1] || '').trim();
      // 提取description时保留CDATA内容
      const descMatch = block.match(descRegex);
      let description = '';
      if (descMatch) {
        description = descMatch[0]
          .replace(/^<description[^>]*>/i, '')
          .replace(/<\/description>$/i, '')
          .trim();
        // 清理CDATA包裹
        description = description.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/i, '$1').trim();
      }

      if (title && link) {
        // 使用 ClassificationService 进行分类
        const autoCategory = ClassificationService.classifyJob(title, description);

        items.push({
          title,
          description: this.cleanDescription(description),
          link,
          pubDate,
          category: autoCategory || source.category // 优先使用自动分类
        });
      }
    }

    return items;
  }

  private extractItemsFromXmlDoc(xmlDoc: Document, source: RSSSource): RSSFeedItem[] {
    const items = xmlDoc.querySelectorAll('item');
    const feedItems: RSSFeedItem[] = [];

    items.forEach(item => {
      try {
        const title = item.querySelector('title')?.textContent?.trim() || '';
        let description = item.querySelector('description')?.textContent?.trim() || '';
        const link = item.querySelector('link')?.textContent?.trim() || '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';

        // 清理和格式化描述内容
        description = this.cleanDescription(description);

        // 根据不同RSS源使用专门的解析逻辑
        const parsedData = this.parseBySource(item, source, title, description);

        if (title && link) {
          const salary = parsedData.salary || this.extractSalary(title, description);

          // 使用 ClassificationService 进行分类
          const autoCategory = ClassificationService.classifyJob(title, description);

          feedItems.push({
            title: parsedData.title || title,
            description,
            link,
            pubDate,
            category: autoCategory || parsedData.category || source.category, // 优先使用自动分类
            company: parsedData.company,
            location: parsedData.location,
            salary,
            skills: parsedData.skills,
            jobType: parsedData.jobType,
            workType: parsedData.workType || this.extractWorkType(title, description),
            experienceLevel: parsedData.experienceLevel || this.extractExperienceLevel(title, description),
            salaryRange: this.parseSalaryRange(salary),
            remoteLocationRestriction: parsedData.remoteLocationRestriction || this.extractRemoteLocationRestriction(title, description)
          });
        }
      } catch (itemError) {
        console.warn('Error processing RSS item:', itemError);
      }
    });

    return feedItems;
  }

  /**
   * 根据不同RSS源使用专门的解析逻辑
   */
  private parseBySource(item: Element, source: RSSSource, title: string, description: string): {
    title?: string;
    company?: string;
    location?: string;
    jobType?: string;
    workType?: 'remote' | 'hybrid' | 'onsite';
    experienceLevel?: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
    category?: string;
    salary?: string;
    skills?: string[];
    remoteLocationRestriction?: string;
  } {
    const sourceName = source.name.toLowerCase();

    switch (sourceName) {
      case 'weworkremotely':
        return this.parseWeWorkRemotely(item, title, description);
      case 'remotive':
        return this.parseRemotive(item, title, description);
      case 'himalayas':
        return this.parseHimalayas(item, title, description);
      case 'jobscollider':
        return this.parseJobsCollider(item, title, description);
      case 'nodesk':
        return this.parseNoDesk(item, title, description);
      default:
        return this.parseGeneric(item, title, description);
    }
  }

  /**
   * 解析WeWorkRemotely的特殊字段
   */
  private parseWeWorkRemotely(item: Element, title: string, description: string): any {
    // WeWorkRemotely有丰富的结构化字段
    const region = item.querySelector('region')?.textContent?.trim() || '';
    const country = item.querySelector('country')?.textContent?.trim() || '';
    const state = item.querySelector('state')?.textContent?.trim() || '';
    const type = item.querySelector('type')?.textContent?.trim() || '';
    const skillsText = item.querySelector('skills')?.textContent?.trim() || '';
    const parsedSkills = skillsText
      ? skillsText
        .split(/[\,\|\/]\s*/)
        .map(s => s.trim())
        .filter(s => s.length > 0)
      : [];

    // 从标题中提取公司名（格式：Company: Job Title）
    let company = '';
    let cleanTitle = title;
    const titleMatch = title.match(/^([^:]+):\s*(.+)$/);
    if (titleMatch) {
      company = titleMatch[1].trim();
      cleanTitle = titleMatch[2].trim();
    }

    // 构建位置信息
    let location = '';
    if (region && country) {
      location = `${region}, ${country}`;
    } else if (country) {
      location = country.replace(/🇺🇸|🇬🇧|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇪🇸|🇮🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮/g, '').trim();
    }
    if (state) {
      location = location ? `${location}, ${state}` : state;
    }

    // 映射工作类型
    let jobType = '';
    if (type) {
      jobType = type.toLowerCase().includes('full') ? 'Full-time' :
        type.toLowerCase().includes('part') ? 'Part-time' :
          type.toLowerCase().includes('contract') ? 'Contract' : type;
    }

    // 提取远程地点限制
    let remoteLocationRestriction = '';
    if (country) {
      const countryName = country.replace(/🇺🇸|🇬🇧|🇨🇦|🇦🇺|🇩🇪|🇫🇷|🇪🇸|🇮🇹|🇳🇱|🇸🇪|🇳🇴|🇩🇰|🇫🇮/g, '').trim();
      if (countryName && countryName !== 'Worldwide') {
        remoteLocationRestriction = `仅限${countryName}`;
      } else if (countryName === 'Worldwide') {
        remoteLocationRestriction = '全球远程';
      }
    }

    return {
      title: cleanTitle,
      company: company || this.extractCompany(title, description),
      location: location || this.extractLocation(title, description),
      jobType: jobType || this.extractJobType(title, description),
      workType: 'remote' as const,
      skills: parsedSkills,
      remoteLocationRestriction
    };
  }

  /**
   * 解析Remotive的特殊字段
   */
  private parseRemotive(item: Element, title: string, description: string): any {
    // Remotive有专门的company和location字段
    const company = item.querySelector('company')?.textContent?.trim() || '';
    const location = item.querySelector('location')?.textContent?.trim() || '';

    // 从location字段提取远程地点限制
    let remoteLocationRestriction = '';
    if (location) {
      if (location.toLowerCase().includes('worldwide') || location.toLowerCase().includes('global')) {
        remoteLocationRestriction = '全球远程';
      } else if (location.toLowerCase().includes('usa') || location.toLowerCase().includes('united states')) {
        remoteLocationRestriction = '仅限美国';
      } else if (location.toLowerCase().includes('europe') || location.toLowerCase().includes('eu')) {
        remoteLocationRestriction = '仅限欧盟';
      } else if (location.length > 0 && location !== 'Remote') {
        remoteLocationRestriction = `仅限${location}`;
      }
    }

    return {
      company: company || this.extractCompany(title, description),
      location: location || this.extractLocation(title, description),
      jobType: this.extractJobType(title, description),
      workType: 'remote' as const,
      remoteLocationRestriction
    };
  }

  /**
   * 解析Himalayas的特殊字段
   */
  private parseHimalayas(item: Element, title: string, description: string): any {
    // Himalayas使用自定义字段，优先使用这些字段
    // 由于命名空间问题，我们需要使用不同的选择器策略
    let company: string | undefined;
    let location: string | undefined;
    let salary: string | undefined;
    let jobType: string | undefined;

    // 尝试多种方式查找自定义字段
    const allElements = Array.from(item.children);

    // 首先尝试直接查找himalayasJobs命名空间字段
    const companyNameEl = item.querySelector('himalayasJobs\\:companyName, companyName');
    if (companyNameEl) {
      company = companyNameEl.textContent?.trim();
    }

    const locationRestrictionEl = item.querySelector('himalayasJobs\\:locationRestriction, locationRestriction');
    if (locationRestrictionEl) {
      location = locationRestrictionEl.textContent?.trim();
    }

    const salaryEl = item.querySelector('himalayasJobs\\:salary, salary');
    if (salaryEl) {
      salary = salaryEl.textContent?.trim();
    }

    const jobTypeEl = item.querySelector('himalayasJobs\\:jobType, jobType');
    if (jobTypeEl) {
      jobType = jobTypeEl.textContent?.trim();
    }

    // 如果直接查找失败，遍历所有子元素
    if (!company || !location || !salary || !jobType) {
      for (const element of allElements) {
        const tagName = element.tagName.toLowerCase();
        const localName = element.localName?.toLowerCase();

        // 检查公司名称字段
        if (!company && (tagName.includes('companyname') || localName?.includes('companyname'))) {
          company = element.textContent?.trim();
        }

        // 检查位置限制字段
        if (!location && (tagName.includes('locationrestriction') || localName?.includes('locationrestriction'))) {
          location = element.textContent?.trim();
        }

        // 检查薪资字段
        if (!salary && (tagName.includes('salary') || localName?.includes('salary'))) {
          salary = element.textContent?.trim();
        }

        // 检查工作类型字段
        if (!jobType && (tagName.includes('jobtype') || localName?.includes('jobtype'))) {
          jobType = element.textContent?.trim();
        }
      }
    }

    // 如果没有找到自定义字段，使用传统提取方法
    if (!company) {
      company = this.extractCompany(title, description);
    }

    if (!location) {
      location = this.extractLocation(title, description);
    }

    if (!salary) {
      salary = this.extractSalary(title, description);
    }

    if (!jobType) {
      jobType = this.extractJobType(title, description);
    }

    // 获取分类信息
    const categories = Array.from(item.querySelectorAll('category')).map(cat => cat.textContent?.trim()).filter(Boolean);

    // 从标题和分类中提取职位级别
    let experienceLevel: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' | undefined;

    // 首先从标题中检查
    const titleLower = title.toLowerCase();
    if (titleLower.includes('senior') || titleLower.includes('sr.')) {
      experienceLevel = 'Senior';
    } else if (titleLower.includes('lead') || titleLower.includes('principal')) {
      experienceLevel = 'Lead';
    } else if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('entry')) {
      experienceLevel = 'Entry';
    } else {
      // 从categories中提取职位级别
      for (const category of categories) {
        if (category?.toLowerCase().includes('senior')) {
          experienceLevel = 'Senior';
          break;
        } else if (category?.toLowerCase().includes('lead')) {
          experienceLevel = 'Lead';
          break;
        } else if (category?.toLowerCase().includes('junior') || category?.toLowerCase().includes('entry')) {
          experienceLevel = 'Entry';
          break;
        }
      }
    }

    // 检测是否为远程工作
    let workType: 'remote' | 'hybrid' | 'onsite' = 'remote';
    if (location) {
      const locationLower = location.toLowerCase();
      if (locationLower.includes('hybrid')) {
        workType = 'hybrid';
      } else if (locationLower.includes('onsite') || locationLower.includes('on-site')) {
        workType = 'onsite';
      }
    }

    return {
      company: company || undefined,
      location: location || undefined,
      jobType: jobType || undefined,
      workType: workType,
      experienceLevel: experienceLevel || this.extractExperienceLevel(title, description),
      category: categories.length > 0 ? categories[0] : undefined,
      salary: salary || undefined
    };
  }

  /**
   * 解析JobsCollider的特殊字段
   */
  private parseJobsCollider(item: Element, title: string, description: string): any {
    return {
      company: this.extractCompany(title, description),
      location: this.extractLocation(title, description),
      jobType: this.extractJobType(title, description),
      workType: 'remote' as const
    };
  }

  /**
   * 解析NoDesk的特殊字段
   */
  private parseNoDesk(item: Element, title: string, description: string): any {
    return {
      company: this.extractCompany(title, description),
      location: this.extractLocation(title, description),
      jobType: this.extractJobType(title, description),
      workType: 'remote' as const
    };
  }

  /**
   * 通用解析逻辑
   */
  private parseGeneric(item: Element, title: string, description: string): any {
    // 尝试从XML字段提取信息
    const company = item.querySelector('company')?.textContent?.trim() || '';
    const location = item.querySelector('location')?.textContent?.trim() || '';
    const jobType = item.querySelector('type')?.textContent?.trim() || '';

    return {
      company: company || this.extractCompany(title, description),
      location: location || this.extractLocation(title, description),
      jobType: jobType || this.extractJobType(title, description),
      workType: this.extractWorkType(title, description)
    };
  }

  /**
   * 清理和格式化职位描述
   */
  private cleanDescription(description: string): string {
    if (!description) return '';

    // 先解码HTML实体
    const htmlEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&nbsp;': ' ',
      '&mdash;': '—',
      '&ndash;': '–',
      '&hellip;': '…',
      '&rsquo;': "'",
      '&lsquo;': "'",
      '&rdquo;': '"',
      '&ldquo;': '"'
    };

    let cleaned = description;
    Object.entries(htmlEntities).forEach(([entity, char]) => {
      cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
    });

    // 保留段落结构，将块级元素转换为换行
    cleaned = cleaned.replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, '\n');

    // 保留重要的格式标签，转换为文本标记
    cleaned = cleaned.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    cleaned = cleaned.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    cleaned = cleaned.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    cleaned = cleaned.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

    // 移除其他HTML标签
    cleaned = cleaned.replace(/<[^>]*>/g, '');

    // 清理多余的空白字符，但保留段落分隔
    cleaned = cleaned.replace(/\n\s*\n/g, '\n\n'); // 保留段落间距
    cleaned = cleaned.replace(/[ \t]+/g, ' '); // 合并空格和制表符
    cleaned = cleaned.trim();

    // 增加描述长度限制到2000字符
    if (cleaned.length > 2000) {
      // 尝试在句子结束处截断
      const truncated = cleaned.substring(0, 1997);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?')
      );

      if (lastSentenceEnd > 1500) {
        cleaned = truncated.substring(0, lastSentenceEnd + 1) + '...';
      } else {
        cleaned = truncated + '...';
      }
    }

    return cleaned;
  }

  /**
   * 从标题或描述中提取公司名称
   */
  private extractCompany(title: string, description: string): string {
    // 增强的公司名称提取逻辑，支持多种格式
    const companyPatterns = [
      // 标准格式：Job Title at Company Name
      /\bat\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 管道分隔：Job Title | Company Name
      /\|\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*\||$)/,
      // 冒号分隔：Job Title: Company Name (已在WeWorkRemotely中处理)
      /:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/,
      // 破折号分隔：Job Title - Company Name
      /\s-\s([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/,
      // 开头格式：Company Name - Job Title
      /^([A-Z][a-zA-Z\s&.,-]+?)\s*[-:]/,
      // 括号格式：Job Title (Company Name)
      /\(([A-Z][a-zA-Z\s&.,-]+?)\)/,
      // @符号格式：Job Title @Company Name
      /@\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 描述中的公司名称模式
      /(?:company|employer|organization|client):\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[.\n]|$)/i,
      // 工作地点格式：Job Title - Remote at Company Name
      /remote\s+at\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 位置格式：Job Title - Location - Company Name
      /\s-\s[A-Za-z\s,]+\s-\s([A-Z][a-zA-Z\s&.,-]+?)(?:\s*$)/,
      // 描述开头的公司名称：Company Name is looking for...
      /^([A-Z][a-zA-Z\s&.,-]+?)\s+(?:is\s+looking|seeks?|wants?|needs?)\s+/i,
      // 描述中的 "Join Company Name" 格式
      /join\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s+(?:as|and|team)|[.,!]|\s*$)/i,
      // 描述中的 "Company Name team" 格式
      /([A-Z][a-zA-Z\s&.,-]+?)\s+team(?:\s|[.,!]|$)/i
    ];

    // 首先尝试从标题中提取
    for (const pattern of companyPatterns.slice(0, 11)) { // 排除描述专用模式
      const match = title.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        // 过滤掉常见的非公司名称
        if (!this.isCommonNonCompanyWord(company) && company.length > 2) {
          return this.cleanCompanyName(company);
        }
      }
    }

    // 然后尝试从描述中提取
    for (const pattern of companyPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        if (!this.isCommonNonCompanyWord(company) && company.length > 2) {
          return this.cleanCompanyName(company);
        }
      }
    }

    return '';
  }

  /**
   * 清理公司名称
   */
  private cleanCompanyName(company: string): string {
    // 移除常见的后缀
    return company
      .replace(/\s+(Inc\.?|LLC\.?|Ltd\.?|Corp\.?|Co\.?|Company)$/i, '')
      .replace(/\s+(is\s+hiring|hiring|jobs?)$/i, '')
      .replace(/\s*[,.-]+\s*$/, '')
      .trim();
  }

  /**
   * 检查是否为常见的非公司名称词汇
   */
  private isCommonNonCompanyWord(word: string): boolean {
    const commonWords = [
      'remote', 'full', 'time', 'part', 'contract', 'freelance', 'temporary',
      'senior', 'junior', 'lead', 'principal', 'staff', 'entry', 'level',
      'developer', 'engineer', 'designer', 'manager', 'analyst', 'specialist',
      'coordinator', 'assistant', 'director', 'executive', 'consultant',
      'intern', 'trainee', 'associate', 'administrator', 'supervisor',
      'job', 'position', 'role', 'opportunity', 'career', 'work', 'employment',
      'hiring', 'wanted', 'seeking', 'looking', 'required', 'needed',
      'usa', 'europe', 'worldwide', 'global', 'international', 'local',
      'new', 'old', 'big', 'small', 'large', 'major', 'minor', 'top',
      'best', 'great', 'good', 'excellent', 'amazing', 'awesome',
      'the', 'and', 'or', 'but', 'for', 'with', 'without', 'from', 'to',
      'software', 'web', 'mobile', 'frontend', 'backend', 'fullstack',
      'marketing', 'sales', 'support', 'customer', 'product', 'data'
    ];

    return commonWords.includes(word.toLowerCase()) || word.length < 2;
  }

  /**
   * 从标题或描述中提取地理位置
   */
  private extractLocation(title: string, description: string): string {
    // 增强的位置信息提取逻辑
    const locationPatterns = [
      // 标准格式：Job Title - Location
      /\s-\s([A-Z][a-zA-Z\s,.-]+?)(?:\s*[-|•]|\s*$)/,
      // 括号格式：Job Title (Location)
      /\(([A-Z][a-zA-Z\s,.-]+?)\)/,
      // 管道分隔：Job Title | Location
      /\|\s*([A-Z][a-zA-Z\s,.-]+?)(?:\s*\||$)/,
      // 位置关键词：Location: City, Country
      /(?:location|based|office):\s*([A-Za-z\s,.-]+?)(?:\s*[.\n]|$)/i,
      // 远程工作格式：Remote - Location
      /remote\s*[-–]\s*([A-Za-z\s,.-]+?)(?:\s*[.\n]|$)/i,
      // 工作地点：Work from Location
      /work\s+from\s+([A-Za-z\s,.-]+?)(?:\s*[.\n]|$)/i,
      // 描述中的位置：in Location
      /\bin\s+([A-Z][a-zA-Z\s,.-]+?)(?:\s*[,.\n]|$)/,
      // 国家/城市模式
      /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*),\s*([A-Z][A-Z]+|[A-Z][a-zA-Z]+)\b/,
      // 远程工作限制：Remote (Location only)
      /remote\s*\(([^)]+)\)/i,
      // 时区信息：Location timezone
      /([A-Za-z\s,.-]+?)\s+(?:timezone|time\s+zone|tz)/i
    ];

    // 首先尝试从标题中提取
    for (const pattern of locationPatterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        if (this.isValidLocation(location)) {
          return this.cleanLocation(location);
        }
      }
    }

    // 然后尝试从描述中提取
    for (const pattern of locationPatterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const location = match[1].trim();
        if (this.isValidLocation(location)) {
          return this.cleanLocation(location);
        }
      }
    }

    // 检查是否包含远程工作关键词
    if (this.containsRemoteKeywords(title) || this.containsRemoteKeywords(description)) {
      return 'Remote';
    }

    return 'Remote'; // 默认为远程
  }

  /**
   * 检查是否为有效的位置信息
   */
  private isValidLocation(location: string): boolean {
    // 过滤掉明显不是位置的词汇
    const invalidLocationWords = [
      'remote', 'full', 'time', 'part', 'contract', 'freelance', 'temporary',
      'senior', 'junior', 'lead', 'principal', 'staff', 'entry', 'level',
      'developer', 'engineer', 'designer', 'manager', 'analyst', 'specialist',
      'job', 'position', 'role', 'opportunity', 'career', 'work', 'employment',
      'hiring', 'wanted', 'seeking', 'looking', 'required', 'needed',
      'software', 'web', 'mobile', 'frontend', 'backend', 'fullstack',
      'marketing', 'sales', 'support', 'customer', 'product', 'data'
    ];

    const lowerLocation = location.toLowerCase();

    // 检查是否包含无效词汇
    for (const word of invalidLocationWords) {
      if (lowerLocation.includes(word)) {
        return false;
      }
    }

    // 检查长度和格式
    if (location.length < 2 || location.length > 50) {
      return false;
    }

    // 检查是否包含常见的位置关键词
    const locationKeywords = [
      'usa', 'us', 'united states', 'america', 'canada', 'uk', 'united kingdom',
      'europe', 'asia', 'australia', 'new zealand', 'germany', 'france', 'spain',
      'italy', 'netherlands', 'sweden', 'norway', 'denmark', 'finland',
      'city', 'state', 'country', 'province', 'region', 'worldwide', 'global',
      'new york', 'san francisco', 'los angeles', 'chicago', 'boston', 'seattle',
      'london', 'paris', 'berlin', 'amsterdam', 'stockholm', 'copenhagen',
      'toronto', 'vancouver', 'sydney', 'melbourne', 'tokyo', 'singapore'
    ];

    for (const keyword of locationKeywords) {
      if (lowerLocation.includes(keyword)) {
        return true;
      }
    }

    // 检查是否符合城市,国家格式
    if (/^[A-Z][a-zA-Z\s]+,\s*[A-Z][A-Za-z\s]+$/.test(location)) {
      return true;
    }

    // 检查是否为简单的地名格式
    if (/^[A-Z][a-zA-Z\s]{1,20}$/.test(location)) {
      return true;
    }

    return false;
  }

  /**
   * 清理位置信息
   */
  private cleanLocation(location: string): string {
    return location
      .replace(/\s*[,.-]+\s*$/, '')
      .replace(/^\s*[,.-]+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * 检查是否包含远程工作关键词
   */
  private containsRemoteKeywords(text: string): boolean {
    const remoteKeywords = [
      'remote', 'work from home', 'wfh', 'telecommute', 'distributed',
      'anywhere', 'location independent', 'home office', 'virtual'
    ];

    const lowerText = text.toLowerCase();
    return remoteKeywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * 从标题或描述中提取薪资信息
   */
  private extractSalary(title: string, description: string): string {
    // 更严格的薪资模式，必须包含明确的薪资上下文
    const salaryPatterns = [
      // 明确的薪资范围模式，如 "$50,000 - $80,000 per year"
      /(?:salary|pay|compensation|wage|income|earn|earning|earnings)[\s:]*\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|annual|month|mo|monthly|hour|hr|hourly))?/i,
      // 明确的薪资模式，如 "Salary: $60,000"
      /(?:salary|pay|compensation|wage|income)[\s:]+\$[\d,]+(?:\s*-\s*\$?[\d,]+)?/i,
      // 年薪模式，如 "$60,000/year" 或 "$60,000 annually"
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?\s*(?:\/|\s+)(?:year|yr|annually|annual)/i,
      // 月薪模式，如 "$5,000/month" 或 "$5,000 monthly"
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?\s*(?:\/|\s+)(?:month|mo|monthly)/i,
      // 时薪模式，如 "$25/hour" 或 "$25 hourly"
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?\s*(?:\/|\s+)(?:hour|hr|hourly)/i,
      // 欧元薪资
      /(?:salary|pay|compensation|wage|income|earn|earning|earnings)[\s:]*€[\d,]+(?:\s*-\s*€?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|annual|month|mo|monthly|hour|hr|hourly))?/i,
      /€[\d,]+(?:\s*-\s*€?[\d,]+)?\s*(?:\/|\s+)(?:year|yr|annually|annual|month|mo|monthly|hour|hr|hourly)/i,
      // 英镑薪资
      /(?:salary|pay|compensation|wage|income|earn|earning|earnings)[\s:]*£[\d,]+(?:\s*-\s*£?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|annual|month|mo|monthly|hour|hr|hourly))?/i,
      /£[\d,]+(?:\s*-\s*£?[\d,]+)?\s*(?:\/|\s+)(?:year|yr|annually|annual|month|mo|monthly|hour|hr|hourly)/i
    ];

    const text = `${title} ${description}`;

    // 排除明显不是薪资的上下文
    const excludePatterns = [
      /\$[\d,]+\s*(?:million|billion|k|thousand)\s*(?:company|business|startup|funding|investment|valuation|revenue)/i,
      /\$[\d,]+\s*(?:in|of)\s*(?:funding|investment|revenue|sales)/i,
      /\$[\d,]+\s*(?:raised|funded|invested)/i
    ];

    // 检查是否匹配排除模式
    for (const excludePattern of excludePatterns) {
      if (excludePattern.test(text)) {
        return '';
      }
    }

    // 检查薪资模式
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        const salaryText = match[0].trim();

        // 进一步验证：确保薪资数字在合理范围内
        const numbers = salaryText.match(/\d+/g);
        if (numbers) {
          const amount = parseInt(numbers[0]);
          // 排除明显不合理的薪资数字（如 $1, $2 等）
          if (amount >= 1000 || salaryText.toLowerCase().includes('hour')) {
            return salaryText;
          }
        }
      }
    }

    return '';
  }

  /**
   * 从标题或描述中提取工作类型
   */
  private extractJobType(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('full-time') || text.includes('full time')) return 'full-time';
    if (text.includes('part-time') || text.includes('part time')) return 'part-time';
    if (text.includes('contract') || text.includes('contractor')) return 'contract';
    if (text.includes('freelance') || text.includes('freelancer')) return 'freelance';
    if (text.includes('intern') || text.includes('internship')) return 'internship';

    return 'full-time'; // 默认值
  }

  /**
   * 从标题或描述中提取工作方式（远程/混合/现场）
   */
  private extractWorkType(title: string, description: string): 'remote' | 'hybrid' | 'onsite' {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
      return 'remote';
    }
    if (text.includes('hybrid') || text.includes('flexible')) {
      return 'hybrid';
    }
    if (text.includes('onsite') || text.includes('on-site') || text.includes('office')) {
      return 'onsite';
    }

    // 默认为远程，因为大部分RSS源都是远程工作
    return 'remote';
  }

  /**
   * 从标题或描述中提取经验级别
   */
  private extractExperienceLevel(title: string, description: string): 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' {
    const text = `${title} ${description}`.toLowerCase();

    if (text.includes('senior') || text.includes('sr.') || text.includes('lead')) {
      return 'Senior';
    }
    if (text.includes('junior') || text.includes('jr.') || text.includes('entry') || text.includes('graduate')) {
      return 'Entry';
    }
    if (text.includes('principal') || text.includes('staff') || text.includes('architect')) {
      return 'Lead';
    }
    if (text.includes('director') || text.includes('vp') || text.includes('head of') || text.includes('chief')) {
      return 'Executive';
    }

    return 'Mid'; // 默认值
  }

  /**
   * 提取远程工作的地点限制
   */
  private extractRemoteLocationRestriction(title: string, description: string): string {
    const text = (title + ' ' + description).toLowerCase();

    // 优先检查明确的地理限制表述
    const explicitRestrictions = [
      // 美国相关
      { patterns: ['us only', 'usa only', 'united states only', 'us citizens only', 'us residents only', 'american citizens only', 'must be us citizen', 'must be in us', 'us-based only', 'usa-based only'], result: '仅限美国' },

      // 欧盟相关
      { patterns: ['eu only', 'europe only', 'european union only', 'eu citizens only', 'eu residents only', 'european citizens only', 'must be eu citizen', 'must be in eu', 'eu-based only', 'europe-based only'], result: '仅限欧盟' },

      // 英国相关
      { patterns: ['uk only', 'united kingdom only', 'britain only', 'uk citizens only', 'uk residents only', 'british citizens only', 'must be uk citizen', 'must be in uk', 'uk-based only'], result: '仅限英国' },

      // 加拿大相关
      { patterns: ['canada only', 'canadian citizens only', 'canadian residents only', 'must be canadian citizen', 'must be in canada', 'canada-based only'], result: '仅限加拿大' },

      // 澳大利亚相关
      { patterns: ['australia only', 'australian citizens only', 'australian residents only', 'must be australian citizen', 'must be in australia', 'australia-based only'], result: '仅限澳大利亚' },

      // 德国相关
      { patterns: ['germany only', 'german citizens only', 'german residents only', 'must be in germany', 'germany-based only'], result: '仅限德国' },

      // 法国相关
      { patterns: ['france only', 'french citizens only', 'french residents only', 'must be in france', 'france-based only'], result: '仅限法国' },

      // 荷兰相关
      { patterns: ['netherlands only', 'dutch citizens only', 'dutch residents only', 'must be in netherlands', 'netherlands-based only'], result: '仅限荷兰' },

      // 日本相关
      { patterns: ['japan only', 'japanese citizens only', 'japanese residents only', 'must be in japan', 'japan-based only'], result: '仅限日本' },

      // 新加坡相关
      { patterns: ['singapore only', 'singaporean citizens only', 'singaporean residents only', 'must be in singapore', 'singapore-based only'], result: '仅限新加坡' },

      // 印度相关
      { patterns: ['india only', 'indian citizens only', 'indian residents only', 'must be in india', 'india-based only'], result: '仅限印度' },

      // 巴西相关
      { patterns: ['brazil only', 'brazilian citizens only', 'brazilian residents only', 'must be in brazil', 'brazil-based only'], result: '仅限巴西' },

      // 墨西哥相关
      { patterns: ['mexico only', 'mexican citizens only', 'mexican residents only', 'must be in mexico', 'mexico-based only'], result: '仅限墨西哥' },

      // 全球远程
      { patterns: ['worldwide', 'global remote', 'anywhere in the world', 'no location restriction', 'work from anywhere', 'remote worldwide', 'globally remote'], result: '全球远程' }
    ];

    // 检查明确的限制表述
    for (const restriction of explicitRestrictions) {
      for (const pattern of restriction.patterns) {
        if (text.includes(pattern)) {
          return restriction.result;
        }
      }
    }

    // 检查更复杂的地理限制模式
    const advancedPatterns = [
      // 地点限制模式
      { pattern: /(?:remote )?(?:location|position|job|work)(?:\s+is)?\s*(?:restricted to|limited to|only in|exclusively in)\s*([^,.\n]+)/i, prefix: '仅限' },
      { pattern: /(?:must|need|required to)\s+(?:be\s+)?(?:located|based|residing)\s+in\s+([^,.\n]+)/i, prefix: '仅限' },
      { pattern: /(?:candidates|applicants)\s+(?:must\s+)?(?:be\s+)?(?:from|in|based in)\s+([^,.\n]+)/i, prefix: '仅限' },
      { pattern: /(?:only\s+)?(?:accepting|considering)\s+(?:candidates|applicants)\s+(?:from|in)\s+([^,.\n]+)/i, prefix: '仅限' },
      { pattern: /(?:remote\s+)?(?:work|position)\s+(?:available|open)\s+(?:only\s+)?(?:to|for)\s+(?:candidates\s+)?(?:from|in)\s+([^,.\n]+)/i, prefix: '仅限' },

      // 时区限制模式
      { pattern: /(?:must|need|required to)\s+(?:be\s+)?(?:available|work)\s+(?:in|during)\s+([^,.\n]*(?:timezone|time zone|tz))/i, prefix: '' },
      { pattern: /(?:working|work)\s+hours?\s*:\s*([^,.\n]*(?:timezone|time zone|tz|est|pst|cet|utc|gmt))/i, prefix: '' },

      // 特定地区组合
      { pattern: /(?:us|usa|united states)\s*(?:and|or|\+|\/)\s*(?:canada|canadian)/i, result: '北美地区' },
      { pattern: /(?:europe|eu|european union)\s*(?:and|or|\+|\/)\s*(?:uk|united kingdom)/i, result: '欧洲地区' },
      { pattern: /(?:asia|asian)\s+(?:countries|region|timezone)/i, result: '亚洲地区' },
      { pattern: /(?:latin america|south america|latam)/i, result: '拉美地区' }
    ];

    for (const { pattern, prefix, result } of advancedPatterns) {
      const match = text.match(pattern);
      if (match) {
        if (result) {
          return result;
        }

        const location = match[1]?.trim();
        if (location && !this.isGenericLocation(location)) {
          // 标准化地名
          const standardized = this.standardizeLocationName(location);
          return prefix ? `${prefix}${standardized}` : standardized;
        }
      }
    }

    // 检查时区限制（更精确的匹配）
    const timezonePatterns = [
      { patterns: ['est', 'eastern time', 'eastern standard time', 'eastern daylight time', 'et timezone'], result: '东部时区' },
      { patterns: ['pst', 'pacific time', 'pacific standard time', 'pacific daylight time', 'pt timezone'], result: '太平洋时区' },
      { patterns: ['cet', 'central european time', 'cest', 'central european summer time'], result: '中欧时区' },
      { patterns: ['utc', 'gmt', 'coordinated universal time', 'greenwich mean time'], result: 'UTC时区' },
      { patterns: ['cst', 'central standard time', 'central time'], result: '中部时区' },
      { patterns: ['mst', 'mountain standard time', 'mountain time'], result: '山地时区' }
    ];

    for (const { patterns, result } of timezonePatterns) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          return result;
        }
      }
    }

    // 如果没有找到特定限制，但明确提到了远程工作，返回全球远程
    if (this.isRemoteJob(text) && !this.hasLocationRestriction(text)) {
      return '全球远程';
    }

    // 默认返回空字符串
    return '';
  }

  /**
   * 检查是否为通用地点词汇
   */
  private isGenericLocation(location: string): boolean {
    const genericTerms = [
      'remote', 'anywhere', 'worldwide', 'global', 'any', 'flexible',
      'distributed', 'virtual', 'online', 'digital', 'internet'
    ];
    return genericTerms.some(term => location.toLowerCase().includes(term));
  }

  /**
   * 标准化地名
   */
  private standardizeLocationName(location: string): string {
    const locationMap: { [key: string]: string } = {
      'us': '美国',
      'usa': '美国',
      'united states': '美国',
      'america': '美国',
      'eu': '欧盟',
      'europe': '欧洲',
      'european union': '欧盟',
      'uk': '英国',
      'united kingdom': '英国',
      'britain': '英国',
      'canada': '加拿大',
      'australia': '澳大利亚',
      'germany': '德国',
      'france': '法国',
      'netherlands': '荷兰',
      'japan': '日本',
      'singapore': '新加坡',
      'india': '印度',
      'brazil': '巴西',
      'mexico': '墨西哥'
    };

    const normalized = location.toLowerCase().trim();
    return locationMap[normalized] || location.trim();
  }

  /**
   * 检查是否为远程工作
   */
  private isRemoteJob(text: string): boolean {
    const remoteKeywords = [
      'remote', 'work from home', 'wfh', 'telecommute', 'distributed',
      'virtual', 'home-based', 'location independent'
    ];
    return remoteKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 检查是否有地点限制
   */
  private hasLocationRestriction(text: string): boolean {
    const restrictionKeywords = [
      'only', 'must be', 'required to be', 'based in', 'located in',
      'residents', 'citizens', 'timezone', 'time zone'
    ];
    return restrictionKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * 解析薪资范围
   */
  private parseSalaryRange(salaryText: string): { min?: number; max?: number; currency?: string; period?: 'hourly' | 'monthly' | 'yearly' } | undefined {
    if (!salaryText) return undefined;

    const result: { min?: number; max?: number; currency?: string; period?: 'hourly' | 'monthly' | 'yearly' } = {};

    // 提取货币符号
    if (salaryText.includes('$')) result.currency = 'USD';
    else if (salaryText.includes('€')) result.currency = 'EUR';
    else if (salaryText.includes('£')) result.currency = 'GBP';
    else result.currency = 'USD'; // 默认

    // 提取时间周期
    if (salaryText.toLowerCase().includes('hour') || salaryText.toLowerCase().includes('hr')) {
      result.period = 'hourly';
    } else if (salaryText.toLowerCase().includes('month') || salaryText.toLowerCase().includes('mo')) {
      result.period = 'monthly';
    } else {
      result.period = 'yearly'; // 默认
    }

    // 提取数字范围
    const numberPattern = /[\d,]+/g;
    const numbers = salaryText.match(numberPattern);

    if (numbers && numbers.length > 0) {
      const cleanNumbers = numbers.map(n => parseInt(n.replace(/,/g, '')));

      if (cleanNumbers.length === 1) {
        result.min = cleanNumbers[0];
        result.max = cleanNumbers[0];
      } else if (cleanNumbers.length >= 2) {
        result.min = Math.min(...cleanNumbers);
        result.max = Math.max(...cleanNumbers);
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }

  /**
   * 获取并解析所有RSS源的数据
   */
  async fetchAllRSSFeeds(): Promise<ParsedRSSData[]> {
    const results: ParsedRSSData[] = [];
    const batchSize = 3; // 减少并发数量
    const sources = this.RSS_SOURCES;

    console.log(`开始获取 ${sources.length} 个RSS源的数据...`);

    // 分批处理RSS源
    for (let i = 0; i < sources.length; i += batchSize) {
      const batch = sources.slice(i, i + batchSize);
      console.log(`处理第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 个源`);

      const batchPromises = batch.map(async (source) => {
        try {
          console.log(`正在获取 ${source.name} - ${source.category} 的数据...`);
          const xmlData = await this.fetchRSSFeed(source.url);
          const items = this.parseRSSFeed(xmlData, source);

          if (items.length > 0) {
            console.log(`✓ ${source.name} - ${source.category}: 获取到 ${items.length} 个职位`);
            return {
              source: source.name,
              category: source.category,
              items,
              lastUpdated: new Date()
            };
          } else {
            console.warn(`${source.name} - ${source.category}: 未获取到职位数据`);
            return null;
          }
        } catch (error) {
          console.error(`✗ ${source.name} - ${source.category} 获取失败:`, error instanceof Error ? error.message : error);
          return null;
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      // 处理批次结果
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          results.push(result.value);
        }
      });

      // 批次间延迟，避免请求过于频繁
      if (i + batchSize < sources.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`RSS数据获取完成: 成功 ${results.length}/${sources.length} 个源`);

    return results;
  }
}

export const rssService = new RSSService();