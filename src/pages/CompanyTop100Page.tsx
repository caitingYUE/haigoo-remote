import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ChevronDown, Crown, LockKeyhole, Search, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { deriveMembershipCapabilities } from '../utils/membership'
import { getCompanyLogoSources } from '../utils/company-logo'
import { withReturnTo } from '../hooks/useReturnNavigation'
import { useCompanyTop100 } from '../hooks/useCompanyTop100'
import { top100ProfilePath } from '../utils/company-top100-navigation'
import { trackingService } from '../services/tracking-service'
import CompanyRankingEvidence, { RANKING_FACTORS } from '../components/CompanyRankingEvidence'
import type { CompanyTop100Entry, CompanyTop100Response } from '../types/company-top100'
import '../styles/company-top100.css'

const DEFAULT_WEIGHTS = { mainland: 30, remote: 15, payment: 15, timezone: 15, basics: 15, business: 10 }
const REMOTE_LABELS = { fully_remote: ['全远程','Fully remote'], remote_first: ['远程优先','Remote first'], selected_roles: ['部分岗位远程','Selected remote roles'], field_work: ['含现场／出差','Field work / travel'] } as const
const CONTRACT_LABELS = { employee_unconfirmed: ['雇员类别 · 主体待核','Employee category · entity unconfirmed'], contractor: ['Contractor','Contractor'], project: ['项目／任务合作','Project / task work'], unknown: ['合同待确认','Contract unconfirmed'] } as const

function RankingLogo({ entry }: { entry: CompanyTop100Entry }) {
  const [index, setIndex] = useState(0)
  const sources = useMemo(() => getCompanyLogoSources({ companyId: entry.companyId, cachedLogoUrl: entry.cachedLogoUrl || undefined, originalLogoUrl: entry.logo || undefined, version: entry.liveUpdatedAt || undefined }), [entry.companyId, entry.cachedLogoUrl, entry.logo, entry.liveUpdatedAt])
  useEffect(() => { setIndex(0) }, [sources])
  return <span className="hg-top100-row__logo" aria-hidden="true">{sources[index] ? <img src={sources[index]} alt="" width={56} height={56} loading="lazy" onError={() => setIndex(i => i + 1)} /> : <span>{entry.name.charAt(0)}</span>}</span>
}

export default function CompanyTop100Page() {
  const { user, token, isAuthenticated, isLoading: authLoading, refreshUser, logout } = useAuth()
  const { text, path, isEnglish } = useLanguage()
  const [params, setParams] = useSearchParams(), location = useLocation()
  const {canRead,data,status,refreshing,sessionExpired,retry} = useCompanyTop100()
  const restored = useRef(false), tracked = useRef(''), membershipReturnChecked = useRef('')
  const capabilities = deriveMembershipCapabilities(user)
  const membershipEnds = new Date((user as unknown as {memberExpireAt?:string;member_expire_at?:string})?.memberExpireAt || (user as unknown as {member_expire_at?:string})?.member_expire_at || '').getTime()
  const memberExpired = Number.isFinite(membershipEnds) && membershipEnds <= Date.now() && !capabilities.isActive
  const query = params.get('q') || '', tier = params.get('tier') || '', industry = params.get('industry') || ''
  const remote = params.get('remote') || '', contract = params.get('contract') || '', expanded = params.get('expanded') || ''
  const currentPath = `${location.pathname}${location.search}`

  useEffect(() => {
    if(!isAuthenticated || !(location.state as {recheckMembership?:boolean}|null)?.recheckMembership || membershipReturnChecked.current===location.key)return
    membershipReturnChecked.current=location.key
    void refreshUser()
  }, [location.key,location.state,isAuthenticated,refreshUser])

  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]') || document.createElement('meta')
    const existed = meta.isConnected, previous = meta.content
    meta.name = 'robots'; meta.content = 'noindex,follow'
    if (!existed) document.head.appendChild(meta)
    return () => { if (existed) meta.content = previous; else meta.remove() }
  }, [])

  useEffect(() => {
    if (!data) return
    const key = `${token}:${data.version}`
    if (tracked.current === key) return
    tracked.current = key
    trackingService.track('company_top100_view', {page_key:'company_top100',event_family:'browse',ranking_version:data.version})
  }, [data,token])

  useEffect(() => {
    if (!data || restored.current) return
    restored.current = true
    let scroll = 0
    try { scroll = Number(sessionStorage.getItem(`hg-top100-scroll:${currentPath}`)) || 0 } catch { /* Browsing still works without storage. */ }
    if (scroll) requestAnimationFrame(() => window.scrollTo({ top: scroll }))
  }, [data, currentPath])

  const industries = useMemo(() => [...new Set(data?.companies.map(row => row.industry).filter(Boolean) || [])].sort(), [data])
  const filtered = useMemo(() => {
    const needle = query.trim().normalize('NFKC').toLowerCase()
    return (data?.companies || []).filter(row => (!needle || `${row.name} ${row.industry} ${row.roles.join(' ')}`.normalize('NFKC').toLowerCase().includes(needle)) && (!tier || row.tier === tier) && (!industry || row.industry === industry) && (!remote || row.remoteClass === remote) && (!contract || row.contractClass === contract))
  }, [data, query, tier, industry, remote, contract])

  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
    if (key !== 'q' && key !== 'expanded') trackingService.track('company_top100_filter', { page_key: 'company_top100', filter_key: key, filter_value: value, ranking_version: data?.version || '' })
  }
  const openCompany = (entry: CompanyTop100Entry, target: string) => {
    try { sessionStorage.setItem(`hg-top100-scroll:${currentPath}`, String(window.scrollY)) } catch { /* Return link remains usable. */ }
    trackingService.track('company_top100_company_click', { page_key: 'company_top100', source_key: 'company_top100', entity_type: 'company', entity_id: entry.companyId, rank: entry.rank, ranking_version: data?.version || '', target })
  }
  const companyUrl = (entry: CompanyTop100Entry, jobs = false) => `${withReturnTo(path(`/company/${encodeURIComponent(entry.companyId)}`), currentPath)}&source=company_top100${jobs ? '#company-profile-open-roles' : ''}`
  const showGate = !authLoading && (!canRead || status === 'denied' || sessionExpired)
  const aCount = data?.companies.filter(row => row.tier === 'A').length || 0
  const weights = data?.weights || DEFAULT_WEIGHTS

  return <div className="hg-top100-page"><div className="haigoo-shell hg-top100">
    <Link to={path('/trusted-companies')} className="hg-top100__back"><ArrowLeft size={15} aria-hidden="true" />{text('远程企业','Remote companies')}</Link>
    <header className="hg-top100-hero">
      <div className="hg-top100-hero__mark" aria-label="Top 100"><span>TOP</span><strong>100</strong></div>
      <div className="hg-top100-hero__body">
        <h1>{isEnglish ? 'Remote companies worth following from mainland China' : <><span className="hg-top100-hero__headline-line">中国大陆候选人</span><span className="hg-top100-hero__headline-line">值得关注的远程企业</span></>}</h1>
        <p>{text('从现有企业库出发，综合大陆招聘线索、远程协作、签约支付与时区条件，整理值得优先关注的 100 家企业。','A researched shortlist of 100 employers, assessed for mainland eligibility, remote work, contracts, time zones and company fundamentals.')}</p>
        <div className="hg-top100-hero__meta"><span><Crown size={14} aria-hidden="true" />{text('正式会员专属','Full-member research')}</span><span>{data?.researchedAt || '2026-10-10'} {text('研究版','research edition')}</span></div>
      </div>
    </header>

    {showGate ? <section className="hg-top100-gate" aria-labelledby="top100-access-title">
      <LockKeyhole size={24} aria-hidden="true" /><div><h2 id="top100-access-title">{text('把企业研究，变成下一步行动','Turn company research into your next step')}</h2>
      <p>{text('正式会员可查看完整排名、企业的大陆申请条件与评分依据，并进入企业详情查看岗位。','Full members can explore the complete ranking, mainland conditions and research evidence, then view company profiles and openings.')}</p>
      <ul><li>{text('100 家企业的研究排名','100 researched employer profiles')}</li><li>{text('大陆资格、合同与时区条件','Mainland eligibility, contracts and working hours')}</li><li>{text('官方来源与岗位入口','Official evidence and routes to openings')}</li></ul>
      {sessionExpired ? <p className="hg-top100-gate__status">{text('登录状态已失效，请重新登录后继续。','Your session has ended. Log in again to continue.')}</p> : memberExpired ? <p className="hg-top100-gate__status">{text('当前会员权益已到期，续费后可返回查看完整榜单。','Your membership has ended. Renew and return to view the full ranking.')}</p> : capabilities.isTrialMember ? <p className="hg-top100-gate__status">{text('你当前是体验周会员，完整榜单属于正式会员权益。','Your current trial does not include the full-member ranking.')}</p> : status === 'denied' && isAuthenticated ? <p className="hg-top100-gate__status">{text('当前账号尚未获得有效的正式会员权限，可查看权益或刷新会员状态。','This account has no verified active full-member access. Review benefits or refresh your membership.')}</p> : null}
      <div className="hg-top100-gate__actions">{(!isAuthenticated || sessionExpired) ? <Link onClick={() => { if(sessionExpired) logout() }} className="hg-top100-action" to={path(`/login?redirect=${encodeURIComponent(currentPath)}`)}>{sessionExpired ? text('重新登录','Log in again') : text('登录查看','Log in to view')}<ArrowRight size={16} aria-hidden="true" /></Link> : <Link className="hg-top100-action" to={path(top100ProfilePath('membership',currentPath))}>{text('查看正式会员权益','View full-member benefits')}<ArrowRight size={16} aria-hidden="true" /></Link>}
        {!isAuthenticated && <Link to={path(`/login?redirect=${encodeURIComponent(path(top100ProfilePath('membership',currentPath)))}`)}>{text('了解会员权益','Membership benefits')}</Link>}
        {isAuthenticated && !sessionExpired && <button type="button" onClick={async () => { await refreshUser(); retry() }}>{text('刷新会员状态','Refresh membership')}</button>}
      </div></div>
    </section> : authLoading || (canRead && status === 'loading' && !data) ? <div className="hg-top100-loading" aria-busy="true" aria-label={text('正在核验会员并载入榜单','Verifying access and loading ranking')}><span /><span /><span /></div> : canRead && status === 'error' ? <section className="hg-top100-error"><h2>{text('榜单暂时无法载入','The ranking could not be loaded')}</h2><p>{text('暂时无法获取榜单，请重试；你的筛选条件会保留。','The ranking is temporarily unavailable. Retry with your filters intact.')}</p><button type="button" className="hg-top100-action" onClick={retry}>{text('重新载入','Retry')}</button></section> : data ? <>
      <div className="hg-top100-overview"><p>{text(`${aCount} 家有大陆远程线索 · ${data.total-aCount} 家大陆资格待确认`, `${aCount} with mainland remote evidence · ${data.total-aCount} needing mainland confirmation`)}</p>{refreshing && <span className="hg-top100-revalidating" role="status">{text('正在核验会员状态…','Checking membership…')}</span>}<a href="#top100-method">{text('了解评分规则','How we assess employers')}<ArrowRight size={14} aria-hidden="true" /></a></div>
      <section className="hg-top100-filters" aria-label={text('搜索和筛选榜单','Search and filter ranking')}>
        <label className="hg-top100-search"><Search size={18} aria-hidden="true" /><span className="sr-only">{text('搜索企业、行业或参考岗位','Search companies, industries or reference roles')}</span><input type="search" value={query} onChange={event => change('q', event.target.value)} placeholder={text('搜索企业、行业或参考岗位','Search a company, industry or role')} />{query && <button type="button" onClick={() => change('q','')} aria-label={text('清除关键词','Clear keyword')}><X size={16} aria-hidden="true" /></button>}</label>
        <div className="hg-top100-filter-options">
          <label><span>{text('行业','Industry')}</span><select value={industry} onChange={event => change('industry',event.target.value)}><option value="">{text('全部行业','All industries')}</option>{industries.map(value => <option value={value} key={value}>{value}</option>)}</select></label>
          <label><span>{text('远程制度','Remote culture')}</span><select value={remote} onChange={event => change('remote',event.target.value)}><option value="">{text('全部方式','All arrangements')}</option>{Object.entries(REMOTE_LABELS).map(([key, labels]) => <option value={key} key={key}>{text(labels[0], labels[1])}</option>)}</select></label>
          <label><span>{text('合同模式','Contract evidence')}</span><select value={contract} onChange={event => change('contract',event.target.value)}><option value="">{text('全部模式','All modes')}</option>{Object.entries(CONTRACT_LABELS).map(([key,labels]) => <option value={key} key={key}>{text(labels[0], labels[1])}</option>)}</select></label>
        </div>
        <div className="hg-top100-filter-bottom"><div className="hg-top100-scope" role="group" aria-label={text('大陆申请资格','Mainland eligibility')}>
          {[['',text('全部 100','All 100')],['A',text(`大陆线索 ${aCount}`,`Mainland evidence ${aCount}`)],['B',text(`资格待确认 ${data.total-aCount}`,`Eligibility unconfirmed ${data.total-aCount}`)]].map(([value,label]) => <button type="button" key={value} aria-pressed={tier===value} onClick={() => change('tier',value)}>{label}</button>)}
        </div><span className="hg-top100-filter-result" aria-live="polite">{text(`显示 ${filtered.length} / 100 家`,`${filtered.length} / 100 employers`)}{(query||tier||industry||remote||contract) && <button type="button" onClick={() => setParams({}, { replace: true })}>{text('清除筛选','Clear filters')}</button>}</span></div>
      </section>
      <p className="hg-top100__scope-note">{text('名次为本研究版原排名；站内岗位不限大陆，申请条件请查看具体职位。','Ranks retain their research-edition order. Site openings may include other locations; check each role’s conditions.')}</p>
      {filtered.length ? <ol className="hg-top100-list" aria-label={text('企业关注排名','Company attention ranking')}>{filtered.map(entry => <li value={entry.rank} key={entry.companyId} id={`ranking-${entry.companyId}`} className="hg-top100-row" data-unavailable={entry.availability === 'unavailable'}>
        <div className="hg-top100-row__main">
          <span className="hg-top100-row__rank" aria-label={text(`原榜单第 ${entry.rank} 名`,`Original rank ${entry.rank}`)}>#{entry.rank}</span><RankingLogo entry={entry} />
          <div className="hg-top100-row__identity"><h2>{entry.availability === 'unavailable' ? entry.name : <Link to={companyUrl(entry)} onClick={() => openCompany(entry,'profile')}>{entry.name}</Link>}</h2><p>{entry.industry}</p><span className="hg-top100-row__role">{entry.roles[0] || text('企业政策关注 · 当前岗位待核','Company policy watch · current role unverified')}</span></div>
          <div className="hg-top100-row__conditions"><strong className={entry.tier==='A' ? 'is-mainland' : ''}>{entry.tier==='A' ? text('有大陆远程线索','Mainland remote evidence') : text('大陆资格待确认','Mainland eligibility unconfirmed')}</strong><div><span>{text(REMOTE_LABELS[entry.remoteClass][0], REMOTE_LABELS[entry.remoteClass][1])}</span><span>{text(CONTRACT_LABELS[entry.contractClass][0], CONTRACT_LABELS[entry.contractClass][1])}</span></div>
          {entry.applicationNote && <p className="hg-top100-row__restriction">{entry.opportunityScore===0 ? `${data.researchedAt} ${text('记录','record')}: ` : ''}{entry.applicationNote}</p>}
          {entry.opportunityScore===0 ? <small>{text('研究时暂无开放岗位／仅人才池','No opening / talent pool at review')}</small> : entry.opportunityScore===2 ? <small>{text('研究参考岗位状态待核','Reference openings unverified')}</small> : null}</div>
          <div className="hg-top100-row__score"><strong>{entry.score.toFixed(1)}</strong><span>/ 100</span><small>{text('综合关注分','Research score')}</small></div>
          <div className="hg-top100-row__actions">{entry.availability==='unavailable' ? <span className="hg-top100-row__unavailable">{text('企业资料当前不可用','Profile unavailable')}</span> : <Link to={companyUrl(entry,true)} onClick={() => openCompany(entry,'jobs')}>{text('查看企业与岗位','Profile & openings')}<ArrowRight size={15} aria-hidden="true" /></Link>}<small>{entry.jobCount===null ? text('岗位信息待更新','Opening count unavailable') : text(`站内岗位 · ${entry.jobCount}`,`Site openings · ${entry.jobCount}`)}</small>
          <button type="button" aria-expanded={expanded===entry.companyId} aria-controls={`evidence-${entry.companyId}`} onClick={() => { change('expanded',expanded===entry.companyId?'':entry.companyId); if(expanded!==entry.companyId)trackingService.track('company_top100_evidence_open',{page_key:'company_top100',entity_id:entry.companyId,ranking_version:data.version,rank:entry.rank}) }}>{expanded===entry.companyId ? text('收起研究说明','Close research notes') : text('查看研究说明','Research notes')}<ChevronDown size={14} aria-hidden="true" /></button></div>
        </div><div id={`evidence-${entry.companyId}`} hidden={expanded!==entry.companyId}>{expanded===entry.companyId && <CompanyRankingEvidence entry={entry} weights={weights} version={data.version} returnTo={currentPath} />}</div>
      </li>)}</ol> : <section className="hg-top100-empty"><h2>{text('没有符合这些条件的企业','No employers match these filters')}</h2><p>{text('试试缩短关键词，或清除一个筛选条件。','Try a shorter keyword or remove a filter.')}</p><button type="button" className="hg-top100-action" onClick={() => setParams({}, { replace: true })}>{text('查看全部 100 家','View all 100')}</button></section>}
    </> : null}

    <section className="hg-top100-method" id="top100-method"><h2>{text('我们如何评估企业','How we assess employers')}</h2><p>{text('综合关注分衡量企业值得优先研究的程度，不是个人匹配分，也不保证任何岗位都能从大陆申请。','The score prioritizes employer research. It is not a personal match score or a guarantee that a role accepts mainland applicants.')}</p><dl>{RANKING_FACTORS.map(([key,zh,en]) => <div key={key}><dt>{text(zh,en)}</dt><dd>{weights[key]}%</dd></div>)}</dl>
      <details><summary>{text('查看评分和信息口径','Scoring and evidence policy')}</summary><div><p>{text('只使用有依据的信息计分，未确认的合同或工时不会自动得到高分。未知不代表企业表现差；少量分差应结合职业、资历与具体岗位判断。','Only supported information contributes to the score. Unknown contracts or hours do not receive assumed high scores. Unknown is not poor performance; small differences should be considered alongside the role and your experience.')}</p><p>{text('“有大陆远程线索”可能包含城市、出差、排班或专业资格要求；“大陆资格待确认”是全球／区域远程政策，仍需询问是否可长期从大陆履职。','Mainland evidence may still include city, travel, shift or qualification limits. Regional or global remote policies still require confirmation of long-term work from mainland China.')}</p><p>{text('Full-time 只是工作时长，不足以证明直接雇佣。EoR 服务商提供的产品不证明其内部员工使用 EoR。','Full-time describes hours, not the signing entity. Offering EoR services does not establish how a company hires its own staff.')}</p><p>{text('员工评价、规模和多数成立年沿用后台记录，未完成全面实时核验。岗位数来自站内当前有效记录，不等于大陆可申请数。研究参考岗位和人才池不承诺当前职位或稳定项目量。','Employee ratings, size and most founding years use existing records and have not all been reverified. Current site counts are not mainland-eligible job counts. Reference roles and talent pools do not guarantee an opening or ongoing work.')}</p></div></details>
      <p className="hg-top100-method__feedback">{text('发现岗位关闭、地区限制或合同信息变更？','Found a closed role or a changed location or contract condition?')} <Link to={path(top100ProfilePath('feedback',currentPath,undefined,data?.version))}>{text('反馈给我们','Send feedback')}<ArrowRight size={14} aria-hidden="true" /></Link></p>
      {isEnglish && <p className="hg-top100-method__original">{text('','Detailed research notes retain their original Chinese wording for accuracy.')}</p>}
    </section>
  </div></div>
}
