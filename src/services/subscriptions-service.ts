export interface Subscription {
  subscription_id: number | string;
  user_id?: string;
  identifier: string;
  topic?: string;
  nickname?: string;
  preferences?: any;
  channel: 'email' | 'feishu';
  frequency: string;
  status: 'active' | 'inactive' | 'bounced';
  created_at: string;
  updated_at?: string;
  last_sent_at?: string;
  fail_count: number;
  last_active_at?: string;
  user_email?: string;
  user_name?: string;
  member_status?: string;
  member_type?: string;
  member_expire_at?: string;
  membership_level?: string;
  delivery_sent_count?: number;
  delivery_failed_count?: number;
  delivery_skipped_count?: number;
  latest_delivery_sent_at?: string;
  latest_delivery_run_at?: string;
}

export interface SubscriptionDeliveryRun {
  id: number;
  subscription_id: string;
  identifier: string;
  batch_date?: string;
  week_key?: string;
  status: 'sent' | 'failed' | 'skipped' | 'processing';
  job_count: number;
  primary_count?: number;
  related_count?: number;
  error?: string;
  sent_at?: string;
  created_at: string;
  updated_at?: string;
}

export const subscriptionsService = {
  async getAll(filters?: { search?: string; status?: string; channel?: string }): Promise<Subscription[]> {
    const token = localStorage.getItem('haigoo_auth_token');
    const params = new URLSearchParams({ action: 'subscriptions' });
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.channel && filters.channel !== 'all') params.set('channel', filters.channel);
    const response = await fetch(`/api/admin-ops?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch subscriptions');
    }
    const data = await response.json();
    return data.subscriptions;
  },

  async add(email: string, topic?: string): Promise<Subscription> {
    const token = localStorage.getItem('haigoo_auth_token');
    const response = await fetch(`/api/admin-ops?action=subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, topic }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add subscription');
    }
    const data = await response.json();
    return data.subscription;
  },

  async delete(id: number | string): Promise<void> {
    const token = localStorage.getItem('haigoo_auth_token');
    const response = await fetch(`/api/admin-ops?action=subscriptions&id=${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to delete subscription');
    }
  },

  async updateStatus(id: number | string, status: string): Promise<Subscription> {
      const token = localStorage.getItem('haigoo_auth_token');
      const response = await fetch(`/api/admin-ops?action=subscriptions`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update subscription status');
      }
      const data = await response.json();
      return data.subscription;
  },

  async getDeliveryRuns(id: number | string, limit = 30): Promise<SubscriptionDeliveryRun[]> {
      const token = localStorage.getItem('haigoo_auth_token');
      const params = new URLSearchParams({
        action: 'subscriptions',
        id: String(id),
        history: '1',
        limit: String(limit)
      });
      const response = await fetch(`/api/admin-ops?${params.toString()}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch subscription delivery runs');
      }
      const data = await response.json();
      return data.runs || [];
  }
};
