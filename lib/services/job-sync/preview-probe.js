import { scanListing } from './list-scanner.js'
import { fetchPublic } from './http.js'
import { compareListing } from './list-policy.js'
// Imported only by the temporary authenticated Preview release diagnostic.
// Reads real sources and saved URLs without starting tasks or mutating jobs.
import { db } from './store.js'
import { manualWorkflow } from './manual-workflow.js'
import { scanPage, verifyPosting } from './adapters.js'
import { postingIdentity } from './url-checks.js'

const names = new Set(['Braintrust','RWS','Telnyx','The Meliore Foundation','Manicule','澳大利亚格里菲斯大学','AB Agri','花旗','Hackmamba','Cochrane','Cummins 康明斯','Pearson 培生','AG1','Xsolla','RZR','Scalerrs','The Authentic Asian','NewPath Conveyancing'])
export async function probePreviewSource(name, mode) {
  if (process.env.VERCEL_ENV !== 'preview' || !names.has(name) || !['crawl','verify','listing'].includes(mode)) throw new Error('Probe is not allowed')
  const [company] = await db("SELECT * FROM trusted_companies WHERE name=$1 AND status='active'", [name])
  if (!company) throw new Error('Preview sample company is missing')
  const signal = AbortSignal.timeout(35000)
  if (mode === 'listing') {
    const requests=[]
    const result=await scanListing({url:company.careers_page},{signal,fetcher:async(url,options)=>{requests.push(url);return fetchPublic(url,options)}})
    const jobs=await db('SELECT job_id,title,url,status,is_approved,crawl_deleted_at FROM jobs WHERE company_id=$1',[company.company_id])
    const comparison=compareListing({url:company.careers_page},result,jobs)
    return {name,mode,pages:result.pages,listed:result.jobs.length,complete:result.complete,requestCount:requests.length,requests,new:comparison.findings.filter(f=>f.kind==='new').length,missing:comparison.findings.filter(f=>f.kind==='missing').length,unknown:comparison.unknown,reasons:comparison.reasons}
  }
  if (mode === 'verify') {
    const [job] = await db("SELECT title,url FROM jobs WHERE company_id=$1 AND status='active' AND is_approved IS TRUE AND url LIKE 'https://%' ORDER BY job_id LIMIT 1", [company.company_id])
    if (!job) return {name,mode,state:'unknown',reason:'没有可检查的已发布申请链接'}
    const identity = postingIdentity(job.url)
    return {name,mode,url:job.url,...(identity ? await verifyPosting({payload:job,external_id:identity},{signal}) : {state:'unknown',reason:'通用页面不能确认单个岗位是否失效'})}
  }
  const source = await manualWorkflow.sourceFor(company)
  let cursor = null
  try {
    for (let step=0;step<3;step++) {
      const page = await scanPage(source,cursor,{signal})
      const valid = page.jobs.filter(job => job.title && job.url && job.description?.length>=50 && !job.detail_error)
      if (page.jobs.length || !page.next) {
        const sample=valid.find(job=>job.field_evidence?.salary?.length)
        return {name,mode,adapter:source.adapter,jobs:page.jobs.length,validSamples:valid.length,complete:page.complete,reason:page.reason,samples:valid.slice(0,2).map(job=>({title:job.title,url:job.url,descriptionLength:job.description.length})),fieldSample:sample ? {title:sample.title,url:sample.url,salary:sample.salary,location:sample.location,job_type:sample.job_type,is_remote:sample.is_remote,evidence:sample.field_evidence}:undefined}
      }
      cursor=page.next
    }
    return {name,mode,validSamples:0,reason:'招聘入口尚未找到岗位样本'}
  } catch (error) { return {name,mode,validSamples:0,error:error.message} }
}
