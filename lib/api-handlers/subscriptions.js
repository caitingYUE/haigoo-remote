
import { subscriptionsService } from '../services/subscriptions-service.js';

export default async function subscriptionsHandler(req, res) {
  try {
    if (req.method === 'GET') {
      if (req.query?.id && (req.query?.history === '1' || req.query?.history === 'true')) {
        const runs = await subscriptionsService.getDeliveryRuns(req.query.id, {
          limit: req.query?.limit
        });
        return res.status(200).json({ success: true, runs });
      }

      const subscriptions = await subscriptionsService.getAll({
        search: req.query?.search,
        status: req.query?.status,
        channel: req.query?.channel
      });
      return res.status(200).json({ success: true, subscriptions });
    }

    if (req.method === 'POST') {
      const { email, topic } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const subscription = await subscriptionsService.add(email, topic);
      return res.status(200).json({ success: true, subscription });
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'ID is required' });
      }
      await subscriptionsService.softDelete(id);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { id, status } = req.body;
      if (!id || !status) {
        return res.status(400).json({ error: 'ID and status are required' });
      }
      const subscription = await subscriptionsService.updateStatus(id, status);
      return res.status(200).json({ success: true, subscription });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Subscriptions API error:', error);
    if (error?.code === 'SUBSCRIPTION_TOPIC_LIMIT') {
      return res.status(400).json({ success: false, error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
