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
  const positions = [
    { top: '8%', left: '5%', rotate: '-2deg' },
    { top: '28%', left: '14%', rotate: '3deg' },
    { top: '10%', left: '26%', rotate: '-4deg' },
    { top: '38%', left: '32%', rotate: '2deg' },
    { top: '16%', left: '48%', rotate: '-3deg' },
    { top: '34%', left: '58%', rotate: '4deg' },
    { top: '12%', left: '70%', rotate: '-2deg' },
    { top: '30%', left: '82%', rotate: '2deg' }
  ]

  return (
    <section className="container-fluid mt-4 mb-4">
      <div className="relative mx-auto max-w-7xl h-[180px] rounded-3xl">
        <div className="absolute right-0 top-0 w-[70%] h-full rounded-3xl bg-gradient-to-l from-haigoo-primary/8 via-haigoo-accent/8 to-transparent" />
        <div className="absolute inset-0">
          {partners.slice(0, positions.length).map((p, i) => (
            <a
              key={i}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="partner-card absolute"
              style={{ top: positions[i].top, left: positions[i].left, transform: `rotate(${positions[i].rotate})` }}
            >
              <img src={p.logoUrl} alt={p.name} className="h-8 w-auto" />
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}