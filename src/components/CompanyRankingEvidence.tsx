import { ExternalLink } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import type { CompanyTop100Entry, Top100Factor } from '../types/company-top100'

export const RANKING_FACTORS: [Top100Factor, string, string][] = [
  ['mainland','大陆资格与机会','Mainland eligibility & opportunities'], ['remote','企业远程制度','Remote culture'],
  ['payment','签约与支付','Contract & payment'], ['timezone','时区适配','Time-zone fit'],
  ['basics','企业基本面','Company fundamentals'], ['business','业务与异步','Work & asynchronous fit']
]

export default function CompanyRankingEvidence({ entry, weights }: { entry: CompanyTop100Entry; weights: Record<Top100Factor, number> }) {
  const { text, isEnglish } = useLanguage()
  return <div className="hg-top100-evidence">
    <dl className="hg-top100-evidence__scores">{RANKING_FACTORS.map(([key, zh, en]) => <div key={key}>
      <dt>{text(zh,en)}</dt><dd>{entry.components[key] === null ? text('待确认','Unconfirmed') : <>{entry.components[key]}<span> / {weights[key]}</span></>}</dd>
      {entry.unknown[key] && entry.components[key] !== null ? <small>{text('部分信息待确认','Partially unconfirmed')}</small> : key === 'payment' && entry.contractClass === 'employee_unconfirmed' ? <small>{text('签约主体待确认','Signing entity unconfirmed')}</small> : null}
    </div>)}</dl>
    {isEnglish && <p className="hg-top100-evidence__original">Research notes are shown in their original Chinese wording.</p>}
    <div className="hg-top100-evidence__body">
      <section><h3>{text('申请前先了解','Before you apply')}</h3><dl className="hg-top100-evidence__facts">
        <div><dt>{text('大陆申请','Mainland eligibility')}</dt><dd>{entry.geoNote}</dd></div>
        <div><dt>{text('远程方式','Remote work')}</dt><dd>{entry.remoteNote}</dd></div>
        <div><dt>{text('合同支付','Contract & payment')}</dt><dd>{entry.contractNote}</dd></div>
        <div><dt>{text('工作时段','Working hours')}</dt><dd>{entry.timezoneNote}</dd></div>
      </dl>{entry.notes.length > 0 && <ul className="hg-top100-evidence__notes">{entry.notes.map(note => <li key={note}>{note}</li>)}</ul>}
      {entry.pending && <p className="hg-top100-evidence__pending"><strong>{text('还需确认：','Still to confirm: ')}</strong>{entry.pending}</p>}</section>
      <section><h3>{text('研究依据','Research sources')}</h3>
        <p>{text('参考岗位','Reference roles')}：{entry.roles.join('；') || text('企业政策关注；当前岗位待核','Company policy watch; current roles unverified')}</p>
        <p>{text('人工复核','Reviewed')}：{entry.reviewedAt}</p>
        <ul className="hg-top100-evidence__sources">{entry.sources.map((source, i) => <li key={source}><a href={source} target="_blank" rel="noopener noreferrer">{i+1}. {new URL(source).hostname.replace(/^www\./,'')}<ExternalLink size={13} aria-hidden="true" /></a></li>)}</ul>
        <p className="hg-top100-evidence__basic-note">{text('员工评分、规模和多数成立年沿用后台记录，未全面实时核验。','Employee ratings, size and most founding years use existing database records and have not all been reverified.')}</p>
        <p className="hg-top100-evidence__basic-note">{text('经营起源','Business origin')}：{entry.basics.foundedYear || text('待补充','Unconfirmed')} · {entry.basics.employeeCount || text('规模待补充','Size unconfirmed')}{entry.basics.rating !== null ? ` · Glassdoor ${entry.basics.rating}/5` : ''}</p>
      </section>
    </div>
  </div>
}
