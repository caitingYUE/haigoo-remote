import React, { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  Sparkles
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  '后端开发', '前端开发', '全栈开发', '移动开发', '数据开发', '服务器开发',
  '算法工程师', '测试/QA', '运维/SRE', '网络安全', '操作系统/内核',
  '技术支持', '硬件开发', '架构师', 'CTO/技术管理',
  '产品经理', '产品设计', 'UI/UX设计', '视觉设计', '平面设计', '用户研究',
  '市场营销', '销售', '客户经理', '客户服务', '运营', '增长黑客', '内容创作',
  '人力资源', '招聘', '财务', '法务', '行政', '管理',
  '数据分析', '商业分析', '数据科学', '教育培训', '咨询', '投资', '其他'
];

const JOB_TYPE_OPTIONS = [
  { label: '全职', value: 'full-time' },
  { label: '兼职', value: 'part-time' },
  { label: '合同', value: 'contract' },
  { label: '自由职业', value: 'freelance' },
  { label: '实习', value: 'internship' }
];

const EXPERIENCE_OPTIONS = [
  { label: '初级', value: 'Entry' },
  { label: '中级', value: 'Mid' },
  { label: '高级', value: 'Senior' },
  { label: '专家', value: 'Lead' },
  { label: '高管', value: 'Executive' }
];

const INDUSTRY_OPTIONS = [
  '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
  '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
  '硬件/物联网', '消费生活', '其他'
];

const TEMPLATE_VERSION = 'xhs-v1';

interface ReferralContact {
  name?: string;
  title?: string;
  hiringEmail?: string;
  emailType?: string;
}

interface XhsPushJobListItem {
  id: string;
  title: string;
  company: string;
  location: string;
  category: string;
  jobType: string;
  experienceLevel: string;
  description: string;
  updatedAt: string | null;
  shareUrl: string;
  employeeCount: string;
  address: string;
  foundedYear: string;
  companyRating: string;
  industry: string;
  hiringEmail: string;
  emailType: string;
  referralContacts: ReferralContact[];
  companyInfoCompact: string;
  referralInfoCompact: string;
  completenessScore: number;
  missingFields: string[];
  hasReferralContact: boolean;
  hasCompanyMeta: boolean;
}

interface XhsJobsResponse {
  success: boolean;
  items: XhsPushJobListItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

interface XhsPosterDraft {
  summary: string;
  provider: 'local' | 'bailian';
  templateVersion: string;
  generatedAt: string;
  cacheHit?: boolean;
  usedFallback?: boolean;
}

interface Props {
  token?: string | null;
}

function stripHtml(value: string) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildLocalPosterSummary(job: XhsPushJobListItem, maxLength = 110) {
  const source = stripHtml(job.description);
  if (!source) return '岗位亮点待补充，可结合 JD 核对后再生成配图。';

  const sentences = source
    .split(/(?<=[。！？!?.；;])/)
    .map((item) => item.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    const key = sentence.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(sentence);
  }

  let output = '';
  for (const sentence of deduped) {
    const next = output ? `${output} ${sentence}` : sentence;
    if (next.length > maxLength) break;
    output = next;
  }

  if (!output) {
    output = (deduped[0] || source).slice(0, maxLength);
  }

  return output.slice(0, maxLength).trim();
}

function shouldUseAiSummary(localSummary: string, description: string) {
  const cleanDescription = stripHtml(description);
  if (!cleanDescription) return false;
  if (localSummary.length > 118) return true;
  if (cleanDescription.length >= 560) return true;
  if ((cleanDescription.match(/[•·▪●]/g) || []).length >= 6) return true;
  return false;
}

function formatJobTypeLabel(value: string) {
  const matched = JOB_TYPE_OPTIONS.find((item) => item.value === value);
  return matched?.label || value || '待补充';
}

function formatExperienceLabel(value: string) {
  const matched = EXPERIENCE_OPTIONS.find((item) => item.value === value);
  return matched?.label || value || '待补充';
}

function getCompletenessTone(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (score >= 50) return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-rose-50 text-rose-700 border-rose-200';
}

function buildPublishPack(job: XhsPushJobListItem, summary: string) {
  return [
    `【${job.title}】`,
    `【${job.company}】`,
    `地点：${job.location}｜角色：${job.category}｜类型：${formatJobTypeLabel(job.jobType)}｜级别：${formatExperienceLabel(job.experienceLevel)}`,
    `申请链接：${job.shareUrl}`,
    `企业认证：${job.companyInfoCompact}`,
    `所属行业：${job.industry || '待补充'}`,
    `内推信息：${job.referralInfoCompact}`,
    '',
    `岗位亮点：${summary || '待补充'}`
  ].join('\n');
}

const AdminXiaohongshuPush: React.FC<Props> = ({ token }) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [jobType, setJobType] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');
  const [industry, setIndustry] = useState('');
  const [jobs, setJobs] = useState<XhsPushJobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [downloadingPoster, setDownloadingPoster] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posterError, setPosterError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [posterDraft, setPosterDraft] = useState<XhsPosterDraft | null>(null);
  const posterRef = useRef<HTMLDivElement>(null);
  const jobsRef = useRef<XhsPushJobListItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchKeyword(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const selectedJob = jobs.find((item) => item.id === selectedJobId) || null;

  const fetchJobs = useCallback(async (nextPage = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
        sort: 'info_complete,recent'
      });

      if (searchKeyword) params.append('search', searchKeyword);
      if (category) params.append('category', category);
      if (jobType) params.append('jobType', jobType);
      if (experienceLevel) params.append('experienceLevel', experienceLevel);
      if (industry) params.append('industry', industry);

      const res = await fetch(`/api/admin/content-push/xiaohongshu/jobs?${params.toString()}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json() as XhsJobsResponse & { error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || '加载小红书推送岗位失败');
      }

      const nextItems = append ? [...jobsRef.current, ...data.items] : data.items;
      setJobs(nextItems);
      setPage(data.page);
      setHasMore(Boolean(data.hasMore));
      setTotal(data.total || 0);
      setSelectedJobId((current) => {
        if (current && nextItems.some((item) => item.id === current)) return current;
        return nextItems[0]?.id || null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载小红书推送岗位失败');
      if (!append) {
        setJobs([]);
        setSelectedJobId(null);
        setTotal(0);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, experienceLevel, industry, jobType, searchKeyword, token]);

  useEffect(() => {
    fetchJobs(1, false);
  }, [fetchJobs]);

  useEffect(() => {
    setPosterDraft(null);
    setPosterError(null);
  }, [selectedJobId]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 2000);
    } catch (_error) {
      alert('复制失败，请检查浏览器权限');
    }
  };

  const handleReset = () => {
    setSearchInput('');
    setSearchKeyword('');
    setCategory('');
    setJobType('');
    setExperienceLevel('');
    setIndustry('');
  };

  const handleGeneratePoster = async () => {
    if (!selectedJob) return;

    try {
      setGeneratingPoster(true);
      setPosterError(null);

      const localSummary = buildLocalPosterSummary(selectedJob);
      let summary = localSummary;
      let provider: 'local' | 'bailian' = 'local';
      let cacheHit = false;
      let usedFallback = false;

      if (shouldUseAiSummary(localSummary, selectedJob.description)) {
        const res = await fetch('/api/admin/content-push/xiaohongshu/summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            id: selectedJob.id,
            title: selectedJob.title,
            company: selectedJob.company,
            location: selectedJob.location,
            category: selectedJob.category,
            jobType: selectedJob.jobType,
            experienceLevel: selectedJob.experienceLevel,
            description: selectedJob.description,
            updatedAt: selectedJob.updatedAt,
            summary: localSummary
          })
        });

        const data = await res.json() as {
          success: boolean;
          summary?: string;
          provider?: 'local' | 'bailian';
          cacheHit?: boolean;
          usedFallback?: boolean;
          error?: string;
        };

        if (!res.ok || !data.success) {
          throw new Error(data.error || '生成岗位摘要失败');
        }

        summary = data.summary || localSummary;
        provider = data.provider || 'local';
        cacheHit = Boolean(data.cacheHit);
        usedFallback = Boolean(data.usedFallback);
      }

      setPosterDraft({
        summary,
        provider,
        templateVersion: TEMPLATE_VERSION,
        generatedAt: new Date().toISOString(),
        cacheHit,
        usedFallback
      });
    } catch (err) {
      setPosterError(err instanceof Error ? err.message : '生成海报失败');
    } finally {
      setGeneratingPoster(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!posterRef.current || !selectedJob || !posterDraft) return;

    try {
      setDownloadingPoster(true);
      await new Promise((resolve) => setTimeout(resolve, 120));

      const canvas = await html2canvas(posterRef.current, {
        useCORS: true,
        scale: 2,
        backgroundColor: '#f8f1e7',
        logging: false
      });

      const link = document.createElement('a');
      link.download = `${selectedJob.company}-${selectedJob.title}-xiaohongshu.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export xiaohongshu poster:', err);
      alert('导出图片失败，请重试');
    } finally {
      setDownloadingPoster(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
      <aside className="space-y-4 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">Xiaohongshu Push</div>
          <h2 className="mt-2 text-xl font-bold text-slate-900">小红书单岗位内容推送</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            左侧筛选岗位，右侧快速复制发布信息并按需生成 3:4 海报。
          </p>
        </div>

        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="搜索岗位名称或企业"
              className="w-full rounded-2xl border border-rose-100 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            />
          </div>

          <div className="mt-3 grid gap-3">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              <option value="">全部岗位角色</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>

            <select
              value={jobType}
              onChange={(event) => setJobType(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              <option value="">全部岗位类型</option>
              {JOB_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={experienceLevel}
              onChange={(event) => setExperienceLevel(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              <option value="">全部岗位级别</option>
              {EXPERIENCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <select
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
              className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
            >
              <option value="">全部企业行业</option>
              {INDUSTRY_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchJobs(1, false)}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              <RefreshCw className="h-4 w-4" />
              立即筛选
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              重置
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>筛选结果</span>
          <span>{loading ? '加载中...' : `${total} 个岗位`}</span>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-dashed border-rose-100 bg-rose-50/40 px-4 py-8 text-center text-sm text-slate-500">
              正在加载岗位结果...
            </div>
          ) : null}

          {!loading && error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          {!loading && !error && jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              当前没有符合条件的岗位。
            </div>
          ) : null}

          {!loading && !error && jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedJobId(job.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                selectedJobId === job.id
                  ? 'border-rose-300 bg-rose-50/70 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900">{job.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{job.company}</div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCompletenessTone(job.completenessScore)}`}>
                  {job.completenessScore}分
                </span>
              </div>

              <div className="mt-3 text-xs leading-5 text-slate-500">
                {job.location}｜{job.category}｜{formatExperienceLabel(job.experienceLevel)}
              </div>

              <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                企业信息：{job.companyInfoCompact}
              </div>
            </button>
          ))}
        </div>

        {!loading && !error && hasMore ? (
          <button
            type="button"
            onClick={() => fetchJobs(page + 1, true)}
            disabled={loadingMore}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? '加载中...' : '加载更多岗位'}
          </button>
        ) : null}
      </aside>

      <section className="space-y-5">
        {!selectedJob ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-500">
              <Search className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-slate-900">选择一个岗位查看发布信息</h3>
            <p className="mt-2 text-sm text-slate-500">
              在左侧筛选出目标岗位后，点击岗位卡片即可切换右侧内容。
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-rose-100 bg-gradient-to-r from-[#fff5f0] via-[#fff9f4] to-[#fffaf6] p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-rose-400">Publishing Pack</div>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{selectedJob.title}</h3>
                  <div className="mt-2 text-base font-medium text-slate-700">{selectedJob.company}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{selectedJob.location}</span>
                    <span>{selectedJob.category}</span>
                    <span>{formatJobTypeLabel(selectedJob.jobType)}</span>
                    <span>{formatExperienceLabel(selectedJob.experienceLevel)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(`publish-pack-${selectedJob.id}`, buildPublishPack(selectedJob, posterDraft?.summary || buildLocalPosterSummary(selectedJob)))}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
                >
                  {copiedKey === `publish-pack-${selectedJob.id}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedKey === `publish-pack-${selectedJob.id}` ? '已复制发布包' : '一键复制发布包'}
                </button>
              </div>
            </div>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.95fr),minmax(360px,0.82fr)]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-900">申请信息</h4>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCompletenessTone(selectedJob.completenessScore)}`}>
                      信息完整度 {selectedJob.completenessScore}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {[
                      { key: 'share', label: '岗位申请链接', value: selectedJob.shareUrl },
                      { key: 'company', label: '企业认证信息', value: selectedJob.companyInfoCompact },
                      { key: 'industry', label: '企业所属行业', value: selectedJob.industry || '待补充' },
                      { key: 'referral', label: '岗位内推信息', value: selectedJob.referralInfoCompact }
                    ].map((item) => (
                      <div key={item.key} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{item.label}</div>
                            <div className="mt-2 break-all text-sm leading-6 text-slate-800">{item.value}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(`${item.key}-${selectedJob.id}`, item.value)}
                            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                          >
                            {copiedKey === `${item.key}-${selectedJob.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedKey === `${item.key}-${selectedJob.id}` ? '已复制' : '复制'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedJob.missingFields.length > 0 ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        当前岗位仍有待补充字段：{selectedJob.missingFields.join('、')}。
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900">岗位详情摘要</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    海报摘要优先使用本地压缩，仅在内容过长时调用百炼做低成本重写。
                  </p>

                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-sm leading-7 text-slate-700">
                    {posterDraft?.summary || buildLocalPosterSummary(selectedJob)}
                  </div>

                  {posterDraft ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                        模板 {posterDraft.templateVersion}
                      </span>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">
                        {posterDraft.provider === 'bailian' ? '百炼摘要' : '本地摘要'}
                      </span>
                      {posterDraft.cacheHit ? (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">命中缓存</span>
                      ) : null}
                      {posterDraft.usedFallback ? (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">使用本地兜底</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">小红书 3:4 配图</h4>
                      <p className="mt-1 text-sm text-slate-500">
                        手动点击生成海报后，可直接导出 PNG 用于社媒发布。
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleGeneratePoster}
                        disabled={generatingPoster}
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {generatingPoster ? '生成中...' : '生成配图'}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadPoster}
                        disabled={!posterDraft || downloadingPoster}
                        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {downloadingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloadingPoster ? '导出中...' : '下载 PNG'}
                      </button>
                    </div>
                  </div>

                  {posterError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {posterError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex justify-center">
                    <div
                      ref={posterRef}
                      className="relative aspect-[3/4] w-full max-w-[420px] overflow-hidden rounded-[32px] border border-[#f0d9c7] bg-[#f8f1e7] p-7 shadow-[0_18px_60px_rgba(100,63,35,0.14)]"
                    >
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_transparent_38%),linear-gradient(135deg,rgba(255,244,235,0.96),rgba(248,241,231,1)_55%,rgba(245,225,208,0.92))]" />
                      <div className="absolute -right-10 top-10 h-40 w-40 rounded-full bg-[#f2c9ba]/40 blur-3xl" />
                      <div className="absolute -left-8 bottom-20 h-32 w-32 rounded-full bg-white/50 blur-3xl" />

                      <div className="relative flex h-full flex-col">
                        <div className="flex items-center justify-between">
                          <span className="rounded-full border border-[#f1d8c7] bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b45f45]">
                            Haigoo Remote
                          </span>
                          <span className="rounded-full bg-[#c94f32] px-3 py-1 text-[11px] font-semibold text-white">
                            小红书岗位卡
                          </span>
                        </div>

                        <div className="mt-7">
                          <div className="text-[13px] font-semibold uppercase tracking-[0.28em] text-[#b97358]">
                            {selectedJob.company}
                          </div>
                          <h5 className="mt-3 line-clamp-2 text-[28px] font-black leading-[1.14] text-[#2e2622]">
                            {selectedJob.title}
                          </h5>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-2.5">
                          {[
                            selectedJob.location,
                            selectedJob.category,
                            formatJobTypeLabel(selectedJob.jobType),
                            formatExperienceLabel(selectedJob.experienceLevel)
                          ].map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-[#eed7c6] bg-white/80 px-3 py-1.5 text-xs font-semibold text-[#805847]"
                            >
                              {item}
                            </span>
                          ))}
                        </div>

                        <div className="mt-7 rounded-[28px] border border-white/70 bg-white/75 p-5 shadow-[0_14px_40px_rgba(113,72,43,0.08)] backdrop-blur-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#b97358]">岗位详情摘要</div>
                          <p className="mt-3 line-clamp-4 text-[15px] leading-7 text-[#493c34]">
                            {posterDraft?.summary || '点击“生成配图”后生成适合社媒发布的岗位摘要。'}
                          </p>
                        </div>

                        <div className="mt-auto rounded-[24px] border border-[#f1d8c7] bg-[#fffaf6]/90 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b97358]">申请链接</div>
                          <div className="mt-2 line-clamp-2 break-all text-[12px] leading-5 text-[#5a4a41]">
                            {selectedJob.shareUrl}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!posterDraft ? (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      <ImageIcon className="h-4 w-4" />
                      选择岗位后点击“生成配图”，再导出发布图。
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default AdminXiaohongshuPush;
