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
    try {
      // 在开发环境中，直接尝试获取RSS
      // 在生产环境中，使用代理服务
      const isDevelopment = import.meta.env.DEV;
      const proxyUrl = isDevelopment 
        ? `/api/rss-proxy?url=${encodeURIComponent(url)}`
        : `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      
      let response: Response;
      let responseText: string;
      
      if (isDevelopment) {
        // 开发环境：先尝试直接获取，失败则使用代理
        try {
          response = await fetch(url, {
            headers: {
              'User-Agent': 'Haigoo Job Aggregator/1.0',
              'Accept': 'application/rss+xml, application/xml, text/xml'
            }
          });
          
          if (!response.ok) {
            throw new Error(`Direct fetch failed: ${response.status}`);
          }
          
          responseText = await response.text();
        } catch (directError) {
          console.log(`Direct fetch failed for ${url}, trying proxy...`);
          
          // 使用公共CORS代理作为备选
          response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
          
          if (!response.ok) {
            throw new Error(`Proxy fetch failed: ${response.status}`);
          }
          
          const proxyData = await response.json();
          responseText = proxyData.contents;
        }
      } else {
        // 生产环境：使用代理服务
        response = await fetch(proxyUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // 检查是否是JSON响应（来自allorigins）
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const proxyData = await response.json();
          responseText = proxyData.contents;
        } else {
          responseText = await response.text();
        }
      }
      
      return responseText;
    } catch (error) {
      console.error(`Error fetching RSS feed from ${url}:`, error);
      throw error;
    }
  }

  /**
   * 解析RSS XML数据
   */
  parseRSSFeed(xmlData: string, source: RSSSource): RSSFeedItem[] {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      // 检查解析错误
      const parseError = xmlDoc.querySelector('parsererror');
      if (parseError) {
        throw new Error('XML parsing error');
      }

      const items = xmlDoc.querySelectorAll('item');
      const feedItems: RSSFeedItem[] = [];

      items.forEach(item => {
        const title = item.querySelector('title')?.textContent?.trim() || '';
        const description = item.querySelector('description')?.textContent?.trim() || '';
        const link = item.querySelector('link')?.textContent?.trim() || '';
        const pubDate = item.querySelector('pubDate')?.textContent?.trim() || '';
        
        // 尝试从不同字段提取额外信息
        const category = item.querySelector('category')?.textContent?.trim() || source.category;
        
        if (title && link) {
          feedItems.push({
            title,
            description,
            link,
            pubDate,
            category,
            company: this.extractCompany(title, description),
            location: this.extractLocation(title, description),
            salary: this.extractSalary(title, description),
            jobType: this.extractJobType(title, description)
          });
        }
      });

      return feedItems;
    } catch (error) {
      console.error('Error parsing RSS feed:', error);
      return [];
    }
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
    
    if (text.includes('full-time') || text.includes('full time')) return 'Full-time';
    if (text.includes('part-time') || text.includes('part time')) return 'Part-time';
    if (text.includes('contract') || text.includes('contractor')) return 'Contract';
    if (text.includes('freelance') || text.includes('freelancer')) return 'Freelance';
    if (text.includes('intern') || text.includes('internship')) return 'Internship';
    
    return 'Full-time'; // 默认值
  }

  /**
   * 获取并解析所有RSS源的数据
   */
  async fetchAllRSSFeeds(): Promise<ParsedRSSData[]> {
    const results: ParsedRSSData[] = [];
    
    for (const source of this.RSS_SOURCES) {
      try {
        console.log(`Fetching RSS feed from ${source.name} - ${source.category}`);
        const xmlData = await this.fetchRSSFeed(source.url);
        const items = this.parseRSSFeed(xmlData, source);
        
        results.push({
          source: source.name,
          category: source.category,
          items,
          lastUpdated: new Date()
        });
        
        // 添加延迟以避免过于频繁的请求
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch RSS feed from ${source.name} - ${source.category}:`, error);
      }
    }
    
    return results;
  }
}

export const rssService = new RSSService();