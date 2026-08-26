import 'dotenv/config'
import neonHelper from '../server-utils/dal/neon-helper.js'

// This script runs only after migration 081, so use the new immutable snapshot
// column even before the application feature flag is enabled.
process.env.MINI_MATCH_FIXED_SNAPSHOT_ENABLED = 'true'
const {
  computeCareerWatchFeed,
  createFixedCareerWatchMatch,
  getCareerWatchProfile
} = await import('../lib/services/career-watch-service.js')

if (!neonHelper.isConfigured) throw new Error('Database not configured')

const rows = await neonHelper.query(
  `SELECT users.user_id, entitlements.free_assessment_used_at
     FROM users
     LEFT JOIN career_watch_profiles profiles ON profiles.user_id = users.user_id
     LEFT JOIN career_watch_feed_snapshots snapshots ON snapshots.user_id = users.user_id
     LEFT JOIN mini_career_entitlements entitlements ON entitlements.user_id = users.user_id
    WHERE (
      (profiles.status = 'active' AND jsonb_array_length(COALESCE(profiles.role_families, '[]'::jsonb)) > 0)
      OR jsonb_array_length(COALESCE(snapshots.recommendations, '[]'::jsonb)) > 0
    )
      AND jsonb_array_length(COALESCE(snapshots.fixed_recommendations, '[]'::jsonb)) = 0
      AND (
        entitlements.free_assessment_used_at IS NOT NULL
        OR NOT (
          users.member_status = 'active'
          AND (users.member_expire_at IS NULL OR users.member_expire_at > NOW())
          AND COALESCE(users.member_type, '') NOT IN ('none', 'trial_week')
        )
      )
    ORDER BY profiles.updated_at ASC`
)

let completed = 0
let skipped = 0
for (const row of rows || []) {
  const storedProfile = await getCareerWatchProfile(row.user_id)
  let profile = storedProfile
  if (!profile?.roleFamilies?.length) {
    const roleRows = await neonHelper.query(
      `SELECT role.value, COUNT(*)::int AS count
         FROM career_watch_feed_snapshots snapshots
         CROSS JOIN LATERAL jsonb_array_elements(snapshots.recommendations) recommendation
         JOIN company_job_history history
           ON history.company_id = recommendation->>'companyId' AND history.closed_at IS NULL
         CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(history.role_families, '[]'::jsonb)) role(value)
        WHERE snapshots.user_id = $1
        GROUP BY role.value
        ORDER BY count DESC, role.value ASC
        LIMIT 3`,
      [row.user_id]
    )
    const roleFamilies = (roleRows || []).map((item) => String(item.value || '')).filter(Boolean)
    if (!roleFamilies.length) {
      throw new Error(`Cannot derive a real job direction for Career Watch user ${row.user_id}`)
    }
    profile = {
      sourceMode: 'manual',
      roleFamilies,
      customRoleTerms: [],
      companyPreferences: {},
      activePreferenceKeys: [],
      toleranceMode: 'balanced',
      status: 'active',
      sourcePlatform: 'mini',
      version: 0
    }
  }
  try {
    if (row.free_assessment_used_at) {
      const computed = await computeCareerWatchFeed({
        userId: row.user_id,
        profile,
        isMember: false,
        limit: 5,
        fixedFree: true
      })
      if (computed.recommendations.length !== 5) {
        throw new Error(`Cannot persist exactly five real companies for Career Watch user ${row.user_id}`)
      }
      await neonHelper.query(
        `INSERT INTO career_watch_feed_snapshots (
           user_id, profile_version, recommendations, fixed_recommendations,
           followed_updates, empty_reason, generated_at
         ) VALUES ($1, $2, $3::jsonb, $3::jsonb, $4::jsonb, NULL, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           fixed_recommendations = EXCLUDED.fixed_recommendations`,
        [row.user_id, storedProfile?.version || 0, JSON.stringify(computed.recommendations), JSON.stringify(computed.followedUpdates)]
      )
    } else {
      await createFixedCareerWatchMatch({
        userId: row.user_id,
        input: profile,
        expectedVersion: storedProfile?.version || 0
      })
    }
    completed += 1
  } catch (error) {
    if (error?.code === 'FREE_MATCH_USED') skipped += 1
    else throw error
  }
}

console.log(JSON.stringify({ candidates: rows?.length || 0, completed, skipped }))
