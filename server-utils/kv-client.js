import { createClient } from '@vercel/kv'

// Get KV configuration from various environment variable patterns
const KV_REST_API_URL =
    process.env.KV_REST_API_URL ||
    process.env.pre_haigoo_KV_REST_API_URL ||
    process.env.haigoo_KV_REST_API_URL ||
    null

const KV_REST_API_TOKEN =
    process.env.KV_REST_API_TOKEN ||
    process.env.pre_haigoo_KV_REST_API_TOKEN ||
    process.env.haigoo_KV_REST_API_TOKEN ||
    null

export const KV_CONFIGURED = !!(KV_REST_API_URL && KV_REST_API_TOKEN)

// Create and export the configured client
// If not configured, we still export a client but it might throw if used
// So consumers should check KV_CONFIGURED first
export const kv = KV_CONFIGURED
    ? createClient({
        url: KV_REST_API_URL,
        token: KV_REST_API_TOKEN,
    })
    : null

export function getKvClient() {
    return kv
}
