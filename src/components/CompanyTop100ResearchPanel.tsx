import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useCompanyTop100 } from '../hooks/useCompanyTop100'
import CompanyRankingEvidence from './CompanyRankingEvidence'

export default function CompanyTop100ResearchPanel({companyId,returnTo}:{companyId:string;returnTo:string}) {
  const [open,setOpen] = useState(false)
  const {text,path} = useLanguage(), location = useLocation(), {logout,isAuthenticated} = useAuth()
  const {canRead,data,status,sessionExpired,retry,errorStatus} = useCompanyTop100(companyId,open)
  const entry = data?.companies[0]
  const panelId = `company-top100-research-${companyId}`
  if (!canRead || status === 'denied' || sessionExpired) return <div className="hg-company-ranking-detail">
    <p>{text('Top 100 研究说明属于正式会员权益。','Top 100 company research is a full-member benefit.')}</p>
    <Link to={path((!isAuthenticated || sessionExpired) ? `/login?redirect=${encodeURIComponent(location.pathname+location.search)}` : returnTo)} onClick={() => {if(sessionExpired)logout()}}>{text('前往榜单核验权限','Go to the ranking to verify access')}</Link>
  </div>
  return <div className="hg-company-ranking-detail">
    <button type="button" className="hg-company-ranking-detail__toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value=>!value)}>
      <span>{text('此企业的大陆申请与合同研究','Mainland eligibility and contract research')}{entry && <small>#{entry.rank} · {entry.score.toFixed(1)} / 100 · {data.researchedAt}</small>}</span><ChevronDown size={18} aria-hidden="true" />
    </button>
    <div id={panelId} hidden={!open}>{open && (entry ? <CompanyRankingEvidence entry={entry} weights={data.weights} version={data.version} returnTo={returnTo} /> : status === 'error' ? <div className="hg-company-ranking-detail__status"><p>{errorStatus===404 ? text('该企业不在当前研究版中。','This company is not included in the current research edition.') : text('研究说明暂不可用，可重新载入。','Research is temporarily unavailable. Try loading it again.')}</p>{errorStatus!==404 && <button type="button" onClick={retry}>{text('重新载入研究说明','Retry company research')}</button>}</div> : <p role="status">{text('正在核验权限并载入研究说明…','Verifying access and loading company research…')}</p>)}</div>
  </div>
}
