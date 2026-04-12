import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Search } from 'lucide-react'
import { Job } from '../types'
import { TrustedCompany } from '../services/trusted-companies-service'

interface HomeQuickSearchProps {
  featuredJobs?: Job[]
  trustedCompanies?: TrustedCompany[]
  companyJobStats?: Record<string, { total: number; categories: Record<string, number> }>
  variant?: 'standalone' | 'embedded'
}

interface SuggestionItem {
  label: string
  kind: 'role' | 'company'
  hot?: boolean
}

const FALLBACK_ROLE_SUGGESTIONS = ['产品经理', '前端开发', '后端开发', '全栈开发', '市场营销', '客户经理', '运营', 'UI 设计']

export default function HomeQuickSearch({
  featuredJobs = [],
  trustedCompanies = [],
  companyJobStats = {},
  variant = 'standalone'
}: HomeQuickSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [roleSuggestions, setRoleSuggestions] = useState<SuggestionItem[]>([])

  useEffect(() => {
    let mounted = true

    const loadRoleSuggestions = async () => {
      try {
        const response = await fetch(`/api/data/processed-jobs?page=1&pageSize=1&sortBy=recent&isApproved=true&_t=${Date.now()}`, {
          cache: 'no-store'
        })

        if (!response.ok) throw new Error(`Failed with status ${response.status}`)

        const data = await response.json()
        const categories = Array.isArray(data?.aggregations?.category) ? data.aggregations.category : []
        const nextSuggestions = categories
          .filter((item: any) => item?.value)
          .slice(0, 8)
          .map((item: any, index: number) => ({
            label: String(item.value).trim(),
            kind: 'role' as const,
            hot: index < 3
          }))

        if (mounted && nextSuggestions.length > 0) {
          setRoleSuggestions(nextSuggestions)
        }
      } catch (error) {
        if (!mounted) return
        setRoleSuggestions(
          FALLBACK_ROLE_SUGGESTIONS.map((label, index) => ({
            label,
            kind: 'role',
            hot: index < 3
          }))
        )
      }
    }

    loadRoleSuggestions()
    return () => {
      mounted = false
    }
  }, [])

  const companySuggestions = useMemo(() => {
    const rankedTrustedCompanies = [...trustedCompanies]
      .sort((a, b) => (companyJobStats[b.name]?.total || 0) - (companyJobStats[a.name]?.total || 0))
      .map((company) => company.name)

    const featuredCompanies = featuredJobs
      .map((job) => String(job.company || '').trim())
      .filter(Boolean)

    return [...new Set([...rankedTrustedCompanies, ...featuredCompanies])]
      .slice(0, 5)
      .map((label) => ({
        label,
        kind: 'company' as const
      }))
  }, [companyJobStats, featuredJobs, trustedCompanies])

  const handleSubmit = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) {
      navigate('/jobs')
      return
    }
    navigate(`/jobs?search=${encodeURIComponent(trimmed)}`)
  }

  const jumpBySuggestion = (label: string) => {
    setQuery(label)
    navigate(`/jobs?search=${encodeURIComponent(label)}`)
  }

  const renderSuggestionChip = (item: SuggestionItem) => {
    const isHot = Boolean(item.hot)
    return (
      <button
        key={`${item.kind}-${item.label}`}
        type="button"
        onClick={() => jumpBySuggestion(item.label)}
        className={`group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-all ${
          isHot
            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100'
            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700'
        }`}
      >
        {isHot ? <span className="text-sm leading-none" aria-hidden="true">🔥</span> : null}
        <span>{item.label}</span>
      </button>
    )
  }

  const isEmbedded = variant === 'embedded'

  return (
    <section className={`relative ${isEmbedded ? '' : 'pb-4'}`}>
      <div className={`${isEmbedded ? 'mx-auto max-w-5xl' : 'mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'}`}>
        <div className={`mx-auto max-w-5xl rounded-[30px] border px-5 py-5 backdrop-blur-xl sm:px-6 sm:py-6 ${
          isEmbedded
            ? 'border-slate-200/80 bg-white/82 shadow-[0_18px_48px_-36px_rgba(79,70,229,0.25)]'
            : 'border-white/80 bg-white/78 shadow-[0_24px_64px_-40px_rgba(79,70,229,0.35)]'
        }`}>
          <div className="flex flex-col gap-5">
            {!isEmbedded ? (
              <div className="text-center">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[30px]">
                  想找什么岗位或企业，直接搜一下
                </h2>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
              <label className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100">
                <Search className="h-5 w-5 flex-shrink-0 text-slate-400 transition-colors group-focus-within:text-indigo-500" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：产品经理、市场营销、Sumsub、Buffer"
                  className="w-full bg-transparent text-[15px] text-slate-700 outline-none placeholder:text-slate-400"
                />
              </label>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-500/25"
              >
                搜索岗位
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className={`space-y-3 ${isEmbedded ? 'border-t border-slate-100 pt-4' : ''}`}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start">
                <div className="w-[72px] flex-shrink-0 pt-1 text-[13px] font-semibold text-slate-500">热门岗位</div>
                <div className="flex flex-wrap gap-1.5">
                  {(roleSuggestions.length > 0 ? roleSuggestions : FALLBACK_ROLE_SUGGESTIONS.map((label, index) => ({
                    label,
                    kind: 'role' as const,
                    hot: index < 3
                  }))).map(renderSuggestionChip)}
                </div>
              </div>

              {companySuggestions.length > 0 ? (
                <div className="flex flex-col gap-2 md:flex-row md:items-start">
                  <div className="w-[72px] flex-shrink-0 pt-1 text-[13px] font-semibold text-slate-500">常搜企业</div>
                  <div className="flex flex-wrap gap-1.5">
                    {companySuggestions.map(renderSuggestionChip)}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
