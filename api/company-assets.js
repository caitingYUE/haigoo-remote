import companyAssetsHandler from '../lib/api-handlers/company-assets.js'

export default async function handler(req, res) {
  return companyAssetsHandler(req, res)
}
