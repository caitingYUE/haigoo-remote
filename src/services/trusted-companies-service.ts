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
    tags?: CompanyTag[];
    industry?: CompanyIndustry;
    isTrusted: boolean;
    canRefer: boolean;
    createdAt: string;
    updatedAt: string;
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
    private API_BASE = '/api/data/trusted-companies';

    async getAllCompanies(): Promise<TrustedCompany[]> {
        try {
            const response = await fetch(this.API_BASE);
            if (!response.ok) throw new Error('Failed to fetch companies');
            const data = await response.json();
            return data.companies || [];
        } catch (error) {
            console.error('Error fetching trusted companies:', error);
            return [];
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
            const response = await fetch(this.API_BASE, {
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
                method: 'GET', // The handler checks req.query.action, usually GET for simple triggers or POST. The handler code uses req.query.action inside GET block? Let's check handler.
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
}

export const trustedCompaniesService = new TrustedCompaniesService();
