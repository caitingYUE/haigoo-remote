import neonHelper from '../../server-utils/dal/neon-helper.js'
import { getCompanyImageAsset } from '../services/company-image-asset-service.js'

export default async function companyAssetsHandler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return res.status(200).end()
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  }

  if (!neonHelper?.isConfigured) {
    return res.status(404).json({ success: false, error: 'Asset not found' })
  }

  const companyId = req.query?.companyId || req.query?.company_id
  const assetType = req.query?.type || 'logo'
  const asset = await getCompanyImageAsset(neonHelper, companyId, assetType)

  if (!asset?.content) {
    return res.status(404).json({ success: false, error: 'Asset not found' })
  }

  const content = Buffer.isBuffer(asset.content)
    ? asset.content
    : Buffer.from(asset.content)

  res.setHeader('Content-Type', asset.mime_type || 'image/webp')
  res.setHeader('Content-Length', String(content.length))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  if (asset.sha256) {
    res.setHeader('ETag', `"${asset.sha256}"`)
  }
  return res.status(200).send(content)
}
