import { useEffect, useState } from 'react'
import HomeHero from '../components/HomeHero'
import { processedJobsService } from '../services/processed-jobs-service'
import { trustedCompaniesService, TrustedCompany } from '../services/trusted-companies-service'
import { Job } from '../types'

const FEATURED_JOBS_CACHE_KEY = 'haigoo_home_featured_jobs'
const TRUSTED_COMPANIES_CACHE_KEY = 'haigoo_home_trusted_companies'
const FEATURED_JOBS_CACHE_TTL_MS = 5 * 60 * 1000
const TRUSTED_COMPANIES_CACHE_TTL_MS = 5 * 60 * 1000

const getFreshFeaturedJobsCache = (): Job[] => {
  try {
    const cached = localStorage.getItem(FEATURED_JOBS_CACHE_KEY)
    if (!cached) return []

    const parsed = JSON.parse(cached)
    if (Array.isArray(parsed)) return []

    const jobs = Array.isArray(parsed?.jobs) ? parsed.jobs : []
    const fetchedAt = Number(parsed?.fetchedAt || 0)
    if (!jobs.length || !fetchedAt) return []
    if (Date.now() - fetchedAt > FEATURED_JOBS_CACHE_TTL_MS) return []

    return jobs
  } catch {
    return []
  }
}

const getFreshTrustedCompaniesCache = (): {
  companies: TrustedCompany[]
  stats: Record<string, { total: number; categories: Record<string, number> }>
} => {
  try {
    const cached = localStorage.getItem(TRUSTED_COMPANIES_CACHE_KEY)
    if (!cached) return { companies: [], stats: {} }

    const parsed = JSON.parse(cached)
    if (Array.isArray(parsed)) return { companies: [], stats: {} }

    const companies = Array.isArray(parsed?.companies) ? parsed.companies : []
    const stats = parsed?.stats && typeof parsed.stats === 'object' ? parsed.stats : {}
    const fetchedAt = Number(parsed?.fetchedAt || 0)

    if (!companies.length || !fetchedAt) return { companies: [], stats: {} }
    if (Date.now() - fetchedAt > TRUSTED_COMPANIES_CACHE_TTL_MS) return { companies: [], stats: {} }

    return { companies, stats }
  } catch {
    return { companies: [], stats: {} }
  }
}

export default function LandingPage() {
  // Cache busting and version check
  useEffect(() => {
    const CURRENT_VERSION = '2026.06.15.01' // Increment this to force cache clear
    const lastVersion = localStorage.getItem('haigoo_version')
    
    if (lastVersion !== CURRENT_VERSION) {
      console.log('Detecting new version, clearing critical caches...')
      localStorage.removeItem(FEATURED_JOBS_CACHE_KEY)
      localStorage.removeItem(TRUSTED_COMPANIES_CACHE_KEY)
      localStorage.setItem('haigoo_version', CURRENT_VERSION)
      // Force reload if we suspect strict caching issues, but let's try just clearing data first
    }
  }, [])

  const [featuredJobs, setFeaturedJobs] = useState<Job[]>(() => {
    return getFreshFeaturedJobsCache()
  })
  const [cachedCompaniesPayload] = useState(getFreshTrustedCompaniesCache)
  const [trustedCompanies, setTrustedCompanies] = useState<TrustedCompany[]>(cachedCompaniesPayload.companies)
  const [companyJobStats, setCompanyJobStats] = useState<Record<string, { total: number, categories: Record<string, number> }>>(cachedCompaniesPayload.stats)
  const [companiesLoading, setCompaniesLoading] = useState(() => {
    return cachedCompaniesPayload.companies.length === 0
  })

  useEffect(() => {
    let cancelled = false

    processedJobsService.getFeaturedHomeJobs()
      .then(featuredJobsData => {
        if (cancelled) return
        setFeaturedJobs(featuredJobsData)
        localStorage.setItem(FEATURED_JOBS_CACHE_KEY, JSON.stringify({
          jobs: featuredJobsData,
          fetchedAt: Date.now()
        }))
      })
      .catch(error => {
        console.error('Failed to load featured jobs:', error)
      })

    const loadCompanies = () => {
      trustedCompaniesService.getFeaturedCompanies()
        .then(featuredCompaniesData => {
          if (cancelled) return
          setTrustedCompanies(featuredCompaniesData.companies)
          setCompanyJobStats(featuredCompaniesData.stats)
          setCompaniesLoading(false)
          localStorage.setItem(TRUSTED_COMPANIES_CACHE_KEY, JSON.stringify({
            companies: featuredCompaniesData.companies,
            stats: featuredCompaniesData.stats,
            fetchedAt: Date.now()
          }))
        })
        .catch(error => {
          console.error('Failed to load featured companies:', error)
          if (!cancelled) setCompaniesLoading(false)
        })
    }

    const idleId = 'requestIdleCallback' in window
      ? window.requestIdleCallback(loadCompanies, { timeout: 1800 })
      : globalThis.setTimeout(loadCompanies, 700)

    return () => {
      cancelled = true
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(Number(idleId))
      else globalThis.clearTimeout(idleId)
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#fbfaf6]">
      <HomeHero
        stats={undefined}
        featuredJobs={featuredJobs}
        trustedCompanies={trustedCompanies}
        companyJobStats={companyJobStats}
        companiesLoading={companiesLoading}
      />
    </div>
  )
}
