// Helper to get token from storage
const getAuthToken = () => {
    if (typeof window !== 'undefined') {
        return localStorage.getItem('haigoo_auth_token') || ''
    }
    return ''
}

import { CompanyIndustry, CompanyTag } from '../types/rss-types';

export interface TrustedCompany {
    id: string;
    name: string;
    website: string;
    careersPage: string;
    linkedin?: string;
    description?: string;
    logo?: string;
    coverImage?: string;
    address?: string;
    employeeCount?: string;
    foundedYear?: string;
    specialties?: string[];
    companyRating?: string;
    ratingSource?: string;
    aliases?: string[]; // Alternative names for matching
    tags?: CompanyTag[];
    industry?: CompanyIndustry;
    isTrusted: boolean;
    canRefer: boolean;
    jobCount?: number;
    lastCrawledAt?: string; // New field
    createdAt: string;
    updatedAt: string;
}

export interface PaginatedCompaniesResponse {
    companies: TrustedCompany[];
    total: number;
    page: number;
    totalPages: number;
}

export interface CompanyWithJobStats extends TrustedCompany {
    jobCategories?: Record<string, number>;
}

export interface CompanyMetadata {
    title: string;
    description: string;
    image: string;
    icon: string;
    address?: string;
    _source?: string;
    _fallbackUrl?: string;
}

class TrustedCompaniesService {
    private API_BASE = '/api/data';

    async getAllCompanies(): Promise<TrustedCompany[]>;
    async getAllCompanies(params: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        industry?: string;
        search?: string;
        canRefer?: 'all' | 'yes' | 'no';
    }): Promise<PaginatedCompaniesResponse | TrustedCompany[]>;
    async getAllCompanies(params?: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        industry?: string;
        search?: string;
        canRefer?: 'all' | 'yes' | 'no';
    }): Promise<any> {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('resource', 'companies'); // Match api/data.js logic
            // queryParams.append('target', 'companies'); // Remove target param as api/data.js handles routing via resource
            queryParams.append('_t', Date.now().toString());
            
            if (params) {
                if (params.page) queryParams.append('page', params.page.toString());
                if (params.limit) queryParams.append('limit', params.limit.toString());
                if (params.sortBy) queryParams.append('sortBy', params.sortBy);
                if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
                if (params.industry && params.industry !== 'all') queryParams.append('industry', params.industry);
                if (params.search) queryParams.append('search', params.search);
                if (params.canRefer && params.canRefer !== 'all') queryParams.append('canRefer', params.canRefer);
            }

            const response = await fetch(`${this.API_BASE}?${queryParams.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch companies');
            const data = await response.json();
            
            // Check for success flag in standard API response wrapper
            if (data.success === false) {
                 throw new Error(data.error || 'Failed to fetch companies');
            }

            // Handle both wrapped response ({ success: true, companies: [...] }) and direct response
            const responseData = data.success && data.companies ? data : data;
            
            // If paginated response
            if (responseData.total !== undefined) {
                return responseData;
            }
            
            // If array wrapped in object
            if (responseData.companies && Array.isArray(responseData.companies)) {
                return responseData.companies;
            }

            // If direct array
            if (Array.isArray(responseData)) {
                return responseData;
            }

            return [];
        } catch (error) {
            console.error('Error fetching trusted companies:', error);
            throw error;
        }
    }

    // 获取带职位统计信息的公司列表（后端联表查询）
    async getCompaniesWithJobStats(params: {
        page?: number;
        limit?: number;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        industry?: string;
        search?: string;
        canRefer?: 'all' | 'yes' | 'no';
        region?: string;
    }): Promise<PaginatedCompaniesResponse> {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('target', 'trusted_companies_with_jobs_info');
            queryParams.append('_t', Date.now().toString());
            
            if (params.page) queryParams.append('page', params.page.toString());
            if (params.limit) queryParams.append('limit', params.limit.toString());
            if (params.sortBy) queryParams.append('sortBy', params.sortBy);
            if (params.sortOrder) queryParams.append('sortOrder', params.sortOrder);
            if (params.industry && params.industry !== 'all') queryParams.append('industry', params.industry);
            if (params.search) queryParams.append('search', params.search);
            if (params.canRefer && params.canRefer !== 'all') queryParams.append('canRefer', params.canRefer);
            if (params.region) queryParams.append('region', params.region);

            const response = await fetch(`${this.API_BASE}?${queryParams.toString()}`);
            if (!response.ok) throw new Error('Failed to fetch companies with job stats');
            const data = await response.json();
            
            return data;
        } catch (error) {
            console.error('Error fetching companies with job stats:', error);
            return { companies: [], total: 0, page: 1, totalPages: 0 };
        }
    }

    async getCompanyById(id: string): Promise<TrustedCompany | null> {
        try {
            const response = await fetch(`${this.API_BASE}?id=${id}`);
            if (!response.ok) throw new Error('Failed to fetch company');
            const data = await response.json();
            return data.company || null;
        } catch (error) {
            console.error('Error fetching company:', error);
            return null;
        }
    }

    async saveCompany(company: Partial<TrustedCompany>): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_BASE}?target=companies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                },
                body: JSON.stringify(company)
            });
            return response.ok;
        } catch (error) {
            console.error('Error saving company:', error);
            return false;
        }
    }

    async deleteCompany(id: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.API_BASE}?id=${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error deleting company:', error);
            return false;
        }
    }

    async fetchMetadata(url: string): Promise<CompanyMetadata | null> {
        try {
            const response = await fetch(`${this.API_BASE}?action=crawl`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                },
                body: JSON.stringify({ url })
            });
            if (!response.ok) throw new Error('Failed to fetch metadata');
            const data = await response.json();
            return data.metadata || null;
        } catch (error) {
            console.error('Error fetching metadata:', error);
            return null;
        }
    }

    async crawlJobs(companyId: string, fetchDetails: boolean = false, maxDetails: number = 10): Promise<{ success: boolean; count?: number; error?: string }> {
        try {
            const response = await fetch(`${this.API_BASE}?action=crawl-jobs&id=${companyId}&fetchDetails=${fetchDetails}&maxDetails=${maxDetails}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to crawl jobs');
            return { success: true, count: data.count };
        } catch (error) {
            console.error('Error crawling jobs:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async syncJobsToProduction(): Promise<{ success: boolean; count?: number; error?: string }> {
        try {
            const response = await fetch(`${this.API_BASE}?action=sync-jobs`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to sync jobs');
            return { success: true, count: data.updatedCount };
        } catch (error) {
            console.error('Error syncing jobs:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }

    async aggregateCompanies(): Promise<{ success: boolean; count?: number; message?: string; error?: string }> {
        try {
            const response = await fetch(`${this.API_BASE}?action=aggregate-companies`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('haigoo_auth_token')}`
                }
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to aggregate companies');
            return { success: true, count: data.count, message: data.message };
        } catch (error) {
            console.error('Error aggregating companies:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }
}

export const trustedCompaniesService = new TrustedCompaniesService();
