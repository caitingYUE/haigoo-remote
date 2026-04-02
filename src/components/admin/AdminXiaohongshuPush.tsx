import React, { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  AlertCircle,
  Check,
  Copy,
  Download,
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

const TEMPLATE_VERSION = 'xhs-v2';
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1440;
const PREVIEW_SCALE = 1 / 3;

const POSTER_THEMES = [
  {
    id: 'lavender',
    name: '浅紫',
    cardBorder: '#dccff7',
    pageBg: 'linear-gradient(145deg, #f9f5ff 0%, #f2ebff 55%, #ece7ff 100%)',
    haloOne: 'rgba(177, 155, 255, 0.26)',
    haloTwo: 'rgba(255, 255, 255, 0.8)',
    chipBorder: '#d8cbf4',
    chipText: '#725ea8',
    titleText: '#2f2547',
    companyText: '#7c67b3',
    labelText: '#8f79c6',
    sectionBg: 'rgba(255,255,255,0.76)',
    sectionBorder: 'rgba(220, 207, 247, 0.95)',
    metaBg: 'rgba(255,255,255,0.82)'
  },
  {
    id: 'sky',
    name: '浅蓝',
    cardBorder: '#cce3fb',
    pageBg: 'linear-gradient(145deg, #f3faff 0%, #ebf6ff 56%, #e3f0ff 100%)',
    haloOne: 'rgba(147, 203, 255, 0.28)',
    haloTwo: 'rgba(255, 255, 255, 0.84)',
    chipBorder: '#c6e0fb',
    chipText: '#4f77a2',
    titleText: '#22364a',
    companyText: '#5d86b3',
    labelText: '#6b95c3',
    sectionBg: 'rgba(255,255,255,0.78)',
    sectionBorder: 'rgba(204, 227, 251, 0.98)',
    metaBg: 'rgba(255,255,255,0.85)'
  },
  {
    id: 'butter',
    name: '浅黄',
    cardBorder: '#f0dfb5',
    pageBg: 'linear-gradient(145deg, #fffaf0 0%, #fff6de 54%, #fff1ce 100%)',
    haloOne: 'rgba(255, 221, 133, 0.28)',
    haloTwo: 'rgba(255, 255, 255, 0.82)',
    chipBorder: '#eeddb0',
    chipText: '#8b7142',
    titleText: '#3f3119',
    companyText: '#a4864b',
    labelText: '#b59556',
    sectionBg: 'rgba(255,255,255,0.78)',
    sectionBorder: 'rgba(240, 223, 181, 0.98)',
    metaBg: 'rgba(255,255,255,0.84)'
  },
  {
    id: 'blush',
    name: '浅粉',
    cardBorder: '#f4d0da',
    pageBg: 'linear-gradient(145deg, #fff5f8 0%, #fff0f5 58%, #ffe8ef 100%)',
    haloOne: 'rgba(255, 185, 205, 0.26)',
    haloTwo: 'rgba(255, 255, 255, 0.84)',
    chipBorder: '#f1cdd7',
    chipText: '#9d6072',
    titleText: '#412632',
    companyText: '#bb748a',
    labelText: '#ca8298',
    sectionBg: 'rgba(255,255,255,0.78)',
    sectionBorder: 'rgba(244, 208, 218, 0.98)',
    metaBg: 'rgba(255,255,255,0.85)'
  }
] as const;

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
  companyDescription: string;
  hiringEmail: string;
  emailType: string;
  referralContacts: ReferralContact[];
  companyInfoCompact: string;
  referralInfoCompact: string;
  referralInfoBlock: string;
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
  jobSummary: string;
  companySummary: string;
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

function buildLocalPosterSummary(job: XhsPushJobListItem, maxLength = 140) {
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

  if (!output) output = (deduped[0] || source).slice(0, maxLength);
  return output.slice(0, maxLength).trim();
}

function buildLocalCompanySummary(job: XhsPushJobListItem, maxLength = 58) {
  const source = stripHtml(job.companyDescription);
  if (!source) return '企业简介待补充';

  const sentences = source
    .split(/(?<=[。！？!?.；;])/)
    .map((item) => item.trim())
    .filter(Boolean);

  let output = '';
  for (const sentence of sentences) {
    const next = output ? `${output} ${sentence}` : sentence;
    if (next.length > maxLength) break;
    output = next;
  }

  if (!output) output = source.slice(0, maxLength);
  return output.slice(0, maxLength).trim();
}

function shouldUseAiSummary(localSummary: string, description: string) {
  const cleanDescription = stripHtml(description);
  if (!cleanDescription) return false;
  if (localSummary.length > 146) return true;
  if (cleanDescription.length >= 560) return true;
  if ((cleanDescription.match(/[•·▪●]/g) || []).length >= 6) return true;
  return false;
}

function shouldUseAiCompanySummary(localSummary: string, description: string) {
  const cleanDescription = stripHtml(description);
  if (!cleanDescription) return false;
  if (localSummary.length > 64) return true;
  if (cleanDescription.length >= 220) return true;
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

function formatReferralLine(contact?: ReferralContact) {
  return `${contact?.name || '待补充'}｜${contact?.title || '待补充'}：${contact?.hiringEmail || '待补充'}`;
}

function getReferralLines(job: XhsPushJobListItem) {
  if (job.referralContacts.length > 0) {
    return job.referralContacts.map((contact) => formatReferralLine(contact));
  }

  if (job.hiringEmail) {
    return [formatReferralLine({
      name: '',
      title: '',
      hiringEmail: job.hiringEmail
    })];
  }

  return ['待补充｜待补充：待补充'];
}

function buildPublishPack(job: XhsPushJobListItem) {
  const referralLines = getReferralLines(job);

  return [
    job.title,
    job.company,
    `申请链接：${job.shareUrl}`,
    `${job.location}｜${job.category}｜${formatJobTypeLabel(job.jobType)}｜${formatExperienceLabel(job.experienceLevel)}`,
    `企业信息：${job.employeeCount || '待补充'}｜${job.address || '待补充'}｜${job.foundedYear || '待补充'}｜评分${job.companyRating || '待补充'}`,
    `所属行业：${job.industry || '待补充'}`,
    ...referralLines.map((line) => `内推邮箱：${line}`)
  ].join('\n');
}

function getThemeById(themeId: string) {
  return POSTER_THEMES.find((theme) => theme.id === themeId) || POSTER_THEMES[0];
}

const PosterCard: React.FC<{
  job: XhsPushJobListItem;
  draft: XhsPosterDraft | null;
  themeId: string;
}> = ({ job, draft, themeId }) => {
  const theme = getThemeById(themeId);
  const companySummary = draft?.companySummary || buildLocalCompanySummary(job);
  const jobSummary = draft?.jobSummary || buildLocalPosterSummary(job);

  return (
    <div
      style={{
        width: `${EXPORT_WIDTH}px`,
        height: `${EXPORT_HEIGHT}px`,
        background: theme.pageBg,
        borderColor: theme.cardBorder
      }}
      className="relative overflow-hidden rounded-[72px] border-[3px] p-[64px] shadow-[0_24px_80px_rgba(63,46,35,0.14)]"
    >
      <div
        className="absolute left-[-120px] top-[-80px] h-[420px] w-[420px] rounded-full blur-[90px]"
        style={{ backgroundColor: theme.haloOne }}
      />
      <div
        className="absolute bottom-[-100px] right-[-70px] h-[390px] w-[390px] rounded-full blur-[100px]"
        style={{ backgroundColor: theme.haloTwo }}
      />
      <div
        className="absolute right-[70px] top-[160px] h-[260px] w-[260px] rounded-full opacity-70"
        style={{ backgroundColor: theme.haloOne }}
      />

      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div
              className="text-[30px] font-semibold uppercase tracking-[0.36em]"
              style={{ color: theme.companyText }}
            >
              {job.company}
            </div>
            <h3
              className="mt-5 line-clamp-2 text-[84px] font-black leading-[1.06]"
              style={{ color: theme.titleText }}
            >
              {job.title}
            </h3>
          </div>

          <div
            className="shrink-0 rounded-full border px-8 py-3 text-[26px] font-semibold"
            style={{
              borderColor: theme.chipBorder,
              color: theme.chipText,
              background: theme.metaBg
            }}
          >
            {job.industry || '待补充'}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          {[
            job.location,
            job.category,
            formatJobTypeLabel(job.jobType),
            formatExperienceLabel(job.experienceLevel)
          ].map((item) => (
            <span
              key={item}
              className="rounded-full border px-6 py-3 text-[28px] font-semibold"
              style={{
                borderColor: theme.chipBorder,
                color: theme.chipText,
                background: theme.metaBg
              }}
            >
              {item}
            </span>
          ))}
        </div>

        <div
          className="mt-8 rounded-[42px] border px-10 py-8"
          style={{
            background: theme.sectionBg,
            borderColor: theme.sectionBorder
          }}
        >
          <div
            className="text-[24px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.labelText }}
          >
            企业简介
          </div>
          <p
            className="mt-4 line-clamp-2 text-[34px] font-medium leading-[1.45]"
            style={{ color: theme.titleText }}
          >
            {companySummary}
          </p>
        </div>

        <div
          className="mt-7 rounded-[42px] border px-10 py-8"
          style={{
            background: theme.sectionBg,
            borderColor: theme.sectionBorder
          }}
        >
          <div
            className="text-[24px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: theme.labelText }}
          >
            岗位摘要
          </div>
          <p
            className="mt-4 text-[34px] leading-[1.6]"
            style={{ color: theme.titleText }}
          >
            {jobSummary}
          </p>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-4">
          {[
            { label: '企业信息', value: `${job.employeeCount}｜${job.address}` },
            { label: '成立/评分', value: `${job.foundedYear}｜评分${job.companyRating}` }
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-[34px] border px-7 py-6"
              style={{
                background: theme.metaBg,
                borderColor: theme.chipBorder
              }}
            >
              <div
                className="text-[22px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: theme.labelText }}
              >
                {item.label}
              </div>
              <div
                className="mt-3 text-[28px] font-semibold leading-[1.4]"
                style={{ color: theme.titleText }}
              >
                {item.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

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
  const [selectedThemeId, setSelectedThemeId] = useState<string>(POSTER_THEMES[0].id);
  const exportPosterRef = useRef<HTMLDivElement>(null);
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
      if (append) setLoadingMore(true);
      else setLoading(true);
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
      if (!res.ok || !data.success) throw new Error(data.error || '加载小红书推送岗位失败');

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

      const localJobSummary = buildLocalPosterSummary(selectedJob);
      const localCompanySummary = buildLocalCompanySummary(selectedJob);
      let jobSummary = localJobSummary;
      let companySummary = localCompanySummary;
      let provider: 'local' | 'bailian' = 'local';
      let cacheHit = false;
      let usedFallback = false;

      if (
        shouldUseAiSummary(localJobSummary, selectedJob.description) ||
        shouldUseAiCompanySummary(localCompanySummary, selectedJob.companyDescription)
      ) {
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
            companyDescription: selectedJob.companyDescription,
            updatedAt: selectedJob.updatedAt,
            summary: localJobSummary
          })
        });

        const data = await res.json() as {
          success: boolean;
          jobSummary?: string;
          companySummary?: string;
          provider?: 'local' | 'bailian';
          cacheHit?: boolean;
          usedFallback?: boolean;
          error?: string;
        };

        if (!res.ok || !data.success) throw new Error(data.error || '生成岗位摘要失败');

        jobSummary = data.jobSummary || localJobSummary;
        companySummary = data.companySummary || localCompanySummary;
        provider = data.provider || 'local';
        cacheHit = Boolean(data.cacheHit);
        usedFallback = Boolean(data.usedFallback);
      }

      setPosterDraft({
        jobSummary,
        companySummary,
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
    if (!exportPosterRef.current || !selectedJob || !posterDraft) return;

    try {
      setDownloadingPoster(true);
      await new Promise((resolve) => setTimeout(resolve, 120));

      const canvas = await html2canvas(exportPosterRef.current, {
        useCORS: true,
        scale: 1,
        backgroundColor: null,
        logging: false,
        width: EXPORT_WIDTH,
        height: EXPORT_HEIGHT,
        windowWidth: EXPORT_WIDTH,
        windowHeight: EXPORT_HEIGHT,
        scrollX: 0,
        scrollY: 0
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

  const referralLines = selectedJob ? getReferralLines(selectedJob) : [];

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
                  onClick={() => handleCopy(`publish-pack-${selectedJob.id}`, buildPublishPack(selectedJob))}
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
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">岗位申请链接</div>
                          <div className="mt-2 break-all text-sm leading-6 text-slate-800">{selectedJob.shareUrl}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`share-${selectedJob.id}`, selectedJob.shareUrl)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                        >
                          {copiedKey === `share-${selectedJob.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey === `share-${selectedJob.id}` ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">企业认证信息</div>
                          <div className="mt-2 text-sm leading-6 text-slate-800">
                            {`${selectedJob.employeeCount}｜${selectedJob.address}｜${selectedJob.foundedYear}｜评分${selectedJob.companyRating}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`company-${selectedJob.id}`, `${selectedJob.employeeCount}｜${selectedJob.address}｜${selectedJob.foundedYear}｜评分${selectedJob.companyRating}`)}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                        >
                          {copiedKey === `company-${selectedJob.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey === `company-${selectedJob.id}` ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">企业所属行业</div>
                          <div className="mt-2 text-sm leading-6 text-slate-800">{selectedJob.industry || '待补充'}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`industry-${selectedJob.id}`, selectedJob.industry || '待补充')}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                        >
                          {copiedKey === `industry-${selectedJob.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey === `industry-${selectedJob.id}` ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">岗位内推信息</div>
                          <div className="mt-2 space-y-2">
                            {referralLines.map((line, index) => (
                              <div key={`${selectedJob.id}-ref-${index}`} className="rounded-xl bg-white/70 px-3 py-2 text-sm leading-6 text-slate-800">
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(`referral-${selectedJob.id}`, referralLines.map((line) => `内推邮箱：${line}`).join('\n'))}
                          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700"
                        >
                          {copiedKey === `referral-${selectedJob.id}` ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                          {copiedKey === `referral-${selectedJob.id}` ? '已复制' : '复制'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedJob.missingFields.length > 0 ? (
                    <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>当前岗位仍有待补充字段：{selectedJob.missingFields.join('、')}。</div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900">摘要内容</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    海报优先使用本地压缩；当岗位描述或企业简介过长时，再调用百炼做低成本提炼。
                  </p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">企业简介摘要</div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">
                        {posterDraft?.companySummary || buildLocalCompanySummary(selectedJob)}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">岗位摘要</div>
                      <div className="mt-2 text-sm leading-7 text-slate-700">
                        {posterDraft?.jobSummary || buildLocalPosterSummary(selectedJob)}
                      </div>
                    </div>
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
                        提供四个浅色主题模板；导出时使用固定尺寸海报稿，避免预览与下载效果不一致。
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

                  <div className="mt-4 flex flex-wrap gap-2">
                    {POSTER_THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        onClick={() => setSelectedThemeId(theme.id)}
                        className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                          selectedThemeId === theme.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>

                  {posterError ? (
                    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {posterError}
                    </div>
                  ) : null}

                  <div className="mt-5 flex justify-center">
                    <div
                      className="relative h-[480px] w-full max-w-[360px] overflow-hidden rounded-[24px]"
                      style={{ boxShadow: '0 18px 60px rgba(71, 52, 41, 0.12)' }}
                    >
                      <div
                        style={{
                          width: `${EXPORT_WIDTH}px`,
                          height: `${EXPORT_HEIGHT}px`,
                          transform: `scale(${PREVIEW_SCALE})`,
                          transformOrigin: 'top left'
                        }}
                      >
                        <PosterCard job={selectedJob} draft={posterDraft} themeId={selectedThemeId} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="pointer-events-none fixed left-[-99999px] top-0 opacity-0"
              aria-hidden="true"
            >
              <div ref={exportPosterRef}>
                <PosterCard job={selectedJob} draft={posterDraft} themeId={selectedThemeId} />
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default AdminXiaohongshuPush;
