import { useCallback, useEffect, useState } from 'react'
import { RefreshCw, X, ExternalLink, ChevronDown } from 'lucide-react'

type Fields = Record<
  string,
  string | boolean | string[] | Record<string, unknown> | null
>
type Candidate = {
  id: string
  version: number
  kind: string
  queue: string
  company_id: string
  job_id: string | null
  base_revision: number | null
  current_revision: number | null
  patch: Fields
  before_payload: Fields
  source_payload?: Fields
  eligibility: { status: string; reason: string }
  evidence: Record<string, string>
  deferred_until?: string
  enrichment_status?: string
  enrichment_error?: string
}
type ReviewDraft = {
  version: number
  patch: Fields
  companyId: string
  eligibilityConfirmed: boolean
  reason: string
  reviewDurationMs: number
}
type OwnershipRule = { requiresReview?: boolean; contains?: string }
type Source = {
  companies?: { companyId: string; rule: OwnershipRule }[]
  companyId?: string
  ownershipRule?: OwnershipRule
  id: string
  revision: number
  url: string
  adapter: string
  config: Record<string, unknown>
  capabilities: Record<string, boolean>
  enabled: boolean
  last_success_at?: string
  last_error?: string
  pending_count: number
}
type Data = {
  companyOptions: { company_id: string; name: string }[]
  sources: Source[]
  candidates: Candidate[]
  runs: {
    id: string
    source_id: string
    status: string
    created_at: string
    item_count: number
    mode?: string
    scope_company_id?: string
    preflight_at?: string
    error?: string
    evidence?: {
      preflight_passed?: boolean
      incomplete_details?: number
      samples?: { title: string; url: string; description_length: number }[]
      checks?: { job_id: string; url?: string; state: string; reason: string }[]
    }
  }[]
  sourceJobs: {
    id: string
    title: string
    url: string
    job_id?: string
    version: number
  }[]
  jobs: { job_id: string; title: string; url: string }[]
  outbox: { id: number; last_error?: string }[]
  urlChecks?: {
    job_id: string
    title: string
    url: string
    state: string
    reason: string
    checked_at: string
  }[]
  paused: boolean
  hasMore: boolean
  metrics: {
    enabled_sources: number
    fresh_sources: number
    pending: number
    average_review_wait_hours: number
  }
}
const names: Record<string, string> = {
  title: '岗位名称',
  description: '岗位原文',
  url: '申请链接',
  location: '招聘地域',
  salary: '薪资',
  job_type: '工作类型',
  experience_level: '经验要求',
  category: '岗位分类',
  tags: '标签',
  requirements: '任职要求',
  benefits: '福利',
  is_remote: '远程工作',
  region: '区域',
  timezone: '时区',
  china_friendly: '中国友好',
  published_at: '来源发布日期',
  translations: '中文译文'
}
const kinds: Record<string, string> = {
  create: '新增',
  update: '内容更新',
  close: '关闭',
  reopen: '重新开放'
}
const queues: Record<string, string> = {
  all: '全部待审核',
  changes: '待审核变更',
  baseline: '首次核对 / 存量补录',
  eligibility: '资格待判断',
  manual: '辅助录入'
}
const statusNames: Record<string, string> = {
  queued: '等待检测',
  running: '检测中',
  complete: '检测完成',
  partial: '需复核完整性',
  blocked: '来源访问受限',
  failed: '检测失败',
  cancelled: '已取消'
}
const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#466f9d]'
const buttonClass =
  'rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
const display = (v: unknown) =>
  v == null
    ? '未提供'
    : typeof v === 'boolean'
      ? v
        ? '是'
        : '否'
      : typeof v === 'object'
        ? JSON.stringify(v, null, 2)
        : String(v)
const date = (v?: string) =>
  v ? new Date(v).toLocaleString('zh-CN') : '尚未检测'
export async function jobSyncRequest(
  body?: Record<string, unknown>,
  query = ''
) {
  const response = await fetch(`/api/admin/job-sync${query}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token')}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '操作失败，请重试')
  return result
}

function SourceEditor({
  source,
  companyId,
  save
}: {
  source: Source
  companyId: string
  save: (source: Source) => Promise<void>
}) {
  const initial = {
    ...source,
    companyId,
    ownershipRule:
      source.companies?.find((c) => c.companyId === companyId)?.rule || {}
  }
  const [value, setValue] = useState(initial)
  useEffect(() => setValue(initial), [source.id, source.revision, companyId])
  const cfg = (key: string, label: string) => (
    <label className="text-sm">
      {label}
      <input
        className={inputClass}
        value={String(value.config[key] || '')}
        onChange={(e) =>
          setValue({
            ...value,
            config: { ...value.config, [key]: e.target.value }
          })
        }
      />
    </label>
  )
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {String(source.config.platform || source.adapter)} ·{' '}
        {source.enabled ? '允许人工预检' : '未启用'} · 待审核{' '}
        {source.pending_count || 0}
        <span className="block mt-1 text-gray-500 font-normal">
          最近成功：{date(source.last_success_at)}
        </span>
      </summary>
      {source.last_error && (
        <p className="mt-3 text-sm text-amber-800">{source.last_error}</p>
      )}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm md:col-span-2">
          招聘入口
          <input
            className={inputClass}
            value={value.url}
            onChange={(e) => setValue({ ...value, url: e.target.value })}
          />
        </label>
        <label className="text-sm">
          招聘平台
          <select
            className={inputClass}
            value={value.adapter}
            onChange={(e) => setValue({ ...value, adapter: e.target.value })}
          >
            {[
              'greenhouse',
              'ashby',
              'lever',
              'workable',
              'bamboohr',
              'smartrecruiters',
              'workday',
              'html',
              'feed',
              'manual'
            ].map((a) => (
              <option key={a} value={a}>
                {(
                  {
                    html: '官网页面',
                    feed: '订阅源',
                    manual: '人工核实'
                  } as Record<string, string>
                )[a] || a}
              </option>
            ))}
          </select>
        </label>
        {[
          'greenhouse',
          'ashby',
          'lever',
          'workable',
          'smartrecruiters'
        ].includes(value.adapter) && cfg('board', '招聘账户标识')}
        {value.adapter === 'lever' && (
          <label className="text-sm flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.config.eu === true}
              onChange={(e) =>
                setValue({
                  ...value,
                  config: { ...value.config, eu: e.target.checked }
                })
              }
            />
            欧洲招聘入口
          </label>
        )}
        {value.adapter === 'workday' && (
          <>
            {cfg('tenant', '企业账户')}
            {cfg('site', '招聘站点')}
            {cfg('locale', '语言区域')}
          </>
        )}
        {value.adapter === 'html' && (
          <details className="md:col-span-2">
            <summary className="text-sm cursor-pointer">官网解析配置</summary>
            <div className="grid gap-3 mt-3">
              {cfg('linkSelector', '岗位链接选择器')}
              {cfg('nextSelector', '下一页选择器')}
              {cfg('detailSelector', '正文选择器')}
            </div>
          </details>
        )}
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => setValue({ ...value, enabled: e.target.checked })}
          />
          允许人工预检（不会自动创建采集任务）
        </label>
        <label className="text-sm flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value.capabilities.absence}
            onChange={(e) =>
              setValue({
                ...value,
                capabilities: {
                  ...value.capabilities,
                  absence: e.target.checked
                },
                config: { ...value.config, completeList: e.target.checked }
              })
            }
          />
          已核实完整列表，允许提出缺失建议
        </label>
        {companyId && (
          <>
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={value.ownershipRule.requiresReview === true}
                onChange={(e) =>
                  setValue({
                    ...value,
                    ownershipRule: {
                      ...value.ownershipRule,
                      requiresReview: e.target.checked
                    }
                  })
                }
              />
              新增岗位先人工确认企业归属
            </label>
            <label className="text-sm">
              归属关键词（共享招聘入口时可选）
              <input
                className={inputClass}
                value={value.ownershipRule.contains || ''}
                onChange={(e) =>
                  setValue({
                    ...value,
                    ownershipRule: {
                      ...value.ownershipRule,
                      contains: e.target.value
                    }
                  })
                }
              />
            </label>
          </>
        )}
      </div>
      <button
        className={`${buttonClass} mt-4`}
        onClick={() => void save(value)}
      >
        保存来源设置
      </button>
    </details>
  )
}

function CandidateCard({
  candidate: c,
  companyId,
  companyOptions,
  selected,
  onSelect,
  onDraftChange,
  act
}: {
  candidate: Candidate
  companyId: string
  companyOptions: Data['companyOptions']
  selected: boolean
  onSelect: () => void
  onDraftChange: (id: string, draft: ReviewDraft) => void
  act: (body: Record<string, unknown>) => Promise<void>
}) {
  const [patch, setPatch] = useState(c.patch),
    [accepted, setAccepted] = useState(
      c.kind === 'create' ? Object.keys(c.patch) : ([] as string[])
    ),
    [reason, setReason] = useState(''),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false)
  const [targetCompany, setTargetCompany] = useState(c.company_id || companyId)
  const [reviewStarted] = useState(Date.now)
  const conflict =
    c.job_id && String(c.current_revision) !== String(c.base_revision)
  useEffect(() => {
    setPatch(c.patch)
    setAccepted(c.kind === 'create' ? Object.keys(c.patch) : [])
  }, [c.id, c.version])
  useEffect(() => {
    onDraftChange(c.id, {
      version: c.version,
      patch: Object.fromEntries(accepted.map((k) => [k, patch[k]])),
      companyId: targetCompany,
      eligibilityConfirmed: confirmed,
      reason,
      reviewDurationMs: Date.now() - reviewStarted
    })
  }, [
    patch,
    accepted,
    targetCompany,
    confirmed,
    reason,
    c.id,
    c.version,
    onDraftChange,
    reviewStarted
  ])
  const decision = async (value: string) => {
    if (
      value === 'approve' &&
      c.kind === 'close' &&
      !window.confirm(
        `确认下架“${display(c.before_payload.title)}”？\n${c.evidence.reason || '请核实原申请页面'}\n岗位原文及历史记录会保留。`
      )
    )
      return
    setBusy(true)
    try {
      await act({
        action: 'review',
        candidateId: c.id,
        version: c.version,
        baseRevision: c.base_revision,
        decision: value,
        reviewDurationMs: Date.now() - reviewStarted,
        companyId: targetCompany,
        patch: Object.fromEntries(accepted.map((k) => [k, patch[k]])),
        reason,
        eligibilityConfirmed: confirmed
      })
    } finally {
      setBusy(false)
    }
  }
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <input
          aria-label={`选择${display(c.patch.title || c.before_payload.title)}`}
          type="checkbox"
          className="mt-1"
          checked={selected}
          onChange={onSelect}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[#345d88]">
            {kinds[c.kind]} · {queues[c.queue]}
          </p>
          <h3 className="mt-1 font-semibold break-words">
            {display(c.patch.title || c.before_payload.title)}
          </h3>
        </div>
      </div>
      {!c.company_id && (
        <label className="block mt-3 text-sm">
          确认所属企业
          <select
            className={inputClass}
            value={targetCompany}
            onChange={(e) => setTargetCompany(e.target.value)}
          >
            <option value="">请选择企业</option>
            {companyOptions.map((co) => (
              <option key={co.company_id} value={co.company_id}>
                {co.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="mt-3 text-sm text-gray-600">
        {c.evidence.reason || '人工整理的岗位草稿'} ·{' '}
        {date(c.evidence.checked_at)}
      </p>
      <p className="mt-2 text-sm text-gray-600">{c.eligibility?.reason}</p>
      {c.kind === 'update' && (
        <p className="mt-2 text-sm text-amber-800">
          更新字段默认不选中。请展开差异，只勾选已核实要替换的字段。
        </p>
      )}
      {c.deferred_until && Date.parse(c.deferred_until) > Date.now() && (
        <p className="mt-2 text-sm text-gray-500">
          已暂缓至 {date(c.deferred_until)}，仍计入待审核。
        </p>
      )}
      {c.evidence.source_url && (
        <a
          className="mt-2 inline-flex items-center gap-1 text-sm text-[#345d88] underline"
          href={c.evidence.source_url}
          target="_blank"
          rel="noreferrer"
        >
          查看招聘来源
          <ExternalLink size={14} />
        </a>
      )}
      {conflict && (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm">
          正式岗位已有新编辑，请重新比较后审核。
          <button
            className="ml-2 underline"
            onClick={() =>
              void act({
                action: 'recompare',
                candidateId: c.id,
                version: c.version
              })
            }
          >
            重新比较
          </button>
        </div>
      )}
      <details className="mt-4" open={c.kind === 'close'}>
        <summary className="cursor-pointer text-sm font-medium">
          {c.kind === 'close'
            ? '下架理由与证据'
            : `查看并编辑 ${Object.keys(patch).length} 项建议`}
          <ChevronDown size={14} className="inline ml-1" />
        </summary>
        {c.kind === 'close' ? (
          <p className="mt-3 text-sm">
            {c.evidence.reason}。
            {c.evidence.first_missing_at && (
              <>
                首次缺失 {date(c.evidence.first_missing_at)}，完整扫描缺失{' '}
                {c.evidence.missing_count} 次。
              </>
            )}
            批准后该岗位将从公开列表下架。
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {Object.keys(patch).map((key) => (
              <div key={key}>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={accepted.includes(key)}
                    onChange={(e) =>
                      setAccepted(
                        e.target.checked
                          ? [...accepted, key]
                          : accepted.filter((k) => k !== key)
                      )
                    }
                  />
                  {names[key] || key}
                </label>
                <div className="grid md:grid-cols-2 gap-3 mt-2">
                  <div className="rounded-lg bg-gray-50 p-3 text-sm whitespace-pre-wrap max-h-64 overflow-auto">
                    <p className="text-xs text-gray-500 mb-1">当前发布</p>
                    {display(c.before_payload[key])}
                  </div>
                  <label className="text-xs text-gray-500">
                    建议内容
                    {key === 'translations' &&
                    patch[key] &&
                    typeof patch[key] === 'object' &&
                    !Array.isArray(patch[key]) ? (
                      <div className="space-y-2">
                        {Object.entries(patch[key] as Record<string, unknown>)
                          .filter(([field]) => field !== 'updatedAt')
                          .map(([field, text]) => (
                            <label key={field} className="block">
                              {names[field] || field}
                              <textarea
                                className={inputClass}
                                rows={field === 'description' ? 8 : 2}
                                value={String(text || '')}
                                onChange={(e) =>
                                  setPatch({
                                    ...patch,
                                    translations: {
                                      ...(patch.translations as Record<
                                        string,
                                        unknown
                                      >),
                                      [field]: e.target.value
                                    }
                                  })
                                }
                              />
                            </label>
                          ))}
                      </div>
                    ) : typeof patch[key] === 'boolean' ? (
                      <select
                        className={inputClass}
                        value={String(patch[key])}
                        onChange={(e) =>
                          setPatch({
                            ...patch,
                            [key]: e.target.value === 'true'
                          })
                        }
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    ) : (
                      <textarea
                        className={`${inputClass} mt-1 text-gray-900`}
                        rows={key === 'description' ? 8 : 3}
                        value={
                          Array.isArray(patch[key])
                            ? (patch[key] as string[]).join('\n')
                            : display(patch[key])
                        }
                        onChange={(e) =>
                          setPatch({
                            ...patch,
                            [key]: Array.isArray(patch[key])
                              ? e.target.value.split('\n').filter(Boolean)
                              : e.target.value
                          })
                        }
                      />
                    )}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </details>
      {c.kind === 'create' && c.eligibility?.status !== 'eligible' && (
        <label className="flex items-center gap-2 mt-4 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          我已核实中国常住用户可申请此远程岗位
        </label>
      )}
      {c.kind !== 'close' && (
        <div className="mt-3 text-sm">
          <button
            className={buttonClass}
            disabled={busy || c.enrichment_status === 'running'}
            onClick={() => void act({ action: 'translate', candidateId: c.id })}
          >
            {c.enrichment_status === 'running'
              ? '正在生成译文…'
              : '生成中文译文草稿'}
          </button>
          {c.enrichment_error && (
            <p className="mt-2 text-amber-800">{c.enrichment_error}</p>
          )}
        </div>
      )}
      <label className="block mt-4 text-sm">
        审核说明（拒绝时必填）
        <input
          className={`${inputClass} mt-1`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="rounded-lg bg-[#466f9d] px-4 py-2 text-sm text-white hover:bg-[#345d88] disabled:opacity-50"
          disabled={
            busy || !!conflict || (c.kind === 'update' && !accepted.length)
          }
          onClick={() => void decision('approve')}
        >
          {c.kind === 'close' ? '批准下架' : '批准并发布'}
        </button>
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => void decision('reject')}
        >
          拒绝
        </button>
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => void decision('defer')}
        >
          明日处理
        </button>
      </div>
    </article>
  )
}

export default function JobSyncPanel({
  companyId,
  companyName,
  onClose,
  onPublished,
  onManagePending
}: {
  companyId: string
  companyName: string
  onClose: () => void
  onPublished: () => void
  onManagePending?: () => void
}) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState('all'),
    [offset, setOffset] = useState(0)
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>(
    {}
  )
  const onDraftChange = useCallback(
    (id: string, draft: ReviewDraft) =>
      setReviewDrafts((previous) => ({ ...previous, [id]: draft })),
    []
  )
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [selected, setSelected] = useState<string[]>([]),
    [draft, setDraft] = useState({
      title: '',
      description: '',
      url: '',
      location: ''
    }),
    [bindSource, setBindSource] = useState(''),
    [bindJob, setBindJob] = useState('')
  const load = useCallback(async () => {
    try {
      setData(
        await jobSyncRequest(
          undefined,
          `?companyId=${encodeURIComponent(companyId)}&offset=${offset}&queue=${tab}`
        )
      )
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }, [companyId, offset, tab])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          document.activeElement?.tagName || ''
        )
      )
        void load()
    }, 30000)
    return () => clearInterval(timer)
  }, [load])
  const act = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await jobSyncRequest(body)
      setNotice(
        body.action === 'enqueue'
          ? result.tasks
              ?.map(
                (t: { taskId?: string; error?: string }) =>
                  t.error || `检测任务已提交：${t.taskId}`
              )
              .join('；')
          : body.action === 'check-links'
            ? `已检查 ${result.checked} 个申请链接；明确失效项已进入待审核，线上状态不变。`
            : body.action === 'confirm-preflight'
              ? '已确认本次预检，正在生成当前企业的待审核候选。'
              : '已保存'
      )
      if (body.action === 'enqueue') setTab('runs')
      await load()
      if (['review', 'check-links'].includes(String(body.action))) onPublished()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const batch = async () => {
    const candidates = data!.candidates.filter((c) => selected.includes(c.id))
    if (
      candidates.some(
        (c) =>
          !reviewDrafts[c.id] ||
          reviewDrafts[c.id].version !== c.version ||
          !reviewDrafts[c.id].companyId ||
          (c.kind === 'create' &&
            c.eligibility?.status !== 'eligible' &&
            !reviewDrafts[c.id].eligibilityConfirmed)
      )
    ) {
      setError('所选岗位包含资格待判断项，请逐条核实。')
      return
    }
    if (
      !window.confirm(
        `确认批准以下 ${candidates.length} 项变更？\n${candidates.map((c) => `${kinds[c.kind]}：${display(c.patch.title || c.before_payload.title)}\n${c.evidence.reason || ''}`).join('\n\n')}`
      )
    )
      return
    setBusy(true)
    const failures: string[] = []
    for (const c of candidates) {
      try {
        await jobSyncRequest({
          action: 'review',
          candidateId: c.id,
          baseRevision: c.base_revision,
          decision: 'approve',
          ...reviewDrafts[c.id]
        })
      } catch (e) {
        failures.push(
          `${display(c.patch.title || c.before_payload.title)}：${(e as Error).message}`
        )
      }
    }
    setSelected([])
    await load()
    onPublished()
    setBusy(false)
    setError(failures.join('；'))
    setNotice(
      `已批准 ${candidates.length - failures.length} 项；${failures.length} 项需处理`
    )
  }
  return (
    <section
      aria-label="岗位同步与审核"
      className="mb-6 rounded-2xl border border-[#dce8f3] bg-slate-50 p-4 md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">
            {companyName} · 岗位同步与审核
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            人工预检 → 确认本次结果 → 生成候选 →
            审核发布。企业资料、人工分类和标签不由采集修改。
          </p>
        </div>
        <button
          aria-label="收起岗位同步"
          className={buttonClass}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="my-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="my-4 text-sm text-[#345d88]">
          {notice}
        </p>
      )}
      {data?.paused && (
        <p className="mt-4 text-sm text-amber-800">
          后台任务处理尚未启用。可配置来源、手动检查链接；预检任务会等待启用后处理。
        </p>
      )}
      <div className="my-4 flex flex-wrap gap-2">
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => void act({ action: 'initialize', companyId })}
        >
          {companyId ? '建立招聘来源' : '为有在招岗位的企业建立来源'}
        </button>
        {companyId && (
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() => void act({ action: 'enqueue', companyId })}
          >
            1. 预检招聘来源
          </button>
        )}
        {companyId && (
          <button
            className={buttonClass}
            disabled={busy}
            onClick={() => void act({ action: 'check-links', companyId })}
          >
            检查现有岗位申请链接（每次 10 条）
          </button>
        )}
        {companyId && onManagePending && (
          <button className={buttonClass} onClick={onManagePending}>
            已录入待审核岗位
          </button>
        )}
        <button
          className={buttonClass}
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={14} className="inline mr-1" />
          刷新
        </button>
      </div>
      {data && (
        <>
          <p className="text-sm text-gray-500 mb-4">
            全局已启用 {data.metrics.enabled_sources} 个来源，近 24 小时完成{' '}
            {data.metrics.fresh_sources} 个完整扫描；待审核{' '}
            {data.metrics.pending} 项。
          </p>
          <nav aria-label="同步视图" className="flex flex-wrap gap-2 mb-5">
            {Object.entries({
              ...queues,
              sources: '招聘来源',
              binding: '历史岗位绑定',
              runs: '检测记录'
            }).map(([key, label]) => (
              <button
                key={key}
                className={`rounded-lg px-3 py-2 text-sm ${tab === key ? 'bg-[#466f9d] text-white' : 'bg-white border text-gray-700'}`}
                aria-pressed={tab === key}
                onClick={() => {
                  setTab(key)
                  setOffset(0)
                  setSelected([])
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          {Object.keys(queues).includes(tab) && (
            <>
              {tab === 'manual' && companyId && (
                <div className="mb-5 rounded-xl border bg-white p-4 space-y-3">
                  <h3 className="font-medium">从链接或岗位原文建立草稿</h3>
                  {(['title', 'url', 'location'] as const).map((k) => (
                    <label className="block text-sm" key={k}>
                      {names[k]}
                      <input
                        className={inputClass}
                        value={draft[k]}
                        onChange={(e) =>
                          setDraft({ ...draft, [k]: e.target.value })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className={buttonClass}
                    disabled={busy || !draft.url}
                    onClick={async () => {
                      setBusy(true)
                      try {
                        const r = await jobSyncRequest({
                          action: 'extract',
                          url: draft.url
                        })
                        setDraft({ ...draft, ...r.draft })
                        setNotice('已提取原文，请补充资格与缺失字段。')
                      } catch (e) {
                        setError((e as Error).message)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    从公开链接提取
                  </button>
                  <label className="block text-sm">
                    粘贴岗位原文
                    <textarea
                      className={inputClass}
                      rows={8}
                      value={draft.description}
                      onChange={(e) =>
                        setDraft({ ...draft, description: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className={buttonClass}
                    disabled={busy}
                    onClick={() =>
                      void act({ action: 'draft', companyId, patch: draft })
                    }
                  >
                    保存为待审核草稿
                  </button>
                </div>
              )}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-sm">已选择 {selected.length} 项</span>
                <button
                  className={buttonClass}
                  disabled={busy || !selected.length}
                  onClick={() => void batch()}
                >
                  审核所选变更
                </button>
              </div>
              <div className="space-y-4">
                {data.candidates
                  .filter((c) => tab === 'all' || c.queue === tab)
                  .map((c) => (
                    <CandidateCard
                      key={`${c.id}:${c.version}`}
                      candidate={c}
                      companyId={companyId}
                      companyOptions={data.companyOptions}
                      onDraftChange={onDraftChange}
                      selected={selected.includes(c.id)}
                      onSelect={() =>
                        setSelected(
                          selected.includes(c.id)
                            ? selected.filter((id) => id !== c.id)
                            : [...selected, c.id]
                        )
                      }
                      act={act}
                    />
                  ))}
              </div>
              {!data.candidates.some(
                (c) => tab === 'all' || c.queue === tab
              ) && (
                <p className="rounded-xl border bg-white p-8 text-sm text-gray-500">
                  本页没有此类待审核变更。完成检测后，相关建议会出现在这里。
                </p>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  className={buttonClass}
                  disabled={!offset}
                  onClick={() => setOffset(Math.max(0, offset - 30))}
                >
                  上一页
                </button>
                <button
                  className={buttonClass}
                  disabled={!data.hasMore}
                  onClick={() => setOffset(offset + 30)}
                >
                  下一页
                </button>
              </div>
            </>
          )}
          {tab === 'sources' && (
            <div className="space-y-3">
              {companyId && (
                <div className="flex gap-2">
                  <input
                    aria-label="新增招聘来源网址"
                    className={inputClass}
                    placeholder="新增另一招聘来源的网址"
                    value={newSourceUrl}
                    onChange={(e) => setNewSourceUrl(e.target.value)}
                  />
                  <button
                    className={buttonClass}
                    disabled={busy || !newSourceUrl}
                    onClick={() =>
                      void act({
                        action: 'add-source',
                        companyId,
                        url: newSourceUrl
                      })
                    }
                  >
                    添加来源
                  </button>
                </div>
              )}
              {data.sources.map((s) => (
                <SourceEditor
                  key={s.id}
                  source={s}
                  companyId={companyId}
                  save={(source) => act({ action: 'configure', source })}
                />
              ))}
              {!data.sources.length && (
                <p className="text-sm">
                  尚未建立招聘来源，请点击上方建立来源。
                </p>
              )}
            </div>
          )}
          {tab === 'binding' && (
            <div className="rounded-xl border bg-white p-4 space-y-3">
              <p className="text-sm">
                仅绑定同一个真实岗位。同名岗位应分别保留。绑定后再次检测，将生成首次核对建议。
              </p>
              <label className="block text-sm">
                来源岗位
                <select
                  className={inputClass}
                  value={bindSource}
                  onChange={(e) => setBindSource(e.target.value)}
                >
                  <option value="">请选择未绑定岗位</option>
                  {data.sourceJobs
                    .filter((j) => !j.job_id)
                    .map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} — {j.url}
                      </option>
                    ))}
                </select>
              </label>
              <label className="block text-sm">
                现有正式岗位
                <select
                  className={inputClass}
                  value={bindJob}
                  onChange={(e) => setBindJob(e.target.value)}
                >
                  <option value="">请选择现有岗位</option>
                  {data.jobs.map((j) => (
                    <option key={j.job_id} value={j.job_id}>
                      {j.title} — {j.url}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className={buttonClass}
                disabled={busy || !bindSource || !bindJob}
                onClick={() =>
                  void act({
                    action: 'bind',
                    sourceJobId: bindSource,
                    jobId: bindJob,
                    version: data.sourceJobs.find((j) => j.id === bindSource)
                      ?.version
                  })
                }
              >
                确认绑定
              </button>
            </div>
          )}
          {tab === 'runs' && (
            <div className="overflow-x-auto">
              {!!data.urlChecks?.length && (
                <details className="mb-4 rounded-lg border p-3">
                  <summary>
                    现有岗位申请链接检查记录（包括无法确定状态的链接）
                  </summary>
                  {data.urlChecks.map((check) => (
                    <p key={check.job_id} className="my-2">
                      <a
                        className="underline"
                        href={check.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {check.title}
                      </a>{' '}
                      ·{' '}
                      {check.state === 'closed'
                        ? '待人工审核失效'
                        : check.state === 'open'
                          ? '确认开放'
                          : '无法确定'}{' '}
                      · {check.reason} · {date(check.checked_at)}
                    </p>
                  ))}
                </details>
              )}
              <table className="w-full text-sm text-left">
                <thead>
                  <tr>
                    <th className="p-3">检测时间</th>
                    <th>状态</th>
                    <th>已采集</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="p-3 whitespace-nowrap">
                        {date(r.created_at)}
                      </td>
                      <td>{statusNames[r.status] || r.status}</td>
                      <td>{r.item_count}</td>
                      <td>
                        {r.error || '—'}
                        {r.mode === 'preflight' && (
                          <div className="my-2">
                            <p>
                              {r.evidence?.preflight_passed
                                ? '预检通过：完整列表和岗位正文已取得，尚未生成候选。'
                                : '预检尚未通过，不允许生成候选。'}
                            </p>
                            {r.evidence?.samples?.map((sample) => (
                              <p key={sample.url} className="my-1">
                                <a
                                  href={sample.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="underline"
                                >
                                  {sample.title}
                                </a>{' '}
                                · 原文 {sample.description_length} 字符
                              </p>
                            ))}
                            {r.status === 'complete' &&
                              r.evidence?.preflight_passed && (
                                <button
                                  className={buttonClass}
                                  disabled={
                                    busy ||
                                    Date.now() - Date.parse(r.created_at) >
                                      3600000 ||
                                    Date.now() -
                                      Date.parse(r.preflight_at || '') >
                                      3600000
                                  }
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `已检查完整性报告及原文样本，确认将本次 ${r.item_count} 条来源记录用于当前企业的候选生成？不会修改已发布岗位，之后仍需逐项审核。`
                                      )
                                    )
                                      void act({
                                        action: 'confirm-preflight',
                                        taskId: r.id,
                                        companyId: r.scope_company_id
                                      })
                                  }}
                                >
                                  2. 已核对，确认生成候选
                                </button>
                              )}
                          </div>
                        )}
                        {Boolean(r.evidence?.checks?.length) && (
                          <details className="mt-2">
                            <summary className="cursor-pointer">
                              查看岗位核实结果
                            </summary>
                            {r.evidence?.checks?.map((check) => (
                              <p key={check.job_id} className="mt-2">
                                {check.url ? (
                                  <a
                                    className="underline"
                                    href={check.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    原岗位
                                  </a>
                                ) : (
                                  check.job_id
                                )}
                                ：{check.reason}
                              </p>
                            ))}
                          </details>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data.outbox.length > 0 && (
            <details className="mt-5 text-sm">
              <summary>
                发布后的统计与画像更新：{data.outbox.length} 项处理中
              </summary>
              {data.outbox.map((o) => (
                <p key={o.id} className="mt-2">
                  {o.last_error || '等待处理'}{' '}
                  <button
                    className="underline"
                    onClick={() =>
                      void act({ action: 'retry-publication', id: o.id })
                    }
                  >
                    重试
                  </button>
                </p>
              ))}
            </details>
          )}
        </>
      )}
    </section>
  )
}
