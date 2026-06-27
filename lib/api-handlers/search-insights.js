import neonHelper from '../../server-utils/dal/neon-helper.js';
import userHelper from '../../server-utils/user-helper.js';

const ANALYTICS_TIME_ZONE = 'Asia/Shanghai';
const MAX_LIMIT = 50;

function normalizePeriod(period = 'week') {
  return ['day', 'week', 'month'].includes(period) ? period : 'week';
}

function getPeriodStartExpression(period = 'week') {
  const unit = normalizePeriod(period);
  return `(date_trunc('${unit}', NOW() AT TIME ZONE '${ANALYTICS_TIME_ZONE}') AT TIME ZONE '${ANALYTICS_TIME_ZONE}')`;
}

function parseDate(value) {
  const date = value ? new Date(String(value)) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1';
}

function toInt(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

function toFloat(value, digits = 2) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(digits)) : 0;
}

function segmentFilter(segment = 'all', alias = 'ae') {
  const explicitSegment = `NULLIF(COALESCE(${alias}.user_segment, ${alias}.properties->>'user_segment', ''), '')`;
  const userSegment = `COALESCE(${explicitSegment}, CASE WHEN ${alias}.user_id IS NULL THEN 'guest' ELSE 'free' END)`;
  switch (segment) {
    case 'guest':
      return `${userSegment} = 'guest'`;
    case 'free':
      return `${userSegment} = 'free'`;
    case 'member':
      return `${userSegment} = 'member'`;
    default:
      return '1=1';
  }
}

function actorExpr(alias = 'ae') {
  return `COALESCE(NULLIF(${alias}.user_id, ''), ${alias}.anonymous_id)`;
}

function normalizeSort(value) {
  return ['searchPv', 'searchUv', 'emptyRate', 'lastSearchedAt'].includes(value) ? value : 'searchPv';
}

function sortExpression(sort) {
  switch (sort) {
    case 'searchUv':
      return 'search_uv DESC, search_pv DESC';
    case 'emptyRate':
      return 'empty_rate DESC, empty_pv DESC, search_pv DESC';
    case 'lastSearchedAt':
      return 'last_searched_at DESC';
    case 'searchPv':
    default:
      return 'search_pv DESC, search_uv DESC';
  }
}

function normalizeSearchTermRow(row) {
  const searchPv = toInt(row.search_pv);
  const emptyPv = toInt(row.empty_pv);
  const avgResultCount = toFloat(row.avg_result_count, 1);
  const emptyRate = searchPv > 0 ? emptyPv / searchPv : Number(row.empty_rate || 0);
  const suggestion =
    emptyPv >= 3 && emptyRate >= 0.6 ? '补岗位'
      : emptyRate >= 0.4 ? '调搜索'
        : avgResultCount <= 3 ? '检查标签'
          : '观察';

  return {
    key: row.search_term_hash || row.search_term_group,
    term: row.search_term_display || row.search_term_group || '-',
    group: row.search_term_group || row.search_term_display || '-',
    normalized: row.search_term_normalized || null,
    hash: row.search_term_hash || null,
    searchPv,
    searchUv: toInt(row.search_uv),
    emptyPv,
    emptyRate: toFloat(emptyRate, 4),
    avgResultCount,
    lastSearchedAt: row.last_searched_at || null,
    guestUv: toInt(row.guest_uv),
    loggedInUv: toInt(row.logged_in_uv),
    sampleFilters: Array.isArray(row.sample_filters) ? row.sample_filters.filter(Boolean).slice(0, 5) : [],
    recentSearches: Array.isArray(row.recent_searches) ? row.recent_searches.slice(0, 5) : [],
    suggestion,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = await userHelper.validateAdminRequest(req);
  if (!auth.valid) {
    return res.status(auth.error === 'Forbidden' ? 403 : 401).json({ success: false, error: auth.error || 'Unauthorized' });
  }

  if (!neonHelper.isConfigured) {
    return res.status(503).json({ success: false, error: 'Database not configured' });
  }

  const period = normalizePeriod(String(req.query.period || 'week'));
  const segment = ['all', 'guest', 'free', 'member'].includes(req.query.segment) ? String(req.query.segment) : 'all';
  const onlyEmpty = parseBoolean(req.query.onlyEmpty);
  const sort = normalizeSort(String(req.query.sort || 'searchPv'));
  const limit = Math.min(MAX_LIMIT, Math.max(10, Number.parseInt(String(req.query.limit || 20), 10) || 20));
  const page = Math.max(1, Number.parseInt(String(req.query.page || 1), 10) || 1);
  const offset = (page - 1) * limit;
  const query = String(req.query.q || '').trim().slice(0, 80);
  const from = parseDate(req.query.from);
  const to = parseDate(req.query.to);

  const params = [];
  const filters = [
    `COALESCE(ae.event_family, ae.properties->>'event_family') = 'search'`,
    `COALESCE(ae.properties->>'search_term_group', '') NOT IN ('', 'redacted_sensitive_query', 'long_query_hidden')`,
    segmentFilter(segment, 'ae'),
  ];

  if (from) {
    params.push(from);
    filters.push(`ae.created_at >= $${params.length}`);
  } else {
    filters.push(`ae.created_at >= ${getPeriodStartExpression(period)}`);
  }

  if (to) {
    params.push(to);
    filters.push(`ae.created_at <= $${params.length}`);
  } else {
    filters.push('ae.created_at < NOW()');
  }

  if (query) {
    params.push(`%${query}%`);
    filters.push(`(
      ae.properties->>'search_term_display' ILIKE $${params.length}
      OR ae.properties->>'search_term_group' ILIKE $${params.length}
      OR ae.properties->>'search_term_normalized' ILIKE $${params.length}
    )`);
  }

  const whereClause = filters.join(' AND ');
  const onlyEmptyHaving = onlyEmpty ? 'HAVING COUNT(*) FILTER (WHERE event_name = \'search_empty\') > 0' : '';
  const orderBy = sortExpression(sort);

  const termBaseCte = `
    WITH base AS (
      SELECT
        ${actorExpr('ae')} AS actor_id,
        ae.user_id,
        ae.event_name,
        ae.created_at,
        COALESCE(ae.outcome, ae.properties->>'outcome', 'succeeded') AS outcome,
        NULLIF(ae.properties->>'search_term_display', '') AS search_term_display,
        NULLIF(ae.properties->>'search_term_group', '') AS search_term_group,
        NULLIF(ae.properties->>'search_term_normalized', '') AS search_term_normalized,
        NULLIF(ae.properties->>'search_term_hash', '') AS search_term_hash,
        NULLIF(ae.properties->>'filters', '') AS filters_text,
        NULLIF(ae.properties->>'result_count', '') AS result_count
      FROM analytics_events ae
      WHERE ${whereClause}
    )
  `;

  const aggregateQuery = `
    ${termBaseCte},
    grouped AS (
      SELECT
        search_term_group,
        MAX(search_term_display) AS search_term_display,
        MIN(search_term_normalized) AS search_term_normalized,
        MIN(search_term_hash) AS search_term_hash,
        COUNT(*) FILTER (WHERE event_name = 'search_submitted') AS search_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'search_submitted') AS search_uv,
        COUNT(*) FILTER (WHERE event_name = 'search_empty') AS empty_pv,
        AVG(NULLIF(result_count, '')::numeric) FILTER (WHERE event_name IN ('search_result_rendered', 'search_empty')) AS avg_result_count,
        MAX(created_at) AS last_searched_at,
        COUNT(DISTINCT actor_id) FILTER (WHERE user_id IS NULL) AS guest_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE user_id IS NOT NULL) AS logged_in_uv,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT filters_text), NULL) AS sample_filters
      FROM base
      GROUP BY search_term_group
      ${onlyEmptyHaving}
    )
    SELECT
      *,
      CASE WHEN search_pv > 0 THEN empty_pv::float / search_pv ELSE 0 END AS empty_rate,
      COUNT(*) OVER() AS total_count,
      (
        SELECT JSON_AGG(item ORDER BY item.created_at DESC)
        FROM (
          SELECT created_at, event_name, outcome, NULLIF(result_count, '')::int AS result_count
          FROM base b
          WHERE b.search_term_group = grouped.search_term_group
          ORDER BY created_at DESC
          LIMIT 5
        ) item
      ) AS recent_searches
    FROM grouped
    ORDER BY ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const summaryQuery = `
    ${termBaseCte}
    SELECT
      COUNT(*) FILTER (WHERE event_name = 'search_submitted') AS search_pv,
      COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'search_submitted') AS search_uv,
      COUNT(*) FILTER (WHERE event_name = 'search_empty') AS empty_pv,
      COUNT(DISTINCT search_term_group) AS term_count,
      COUNT(DISTINCT search_term_group) FILTER (WHERE event_name = 'search_empty') AS empty_term_count
    FROM base
  `;

  const trendQuery = `
    ${termBaseCte}
    SELECT
      DATE(created_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}') AS date,
      COUNT(*) FILTER (WHERE event_name = 'search_submitted') AS search_pv,
      COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'search_submitted') AS search_uv,
      COUNT(*) FILTER (WHERE event_name = 'search_empty') AS empty_pv
    FROM base
    GROUP BY DATE(created_at AT TIME ZONE '${ANALYTICS_TIME_ZONE}')
    ORDER BY date ASC
  `;

  const topEmptyQuery = `
    ${termBaseCte}
    SELECT
      search_term_group,
      MAX(search_term_display) AS search_term_display,
      COUNT(*) FILTER (WHERE event_name = 'search_empty') AS empty_pv,
      COUNT(*) FILTER (WHERE event_name = 'search_submitted') AS search_pv
    FROM base
    GROUP BY search_term_group
    HAVING COUNT(*) FILTER (WHERE event_name = 'search_empty') > 0
    ORDER BY empty_pv DESC, search_pv DESC
    LIMIT 10
  `;

  try {
    const queryParams = [...params, limit, offset];
    const [termRows, summaryRows, trendRows, topEmptyRows] = await Promise.all([
      neonHelper.query(aggregateQuery, queryParams),
      neonHelper.query(summaryQuery, params),
      neonHelper.query(trendQuery, params),
      neonHelper.query(topEmptyQuery, params),
    ]);

    const summary = summaryRows?.[0] || {};
    const searchPv = toInt(summary.search_pv);
    const emptyPv = toInt(summary.empty_pv);
    const total = toInt(termRows?.[0]?.total_count);

    return res.status(200).json({
      success: true,
      data: {
        period,
        segment,
        onlyEmpty,
        sort,
        page,
        limit,
        total,
        hasMore: offset + limit < total,
        summary: {
          searchPv,
          searchUv: toInt(summary.search_uv),
          emptyPv,
          emptyRate: searchPv > 0 ? toFloat(emptyPv / searchPv, 4) : 0,
          termCount: toInt(summary.term_count),
          emptyTermCount: toInt(summary.empty_term_count),
        },
        terms: (termRows || []).map(normalizeSearchTermRow),
        trend: (trendRows || []).map((row) => ({
          date: row.date,
          searchPv: toInt(row.search_pv),
          searchUv: toInt(row.search_uv),
          emptyPv: toInt(row.empty_pv),
        })),
        topEmptyTerms: (topEmptyRows || []).map((row) => ({
          term: row.search_term_display || row.search_term_group || '-',
          group: row.search_term_group || '-',
          emptyPv: toInt(row.empty_pv),
          searchPv: toInt(row.search_pv),
        })),
      },
    });
  } catch (error) {
    console.error('[SearchInsights] Failed to load search insights:', error);
    return res.status(500).json({ success: false, error: 'Failed to load search insights' });
  }
}
