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
  const userSegment = `COALESCE(${alias}.user_segment, CASE WHEN ${alias}.user_id IS NULL THEN 'guest' ELSE 'free' END)`;
  switch (segment) {
    case 'guest':
      return `${userSegment} = 'guest'`;
    case 'free':
      return `${alias}.user_id IS NOT NULL AND ${userSegment} = 'free'`;
    case 'member':
      return `${alias}.user_id IS NOT NULL AND ${userSegment} = 'member'`;
    case 'all':
    default:
      return '1=1';
  }
}

function actorExpr(alias = 'ae') {
  return `COALESCE(NULLIF(${alias}.user_id, ''), ${alias}.anonymous_id)`;
}

function toInt(value) {
  return Number.parseInt(value || 0, 10) || 0;
}

function toFloat(value, digits = 2) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Number(num.toFixed(digits)) : 0;
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
        COUNT(DISTINCT actor_id) FILTER (WHERE user_id IS NULL) AS guest_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE user_id IS NOT NULL AND COALESCE(user_segment, 'free') = 'free') AS free_uv,
        COUNT(DISTINCT actor_id) FILTER (WHERE user_id IS NOT NULL AND COALESCE(user_segment, 'free') = 'member') AS member_uv,
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

    const monetizationFunnelQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter}
          AND ${getSegmentFilter('free', 'ae')}
      ),
      actor_steps AS (
        SELECT
          actor_id,
          MIN(created_at) FILTER (
            WHERE ${legacyMembershipFeatureCondition}
          ) AS free_feature_exposure_at,
          MIN(created_at) FILTER (
            WHERE ${legacyMembershipClickCondition}
          ) AS free_feature_click_at,
          MIN(created_at) FILTER (
            WHERE ${legacyMembershipConsumeCondition}
          ) AS consume_or_limit_at,
          MIN(created_at) FILTER (WHERE event_name = 'upgrade_modal_view') AS upgrade_modal_view_at,
          MIN(created_at) FILTER (
            WHERE (event_name = 'page_view' AND COALESCE(page_key, properties->>'page_key') = 'membership')
               OR event_name = 'view_membership_page'
          ) AS membership_page_view_at,
          MIN(created_at) FILTER (
            WHERE event_name IN ('membership_plan_click', 'click_subscribe')
          ) AS membership_plan_click_at,
          MIN(created_at) FILTER (WHERE event_name = 'membership_payment_success') AS membership_payment_success_at
        FROM base
        GROUP BY actor_id
      ),
      step_uv AS (
        SELECT 'free_feature_exposure' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
        UNION ALL
        SELECT 'free_feature_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
        UNION ALL
        SELECT 'consume_or_limit' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND consume_or_limit_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
          AND consume_or_limit_at >= free_feature_click_at
        UNION ALL
        SELECT 'upgrade_modal_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND consume_or_limit_at IS NOT NULL
          AND upgrade_modal_view_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
          AND consume_or_limit_at >= free_feature_click_at
          AND upgrade_modal_view_at >= consume_or_limit_at
        UNION ALL
        SELECT 'membership_page_view' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND consume_or_limit_at IS NOT NULL
          AND upgrade_modal_view_at IS NOT NULL
          AND membership_page_view_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
          AND consume_or_limit_at >= free_feature_click_at
          AND upgrade_modal_view_at >= consume_or_limit_at
          AND membership_page_view_at >= upgrade_modal_view_at
        UNION ALL
        SELECT 'membership_plan_click' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND consume_or_limit_at IS NOT NULL
          AND upgrade_modal_view_at IS NOT NULL
          AND membership_page_view_at IS NOT NULL
          AND membership_plan_click_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
          AND consume_or_limit_at >= free_feature_click_at
          AND upgrade_modal_view_at >= consume_or_limit_at
          AND membership_page_view_at >= upgrade_modal_view_at
          AND membership_plan_click_at >= membership_page_view_at
        UNION ALL
        SELECT 'membership_payment_success' AS step_id, COUNT(*) AS uv
        FROM actor_steps
        WHERE free_feature_exposure_at IS NOT NULL
          AND free_feature_click_at IS NOT NULL
          AND consume_or_limit_at IS NOT NULL
          AND upgrade_modal_view_at IS NOT NULL
          AND membership_page_view_at IS NOT NULL
          AND membership_plan_click_at IS NOT NULL
          AND membership_payment_success_at IS NOT NULL
          AND free_feature_click_at >= free_feature_exposure_at
          AND consume_or_limit_at >= free_feature_click_at
          AND upgrade_modal_view_at >= consume_or_limit_at
          AND membership_page_view_at >= upgrade_modal_view_at
          AND membership_plan_click_at >= membership_page_view_at
          AND membership_payment_success_at >= membership_plan_click_at
      ),
      step_pv AS (
        SELECT 'free_feature_exposure' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE ${legacyMembershipFeatureCondition}
        UNION ALL
        SELECT 'free_feature_click' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE ${legacyMembershipClickCondition}
        UNION ALL
        SELECT 'consume_or_limit' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE ${legacyMembershipConsumeCondition}
        UNION ALL
        SELECT 'upgrade_modal_view' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE event_name = 'upgrade_modal_view'
        UNION ALL
        SELECT 'membership_page_view' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE (event_name = 'page_view' AND COALESCE(page_key, properties->>'page_key') = 'membership')
           OR event_name = 'view_membership_page'
        UNION ALL
        SELECT 'membership_plan_click' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE event_name IN ('membership_plan_click', 'click_subscribe')
        UNION ALL
        SELECT 'membership_payment_success' AS step_id, COUNT(*) AS pv
        FROM base
        WHERE event_name = 'membership_payment_success'
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

    const copilotDirectionQuery = `
      WITH base AS (
        SELECT ${actorExpr('ae')} AS actor_id, ae.*
        FROM analytics_events ae
        WHERE ${dateFilter} AND ${segmentFilter}
      )
      SELECT
        COALESCE(properties->>'job_direction', '未填写') AS label,
        COUNT(*) AS pv,
        COUNT(DISTINCT actor_id) AS uv
      FROM base
      WHERE event_name = 'copilot_hero_submit'
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
        COALESCE(properties->>'position_type', '未填写') AS label,
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
        COALESCE(properties->>'job_direction', '未填写') AS job_direction,
        COALESCE(properties->>'position_type', '未填写') AS position_type,
        COUNT(*) AS pv,
        COUNT(DISTINCT actor_id) AS uv
      FROM base
      WHERE event_name = 'copilot_hero_submit'
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
      { stepId: 'membership_page_view', label: '会员中心访问', uv: toInt(monetizationMap.membership_page_view?.uv), pv: toInt(monetizationMap.membership_page_view?.pv) },
      { stepId: 'membership_plan_click', label: '会员卡点击', uv: toInt(monetizationMap.membership_plan_click?.uv), pv: toInt(monetizationMap.membership_plan_click?.pv) },
      { stepId: 'membership_payment_success', label: '支付完成', uv: toInt(monetizationMap.membership_payment_success?.uv), pv: toInt(monetizationMap.membership_payment_success?.pv) },
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
