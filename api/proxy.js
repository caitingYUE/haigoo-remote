import rssProxyHandler from '../lib/api-handlers/rss-proxy-handler.js';

export default async function handler(req, res) {
  // Currently we only support RSS proxying
  // In the future, we can switch based on req.query.type
  return rssProxyHandler(req, res);
}
