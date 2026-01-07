import { RSSSource } from '../types/rss-types.js';

class RSSService {
  private RSS_SOURCES: RSSSource[] = [];

  constructor() {
    // Initial load will be triggered by components
  }

  /**
   * 从后端刷新RSS源配置
   */
  async refreshSources(): Promise<RSSSource[]> {
    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch('/api/admin-ops?action=rss_sources', {
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            // Map DB fields to RSSSource type
            this.RSS_SOURCES = data.data.map((item: any) => ({
                id: item.id,
                name: item.name,
                category: item.category,
                url: item.url,
                isActive: item.is_active
            }));
        }
      }
    } catch (e) {
      console.error('Failed to refresh RSS sources', e);
    }
    return this.RSS_SOURCES;
  }

  /**
   * 获取所有RSS源 (Synchronous, requires refreshSources called before)
   */
  getRSSSources(): RSSSource[] {
    return this.RSS_SOURCES;
  }

  /**
   * 添加RSS源
   */
  async addRSSSource(source: RSSSource): Promise<void> {
    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch('/api/admin-ops?action=rss_sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
            name: source.name,
            url: source.url,
            category: source.category,
            is_active: source.isActive ?? true
        })
      });
      
      if (res.ok) {
        await this.refreshSources();
      } else {
        throw new Error('Failed to add RSS source');
      }
    } catch (e) {
      console.error('Error adding RSS source', e);
      throw e;
    }
  }

  /**
   * 更新RSS源
   */
  async updateRSSSource(index: number, source: RSSSource): Promise<void> {
    // We need the ID to update. The index is less reliable if list changed, 
    // but assuming index matches current this.RSS_SOURCES[index].
    const current = this.RSS_SOURCES[index];
    if (!current || !current.id) {
        console.error('Cannot update source without ID');
        return;
    }

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch(`/api/rss-sources?id=${current.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`
        },
        body: JSON.stringify({
            name: source.name,
            url: source.url,
            category: source.category,
            is_active: source.isActive
        })
      });
      
      if (res.ok) {
        await this.refreshSources();
      } else {
        throw new Error('Failed to update RSS source');
      }
    } catch (e) {
      console.error('Error updating RSS source', e);
      throw e;
    }
  }

  /**
   * 删除RSS源
   */
  async deleteRSSSource(index: number): Promise<void> {
    const current = this.RSS_SOURCES[index];
    if (!current || !current.id) {
        console.error('Cannot delete source without ID');
        return;
    }

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      const res = await fetch(`/api/rss-sources?id=${current.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token || ''}`
        }
      });
      
      if (res.ok) {
        await this.refreshSources();
      } else {
        throw new Error('Failed to delete RSS source');
      }
    } catch (e) {
      console.error('Error deleting RSS source', e);
      throw e;
    }
  }


  /**
   * 重置为默认RSS源 (Deprecated)
   */
  resetToDefaultSources(): void {
    // Deprecated
  }

  /**
   * @deprecated Frontend parsing is removed. Use backend API.
   */
  async fetchAllRSSFeeds(): Promise<any[]> {
      console.warn('fetchAllRSSFeeds is deprecated. Please use backend sync.');
      return [];
  }
}

export const rssService = new RSSService();
