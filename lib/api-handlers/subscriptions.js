
import { subscriptionsService } from '../services/subscriptions-service.js';

export default async function subscriptionsHandler(req, res) {
  try {
    if (req.method === 'GET') {
      const subscriptions = await subscriptionsService.getAll();
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
      await subscriptionsService.delete(Number(id));
      return res.status(200).json({ success: true });
    }

    if (req.method === 'PUT') {
      const { id, status } = req.body;
      if (!id || !status) {
        return res.status(400).json({ error: 'ID and status are required' });
      }
      const subscription = await subscriptionsService.updateStatus(Number(id), status);
      return res.status(200).json({ success: true, subscription });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
