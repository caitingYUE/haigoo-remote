/**
 * Health check endpoint
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    node_version: process.version,
    endpoints: {
      'parse-resume-new': '/api/parse-resume-new',
      'processed-jobs': '/api/data/processed-jobs',
      'recommendations': '/api/recommendations',
      'rss-proxy': '/api/rss-proxy'
    },
    features: {
      redis: Boolean(
        process.env.REDIS_URL || 
        process.env.haigoo_REDIS_URL || 
        process.env.HAIGOO_REDIS_URL || 
        process.env.UPSTASH_REDIS_URL
      ),
      kv: Boolean(
        process.env.KV_REST_API_URL && 
        process.env.KV_REST_API_TOKEN
      )
    }
  }
  
  res.status(200).json(health)
}
