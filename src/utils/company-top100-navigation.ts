// Only the known ranking route can receive a protected-flow return link.
export function getTop100ReturnTo(value: string | null | undefined): string | null {
  if (!value || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null
  try {
    const url = new URL(value, 'https://haigooremote.com')
    if (url.origin !== 'https://haigooremote.com' || !/^\/(en\/)?trusted-companies\/top-100$/.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch { return null }
}
export function top100ProfilePath(tab: 'membership' | 'feedback', returnTo: string, companyId?: string, version?: string, companyName?:string): string {
  const params = new URLSearchParams({ tab, source: 'company_top100', returnTo: getTop100ReturnTo(returnTo) || '/trusted-companies/top-100' })
  if (companyId) params.set('companyId', companyId)
  if (version) params.set('rankingVersion', version)
  if (companyName) params.set('companyName',companyName.slice(0,120))
  return `/profile?${params}`
}

// Feedback records retain the company/version, never the nested search/return URL.
export function top100FeedbackSourceUrl(pathname:string, search:string): string {
  const input = new URLSearchParams(search), output = new URLSearchParams({tab:'feedback',source:'company_top100'})
  for (const key of ['companyId','rankingVersion','companyName']) {
    const value = input.get(key)
    if(value)output.set(key,value.slice(0,key==='companyId'?160:120))
  }
  return `${pathname}?${output}`
}
