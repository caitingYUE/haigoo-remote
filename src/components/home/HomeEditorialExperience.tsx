import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ArrowRight,
  Briefcase,
  Code2,
  FolderOpen,
  Heart,
  LayoutGrid,
  Megaphone,
  Palette,
  Search,
  Settings2,
  Users,
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import type { TrustedCompany } from '../../services/trusted-companies-service'
import MemberEmailSubscriptionCard from '../MemberEmailSubscriptionCard'

type EditorialTab = {
  id: string
  label: string
  englishLabel: string
}

type CompanyJobStats = Record<string, { total: number; categories: Record<string, number> }>

interface HomeEditorialExperienceProps {
  searchTerm: string
  onSearchTermChange: (value: string) => void
  onSearch: () => void
  onCategory: (categories: string[]) => void
  jobs: any[]
  jobsLoading: boolean
  tabs: EditorialTab[]
  activeTab: string
  onTabChange: (id: string) => void
  onOpenJob: (job: any) => void
  companies: TrustedCompany[]
  companiesLoading: boolean
  companyJobStats: CompanyJobStats
  companyCoverImages: Record<string, string>
  onOpenCompany: (company: TrustedCompany) => void
  onViewAllJobs: () => void
  onViewAllCompanies: () => void
  careerGuides?: ReactNode
  clubInfo?: ReactNode
  systemNotice?: ReactNode
  resumeDailyCard?: ReactNode
}

const CATEGORY_ITEMS = [
  {
    label: '产品',
    englishLabel: 'Product',
    icon: Briefcase,
    categories: ['产品经理', '项目管理', '增长黑客'],
  },
  {
    label: '开发',
    englishLabel: 'Engineering',
    icon: Code2,
    categories: ['前端开发', '后端开发', '全栈开发', '软件开发', '移动开发', '运维/SRE'],
  },
  {
    label: '设计',
    englishLabel: 'Design',
    icon: Palette,
    categories: ['产品设计', '视觉设计', '平面设计', '创意设计', 'UI/UX设计', '用户研究'],
  },
  {
    label: '市场',
    englishLabel: 'Marketing',
    icon: Megaphone,
    categories: ['市场营销', '品牌营销', '增长黑客', '内容创作'],
  },
  {
    label: '运营',
    englishLabel: 'Operations',
    icon: Settings2,
    categories: ['运营', '产品运营', '活动运营', '客户服务'],
  },
  {
    label: '商务',
    englishLabel: 'Business',
    icon: Users,
    categories: ['销售', '客户经理', '商务拓展'],
  },
  {
    label: '更多',
    englishLabel: 'More',
    icon: LayoutGrid,
    categories: ['人力资源', '招聘', '行政', '会计', '财务', '法务', '数据分析', '教育培训', '咨询', '其他'],
  },
]

function getJobValue(job: any, ...keys: string[]) {
  for (const key of keys) {
    const value = job?.[key]
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim()
  }
  return ''
}

function getJobTitle(job: any) {
  return getJobValue(job, 'title', 'jobTitle', 'job_title') || '远程岗位'
}

function getCompanyName(job: any) {
  return getJobValue(job, 'company_name', 'company', 'companyName') || '企业名称待确认'
}

function getJobFunction(job: any, isEnglish: boolean) {
  const category = getJobValue(job, 'category', 'jobCategory', 'job_category')
  return category || (isEnglish ? 'Remote role' : '远程岗位')
}

function getJobType(job: any, isEnglish: boolean) {
  const raw = getJobValue(job, 'jobType', 'job_type', 'type', 'employmentType', 'employment_type')
  if (!raw) return isEnglish ? 'See details' : '查看详情'
  const lowered = raw.toLowerCase()
  if (lowered === 'full-time' || lowered === 'full_time') return isEnglish ? 'Full-time' : '全职'
  if (lowered === 'part-time' || lowered === 'part_time') return isEnglish ? 'Part-time' : '兼职'
  if (lowered === 'contract') return isEnglish ? 'Contract' : '合同'
  if (lowered === 'freelance') return isEnglish ? 'Freelance' : '自由职业'
  if (lowered === 'internship') return isEnglish ? 'Internship' : '实习'
  return raw
}

function getJobLocation(job: any, isEnglish: boolean) {
  return getJobValue(job, 'location', 'remoteRegion', 'remote_region') || (isEnglish ? 'Remote' : '远程')
}

function getSourceLabel(job: any, isEnglish: boolean) {
  const raw = getJobValue(job, 'sourceType', 'source_type', 'source', 'sourceName', 'source_name').toLowerCase()
  const sourceUrl = getJobValue(job, 'sourceUrl', 'source_url', 'url')
  const isOfficial = /official|career|company/.test(raw) || /careers?|jobs?\./i.test(sourceUrl)
  if (isOfficial) return isEnglish ? 'Company website' : '企业官网'
  return isEnglish ? 'Public source' : '公开渠道'
}

function getJobDate(job: any) {
  const raw = getJobValue(job, 'updatedAt', 'updated_at', 'publishedAt', 'published_at', 'createdAt', 'created_at')
  if (!raw) return null
  const value = new Date(raw)
  return Number.isNaN(value.getTime()) ? null : value
}

function formatRelativeDate(date: Date | null, isEnglish: boolean) {
  if (!date) return isEnglish ? 'Date unavailable' : '时间待确认'
  const now = new Date()
  const dayMs = 24 * 60 * 60 * 1000
  const diffDays = Math.max(0, Math.floor((now.getTime() - date.getTime()) / dayMs))
  if (diffDays === 0) return isEnglish ? 'Updated today' : '今天更新'
  if (diffDays === 1) return isEnglish ? 'Updated yesterday' : '昨天更新'
  if (diffDays < 7) return isEnglish ? `Updated ${diffDays} days ago` : `${diffDays} 天前更新`
  return new Intl.DateTimeFormat(isEnglish ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

const HERO_COMPANY_NAMES = new Set([
  'Remote People', 'Superside', 'Ylabs', 'Sleek', 'Translated', 'Rainforest', 'Canonical',
  'SafetyWing', 'Jampp', 'Intellect', 'Slasify', 'MindFi', 'Circle', 'Sumsub',
  'Preferred by Nature', 'Deluxe Media Inc.', 'Keywords Studios',
  'Endpoint Clinical', 'Adapty.io', 'Kit', 'Supabase',
].map((name) => name.toLocaleLowerCase()))

function formatRoleCategories(categories?: Record<string, number>, isEnglish = false) {
  const categoryText = Object.entries(categories || {})
    .sort(([, a], [, b]) => Number(b) - Number(a))
    .slice(0, 2)
    .map(([name]) => name)
    .filter(Boolean)
    .join(' / ')
  if (categoryText) return categoryText
  return isEnglish ? 'Role categories being updated' : '岗位方向整理中'
}

export default function HomeEditorialExperience({
  searchTerm,
  onSearchTermChange,
  onSearch,
  onCategory,
  jobs,
  jobsLoading,
  tabs,
  activeTab,
  onTabChange,
  onOpenJob,
  companies,
  companiesLoading,
  companyJobStats,
  companyCoverImages,
  onOpenCompany,
  onViewAllJobs,
  onViewAllCompanies,
  careerGuides,
  clubInfo,
  systemNotice,
  resumeDailyCard,
}: HomeEditorialExperienceProps) {
  const { isEnglish, text } = useLanguage()
  const { isMember } = useAuth()
  const [storyMode, setStoryMode] = useState<'companies' | 'daily'>('companies')
  const [companySlide, setCompanySlide] = useState(0)
  const featuredCompanies = useMemo(() => companies
    .filter((company) => HERO_COMPANY_NAMES.has(company.name.trim().toLocaleLowerCase()))
    .sort((left, right) => {
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime()
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime()
      return rightTime - leftTime
    })
    .slice(0, 4), [companies])
  const activeCompany = featuredCompanies[companySlide] || null

  useEffect(() => {
    if (!resumeDailyCard) {
      setStoryMode('companies')
    }
  }, [resumeDailyCard])

  useEffect(() => {
    if (featuredCompanies.length < 2 || storyMode !== 'companies') return
    const timer = window.setInterval(() => {
      setCompanySlide((current) => (current + 1) % featuredCompanies.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [companySlide, featuredCompanies.length, storyMode])

  useEffect(() => {
    if (companySlide >= featuredCompanies.length) setCompanySlide(0)
  }, [companySlide, featuredCompanies.length])

  return (
    <div className="haigoo-home">
      {systemNotice}
      <section className="haigoo-home__hero" aria-labelledby="home-editorial-title">
        <div className="haigoo-shell haigoo-home__hero-grid">
          <div className="haigoo-home__hero-copy">
            <p className="haigoo-editorial-label">Haigoo Remote · Global work journal</p>
            <h1 id="home-editorial-title" className="haigoo-home__title">
              <span className="haigoo-home__title-line-top">{text('用你喜欢的方式', 'Work and live')}</span>
              <span className="haigoo-home__title-line">
                {text('工作和生活', 'in your own way')}
                <span className="haigoo-home__title-mark-wrap" aria-hidden="true">
                  <Heart className="haigoo-home__title-mark" />
                </span>
              </span>
            </h1>
            <p className="haigoo-home__intro">
              {text(
                '从全球企业的公开申请渠道出发，探索远程工作和生活方式。岗位信息全部开放，陪你探索另一种人生可能。',
                'Explore remote work and ways of living through public application channels. Every role is open to browse, helping you discover another possible path.',
              )}
            </p>

            <form
              className="haigoo-home__search"
              role="search"
              aria-label={text('搜索远程岗位', 'Search remote jobs')}
              onSubmit={(event) => {
                event.preventDefault()
                onSearch()
              }}
            >
              <Search className="haigoo-home__search-icon" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder={text('搜索岗位、公司或技能', 'Search roles, companies, or skills')}
                aria-label={text('搜索岗位、公司或技能', 'Search roles, companies, or skills')}
              />
              <button type="submit" aria-label={text('开始搜索', 'Search')}>
                <ArrowRight size={18} aria-hidden="true" />
              </button>
            </form>

            <nav className="haigoo-home__categories" aria-label={text('岗位分类', 'Job categories')}>
              {CATEGORY_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <button key={item.label} type="button" className="haigoo-home__category" onClick={() => onCategory(item.categories)}>
                    <Icon aria-hidden="true" />
                    <span>{isEnglish ? item.englishLabel : item.label}</span>
                  </button>
                )
              })}
            </nav>
          </div>

          <aside className={`haigoo-home__story ${storyMode === 'daily' ? 'is-daily' : 'is-companies'} ${resumeDailyCard ? 'has-switcher' : 'has-single-story'}`} aria-label={text('远程企业与岗位参考', 'Remote companies and role references')}>
            {resumeDailyCard ? (
              <div className="haigoo-home__story-switcher" role="group" aria-label={text('首页信息卡切换', 'Home card switcher')}>
                <button type="button" aria-pressed={storyMode === 'companies'} onClick={() => setStoryMode('companies')}>
                  {text('远程企业', 'Companies')}
                </button>
                <button type="button" aria-pressed={storyMode === 'daily'} onClick={() => setStoryMode('daily')}>
                  {text('岗位参考', 'Role reference')}
                </button>
              </div>
            ) : null}

            <div className="haigoo-home__company-stage" aria-live="polite" hidden={storyMode !== 'companies'}>
              {activeCompany ? (
                <>
                  <button type="button" className="haigoo-home__company-feature" onClick={() => onOpenCompany(activeCompany)}>
                    <span className="haigoo-home__company-feature-image">
                      <img
                        key={activeCompany.id}
                        src={activeCompany.coverImage || companyCoverImages[activeCompany.id] || '/pic_lists/Home_pics/background05.webp'}
                        alt=""
                        width={960}
                        height={620}
                        decoding="async"
                      />
                    </span>
                    <span className="haigoo-home__company-feature-copy">
                      <span className="haigoo-editorial-label">Remote company view · {String(companySlide + 1).padStart(2, '0')}</span>
                      <strong>{activeCompany.name}</strong>
                      <span>{activeCompany.industry || text('远程协作企业', 'Remote-first company')}</span>
                      <span className="haigoo-home__company-feature-link">{text('查看企业资料', 'View company')} <ArrowRight size={16} aria-hidden="true" /></span>
                    </span>
                  </button>

                  <div className="haigoo-home__company-stack" aria-hidden="true">
                    {featuredCompanies.slice(1, 3).map((_, offset) => {
                      const preview = featuredCompanies[(companySlide + offset + 1) % featuredCompanies.length]
                      if (!preview || preview.id === activeCompany.id) return null
                      return (
                        <span key={preview.id} style={{ '--company-stack-index': offset } as CSSProperties}>
                          <img src={preview.coverImage || companyCoverImages[preview.id] || '/pic_lists/Home_pics/background05.webp'} alt="" width={240} height={360} decoding="async" />
                        </span>
                      )
                    })}
                  </div>

                  <div className="haigoo-home__company-dots" aria-label={text('切换企业', 'Choose company')}>
                    {featuredCompanies.map((company, index) => (
                      <button
                        key={company.id}
                        type="button"
                        aria-label={text(`查看 ${company.name}`, `View ${company.name}`)}
                        aria-current={index === companySlide ? 'true' : undefined}
                        onClick={() => setCompanySlide(index)}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="haigoo-home__company-feature haigoo-home__company-feature--loading" aria-label={text('正在加载企业资料', 'Loading company profiles')}>
                  <span className="haigoo-home__company-feature-image">
                    <img src="/pic_lists/Home_pics/background05.webp" alt="" width={960} height={620} decoding="async" />
                  </span>
                  <span className="haigoo-home__company-feature-copy">
                    <span className="haigoo-editorial-label">Remote company view</span>
                    <strong>{companiesLoading ? text('正在加载最新企业资料', 'Loading the latest company profiles') : text('继续探索远程工作的可能', 'Keep exploring remote possibilities')}</strong>
                    <span>{text('公开信息持续整理中', 'Public information is continuously organised')}</span>
                  </span>
                </div>
              )}
            </div>

            {resumeDailyCard ? (
              <div className="haigoo-home__story-copy haigoo-home__story-copy--daily">
                {resumeDailyCard}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="haigoo-home__promise" aria-labelledby="open-roles-title">
        <div className="haigoo-shell haigoo-home__promise-grid">
          <div className="haigoo-home__promise-title">
            <p>Haigoo update</p>
            <h2 id="open-roles-title">{text('所有岗位现已开放', 'Every role is now open')}</h2>
          </div>
          <div className="haigoo-home__promise-item">
            <strong>{text('公开来源', 'Public sources')}</strong>
            <span>{text('企业官网与公开 Careers 页面', 'Company websites and public Careers pages')}</span>
          </div>
          <div className="haigoo-home__promise-item">
            <strong>{text('持续整理', 'Continuously organised')}</strong>
            <span>{text('关注职位状态与信息变化', 'Following role status and information changes')}</span>
          </div>
          <div className="haigoo-home__promise-item">
            <strong>{text('免费申请', 'Free applications')}</strong>
            <span>{text('每月 20 次官网直申', '20 official applications each month')}</span>
          </div>
        </div>
      </section>

      <section className="haigoo-shell haigoo-home__section" aria-labelledby="latest-jobs-title">
        <header className="haigoo-home__section-header">
          <div>
            <p className="haigoo-editorial-label">Recently updated</p>
            <h2 id="latest-jobs-title">{text('最近更新的远程机会', 'Recently updated remote roles')}</h2>
            <p>{text('按公开信息的更新时间呈现。', 'Shown by public update time.')}</p>
          </div>
          <button type="button" className="haigoo-home__section-link" onClick={onViewAllJobs}>
            {text('浏览全部岗位', 'Browse all roles')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="haigoo-home__tabs" role="tablist" aria-label={text('岗位类型', 'Role types')}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className="haigoo-home__tab"
              onClick={() => onTabChange(tab.id)}
            >
              {isEnglish ? tab.englishLabel : tab.label}
            </button>
          ))}
        </div>

        <div className="haigoo-home__jobs">
          {jobsLoading ? (
            Array.from({ length: 5 }, (_, index) => <div key={index} className="haigoo-home__jobs-skeleton" aria-hidden="true" />)
          ) : jobs.length === 0 ? (
            <div className="haigoo-home__empty">
              {text('这个分类暂时没有可展示的岗位，换个方向看看。', 'No roles are available in this category right now. Try another direction.')}
            </div>
          ) : (
            jobs.slice(0, 6).map((job) => {
              const date = getJobDate(job)
              return (
                <button
                  key={getJobValue(job, 'id', 'jobId', 'job_id') || `${getCompanyName(job)}-${getJobTitle(job)}`}
                  type="button"
                  className="haigoo-home__job-row"
                  onClick={() => onOpenJob(job)}
                  aria-label={text(`查看 ${getJobTitle(job)} 岗位`, `View ${getJobTitle(job)}`)}
                >
                  <span>
                    <span className="haigoo-home__job-company">{getCompanyName(job)}</span>
                    <span className="haigoo-home__job-title">{getJobTitle(job)}</span>
                    <span className="haigoo-home__job-meta">
                      <span>{getJobFunction(job, isEnglish)}</span>
                      <span>{getJobType(job, isEnglish)}</span>
                      <span>{getJobLocation(job, isEnglish)}</span>
                    </span>
                  </span>
                  <span className="haigoo-home__job-cell">
                    <span className="haigoo-home__job-cell-label">{text('工作方式', 'Work mode')}</span>
                    <span className="haigoo-home__job-cell-value">{getJobLocation(job, isEnglish)}</span>
                  </span>
                  <span className="haigoo-home__job-cell">
                    <span className="haigoo-home__job-cell-label">{text('来源与更新', 'Source & update')}</span>
                    <span className="haigoo-home__job-cell-value">
                      {getSourceLabel(job, isEnglish)} · <time dateTime={date?.toISOString()}>{formatRelativeDate(date, isEnglish)}</time>
                    </span>
                  </span>
                  <span className="haigoo-home__job-arrow" aria-hidden="true">
                    <ArrowRight size={17} />
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>

      {careerGuides ? <div className="haigoo-shell haigoo-home__career-wrap">{careerGuides}</div> : null}

      <section className="haigoo-shell haigoo-home__section" aria-labelledby="remote-companies-title">
        <header className="haigoo-home__section-header">
          <div>
            <p className="haigoo-editorial-label">Remote companies</p>
            <h2 id="remote-companies-title">{text('值得长期关注的远程企业', 'Remote companies worth following')}</h2>
            <p>{text('了解它们做什么、如何工作，以及在哪里查看最新机会。', 'Learn what they do, how they work, and where to find their latest openings.')}</p>
          </div>
          <button type="button" className="haigoo-home__section-link" onClick={onViewAllCompanies}>
            {text('浏览远程企业', 'Browse remote companies')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="haigoo-home__companies-layout">
          <div className="haigoo-home__companies-grid">
            {companiesLoading ? (
              Array.from({ length: 6 }, (_, index) => <div key={index} className="haigoo-home__jobs-skeleton" aria-hidden="true" />)
            ) : companies.length === 0 ? (
              <div className="haigoo-home__empty">{text('企业信息正在整理中。', 'Company profiles are being organised.')}</div>
            ) : (
              companies.slice(0, 6).map((company) => {
                const companyStats = companyJobStats[company.name]
                const cover = company.coverImage || companyCoverImages[company.id] || ''
                const description = company.description || company.translations?.description || text('查看企业介绍与公开岗位信息。', 'View the company profile and public role information.')
                return (
                  <button key={company.id} type="button" className="haigoo-home__company" onClick={() => onOpenCompany(company)}>
                    <span className="haigoo-home__company-image">
                      {cover ? (
                        <img src={cover} alt="" width={640} height={360} loading="lazy" decoding="async" />
                      ) : (
                        <span className="haigoo-home__company-placeholder" aria-hidden="true">
                          <span>{company.name.charAt(0)}</span>
                          <small>REMOTE COMPANY</small>
                        </span>
                      )}
                    </span>
                    <div className="haigoo-home__company-content">
                      <span className="haigoo-home__company-heading">
                        <strong>{company.name}</strong>
                        {company.industry ? <span>{company.industry}</span> : null}
                      </span>
                      <p>{description}</p>
                      <span className="haigoo-home__company-meta">
                        <span>{isEnglish ? 'Hiring ' : '在招 '}{formatRoleCategories(companyStats?.categories, isEnglish)}</span>
                        <span>{text('查看企业 →', 'View company →')}</span>
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <aside className="haigoo-home__community">
            <p className="haigoo-editorial-label">Open community</p>
            <h3>{text('加入 Haigoo 远程交流群', 'Join the Haigoo remote community')}</h3>
            <p>{text('开放交流群，正在找机会的朋友可以互相探讨。', 'An open group where people exploring opportunities can talk things through together.')}</p>
            <div className="haigoo-home__community-list">
              <div className="haigoo-home__community-item">
                <Briefcase aria-hidden="true" />
                <span><strong>{text('岗位分享', 'Role sharing')}</strong><span>{text('自由分享好机会', 'Share worthwhile opportunities freely')}</span></span>
              </div>
              <div className="haigoo-home__community-item">
                <Users aria-hidden="true" />
                <span><strong>{text('同行交流', 'Peer conversation')}</strong><span>{text('讨论申请与面试节奏', 'Talk about applications and interviews')}</span></span>
              </div>
              <div className="haigoo-home__community-item">
                <FolderOpen aria-hidden="true" />
                <span><strong>{text('公开信息', 'Public information')}</strong><span>{text('一起核对值得关注的更新', 'Compare useful public updates together')}</span></span>
              </div>
            </div>
            <div className="haigoo-home__community-qr">
              <img src="/Wechat_group.webp" alt={text('Haigoo 远程交流群二维码', 'Haigoo remote community QR code')} width={240} height={240} loading="lazy" decoding="async" />
              <span><strong>{text('微信扫码加入', 'Scan to join on WeChat')}</strong><span>{text('无需购买任何岗位权益', 'No job-access purchase required')}</span></span>
            </div>
          </aside>
        </div>
      </section>

      {isMember ? (
        <section className="haigoo-shell haigoo-home__subscription" aria-label={text('会员岗位订阅', 'Member job subscription')}>
          <MemberEmailSubscriptionCard />
        </section>
      ) : null}

      {clubInfo ? <div className="haigoo-shell haigoo-home__brand-wrap">{clubInfo}</div> : null}

    </div>
  )
}
