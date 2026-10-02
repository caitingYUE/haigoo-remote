import { useEffect, useRef, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { ListCheckRun, ListCheckState, listCheckLabel, listCheckRequest } from '../services/company-list-check-service'

export interface CheckCompany { id: string; name: string; careersPage?: string }
interface Props { companies: CheckCompany[]; page: number; requestId: string; start: boolean; reset?: boolean; onClose: () => void; onChanged: () => void; onManageJobs: (id: string) => void }
const safeUrl = (url?: string) => /^https?:\/\//i.test(url || '') ? url : undefined
export default function CompanyListCheckPanel({companies,page,requestId,start,reset,onClose,onChanged,onManageJobs}: Props) {
  const [states,setStates]=useState<Record<string,ListCheckState>>({}),[run,setRun]=useState<ListCheckRun>(),[error,setError]=useState(''),[running,setRunning]=useState(start),[focus,setFocus]=useState(companies[0]?.id),[working,setWorking]=useState('')
  const panel=useRef<HTMLDivElement>(null),onChangedRef=useRef(onChanged)
  onChangedRef.current=onChanged
  const refresh=async()=> { const data=await listCheckRequest(undefined,{companyIds:companies.map(c=>c.id).join(',')});setStates(data.states || {}) }
  useEffect(()=>{
    const prior=document.activeElement as HTMLElement, overflow=document.body.style.overflow
    document.body.style.overflow='hidden';panel.current?.focus()
    return()=>{document.body.style.overflow=overflow;prior?.focus()}
  },[])
  useEffect(()=>{
    let stopped=false
    const update=async()=> { const r=await listCheckRequest(undefined,{companyIds:companies.map(c=>c.id).join(',')});if(!stopped)setStates(r.states || {}) }
    void (async()=>{
      try {
        if(!start) {await update();return}
        const response=await listCheckRequest({action:'start',companyIds:companies.map(c=>c.id),requestId,reset:!!reset})
        if(stopped)return
        const current=response.run!;setRun(current)
        await update()
        let index=0, failed=false
        const worker=async()=> {
          while(!stopped && !failed && index<companies.length) {
            const co=companies[index++]
            setRun(prev=>prev && {...prev,attempts:prev.attempts.map(a=>a.company_id===co.id?{...a,status:'running'}:a)})
            const result=await listCheckRequest({action:'step',runId:current.id,companyId:co.id})
            if(stopped)return
            if(result.busy) {setError('有企业正在另一项检查中，本次未重复请求。请稍后重新检查。')}
            // Merge only this worker's company: the other worker may already
            // have completed after the server captured this response.
            const attempt=result.run?.attempts.find(a=>a.company_id===co.id)
            if(attempt)setRun(prev=>prev && {...prev,attempts:prev.attempts.map(a=>a.company_id===co.id?attempt:a)})
            const latest=await listCheckRequest(undefined,{companyId:co.id})
            if(stopped)return
            setStates(prev=>({...prev,...latest.states}))
          }
        }
        const results=await Promise.allSettled([worker().catch(e=>{failed=true;throw e}),worker().catch(e=>{failed=true;throw e})])
        const rejected=results.find(r=>r.status==='rejected')
        if(rejected?.status==='rejected')throw rejected.reason
      } catch(e) {if(!stopped)setError((e as Error).message)}
      finally {if(!stopped)setRunning(false);onChangedRef.current()}
    })()
    return()=>{stopped=true}
  },[requestId])
  const state=states[focus],company=companies.find(c=>c.id===focus),done=run?.attempts.filter(a=>['complete','skipped','stale','error'].includes(a.status)).length || 0
  const dismiss=async(key:string)=>{
    setWorking(key);setError('')
    try {const result=await listCheckRequest({action:'dismiss',companyId:focus,key,checkedAt:state.checked_at});setStates(prev=>({...prev,...result.states}));panel.current?.focus();onChanged()}catch(e){setError((e as Error).message)}finally{setWorking('')}
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
    <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="list-check-title" className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-xl outline-none" onKeyDown={e=>{
      if(e.key==='Escape')onClose()
      if(e.key==='Tab') {const nodes=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],select,summary') || []).filter(node=>node.getClientRects().length>0);if(!nodes?.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}
    }}>
      <header className="flex items-start justify-between gap-4 border-b p-5"><div><h2 id="list-check-title" className="text-xl font-semibold">更新检查</h2><p className="mt-2 text-sm text-slate-600">第 {page} 页 · 本次 {companies.length} 家企业。检查招聘列表中的新增和疑似失效，岗位由人工管理。</p><p role="status" className="mt-2 text-sm text-[#466f9d]">{running?`正在检查 · ${done} / ${companies.length} 家已完成`:start?`本次已结束 · ${done} / ${companies.length} 家已完成`:'已保存的检查结果'}</p></div><button aria-label="关闭更新检查" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100"><X size={22}/></button></header>
      {error&&<div role="alert" className="mx-5 mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{error}<button onClick={()=>void refresh().catch(e=>setError(e.message))} className="ml-3 underline">重新读取结果</button></div>}
      <div className="grid min-h-0 flex-1 overflow-auto md:grid-cols-[250px_1fr]">
        <nav aria-label="本次检查企业" className="border-r bg-slate-50 p-3">{companies.map(co=>{
          const s=states[co.id],a=run?.attempts.find(a=>a.company_id===co.id)
          const text=a?.status==='running'?'检查中':a?.status==='queued'?'等待检查':a?.status==='error'?'检查未完成':a?.status==='stale'?'来源已变化':s?.findings?.length?`${s.findings.filter(f=>f.kind==='new').length} 新增 · ${s.findings.filter(f=>f.kind==='missing').length} 疑似失效`:listCheckLabel(s)
          return <button key={co.id} onClick={()=>setFocus(co.id)} aria-current={focus===co.id?'true':undefined} className={`mb-2 w-full rounded-lg border p-3 text-left text-sm ${focus===co.id?'border-[#466f9d] bg-white':'border-transparent hover:bg-white'}`}><span className="block font-medium">{co.name}</span><span className="mt-1 block text-xs text-slate-500">{text}</span></button>
        })}</nav>
        <section className="min-w-0 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-semibold">{company?.name}</h3><button onClick={()=>onManageJobs(focus)} className="rounded-lg border px-3 py-2 text-sm text-[#466f9d]">管理企业岗位</button></div>
          {safeUrl(company?.careersPage)&&<a href={safeUrl(company?.careersPage)} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-[#466f9d] underline">打开招聘网站<ExternalLink size={14}/></a>}
          <p className="mt-3 text-xs text-slate-500">{state?.checked_at?`最近检查：${new Date(state.checked_at).toLocaleString('zh-CN')}`:'尚无检查记录'}{state?.listed_count!==undefined?` · 读取 ${state.listed_count} 个岗位，${state.pages} 页`:''}</p>
          {[...(run?.attempts.find(a=>a.company_id===focus && ['error','stale'].includes(a.status))?.result?.reasons || []),...(state?.reasons||[])].map(reason=><p key={reason} className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{reason}</p>)}
          {state?.status==='skipped'&&<p className="mt-2 text-sm text-slate-600">后续批量检查会跳过本企业。可在企业名称旁点击重置重新检查。</p>}
          {!state?.findings?.length&&<p className="my-6 text-sm text-slate-500">{state?.status==='checked'?'本次未发现需要处理的变化。':'暂无已确认的新增或疑似失效提醒。'}</p>}
          {state?.findings?.map(f=><article key={f.key} className="mt-4 rounded-xl border p-4"><span className={`rounded px-2 py-1 text-xs ${f.kind==='new'?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-900'}`}>{f.kind==='new'?'有新增':'疑似失效'}</span><h4 className="mt-3 font-medium">{f.title}</h4>{f.location&&<p className="mt-1 text-sm text-slate-600">{f.location}</p>}<p className="mt-2 text-sm text-slate-500">{f.reason}</p><p className="mt-1 text-xs text-slate-400">发现于 {new Date(f.detectedAt).toLocaleString('zh-CN')}</p><div className="mt-3 flex flex-wrap gap-4 text-sm">{safeUrl(f.url)&&<a href={safeUrl(f.url)} target="_blank" rel="noreferrer" className="text-[#466f9d] underline">打开岗位原页</a>}<button disabled={!!working||running||state.checking} onClick={()=>void dismiss(f.key)} className="text-slate-600 underline disabled:opacity-40">{working===f.key?'正在保存…':f.kind==='new'?'忽略此岗位':'确认仍有效'}</button></div></article>)}
          {!!state?.candidate_count&&<details className="mt-5 rounded-lg border p-3 text-sm"><summary className="cursor-pointer">{state.candidate_count} 个岗位需要人工判断地区或远程方式</summary>{state.candidates?.map((c,i)=><div key={c.url+i} className="mt-3 border-t pt-3"><a href={safeUrl(c.url)} target="_blank" rel="noreferrer" className="text-[#466f9d] underline">{c.title}</a><p className="mt-1 text-xs text-slate-500">{c.location || '列表未提供地区'} · {c.reason}</p></div>)}{state.candidate_count>100&&<p className="mt-3 text-xs">仅展示前 100 项，请打开招聘网站查看完整列表。</p>}</details>}
        </section>
      </div>
      <footer className="flex items-center justify-between gap-3 border-t p-4"><p className="text-xs text-slate-500">{running?'关闭后停止后续企业检查，已开始的检查会保存结果。':'忽略或确认只清除提醒；岗位内容和状态保持原样。'}</p><button onClick={onClose} className="rounded-lg bg-[#466f9d] px-4 py-2 text-sm text-white">{running?'关闭':'完成'}</button></footer>
    </div>
  </div>
}
