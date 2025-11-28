import { CompanyIndustry } from '../types/rss-types';
import { ClassificationService } from './classification-service';
import { ProcessedJobData } from './data-management-service';

export interface Company {
    id: string;
    name: string;
    url?: string;
    description?: string;
    logo?: string;
    industry?: CompanyIndustry;
    tags?: string[];
    source: 'rss' | 'crawler' | 'manual';
    jobCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export class CompanyService {
    /**
     * 从RSS描述中提取企业URL
     * 匹配格式: **URL:** https://example.com
     */
    static extractCompanyUrlFromDescription(description: string): string {
        if (!description) return '';

        // 1. 尝试移除HTML标签，获取纯文本
        const text = description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

        // 2. 定义多种匹配模式
        const patterns = [
            // Markdown风格
            /\*\*URL:\*\*\s*(https?:\/\/[^\s]+)/i,
            /\*URL:\*\s*(https?:\/\/[^\s]+)/i,
            // HTML风格 (如果上面的replace没有完全清除或原始文本就是这样)
            /URL:\s*(https?:\/\/[^\s]+)/i,
            /Website:\s*(https?:\/\/[^\s]+)/i,
            /Company URL:\s*(https?:\/\/[^\s]+)/i,
            // 链接文本可能是 "Apply" 或 "Link" 但我们找的是官网
            // 有些RSS源直接在描述里放了链接
            /Homepage:\s*(https?:\/\/[^\s]+)/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                // 清理URL末尾可能的标点符号
                return match[1].replace(/[.,;)]$/, '');
            }
        }

        // 3. 特殊处理：如果描述中包含 **Headquarters:** ... **URL:** ... 结构
        // 有时候正则可能因为换行符失效，但在移除HTML后应该变成空格了

        // 4. 尝试从HTML中提取 href (如果描述是HTML)
        // 查找包含 "website", "homepage", "company" 的链接
        const linkMatch = description.match(/<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]*(?:website|homepage|company)[^<]*)<\/a>/i);
        if (linkMatch) {
            return linkMatch[1];
        }

        return '';
    }

    /**
     * 从岗位数据中提取企业信息
     */
    static extractCompanyFromJob(job: ProcessedJobData): Partial<Company> {
        const companyUrl = job.companyWebsite ||
            this.extractCompanyUrlFromDescription(job.description || '');

        // 自动分类企业
        const classification = ClassificationService.classifyCompany(
            job.company,
            job.description || ''
        );

        return {
            name: job.company,
            url: companyUrl,
            description: '', // 需要爬取获取
            logo: undefined, // Logo需要单独爬取或手动添加
            industry: classification.industry,
            tags: classification.tags,
            source: job.source as 'rss' | 'crawler' | 'manual',
            jobCount: 1,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    /**
     * 去重企业列表
     * 优先使用URL去重，其次使用公司名称
     */
    static deduplicateCompanies(companies: Partial<Company>[]): Partial<Company>[] {
        const companyMap = new Map<string, Partial<Company>>();

        for (const company of companies) {
            // 生成唯一键：优先使用URL，否则使用标准化的公司名称
            const key = company.url
                ? this.normalizeUrl(company.url)
                : this.normalizeCompanyName(company.name || '');

            if (!key) continue;

            const existing = companyMap.get(key);
            if (existing) {
                // 合并数据，保留更完整的信息
                companyMap.set(key, this.mergeCompanyData(existing, company));
            } else {
                companyMap.set(key, company);
            }
        }

        return Array.from(companyMap.values());
    }

    /**
     * 标准化URL（去除协议和www）
     */
    private static normalizeUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '').toLowerCase();
        } catch {
            return url.toLowerCase();
        }
    }

    /**
     * 标准化公司名称
     */
    private static normalizeCompanyName(name: string): string {
        return name
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[,.\-_]/g, '');
    }

    /**
     * 合并企业数据，保留更完整的信息
     */
    private static mergeCompanyData(
        existing: Partial<Company>,
        newData: Partial<Company>
    ): Partial<Company> {
        return {
            ...existing,
            // 保留更长的描述
            description: (newData.description?.length || 0) > (existing.description?.length || 0)
                ? newData.description
                : existing.description,
            // 保留有logo的
            logo: newData.logo || existing.logo,
            // 保留有URL的
            url: newData.url || existing.url,
            // 合并标签
            tags: Array.from(new Set([...(existing.tags || []), ...(newData.tags || [])])),
            // 累加岗位数量
            jobCount: (existing.jobCount || 0) + (newData.jobCount || 0),
            // 使用最新的更新时间
            updatedAt: new Date()
        };
    }

    /**
     * 从岗位列表中提取所有企业
     */
    static extractCompaniesFromJobs(jobs: ProcessedJobData[]): Company[] {
        const companyPartials = jobs.map(job => this.extractCompanyFromJob(job));
        const deduplicated = this.deduplicateCompanies(companyPartials);

        // 转换为完整的Company对象
        return deduplicated.map((partial, index) => ({
            id: `company_${Date.now()}_${index}`,
            name: partial.name || 'Unknown',
            url: partial.url,
            description: partial.description,
            logo: partial.logo,
            industry: partial.industry || '其他',
            tags: partial.tags || [],
            source: partial.source || 'rss',
            jobCount: partial.jobCount || 0,
            createdAt: partial.createdAt || new Date(),
            updatedAt: partial.updatedAt || new Date()
        }));
    }
    /**
     * 获取企业官网信息（Logo、简介）
     */
    static async fetchCompanyInfo(url: string): Promise<{ logo?: string; description?: string; title?: string }> {
        try {
            const response = await fetch(`/api/crawler/company-info?url=${encodeURIComponent(url)}`);
            if (!response.ok) {
                throw new Error('Failed to fetch company info');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching company info:', error);
            return {};
        }
    }
}

export const companyService = new CompanyService();
