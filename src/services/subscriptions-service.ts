export interface Subscription {
  subscription_id: number;
  identifier: string;
  topic?: string;
  nickname?: string;
  channel: 'email' | 'feishu';
  frequency: string;
  status: 'active' | 'inactive' | 'bounced';
  created_at: string;
  last_sent_at?: string;
  fail_count: number;
  last_active_at?: string;
}

const API_BASE_URL = '/api/admin';

export const subscriptionsService = {
  async getAll(): Promise<Subscription[]> {
    const token = localStorage.getItem('haigoo_auth_token');
    const response = await fetch(`/api/admin-ops?action=subscriptions`, {
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

  async delete(id: number): Promise<void> {
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

  async updateStatus(id: number, status: string): Promise<Subscription> {
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
  }
};
