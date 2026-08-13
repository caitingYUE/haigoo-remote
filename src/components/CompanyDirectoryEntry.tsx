import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, Clock3 } from 'lucide-react'
import { trustedCompaniesService, type TrustedCompany } from '../services/trusted-companies-service'
import { getCompanyLogoSources } from '../utils/company-logo'
import { useLanguage } from '../contexts/LanguageContext'

interface CompanyDirectoryEntryProps {
    company: TrustedCompany
    featured?: boolean
    jobStats?: {
        total: number
        categories: Record<string, number>
    }
    onClick: () => void
}

const formatDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}

export default function CompanyDirectoryEntry({
    company,
    featured = false,
    jobStats,
    onClick,
}: CompanyDirectoryEntryProps) {
    const { text } = useLanguage()
    const [coverImage, setCoverImage] = useState(company.coverImage || '')
    const [logoSourceIndex, setLogoSourceIndex] = useState(0)
    const logoSources = useMemo(() => getCompanyLogoSources({
        companyId: company.id,
        cachedLogoUrl: company.cachedLogoUrl,
        originalLogoUrl: company.logo,
        version: company.updatedAt,
    }), [company.cachedLogoUrl, company.id, company.logo, company.updatedAt])
    const logoSourceKey = useMemo(() => logoSources.join('|'), [logoSources])
    const logoSrc = logoSources[logoSourceIndex] || ''

    useEffect(() => {
        setLogoSourceIndex(0)
    }, [logoSourceKey])

    useEffect(() => {
        if (!featured || coverImage || !company.id) return
        let active = true
        trustedCompaniesService.getCompanyCoverImage(company.id)
            .then((result) => {
                if (active && result?.coverImage) setCoverImage(result.coverImage)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [company.id, coverImage, featured])

    const updatedLabel = formatDate(company.updatedAt)
    const roleCategories = Object.entries(jobStats?.categories || {})
        .sort(([, left], [, right]) => Number(right) - Number(left))
        .slice(0, 3)
        .map(([name]) => name)

    return (
        <button
            type="button"
            className="hg-company-entry"
            data-featured={featured ? 'true' : 'false'}
            onClick={onClick}
            aria-label={text(`查看 ${company.name} 的企业资料`, `View ${company.name} company profile`)}
        >
            <span className="hg-company-entry__media" aria-hidden="true">
                {coverImage ? (
                    <img src={coverImage} alt="" width={720} height={480} loading="lazy" />
                ) : logoSrc ? (
                    <img
                        src={logoSrc}
                        alt=""
                        width={240}
                        height={240}
                        loading="lazy"
                        className="hg-company-entry__logo"
                        onError={() => {
                            if (logoSourceIndex < logoSources.length - 1) {
                                setLogoSourceIndex((index) => index + 1)
                            } else {
                                setLogoSourceIndex(logoSources.length)
                            }
                        }}
                    />
                ) : (
                    <span className="hg-company-entry__initial">{company.name.charAt(0)}</span>
                )}
            </span>

            <span className="hg-company-entry__body">
                <span className="hg-company-entry__meta">
                    <span>{company.industry || text('远程企业', 'Remote company')}</span>
                    {updatedLabel ? (
                        <span className="hg-company-entry__updated">
                            <Clock3 aria-hidden="true" />
                            {text(`${updatedLabel} 更新`, `Updated ${updatedLabel}`)}
                        </span>
                    ) : null}
                </span>
                <span className="hg-company-entry__title">{company.name}</span>
                <span className="hg-company-entry__description">
                    {company.description || text('企业介绍正在整理中。', 'The company profile is being prepared.')}
                </span>
                <span className="hg-company-entry__footer">
                    {roleCategories.length > 0 ? (
                        <span className="hg-company-entry__roles">{text(`在招 ${roleCategories.join(' / ')}`, `Hiring ${roleCategories.join(' / ')}`)}</span>
                    ) : null}
                    <span className="hg-company-entry__action">
                        {text('查看企业', 'View company')}
                        <ArrowUpRight aria-hidden="true" />
                    </span>
                </span>
            </span>
        </button>
    )
}
