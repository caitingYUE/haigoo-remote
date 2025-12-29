import { Job as RSSJob } from '../types/rss-types';

export interface RawJobsResponse {
  jobs: RSSJob[];
  total: number;
  page: number;
  limit: number;
}

export interface RawJobsFilters {
  search?: string;
  source?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

class RawJobsService {
  private baseUrl = '/api/data';

  async getRawJobs(
    page: number = 1,
    limit: number = 20,
    filters: RawJobsFilters = {}
  ): Promise<RawJobsResponse> {
    try {
      const params = new URLSearchParams({
        resource: 'raw-rss',
        page: page.toString(),
        limit: limit.toString(),
        _t: Date.now().toString()
      });

      if (filters.search) params.append('search', filters.search);
      if (filters.source) params.append('source', filters.source);
      if (filters.category) params.append('category', filters.category);
      if (filters.status) params.append('status', filters.status);
      if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.append('dateTo', filters.dateTo);

      const token = localStorage.getItem('haigoo_auth_token');
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseUrl}?${params}`, {
        headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch raw jobs: ${response.status}`);
      }

      const data = await response.json();
      
      // Ensure data structure matches expectation
      // API might return { data: [], total: 0 } or just []
      // Based on raw-rss.js, it seems to return what readRawFromNeon returns
      // readRawFromNeon usually returns { items: [], total: count }
      
      if (data.success === false) {
        throw new Error(data.error || 'Failed to fetch raw jobs');
      }

      return {
        jobs: data.items || data.data || [],
        total: data.total || 0,
        page: data.page || page,
        limit: data.limit || limit
      };
    } catch (error) {
      console.error('RawJobsService Error:', error);
      throw error;
    }
  }
}

export const rawJobsService = new RawJobsService();
