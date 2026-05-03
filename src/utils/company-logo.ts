export function buildCompanyLogoAssetUrl(companyId?: string | null, version?: string | null) {
  const id = String(companyId || '').trim()
  if (!id) return ''
  const params = new URLSearchParams()
  params.set('companyId', id)
  params.set('type', 'logo')
  if (version) params.set('v', String(version).slice(0, 16))
  return `/api/company-assets?${params.toString()}`
}

export function getCompanyLogoSources(options: {
  companyId?: string | null
  cachedLogoUrl?: string | null
  originalLogoUrl?: string | null
  version?: string | null
}) {
  const sources = [
    options.cachedLogoUrl || '',
    buildCompanyLogoAssetUrl(options.companyId, options.version),
    options.originalLogoUrl || ''
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return Array.from(new Set(sources))
}
