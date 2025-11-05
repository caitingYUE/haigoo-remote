import { kv } from '@vercel/kv'

const KV_CONFIGURED = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN)
const REDIS_URL =
  process.env.REDIS_URL ||
  process.env.haigoo_REDIS_URL ||
  process.env.HAIGOO_REDIS_URL ||
  process.env.UPSTASH_REDIS_URL ||
  null
const REDIS_CONFIGURED = !!REDIS_URL

/**
 * Health check API - reports system status
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      storage: {
        redis: {
          configured: REDIS_CONFIGURED,
          status: 'unknown'
        },
        kv: {
          configured: KV_CONFIGURED,
          status: 'unknown'
        }
      }
    }
  }

  // Test Redis connection
  if (REDIS_CONFIGURED) {
    try {
      const { createClient } = await import('redis')
      const client = createClient({ url: REDIS_URL })
      client.on('error', () => {}) // Suppress errors during test
      await client.connect()
      await client.ping()
      await client.quit()
      health.services.storage.redis.status = 'healthy'
    } catch (e) {
      health.services.storage.redis.status = 'unhealthy'
      health.status = 'degraded'
      health.services.storage.redis.error = e.message
    }
  } else {
    health.services.storage.redis.status = 'not_configured'
  }

  // Test KV connection
  if (KV_CONFIGURED) {
    try {
      await kv.ping()
      health.services.storage.kv.status = 'healthy'
    } catch (e) {
      health.services.storage.kv.status = 'unhealthy'
      health.status = 'degraded'
      health.services.storage.kv.error = e.message
    }
  } else {
    health.services.storage.kv.status = 'not_configured'
  }

  // Determine overall status
  const hasStorage = REDIS_CONFIGURED || KV_CONFIGURED
  if (!hasStorage) {
    health.status = 'degraded'
    health.warning = 'No storage configured (Redis or KV)'
  }

  const statusCode = health.status === 'healthy' ? 200 : 503

  res.setHeader('X-Health-Status', health.status)
  res.setHeader('X-Storage-Redis', health.services.storage.redis.status)
  res.setHeader('X-Storage-KV', health.services.storage.kv.status)
  
  return res.status(statusCode).json(health)
}

