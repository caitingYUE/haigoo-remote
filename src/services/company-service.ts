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

        // 匹配 **URL:** 后面的URL
        const urlMatch = description.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s\n]+)/i);
        if (urlMatch) {
            return urlMatch[1].trim();
        }

        // 备用匹配：**Headquarters:** 后面可能包含URL
        const hqMatch = description.match(/\*\*Headquarters:\*\*[^\n]*?(https?:\/\/[^\s\n]+)/i);
        if (hqMatch) {
            return hqMatch[1].trim();
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
            logo: job.companyLogo,
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
}

export const companyService = new CompanyService();
