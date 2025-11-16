import React from 'react'

type Partner = { domain: string } | { logoUrl: string; href: string; name?: string }

function buildPartners(): { logoUrl: string; href: string; name: string }[] {
  const envJson = (import.meta as any).env?.VITE_HERO_PARTNERS_JSON
  const envDomains = (import.meta as any).env?.VITE_HERO_PARTNERS_DOMAINS
  let partners: Partner[] = []
  if (envJson) {
    try { partners = JSON.parse(envJson) } catch {}
  } else if (envDomains) {
    partners = String(envDomains).split(',').map((d: string) => ({ domain: d.trim() })).filter(Boolean)
  } else {
    partners = [
      { domain: 'google.com' },
      { domain: 'github.com' },
      { domain: 'amazon.com' },
      { domain: 'basecamp.com' },
      { domain: 'mailerlite.com' },
      { domain: 'asana.com' },
      { domain: 'slack.com' },
      { domain: 'monday.com' }
    ]
  }
  return partners.map(p => {
    if ('domain' in p) {
      const name = p.domain.replace(/\..*$/, '')
      return { logoUrl: `https://logo.clearbit.com/${p.domain}`, href: `https://${p.domain}`, name }
    }
    return { logoUrl: p.logoUrl, href: p.href, name: p.name || '' }
  })
}

export default function BrandHero() {
  const partners = buildPartners()
  return (
    <section className="container-fluid mt-6 mb-6">
      <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight haigoo-gradient-text">发现海内外优质远程岗位</h1>
          <p className="text-gray-600">每日更新数千个远程岗位</p>
        </div>
        <div className="relative">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 justify-items-center">
            {partners.map((p, i) => (
              <a key={i} href={p.href} target="_blank" rel="noreferrer" className="partner-card">
                <img src={p.logoUrl} alt={p.name} className="h-8 w-auto" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}