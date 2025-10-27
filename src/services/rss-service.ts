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
    const proxyUrl = process.env.NODE_ENV === 'development' 
      ? `http://localhost:3000/api/rss-proxy?url=${encodeURIComponent(url)}`
      : `/api/rss-proxy?url=${encodeURIComponent(url)}`;

    let response: Response;
    let responseText: string = '';

    try {
      if (process.env.NODE_ENV === 'development') {
        // 开发环境：使用代理，避免CORS问题
        try {
          response = await fetch(proxyUrl, {
            signal: AbortSignal.timeout(15000) // 15秒超时
          });
          
          if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
          }
          
          // 检查响应类型
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            throw new Error(`Proxy error: ${errorData.message || errorData.error}`);
          } else {
            responseText = await response.text();
          }
        } catch (proxyError: unknown) {
          console.error(`Proxy failed for ${url}:`, proxyError instanceof Error ? proxyError.message : proxyError);
          throw proxyError; // 直接抛出错误，不再尝试直接获取
        }
      } else {
        // 生产环境：直接使用代理
        response = await fetch(proxyUrl, {
          signal: AbortSignal.timeout(15000) // 15秒超时
        });
        
        if (!response.ok) {
          throw new Error(`Proxy fetch failed: ${response.status} ${response.statusText}`);
        }
        
        responseText = await response.text();
      }
      
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
        
        if (title && link) {
          const salary = this.extractSalary(title, description);
          
          feedItems.push({
            title,
            description,
            link,
            pubDate,
            category,
            company: this.extractCompany(title, description),
            location: this.extractLocation(title, description),
            salary,
            jobType: this.extractJobType(title, description),
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
    // 简单的公司名称提取逻辑，可以根据实际RSS格式优化
    const companyPatterns = [
      /at\s+([A-Z][a-zA-Z\s&.,-]+?)(?:\s|$)/,
      /\|\s*([A-Z][a-zA-Z\s&.,-]+?)(?:\s*\||$)/,
      /^([A-Z][a-zA-Z\s&.,-]+?)\s*[-:]/
    ];

    for (const pattern of companyPatterns) {
      const match = title.match(pattern) || description.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return '';
  }

  /**
   * 从标题或描述中提取地理位置
   */
  private extractLocation(title: string, description: string): string {
    const locationPatterns = [
      /Remote|Worldwide|Global|Anywhere/i,
      /\b([A-Z][a-z]+,\s*[A-Z]{2,})\b/,
      /\b([A-Z][a-z]+\s*[A-Z][a-z]*,?\s*(?:USA|UK|Canada|Germany|France))\b/i
    ];

    const text = `${title} ${description}`;
    for (const pattern of locationPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
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
   * 从标题或描述中提取远程地点限制
   */
  private extractRemoteLocationRestriction(title: string, description: string): string {
    const text = `${title} ${description}`.toLowerCase();
    
    // 检查是否有地区限制
    if (text.includes('us only') || text.includes('usa only') || text.includes('united states only') || 
        text.includes('us citizens') || text.includes('american citizens') || text.includes('us residents')) {
      return '仅限美国';
    }
    
    if (text.includes('eu only') || text.includes('europe only') || text.includes('european union') || 
        text.includes('eu citizens') || text.includes('european citizens')) {
      return '仅限欧盟';
    }
    
    if (text.includes('uk only') || text.includes('united kingdom only') || text.includes('british citizens')) {
      return '仅限英国';
    }
    
    if (text.includes('canada only') || text.includes('canadian citizens') || text.includes('canadian residents')) {
      return '仅限加拿大';
    }
    
    if (text.includes('australia only') || text.includes('australian citizens') || text.includes('australian residents')) {
      return '仅限澳大利亚';
    }
    
    if (text.includes('brazil only') || text.includes('brazilian citizens') || text.includes('brazilian residents')) {
      return '仅限巴西';
    }
    
    if (text.includes('india only') || text.includes('indian citizens') || text.includes('indian residents')) {
      return '仅限印度';
    }
    
    if (text.includes('germany only') || text.includes('german citizens') || text.includes('german residents')) {
      return '仅限德国';
    }
    
    if (text.includes('france only') || text.includes('french citizens') || text.includes('french residents')) {
      return '仅限法国';
    }
    
    if (text.includes('japan only') || text.includes('japanese citizens') || text.includes('japanese residents')) {
      return '仅限日本';
    }
    
    // 检查时区限制
    if (text.includes('est timezone') || text.includes('eastern time') || text.includes('et timezone')) {
      return '东部时区';
    }
    
    if (text.includes('pst timezone') || text.includes('pacific time') || text.includes('pt timezone')) {
      return '太平洋时区';
    }
    
    if (text.includes('cet timezone') || text.includes('central european time')) {
      return '中欧时区';
    }
    
    if (text.includes('utc timezone') || text.includes('gmt timezone')) {
      return 'UTC时区';
    }
    
    // 检查全球远程
    if (text.includes('worldwide') || text.includes('global') || text.includes('anywhere') || 
        text.includes('any location') || text.includes('no location restriction') || 
        text.includes('remote worldwide') || text.includes('work from anywhere')) {
      return '全球远程';
    }
    
    // 默认返回全球远程
    return '全球远程';
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