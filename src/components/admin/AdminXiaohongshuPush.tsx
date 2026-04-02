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

const TEMPLATE_VERSION = 'xhs-v4';
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1440;
const PREVIEW_SCALE = 0.34;
const POSTER_FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';

const POSTER_THEMES = [
  {
    id: 'lavender',
    name: '浅紫',
    border: '#d9cdf8',
    backgroundStart: '#faf7ff',
    backgroundEnd: '#efe8ff',
    title: '#302651',
    company: '#7360b0',
    label: '#8b78c8',
    chipText: '#755ec3',
    chipBorder: '#d8cdf6',
    chipBg: 'rgba(255,255,255,0.84)',
    sectionBg: 'rgba(255,255,255,0.82)',
    sectionBorder: 'rgba(217,205,248,0.95)',
    orbOne: 'rgba(182, 156, 255, 0.22)',
    orbTwo: 'rgba(255,255,255,0.76)'
  },
  {
    id: 'sky',
    name: '浅蓝',
    border: '#c7e0fb',
    backgroundStart: '#f4faff',
    backgroundEnd: '#e8f3ff',
    title: '#21364f',
    company: '#5e85b4',
    label: '#7397c3',
    chipText: '#4e77a5',
    chipBorder: '#c6def8',
    chipBg: 'rgba(255,255,255,0.86)',
    sectionBg: 'rgba(255,255,255,0.84)',
    sectionBorder: 'rgba(199,224,251,0.96)',
    orbOne: 'rgba(129, 192, 255, 0.22)',
    orbTwo: 'rgba(255,255,255,0.8)'
  },
  {
    id: 'butter',
    name: '浅黄',
    border: '#efdfb4',
    backgroundStart: '#fffbf1',
    backgroundEnd: '#fff2d6',
    title: '#43351c',
    company: '#9f854f',
    label: '#b59758',
    chipText: '#8b7244',
    chipBorder: '#eeddb0',
    chipBg: 'rgba(255,255,255,0.86)',
    sectionBg: 'rgba(255,255,255,0.82)',
    sectionBorder: 'rgba(239,223,180,0.96)',
    orbOne: 'rgba(255, 217, 120, 0.20)',
    orbTwo: 'rgba(255,255,255,0.82)'
  },
  {
    id: 'mint',
    name: '浅绿',
    border: '#cbead7',
    backgroundStart: '#f4fff8',
    backgroundEnd: '#e7f8ee',
    title: '#1f4030',
    company: '#4f9471',
    label: '#68a883',
    chipText: '#4b8d6b',
    chipBorder: '#c7e6d2',
    chipBg: 'rgba(255,255,255,0.86)',
    sectionBg: 'rgba(255,255,255,0.84)',
    sectionBorder: 'rgba(203,234,215,0.96)',
    orbOne: 'rgba(148, 219, 175, 0.24)',
    orbTwo: 'rgba(255,255,255,0.82)'
  },
  {
    id: 'blush',
    name: '浅粉',
    border: '#f0ced7',
    backgroundStart: '#fff6f8',
    backgroundEnd: '#ffeaf0',
    title: '#452733',
    company: '#bb768a',
    label: '#d1879f',
    chipText: '#9d6172',
    chipBorder: '#efccd7',
    chipBg: 'rgba(255,255,255,0.86)',
    sectionBg: 'rgba(255,255,255,0.84)',
    sectionBorder: 'rgba(240,206,215,0.96)',
    orbOne: 'rgba(255, 181, 204, 0.22)',
    orbTwo: 'rgba(255,255,255,0.82)'
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
  return [
    job.title,
    job.company,
    `申请链接：${job.shareUrl}`,
    `岗位信息：${job.location}｜${job.category}｜${formatJobTypeLabel(job.jobType)}｜${formatExperienceLabel(job.experienceLevel)}`,
    `企业信息：${job.employeeCount || '待补充'}｜总部位于${job.address || '待补充'}｜成立于${job.foundedYear || '待补充'}｜评分${job.companyRating || '待补充'}`,
    `所属行业：${job.industry || '待补充'}`,
    ...getReferralLines(job).map((line) => `内推邮箱：${line}`)
  ].join('\n');
}

function getThemeById(themeId: string) {
  return POSTER_THEMES.find((theme) => theme.id === themeId) || POSTER_THEMES[0];
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
  }
) {
  const {
    maxWidth,
    maxLines,
    startSize,
    minSize,
    weight = 500,
    lineHeightRatio = 1.4
  } = options;

  for (let fontSize = startSize; fontSize >= minSize; fontSize -= 2) {
    ctx.font = `${weight} ${fontSize}px ${POSTER_FONT_FAMILY}`;
    const wrapped = wrapTextByWidth(ctx, text, maxWidth, maxLines);
    if (!wrapped.truncated || fontSize === minSize) {
      return {
        font: `${weight} ${fontSize}px ${POSTER_FONT_FAMILY}`,
        fontSize,
        lineHeight: Math.round(fontSize * lineHeightRatio),
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

function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, fillStyle: string | CanvasGradient) {
  ctx.save();
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function strokeRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number, strokeStyle: string, lineWidth = 2) {
  ctx.save();
  drawRoundRect(ctx, x, y, width, height, radius);
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
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

function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  theme: (typeof POSTER_THEMES)[number],
  maxWidth = 228
) {
  ctx.save();
  ctx.font = `600 28px ${POSTER_FONT_FAMILY}`;
  const width = Math.min(maxWidth, Math.max(108, ctx.measureText(text).width + 40));
  fillRoundRect(ctx, x, y, width, 60, 30, theme.chipBg);
  strokeRoundRect(ctx, x, y, width, 60, 30, theme.chipBorder, 2);
  drawTextLines(ctx, [text], x + 20, y + 14, 28, theme.chipText, `600 28px ${POSTER_FONT_FAMILY}`);
  ctx.restore();
  return width;
}

function layoutChips(
  ctx: CanvasRenderingContext2D,
  items: string[],
  startX: number,
  startY: number,
  maxWidth: number,
  theme: (typeof POSTER_THEMES)[number]
) {
  let x = startX;
  let y = startY;
  const rowHeight = 60;
  const gap = 12;

  for (const item of items) {
    const text = item || '待补充';
    ctx.font = `600 28px ${POSTER_FONT_FAMILY}`;
    const width = Math.min(228, Math.max(108, ctx.measureText(text).width + 40));
    if (x > startX && x + width > startX + maxWidth) {
      x = startX;
      y += rowHeight + gap;
    }
    drawChip(ctx, text, x, y, theme);
    x += width + gap;
  }

  return y + rowHeight;
}

function downloadCanvas(canvas: HTMLCanvasElement, fileName: string) {
  const link = document.createElement('a');
  link.download = fileName;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function renderPosterCanvas(job: XhsPushJobListItem, draft: XhsPosterDraft | null, themeId: string) {
  const theme = getThemeById(themeId);
  const canvas = document.createElement('canvas');
  canvas.width = EXPORT_WIDTH;
  canvas.height = EXPORT_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  const gradient = ctx.createLinearGradient(0, 0, EXPORT_WIDTH, EXPORT_HEIGHT);
  gradient.addColorStop(0, theme.backgroundStart);
  gradient.addColorStop(1, theme.backgroundEnd);
  fillRoundRect(ctx, 0, 0, EXPORT_WIDTH, EXPORT_HEIGHT, 56, gradient);
  strokeRoundRect(ctx, 1.5, 1.5, EXPORT_WIDTH - 3, EXPORT_HEIGHT - 3, 56, theme.border, 3);

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.orbOne;
  ctx.beginPath();
  ctx.arc(860, 258, 118, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(150, 120, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = theme.orbTwo;
  ctx.beginPath();
  ctx.arc(930, 1260, 205, 0, Math.PI * 2);
  ctx.fill();
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

  const industryText = job.industry || '待补充';
  ctx.font = `600 28px ${POSTER_FONT_FAMILY}`;
  const industryWidth = Math.min(260, Math.max(140, ctx.measureText(industryText).width + 50));
  fillRoundRect(ctx, EXPORT_WIDTH - paddingX - industryWidth, 80, industryWidth, 68, 34, theme.chipBg);
  strokeRoundRect(ctx, EXPORT_WIDTH - paddingX - industryWidth, 80, industryWidth, 68, 34, theme.chipBorder, 2);
  drawTextLines(ctx, [industryText], EXPORT_WIDTH - paddingX - industryWidth + 24, 98, 30, theme.chipText, `600 28px ${POSTER_FONT_FAMILY}`);

  drawTextLines(ctx, [company], paddingX, 92, 30, theme.company, `600 26px ${POSTER_FONT_FAMILY}`);

  const titleBlock = fitTextBlock(ctx, title, {
    maxWidth: contentWidth,
    maxLines: 2,
    startSize: 68,
    minSize: 54,
    weight: 900,
    lineHeightRatio: 1.08
  });
  const titleY = 140;
  drawTextLines(ctx, titleBlock.lines, paddingX, titleY, titleBlock.lineHeight, theme.title, titleBlock.font);
  const titleBottom = titleY + (titleBlock.lines.length * titleBlock.lineHeight);

  const chipY = titleBottom + 24;
  const chipsBottom = layoutChips(ctx, metaItems, paddingX, chipY, contentWidth, theme);

  const companySectionY = chipsBottom + 24;
  const companyTextBlock = fitTextBlock(ctx, companySummary, {
    maxWidth: contentWidth - 60,
    maxLines: 3,
    startSize: 31,
    minSize: 26,
    weight: 500,
    lineHeightRatio: 1.42
  });
  const companySectionHeight = Math.max(176, 82 + (companyTextBlock.lines.length * companyTextBlock.lineHeight));
  fillRoundRect(ctx, paddingX, companySectionY, contentWidth, companySectionHeight, 34, theme.sectionBg);
  strokeRoundRect(ctx, paddingX, companySectionY, contentWidth, companySectionHeight, 34, theme.sectionBorder, 2);
  drawTextLines(ctx, ['企业简介'], paddingX + 30, companySectionY + 28, 28, theme.label, `700 24px ${POSTER_FONT_FAMILY}`);
  drawTextLines(ctx, companyTextBlock.lines, paddingX + 30, companySectionY + 72, companyTextBlock.lineHeight, theme.title, companyTextBlock.font);

  const summarySectionY = companySectionY + companySectionHeight + 24;
  const summarySectionHeight = EXPORT_HEIGHT - summarySectionY - 84;
  const summaryTextBlock = fitTextBlock(ctx, jobSummary, {
    maxWidth: contentWidth - 60,
    maxLines: 8,
    startSize: 34,
    minSize: 28,
    weight: 500,
    lineHeightRatio: 1.45
  });
  fillRoundRect(ctx, paddingX, summarySectionY, contentWidth, summarySectionHeight, 34, theme.sectionBg);
  strokeRoundRect(ctx, paddingX, summarySectionY, contentWidth, summarySectionHeight, 34, theme.sectionBorder, 2);
  drawTextLines(ctx, ['岗位摘要'], paddingX + 30, summarySectionY + 28, 28, theme.label, `700 24px ${POSTER_FONT_FAMILY}`);
  drawTextLines(ctx, summaryTextBlock.lines, paddingX + 30, summarySectionY + 74, summaryTextBlock.lineHeight, theme.title, summaryTextBlock.font);

  return canvas;
}

const PosterPreview: React.FC<{
  job: XhsPushJobListItem;
  draft: XhsPosterDraft | null;
  themeId: string;
}> = ({ job, draft, themeId }) => {
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    try {
      const canvas = renderPosterCanvas(job, draft, themeId);
      setPreviewUrl(canvas.toDataURL('image/png'));
    } catch (_error) {
      setPreviewUrl('');
    }
  }, [draft, job, themeId]);

  return (
    <div className="overflow-hidden rounded-[32px] shadow-[0_18px_60px_rgba(71,52,41,0.12)]">
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
  const [selectedThemeId, setSelectedThemeId] = useState<string>(POSTER_THEMES[0].id);
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
          summary: buildLocalPosterSummary(selectedJob)
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

      setPosterDraft({
        jobSummary: data.jobSummary || buildLocalPosterSummary(selectedJob),
        companySummary: data.companySummary || buildLocalCompanySummary(selectedJob),
        provider: data.provider || 'local',
        templateVersion: TEMPLATE_VERSION,
        generatedAt: new Date().toISOString(),
        cacheHit: Boolean(data.cacheHit),
        usedFallback: Boolean(data.usedFallback)
      });
    } catch (err) {
      setPosterError(err instanceof Error ? err.message : '生成海报失败');
    } finally {
      setGeneratingPoster(false);
    }
  };

  const handleDownloadPoster = async () => {
    if (!selectedJob) return;

    try {
      setDownloadingPoster(true);
      const canvas = renderPosterCanvas(selectedJob, posterDraft, selectedThemeId);
      downloadCanvas(canvas, `${selectedJob.company}-${selectedJob.title}-xiaohongshu.png`);
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
                        <button type="button" onClick={() => handleCopy(`referral-${selectedJob.id}`, getReferralLines(selectedJob).map((line) => `内推邮箱：${line}`).join('\n'))} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-700">
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
                  <p className="mt-2 text-sm leading-6 text-slate-500">海报文案优先走中文内容，岗位摘要会尽量控制在较满版的长度区间里。</p>

                  <div className="mt-4 grid gap-3">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">企业简介摘要</div>
                      <div className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{posterDraft?.companySummary || buildLocalCompanySummary(selectedJob)}</div>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">岗位摘要</div>
                      <div className="mt-2 whitespace-pre-line text-sm leading-7 text-slate-700">{posterDraft?.jobSummary || buildLocalPosterSummary(selectedJob)}</div>
                    </div>
                  </div>

                  {posterDraft ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">模板 {posterDraft.templateVersion}</span>
                      <span className="rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700">{posterDraft.provider === 'bailian' ? '百炼摘要' : '本地摘要'}</span>
                      {posterDraft.cacheHit ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">命中缓存</span> : null}
                      {posterDraft.usedFallback ? <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">使用本地兜底</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-3xl border border-rose-100 bg-white p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">小红书 3:4 配图</h4>
                      <p className="mt-1 text-sm text-slate-500">下载时使用 Canvas 直出，避免 DOM 导出造成的挤压、颜色偏差和圆角失真。</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button type="button" onClick={handleGeneratePoster} disabled={generatingPoster} className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60">
                        {generatingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {generatingPoster ? '生成中...' : '生成配图'}
                      </button>
                      <button type="button" onClick={handleDownloadPoster} disabled={downloadingPoster} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
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
                          selectedThemeId === theme.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {theme.name}
                      </button>
                    ))}
                  </div>

                  {posterError ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{posterError}</div> : null}

                  <div className="mt-5 flex justify-center">
                    <PosterPreview job={selectedJob} draft={posterDraft} themeId={selectedThemeId} />
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
