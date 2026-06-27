import crypto from 'crypto';

const MAX_DISPLAY_LENGTH = 80;

const ALIAS_RULES = [
  { group: '产品经理', patterns: [/^(pm|product|product manager|product management)$/i, /产品经理?/, /产品管理/] },
  { group: '前端开发', patterns: [/^(frontend|front-end|front end|web frontend|web前端)$/i, /前端/] },
  { group: '后端开发', patterns: [/^(backend|back-end|back end|server side)$/i, /后端/] },
  { group: '全栈开发', patterns: [/^(fullstack|full-stack|full stack)$/i, /全栈/] },
  { group: '设计', patterns: [/^(designer|design|ui|ux|ui ux|ui\/ux)$/i, /设计|视觉|交互|用户体验/] },
  { group: '运营', patterns: [/^(operation|operations|ops|growth)$/i, /运营|增长/] },
  { group: '市场营销', patterns: [/^(marketing|marketer|seo|content marketing)$/i, /市场|营销|品牌|内容/] },
  { group: '客户成功', patterns: [/^(customer success|customer support|support|cs)$/i, /客户成功|客服|客户支持/] },
  { group: '数据分析', patterns: [/^(data analyst|data analysis|analytics|bi)$/i, /数据分析|商业分析|数据/] },
  { group: 'AI / 机器学习', patterns: [/^(ai|ml|machine learning|llm|prompt engineer)$/i, /人工智能|机器学习|大模型|算法/] },
  { group: '项目管理', patterns: [/^(project manager|program manager|scrum master)$/i, /项目经理|项目管理/] },
  { group: '人力资源', patterns: [/^(hr|human resources|recruiter|talent)$/i, /人力|人事|招聘|hr/i] },
  { group: '财务 / 会计', patterns: [/^(finance|accountant|accounting)$/i, /财务|会计/] },
  { group: '销售', patterns: [/^(sales|account executive|bd|business development)$/i, /销售|商务拓展|客户经理/] },
];

const SENSITIVE_PATTERNS = [
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:\+?86[-\s]?)?1[3-9]\d{9}/,
  /https?:\/\/|www\./i,
  /(?:password|token|authorization|cookie|secret|jwt|bearer)/i,
  /(?:简历|resume).{20,}/i,
];

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex').slice(0, 32);
}

function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[，、|/\\]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getLengthBucket(length) {
  if (length <= 0) return 'empty';
  if (length <= 10) return '1-10';
  if (length <= 30) return '11-30';
  if (length <= 80) return '31-80';
  return '80+';
}

function isSensitiveSearchTerm(rawValue, normalized) {
  const text = `${String(rawValue || '')} ${normalized}`;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function deriveSearchGroup(normalized) {
  for (const rule of ALIAS_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return rule.group;
    }
  }
  return normalized
    .split(' ')
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
}

export function buildSearchTermAnalytics(rawValue, { source = 'jobs_page' } = {}) {
  const rawText = String(rawValue || '');
  const normalized = normalizeSearchText(rawText);
  const length = normalized.length;
  const base = {
    search_term_present: length > 0,
    search_term_length: Math.min(length, 500),
    search_term_length_bucket: getLengthBucket(length),
    search_source: String(source || 'jobs_page').slice(0, 60),
  };

  if (!normalized) return base;

  if (isSensitiveSearchTerm(rawText, normalized)) {
    return {
      ...base,
      search_term_group: 'redacted_sensitive_query',
      search_term_display: '敏感搜索（已隐藏）',
    };
  }

  if (length > MAX_DISPLAY_LENGTH) {
    return {
      ...base,
      search_term_hash: stableHash(normalized),
      search_term_group: 'long_query_hidden',
      search_term_display: '长文本搜索（已隐藏）',
    };
  }

  const group = deriveSearchGroup(normalized);
  return {
    ...base,
    search_term_normalized: normalized,
    search_term_hash: stableHash(normalized),
    search_term_display: group || normalized,
    search_term_group: group || normalized,
  };
}

export function sanitizeSearchTermProperties(properties = {}) {
  const normalized = normalizeSearchText(properties.search_term_normalized || '');
  const group = normalizeSearchText(properties.search_term_group || '');
  const display = String(properties.search_term_display || '').normalize('NFKC').trim().slice(0, MAX_DISPLAY_LENGTH);
  const length = Number(properties.search_term_length || normalized.length || 0);
  const source = String(properties.search_source || 'jobs_page').trim().slice(0, 60) || 'jobs_page';
  const isRedacted = group === 'redacted_sensitive_query' || group === 'long_query_hidden';

  const safe = {
    search_term_present: Boolean(properties.search_term_present || normalized || group),
    search_term_length: Math.max(0, Math.min(500, Math.round(length))),
    search_term_length_bucket: getLengthBucket(length),
    search_source: source,
  };

  if (isRedacted) {
    return {
      ...safe,
      search_term_group: group,
      search_term_display: group === 'long_query_hidden' ? '长文本搜索（已隐藏）' : '敏感搜索（已隐藏）',
      ...(properties.search_term_hash ? { search_term_hash: String(properties.search_term_hash).slice(0, 64) } : {}),
    };
  }

  if (!normalized || normalized.length > MAX_DISPLAY_LENGTH || isSensitiveSearchTerm(normalized, normalized)) {
    return safe;
  }

  const derivedGroup = deriveSearchGroup(normalized);
  return {
    ...safe,
    search_term_normalized: normalized,
    search_term_hash: stableHash(normalized),
    search_term_display: display && !isSensitiveSearchTerm(display, display) ? display : derivedGroup,
    search_term_group: group && !isSensitiveSearchTerm(group, group) ? group : derivedGroup,
  };
}
