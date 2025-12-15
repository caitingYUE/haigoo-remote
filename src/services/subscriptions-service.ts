export interface Subscription {
  subscription_id: number;
  identifier: string;
  topic: string;
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
    const response = await fetch(`${API_BASE_URL}/subscriptions`);
    if (!response.ok) {
      throw new Error('Failed to fetch subscriptions');
    }
    const data = await response.json();
    return data.subscriptions;
  },

  async add(email: string): Promise<Subscription> {
    const response = await fetch(`${API_BASE_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add subscription');
    }
    const data = await response.json();
    return data.subscription;
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/subscriptions?id=${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete subscription');
    }
  },

  async updateStatus(id: number, status: string): Promise<Subscription> {
      const response = await fetch(`${API_BASE_URL}/subscriptions`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
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
