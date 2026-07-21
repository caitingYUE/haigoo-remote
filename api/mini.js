import miniGatewayHandler from '../lib/api-handlers/mini-gateway.js'

/**
 * Private origin API for the WeChat Cloud Hosting gateway.
 *
 * This route deliberately has no browser CORS policy: it is authenticated with
 * an HMAC shared only by Cloud Hosting and this Vercel deployment.  Mini
 * Program clients must call Cloud Hosting, never this endpoint directly.
 */
export default async function handler(req, res) {
  return miniGatewayHandler(req, res)
}
