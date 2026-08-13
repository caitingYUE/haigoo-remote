import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Loader2, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'
import { memberCrmAdminService } from '../services/member-crm-admin-service'
import type {
  CrmApplication, CrmCareerArtifact, CrmCareerRun, CrmCareerWorkspace, CrmResumeDocument, CrmServiceDocument, CrmServiceRecord, MemberCrmDetail,
  MemberCrmListItem, MemberCrmListResponse, MemberCrmProfile
} from '../types/member-crm-types'

const MEMBER_LABELS: Record<string, string> = {
  starter: 'Club Starter', half_year: 'Club Member', annual: 'Club Partner',
  trial_week: '体验会员', quarter: '季度会员', quarter_pro: 'Pro 会员', year: '旧年度会员'
}
const MEMBERSHIP_LABELS: Record<string, string> = {
  pending: '待生效', active: '服务中', expiring: '即将到期', expired: '已过期', anomaly: '数据异常'
}
const STAGE_LABELS: Record<string, string> = {
  not_started: '未开始', onboarding: '建档中', in_service: '服务中', follow_up: '持续跟进', paused: '暂停', completed: '已完成'
}
const SERVICE_STATUS_LABELS: Record<string, string> = {
  planned: '已计划', scheduled: '已预约', in_progress: '进行中', completed: '已完成', cancelled: '已取消'
}
const APPLICATION_STATUS_LABELS: Record<string, string> = {
  entry_opened: '已打开入口', pending: '待处理', pending_apply: '待确认申请', applied: '已申请',
  reviewed: '简历已阅', referred: '已内推', interviewing: '面试中', offer: 'Offer', success: '已录用',
  rejected: '未通过', failed: '失败', withdrawn: '主动终止', closed: '已关闭'
}
const ENTITLEMENT_STATUS_LABELS: Record<string, string> = {
  available: '可使用', not_scheduled: '未预约', scheduled: '已预约', completed: '已完成',
  reviewing: '审核中', approved: '已通过', expired: '已过期', unavailable: '不可用',
  unused: '未使用', used: '已使用', registered: '已报名', attended: '已参加',
  not_applied: '未申请', rejected: '未通过', requested: '已申请', published: '已发布'
}
const AUDIT_ACTION_LABELS: Record<string, string> = {
  profile_updated: '更新 CRM 资料', service_created: '新增服务记录', service_updated: '更新服务记录',
  service_archived: '归档服务记录', manual_application_created: '补录站外申请',
  manual_application_updated: '更新站外申请', manual_application_archived: '归档站外申请',
  application_event_added: '追加申请跟进', resume_uploaded: '上传 CRM 简历',
  resume_downloaded: '预览或下载 CRM 简历', resume_deleted: '删除 CRM 简历',
  agent_run_completed: '生成顾问诊断', agent_run_failed: '顾问诊断失败',
  agent_artifact_approved: '确认顾问成果', agent_artifact_archived: '归档顾问成果',
  agent_artifact_notes_updated: '更新顾问备注', agent_artifact_profile_updated: '校正候选人画像',
  member_excluded_from_crm: '从 CRM 列表移除会员', member_restored_to_crm: '恢复 CRM 会员',
  service_document_uploaded: '上传服务文档', service_document_downloaded: '查看服务文档',
  service_document_deleted: '删除服务文档'
}
const SERVICE_FLOW = [
  ['resume_diagnosis', '简历诊断和评估方案'], ['job_recommendation', '岗位推荐与准备材料'],
  ['custom_resume', '定制简历优化'], ['consultation', '一对一语音咨询'],
  ['application_followup', '申请跟进服务'], ['supplemental', '其他补充服务']
] as const
const SERVICE_TYPES = [
  ...SERVICE_FLOW, ['other', '其他手动服务'], ['career_plan', '职业规划（旧）'],
  ['resume_review', '简历诊断（旧）'], ['materials', '准备材料（旧）'],
  ['community', '会员活动（旧）'], ['partner_support', '伙伴支持（旧）']
] as const
const DETAIL_TABS = [
  ['overview', '概览'], ['services', '服务'], ['applications', '申请'],
  ['recommendations', '推荐'], ['resumes', '简历'], ['career-tools', '顾问工具'], ['audit', '记录']
] as const
type DetailTab = (typeof DETAIL_TABS)[number][0]

function formatDate(value?: string | null, withTime = false) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', withTime
    ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function toInputDate(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function toIso(value: string) { return value ? new Date(value).toISOString() : null }
function daysUntil(value?: string | null) {
  if (!value) return null
  const valueMs = new Date(value).getTime()
  return Number.isFinite(valueMs) ? Math.ceil((valueMs - Date.now()) / 86400000) : null
}

function badgeClass(kind: string) {
  if (['active', 'completed', 'success', 'offer'].includes(kind)) return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (['expiring', 'pending', 'scheduled', 'pending_apply', 'entry_opened'].includes(kind)) return 'border-amber-200 bg-amber-50 text-amber-700'
  if (['expired', 'anomaly', 'rejected', 'failed', 'unavailable', 'deleted'].includes(kind)) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (['in_progress', 'interviewing', 'referred', 'reviewed'].includes(kind)) return 'border-[#c9dce8] bg-[#eff5fb] text-[#345d88]'
  return 'border-slate-200 bg-slate-50 text-slate-600'
}

function StatusBadge({ value, label }: { value: string; label: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClass(value)}`}>{label}</span>
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-10 text-center text-sm text-slate-500">{children}</div>
}

function MemberAvatar({ item }: { item: Pick<MemberCrmListItem, 'fullName' | 'username' | 'email'> }) {
  const label = item.fullName || item.username || item.email || 'M'
  return <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">{label.slice(0, 1).toUpperCase()}</div>
}

export default function AdminMemberCrmPage() {
  const { token, isSuperAdmin } = useAuth()
  const { showSuccess, showError } = useNotificationHelpers()
  const [selectedMemberId, setSelectedMemberId] = useState(new URLSearchParams(window.location.search).get('memberId') || '')
  const [detailTab, setDetailTab] = useState<DetailTab>('overview')
  const [listData, setListData] = useState<MemberCrmListResponse | null>(null)
  const [detail, setDetail] = useState<MemberCrmDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listError, setListError] = useState('')
  const [detailError, setDetailError] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [memberType, setMemberType] = useState('all')
  const [membershipState, setMembershipState] = useState('all')
  const [serviceStage, setServiceStage] = useState('all')
  const [attention, setAttention] = useState('all')
  const [includeLegacy, setIncludeLegacy] = useState(false)
  const [showExcluded, setShowExcluded] = useState(false)
  const [flowSnapshot, setFlowSnapshot] = useState<MemberCrmListItem | null>(null)
  const [removalTarget, setRemovalTarget] = useState<MemberCrmListItem | null>(null)
  const [removalReason, setRemovalReason] = useState('')
  const [visibilitySaving, setVisibilitySaving] = useState(false)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 280)
    return () => window.clearTimeout(timer)
  }, [search])

  const loadList = useCallback(async () => {
    setLoading(true); setListError('')
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25', search: debouncedSearch, memberType, membershipState, serviceStage, attention, includeLegacy: String(includeLegacy), visibility: showExcluded ? 'excluded' : 'active' })
      setListData(await memberCrmAdminService.list(params, token))
    } catch (error) {
      const message = error instanceof Error ? error.message : '网络错误'
      setListError(message); showError('CRM 加载失败', message)
    } finally { setLoading(false) }
  }, [attention, debouncedSearch, includeLegacy, memberType, membershipState, page, serviceStage, showError, showExcluded, token])

  const loadDetail = useCallback(async (userId: string) => {
    if (!userId) return
    setDetailLoading(true); setDetailError('')
    try { setDetail(await memberCrmAdminService.detail(userId, token)) }
    catch (error) {
      const message = error instanceof Error ? error.message : '网络错误'
      setDetailError(message); showError('会员详情加载失败', message)
    } finally { setDetailLoading(false) }
  }, [showError, token])

  useEffect(() => { void loadList() }, [loadList])
  useEffect(() => { if (selectedMemberId) void loadDetail(selectedMemberId) }, [loadDetail, selectedMemberId])
  useEffect(() => { setPage(1) }, [attention, debouncedSearch, includeLegacy, memberType, membershipState, serviceStage, showExcluded])

  const selectMember = (userId: string) => {
    setSelectedMemberId(userId); setDetail(null); setDetailTab('overview'); setDetailError('')
    const url = new URL(window.location.href)
    url.searchParams.set('tab', 'member-crm'); url.searchParams.set('memberId', userId)
    window.history.replaceState({}, '', `${url.pathname}${url.search}`)
  }
  const backToList = () => {
    setSelectedMemberId(''); setDetail(null); setDetailError('')
    const url = new URL(window.location.href)
    url.searchParams.delete('memberId'); window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    void loadList()
  }
  const hasFilters = Boolean(search || memberType !== 'all' || membershipState !== 'all' || serviceStage !== 'all' || attention !== 'all' || includeLegacy || showExcluded)
  const clearFilters = () => {
    setSearch(''); setMemberType('all'); setMembershipState('all'); setServiceStage('all'); setAttention('all'); setIncludeLegacy(false); setShowExcluded(false)
  }
  const excludeMember = async () => {
    if (!removalTarget) return
    setVisibilitySaving(true)
    try {
      await memberCrmAdminService.setMemberVisibility(removalTarget.userId, 'exclude', removalReason, token)
      showSuccess('已从会员 CRM 列表移除', '用户账号、会员状态和历史记录均未删除')
      setRemovalTarget(null); setRemovalReason(''); await loadList()
    } catch (error) { showError('移除失败', error instanceof Error ? error.message : '网络错误') }
    finally { setVisibilitySaving(false) }
  }
  const restoreMember = async (item: MemberCrmListItem) => {
    if (!window.confirm(`将“${item.fullName || item.username || item.email}”恢复到会员 CRM 列表？`)) return
    try { await memberCrmAdminService.setMemberVisibility(item.userId, 'restore', '', token); showSuccess('已恢复到会员 CRM'); await loadList() }
    catch (error) { showError('恢复失败', error instanceof Error ? error.message : '网络错误') }
  }

  if (selectedMemberId) return <MemberWorkspace detail={detail} loading={detailLoading} error={detailError}
    activeTab={detailTab} setActiveTab={setDetailTab} onBack={backToList} onReload={() => loadDetail(selectedMemberId)}
    token={token} canEdit={Boolean(detail?.canEdit && isSuperAdmin)} showSuccess={showSuccess} showError={showError} />

  const summary = listData?.summary
  const summaryCards = [
    ['服务中', summary?.active], ['30 天内到期', summary?.expiring],
    ['待跟进', summary?.followUpDue], ['岗位失效', summary?.recommendationAttention]
  ] as const
  const items = listData?.items || []

  return <div className="space-y-4 pb-10">
    <div className="flex items-center justify-end gap-2"><StatusBadge value={isSuperAdmin ? 'active' : 'pending'} label={isSuperAdmin ? '超级管理员 · 可编辑' : '管理员 · 只读'} /><button onClick={() => void loadList()} disabled={loading} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">刷新数据</button></div>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="会员概览">
      {summaryCards.map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{listError ? '—' : value ?? '—'}</div></div>)}
    </section>

    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(260px,1fr)_repeat(4,minmax(130px,auto))]">
          <label className="col-span-2 xl:col-span-1"><span className="sr-only">搜索会员</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="搜索姓名、邮箱或会员编号" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#9fbbd2] focus:ring-2 focus:ring-[#dce9f5]" /></label>
          <select aria-label="会员方案" value={memberType} onChange={event => setMemberType(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">全部方案</option><option value="starter">Club Starter</option><option value="half_year">Club Member</option><option value="annual">Club Partner</option>{includeLegacy && <><option value="trial_week">体验会员</option><option value="quarter">季度会员</option><option value="quarter_pro">Pro 会员</option><option value="year">旧年度会员</option></>}</select>
          <select aria-label="会员状态" value={membershipState} onChange={event => setMembershipState(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">全部状态</option>{Object.entries(MEMBERSHIP_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select aria-label="服务阶段" value={serviceStage} onChange={event => setServiceStage(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">全部阶段</option>{Object.entries(STAGE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select aria-label="关注项" value={attention} onChange={event => setAttention(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm"><option value="all">全部关注项</option><option value="follow_up">待 / 逾期跟进</option><option value="job_unavailable">推荐岗位失效</option><option value="missing_plan">缺少服务方案</option></select>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-4"><label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" checked={includeLegacy} onChange={event => setIncludeLegacy(event.target.checked)} className="rounded border-slate-300" />显示历史会员</label>{isSuperAdmin && <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-500"><input type="checkbox" checked={showExcluded} onChange={event => setShowExcluded(event.target.checked)} className="rounded border-slate-300" />查看已移除会员</label>}</div>{hasFilters && <button onClick={clearFilters} className="text-xs font-semibold text-[#466f9d] hover:text-[#345d88]">清除筛选</button>}</div>
      </div>

      {listError ? <div className="px-5 py-12 text-center"><div className="text-sm font-semibold text-rose-700">会员数据加载失败</div><p className="mt-1 text-sm text-slate-500">{listError}</p><button onClick={() => void loadList()} className="mt-4 rounded-lg border px-3 py-2 text-sm font-semibold text-slate-700">重试</button></div>
        : <>
          <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1080px] text-left"><thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr>{['会员','方案与有效期','服务进度','申请','推荐','待服务',''].map(label => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={7} className="py-14 text-center text-sm text-slate-500">正在加载…</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-sm text-slate-500">{showExcluded ? '暂无已移除会员' : '没有符合条件的会员'}</td></tr> : items.map(item => <MemberRow key={item.userId} item={item} onOpen={() => selectMember(item.userId)} onFlow={() => setFlowSnapshot(item)} onExclude={() => { setRemovalTarget(item); setRemovalReason('') }} onRestore={() => void restoreMember(item)} canEdit={Boolean(isSuperAdmin)} />)}</tbody></table></div>
          <div className="divide-y divide-slate-100 lg:hidden">{loading ? <div className="py-14 text-center text-sm text-slate-500">正在加载…</div> : items.length === 0 ? <div className="py-14 text-center text-sm text-slate-500">{showExcluded ? '暂无已移除会员' : '没有符合条件的会员'}</div> : items.map(item => <MemberCard key={item.userId} item={item} onOpen={() => selectMember(item.userId)} onFlow={() => setFlowSnapshot(item)} onExclude={() => { setRemovalTarget(item); setRemovalReason('') }} onRestore={() => void restoreMember(item)} canEdit={Boolean(isSuperAdmin)} />)}</div>
        </>}
      {listData && listData.pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm text-slate-500"><span>共 {listData.pagination.total} 位</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage(current => current - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">上一页</button><span>{page} / {listData.pagination.totalPages}</span><button disabled={page >= listData.pagination.totalPages} onClick={() => setPage(current => current + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">下一页</button></div></div>}
    </section>
    {flowSnapshot && <ServiceFlowSnapshot item={flowSnapshot} onClose={() => setFlowSnapshot(null)} onOpen={() => selectMember(flowSnapshot.userId)} />}
    {removalTarget && <Modal title="从会员 CRM 列表移除" onClose={() => setRemovalTarget(null)}><p className="text-sm leading-6 text-slate-600">只隐藏“{removalTarget.fullName || removalTarget.username || removalTarget.email}”在 CRM 列表中的展示，不会删除用户、会员状态、简历、服务或申请记录。</p><Field label="移除原因（可选）"><input autoFocus value={removalReason} maxLength={500} onChange={event => setRemovalReason(event.target.value)} className="input mt-4" placeholder="例如：测试数据、暂不纳入服务" /></Field><ModalActions saving={visibilitySaving} onCancel={() => setRemovalTarget(null)} onSave={() => void excludeMember()} /></Modal>}
  </div>
}

function AttentionTags({ reasons }: { reasons: string[] }) {
  if (!reasons.length) return null
  return <div className="mt-1 flex flex-wrap gap-1">{reasons.map(reason => <span key={reason} className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-700">{reason}</span>)}</div>
}

function MemberRow({ item, onOpen, onFlow, onExclude, onRestore, canEdit }: { item: MemberCrmListItem; onOpen: () => void; onFlow: () => void; onExclude: () => void; onRestore: () => void; canEdit: boolean }) {
  return <tr className="hover:bg-slate-50/80"><td className="px-4 py-3"><div className="flex items-start gap-3"><MemberAvatar item={item} /><div className="min-w-0"><button onClick={onOpen} className="text-left text-sm font-semibold text-slate-900 hover:text-[#466f9d]">{item.fullName || item.username || '未设置姓名'}</button><div className="max-w-[220px] truncate text-xs text-slate-500">{item.email}</div><AttentionTags reasons={item.attentionReasons} />{item.crmExcluded && <div className="mt-1 text-[11px] text-slate-400">已移除 {formatDate(item.crmExcludedAt, true)}{item.crmExclusionReason ? ` · ${item.crmExclusionReason}` : ''}</div>}</div></div></td><td className="px-4 py-3"><div className="text-sm font-medium text-slate-800">{MEMBER_LABELS[item.memberType] || item.memberType}</div><div className="mt-1 flex items-center gap-2"><StatusBadge value={item.membershipState} label={MEMBERSHIP_LABELS[item.membershipState]} /><span className="text-xs text-slate-400">至 {formatDate(item.memberExpireAt)}</span></div></td><td className="px-4 py-3"><button onClick={onFlow} className="text-left"><div className="text-xs font-semibold text-slate-700">固定流程 {item.completedFlowCount}/{SERVICE_FLOW.length}</div><div className="mt-1 max-w-[230px] truncate text-xs text-slate-500">当前：{item.currentServiceLabel || '未开始'}</div><div className="max-w-[230px] truncate text-[11px] text-[#466f9d]">下一项：{item.nextServiceLabel || '无'}</div></button></td><td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-800">{item.applicationCount}</td><td className="px-4 py-3 text-xs"><span className="font-semibold text-emerald-700">{item.activeRecommendationCount} 有效</span>{item.unavailableRecommendationCount > 0 && <span className="ml-2 font-semibold text-rose-600">{item.unavailableRecommendationCount} 失效</span>}</td><td className="px-4 py-3 text-sm font-semibold tabular-nums text-slate-700">{item.pendingServiceCount}</td><td className="px-4 py-3 text-right"><div className="flex justify-end gap-2"><button onClick={onOpen} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">查看</button>{canEdit && (item.crmExcluded ? <button onClick={onRestore} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700">恢复</button> : <button onClick={onExclude} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500">移除</button>)}</div></td></tr>
}

function MemberCard({ item, onOpen, onFlow, onExclude, onRestore, canEdit }: { item: MemberCrmListItem; onOpen: () => void; onFlow: () => void; onExclude: () => void; onRestore: () => void; canEdit: boolean }) {
  return <article className="p-4"><div className="flex items-start gap-3"><MemberAvatar item={item} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><button onClick={onOpen} className="text-left text-sm font-semibold text-slate-900">{item.fullName || item.username || '未设置姓名'}</button><div className="truncate text-xs text-slate-500">{item.email}</div></div><StatusBadge value={item.membershipState} label={MEMBERSHIP_LABELS[item.membershipState]} /></div><AttentionTags reasons={item.attentionReasons} /></div></div><button onClick={onFlow} className="mt-3 w-full border-y border-slate-100 py-2 text-left text-xs"><b className="text-slate-700">固定流程 {item.completedFlowCount}/{SERVICE_FLOW.length}</b><span className="ml-2 text-[#466f9d]">下一项：{item.nextServiceLabel || '无'}</span></button><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><span className="text-slate-400">方案</span><div className="mt-0.5 font-medium text-slate-700">{MEMBER_LABELS[item.memberType]} · 至 {formatDate(item.memberExpireAt)}</div></div><div><span className="text-slate-400">阶段 / 跟进</span><div className="mt-0.5 font-medium text-slate-700">{STAGE_LABELS[item.serviceStage]} · {formatDate(item.nextFollowUpAt)}</div></div><div><span className="text-slate-400">申请 / 待服务</span><div className="mt-0.5 font-medium text-slate-700">{item.applicationCount} / {item.pendingServiceCount}</div></div><div><span className="text-slate-400">推荐</span><div className="mt-0.5 font-medium text-slate-700">{item.activeRecommendationCount} 有效 · {item.unavailableRecommendationCount} 失效</div></div></div><div className="mt-3 flex gap-2"><button onClick={onOpen} className="flex-1 rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-700">打开工作台</button>{canEdit && (item.crmExcluded ? <button onClick={onRestore} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700">恢复</button> : <button onClick={onExclude} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500">移除</button>)}</div></article>
}

function ServiceFlowSnapshot({ item, onClose, onOpen }: { item: MemberCrmListItem; onClose: () => void; onOpen: () => void }) {
  return <Modal title={`服务流程：${item.fullName || item.username || item.email}`} onClose={onClose}><div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 text-sm"><span className="font-semibold text-slate-700">已完成 {item.completedFlowCount}/{SERVICE_FLOW.length}</span><span className="text-slate-500">下一项：{item.nextServiceLabel || '全部完成'}</span></div><div className="divide-y divide-slate-100">{item.serviceFlow.map((step, index) => <div key={step.key} className="flex items-center justify-between gap-4 py-3"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${step.completed ? 'bg-emerald-600 text-white' : step.status === 'not_started' ? 'bg-slate-100 text-slate-500' : 'bg-[#dce9f5] text-[#345d88]'}`}>{step.completed ? '完' : index + 1}</span><div><div className="text-sm font-semibold text-slate-800">{step.label}</div>{step.title && step.title !== step.label && <div className="mt-0.5 text-xs text-slate-500">{step.title}</div>}</div></div><div className="shrink-0 text-right"><StatusBadge value={step.status} label={step.status === 'not_started' ? '未开始' : SERVICE_STATUS_LABELS[step.status]} />{step.updatedAt && <div className="mt-1 text-[11px] text-slate-400">{formatDate(step.updatedAt, true)}</div>}</div></div>)}</div><div className="mt-5 flex justify-end"><button onClick={onOpen} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">进入服务详情</button></div></Modal>
}

type WorkspaceProps = {
  detail: MemberCrmDetail | null; loading: boolean; error: string; activeTab: DetailTab
  setActiveTab: (value: DetailTab) => void; onBack: () => void; onReload: () => Promise<void>
  token: string | null; canEdit: boolean; showSuccess: (title: string, message?: string) => void
  showError: (title: string, message?: string) => void; setUnsaved?: (value: boolean) => void
}

function MemberWorkspace(props: WorkspaceProps) {
  const { detail, loading, error, activeTab, setActiveTab, onBack } = props
  const [unsaved, setUnsaved] = useState(false)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { if (unsaved) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [unsaved])
  const confirmLeave = () => !unsaved || window.confirm('当前页面有尚未保存的修改，确定离开吗？')
  if (loading) return <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载会员资料…</div>
  if (error || !detail) return <div className="rounded-xl border border-rose-200 bg-white px-5 py-12 text-center"><div className="font-semibold text-rose-700">会员详情加载失败</div><p className="mt-1 text-sm text-slate-500">{error || '未找到会员资料'}</p><div className="mt-4 flex justify-center gap-2"><button onClick={onBack} className="rounded-lg border px-3 py-2 text-sm font-semibold">返回列表</button><button onClick={() => void props.onReload()} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">重试</button></div></div>
  const member = detail.member
  const remaining = daysUntil(member.memberExpireAt)
  const tabCount = (key: DetailTab) => key === 'applications' ? detail.applications.length : key === 'recommendations' ? detail.recommendationBundles.reduce((sum, bundle) => sum + bundle.jobs.length, 0) : key === 'resumes' ? detail.userResumes.length + detail.crmResumes.length : null
  return <div className="space-y-4 pb-10">
    <header className="sticky top-0 z-20 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-center"><div className="flex min-w-0 items-start gap-3"><button aria-label="返回会员列表" onClick={() => { if (confirmLeave()) onBack() }} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /></button><MemberAvatar item={member} /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold text-slate-950">{member.fullName || member.username || '未设置姓名'}</h2><StatusBadge value={member.membershipState} label={MEMBERSHIP_LABELS[member.membershipState]} /><StatusBadge value={member.serviceStage} label={STAGE_LABELS[member.serviceStage]} /></div><div className="mt-1 truncate text-xs text-slate-500">{member.email} · {MEMBER_LABELS[member.memberType]} · {formatDate(member.memberCycleStartAt)}—{formatDate(member.memberExpireAt)}{remaining !== null && remaining >= 0 ? ` · 剩 ${remaining} 天` : ''}</div></div></div><div className="flex flex-wrap items-center gap-1.5">{member.attentionReasons.map(reason => <span key={reason} className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">{reason}</span>)}<StatusBadge value={props.canEdit ? 'active' : 'pending'} label={props.canEdit ? '可编辑' : '只读'} /></div></div>
      <nav className="mt-3 flex gap-1 overflow-x-auto border-t border-slate-100 pt-2" aria-label="会员工作台栏目">{DETAIL_TABS.filter(([key]) => key !== 'career-tools' || props.canEdit).map(([key, label]) => { const count = tabCount(key); return <button key={key} onClick={() => { if (key === activeTab || confirmLeave()) { setUnsaved(false); setActiveTab(key) } }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${activeTab === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{label}{count !== null ? ` ${count}` : ''}</button> })}</nav>
    </header>
    {activeTab === 'overview' && <OverviewTab {...props} setUnsaved={setUnsaved} />}
    {activeTab === 'services' && <ServicesTab {...props} />}
    {activeTab === 'applications' && <ApplicationsTab {...props} />}
    {activeTab === 'recommendations' && <RecommendationsTab {...props} />}
    {activeTab === 'resumes' && <ResumesTab {...props} />}
    {activeTab === 'career-tools' && props.canEdit && <CareerToolsTab {...props} setUnsaved={setUnsaved} />}
    {activeTab === 'audit' && <AuditTab detail={detail} />}
  </div>
}

function SectionCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-200 bg-white shadow-sm"><div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h3 className="font-bold text-slate-900">{title}</h3>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>{action}</div><div className="p-5">{children}</div></section>
}

function OverviewTab(props: WorkspaceProps) {
  const detail = props.detail!
  const setUnsaved = props.setUnsaved
  const [draft, setDraft] = useState<MemberCrmProfile>(detail.crmProfile)
  const [tagsText, setTagsText] = useState(detail.crmProfile.tags.join('、'))
  const [saving, setSaving] = useState(false)
  useEffect(() => { setDraft(detail.crmProfile); setTagsText(detail.crmProfile.tags.join('、')); setUnsaved?.(false) }, [detail, setUnsaved])
  useEffect(() => {
    const initial = { ...detail.crmProfile, tags: detail.crmProfile.tags.join('、') }
    const current = { ...draft, tags: tagsText }
    setUnsaved?.(JSON.stringify(initial) !== JSON.stringify(current))
  }, [detail.crmProfile, draft, setUnsaved, tagsText])
  const update = <K extends keyof MemberCrmProfile>(key: K, value: MemberCrmProfile[K]) => setDraft(current => ({ ...current, [key]: value }))
  const save = async () => {
    setSaving(true)
    try { await memberCrmAdminService.saveProfile(detail.member.userId, { ...draft, tags: tagsText.split(/[、,，\n]+/).map(tag => tag.trim()).filter(Boolean) }, props.token); props.setUnsaved?.(false); props.showSuccess('CRM 资料已保存'); await props.onReload() }
    catch (error) { props.showError('保存失败', error instanceof Error ? error.message : '网络错误') }
    finally { setSaving(false) }
  }
  const fields = [
    ['backgroundSummary', '个人简介', '概括当前职业状态和关键背景', 3],
    ['detailedBackground', '详细背景', '履历脉络、远程经验、语言能力、所在地等', 6],
    ['primaryNeeds', '需求与目标', '目标岗位、期望结果、时间窗口和优先级', 4],
    ['painPoints', '主要痛点', '当前卡点、风险和需要重点支持的部分', 4],
    ['servicePlan', '服务方案', '阶段目标、服务内容、交付物和下一步动作', 6]
  ] as const
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"><SectionCard title="背景与服务方案" description="仅 CRM 管理员可见" action={props.canEdit && <button disabled={saving} onClick={save} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? '保存中…' : '保存修改'}</button>}><div className="space-y-4">{fields.map(([key, label, placeholder, rows]) => <label key={key} className="block"><span className="text-sm font-semibold text-slate-700">{label}</span><textarea disabled={!props.canEdit} rows={rows} value={String(draft[key] || '')} onChange={event => update(key, event.target.value as never)} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-slate-200 p-3 text-sm leading-6 outline-none focus:border-[#9fbbd2] focus:ring-2 focus:ring-[#dce9f5] disabled:bg-slate-50" /></label>)}</div></SectionCard><div className="space-y-4"><SectionCard title="服务节奏"><div className="space-y-4"><Field label="服务阶段"><select disabled={!props.canEdit} value={draft.serviceStage} onChange={event => update('serviceStage', event.target.value as MemberCrmProfile['serviceStage'])} className="input">{Object.entries(STAGE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="上次联系"><input disabled={!props.canEdit} type="datetime-local" value={toInputDate(draft.lastContactAt)} onChange={event => update('lastContactAt', toIso(event.target.value))} className="input" /></Field><Field label="下次跟进"><input disabled={!props.canEdit} type="datetime-local" value={toInputDate(draft.nextFollowUpAt)} onChange={event => update('nextFollowUpAt', toIso(event.target.value))} className="input" /></Field><Field label="标签"><input disabled={!props.canEdit} value={tagsText} onChange={event => setTagsText(event.target.value)} placeholder="产品、英语面试、3个月内入职" className="input" /></Field></div></SectionCard><SectionCard title="账户资料" description="来自用户账户，只读"><dl className="space-y-3 text-sm">{[['当前职位', detail.member.title],['目标方向', detail.member.targetRole],['所在地', detail.member.location],['电话', detail.member.phone],['LinkedIn', detail.member.linkedin]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-0.5 break-words font-medium text-slate-700">{value || '未填写'}</dd></div>)}</dl></SectionCard></div></div>
}

function ServicesTab(props: WorkspaceProps) {
  const detail = props.detail!
  const empty = { serviceType: 'other', title: '', status: 'planned', entitlementKey: '', scheduledAt: '', completedAt: '', details: '', outcome: '' }
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState<CrmServiceRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [documentTarget, setDocumentTarget] = useState<CrmServiceRecord | null>(null)
  const flowRecords = SERVICE_FLOW.map(([key, label]) => {
    const records = detail.services.filter(item => item.serviceType === key)
    const completed = records.find(item => item.status === 'completed')
    const active = records.find(item => ['in_progress', 'scheduled', 'planned'].includes(item.status))
    return { key, label, record: completed || active || records[0] || null, completed: Boolean(completed) }
  })
  const completedCount = flowRecords.filter(item => item.completed).length
  const currentIndex = flowRecords.findIndex(item => item.record && ['in_progress', 'scheduled', 'planned'].includes(item.record.status))
  const nextStep = (currentIndex >= 0 ? flowRecords.slice(currentIndex + 1) : flowRecords).find(item => !item.completed)
  const openForm = (item?: CrmServiceRecord, preset?: { serviceType: string; title: string }) => { setEditing(item || null); setForm(item ? { serviceType: item.serviceType, title: item.title, status: item.status, entitlementKey: item.entitlementKey || '', scheduledAt: toInputDate(item.scheduledAt), completedAt: toInputDate(item.completedAt), details: item.details, outcome: item.outcome } : preset ? { ...empty, ...preset } : empty); setShowForm(true) }
  const save = async () => {
    if (!form.title.trim()) return props.showError('请填写服务标题')
    setSaving(true)
    try { await memberCrmAdminService.saveService(detail.member.userId, { id: editing?.id, ...form, scheduledAt: toIso(form.scheduledAt), completedAt: toIso(form.completedAt), entitlementKey: form.entitlementKey || null } as never, props.token); props.showSuccess(editing ? '服务记录已更新' : '服务记录已添加'); setShowForm(false); await props.onReload() }
    catch (error) { props.showError('保存失败', error instanceof Error ? error.message : '网络错误') }
    finally { setSaving(false) }
  }
  const quickComplete = async (step: typeof flowRecords[number]) => {
    if (step.completed || saving) return
    setSaving(true)
    try {
      const current = step.record
      await memberCrmAdminService.saveService(detail.member.userId, {
        id: current?.id, serviceType: step.key, title: current?.title || step.label,
        status: 'completed', entitlementKey: current?.entitlementKey || null,
        scheduledAt: current?.scheduledAt || null, completedAt: new Date().toISOString(),
        details: current?.details || '', outcome: current?.outcome || ''
      }, props.token)
      props.showSuccess(`已完成：${step.label}`); await props.onReload()
    } catch (error) { props.showError('服务更新失败', error instanceof Error ? error.message : '网络错误') }
    finally { setSaving(false) }
  }
  const archive = async (item: CrmServiceRecord) => { if (!window.confirm(`确认归档“${item.title}”？`)) return; try { await memberCrmAdminService.archiveService(detail.member.userId, item.id, props.token); props.showSuccess('服务记录已归档'); await props.onReload() } catch (error) { props.showError('归档失败', error instanceof Error ? error.message : '网络错误') } }
  const openDocument = async (document: CrmServiceDocument, disposition: 'inline' | 'attachment') => {
    const previewWindow = disposition === 'inline' ? window.open('', '_blank') : null
    try {
      if (previewWindow) previewWindow.document.body.textContent = '正在加载文件…'
      const result = await memberCrmAdminService.getServiceDocumentFile(document.id, props.token, disposition)
      const objectUrl = URL.createObjectURL(result.blob)
      if (previewWindow) previewWindow.location.href = objectUrl
      else { const anchor = window.document.createElement('a'); anchor.href = objectUrl; anchor.download = result.fileName || document.fileName; window.document.body.appendChild(anchor); anchor.click(); anchor.remove() }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (error) { previewWindow?.close(); props.showError('文件读取失败', error instanceof Error ? error.message : '网络错误') }
  }
  const deleteDocument = async (document: CrmServiceDocument) => {
    if (!window.confirm(`永久删除“${document.fileName}”？`)) return
    try { await memberCrmAdminService.deleteServiceDocument(detail.member.userId, document.id, props.token); props.showSuccess('服务文档已删除'); await props.onReload() }
    catch (error) { props.showError('删除失败', error instanceof Error ? error.message : '网络错误') }
  }
  return <div className="space-y-4">
    <SectionCard title="固定服务流程" description={`已完成 ${completedCount}/${SERVICE_FLOW.length} · 下一项：${nextStep?.label || '全部完成'}`} action={props.canEdit && <button onClick={() => openForm()} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">添加其他服务</button>}>
      <div className="grid border border-slate-200 md:grid-cols-2">{flowRecords.map((step, index) => <div key={step.key} className={`flex items-center justify-between gap-3 p-3 ${index % 2 ? 'md:border-l' : ''} ${index >= 2 ? 'border-t' : ''} border-slate-100`}><button onClick={() => step.record ? openForm(step.record) : openForm(undefined, { serviceType: step.key, title: step.label })} className="min-w-0 text-left"><div className="text-sm font-semibold text-slate-800">{index + 1}. {step.label}</div><div className="mt-0.5 text-xs text-slate-400">{step.record ? `${SERVICE_STATUS_LABELS[step.record.status]} · ${formatDate(step.record.completedAt || step.record.scheduledAt, true)}` : '尚未记录'}</div></button>{props.canEdit && <button disabled={step.completed || saving} onClick={() => void quickComplete(step)} className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${step.completed ? 'bg-emerald-50 text-emerald-700' : 'border border-slate-200 text-slate-600 disabled:opacity-50'}`}>{step.completed ? '已完成' : '标记完成'}</button>}</div>)}</div>
    </SectionCard>
    <SectionCard title="服务记录" description="备注与交付文档仅保存在 CRM" action={props.canEdit && <button onClick={() => openForm()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />添加服务</button>}>
      {detail.services.length === 0 ? <EmptyState>暂无服务记录，可从上方固定流程快捷完成。</EmptyState> : <div className="divide-y divide-slate-100">{detail.services.map(item => <div key={item.id} className="py-4 first:pt-0 last:pb-0"><div className="flex flex-col justify-between gap-3 md:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{item.title}</span><StatusBadge value={item.status} label={SERVICE_STATUS_LABELS[item.status]} /></div><div className="mt-1 text-xs text-slate-500">预约 {formatDate(item.scheduledAt, true)} · 完成 {formatDate(item.completedAt, true)}</div>{item.details && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{item.details}</p>}{item.outcome && <p className="mt-2 border-l-2 border-emerald-300 pl-3 text-sm text-slate-700"><b>结果：</b>{item.outcome}</p>}</div>{props.canEdit && <div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setDocumentTarget(item)} className="rounded-lg border border-[#c9dce8] px-3 py-1.5 text-xs font-semibold text-[#466f9d]">添加文档</button><button onClick={() => openForm(item)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">编辑</button><button onClick={() => archive(item)} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600">归档</button></div>}</div>{item.documents.length > 0 && <div className="mt-3 border-t border-slate-100 pt-2"><div className="mb-1 text-[11px] font-semibold text-slate-400">交付文档 {item.documents.length}</div>{item.documents.map(document => <div key={document.id} className="flex items-center justify-between gap-3 py-1.5 text-xs"><button onClick={() => void openDocument(document, ['pdf', 'txt'].includes(document.fileType) ? 'inline' : 'attachment')} className="min-w-0 truncate text-left font-semibold text-[#466f9d]">{document.fileName}</button><div className="flex shrink-0 gap-2"><button onClick={() => void openDocument(document, 'attachment')} className="text-slate-500">下载</button>{props.canEdit && <button onClick={() => void deleteDocument(document)} className="text-rose-600">删除</button>}</div></div>)}</div>}</div>)}</div>}
    </SectionCard>
    <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-bold text-slate-800">查看方案权益（{detail.entitlements.length}）</summary><div className="grid gap-3 border-t border-slate-100 p-5 md:grid-cols-2 xl:grid-cols-3">{detail.entitlements.length === 0 ? <div className="text-sm text-slate-500">当前方案没有人工权益。</div> : detail.entitlements.map(item => <div key={item.key} className="border-l-2 border-slate-200 pl-3"><div className="flex items-start justify-between gap-3"><div className="font-semibold text-slate-800">{item.name}</div><StatusBadge value={item.status} label={ENTITLEMENT_STATUS_LABELS[item.status] || item.status} /></div><div className="mt-1 text-xs text-slate-600">已用 {item.usedQuota} / {item.totalQuota ?? '不限'} · 剩余 {item.remainingQuota ?? '不限'}</div></div>)}</div></details>
    {showForm && <Modal title={editing ? '编辑服务记录' : '添加服务记录'} onClose={() => setShowForm(false)}><div className="grid gap-4 md:grid-cols-2"><Field label="服务类型"><select value={form.serviceType} onChange={event => setForm({ ...form, serviceType: event.target.value })} className="input">{SERVICE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field><Field label="关联权益"><select value={form.entitlementKey} onChange={event => setForm({ ...form, entitlementKey: event.target.value })} className="input"><option value="">不关联</option>{detail.entitlements.map(item => <option key={item.key} value={item.key} disabled={item.remainingQuota === 0}>{item.name}{item.remainingQuota === 0 ? '（已用尽）' : ''}</option>)}</select></Field><Field label="服务标题" span><input autoFocus value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} className="input" /></Field><Field label="状态"><select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as never })} className="input">{Object.entries(SERVICE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="预约时间"><input type="datetime-local" value={form.scheduledAt} onChange={event => setForm({ ...form, scheduledAt: event.target.value })} className="input" /></Field><Field label="完成时间"><input type="datetime-local" value={form.completedAt} onChange={event => setForm({ ...form, completedAt: event.target.value })} className="input" /></Field><Field label="文案备注" span><textarea rows={4} value={form.details} onChange={event => setForm({ ...form, details: event.target.value })} className="input h-auto py-3" placeholder="服务内容、沟通要点或后续安排" /></Field><Field label="交付结果" span><textarea rows={3} value={form.outcome} onChange={event => setForm({ ...form, outcome: event.target.value })} className="input h-auto py-3" placeholder="已提供的方案、材料或结论" /></Field></div><ModalActions saving={saving} onCancel={() => setShowForm(false)} onSave={save} /></Modal>}
    {documentTarget && <ServiceDocumentUploadModal service={documentTarget} userId={detail.member.userId} token={props.token} onClose={() => setDocumentTarget(null)} onUploaded={async () => { setDocumentTarget(null); props.showSuccess('服务文档已上传'); await props.onReload() }} showError={props.showError} />}
  </div>
}

function ServiceDocumentUploadModal({ service, userId, token, onClose, onUploaded, showError }: { service: CrmServiceRecord; userId: string; token: string | null; onClose: () => void; onUploaded: () => Promise<void>; showError: (title: string, message?: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const upload = async () => {
    if (!file) return
    setUploading(true)
    try { await memberCrmAdminService.uploadServiceDocument(userId, service.id, file, notes, token); await onUploaded() }
    catch (error) { showError('上传失败', error instanceof Error ? error.message : '网络错误') }
    finally { setUploading(false) }
  }
  return <Modal title={`添加服务文档：${service.title}`} onClose={onClose}><input ref={inputRef} type="file" accept=".pdf,.docx,.txt" onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><Field label="文档说明（可选）"><input value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} className="input mt-4" placeholder="例如：第一版诊断方案、针对 XX 岗位的定制简历" /></Field><p className="mt-3 text-xs text-slate-500">PDF / DOCX / TXT，单文件不超过 10MB，仅 CRM 内部可见。</p><ModalActions saving={uploading} disabled={!file} onCancel={onClose} onSave={() => void upload()} /></Modal>
}

const emptyManual = { jobTitle: '', companyName: '', jobUrl: '', applicationChannel: 'external', appliedAt: '', status: 'applied', notes: '' }
function ApplicationsTab(props: WorkspaceProps) {
  const detail = props.detail!
  const [manualOpen, setManualOpen] = useState(false)
  const [editingManual, setEditingManual] = useState<CrmApplication | null>(null)
  const [eventTarget, setEventTarget] = useState<CrmApplication | null>(null)
  const [saving, setSaving] = useState(false)
  const [manual, setManual] = useState(emptyManual)
  const [event, setEvent] = useState({ status: 'applied', note: '', eventAt: '', nextFollowUpAt: '' })
  const openManual = (app?: CrmApplication) => { setEditingManual(app || null); setManual(app ? { jobTitle: app.jobTitle, companyName: app.companyName, jobUrl: app.jobUrl, applicationChannel: app.applicationChannel, appliedAt: toInputDate(app.appliedAt), status: app.status, notes: app.notes } : emptyManual); setManualOpen(true) }
  const saveManual = async () => { if (!manual.jobTitle.trim() || !manual.companyName.trim()) return props.showError('请填写岗位和公司名称'); setSaving(true); try { const payload: Partial<CrmApplication> = { ...manual, appliedAt: toIso(manual.appliedAt) }; if (editingManual) await memberCrmAdminService.updateManualApplication(detail.member.userId, { ...payload, id: editingManual.id }, props.token); else await memberCrmAdminService.createManualApplication(detail.member.userId, payload, props.token); props.showSuccess(editingManual ? '站外申请已更新' : '站外申请已补录'); setManualOpen(false); await props.onReload() } catch (error) { props.showError('保存失败', error instanceof Error ? error.message : '网络错误') } finally { setSaving(false) } }
  const openEvent = (app: CrmApplication) => { setEventTarget(app); setEvent({ status: app.status || 'applied', note: '', eventAt: '', nextFollowUpAt: '' }) }
  const addEvent = async () => { if (!eventTarget) return; setSaving(true); try { await memberCrmAdminService.addApplicationEvent({ userId: detail.member.userId, sourceKind: eventTarget.sourceKind, applicationId: eventTarget.id, status: event.status, note: event.note, eventAt: toIso(event.eventAt) || undefined, nextFollowUpAt: toIso(event.nextFollowUpAt) }, props.token); props.showSuccess('申请跟进已记录'); setEventTarget(null); await props.onReload() } catch (error) { props.showError('记录失败', error instanceof Error ? error.message : '网络错误') } finally { setSaving(false) } }
  const archiveManual = async (app: CrmApplication) => { if (!window.confirm(`归档“${app.companyName} · ${app.jobTitle}”？`)) return; try { await memberCrmAdminService.archiveManualApplication(detail.member.userId, app.id, props.token); props.showSuccess('站外申请已归档'); await props.onReload() } catch (error) { props.showError('归档失败', error instanceof Error ? error.message : '网络错误') } }
  return <><SectionCard title="申请岗位" description="入口打开和待确认会显示，但不计入已申请" action={props.canEdit && <button onClick={() => openManual()} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />补录</button>}>{detail.applications.length === 0 ? <EmptyState>暂无申请记录</EmptyState> : <div className="space-y-3">{detail.applications.map(app => <div key={`${app.sourceKind}-${app.id}`} className="rounded-lg border border-slate-200 p-4"><div className="flex flex-col justify-between gap-3 lg:flex-row"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{app.companyName} · {app.jobTitle}</span><StatusBadge value={app.status} label={APPLICATION_STATUS_LABELS[app.status] || app.status} /><StatusBadge value={app.jobAvailability} label={app.jobAvailability === 'active' ? '岗位有效' : app.jobAvailability === 'external' ? '站外岗位' : app.jobAvailability === 'deleted' ? '岗位已删除' : '岗位已下架'} /></div><div className="mt-1 text-xs text-slate-500">{app.sourceKind === 'site' ? '站内' : '手动'} · {app.applicationChannel} · {formatDate(app.appliedAt, true)}</div>{app.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{app.notes}</p>}</div><div className="flex shrink-0 flex-wrap gap-2">{app.jobUrl && <a href={app.jobUrl} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600">查看岗位</a>}{props.canEdit && app.sourceKind === 'manual' && <button onClick={() => openManual(app)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold">编辑</button>}{props.canEdit && <button onClick={() => openEvent(app)} className="rounded-lg bg-[#466f9d] px-3 py-1.5 text-xs font-semibold text-white">添加跟进</button>}{props.canEdit && app.sourceKind === 'manual' && <button aria-label="归档站外申请" onClick={() => archiveManual(app)} className="rounded-lg border border-rose-200 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div></div>{app.events.length > 0 && <div className="mt-4 border-l-2 border-[#dce9f5] pl-4">{app.events.map(item => <div key={item.id} className="relative pb-4 last:pb-0"><span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[#7f9fbc] ring-4 ring-white" /><div className="flex flex-wrap items-center gap-2 text-xs"><b className="text-slate-700">{APPLICATION_STATUS_LABELS[item.status] || item.status}</b><span className="text-slate-400">{formatDate(item.eventAt, true)} · {item.createdByName || '管理员'}</span>{item.nextFollowUpAt && <span className="text-amber-700">下次 {formatDate(item.nextFollowUpAt, true)}</span>}</div>{item.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.note}</p>}</div>)}</div>}</div>)}</div>}</SectionCard>{manualOpen && <Modal title={editingManual ? '编辑站外申请' : '补录站外申请'} onClose={() => setManualOpen(false)}><div className="grid gap-4 md:grid-cols-2"><Field label="岗位名称"><input autoFocus className="input" value={manual.jobTitle} onChange={event => setManual({ ...manual, jobTitle: event.target.value })} /></Field><Field label="公司名称"><input className="input" value={manual.companyName} onChange={event => setManual({ ...manual, companyName: event.target.value })} /></Field><Field label="岗位链接" span><input className="input" placeholder="https://…" value={manual.jobUrl} onChange={event => setManual({ ...manual, jobUrl: event.target.value })} /></Field><Field label="申请渠道"><input className="input" value={manual.applicationChannel} onChange={event => setManual({ ...manual, applicationChannel: event.target.value })} /></Field><Field label="申请时间"><input className="input" type="datetime-local" value={manual.appliedAt} onChange={event => setManual({ ...manual, appliedAt: event.target.value })} /></Field><Field label="当前状态"><select className="input" value={manual.status} onChange={event => setManual({ ...manual, status: event.target.value })}>{Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="备注" span><textarea className="input h-auto py-3" rows={4} value={manual.notes} onChange={event => setManual({ ...manual, notes: event.target.value })} /></Field></div><ModalActions saving={saving} onCancel={() => setManualOpen(false)} onSave={saveManual} /></Modal>}{eventTarget && <Modal title={`跟进：${eventTarget.companyName} · ${eventTarget.jobTitle}`} onClose={() => setEventTarget(null)}><div className="grid gap-4 md:grid-cols-2"><Field label="当前状态"><select className="input" value={event.status} onChange={item => setEvent({ ...event, status: item.target.value })}>{Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="记录时间"><input className="input" type="datetime-local" value={event.eventAt} onChange={item => setEvent({ ...event, eventAt: item.target.value })} /></Field><Field label="下次跟进"><input className="input" type="datetime-local" value={event.nextFollowUpAt} onChange={item => setEvent({ ...event, nextFollowUpAt: item.target.value })} /></Field><Field label="跟进内容" span><textarea autoFocus className="input h-auto py-3" rows={5} value={event.note} onChange={item => setEvent({ ...event, note: item.target.value })} placeholder="回复、面试安排或待办事项" /></Field></div><ModalActions saving={saving} onCancel={() => setEventTarget(null)} onSave={addEvent} /></Modal>}</>
}

function RecommendationsTab(props: WorkspaceProps) {
  const detail = props.detail!
  const openBundle = (id: number) => { const url = new URL(window.location.href); url.searchParams.set('tab', 'job-bundles'); url.searchParams.set('bundleId', String(id)); url.searchParams.delete('memberId'); window.location.href = `${url.pathname}${url.search}` }
  return <SectionCard title="推荐岗位" description="合集状态与岗位状态分别展示">{detail.recommendationBundles.length === 0 ? <EmptyState>暂无指定给该会员的职位组合</EmptyState> : <div className="space-y-4">{detail.recommendationBundles.map(bundle => <div key={bundle.id} className="overflow-hidden rounded-lg border border-slate-200"><div className="flex flex-col justify-between gap-3 bg-slate-50 px-4 py-3 md:flex-row md:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold text-slate-900">{bundle.title}</span><StatusBadge value={bundle.isActive ? bundle.scheduleState : 'expired'} label={!bundle.isActive ? '合集停用' : bundle.scheduleState === 'expired' ? '合集过期' : bundle.scheduleState === 'upcoming' ? '待开放' : '合集有效'} /></div><div className="mt-1 text-xs text-slate-500">{formatDate(bundle.startTime)}—{formatDate(bundle.endTime)} · {bundle.jobs.length} 个岗位</div></div>{props.canEdit && <button onClick={() => openBundle(bundle.id)} className="rounded-lg border border-[#c9dce8] bg-white px-3 py-2 text-xs font-semibold text-[#466f9d]">补充岗位</button>}</div><div className="divide-y divide-slate-100">{bundle.jobs.map(job => <div key={job.jobId} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-800">{job.company} · {job.title}</div><div className="mt-0.5 truncate font-mono text-[11px] text-slate-400">{job.jobId}</div></div><StatusBadge value={job.status} label={job.status === 'active' ? '有效' : job.status === 'deleted' ? '已删除' : '已下架'} /></div>)}</div></div>)}</div>}</SectionCard>
}

function CareerToolsTab(props: WorkspaceProps) {
  const detail = props.detail!
  const [workspace, setWorkspace] = useState<CrmCareerWorkspace | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [selectedSource, setSelectedSource] = useState('')
  const [selectedRunId, setSelectedRunId] = useState('')
  const [consultantFocus, setConsultantFocus] = useState('')
  const [includeCrmContext, setIncludeCrmContext] = useState(true)
  const [error, setError] = useState('')
  const resumeOptions = useMemo(() => [
    ...detail.crmResumes.map(item => ({ ...item, source: 'crm' as const, label: `CRM · ${item.fileName} · ${formatDate(item.createdAt)}` })),
    ...detail.userResumes.map(item => ({ ...item, source: 'user' as const, label: `用户只读 · ${item.fileName} · ${formatDate(item.createdAt)}` }))
  ], [detail.crmResumes, detail.userResumes])
  const loadWorkspace = useCallback(async (preferredRunId = '') => {
    setLoading(true); setError('')
    try {
      const data = await memberCrmAdminService.careerWorkspace(detail.member.userId, props.token)
      setWorkspace(data)
      setSelectedRunId(preferredRunId || data.runs.find(item => item.artifact)?.id || data.runs[0]?.id || '')
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : '网络错误'
      setError(message)
    } finally { setLoading(false) }
  }, [detail.member.userId, props.token])
  useEffect(() => { void loadWorkspace() }, [loadWorkspace])
  useEffect(() => {
    if (!selectedSource && resumeOptions[0]) setSelectedSource(`${resumeOptions[0].source}:${resumeOptions[0].id}`)
  }, [resumeOptions, selectedSource])
  const selectedRun = workspace?.runs.find(item => item.id === selectedRunId) || workspace?.runs[0] || null
  const start = async (force = false) => {
    const [sourceResumeKind, ...idParts] = selectedSource.split(':')
    const sourceResumeId = idParts.join(':')
    if (!sourceResumeId || !['crm', 'user'].includes(sourceResumeKind)) return props.showError('请先选择一份可解析的简历')
    setRunning(true); setError('')
    try {
      const result = await memberCrmAdminService.runResumeDiagnosis({
        userId: detail.member.userId,
        sourceResumeKind: sourceResumeKind as 'crm' | 'user',
        sourceResumeId,
        includeCrmContext,
        consultantFocus,
        force
      }, props.token)
      props.showSuccess(result.deduplicated ? '相同任务已在生成，请稍后刷新' : result.cached ? '已复用相同版本的诊断结果' : '简历诊断已生成')
      await loadWorkspace(result.id)
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : '网络错误'
      setError(message); props.showError('诊断生成失败', message)
      await loadWorkspace()
    } finally { setRunning(false) }
  }
  if (loading && !workspace) return <div className="flex min-h-[320px] items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />正在加载顾问工具…</div>
  return <div className="space-y-4">
    <SectionCard title="新建简历诊断" description="CRM 内部底稿，不写入用户前台或匹配数据">
      <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_minmax(320px,1.4fr)_auto] xl:items-end">
        <Field label="来源简历"><select className="input" value={selectedSource} onChange={event => setSelectedSource(event.target.value)} disabled={running}><option value="">请选择</option>{resumeOptions.map(item => <option key={`${item.source}-${item.id}`} value={`${item.source}:${item.id}`} disabled={item.parseStatus === 'failed'}>{item.label}{item.parseStatus === 'failed' ? '（解析失败）' : ''}</option>)}</select></Field>
        <Field label="本次分析重点（可选）"><input className="input" maxLength={1000} value={consultantFocus} onChange={event => setConsultantFocus(event.target.value)} disabled={running} placeholder="例如：转产品运营、突出海外项目、核查管理跨度" /></Field>
        <button disabled={running || !selectedSource || !workspace?.modelConfigured} onClick={() => void start(false)} className="flex h-10 items-center justify-center rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-40">{running ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成中…</> : '生成诊断'}</button>
      </div>
      <div className="mt-3 flex flex-col justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 md:flex-row md:items-center">
        <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={includeCrmContext} onChange={event => setIncludeCrmContext(event.target.checked)} disabled={running} className="h-4 w-4 rounded border-slate-300 text-[#466f9d]" />带入 CRM 背景、需求与服务方案</label>
        <span>联系方式会先移除；相同输入自动复用，避免重复消耗 Token。</span>
      </div>
      {workspace && !workspace.modelConfigured && <p role="alert" className="mt-3 border-t border-amber-200 pt-3 text-xs font-medium text-amber-700">Qwen 内地端尚未配置，暂时无法生成。</p>}
      {error && <p role="alert" className="mt-3 border-t border-rose-200 pt-3 text-xs text-rose-700">{error}</p>}
      <div aria-live="polite" className="sr-only">{running ? '诊断正在生成' : ''}</div>
    </SectionCard>

    {workspace?.runs.length ? <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
      <SectionCard title="历史版本" description={`${workspace.provider} · ${workspace.model}`}>
        <div className="divide-y divide-slate-100">{workspace.runs.map(run => <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`w-full border-l-2 px-3 py-3 text-left transition-colors ${selectedRun?.id === run.id ? 'border-[#587faa] bg-[#eff5fb]/50' : 'border-transparent hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-2"><span className="line-clamp-2 text-xs font-semibold leading-5 text-slate-700">v{run.artifact?.version || '—'} · {run.sourceResumeName}</span><CareerRunStatus run={run} /></div><div className="mt-1 text-[11px] text-slate-400">{formatDate(run.createdAt, true)}{run.cached ? ' · 已复用' : ''}</div></button>)}</div>
      </SectionCard>
      <div>{selectedRun?.artifact ? <CareerArtifactView run={selectedRun} artifact={selectedRun.artifact} props={props} onChanged={() => loadWorkspace(selectedRun.id)} onRegenerate={() => start(true)} running={running} /> : selectedRun?.status === 'failed' ? <SectionCard title="本次诊断失败"><p className="text-sm font-semibold text-rose-700">{selectedRun.errorMessage || '执行失败'}</p><p className="mt-1 text-xs text-slate-400">{selectedRun.errorCode || 'RUN_FAILED'}</p><button disabled={running} onClick={() => void start(true)} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">重新生成</button></SectionCard> : <SectionCard title="任务状态"><p className="text-sm text-slate-500">任务正在生成，完成后刷新工作区即可查看。</p></SectionCard>}</div>
    </div> : <SectionCard title="顾问成果"><div className="py-3 text-sm text-slate-500">选择简历并生成后，诊断、候选人画像与职业方向会显示在这里。</div></SectionCard>}
  </div>
}

function CareerRunStatus({ run }: { run: CrmCareerRun }) {
  const label = run.status === 'completed' ? run.artifact?.status === 'approved' ? '已确认' : run.artifact?.status === 'archived' ? '已归档' : '待审核' : run.status === 'running' ? '生成中' : run.status === 'failed' ? '失败' : '已取消'
  const value = run.status === 'completed' ? run.artifact?.status === 'approved' ? 'completed' : run.artifact?.status === 'archived' ? 'expired' : 'pending' : run.status
  return <StatusBadge value={value || 'pending'} label={label} />
}

function CareerArtifactView({ run, artifact, props, onChanged, onRegenerate, running }: {
  run: CrmCareerRun; artifact: CrmCareerArtifact; props: WorkspaceProps
  onChanged: () => Promise<void>; onRegenerate: () => Promise<void>; running: boolean
}) {
  const content = artifact.content
  const [notes, setNotes] = useState(artifact.consultantNotes || '')
  const [saving, setSaving] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const setUnsaved = props.setUnsaved
  useEffect(() => setNotes(artifact.consultantNotes || ''), [artifact.id, artifact.consultantNotes])
  useEffect(() => setUnsaved?.(notes !== artifact.consultantNotes), [artifact.consultantNotes, notes, setUnsaved])
  useEffect(() => () => setUnsaved?.(false), [setUnsaved])
  const update = async (action: 'approve' | 'archive' | 'update_notes') => {
    setSaving(true)
    try {
      await memberCrmAdminService.updateCareerArtifact({ userId: run.userId, artifactId: artifact.id, action, consultantNotes: notes }, props.token)
      props.setUnsaved?.(false)
      props.showSuccess(action === 'approve' ? '画像已确认，可用于后续顾问任务' : action === 'archive' ? '顾问成果已归档' : '顾问备注已保存')
      await onChanged()
    } catch (error) { props.showError('操作失败', error instanceof Error ? error.message : '网络错误') }
    finally { setSaving(false) }
  }
  const saveProfile = async (candidateProfile: CrmCareerArtifact['content']['candidateProfile']) => {
    setSaving(true)
    try {
      await memberCrmAdminService.updateCareerArtifact({ userId: run.userId, artifactId: artifact.id, action: 'update_profile', candidateProfile }, props.token)
      props.showSuccess('候选人画像已校正')
      setProfileOpen(false)
      await onChanged()
    } catch (error) { props.showError('画像保存失败', error instanceof Error ? error.message : '网络错误') }
    finally { setSaving(false) }
  }
  const pathGroups = [['当前可申请', content.careerPaths.now], ['过渡方向', content.careerPaths.bridge], ['长期方向', content.careerPaths.later]] as const
  const usage = Number(run.tokenUsage?.total_tokens) || (Number(run.tokenUsage?.prompt_tokens) || 0) + (Number(run.tokenUsage?.completion_tokens) || 0)
  return <><div className="space-y-4">
    <SectionCard title={`诊断成果 v${artifact.version}`} description={`${run.sourceResumeName} · ${run.model}${usage ? ` · ${usage.toLocaleString()} tokens` : ''}`} action={<div className="flex flex-wrap gap-2"><CareerRunStatus run={run} />{artifact.status === 'draft' && <button onClick={() => setProfileOpen(true)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600">编辑画像</button>}<button disabled={running} onClick={() => void onRegenerate()} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-40">重新生成</button></div>}>
      <div className="space-y-5">
        <div><h4 className="text-lg font-bold text-slate-950">{content.summary.headline}</h4><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{content.summary.positioning}</p><p className="mt-3 border-l-2 border-[#9fbbd2] pl-3 text-sm leading-6 text-slate-700"><b>咨询重点：</b>{content.summary.consultantBrief}</p></div>
        <div className="flex flex-wrap gap-2">{content.candidateProfile.primaryFunctions.map(item => <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{item}</span>)}</div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 border-y border-slate-100 py-3 text-xs text-slate-500"><span><b className="text-slate-800">{content.quality.verifiedEvidenceCount}</b> 条可信证据</span><span><b className="text-slate-800">{content.candidateProfile.unverifiedClaims.length}</b> 项待确认</span><span><b className="text-slate-800">{content.clarificationQuestions.length}</b> 个建议追问</span></div>
        {content.quality.warnings.length > 0 && <p className="text-xs leading-5 text-amber-700">质量提示：{content.quality.warnings.join(' ')}</p>}
      </div>
    </SectionCard>
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title="核心优势" description="仅保留可追溯到原文的结论"><div className="divide-y divide-slate-100">{content.strengths.map(item => <div key={item.title} className="py-3 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><b className="text-sm text-slate-800">{item.title}</b><span className="text-[11px] font-semibold text-slate-400">{item.confidence === 'high' ? '高置信' : item.confidence === 'medium' ? '中置信' : '低置信'}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{item.explanation}</p><div className="mt-1 text-[11px] text-[#587faa]">证据 {item.evidenceIds.join('、')}</div></div>)}</div></SectionCard>
      <SectionCard title="优先优化项" description="按风险和影响排序"><div className="divide-y divide-slate-100">{content.findings.map(item => <div key={`${item.category}-${item.title}`} className="py-3 first:pt-0 last:pb-0"><div className="flex items-start justify-between gap-3"><b className="text-sm text-slate-800">{item.title}</b><span className={`text-[11px] font-semibold ${item.severity === 'high' ? 'text-rose-600' : item.severity === 'medium' ? 'text-amber-600' : 'text-slate-400'}`}>{item.severity === 'high' ? '高优先' : item.severity === 'medium' ? '中优先' : '低优先'}</span></div><p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p><p className="mt-1 text-xs leading-5 text-slate-700"><b>建议：</b>{item.recommendation}</p></div>)}</div></SectionCard>
    </div>
    <SectionCard title="职业方向" description="当前、过渡、长期三层建议"><div className="grid gap-5 xl:grid-cols-3">{pathGroups.map(([label, paths], index) => <div key={label} className={index ? 'xl:border-l xl:border-slate-100 xl:pl-5' : ''}><h4 className="mb-2 text-xs font-bold tracking-wide text-slate-400">{label}</h4><div className="divide-y divide-slate-100">{paths.length === 0 ? <div className="text-xs text-slate-400">暂无可靠建议</div> : paths.map(path => <div key={path.roleName} className="py-3 first:pt-0 last:pb-0"><b className="text-sm text-slate-800">{path.roleName}</b><p className="mt-1 text-xs leading-5 text-slate-600">{path.whyFit}</p>{path.mainGaps.length > 0 && <div className="mt-1 text-xs text-amber-700">缺口：{path.mainGaps.join('；')}</div>}</div>)}</div></div>)}</div></SectionCard>
    <div className="grid gap-4 xl:grid-cols-2">
      <SectionCard title="建议追问" description="只保留会改变判断的问题">{content.clarificationQuestions.length === 0 ? <div className="text-sm text-slate-500">暂无必须追问的问题</div> : <ol className="divide-y divide-slate-100">{content.clarificationQuestions.map((item, index) => <li key={item.question} className="py-3 first:pt-0 last:pb-0"><div className="text-sm font-semibold text-slate-800">{index + 1}. {item.question}</div><p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p></li>)}</ol>}</SectionCard>
      <SectionCard title="顾问审核" description="确认后可作为后续岗位推荐与定制简历的内部输入"><textarea disabled={artifact.status === 'archived'} className="input h-auto py-3 disabled:bg-slate-50" rows={6} value={notes} onChange={event => setNotes(event.target.value)} placeholder="记录访谈补充、不同意见或下一步处理建议" /><div className="mt-3 flex flex-wrap justify-end gap-2"><button disabled={saving || artifact.status === 'archived' || notes === artifact.consultantNotes} onClick={() => void update('update_notes')} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40">保存备注</button>{artifact.status === 'draft' && <button disabled={saving} onClick={() => void update('approve')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">确认画像并用于后续</button>}{artifact.status !== 'archived' && <button disabled={saving} onClick={() => void update('archive')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 disabled:opacity-40">归档</button>}</div></SectionCard>
    </div>
    <details className="rounded-xl border border-slate-200 bg-white"><summary className="cursor-pointer px-5 py-4 text-sm font-bold text-slate-800">查看证据账本（{content.evidenceLedger.length}）</summary><div className="divide-y divide-slate-100 border-t border-slate-100 px-5">{content.evidenceLedger.map(item => <div key={item.id} className="py-3"><div className="flex items-center gap-2"><span className="text-[11px] font-bold text-[#466f9d]">{item.id} · {item.grade}</span><span className="text-sm font-semibold text-slate-700">{item.statement}</span></div><blockquote className="mt-2 border-l-2 border-slate-200 pl-3 text-xs leading-5 text-slate-500">{item.sourceExcerpt}</blockquote></div>)}</div></details>
  </div>{profileOpen && <CareerProfileModal profile={content.candidateProfile} saving={saving} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}</>
}

function CareerProfileModal({ profile, saving, onClose, onSave }: { profile: CrmCareerArtifact['content']['candidateProfile']; saving: boolean; onClose: () => void; onSave: (profile: CrmCareerArtifact['content']['candidateProfile']) => Promise<void> }) {
  const [draft, setDraft] = useState(profile)
  const listFields = [
    ['primaryFunctions', '主要职能'], ['transferableSkills', '可迁移能力'], ['domainAssets', '领域资产'],
    ['workStyleStrengths', '工作方式优势'], ['languages', '语言'], ['tools', '工具'],
    ['targetRolesNow', '当前目标岗位'], ['targetRolesBridge', '过渡岗位'], ['targetRolesLater', '长期岗位'],
    ['evidenceGaps', '证据缺口'], ['unverifiedClaims', '待确认信息']
  ] as const
  const listValue = (key: typeof listFields[number][0]) => draft[key].join('、')
  const setList = (key: typeof listFields[number][0], value: string) => setDraft({ ...draft, [key]: value.split(/[、,，\n]+/).map(item => item.trim()).filter(Boolean) })
  const requestClose = () => { if (JSON.stringify(draft) === JSON.stringify(profile) || window.confirm('画像修改尚未保存，确定关闭吗？')) onClose() }
  return <Modal title="校正候选人画像" onClose={requestClose}><p className="mb-4 text-xs leading-5 text-slate-500">修改只影响 CRM 内部顾问成果，不改用户前台简历。确认画像前请核对事实与访谈信息。</p><div className="grid gap-4 md:grid-cols-2"><Field label="一句话定位" span><input autoFocus className="input" maxLength={180} value={draft.headline} onChange={event => setDraft({ ...draft, headline: event.target.value })} /></Field><Field label="资历层级"><select className="input" value={draft.seniority} onChange={event => setDraft({ ...draft, seniority: event.target.value as typeof draft.seniority })}><option value="entry">初级</option><option value="mid">中级</option><option value="senior_ic">资深专家</option><option value="manager">经理</option><option value="director">总监</option><option value="uncertain">待确认</option></select></Field>{listFields.map(([key, label]) => <Field key={key} label={label} span={['evidenceGaps', 'unverifiedClaims'].includes(key)}><textarea className="input h-auto py-3" rows={['evidenceGaps', 'unverifiedClaims'].includes(key) ? 3 : 2} value={listValue(key)} onChange={event => setList(key, event.target.value)} placeholder="使用顿号、逗号或换行分隔" /></Field>)}</div><ModalActions saving={saving} onCancel={requestClose} onSave={() => void onSave(draft)} /></Modal>
}

function ResumesTab(props: WorkspaceProps) {
  const detail = props.detail!
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const upload = async () => { if (!file) return; setUploading(true); try { await memberCrmAdminService.uploadResume(detail.member.userId, file, notes, props.token); props.showSuccess('CRM 简历已上传'); setFile(null); setNotes(''); if (inputRef.current) inputRef.current.value = ''; await props.onReload() } catch (error) { props.showError('上传失败', error instanceof Error ? error.message : '网络错误') } finally { setUploading(false) } }
  const remove = async (id: string, fileName: string) => { if (!window.confirm(`永久删除“${fileName}”？此操作不能恢复。`)) return; try { await memberCrmAdminService.deleteResume(detail.member.userId, id, props.token); props.showSuccess('CRM 简历已删除'); await props.onReload() } catch (error) { props.showError('删除失败', error instanceof Error ? error.message : '网络错误') } }
  const openFile = async (item: CrmResumeDocument, source: 'user' | 'crm', disposition: 'inline' | 'attachment') => {
    const previewWindow = disposition === 'inline' ? window.open('', '_blank') : null
    try {
      if (previewWindow) previewWindow.document.body.textContent = '正在加载文件…'
      const result = source === 'crm' ? await memberCrmAdminService.getCrmResumeFile(item.id, props.token, disposition) : await memberCrmAdminService.getUserResumeFile(item.id, props.token)
      const objectUrl = URL.createObjectURL(result.blob)
      if (disposition === 'inline' && previewWindow) previewWindow.location.href = objectUrl
      else { const anchor = document.createElement('a'); anchor.href = objectUrl; anchor.download = result.fileName || item.fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove() }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60000)
    } catch (error) { previewWindow?.close(); props.showError('文件读取失败', error instanceof Error ? error.message : '网络错误') }
  }
  return <div className="grid gap-4 xl:grid-cols-2"><SectionCard title="用户前台简历" description="只读，不会被 CRM 修改">{detail.userResumes.length === 0 ? <EmptyState>用户尚未上传简历</EmptyState> : <div className="space-y-3">{detail.userResumes.map(item => <ResumeRow key={item.id} item={item} onPreview={['pdf','txt'].includes(item.fileType.toLowerCase()) ? () => openFile(item, 'user', 'inline') : undefined} onDownload={() => openFile(item, 'user', 'attachment')} />)}</div>}</SectionCard><SectionCard title="CRM 简历" description="独立归档，不参与前台展示和匹配">{props.canEdit && <div className="mb-4 rounded-lg border border-dashed border-[#c9dce8] bg-[#eff5fb]/40 p-4"><input aria-label="选择 CRM 简历" ref={inputRef} type="file" accept=".pdf,.docx,.txt" onChange={event => setFile(event.target.files?.[0] || null)} className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[#466f9d] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><input aria-label="简历备注" value={notes} onChange={event => setNotes(event.target.value)} placeholder="版本或用途（可选）" className="mt-3 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">PDF / DOCX / TXT，≤ 10MB</span><button disabled={!file || uploading} onClick={upload} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{uploading ? '上传中…' : '上传'}</button></div></div>}{detail.crmResumes.length === 0 ? <EmptyState>暂无 CRM 简历</EmptyState> : <div className="space-y-3">{detail.crmResumes.map(item => <ResumeRow key={item.id} item={item} onPreview={['pdf','txt'].includes(item.fileType.toLowerCase()) ? () => openFile(item, 'crm', 'inline') : undefined} onDownload={() => openFile(item, 'crm', 'attachment')} onDelete={props.canEdit ? () => remove(item.id, item.fileName) : undefined} />)}</div>}</SectionCard></div>
}

function ResumeRow({ item, onPreview, onDownload, onDelete }: { item: CrmResumeDocument; onPreview?: () => void; onDownload: () => void; onDelete?: () => void }) {
  return <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center"><div className="min-w-0"><div className="truncate text-sm font-semibold text-slate-800">{item.fileName}</div><div className="mt-1 text-xs text-slate-400">{(item.fileSize / 1024).toFixed(0)} KB · {item.fileType.toUpperCase()} · {formatDate(item.createdAt, true)}</div>{item.notes && <div className="mt-1 text-xs text-slate-500">{item.notes}</div>}</div><div className="flex shrink-0 gap-2">{onPreview && <button onClick={onPreview} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600">预览</button>}<button onClick={onDownload} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-[#466f9d]">下载</button>{onDelete && <button aria-label={`删除 ${item.fileName}`} onClick={onDelete} className="rounded-lg border border-rose-200 p-2 text-rose-600"><Trash2 className="h-4 w-4" /></button>}</div></div>
}

function AuditTab({ detail }: { detail: MemberCrmDetail }) {
  return <SectionCard title="操作记录" description="记录操作人、时间和变更范围">{detail.auditLog.length === 0 ? <EmptyState>暂无操作记录</EmptyState> : <div>{detail.auditLog.map(item => <div key={item.id} className="border-b border-slate-100 py-3 first:pt-0 last:border-0 last:pb-0"><div className="text-sm font-semibold text-slate-800">{AUDIT_ACTION_LABELS[item.action] || item.action}</div><div className="mt-1 text-xs text-slate-400">{formatDate(item.createdAt, true)} · {item.adminName}{item.changedFields.length ? ` · ${item.changedFields.join('、')}` : ''}</div></div>)}</div>}</SectionCard>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const titleId = useId()
  const closeRef = useRef<HTMLButtonElement | null>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }; document.addEventListener('keydown', onKeyDown); closeRef.current?.focus(); return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() } }, [])
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><h3 id={titleId} className="font-bold text-slate-900">{title}</h3><button ref={closeRef} aria-label="关闭弹窗" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="p-5">{children}</div></div></div>
}

function Field({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) {
  return <label className={span ? 'block md:col-span-2' : 'block'}><span className="mb-2 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>
}

function ModalActions({ saving, disabled = false, onCancel, onSave }: { saving: boolean; disabled?: boolean; onCancel: () => void; onSave: () => void }) {
  return <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button onClick={onCancel} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">取消</button><button disabled={saving || disabled} onClick={onSave} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? '保存中…' : '保存'}</button></div>
}
