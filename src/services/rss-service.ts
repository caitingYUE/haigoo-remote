import { Job, RSSSource, JobCategory } from '../types/rss-types.js';

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
    let response: Response;
    let responseText: string = '';

    try {
      // 根据环境选择代理服务
      const baseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3001' 
        : 'https://haigoo.vercel.app';
      
      const proxyUrl = `${baseUrl}/api/rss-proxy?url=${encodeURIComponent(url)}`;
      console.log(`Fetching RSS via Vercel proxy: ${proxyUrl}`);
      
      response = await fetch(proxyUrl, {
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
      if (!responseText.trim().startsWith('<?xml') && !responseText.trim().startsWith('<rss') && !responseText.trim().startsWith('<feed')) {
        throw new Error('Response is not valid XML/RSS format');
      }
      
      return responseText;
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Failed to fetch RSS from ${url}:`, errorMessage);
      throw new Error(`RSS fetch failed: ${errorMessage}`);
    }
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
      const xmlDoc = parser.parseFromString(cleanedXmlData, 'text/xml');
      
      // 检查解析错误
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        console.error('XML parsing error:', parseError.textContent);
        // 尝试使用application/xml MIME类型重新解析
        const xmlDoc2 = parser.parseFromString(cleanedXmlData, 'application/xml');
        const parseError2 = xmlDoc2.querySelector('parsererror');
        if (parseError2) {
          throw new Error(`XML parsing error: ${parseError.textContent}`);
        }
        // 如果第二次解析成功，使用第二次的结果
        return this.extractItemsFromXmlDoc(xmlDoc2, source);
      }

      return this.extractItemsFromXmlDoc(xmlDoc, source);
    } catch (error) {
      console.error('Error parsing RSS feed from', source.name, ':', error);
      console.error('XML data preview:', xmlData.substring(0, 500));
      return [];
    }
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
        
        // 尝试从不同字段提取额外信息
        const category = item.querySelector('category')?.textContent?.trim() || source.category;
        
        // 优先从专门的XML字段提取信息（特别是Remotive源）
        let company = item.querySelector('company')?.textContent?.trim() || '';
        let location = item.querySelector('location')?.textContent?.trim() || '';
        let jobType = item.querySelector('type')?.textContent?.trim() || '';
        
        // 如果专门字段没有信息，则从标题和描述中提取
        if (!company) {
          company = this.extractCompany(title, description);
        }
        if (!location) {
          location = this.extractLocation(title, description);
        }
        if (!jobType) {
          jobType = this.extractJobType(title, description);
        }
        
        if (title && link) {
          const salary = this.extractSalary(title, description);
          
          feedItems.push({
            title,
            description,
            link,
            pubDate,
            category,
            company,
            location,
            salary,
            jobType,
            workType: this.extractWorkType(title, description),
            experienceLevel: this.extractExperienceLevel(title, description),
            salaryRange: this.parseSalaryRange(salary),
            remoteLocationRestriction: this.extractRemoteLocationRestriction(title, description)
          });
        }
      } catch (itemError) {
        console.warn('Error processing RSS item:', itemError);
      }
    });

    return feedItems;
  }

  /**
   * 清理和格式化职位描述
   */
  private cleanDescription(description: string): string {
    if (!description) return '';
    
    // 移除HTML标签
    let cleaned = description.replace(/<[^>]*>/g, '');
    
    // 解码HTML实体
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
    
    Object.entries(htmlEntities).forEach(([entity, char]) => {
      cleaned = cleaned.replace(new RegExp(entity, 'g'), char);
    });
    
    // 清理多余的空白字符
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // 限制描述长度，避免过长的内容
    if (cleaned.length > 500) {
      cleaned = cleaned.substring(0, 497) + '...';
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
      /at\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 管道分隔：Job Title | Company Name
      /\|\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*\||$)/,
      // 冒号分隔：Job Title: Company Name
      /:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/,
      // 破折号分隔：Job Title - Company Name
      /\s-\s([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/,
      // 开头格式：Company Name - Job Title
      /^([A-Z][a-zA-Z\s&.,-]+?)\s*[-:]/,
      // 括号格式：Job Title (Company Name)
      /\(([A-Z][a-zA-Z\s&.,-]+?)\)/,
      // @符号格式：Job Title @Company Name
      /@\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 描述中的公司名称：Company: Company Name
      /company:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[.\n]|$)/i,
      // 描述中的雇主：Employer: Company Name
      /employer:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[.\n]|$)/i,
      // 描述中的组织：Organization: Company Name
      /organization:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[.\n]|$)/i,
      // 描述中的客户端：Client: Company Name
      /client:\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[.\n]|$)/i,
      // 工作地点格式：Job Title - Remote at Company Name
      /remote\s+at\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s*[-|•]|\s*$)/i,
      // 位置格式：Job Title - Location - Company Name
      /\s-\s[A-Za-z\s,]+\s-\s([A-Z][a-zA-Z\s&.,-]+?)(?:\s*$)/,
      // 简单的大写字母开头的词组
      /\b([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*){1,3})\b/
    ];

    // 首先尝试从标题中提取
    for (const pattern of companyPatterns.slice(0, -1)) { // 排除最后一个通用模式
      const match = title.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        // 过滤掉常见的非公司名称
        if (!this.isCommonNonCompanyWord(company)) {
          return company;
        }
      }
    }

    // 然后尝试从描述中提取
    for (const pattern of companyPatterns.slice(0, -1)) {
      const match = description.match(pattern);
      if (match && match[1]) {
        const company = match[1].trim();
        if (!this.isCommonNonCompanyWord(company)) {
          return company;
        }
      }
    }

    // 最后使用通用模式作为备选
    const generalPattern = companyPatterns[companyPatterns.length - 1];
    const matches = title.match(new RegExp(generalPattern, 'g'));
    if (matches) {
      for (const match of matches) {
        const company = match.trim();
        if (company.length > 2 && !this.isCommonNonCompanyWord(company)) {
          return company;
        }
      }
    }

    return '';
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
      'the', 'and', 'or', 'but', 'for', 'with', 'without', 'from', 'to'
    ];
    
    return commonWords.includes(word.toLowerCase()) || word.length < 2;
  }

  /**
   * 从标题或描述中提取地理位置
   */
  private extractLocation(title: string, description: string): string {
    const locationPatterns = [
      // 通用远程工作关键词
      /Remote|Worldwide|Global|Anywhere/i,
      // 国家名称（包括Philippines等）
      /\b(Philippines|Singapore|Malaysia|Thailand|Vietnam|Indonesia|India|China|Japan|Korea|Australia|New Zealand)\b/i,
      // 城市,国家格式
      /\b([A-Z][a-z]+,\s*[A-Z]{2,})\b/,
      // 城市 国家格式（包含常见国家）
      /\b([A-Z][a-z]+\s*[A-Z][a-z]*,?\s*(?:USA|UK|Canada|Germany|France|Australia|Netherlands|Spain|Italy|Brazil|Mexico|Argentina))\b/i,
      // 美国州名格式
      /\b([A-Z][a-z]+,\s*(?:CA|NY|TX|FL|WA|IL|PA|OH|GA|NC|MI|NJ|VA|AZ|MA|TN|IN|MO|MD|WI|CO|MN|SC|AL|LA|KY|OR|OK|CT|UT|IA|NV|AR|MS|KS|NM|NE|WV|ID|HI|NH|ME|MT|RI|DE|SD|ND|AK|VT|WY))\b/,
      // 欧洲国家
      /\b(United Kingdom|England|Scotland|Wales|Ireland|France|Germany|Spain|Italy|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czech Republic|Hungary|Portugal|Greece)\b/i,
      // 亚洲国家和地区
      /\b(Hong Kong|Taiwan|South Korea|North Korea|Bangladesh|Pakistan|Sri Lanka|Myanmar|Cambodia|Laos|Brunei|Maldives|Nepal|Bhutan|Afghanistan|Mongolia)\b/i,
      // 其他地区
      /\b(Remote - .*|Location: .*|Based in .*)\b/i
    ];

    const text = `${title} ${description}`;
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        let location = match[0].trim();
        // 清理格式
        location = location.replace(/^(Remote - |Location: |Based in )/i, '');
        return location;
      }
    }

    return 'Remote';
  }

  /**
   * 从标题或描述中提取薪资信息
   */
  private extractSalary(title: string, description: string): string {
    const salaryPatterns = [
      /\$[\d,]+(?:\s*-\s*\$?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|month|mo|hour|hr))?/i,
      /€[\d,]+(?:\s*-\s*€?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|month|mo|hour|hr))?/i,
      /£[\d,]+(?:\s*-\s*£?[\d,]+)?(?:\s*\/?\s*(?:year|yr|annually|month|mo|hour|hr))?/i
    ];

    const text = `${title} ${description}`;
    for (const pattern of salaryPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
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
      console.log(`处理第 ${Math.floor(i/batchSize) + 1} 批，共 ${batch.length} 个源`);
      
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
            console.warn(`⚠ ${source.name} - ${source.category}: 未获取到职位数据`);
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