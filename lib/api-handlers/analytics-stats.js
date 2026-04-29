import neonHelper from '../../server-utils/dal/neon-helper.js';

const FEATURE_KEYS = [
  'favorite',
  'translation',
  'referral',
  'email_apply',
  'company_info',
  'membership_center',
  'membership_plan_trial_week',
  'membership_plan_quarter',
  'membership_plan_year',
  'resume_ai_suggestion',
  'resume_assistant_framework',
  'resume_assistant_polish',
  'resume_assistant_interview',
  'resume_assistant_mock_answer',
  'website_apply',
  'match_analysis',
];

const FEATURE_LABELS = {
  favorite: '收藏',
  translation: '一键翻译',
  referral: '帮我内推',
  email_apply: '邮箱直申',
  company_info: '企业认证信息',
  membership_center: '会员中心',
  membership_plan_trial_week: '体验会员卡',
  membership_plan_quarter: '季度会员卡',
  membership_plan_year: '年度会员卡',
  resume_ai_suggestion: '生成AI建议',
  resume_assistant_framework: '简历助手框架',
  resume_assistant_polish: '简历深度打磨',
  resume_assistant_interview: '英文面试拓展',
  resume_assistant_mock_answer: '模拟回答',
  website_apply: '前往申请',
  match_analysis: 'AI匹配分析',
};

function getDateFilter(period = 'week') {
  switch (period) {
    case 'day':
      return "created_at >= NOW() - INTERVAL '24 hours'";
    case 'month':
      return "created_at >= NOW() - INTERVAL '30 days'";
    case 'week':
    default:
      return "created_at >= NOW() - INTERVAL '7 days'";
  }
}

function getSegmentFilter(segment = 'all', alias = 'ae') {
  const explicitSegment = `NULLIF(COALESCE(${alias}.user_segment, ${alias}.properties->>'user_segment', ''), '')`;
  const userSegment = `COALESCE(${explicitSegment}, CASE WHEN ${alias}.user_id IS NULL THEN 'guest' ELSE 'free' END)`;
  switch (segment) {
    case 'guest':
      return `${userSegment} = 'guest'`;
    case 'free':
      return `${userSegment} = 'free'`;
    case 'member':
      return `${userSegment} = 'member'`;
    case 'all':
    default:
      return '1=1';
  }
}

function actorExpr(alias = 'ae') {
  return `COALESCE(NULLIF(${alias}.user_id, ''), ${alias}.anonymous_id)`;
}

function segmentExpr(alias = 'ae') {
  const explicitSegment = `NULLIF(COALESCE(${alias}.user_segment, ${alias}.properties->>'user_segment', ''), '')`;
  return `COALESCE(${explicitSegment}, CASE WHEN ${alias}.user_id IS NULL THEN 'guest' ELSE 'free' END)`;
}

function toInt(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

function toFloat(value, digits = 2) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(digits)) : 0;
}

function copilotDirectionRawExpr(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return `BTRIM(COALESCE(
    NULLIF(${prefix}properties->>'job_direction', ''),
    NULLIF(${prefix}properties->>'target_role', ''),
    NULLIF(${prefix}properties->>'role', ''),
    NULLIF(${prefix}properties->>'keyword', ''),
    ''
  ))`;
}

function copilotDirectionLabelExpr(alias = '') {
  const raw = copilotDirectionRawExpr(alias);
  const lowerRaw = `LOWER(${raw})`;
  return `
    CASE
      WHEN ${raw} = '' THEN '未填写'
      WHEN ${raw} ~ '^[A-Za-z0-9]$' THEN NULL
      WHEN ${lowerRaw} IN ('pm', 'product', 'product manager', 'chanpin') OR ${raw} IN ('产品', '产品经理') THEN '产品经理'
      WHEN ${raw} IN ('前端', '前端开发') OR ${lowerRaw} IN ('frontend', 'front-end', 'front end') THEN '前端开发'
      WHEN ${raw} IN ('全栈', '全栈开发', '全栈工程师') OR ${lowerRaw} IN ('fullstack', 'full-stack', 'full stack') THEN '全栈开发'
      WHEN ${lowerRaw} IN ('hr') OR ${raw} IN ('人事', '人力', '人力资源') THEN 'HR / 人力资源'
      WHEN ${lowerRaw} = 'ios' THEN 'iOS 开发'
      WHEN ${lowerRaw} ~ '^node\\.?js$' THEN 'Node.js 开发'
      WHEN ${lowerRaw} IN ('tee', 'test', 'testing') THEN '测试'
      WHEN ${lowerRaw} = 'yodo1' THEN NULL
      ELSE ${raw}
    END
  `;
}

function copilotDirectionValidCondition(alias = '') {
  const label = copilotDirectionLabelExpr(alias);
  return `(${label}) IS NOT NULL`;
}

function copilotPositionTypeLabelExpr(alias = '') {
  const prefix = alias ? `${alias}.` : '';
  const raw = `LOWER(BTRIM(COALESCE(
    NULLIF(${prefix}properties->>'position_type', ''),
    NULLIF(${prefix}properties->>'job_type', ''),
    'full-time'
  )))`;
  return `
    CASE
      WHEN ${raw} IN ('full-time', 'full_time', 'fulltime', '全职') THEN '全职'
      WHEN ${raw} IN ('part-time', 'part_time', 'parttime', '兼职') THEN '兼职'
      WHEN ${raw} IN ('freelance', 'contractor', '自由职业') THEN '自由职业'
      WHEN ${raw} IN ('contract', 'contractor', '合同') THEN '合同制'
      WHEN ${raw} IN ('intern', 'internship', '实习') THEN '实习'
      ELSE COALESCE(NULLIF(${raw}, ''), '未填写')
    END
  `;
}

function computeStepMetrics(steps = []) {
  let firstUv = steps[0]?.uv || 0;
  return steps.map((step, index) => {
    const prevUv = index > 0 ? steps[index - 1].uv : step.uv;
    const previousConversion = index > 0 && prevUv > 0 ? step.uv / prevUv : 1;
    const cumulativeConversion = firstUv > 0 ? step.uv / firstUv : 0;
    return {
      ...step,
      previousConversion,
      cumulativeConversion,
      dropoffUv: index > 0 ? Math.max(prevUv - step.uv, 0) : 0,
    };
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!neonHelper.isConfigured) {
      return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    const { period = 'week', segment = 'all', metricMode = 'total' } = req.query;
    const dateFilter = getDateFilter(period);
    const segmentFilter = getSegmentFilter(segment, 'ae');
    const eventPathExpr = `COALESCE(NULLIF(url, ''), properties->>'path', '')`;
    const homeVisitCondition = `
      (
        event_name = 'view_landing'
        OR (
          event_name = 'page_view' AND (
            COALESCE(page_key, properties->>'page_key') = 'home'
            OR ${eventPathExpr} IN ('', '/')
          )
        )
      )
    `;
    const jobDetailCondition = `
      (
        event_name = 'view_job_detail'
        OR (
          event_name = 'page_view' AND (
            COALESCE(page_key, properties->>'page_key') = 'job_detail'
            OR ${eventPathExpr} LIKE '/job/%'
            OR ${eventPathExpr} LIKE '/jobs/%'
          )
        )
        OR event_name IN ('click_apply_init', 'click_apply', 'click_apply_external', 'email_apply_success', 'referral_submit_success')
      )
    `;
    const jobsIntentCondition = `
      (
        event_name IN ('copilot_hero_submit', 'click_job_card', 'view_job_bundle')
        OR (
          event_name = 'page_view' AND (
            COALESCE(page_key, properties->>'page_key') = 'jobs'
            OR ${eventPathExpr} = '/jobs'
            OR ${eventPathExpr} LIKE '/jobs?%'
          )
        )
        OR ${jobDetailCondition}
      )
    `;
    const applyInitCondition = `
      (
        event_name = 'click_apply_init'
        OR event_name IN ('click_apply', 'click_apply_external', 'email_apply_success', 'referral_submit_success')
      )
    `;
    const applyPathCondition = `
      (
        event_name = 'click_apply'
        OR event_name IN ('click_apply_external', 'email_apply_success', 'referral_submit_success')
      )
    `;
    const applySuccessCondition = `
      (
        event_name IN ('click_apply_external', 'email_apply_success', 'referral_submit_success')
      )
    `;
    const jobBundleContextCondition = `
      (
        COALESCE(page_key, properties->>'page_key') = 'job_bundle_detail'
        OR COALESCE(source_key, properties->>'source_key') LIKE 'job_bundle%'
        OR ${eventPathExpr} LIKE '/job-bundles/%'
      )
    `;
    const jobBundleVisitCondition = `
      (
        event_name = 'view_job_bundle'
      )
    `;
    const jobBundleJobClickCondition = `
      (
        event_name = 'click_job_bundle_job'
      )
    `;
    const jobBundleDetailCondition = `
      (
        event_name = 'view_job_detail'
        AND ${jobBundleContextCondition}
      )
    `;
    const jobBundleApplyInitCondition = `
      (
        ${applyInitCondition}
        AND ${jobBundleContextCondition}
      )
    `;
    const jobBundleApplySuccessCondition = `
      (
        ${applySuccessCondition}
        AND ${jobBundleContextCondition}
      )
    `;
    const legacyMembershipFeatureCondition = `
      (
        event_name IN ('click_save_job', 'analyze_resume')
        OR (
          event_name IN ('feature_exposure', 'feature_click', 'feature_consume', 'feature_limit_reached')
          AND COALESCE(feature_key, properties->>'feature_key') IN (${FEATURE_KEYS.map((_, index) => `$${index + 1}`).join(', ')})
        )
      )
    `;
    const legacyMembershipClickCondition = `
      (
        event_name IN ('click_save_job', 'analyze_resume')
        OR (
          event_name = 'feature_click'
          AND COALESCE(feature_key, properties->>'feature_key') IN (${FEATURE_KEYS.map((_, index) => `$${index + 1}`).join(', ')})
        )
      )
    `;
    const legacyMembershipConsumeCondition = `
      (
        (
          event_name IN ('feature_consume', 'feature_limit_reached')
            AND COALESCE(feature_key, properties->>'feature_key') IN (${FEATURE_KEYS.map((_, index) => `$${index + 1}`).join(', ')})
        )
        OR event_name IN ('click_save_job', 'analyze_resume')
      )
    `;

    const overviewQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        COUNT(DISTINCT actor_id) AS total_uv,
        COUNT(*) AS total_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE ${segmentExpr('base')} = 'guest') AS guest_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE ${segmentExpr('base')} = 'free') AS free_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE ${segmentExpr('base')} = 'member') AS member_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_submit') AS copilot_submit_uv,
        COUNT(DISTINCT actor_id) FILTER (
          WHERE event_name IN ('membership_payment_success')
        ) AS payment_success_uv
      FROM base
    `;

    const jobFunnelQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      ),
      actor_steps AS (
        SELECT
          actor_id,
          MIN(created_at) FILTER (
            WHERE ${homeVisitCondition}
          ) AS landing_home_visit_at,
          MIN(created_at) FILTER (
            WHERE ${jobsIntentCondition}
          ) AS jobs_intent_at,
          MIN(created_at) FILTER (
            WHERE ${jobDetailCondition}
          ) AS job_detail_view_at,
          MIN(created_at) FILTER (WHERE ${applyInitCondition}) AS apply_init_click_at,
          MIN(created_at) FILTER (WHERE ${applyPathCondition}) AS apply_path_selected_at,
          MIN(created_at) FILTER (
            WHERE ${applySuccessCondition}
          ) AS apply_success_like_at
        FROM base
        GROUP BY actor_id
      ),
      step_uv AS (
        SELECT 'landing_home_visit' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
        UNION ALL
        SELECT 'jobs_intent' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
          AND jobs_intent_at IS NOT NULL
          AND jobs_intent_at >= landing_home_visit_at
        UNION ALL
        SELECT 'job_detail_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
          AND jobs_intent_at IS NOT NULL
          AND job_detail_view_at IS NOT NULL
          AND jobs_intent_at >= landing_home_visit_at
          AND job_detail_view_at >= jobs_intent_at
        UNION ALL
        SELECT 'apply_init_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
          AND jobs_intent_at IS NOT NULL
          AND job_detail_view_at IS NOT NULL
          AND apply_init_click_at IS NOT NULL
          AND jobs_intent_at >= landing_home_visit_at
          AND job_detail_view_at >= jobs_intent_at
          AND apply_init_click_at >= job_detail_view_at
        UNION ALL
        SELECT 'apply_path_selected' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
          AND jobs_intent_at IS NOT NULL
          AND job_detail_view_at IS NOT NULL
          AND apply_init_click_at IS NOT NULL
          AND apply_path_selected_at IS NOT NULL
          AND jobs_intent_at >= landing_home_visit_at
          AND job_detail_view_at >= jobs_intent_at
          AND apply_init_click_at >= job_detail_view_at
          AND apply_path_selected_at >= apply_init_click_at
        UNION ALL
        SELECT 'apply_success_like' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE landing_home_visit_at IS NOT NULL
          AND jobs_intent_at IS NOT NULL
          AND job_detail_view_at IS NOT NULL
          AND apply_init_click_at IS NOT NULL
          AND apply_path_selected_at IS NOT NULL
          AND apply_success_like_at IS NOT NULL
          AND jobs_intent_at >= landing_home_visit_at
          AND job_detail_view_at >= jobs_intent_at
          AND apply_init_click_at >= job_detail_view_at
          AND apply_path_selected_at >= apply_init_click_at
          AND apply_success_like_at >= apply_path_selected_at
      ),
      step_pv AS (
        SELECT 'landing_home_visit' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${homeVisitCondition}
        UNION ALL
        SELECT 'jobs_intent' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobsIntentCondition}
        UNION ALL
        SELECT 'job_detail_view' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobDetailCondition}
        UNION ALL
        SELECT 'apply_init_click' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${applyInitCondition}
        UNION ALL
        SELECT 'apply_path_selected' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${applyPathCondition}
        UNION ALL
        SELECT 'apply_success_like' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${applySuccessCondition}
      )
      SELECT step_uv.step_id, step_uv.uv, COALESCE(step_pv.pv, 0) AS pv
      FROM step_uv
      LEFT JOIN step_pv USING (step_id)
    `;

    const jobBundleFunnelQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      ),
      actor_steps AS (
        SELECT
          actor_id,
          MIN(created_at) FILTER (WHERE ${jobBundleVisitCondition}) AS bundle_visit_at,
          MIN(created_at) FILTER (WHERE ${jobBundleJobClickCondition}) AS bundle_job_click_at,
          MIN(created_at) FILTER (WHERE ${jobBundleDetailCondition}) AS bundle_detail_view_at,
          MIN(created_at) FILTER (WHERE ${jobBundleApplyInitCondition}) AS bundle_apply_click_at,
          MIN(created_at) FILTER (WHERE ${jobBundleApplySuccessCondition}) AS bundle_apply_success_at
        FROM base
        GROUP BY actor_id
      ),
      step_uv AS (
        SELECT 'bundle_visit' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE bundle_visit_at IS NOT NULL
        UNION ALL
        SELECT 'bundle_job_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE bundle_visit_at IS NOT NULL
          AND bundle_job_click_at IS NOT NULL
          AND bundle_job_click_at >= bundle_visit_at
        UNION ALL
        SELECT 'bundle_detail_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE bundle_visit_at IS NOT NULL
          AND bundle_job_click_at IS NOT NULL
          AND bundle_detail_view_at IS NOT NULL
          AND bundle_job_click_at >= bundle_visit_at
          AND bundle_detail_view_at >= bundle_job_click_at
        UNION ALL
        SELECT 'bundle_apply_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE bundle_visit_at IS NOT NULL
          AND bundle_apply_click_at IS NOT NULL
          AND bundle_apply_click_at >= bundle_visit_at
        UNION ALL
        SELECT 'bundle_apply_success' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE bundle_visit_at IS NOT NULL
          AND bundle_apply_click_at IS NOT NULL
          AND bundle_apply_success_at IS NOT NULL
          AND bundle_apply_click_at >= bundle_visit_at
          AND bundle_apply_success_at >= bundle_apply_click_at
      ),
      step_pv AS (
        SELECT 'bundle_visit' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobBundleVisitCondition}
        UNION ALL
        SELECT 'bundle_job_click' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobBundleJobClickCondition}
        UNION ALL
        SELECT 'bundle_detail_view' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobBundleDetailCondition}
        UNION ALL
        SELECT 'bundle_apply_click' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobBundleApplyInitCondition}
        UNION ALL
        SELECT 'bundle_apply_success' AS step_id, COUNT(*) AS pv FROM base
        WHERE ${jobBundleApplySuccessCondition}
      )
      SELECT step_uv.step_id, step_uv.uv, COALESCE(step_pv.pv, 0) AS pv
      FROM step_uv
      LEFT JOIN step_pv USING (step_id)
    `;

    const monetizationFunnelQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter}
          AND ${getSegmentFilter('free', 'ae')}
      ),
      actors AS (
        SELECT DISTINCT actor_id
        FROM base
        WHERE actor_id IS NOT NULL
      ),
      actor_steps AS (
        SELECT
          a.actor_id,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'step.')}
          ) AS has_free_feature_exposure,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND ${legacyMembershipClickCondition.replaceAll('ae.', 'step.')}
              AND EXISTS (
                SELECT 1
                FROM base prev
                WHERE prev.actor_id = a.actor_id
                  AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'prev.')}
                  AND prev.created_at <= step.created_at
              )
          ) AS has_free_feature_click,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND ${legacyMembershipConsumeCondition.replaceAll('ae.', 'step.')}
              AND EXISTS (
                SELECT 1
                FROM base click_step
                WHERE click_step.actor_id = a.actor_id
                  AND ${legacyMembershipClickCondition.replaceAll('ae.', 'click_step.')}
                  AND click_step.created_at <= step.created_at
                  AND EXISTS (
                    SELECT 1
                    FROM base exposure_step
                    WHERE exposure_step.actor_id = a.actor_id
                      AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'exposure_step.')}
                      AND exposure_step.created_at <= click_step.created_at
                  )
              )
          ) AS has_consume_or_limit,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND step.event_name = 'upgrade_modal_view'
              AND EXISTS (
                SELECT 1
                FROM base consume_step
                WHERE consume_step.actor_id = a.actor_id
                  AND ${legacyMembershipConsumeCondition.replaceAll('ae.', 'consume_step.')}
                  AND consume_step.created_at <= step.created_at
                  AND EXISTS (
                    SELECT 1
                    FROM base click_step
                    WHERE click_step.actor_id = a.actor_id
                      AND ${legacyMembershipClickCondition.replaceAll('ae.', 'click_step.')}
                      AND click_step.created_at <= consume_step.created_at
                      AND EXISTS (
                        SELECT 1
                        FROM base exposure_step
                        WHERE exposure_step.actor_id = a.actor_id
                          AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'exposure_step.')}
                          AND exposure_step.created_at <= click_step.created_at
                      )
                  )
              )
          ) AS has_upgrade_modal_view,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND (
                (step.event_name = 'page_view' AND COALESCE(step.page_key, step.properties->>'page_key') = 'membership')
                OR step.event_name = 'view_membership_page'
              )
              AND EXISTS (
                SELECT 1
                FROM base upgrade_step
                WHERE upgrade_step.actor_id = a.actor_id
                  AND upgrade_step.event_name = 'upgrade_modal_view'
                  AND upgrade_step.created_at <= step.created_at
                  AND EXISTS (
                    SELECT 1
                    FROM base consume_step
                    WHERE consume_step.actor_id = a.actor_id
                      AND ${legacyMembershipConsumeCondition.replaceAll('ae.', 'consume_step.')}
                      AND consume_step.created_at <= upgrade_step.created_at
                      AND EXISTS (
                        SELECT 1
                        FROM base click_step
                        WHERE click_step.actor_id = a.actor_id
                          AND ${legacyMembershipClickCondition.replaceAll('ae.', 'click_step.')}
                          AND click_step.created_at <= consume_step.created_at
                          AND EXISTS (
                            SELECT 1
                            FROM base exposure_step
                            WHERE exposure_step.actor_id = a.actor_id
                              AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'exposure_step.')}
                              AND exposure_step.created_at <= click_step.created_at
                          )
                      )
                  )
              )
          ) AS has_membership_page_view,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND step.event_name IN ('membership_plan_click', 'click_subscribe')
              AND EXISTS (
                SELECT 1
                FROM base membership_step
                WHERE membership_step.actor_id = a.actor_id
                  AND (
                    (membership_step.event_name = 'page_view' AND COALESCE(membership_step.page_key, membership_step.properties->>'page_key') = 'membership')
                    OR membership_step.event_name = 'view_membership_page'
                  )
                  AND membership_step.created_at <= step.created_at
                  AND EXISTS (
                    SELECT 1
                    FROM base upgrade_step
                    WHERE upgrade_step.actor_id = a.actor_id
                      AND upgrade_step.event_name = 'upgrade_modal_view'
                      AND upgrade_step.created_at <= membership_step.created_at
                      AND EXISTS (
                        SELECT 1
                        FROM base consume_step
                        WHERE consume_step.actor_id = a.actor_id
                          AND ${legacyMembershipConsumeCondition.replaceAll('ae.', 'consume_step.')}
                          AND consume_step.created_at <= upgrade_step.created_at
                          AND EXISTS (
                            SELECT 1
                            FROM base click_step
                            WHERE click_step.actor_id = a.actor_id
                              AND ${legacyMembershipClickCondition.replaceAll('ae.', 'click_step.')}
                              AND click_step.created_at <= consume_step.created_at
                              AND EXISTS (
                                SELECT 1
                                FROM base exposure_step
                                WHERE exposure_step.actor_id = a.actor_id
                                  AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'exposure_step.')}
                                  AND exposure_step.created_at <= click_step.created_at
                              )
                          )
                      )
                  )
              )
          ) AS has_membership_plan_click,
          EXISTS (
            SELECT 1
            FROM base step
            WHERE step.actor_id = a.actor_id
              AND step.event_name = 'membership_payment_success'
              AND EXISTS (
                SELECT 1
                FROM base plan_step
                WHERE plan_step.actor_id = a.actor_id
                  AND plan_step.event_name IN ('membership_plan_click', 'click_subscribe')
                  AND plan_step.created_at <= step.created_at
                  AND EXISTS (
                    SELECT 1
                    FROM base membership_step
                    WHERE membership_step.actor_id = a.actor_id
                      AND (
                        (membership_step.event_name = 'page_view' AND COALESCE(membership_step.page_key, membership_step.properties->>'page_key') = 'membership')
                        OR membership_step.event_name = 'view_membership_page'
                      )
                      AND membership_step.created_at <= plan_step.created_at
                      AND EXISTS (
                        SELECT 1
                        FROM base upgrade_step
                        WHERE upgrade_step.actor_id = a.actor_id
                          AND upgrade_step.event_name = 'upgrade_modal_view'
                          AND upgrade_step.created_at <= membership_step.created_at
                          AND EXISTS (
                            SELECT 1
                            FROM base consume_step
                            WHERE consume_step.actor_id = a.actor_id
                              AND ${legacyMembershipConsumeCondition.replaceAll('ae.', 'consume_step.')}
                              AND consume_step.created_at <= upgrade_step.created_at
                              AND EXISTS (
                                SELECT 1
                                FROM base click_step
                                WHERE click_step.actor_id = a.actor_id
                                  AND ${legacyMembershipClickCondition.replaceAll('ae.', 'click_step.')}
                                  AND click_step.created_at <= consume_step.created_at
                                  AND EXISTS (
                                    SELECT 1
                                    FROM base exposure_step
                                    WHERE exposure_step.actor_id = a.actor_id
                                      AND ${legacyMembershipFeatureCondition.replaceAll('ae.', 'exposure_step.')}
                                      AND exposure_step.created_at <= click_step.created_at
                                  )
                              )
                          )
                      )
                  )
              )
          ) AS has_membership_payment_success
        FROM actors a
      ),
      step_uv AS (
        SELECT 'free_feature_exposure' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_free_feature_exposure
        UNION ALL
        SELECT 'free_feature_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_free_feature_click
        UNION ALL
        SELECT 'consume_or_limit' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_consume_or_limit
        UNION ALL
        SELECT 'upgrade_modal_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_upgrade_modal_view
        UNION ALL
        SELECT 'membership_page_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_membership_page_view
        UNION ALL
        SELECT 'membership_plan_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_membership_plan_click
        UNION ALL
        SELECT 'membership_payment_success' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE has_membership_payment_success
      ),
      step_pv AS (
        SELECT 'free_feature_exposure' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_free_feature_exposure
          AND ${legacyMembershipFeatureCondition}
        UNION ALL
        SELECT 'free_feature_click' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_free_feature_click
          AND ${legacyMembershipClickCondition}
        UNION ALL
        SELECT 'consume_or_limit' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_consume_or_limit
          AND ${legacyMembershipConsumeCondition}
        UNION ALL
        SELECT 'upgrade_modal_view' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_upgrade_modal_view
          AND event_name = 'upgrade_modal_view'
        UNION ALL
        SELECT 'membership_page_view' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_membership_page_view
          AND (
            (event_name = 'page_view' AND COALESCE(page_key, properties->>'page_key') = 'membership')
            OR event_name = 'view_membership_page'
          )
        UNION ALL
        SELECT 'membership_plan_click' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_membership_plan_click
          AND event_name IN ('membership_plan_click', 'click_subscribe')
        UNION ALL
        SELECT 'membership_payment_success' AS step_id, COUNT(*) AS pv
        FROM base
        INNER JOIN actor_steps ON actor_steps.actor_id = base.actor_id
        WHERE actor_steps.has_membership_payment_success
          AND event_name = 'membership_payment_success'
      )
      SELECT step_uv.step_id, step_uv.uv, COALESCE(step_pv.pv, 0) AS pv
      FROM step_uv
      LEFT JOIN step_pv USING (step_id)
    `;

    const copilotSummaryQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_submit') AS submit_uv,
        COUNT(*) FILTER (WHERE event_name = 'copilot_hero_submit') AS submit_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_success') AS success_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_submit' AND user_id IS NULL) AS guest_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_submit' AND user_id IS NOT NULL) AS logged_in_uv,
        COUNT(DISTINCT actor_id) FILTER (
          WHERE event_name = 'copilot_hero_submit'
            AND COALESCE(properties->>'has_resume', 'false') = 'true'
        ) AS with_resume_uv
      FROM base
    `;

    const copilotDirectionLabel = copilotDirectionLabelExpr();
    const copilotPositionTypeLabel = copilotPositionTypeLabelExpr();
    const copilotDirectionValid = copilotDirectionValidCondition();

    const copilotDirectionQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        ${copilotDirectionLabel} AS label,
        COUNT(*) AS pv,
        COUNT(DISTINCT actor_id) AS uv
      FROM base
      WHERE event_name = 'copilot_hero_submit'
        AND ${copilotDirectionValid}
      GROUP BY 1
      ORDER BY uv DESC, pv DESC
      LIMIT 10
    `;

    const copilotPositionTypeQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        ${copilotPositionTypeLabel} AS label,
        COUNT(*) AS pv,
        COUNT(DISTINCT actor_id) AS uv
      FROM base
      WHERE event_name = 'copilot_hero_submit'
      GROUP BY 1
      ORDER BY uv DESC, pv DESC
      LIMIT 10
    `;

    const copilotMatrixQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        ${copilotDirectionLabel} AS job_direction,
        ${copilotPositionTypeLabel} AS position_type,
        COUNT(*) AS pv,
        COUNT(DISTINCT actor_id) AS uv
      FROM base
      WHERE event_name = 'copilot_hero_submit'
        AND ${copilotDirectionValid}
      GROUP BY 1, 2
      ORDER BY uv DESC, pv DESC
      LIMIT 12
    `;

    const copilotTrendQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        DATE(created_at) AS date,
        COUNT(*) FILTER (WHERE event_name = 'copilot_hero_submit') AS submit_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'copilot_hero_submit') AS submit_uv
      FROM base
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const membershipExperienceQuery = `
      WITH base AS (
        SELECT
          ${actorExpr('ae')} AS actor_id,
          ae.*,
          CASE
            WHEN event_name = 'click_save_job' THEN 'favorite'
            WHEN event_name = 'analyze_resume' THEN 'resume_ai_suggestion'
            WHEN event_name LIKE 'resume_assistant_%' THEN COALESCE(feature_key, properties->>'feature_key', 'resume_assistant_framework')
            WHEN event_name IN ('membership_plan_click', 'click_subscribe') THEN
              CASE
                WHEN COALESCE(properties->>'plan_id', '') = 'trial_week_lite' THEN 'membership_plan_trial_week'
                WHEN COALESCE(properties->>'plan_id', '') = 'club_go_quarterly' THEN 'membership_plan_quarter'
                WHEN COALESCE(properties->>'plan_id', '') = 'goo_plus_yearly' THEN 'membership_plan_year'
                ELSE 'membership_center'
              END
            WHEN event_name = 'view_membership_page' THEN 'membership_center'
            WHEN event_name = 'page_view' AND COALESCE(page_key, properties->>'page_key') = 'membership' THEN 'membership_center'
            ELSE COALESCE(feature_key, properties->>'feature_key')
          END AS normalized_feature_key,
          CASE
            WHEN event_name = 'click_save_job' THEN 'feature_click'
            WHEN event_name = 'analyze_resume' THEN 'feature_click'
            WHEN event_name = 'resume_assistant_open' THEN 'feature_exposure'
            WHEN event_name IN (
              'resume_assistant_generate_click',
              'resume_assistant_refresh_click',
              'resume_assistant_polish_click',
              'resume_assistant_interview_expand_click',
              'resume_assistant_mock_answer_click'
            ) THEN 'feature_click'
            WHEN event_name IN ('resume_assistant_generate_success', 'resume_assistant_polish_success') THEN 'feature_success'
            WHEN event_name = 'resume_assistant_upgrade_view' THEN 'upgrade_modal_view'
            WHEN event_name = 'resume_assistant_upgrade_click' THEN 'upgrade_cta_click'
            WHEN event_name IN ('membership_plan_click', 'click_subscribe') THEN 'membership_plan_click'
            WHEN event_name = 'view_membership_page' THEN 'feature_exposure'
            WHEN event_name = 'page_view' AND COALESCE(page_key, properties->>'page_key') = 'membership' THEN 'feature_exposure'
            ELSE event_name
          END AS normalized_event_name
        FROM analytics_events ae
        WHERE ${dateFilter}
          AND ${getSegmentFilter('free', 'ae')}
      )
      SELECT
        normalized_feature_key AS feature_key,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'feature_exposure') AS exposure_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'feature_click') AS click_uv,
        COUNT(*) FILTER (WHERE normalized_event_name = 'feature_click') AS click_pv,
        COUNT(*) FILTER (WHERE normalized_event_name = 'feature_consume') AS consume_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'feature_success') AS success_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'feature_limit_reached') AS limit_reached_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'upgrade_modal_view') AS upgrade_modal_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'upgrade_cta_click') AS upgrade_cta_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE normalized_event_name = 'membership_plan_click') AS pay_click_uv,
        COUNT(*) FILTER (WHERE normalized_event_name = 'membership_plan_click') AS pay_click_pv
      FROM base
      WHERE normalized_feature_key IN (${FEATURE_KEYS.map((_, index) => `$${index + 1}`).join(', ')})
      GROUP BY normalized_feature_key
      ORDER BY click_pv DESC NULLS LAST, exposure_uv DESC NULLS LAST
    `;

    const resumeAssistantQuery = `
      WITH base AS (
        SELECT
          ${actorExpr('ae')} AS actor_id,
          ae.*
        FROM analytics_events ae
        WHERE ${dateFilter}
          AND ${getSegmentFilter('free', 'ae')}
      ),
      actor_steps AS (
        SELECT
          actor_id,
          MIN(created_at) FILTER (WHERE event_name = 'resume_assistant_upgrade_click') AS upgrade_click_at,
          MIN(created_at) FILTER (WHERE event_name = 'membership_payment_success') AS payment_success_at
        FROM base
        GROUP BY actor_id
      )
      SELECT
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_open') AS open_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_generate_click') AS framework_click_uv,
        COUNT(*) FILTER (WHERE event_name = 'resume_assistant_generate_click') AS framework_click_pv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_generate_success') AS framework_success_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_refresh_click') AS refresh_uv,
        COUNT(DISTINCT actor_id) FILTER (
          WHERE event_name IN ('resume_assistant_interview_expand_click', 'resume_assistant_polish_success')
            AND COALESCE(feature_key, properties->>'feature_key') = 'resume_assistant_interview'
        ) AS interview_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_upgrade_view') AS upgrade_modal_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_upgrade_click') AS upgrade_click_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_polish_click') AS polish_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE event_name = 'resume_assistant_mock_answer_click') AS mock_answer_uv,
        (
          SELECT COUNT(*)
          FROM actor_steps
          WHERE upgrade_click_at IS NOT NULL
            AND payment_success_at IS NOT NULL
            AND payment_success_at >= upgrade_click_at
        ) AS payment_success_uv
      FROM base
    `;

    const trendQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        DATE(created_at) AS date,
        COUNT(DISTINCT actor_id) AS uv,
        COUNT(*) AS pv
      FROM base
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const paymentTruthQuery = `
      SELECT
        plan_id,
        COUNT(*) AS completed_orders,
        COUNT(DISTINCT user_id) AS completed_users
      FROM payment_records
      WHERE status = 'completed'
        AND ${period === 'day'
          ? "created_at >= NOW() - INTERVAL '24 hours'"
          : period === 'month'
            ? "created_at >= NOW() - INTERVAL '30 days'"
            : "created_at >= NOW() - INTERVAL '7 days'"}
      GROUP BY plan_id
    `;

    const [
      overviewRows,
      jobFunnelRows,
      jobBundleFunnelRows,
      monetizationFunnelRows,
      copilotSummaryRows,
      copilotDirectionRows,
      copilotPositionTypeRows,
      copilotMatrixRows,
      copilotTrendRows,
      membershipRows,
      resumeAssistantRows,
      trendRows,
      paymentTruthRows,
    ] = await Promise.all([
      neonHelper.query(overviewQuery),
      neonHelper.query(jobFunnelQuery),
      neonHelper.query(jobBundleFunnelQuery),
      neonHelper.query(monetizationFunnelQuery, FEATURE_KEYS),
      neonHelper.query(copilotSummaryQuery),
      neonHelper.query(copilotDirectionQuery),
      neonHelper.query(copilotPositionTypeQuery),
      neonHelper.query(copilotMatrixQuery),
      neonHelper.query(copilotTrendQuery),
      neonHelper.query(membershipExperienceQuery, FEATURE_KEYS),
      neonHelper.query(resumeAssistantQuery),
      neonHelper.query(trendQuery),
      neonHelper.query(paymentTruthQuery),
    ]);

    const overviewRow = overviewRows?.[0] || {};
    const jobMap = Object.fromEntries((jobFunnelRows || []).map((row) => [row.step_id, row]));
    const jobBundleMap = Object.fromEntries((jobBundleFunnelRows || []).map((row) => [row.step_id, row]));
    const monetizationMap = Object.fromEntries((monetizationFunnelRows || []).map((row) => [row.step_id, row]));
    const paymentTruthTotalUsers = (paymentTruthRows || []).reduce((sum, row) => sum + toInt(row.completed_users), 0);
    const paymentTruthTotalOrders = (paymentTruthRows || []).reduce((sum, row) => sum + toInt(row.completed_orders), 0);

    const jobFunnel = computeStepMetrics([
      { stepId: 'landing_home_visit', label: '首页访问', uv: toInt(jobMap.landing_home_visit?.uv), pv: toInt(jobMap.landing_home_visit?.pv) },
      { stepId: 'jobs_intent', label: '求职意图', uv: toInt(jobMap.jobs_intent?.uv), pv: toInt(jobMap.jobs_intent?.pv) },
      { stepId: 'job_detail_view', label: '岗位详情', uv: toInt(jobMap.job_detail_view?.uv), pv: toInt(jobMap.job_detail_view?.pv) },
      { stepId: 'apply_init_click', label: '点击申请入口', uv: toInt(jobMap.apply_init_click?.uv), pv: toInt(jobMap.apply_init_click?.pv) },
      { stepId: 'apply_path_selected', label: '选择申请路径', uv: toInt(jobMap.apply_path_selected?.uv), pv: toInt(jobMap.apply_path_selected?.pv) },
      { stepId: 'apply_success_like', label: '申请成功信号', uv: toInt(jobMap.apply_success_like?.uv), pv: toInt(jobMap.apply_success_like?.pv) },
    ]);

    const monetizationFunnel = computeStepMetrics([
      { stepId: 'free_feature_exposure', label: '免费功能曝光', uv: toInt(monetizationMap.free_feature_exposure?.uv), pv: toInt(monetizationMap.free_feature_exposure?.pv) },
      { stepId: 'free_feature_click', label: '免费功能点击', uv: toInt(monetizationMap.free_feature_click?.uv), pv: toInt(monetizationMap.free_feature_click?.pv) },
      { stepId: 'consume_or_limit', label: '消耗额度或触达上限', uv: toInt(monetizationMap.consume_or_limit?.uv), pv: toInt(monetizationMap.consume_or_limit?.pv) },
      { stepId: 'upgrade_modal_view', label: '升级弹窗曝光', uv: toInt(monetizationMap.upgrade_modal_view?.uv), pv: toInt(monetizationMap.upgrade_modal_view?.pv) },
      { stepId: 'membership_page_view', label: '升级后会员中心访问', uv: toInt(monetizationMap.membership_page_view?.uv), pv: toInt(monetizationMap.membership_page_view?.pv) },
      { stepId: 'membership_plan_click', label: '升级后会员卡点击', uv: toInt(monetizationMap.membership_plan_click?.uv), pv: toInt(monetizationMap.membership_plan_click?.pv) },
      { stepId: 'membership_payment_success', label: '支付完成', uv: toInt(monetizationMap.membership_payment_success?.uv), pv: toInt(monetizationMap.membership_payment_success?.pv) },
    ]);

    const jobBundleFunnel = computeStepMetrics([
      { stepId: 'bundle_visit', label: '合集访问', uv: toInt(jobBundleMap.bundle_visit?.uv), pv: toInt(jobBundleMap.bundle_visit?.pv) },
      { stepId: 'bundle_job_click', label: '点击合集岗位', uv: toInt(jobBundleMap.bundle_job_click?.uv), pv: toInt(jobBundleMap.bundle_job_click?.pv) },
      { stepId: 'bundle_detail_view', label: '合集岗位详情', uv: toInt(jobBundleMap.bundle_detail_view?.uv), pv: toInt(jobBundleMap.bundle_detail_view?.pv) },
      { stepId: 'bundle_apply_click', label: '合集申请点击', uv: toInt(jobBundleMap.bundle_apply_click?.uv), pv: toInt(jobBundleMap.bundle_apply_click?.pv) },
      { stepId: 'bundle_apply_success', label: '合集申请成功信号', uv: toInt(jobBundleMap.bundle_apply_success?.uv), pv: toInt(jobBundleMap.bundle_apply_success?.pv) },
    ]);

    const copilotSummary = copilotSummaryRows?.[0] || {};
    const resumeAssistantRow = resumeAssistantRows?.[0] || {};
    const membershipFeatures = (membershipRows || []).map((row) => {
      const exposureUv = toInt(row.exposure_uv);
      const clickUv = toInt(row.click_uv);
      const clickPv = toInt(row.click_pv);
      return {
        featureKey: row.feature_key,
        label: FEATURE_LABELS[row.feature_key] || row.feature_key,
        exposureUv,
        clickUv,
        clickPv,
        consumePv: toInt(row.consume_pv),
        successUv: toInt(row.success_uv),
        limitReachedUv: toInt(row.limit_reached_uv),
        upgradeModalUv: toInt(row.upgrade_modal_uv),
        upgradeCtaUv: toInt(row.upgrade_cta_uv),
        payClickUv: toInt(row.pay_click_uv),
        payClickPv: toInt(row.pay_click_pv),
        avgClicksPerExposedUser: exposureUv > 0 ? toFloat(clickPv / exposureUv) : 0,
        avgClicksPerClickUser: clickUv > 0 ? toFloat(clickPv / clickUv) : 0,
        displayValue: metricMode === 'per_capita'
          ? (exposureUv > 0 ? toFloat(clickPv / exposureUv) : 0)
          : clickPv,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUv: toInt(overviewRow.total_uv),
          totalPv: toInt(overviewRow.total_pv),
          guestUv: toInt(overviewRow.guest_uv),
          freeUv: toInt(overviewRow.free_uv),
          memberUv: toInt(overviewRow.member_uv),
          copilotSubmitUv: toInt(overviewRow.copilot_submit_uv),
          paymentSuccessUv: segment === 'all'
            ? paymentTruthTotalUsers
            : toInt(overviewRow.payment_success_uv),
          paymentSuccessOrders: segment === 'all' ? paymentTruthTotalOrders : 0,
          metricMode,
          segment,
        },
        coreFunnels: {
          job: jobFunnel,
          jobBundle: jobBundleFunnel,
          monetization: monetizationFunnel,
        },
        copilotDemand: {
          summary: {
            submitUv: toInt(copilotSummary.submit_uv),
            submitPv: toInt(copilotSummary.submit_pv),
            successUv: toInt(copilotSummary.success_uv),
            guestUv: toInt(copilotSummary.guest_uv),
            loggedInUv: toInt(copilotSummary.logged_in_uv),
            withResumeUv: toInt(copilotSummary.with_resume_uv),
          },
          topDirections: (copilotDirectionRows || []).map((row) => ({ label: row.label, uv: toInt(row.uv), pv: toInt(row.pv) })),
          positionTypes: (copilotPositionTypeRows || []).map((row) => ({ label: row.label, uv: toInt(row.uv), pv: toInt(row.pv) })),
          matrix: (copilotMatrixRows || []).map((row) => ({
            jobDirection: row.job_direction,
            positionType: row.position_type,
            uv: toInt(row.uv),
            pv: toInt(row.pv),
          })),
          trend: (copilotTrendRows || []).map((row) => ({
            date: row.date,
            submitUv: toInt(row.submit_uv),
            submitPv: toInt(row.submit_pv),
          })),
        },
        membershipExperience: {
          summary: {
            exposureUv: membershipFeatures.reduce((sum, item) => sum + item.exposureUv, 0),
            clickUv: membershipFeatures.reduce((sum, item) => sum + item.clickUv, 0),
            clickPv: membershipFeatures.reduce((sum, item) => sum + item.clickPv, 0),
            paymentCompletedUsers: toInt(monetizationMap.membership_payment_success?.uv),
          },
          features: membershipFeatures,
        },
        resumeAssistant: {
          openUv: toInt(resumeAssistantRow.open_uv),
          frameworkClickUv: toInt(resumeAssistantRow.framework_click_uv),
          frameworkClickPv: toInt(resumeAssistantRow.framework_click_pv),
          frameworkSuccessUv: toInt(resumeAssistantRow.framework_success_uv),
          refreshUv: toInt(resumeAssistantRow.refresh_uv),
          interviewUv: toInt(resumeAssistantRow.interview_uv),
          upgradeModalUv: toInt(resumeAssistantRow.upgrade_modal_uv),
          upgradeClickUv: toInt(resumeAssistantRow.upgrade_click_uv),
          polishUv: toInt(resumeAssistantRow.polish_uv),
          mockAnswerUv: toInt(resumeAssistantRow.mock_answer_uv),
          paymentSuccessUv: toInt(resumeAssistantRow.payment_success_uv),
        },
        trend: (trendRows || []).map((row) => ({
          date: row.date,
          uv: toInt(row.uv),
          pv: toInt(row.pv),
        })),
        paymentTruth: (paymentTruthRows || []).map((row) => ({
          planId: row.plan_id,
          completedOrders: toInt(row.completed_orders),
          completedUsers: toInt(row.completed_users),
        })),
      }
    });
  } catch (error) {
    console.error('[Analytics Stats] Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
