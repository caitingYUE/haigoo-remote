import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { buildJobDetailSections, type JobDetailBlock } from '../../utils/job-detail-content';

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

const TEMPLATE_VERSION = 'xhs-v5';
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1440;
const PREVIEW_SCALE = 0.34;
const POSTER_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
const POSTER_THEME = {
  id: 'editorial-grey',
  name: '编辑灰',
  title: '#111111',
  company: '#555555',
  label: '#6d6d6d',
  divider: '#8a8a8a',
  subtle: '#c8c8c8'
} as const;

interface ReferralContact {
  name?: string;
  title?: string;
  hiringEmail?: string;
  emailType?: string;
}

interface XhsDraftRecord {
  companySummary: string;
  jobSummary: string;
  companySummarySource?: string;
  jobSummarySource?: string;
  themeId?: string;
  templateVersion?: string;
  updatedAt?: string | null;
  updatedBy?: string;
  provider?: 'saved' | 'local' | 'bailian';
  saved?: boolean;
}

interface XhsPushJobListItem {
  id: string;
  title: string;
  company: string;
  logo?: string;
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
  canonicalCompanyDescription?: string;
  companyDescriptionSource?: string;
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
  draft?: XhsDraftRecord | null;
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
  provider: 'local' | 'bailian' | 'saved';
  templateVersion: string;
  generatedAt: string;
  companySummarySource?: string;
  jobSummarySource?: string;
  themeId?: string;
  cacheHit?: boolean;
  usedFallback?: boolean;
  saved?: boolean;
  updatedAt?: string | null;
  updatedBy?: string;
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

function toFormattedReferenceText(value: string) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitSummarySentences(value: string) {
  return stripHtml(value)
    .split(/[\n\r]+|(?<=[。！？!?.；;])/)
    .map((item) => item.replace(/^[\s•·▪●\-–—\d.()]+/, '').trim())
    .filter(Boolean);
}

function dedupeSentences(sentences: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const sentence of sentences) {
    const key = sentence.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(sentence);
  }
  return deduped;
}

function clampSentence(sentence: string, maxLength: number) {
  const clean = sentence.replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).replace(/[，,；;、:：\s]+$/u, '')}…`;
}

function buildLocalPosterSummary(job: XhsPushJobListItem, maxLength = 186, minLength = 146) {
  const source = stripHtml(job.description);
  if (!source) return '岗位亮点待补充，可结合 JD 核对后再生成配图。';

  const sentences = dedupeSentences(splitSummarySentences(source));
  if (sentences.length === 0) return source.slice(0, maxLength);

  const bullets: string[] = [];
  for (const sentence of sentences) {
    const candidate = `${bullets.length + 1}. ${clampSentence(sentence, 42)}`;
    const next = [...bullets, candidate].join('\n');
    if (next.length > maxLength && bullets.join('\n').length >= minLength) break;
    if (next.length > maxLength) {
      bullets.push(`${bullets.length + 1}. ${clampSentence(sentence, 30)}`);
      break;
    }
    bullets.push(candidate);
    if (bullets.length >= 4 && bullets.join('\n').length >= minLength) break;
  }

  if (bullets.length === 0) return source.slice(0, maxLength);
  return bullets.join('\n').slice(0, maxLength).trim();
}

function buildLocalCompanySummary(job: XhsPushJobListItem, maxLength = 78, minLength = 52) {
  const source = stripHtml(job.companyDescription);
  if (!source) return '企业简介待补充';

  const sentences = dedupeSentences(splitSummarySentences(source));
  if (sentences.length === 0) return source.slice(0, maxLength);

  let output = '';
  for (const sentence of sentences) {
    const next = output ? `${output} ${sentence}` : sentence;
    if (next.length > maxLength && output.length >= minLength) break;
    if (next.length > maxLength) {
      output = next.slice(0, maxLength);
      break;
    }
    output = next;
  }

  if (!output) output = source.slice(0, maxLength);
  return output.slice(0, maxLength).trim();
}

function getCompanyReferenceText(job: XhsPushJobListItem) {
  return toFormattedReferenceText(job.canonicalCompanyDescription || job.companyDescription || '') || '暂无企业简介原文';
}

function getJobReferenceText(job: XhsPushJobListItem) {
  return toFormattedReferenceText(job.description || '') || '暂无岗位原文';
}

function buildCompanyReferenceBlocks(text: string): JobDetailBlock[] {
  const normalized = String(text || '').trim();
  if (!normalized) return [{ type: 'paragraph', text: '暂无企业简介原文' }];

  const parts = normalized.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
  const blocks: JobDetailBlock[] = [];

  for (const part of parts) {
    const lines = part.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    const bulletItems = lines
      .filter((line) => /^[•\-*]\s*/.test(line) || /^\d+[.)、]\s*/.test(line))
      .map((line) => line.replace(/^[•\-*]\s*|^\d+[.)、]\s*/u, '').trim())
      .filter(Boolean);

    if (bulletItems.length >= 2 && bulletItems.length === lines.length) {
      blocks.push({ type: 'list', items: bulletItems, ordered: /^\d/.test(lines[0]) });
      continue;
    }

    if (lines.length === 1 && lines[0].length <= 18 && !/[。！？.!?]/.test(lines[0])) {
      blocks.push({ type: 'subheading', text: lines[0] });
      continue;
    }

    blocks.push({ type: 'paragraph', text: lines.join(' ') });
  }

  return blocks.length ? blocks : [{ type: 'paragraph', text: normalized }];
}

function formatJobTypeLabel(value: string) {
  const matched = JOB_TYPE_OPTIONS.find((item) => item.value === value);
  return matched?.label || value || '待补充';
}

function normalizeEmailTypeLabel(value?: string) {
  const map: Record<string, string> = {
    '招聘专用邮箱': '招聘邮箱',
    '通用支持邮箱': '通用邮箱',
    '内部员工邮箱': '员工邮箱',
    '企业领导邮箱': '高管邮箱',
    '招聘邮箱': '招聘邮箱',
    '通用邮箱': '通用邮箱',
    '员工邮箱': '员工邮箱',
    '高管邮箱': '高管邮箱',
    'HR邮箱': 'HR邮箱'
  };
  return map[String(value || '').trim()] || String(value || '').trim() || '通用邮箱';
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

function formatReferralLine(contact?: ReferralContact, includeType = false) {
  const payload = `${contact?.name || '待补充'}｜${contact?.title || '待补充'}：${contact?.hiringEmail || '待补充'}`;
  if (!includeType) return payload;
  return `${normalizeEmailTypeLabel(contact?.emailType)}：${payload}`;
}

function getReferralLines(job: XhsPushJobListItem, includeType = false) {
  if (job.referralContacts.length > 0) {
    return job.referralContacts.map((contact) => formatReferralLine(contact, includeType));
  }

  if (job.hiringEmail) {
    return [formatReferralLine({
      name: '',
      title: '',
      hiringEmail: job.hiringEmail,
      emailType: job.emailType
    }, includeType)];
  }

  return [includeType ? '通用邮箱：待补充｜待补充：待补充' : '待补充｜待补充：待补充'];
}

function buildPublishPack(job: XhsPushJobListItem) {
  return [
    job.title,
    job.company,
    `申请链接：${job.shareUrl}`,
    `岗位信息：${job.location}｜${job.category}｜${formatJobTypeLabel(job.jobType)}｜${formatExperienceLabel(job.experienceLevel)}`,
    `企业信息：${job.employeeCount || '待补充'}｜总部位于${job.address || '待补充'}｜成立于${job.foundedYear || '待补充'}｜评分${job.companyRating || '待补充'}`,
    `所属行业：${job.industry || '待补充'}`,
    ...getReferralLines(job, true)
  ].join('\n');
}

function getRangeHint(length: number, min: number, max: number) {
  if (length < min) return '内容偏短';
  if (length > max) return '内容偏长';
  return '长度合适';
}

function wrapTextByWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const paragraphs = String(text || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return { lines: [] as string[], truncated: false };
  }

  const lines: string[] = [];
  let truncated = false;
  let consumedChars = 0;
  const totalChars = paragraphs.join('').length;

  outer: for (let pIndex = 0; pIndex < paragraphs.length; pIndex += 1) {
    const paragraph = paragraphs[pIndex];
    let current = '';

    for (const char of paragraph) {
      const next = current + char;
      if (ctx.measureText(next).width <= maxWidth || current.length === 0) {
        current = next;
      } else {
        lines.push(current);
        consumedChars += current.length;
        if (lines.length >= maxLines) {
          truncated = true;
          break outer;
        }
        current = char;
      }
    }

    if (current) {
      lines.push(current);
      consumedChars += current.length;
      if (lines.length >= maxLines && pIndex < paragraphs.length - 1) {
        truncated = true;
        break;
      }
    }
  }

  if (consumedChars < totalChars) {
    truncated = true;
  }

  if (truncated && lines.length > 0) {
    let lastLine = lines[Math.min(lines.length, maxLines) - 1].replace(/…$/u, '');
    while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[Math.min(lines.length, maxLines) - 1] = `${lastLine}…`;
  }

  return {
    lines: lines.slice(0, maxLines),
    truncated
  };
}

function fitTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  options: {
    maxWidth: number;
    maxLines: number;
    startSize: number;
    minSize: number;
    weight?: number;
    lineHeightRatio?: number;
    maxHeight?: number;
  }
) {
  const {
    maxWidth,
    maxLines,
    startSize,
    minSize,
    weight = 500,
    lineHeightRatio = 1.4,
    maxHeight
  } = options;

  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 2) {
    ctx.font = `${weight} ${fontSize}px ${POSTER_FONT_FAMILY}`;
    const wrapped = wrapTextByWidth(ctx, text, maxWidth, maxLines);
    const lineHeight = Math.round(fontSize * lineHeightRatio);
    const fitsHeight = !maxHeight || (wrapped.lines.length * lineHeight) <= maxHeight;
    if ((!wrapped.truncated && fitsHeight) || fontSize === minSize) {
      return {
        font: `${weight} ${fontSize}px ${POSTER_FONT_FAMILY}`,
        fontSize,
        lineHeight,
        lines: wrapped.lines
      };
    }
  }

  return {
    font: `${weight} ${minSize}px ${POSTER_FONT_FAMILY}`,
    fontSize: minSize,
    lineHeight: Math.round(minSize * lineHeightRatio),
    lines: wrapTextByWidth(ctx, text, maxWidth, maxLines).lines
  };
}

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineHeight: number,
  color: string,
  font: string
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font;
  for (let index = 0; index < lines.length; index += 1) {
    ctx.fillText(lines[index], x, y + (index * lineHeight));
  }
  ctx.restore();
}

function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function renderPosterCanvas(job: XhsPushJobListItem, draft: XhsPosterDraft | null, themeId: string) {
  void themeId;
  const theme = POSTER_THEME;
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  ctx.save();
  ctx.fillStyle = '#ebebeb';
  ctx.fillRect(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  ctx.restore();

  const paddingX = 82;
  const contentWidth = EXPORT_WIDTH - (paddingX * 2);
  const title = job.title;
  const company = job.company;
  const companySummary = draft?.companySummary || buildLocalCompanySummary(job);
  const jobSummary = draft?.jobSummary || buildLocalPosterSummary(job);
  const metaItems = [
    job.location,
    job.category,
    formatJobTypeLabel(job.jobType),
    formatExperienceLabel(job.experienceLevel)
  ];

  ctx.textBaseline = 'top';
  const headerX = paddingX;
  const industryText = job.industry || '待补充';
  drawTextLines(ctx, [company], headerX, 72, 40, theme.title, `700 34px ${POSTER_FONT_FAMILY}`);
  ctx.save();
  ctx.font = `400 24px ${POSTER_FONT_FAMILY}`;
  const industryWidth = Math.min(260, ctx.measureText(industryText).width);
  ctx.fillStyle = theme.label;
  ctx.fillRect(EXPORT_WIDTH - paddingX - industryWidth - 26, 88, 2, 34);
  ctx.restore();
  drawTextLines(ctx, [industryText], EXPORT_WIDTH - paddingX - industryWidth, 76, 34, theme.company, `400 24px ${POSTER_FONT_FAMILY}`);

  const companyIntroLabelY = 168;
  const companyIntroBlock = fitTextBlock(ctx, companySummary, {
    maxWidth: contentWidth,
    maxLines: 2,
    startSize: 26,
    minSize: 22,
    weight: 400,
    lineHeightRatio: 1.48,
    maxHeight: 96
  });
  drawTextLines(ctx, companyIntroBlock.lines, headerX, companyIntroLabelY, companyIntroBlock.lineHeight, '#4f4f4f', companyIntroBlock.font);
  const introBottom = companyIntroLabelY + (companyIntroBlock.lines.length * companyIntroBlock.lineHeight);

  const titleBlock = fitTextBlock(ctx, title, {
    maxWidth: contentWidth,
    maxLines: 2,
    startSize: 80,
    minSize: 54,
    weight: 800,
    lineHeightRatio: 1.02
  });
  const titleY = introBottom + 46;
  drawTextLines(ctx, titleBlock.lines, headerX, titleY, titleBlock.lineHeight, theme.title, titleBlock.font);
  const titleBottom = titleY + (titleBlock.lines.length * titleBlock.lineHeight);

  const metaText = metaItems.filter(Boolean).join(' ｜ ');
  const metaBlock = fitTextBlock(ctx, metaText, {
    maxWidth: contentWidth,
    maxLines: 2,
    startSize: 26,
    minSize: 22,
    weight: 400,
    lineHeightRatio: 1.5
  });
  const metaY = titleBottom + 36;
  drawTextLines(ctx, metaBlock.lines, headerX, metaY, metaBlock.lineHeight, theme.company, metaBlock.font);
  const metaBottom = metaY + (metaBlock.lines.length * metaBlock.lineHeight);

  const summaryTextY = metaBottom + 74;
  const summaryAvailableHeight = EXPORT_HEIGHT - summaryTextY - 120;
  const summaryTextBlock = fitTextBlock(ctx, jobSummary, {
    maxWidth: contentWidth,
    maxLines: 12,
    startSize: 32,
    minSize: 24,
    weight: 400,
    lineHeightRatio: 1.62,
    maxHeight: summaryAvailableHeight
  });
  drawTextLines(ctx, summaryTextBlock.lines, headerX, summaryTextY, summaryTextBlock.lineHeight, '#4a4a4a', summaryTextBlock.font);

  const footerY = EXPORT_HEIGHT - 106;
  ctx.save();
  ctx.fillStyle = theme.subtle;
  ctx.fillRect(headerX, footerY, contentWidth, 2);
  ctx.restore();

  return canvas;
}

function renderInlineFormatting(text: string) {
  const boldRegex = /\*\*(.*?)\*\*/g;
  const parts = String(text || '').split(boldRegex);
  return parts.map((part, index) => (
    index % 2 === 1
      ? <strong key={index} className="font-semibold text-slate-900">{part}</strong>
      : <React.Fragment key={index}>{part}</React.Fragment>
  ));
}

const ReferenceBlocks: React.FC<{ blocks: JobDetailBlock[] }> = ({ blocks }) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return <p className="text-xs leading-6 text-slate-500">暂无原文内容。</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          const ListTag = block.ordered ? 'ol' : 'ul';
          return (
            <ListTag
              key={`ref-list-${index}`}
              className={`space-y-1.5 pl-5 text-xs leading-6 text-slate-600 ${block.ordered ? 'list-decimal' : 'list-disc'}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`ref-item-${index}-${itemIndex}`} className="pl-1 marker:text-slate-400">
                  {renderInlineFormatting(item)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'subheading') {
          return (
            <h5 key={`ref-heading-${index}`} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              {renderInlineFormatting(block.text)}
            </h5>
          );
        }

        if (block.type === 'note') {
          return (
            <div key={`ref-note-${index}`} className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs leading-6 text-amber-900">
              {renderInlineFormatting(block.text)}
            </div>
          );
        }

        return (
          <p key={`ref-paragraph-${index}`} className="text-xs leading-6 text-slate-600">
            {renderInlineFormatting(block.text)}
          </p>
        );
      })}
    </div>
  );
};

const PosterPreview: React.FC<{
  job: XhsPushJobListItem;
  draft: XhsPosterDraft | null;
  themeId: string;
}> = ({ job, draft, themeId }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await renderPosterCanvas(job, draft, themeId);
        if (!cancelled) setPreviewUrl(canvas.toDataURL('image/png'));
      } catch (_error) {
        if (!cancelled) setPreviewUrl('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, job, themeId]);

  return (
    <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={`${job.title} 海报预览`}
          width={EXPORT_WIDTH * PREVIEW_SCALE}
          height={EXPORT_HEIGHT * PREVIEW_SCALE}
          className="block h-auto w-full max-w-[367px]"
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-[32px] border border-slate-200 bg-slate-50 text-sm text-slate-500"
          style={{ width: EXPORT_WIDTH * PREVIEW_SCALE, height: EXPORT_HEIGHT * PREVIEW_SCALE }}
        >
          正在生成预览...
        </div>
      )}
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
  const [companySummaryText, setCompanySummaryText] = useState('');
  const [jobSummaryText, setJobSummaryText] = useState('');
  const [companySummarySource, setCompanySummarySource] = useState('canonical');
  const [jobSummarySource, setJobSummarySource] = useState('local');
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftDirty, setDraftDirty] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const selectedThemeId = POSTER_THEME.id;
  const jobsRef = useRef<XhsPushJobListItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchKeyword(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const selectedJob = useMemo(
    () => jobs.find((item) => item.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const companyReferenceBlocks = useMemo(
    () => selectedJob ? buildCompanyReferenceBlocks(getCompanyReferenceText(selectedJob)) : [],
    [selectedJob]
  );

  const jobReferenceSections = useMemo(
    () => selectedJob ? buildJobDetailSections({ description: getJobReferenceText(selectedJob) }) : [],
    [selectedJob]
  );

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
    if (!selectedJob) {
      setPosterDraft(null);
      setCompanySummaryText('');
      setJobSummaryText('');
      setCompanySummarySource('canonical');
      setJobSummarySource('local');
      setDraftDirty(false);
      setDraftNotice(null);
      return;
    }

    const savedDraft = selectedJob.draft || null;
    const nextCompanySummary = savedDraft?.companySummary || buildLocalCompanySummary(selectedJob);
    const nextJobSummary = savedDraft?.jobSummary || buildLocalPosterSummary(selectedJob);
    setCompanySummaryText(nextCompanySummary);
    setJobSummaryText(nextJobSummary);
    setCompanySummarySource(savedDraft?.companySummarySource || 'canonical');
    setJobSummarySource(savedDraft?.jobSummarySource || 'local');
    setPosterDraft(savedDraft ? {
      jobSummary: nextJobSummary,
      companySummary: nextCompanySummary,
      provider: savedDraft.provider || 'saved',
      templateVersion: savedDraft.templateVersion || TEMPLATE_VERSION,
      generatedAt: savedDraft.updatedAt || new Date().toISOString(),
      companySummarySource: savedDraft.companySummarySource,
      jobSummarySource: savedDraft.jobSummarySource,
      themeId: savedDraft.themeId,
      saved: true,
      updatedAt: savedDraft.updatedAt || null,
      updatedBy: savedDraft.updatedBy
    } : {
      jobSummary: nextJobSummary,
      companySummary: nextCompanySummary,
      provider: 'local',
      templateVersion: TEMPLATE_VERSION,
      generatedAt: new Date().toISOString(),
      companySummarySource: 'canonical',
      jobSummarySource: 'local',
      saved: false
    });
    setDraftDirty(false);
    setDraftNotice(null);
    setPosterError(null);
  }, [selectedJob]);

  useEffect(() => {
    setPosterDraft((current) => {
      if (!selectedJob) return current;
      return {
        jobSummary: jobSummaryText || buildLocalPosterSummary(selectedJob),
        companySummary: companySummaryText || buildLocalCompanySummary(selectedJob),
        provider: current?.provider || 'local',
        templateVersion: current?.templateVersion || TEMPLATE_VERSION,
        generatedAt: current?.generatedAt || new Date().toISOString(),
        companySummarySource,
        jobSummarySource,
        themeId: selectedThemeId,
        cacheHit: current?.cacheHit,
        usedFallback: current?.usedFallback,
        saved: current?.saved,
        updatedAt: current?.updatedAt || null,
        updatedBy: current?.updatedBy
      };
    });
  }, [companySummarySource, companySummaryText, jobSummarySource, jobSummaryText, selectedJob, selectedThemeId]);

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

  const handleCompanySummaryChange = (value: string) => {
    setCompanySummaryText(value);
    setCompanySummarySource('manual');
    setDraftDirty(true);
    setDraftNotice(null);
  };

  const handleJobSummaryChange = (value: string) => {
    setJobSummaryText(value);
    setJobSummarySource('manual');
    setDraftDirty(true);
    setDraftNotice(null);
  };

  const handleRestoreCompanySummary = () => {
    if (!selectedJob) return;
    setCompanySummaryText(buildLocalCompanySummary(selectedJob));
    setCompanySummarySource('canonical');
    setDraftDirty(true);
    setDraftNotice(null);
  };

  const handleRestoreJobSummary = () => {
    if (!selectedJob) return;
    setJobSummaryText(buildLocalPosterSummary(selectedJob));
    setJobSummarySource('local');
    setDraftDirty(true);
    setDraftNotice(null);
  };

  const handleGeneratePoster = async () => {
    if (!selectedJob) return;

    try {
      setGeneratingPoster(true);
      setPosterError(null);

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
          companyDescription: selectedJob.canonicalCompanyDescription || selectedJob.companyDescription,
          updatedAt: selectedJob.updatedAt,
          summary: buildLocalPosterSummary(selectedJob)
        })
      });

      const data = await res.json() as {
        success: boolean;
        jobSummary?: string;
        companySummary?: string;
        provider?: 'local' | 'bailian';
        jobSummarySource?: string;
        companySummarySource?: string;
        cacheHit?: boolean;
        usedFallback?: boolean;
        error?: string;
      };

      if (!res.ok || !data.success) throw new Error(data.error || '生成岗位摘要失败');

      const nextJobSummary = data.jobSummary || buildLocalPosterSummary(selectedJob);
      const nextCompanySummary = data.companySummary || buildLocalCompanySummary(selectedJob);
      setJobSummaryText(nextJobSummary);
      setCompanySummaryText(nextCompanySummary);
      setJobSummarySource(data.jobSummarySource || (data.provider === 'bailian' ? 'ai' : 'local'));
      setCompanySummarySource(data.companySummarySource || (data.provider === 'bailian' ? 'ai' : 'canonical'));
      setPosterDraft({
        jobSummary: nextJobSummary,
        companySummary: nextCompanySummary,
        provider: data.provider || 'local',
        templateVersion: TEMPLATE_VERSION,
        generatedAt: new Date().toISOString(),
        companySummarySource: data.companySummarySource || (data.provider === 'bailian' ? 'ai' : 'canonical'),
        jobSummarySource: data.jobSummarySource || (data.provider === 'bailian' ? 'ai' : 'local'),
        cacheHit: Boolean(data.cacheHit),
        usedFallback: Boolean(data.usedFallback),
        themeId: selectedThemeId,
        saved: false
      });
      setDraftDirty(true);
      setDraftNotice('已完成智能提炼，可继续修改后保存。');
    } catch (err) {
      setPosterError(err instanceof Error ? err.message : '生成海报失败');
    } finally {
      setGeneratingPoster(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedJob) return;

    try {
      setSavingDraft(true);
      setPosterError(null);
      setDraftNotice(null);

      const res = await fetch('/api/admin/content-push/xiaohongshu/draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          jobId: selectedJob.id,
          companySummary: companySummaryText,
          jobSummary: jobSummaryText,
          companySummarySource,
          jobSummarySource,
          templateVersion: TEMPLATE_VERSION,
          themeId: selectedThemeId
        })
      });

      const data = await res.json() as { success: boolean; draft?: XhsDraftRecord; error?: string };
      if (!res.ok || !data.success || !data.draft) {
        throw new Error(data.error || '保存摘要草稿失败');
      }

      setJobs((current) => current.map((item) => (
        item.id === selectedJob.id
          ? { ...item, draft: data.draft, companyDescription: item.canonicalCompanyDescription || item.companyDescription }
          : item
      )));
      setPosterDraft((current) => ({
        jobSummary: jobSummaryText,
        companySummary: companySummaryText,
        provider: 'saved',
        templateVersion: data.draft?.templateVersion || current?.templateVersion || TEMPLATE_VERSION,
        generatedAt: data.draft?.updatedAt || current?.generatedAt || new Date().toISOString(),
        companySummarySource,
        jobSummarySource,
        themeId: data.draft?.themeId || selectedThemeId,
        saved: true,
        updatedAt: data.draft?.updatedAt || null,
        updatedBy: data.draft?.updatedBy,
        cacheHit: current?.cacheHit,
        usedFallback: current?.usedFallback
      }));
      setDraftDirty(false);
      setDraftNotice('摘要草稿已保存，海报将沿用当前内容。');
    } catch (err) {
      setPosterError(err instanceof Error ? err.message : '保存摘要草稿失败');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!selectedJob) return;

    try {
      setDownloadingPoster(true);
      const canvas = await renderPosterCanvas(selectedJob, effectivePosterDraft, selectedThemeId);
      downloadCanvas(canvas, `${selectedJob.company}-${selectedJob.title}-xiaohongshu.png`);
    } catch (err) {
      console.error('Failed to export xiaohongshu poster:', err);
      alert('导出图片失败，请重试');
    } finally {
      setDownloadingPoster(false);
    }
  };

  const referralLines = selectedJob ? getReferralLines(selectedJob, true) : [];
  const effectivePosterDraft = selectedJob ? {
    jobSummary: jobSummaryText || buildLocalPosterSummary(selectedJob),
    companySummary: companySummaryText || buildLocalCompanySummary(selectedJob),
    provider: posterDraft?.provider || 'local',
    templateVersion: posterDraft?.templateVersion || TEMPLATE_VERSION,
    generatedAt: posterDraft?.generatedAt || new Date().toISOString(),
    companySummarySource,
    jobSummarySource,
    themeId: selectedThemeId,
    cacheHit: posterDraft?.cacheHit,
    usedFallback: posterDraft?.usedFallback,
    saved: posterDraft?.saved,
    updatedAt: posterDraft?.updatedAt,
    updatedBy: posterDraft?.updatedBy
  } : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
      <aside className="space-y-4 rounded-3xl border border-rose-100 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">小红书推送</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">筛选岗位后，右侧直接整理发布信息、编辑摘要并导出海报。</p>
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
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
              <option value="">全部岗位角色</option>
              {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>

            <select value={jobType} onChange={(event) => setJobType(event.target.value)} className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
              <option value="">全部岗位类型</option>
              {JOB_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select value={experienceLevel} onChange={(event) => setExperienceLevel(event.target.value)} className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
              <option value="">全部岗位级别</option>
              {EXPERIENCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <select value={industry} onChange={(event) => setIndustry(event.target.value)} className="rounded-2xl border border-rose-100 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-rose-300 focus:ring-2 focus:ring-rose-100">
              <option value="">全部企业行业</option>
              {INDUSTRY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button type="button" onClick={() => fetchJobs(1, false)} className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">
              <RefreshCw className="h-4 w-4" />
              立即筛选
            </button>
            <button type="button" onClick={handleReset} className="inline-flex items-center justify-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
              重置
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>筛选结果</span>
          <span>{loading ? '加载中...' : `${total} 个岗位`}</span>
        </div>

        <div className="space-y-3">
          {loading ? <div className="rounded-2xl border border-dashed border-rose-100 bg-rose-50/40 px-4 py-8 text-center text-sm text-slate-500">正在加载岗位结果...</div> : null}
          {!loading && error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-5 text-sm text-rose-700">{error}</div> : null}
          {!loading && !error && jobs.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">当前没有符合条件的岗位。</div> : null}

          {!loading && !error && jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => setSelectedJobId(job.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                selectedJobId === job.id ? 'border-rose-300 bg-rose-50/70 shadow-sm' : 'border-slate-200 bg-white hover:border-rose-200 hover:bg-rose-50/30'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="line-clamp-2 text-sm font-semibold text-slate-900">{job.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{job.company}</div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCompletenessTone(job.completenessScore)}`}>{job.completenessScore}分</span>
              </div>
              <div className="mt-3 text-xs leading-5 text-slate-500">{job.location}｜{job.category}｜{formatExperienceLabel(job.experienceLevel)}</div>
              <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">企业信息：{job.companyInfoCompact}</div>
            </button>
          ))}
        </div>

        {!loading && !error && hasMore ? (
          <button type="button" onClick={() => fetchJobs(page + 1, true)} disabled={loadingMore} className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60">
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
            <p className="mt-2 text-sm text-slate-500">在左侧筛选出目标岗位后，点击岗位卡片即可切换右侧内容。</p>
          </div>
        ) : (
          <>
            <div className="rounded-3xl border border-rose-100 bg-gradient-to-r from-[#fff5f0] via-[#fff9f4] to-[#fffaf6] p-6 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h3>
                  <div className="mt-2 text-base font-medium text-slate-700">{selectedJob.company}</div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>{selectedJob.location}</span>
                    <span>{selectedJob.category}</span>
                    <span>{formatJobTypeLabel(selectedJob.jobType)}</span>
                    <span>{formatExperienceLabel(selectedJob.experienceLevel)}</span>
                  </div>
                </div>

                <button type="button" onClick={() => handleCopy(`publish-pack-${selectedJob.id}`, buildPublishPack(selectedJob))} className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700">
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
                        <button type="button" onClick={() => handleCopy(`share-${selectedJob.id}`, selectedJob.shareUrl)} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
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
                            {`${selectedJob.employeeCount || '待补充'}｜总部位于${selectedJob.address || '待补充'}｜成立于${selectedJob.foundedYear || '待补充'}｜评分${selectedJob.companyRating || '待补充'}`}
                          </div>
                        </div>
                        <button type="button" onClick={() => handleCopy(`company-${selectedJob.id}`, `${selectedJob.employeeCount || '待补充'}｜总部位于${selectedJob.address || '待补充'}｜成立于${selectedJob.foundedYear || '待补充'}｜评分${selectedJob.companyRating || '待补充'}`)} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
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
                        <button type="button" onClick={() => handleCopy(`industry-${selectedJob.id}`, selectedJob.industry || '待补充')} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
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
                        <button type="button" onClick={() => handleCopy(`referral-${selectedJob.id}`, getReferralLines(selectedJob, true).join('\n'))} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">摘要草稿</h4>
                      <p className="mt-2 text-sm leading-6 text-slate-500">先智能提炼，再人工微调。右侧海报会实时同步当前内容。</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button type="button" onClick={handleGeneratePoster} disabled={generatingPoster} className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {generatingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {generatingPoster ? '提炼中...' : '智能提炼'}
                      </button>
                      <button type="button" onClick={handleSaveDraft} disabled={savingDraft || !companySummaryText.trim() || !jobSummaryText.trim()} className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60">
                        {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {savingDraft ? '保存中...' : '保存草稿'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">企业简介摘要</div>
                        <div className="text-xs text-slate-500">{companySummaryText.length} 字，建议 55-95 字，{getRangeHint(companySummaryText.length, 55, 95)}</div>
                      </div>
                      <textarea
                        value={companySummaryText}
                        maxLength={120}
                        onChange={(event) => handleCompanySummaryChange(event.target.value)}
                        className="mt-3 min-h-[110px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={handleRestoreCompanySummary} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                          恢复默认
                        </button>
                      </div>
                      <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-slate-600">查看企业原文参考</summary>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {selectedJob.companyDescriptionSource === 'trusted' ? '可信企业主简介' : '翻译兜底简介'}
                          </div>
                          <div className="max-h-48 overflow-y-auto pr-1">
                            <ReferenceBlocks blocks={companyReferenceBlocks} />
                          </div>
                        </div>
                      </details>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">岗位摘要</div>
                        <div className="text-xs text-slate-500">{jobSummaryText.length} 字，建议 150-230 字，{getRangeHint(jobSummaryText.length, 150, 230)}</div>
                      </div>
                      <textarea
                        value={jobSummaryText}
                        maxLength={320}
                        onChange={(event) => handleJobSummaryChange(event.target.value)}
                        className="mt-3 min-h-[180px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-rose-300 focus:ring-2 focus:ring-rose-100"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={handleRestoreJobSummary} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                          恢复默认
                        </button>
                      </div>
                      <details className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <summary className="cursor-pointer list-none text-xs font-semibold text-slate-600">查看岗位原文参考</summary>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">岗位原文</div>
                          <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
                            {jobReferenceSections.map((section) => (
                              <div key={section.id} className="space-y-2">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{section.displayTitle}</div>
                                <ReferenceBlocks blocks={section.activeBlocks} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>

                  {(draftDirty || draftNotice || posterError) ? (
                    <div className="mt-4 space-y-2 text-sm">
                      {draftDirty ? <div className="text-amber-700">当前有未保存修改。</div> : null}
                      {draftNotice ? <div className="text-emerald-700">{draftNotice}</div> : null}
                      {posterError ? <div className="text-rose-700">{posterError}</div> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">海报预览</h4>
                      <p className="mt-1 text-sm text-slate-500">当前摘要会实时同步到海报，确认后直接下载即可。</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={handleDownloadPoster} disabled={downloadingPoster} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                        {downloadingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {downloadingPoster ? '导出中...' : '下载图片'}
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 flex justify-center">
                    <PosterPreview job={selectedJob} draft={effectivePosterDraft} themeId={selectedThemeId} />
                  </div>
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
