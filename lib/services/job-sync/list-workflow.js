import { randomUUID } from 'node:crypto'
import { db } from './store.js'
import { scanListing, isLinkedIn } from './list-scanner.js'
import { compareListing, visibleFindings } from './list-policy.js'
import { SourceError } from './http.js'

const idsOf=value=>[...new Set((Array.isArray(value)?value:String(value||'').split(',')).map(String).filter(Boolean))]
const json=JSON.stringify
const fail=message=>{throw new Error(message)}
const empty=(co)=>({company_id:co.company_id,source_url:co.careers_page||'',status:isLinkedIn(co.careers_page)?'skipped':'unchecked',failures:0,findings:[],dismissed:[],reasons:isLinkedIn(co.careers_page)?['LinkedIn 无法读取公开招聘列表，请人工检查或更换来源']:[],candidates:[],candidate_count:0})

export function createListWorkflow({query=db,scan=scanListing}={}) {
  const q=query
  const companies=ids=>q("SELECT company_id,name,careers_page FROM trusted_companies WHERE company_id=ANY($1::text[]) AND status='active'",[ids])
  const jobs=id=>q(`SELECT job_id,title,url,status,is_approved,to_jsonb(j)->>'crawl_deleted_at' AS crawl_deleted_at FROM jobs j WHERE company_id=$1`,[id])
  async function get(params={}) {
    if(params.runId) {
      const [run]=await q('SELECT * FROM company_list_check_runs WHERE id=$1',[String(params.runId)])
      if(!run) fail('检查记录不存在')
      const attempts=await q(`SELECT company_id,company_name,status,jsonb_build_object('reasons',result->'reasons','checked_at',result->'checked_at','listed_count',result->'listed_count','pages',result->'pages') AS result FROM company_list_check_attempts WHERE run_id=$1 ORDER BY array_position($2::text[],company_id)`,[run.id,run.company_ids])
      return {success:true,run:{id:run.id,companyIds:run.company_ids,attempts}}
    }
    const ids=idsOf(params.companyIds||params.companyId)
    if(ids.length>100) fail('每次最多读取 100 家企业')
    const [cos,rows,allJobs]=await Promise.all([companies(ids),q('SELECT * FROM company_list_check_states WHERE company_id=ANY($1::text[])',[ids]),q(`SELECT company_id,job_id,title,url,status,is_approved,to_jsonb(j)->>'crawl_deleted_at' AS crawl_deleted_at FROM jobs j WHERE company_id=ANY($1::text[])`,[ids])])
    const states={}
    for(const co of cos) {
      const r=rows.find(r=>r.company_id===co.company_id), state=r&&r.source_url===(co.careers_page||'')?r:empty(co)
      const {lease_token,lease_until,actor,dismissed,...view}=state
      states[co.company_id]={...view,findings:visibleFindings(state,allJobs.filter(j=>j.company_id===co.company_id)),checking:!!lease_until&&Date.parse(lease_until)>Date.now()}
    }
    return {success:true,states}
  }
  async function start(body,actor) {
    const ids=idsOf(body.companyIds)
    if(!ids.length||ids.length>100||typeof body.requestId!=='string'||body.requestId.length>150||!body.requestId) fail('缺少当前页企业或检查标识')
    if(body.reset && ids.length!==1) fail('重置一次只处理一家企业')
    const cos=await companies(ids)
    if(cos.length!==ids.length) fail('企业范围已变化，请刷新页面')
    const [run]=await q(`WITH saved AS (
      INSERT INTO company_list_check_runs(id,actor,request_id,company_ids,reset) VALUES($1,$2,$3,$4,$5)
      ON CONFLICT(actor,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *
    ), attempts AS (
      INSERT INTO company_list_check_attempts(run_id,company_id,company_name,source_url)
      SELECT s.id,c.company_id,c.name,COALESCE(c.careers_page,'') FROM saved s JOIN trusted_companies c ON c.company_id=ANY(s.company_ids)
      ON CONFLICT DO NOTHING
    ) SELECT * FROM saved`,[randomUUID(),actor,body.requestId,ids,!!body.reset])
    if(json(run.company_ids)!==json(ids)||run.reset!==!!body.reset) fail('REQUEST_CONFLICT：检查标识已用于其他范围')
    return get({runId:run.id})
  }
  async function step(body,actor) {
    const [attempt]=await q(`SELECT a.*,r.actor,r.reset FROM company_list_check_attempts a JOIN company_list_check_runs r ON r.id=a.run_id WHERE a.run_id=$1 AND a.company_id=$2`,[String(body.runId||''),String(body.companyId||'')])
    if(!attempt||attempt.actor!==actor) fail('检查范围或操作者不匹配')
    if(['complete','skipped','stale','error'].includes(attempt.status)) return get({runId:attempt.run_id})
    const [co]=await companies([attempt.company_id])
    if(!co||(co.careers_page||'')!==attempt.source_url) {
      await q("UPDATE company_list_check_attempts SET status='stale',finished_at=NOW(),result=$3 WHERE run_id=$1 AND company_id=$2",[attempt.run_id,attempt.company_id,json({reasons:['企业或招聘链接已变化，请重新发起检查']})])
      return get({runId:attempt.run_id})
    }
    await q('INSERT INTO company_list_check_states(company_id) VALUES($1) ON CONFLICT DO NOTHING',[co.company_id])
    const token=randomUUID()
    const [state]=await q(`WITH claimed AS (
      UPDATE company_list_check_states s SET lease_token=$2,lease_until=NOW()+INTERVAL '60 seconds'
      WHERE s.company_id=$1 AND (s.lease_until IS NULL OR s.lease_until<NOW())
      AND EXISTS(SELECT 1 FROM company_list_check_attempts WHERE run_id=$3 AND company_id=$1 AND status IN ('queued','running')) RETURNING s.*
    ), started AS (
      UPDATE company_list_check_attempts SET status='running',started_at=NOW() WHERE run_id=$3 AND company_id=$1 AND EXISTS(SELECT 1 FROM claimed)
    ) SELECT * FROM claimed`,[co.company_id,token,attempt.run_id])
    if(!state) return {success:true,busy:true,...await get({runId:attempt.run_id})}
    const previous=state.source_url===attempt.source_url?state:empty(co)
    let final, status='complete'
    try {
      if(isLinkedIn(attempt.source_url)||(!attempt.reset&&previous.status==='skipped')) {
        status='skipped';final={...previous,failures:attempt.reset?0:previous.failures,status:'skipped',reasons:isLinkedIn(attempt.source_url)?['LinkedIn 无法读取公开招聘列表，请人工检查或更换来源']:previous.reasons,pages:previous.pages||0,listed_count:previous.listed_count||0}
      } else {
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(new SourceError('检查超时','partial')),35000)
        let result
        try { result=await scan({url:attempt.source_url},{signal:controller.signal}) } finally {clearTimeout(timer)}
        const comparison=compareListing({url:attempt.source_url},result,await jobs(co.company_id),previous)
        const failures=comparison.unknown?(attempt.reset?0:previous.failures)+1:0
        final={...comparison,failures,status:failures>=2?'skipped':comparison.unknown?'unknown':'checked',pages:result.pages,listed_count:result.jobs.length,candidate_count:comparison.candidateCount}
      }
      const [saved]=await q(`WITH finished AS (
        UPDATE company_list_check_states SET source_url=$3,status=$4,failures=$5,findings=$6,dismissed=$7,reasons=$8,candidates=$9,candidate_count=$10,
          checked_at=CASE WHEN $15='skipped' AND source_url=$3 THEN COALESCE(checked_at,date_trunc('milliseconds',NOW())) ELSE date_trunc('milliseconds',NOW()) END,lease_token=NULL,lease_until=NULL,actor=$11,pages=$12,listed_count=$13
        WHERE company_id=$1 AND lease_token=$2 AND EXISTS(SELECT 1 FROM trusted_companies WHERE company_id=$1 AND status='active' AND COALESCE(careers_page,'')=$3) RETURNING *
      ) UPDATE company_list_check_attempts SET status=$15,finished_at=NOW(),result=(SELECT to_jsonb(f)-'lease_token'-'lease_until' FROM finished f)
        WHERE run_id=$14 AND company_id=$1 AND EXISTS(SELECT 1 FROM finished) RETURNING company_id`,[
        co.company_id,token,attempt.source_url,final.status,final.failures||0,json(final.findings||[]),json(final.dismissed||[]),json(final.reasons||[]),json(final.candidates||[]),final.candidate_count||0,actor,final.pages||0,final.listed_count||0,attempt.run_id,status
      ])
      if(!saved) await q("UPDATE company_list_check_attempts SET status='stale',finished_at=NOW(),result=$3 WHERE run_id=$1 AND company_id=$2 AND status='running' AND EXISTS(SELECT 1 FROM company_list_check_states WHERE company_id=$2 AND lease_token=$4)",[attempt.run_id,co.company_id,json({reasons:['检查期间招聘链接或操作已变化，本次结果未采用']}),token])
    } catch(error) {
      // Internal failures do not penalize the source or overwrite its alerts.
      await q("UPDATE company_list_check_attempts SET status='error',finished_at=NOW(),result=$3 WHERE run_id=$1 AND company_id=$2 AND EXISTS(SELECT 1 FROM company_list_check_states WHERE company_id=$2 AND lease_token=$4)",[attempt.run_id,co.company_id,json({reasons:['本系统未完成检查，请重新发起；未累计企业失败次数']}),token])
      console.error('[company-list-check]',error.name, String(error.message).slice(0,160))
    } finally {
      await q('UPDATE company_list_check_states SET lease_token=NULL,lease_until=NULL WHERE company_id=$1 AND lease_token=$2',[co.company_id,token])
    }
    return get({runId:attempt.run_id})
  }
  async function dismiss(body,actor) {
    const [state]=await q(`UPDATE company_list_check_states s SET dismissed=s.dismissed||to_jsonb($2::text),actor=$4
      WHERE company_id=$1 AND checked_at=$3::timestamptz AND (lease_until IS NULL OR lease_until<NOW())
      AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.findings) f WHERE f->>'key'=$2)
      AND NOT s.dismissed ? $2 AND EXISTS(SELECT 1 FROM trusted_companies WHERE company_id=$1 AND COALESCE(careers_page,'')=s.source_url)
      RETURNING company_id`,[String(body.companyId||''),String(body.key||''),body.checkedAt,actor])
    if(!state) fail('CONFLICT：提醒已变化或正在检查，请重新读取')
    return get({companyId:state.company_id})
  }
  async function post(body,actor) {
    if(body.action==='start') return start(body,actor)
    if(body.action==='step') return step(body,actor)
    if(body.action==='dismiss') return dismiss(body,actor)
    fail('不支持此检查操作')
  }
  return {get,post}
}
export const listWorkflow=createListWorkflow()
