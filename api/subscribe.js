import { kv } from '@vercel/kv'
import { createClient } from 'redis'
import { setCorsHeaders } from '../server-utils/cors.js'

const REDIS_URL = process.env.REDIS_URL
let redisClient = null
async function getRedis() {
  if (redisClient) return redisClient
  if (!REDIS_URL) return null
  redisClient = createClient({ url: REDIS_URL })
  await redisClient.connect()
  return redisClient
}

export default async function handler(req, res) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  try {
    const { channel, identifier, topic } = req.body || {}
    if (!channel || !identifier || !topic) {
      return res.status(400).json({ success: false, error: 'Missing fields' })
    }
    const key = `haigoo:subscribe:${channel}:${identifier}`
    const data = { channel, identifier, topic, createdAt: new Date().toISOString() }

    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(key, data)
      await kv.sadd('haigoo:subscribe:list', key)
    } else {
      const r = await getRedis()
      if (r) {
        await r.set(key, JSON.stringify(data))
        await r.sAdd('haigoo:subscribe:list', key)
      }
    }
    return res.status(200).json({ success: true })
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Server error' })
  }
}