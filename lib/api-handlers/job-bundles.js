import neonHelper from '../../server-utils/dal/neon-helper.js';
import userHelper from '../../server-utils/user-helper.js';
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js';
import { deriveMembershipCapabilities } from '../shared/membership.js';

function normalizeBundleJobIds(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return normalizeBundleJobIds(parsed);
        } catch (_error) {
            // Fall through for legacy comma-separated values.
        }
        return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }

    return [];
}

function normalizeEmails(value) {
    const source = Array.isArray(value) ? value : typeof value === 'string' ? (() => {
        try { return JSON.parse(value) } catch { return value.split(/[\n,;]+/) }
    })() : []
    return Array.isArray(source)
        ? source.map((email) => String(email || '').trim().toLowerCase()).filter(Boolean)
        : []
}

function normalizeUserIds(value) {
    const source = Array.isArray(value) ? value : typeof value === 'string' ? (() => {
        try { return JSON.parse(value) } catch { return value.split(/[\n,;]+/) }
    })() : []
    return Array.isArray(source)
        ? [...new Set(source.map((id) => String(id || '').trim()).filter(Boolean))]
        : []
}

function normalizeCareerItems(value) {
    const source = Array.isArray(value) ? value : typeof value === 'string' ? (() => {
        try { return JSON.parse(value) } catch { return [] }
    })() : []
    return Array.isArray(source)
        ? source.map((item, index) => ({
            video_id: String(item?.video_id || item?.videoId || '').trim(),
            guidance: String(item?.guidance || item?.note || '').trim(),
            sort_order: Number.isFinite(Number(item?.sort_order)) ? Number(item.sort_order) : index
        })).filter((item) => item.video_id)
        : []
}

function getUserId(user) {
    return String(user?.userId || user?.user_id || user?.id || '')
}

async function resolveUser(req) {
    const token = extractToken(req)
    if (!token) return null
    const payload = verifyToken(token)
    if (!payload?.userId) return null
    try {
        return await userHelper.getUserById(payload.userId)
    } catch {
        return null
    }
}

function getBundleAccess(bundle, user, { allowUnauthenticatedLoginPrompt = false } = {}) {
    const visibility = String(bundle?.visibility || 'public')
    if (visibility === 'admin') return { visible: false, locked: true }
    if (visibility === 'specified') {
        const userId = getUserId(user)
        const allowedUserIds = normalizeUserIds(bundle?.allowed_user_ids)
        const email = String(user?.email || '').trim().toLowerCase()
        if (!userId && !email) {
            return allowUnauthenticatedLoginPrompt
                ? { visible: true, locked: true, requires_login: true }
                : { visible: false, locked: true }
        }
        const isAllowed = allowedUserIds.length > 0
            ? Boolean(userId && allowedUserIds.includes(userId))
            : Boolean(email && normalizeEmails(bundle?.allowed_emails).includes(email))
        return { visible: isAllowed, locked: false }
    }
    if (visibility === 'member') {
        return { visible: true, locked: !deriveMembershipCapabilities(user).isActive }
    }
    return { visible: true, locked: false }
}

function isBundleWithinSchedule(bundle, now = new Date()) {
    if (bundle?.start_time && new Date(bundle.start_time) > now) return false
    if (bundle?.end_time && new Date(bundle.end_time) < now) return false
    return true
}

function buildLockedBundlePayload(bundle, access) {
    return {
        id: bundle.id,
        title: bundle.title || '',
        subtitle: bundle.subtitle || '',
        visibility: bundle.visibility || 'member',
        is_active: Boolean(bundle.is_active),
        access,
        job_ids: [],
        career_items: []
    }
}

function buildLoginRequiredBundlePayload(bundle, access) {
    return {
        id: bundle.id,
        visibility: bundle.visibility || 'specified',
        is_active: Boolean(bundle.is_active),
        access,
        job_ids: [],
        career_items: []
    }
}

function createAutomaticGrowthRecord({ eventKey, eventType, content }) {
    return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        event_key: eventKey,
        event_type: eventType,
        content,
        created_at: new Date().toISOString()
    }
}

async function hydrateCareerItems(bundle) {
    const items = normalizeCareerItems(bundle?.career_items)
    if (items.length === 0) {
        bundle.career_items = []
        return bundle
    }
    const ids = items.map((item) => item.video_id)
    const rows = await neonHelper.query(
        `SELECT video_id, module_key, video_title, description, category, difficulty_level,
                access_tier, duration_ms, cover_image_hash
           FROM corporate_english_module_videos
          WHERE video_id = ANY($1) AND deleted_at IS NULL AND status = 'published'`,
        [ids]
    )
    const byId = new Map((rows || []).map((row) => [String(row.video_id), row]))
    bundle.career_items = items.map((item) => {
        const video = byId.get(item.video_id)
        if (!video) return null
        return {
            ...item,
            video_id: item.video_id,
            title: video.video_title,
            description: video.description || '',
            module_key: video.module_key,
            category: video.category || '',
            difficulty_level: video.difficulty_level || '',
            duration_ms: Number(video.duration_ms || 0),
            access_tier: video.access_tier === 'free' ? 'free' : 'vip',
            href: `/careerlearning/watch/module/${encodeURIComponent(video.video_id)}`,
            cover_image_url: `/api/corporate-english-public?resource=cover-image&ownerType=module_video&ownerId=${encodeURIComponent(video.video_id)}&variant=thumb${video.cover_image_hash ? `&v=${encodeURIComponent(String(video.cover_image_hash).slice(0, 16))}` : ''}`
        }
    }).filter(Boolean)
    return bundle
}

async function getProgress(bundleId, userId) {
    const rows = await neonHelper.query(
        `SELECT completed_video_ids, growth_records, updated_at
           FROM job_bundle_user_progress
          WHERE bundle_id = $1 AND user_id = $2`,
        [bundleId, userId]
    )
    const row = rows?.[0]
    return {
        completed_video_ids: Array.isArray(row?.completed_video_ids) ? row.completed_video_ids : [],
        growth_records: Array.isArray(row?.growth_records) ? row.growth_records : [],
        updated_at: row?.updated_at || null
    }
}

async function getPublicEligibleJobIdSet(jobIds = []) {
    const ids = normalizeBundleJobIds(jobIds);
    if (ids.length === 0) return new Set();

    const jobsResult = await neonHelper.query(
        `SELECT job_id FROM jobs WHERE job_id = ANY($1) AND is_approved = true AND status = 'active'`,
        [ids]
    );

    return new Set((jobsResult || []).map((row) => String(row.job_id)));
}

async function applyPublicJobFilter(bundle) {
    const ids = normalizeBundleJobIds(bundle?.job_ids);
    if (ids.length === 0) {
        bundle.job_ids = [];
        return bundle;
    }

    const eligibleIds = await getPublicEligibleJobIdSet(ids);
    bundle.job_ids = ids.filter((jobId) => eligibleIds.has(jobId));
    return bundle;
}

export default async function jobBundlesHandler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Cache only anonymous GET responses. Personalized bundles and progress are never shared through CDN.
    if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'private, no-store');
    }

    try {
        if (req.method === 'GET') {
            const { id, is_active } = req.query;
            const user = await resolveUser(req)

            if (!neonHelper.isConfigured) {
                return res.status(503).json({ error: 'Database not configured' });
            }

            if (id) {
                // Fetch by ID — return as array so frontend shape is consistent with list endpoint.
                const result = await neonHelper.query(
                    'SELECT * FROM job_bundles WHERE id = $1 AND is_active = true',
                    [id]
                );
                if (!result || result.length === 0) {
                    return res.status(200).json({ success: true, data: [] });
                }
                const bundle = result[0];
                if (!isBundleWithinSchedule(bundle)) {
                    return res.status(404).json({ success: true, data: [] });
                }
                const access = getBundleAccess(bundle, user, { allowUnauthenticatedLoginPrompt: true })
                if (!access.visible) {
                    return res.status(404).json({ success: true, data: [] });
                }
                if (access.requires_login) {
                    return res.status(200).json({ success: true, data: [buildLoginRequiredBundlePayload(bundle, access)] })
                }
                if (access.locked) {
                    return res.status(200).json({ success: true, data: [buildLockedBundlePayload(bundle, access)] })
                }
                await applyPublicJobFilter(bundle);
                await hydrateCareerItems(bundle)
                const userId = getUserId(user)
                const progress = userId ? await getProgress(bundle.id, userId) : null
                return res.status(200).json({ success: true, data: [{ ...bundle, access, progress }] });
            }

            let query = 'SELECT * FROM job_bundles';
            const params = [];
            const conditions = [];

            if (is_active !== undefined) {
                conditions.push(`is_active = $${params.length + 1}`);
                params.push(is_active === 'true');
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }

            query += ' ORDER BY priority ASC, created_at DESC';

            const result = await neonHelper.query(query, params);
            const bundles = result || [];
            const now = new Date();

            const validBundles = bundles.filter((bundle) => isBundleWithinSchedule(bundle, now));

            // Filter unapproved jobs from each bundle
            for (let b of validBundles) {
                await applyPublicJobFilter(b);
            }

            const visibleBundles = validBundles.filter((bundle) => {
                const access = getBundleAccess(bundle, user)
                return access.visible && (Array.isArray(bundle.job_ids) && bundle.job_ids.length > 0 || normalizeCareerItems(bundle.career_items).length > 0)
            });

            return res.status(200).json({ success: true, data: visibleBundles });
        }

        if (req.method === 'POST' && req.query.action === 'progress') {
            if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })
            const user = await resolveUser(req)
            const userId = getUserId(user)
            if (!userId) return res.status(401).json({ success: false, error: '请先登录后记录学习进度' })

            const bundleId = Number(req.body?.bundle_id || req.body?.bundleId)
            if (!Number.isInteger(bundleId) || bundleId <= 0) return res.status(400).json({ success: false, error: 'Invalid bundle id' })
            const rows = await neonHelper.query('SELECT * FROM job_bundles WHERE id = $1 AND is_active = true', [bundleId])
            const bundle = rows?.[0]
            if (!bundle || !getBundleAccess(bundle, user).visible) return res.status(404).json({ success: false, error: '组合不存在或无权限访问' })
            if (!isBundleWithinSchedule(bundle)) return res.status(404).json({ success: false, error: '该组合暂未开放或已结束' })

            const existing = await getProgress(bundleId, userId)
            const action = String(req.body?.progress_action || '')
            let completedVideoIds = [...new Set(existing.completed_video_ids.map((item) => String(item)))]
            let growthRecords = Array.isArray(existing.growth_records) ? existing.growth_records : []

            if (action === 'toggle_video') {
                const videoId = String(req.body?.video_id || req.body?.videoId || '').trim()
                const validIds = new Set(normalizeCareerItems(bundle.career_items).map((item) => item.video_id))
                if (!videoId || !validIds.has(videoId)) return res.status(400).json({ success: false, error: '该视频不属于此成长路径' })
                completedVideoIds = completedVideoIds.includes(videoId)
                    ? completedVideoIds.filter((item) => item !== videoId)
                    : [...completedVideoIds, videoId]
                // 只更新完成状态，不能用读取时的旧日志回写，避免与自动学习记录并发时丢失历史。
                const result = await neonHelper.query(
                    `INSERT INTO job_bundle_user_progress (bundle_id, user_id, completed_video_ids, growth_records, updated_at)
                     VALUES ($1, $2, $3::jsonb, '[]'::jsonb, NOW())
                     ON CONFLICT (bundle_id, user_id)
                     DO UPDATE SET completed_video_ids = EXCLUDED.completed_video_ids,
                                   updated_at = NOW()
                     RETURNING completed_video_ids, growth_records, updated_at`,
                    [bundleId, userId, JSON.stringify(completedVideoIds)]
                )
                return res.status(200).json({ success: true, progress: result?.[0] || { completed_video_ids: completedVideoIds, growth_records: growthRecords } })
            } else if (action === 'auto_event') {
                const eventType = String(req.body?.event_type || '').trim()
                let record = null
                if (eventType === 'video_open') {
                    const videoId = String(req.body?.video_id || req.body?.videoId || '').trim()
                    const validIds = new Set(normalizeCareerItems(bundle.career_items).map((item) => item.video_id))
                    if (!videoId || !validIds.has(videoId)) return res.status(400).json({ success: false, error: '该视频不属于此准备方案' })
                    const videoRows = await neonHelper.query(
                        `SELECT video_title FROM corporate_english_module_videos
                          WHERE video_id = $1 AND deleted_at IS NULL AND status = 'published'`,
                        [videoId]
                    )
                    const videoTitle = String(videoRows?.[0]?.video_title || '一节准备内容').trim()
                    record = createAutomaticGrowthRecord({
                        eventKey: `video:${videoId}`,
                        eventType,
                        content: `今天解锁了「${videoTitle}」这节准备内容，脑袋又多装进一点远程工作装备 🧠✨`
                    })
                } else if (eventType === 'application_started') {
                    const jobId = String(req.body?.job_id || req.body?.jobId || '').trim()
                    const validIds = new Set(normalizeBundleJobIds(bundle.job_ids))
                    if (!jobId || !validIds.has(jobId)) return res.status(400).json({ success: false, error: '该岗位不属于此合集' })
                    const jobRows = await neonHelper.query(
                        `SELECT title, company FROM jobs WHERE job_id = $1 AND is_approved = true AND status = 'active'`,
                        [jobId]
                    )
                    const jobTitle = String(jobRows?.[0]?.title || '这个岗位').trim()
                    const company = String(jobRows?.[0]?.company || '').trim()
                    record = createAutomaticGrowthRecord({
                        eventKey: `application:${jobId}`,
                        eventType,
                        content: `我迈出了远程工作探索之旅的第一步，申请了「${company ? `${company} · ` : ''}${jobTitle}」，给自己鼓个掌吧 👏`
                    })
                } else {
                    return res.status(400).json({ success: false, error: 'Unsupported automatic event' })
                }
                if (record) {
                    // 事件日志采用数据库侧原子追加：用户连续打开多个内容时，后一次请求不能覆盖前一次记录。
                    const result = await neonHelper.query(
                        `INSERT INTO job_bundle_user_progress (bundle_id, user_id, completed_video_ids, growth_records, updated_at)
                         VALUES ($1, $2, '[]'::jsonb, $3::jsonb, NOW())
                         ON CONFLICT (bundle_id, user_id)
                         DO UPDATE SET growth_records = CASE
                               WHEN EXISTS (
                                   SELECT 1
                                     FROM jsonb_array_elements(COALESCE(job_bundle_user_progress.growth_records, '[]'::jsonb)) AS entry
                                    WHERE entry->>'event_key' = $4
                               ) THEN job_bundle_user_progress.growth_records
                               ELSE ($3::jsonb || COALESCE(job_bundle_user_progress.growth_records, '[]'::jsonb))
                             END,
                             updated_at = NOW()
                         RETURNING completed_video_ids, growth_records, updated_at`,
                        [bundleId, userId, JSON.stringify([record]), record.event_key]
                    )
                    return res.status(200).json({ success: true, progress: result?.[0] || existing })
                }
            } else if (action === 'add_record') {
                const content = String(req.body?.content || '').trim().slice(0, 2000)
                if (!content) return res.status(400).json({ success: false, error: '请输入本次申请或成长记录' })
                growthRecords = [{ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, content, created_at: new Date().toISOString() }, ...growthRecords].slice(0, 100)
            } else {
                return res.status(400).json({ success: false, error: 'Unsupported progress action' })
            }

            const result = await neonHelper.query(
                `INSERT INTO job_bundle_user_progress (bundle_id, user_id, completed_video_ids, growth_records, updated_at)
                 VALUES ($1, $2, $3::jsonb, $4::jsonb, NOW())
                 ON CONFLICT (bundle_id, user_id)
                 DO UPDATE SET completed_video_ids = EXCLUDED.completed_video_ids,
                               growth_records = EXCLUDED.growth_records,
                               updated_at = NOW()
                 RETURNING completed_video_ids, growth_records, updated_at`,
                [bundleId, userId, JSON.stringify(completedVideoIds), JSON.stringify(growthRecords)]
            )
            return res.status(200).json({ success: true, progress: result?.[0] || { completed_video_ids: completedVideoIds, growth_records: growthRecords } })
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('[Public JobBundles] API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
