
import neonHelper from '../../server-utils/dal/neon-helper.js';
import userHelper from '../../server-utils/user-helper.js';
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js';
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js';

const MAX_ALLOWED_USERS = 200;
const USER_SEARCH_LIMIT = 12;
const JOB_SEARCH_LIMIT = 20;
const MAX_BUNDLE_JOBS = 100;

function isLocalDevRuntime() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production';
}

function isAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  return Boolean(
    user?.roles?.admin ||
    user?.roles?.super_admin ||
    SUPER_ADMIN_EMAILS.includes(email) ||
    (isLocalDevRuntime() && email === 'test_admin@haigoo.com')
  );
}

async function requireAdmin(req, res) {
  const token = extractToken(req);
  const payload = token ? verifyToken(token) : null;
  const user = payload?.userId ? await userHelper.getUserById(payload.userId) : null;
  if (!isAdminUser(user)) {
    res.status(403).json({ success: false, error: '无权管理职位组合' });
    return null;
  }
  return user;
}

function normalizeAllowedEmails(value) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,;]+/) : []
  return [...new Set(source
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))]
}

function normalizeAllowedUserIds(value) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? (() => {
    try { return JSON.parse(value); } catch { return value.split(/[\n,;]+/); }
  })() : [];
  return [...new Set((Array.isArray(source) ? source : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))].slice(0, MAX_ALLOWED_USERS);
}

function normalizeJobIds(value) {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? (() => {
    try { return JSON.parse(value); } catch { return value.split(/[\n,;]+/); }
  })() : [];
  return [...new Set((Array.isArray(source) ? source : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean))].slice(0, MAX_BUNDLE_JOBS);
}

function normalizeQueryIds(value) {
  if (!value) return [];
  try {
    return normalizeJobIds(JSON.parse(String(value)));
  } catch {
    return normalizeJobIds(String(value));
  }
}

async function findPublishableJobs({ ids = [], search = '', limit = JOB_SEARCH_LIMIT } = {}) {
  const normalizedIds = normalizeJobIds(ids);
  const keyword = String(search || '').trim();
  const safeLimit = Math.min(Math.max(1, Number(limit) || JOB_SEARCH_LIMIT), JOB_SEARCH_LIMIT);
  const conditions = ['is_approved = true', "status = 'active'"];
  const params = [];

  if (normalizedIds.length > 0) {
    params.push(normalizedIds);
    conditions.push(`job_id = ANY($${params.length})`);
  } else if (keyword) {
    params.push(`%${keyword.replace(/[\\%_]/g, '\\$&')}%`);
    conditions.push(`(title ILIKE $${params.length} ESCAPE '\\' OR company ILIKE $${params.length} ESCAPE '\\')`);
  } else {
    return [];
  }

  params.push(safeLimit);
  const rows = await neonHelper.query(
    `SELECT job_id AS id, title, company, experience_level AS "experienceLevel", translations
       FROM jobs
      WHERE ${conditions.join(' AND ')}
      ORDER BY published_at DESC NULLS LAST
      LIMIT $${params.length}`,
    params
  );
  return rows || [];
}

async function assertPublishableJobIds(value) {
  const jobIds = normalizeJobIds(value);
  if (jobIds.length === 0) return jobIds;
  const rows = await findPublishableJobs({ ids: jobIds, limit: MAX_BUNDLE_JOBS });
  const validIds = new Set(rows.map((row) => String(row.id)));
  const invalidCount = jobIds.filter((id) => !validIds.has(id)).length;
  if (invalidCount > 0) {
    const error = new Error(`所选岗位中有 ${invalidCount} 个已下线、未审核或仅为本地预览数据，不能加入公开职位合集。请移除后重新保存。`);
    error.statusCode = 400;
    throw error;
  }
  return jobIds;
}

function toAllowedUser(user) {
  if (!user?.user_id || !user?.email) return null;
  return {
    user_id: String(user.user_id),
    email: String(user.email).trim().toLowerCase(),
    username: String(user.username || user.profile?.name || '').trim(),
    member_status: String(user.member_status || ''),
    member_type: String(user.member_type || '')
  };
}

async function resolveAllowedUsers(userIds, fallbackEmails = []) {
  const ids = normalizeAllowedUserIds(userIds);
  const emails = normalizeAllowedEmails(fallbackEmails);
  if (ids.length === 0 && emails.length === 0) return [];

  const rows = await neonHelper.query(
    `SELECT user_id, email, username, profile, member_status, member_type
       FROM users
      WHERE user_id = ANY($1)
         OR LOWER(email) = ANY($2)
      ORDER BY created_at DESC`,
    [ids, emails]
  );
  return (rows || []).map(toAllowedUser).filter(Boolean);
}

async function hydrateAllowedUsers(bundle) {
  const users = await resolveAllowedUsers(bundle?.allowed_user_ids, bundle?.allowed_emails);
  return {
    ...bundle,
    allowed_user_ids: users.length > 0
      ? users.map((user) => user.user_id)
      : normalizeAllowedUserIds(bundle?.allowed_user_ids),
    allowed_users: users
  };
}

async function hydrateAllowedUsersForList(bundles) {
  const allIds = [...new Set((bundles || []).flatMap((bundle) => normalizeAllowedUserIds(bundle?.allowed_user_ids)))];
  const allEmails = [...new Set((bundles || []).flatMap((bundle) => normalizeAllowedEmails(bundle?.allowed_emails)))];
  if (allIds.length === 0 && allEmails.length === 0) {
    return (bundles || []).map((bundle) => ({ ...bundle, allowed_users: [] }));
  }

  const users = await resolveAllowedUsers(allIds, allEmails);
  const byId = new Map(users.map((user) => [user.user_id, user]));
  const byEmail = new Map(users.map((user) => [user.email, user]));
  return (bundles || []).map((bundle) => {
    const matched = [
      ...normalizeAllowedUserIds(bundle?.allowed_user_ids).map((id) => byId.get(id)),
      ...normalizeAllowedEmails(bundle?.allowed_emails).map((email) => byEmail.get(email))
    ].filter(Boolean);
    const deduped = [...new Map(matched.map((user) => [user.user_id, user])).values()];
    return {
      ...bundle,
      allowed_user_ids: deduped.length > 0 ? deduped.map((user) => user.user_id) : normalizeAllowedUserIds(bundle?.allowed_user_ids),
      allowed_users: deduped
    };
  });
}

function normalizeCareerItems(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item, index) => ({
      video_id: String(item?.video_id || item?.videoId || '').trim(),
      guidance: String(item?.guidance || item?.note || '').trim().slice(0, 2000),
      sort_order: index
    }))
    .filter((item) => item.video_id)
    .slice(0, 40)
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check DB configuration
  if (!neonHelper.isConfigured) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const requester = await requireAdmin(req, res);
    if (!requester) return;

    // GET: List or Get Single
    if (req.method === 'GET') {
      const { id, is_active, resource } = req.query;

      if (resource === 'career-videos') {
        const result = await neonHelper.query(
          `SELECT video_id, module_key, video_title, description, category, difficulty_level,
                  cover_image_hash, access_tier, sort_order, published_at
             FROM corporate_english_module_videos
            WHERE deleted_at IS NULL AND status = 'published'
            ORDER BY module_key ASC, sort_order ASC, published_at DESC
            LIMIT 300`
        );
        return res.status(200).json({ success: true, data: result || [] });
      }

      if (resource === 'registered-users') {
        const search = String(req.query.search || '').trim().toLowerCase();
        if (search.length < 2) {
          return res.status(200).json({ success: true, data: [] });
        }
        const needle = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
        const result = await neonHelper.query(
          `SELECT user_id, email, username, profile, member_status, member_type
             FROM users
            WHERE COALESCE(status, 'active') = 'active'
              AND (LOWER(email) LIKE $1 ESCAPE '\\'
                   OR LOWER(COALESCE(username, '')) LIKE $1 ESCAPE '\\')
            ORDER BY last_login_at DESC NULLS LAST, created_at DESC
            LIMIT $2`,
          [needle, USER_SEARCH_LIMIT]
        );
        return res.status(200).json({ success: true, data: (result || []).map(toAllowedUser).filter(Boolean) });
      }

      if (resource === 'publishable-jobs') {
        const ids = normalizeQueryIds(req.query.ids);
        const search = String(req.query.search || '').trim();
        if (ids.length === 0 && !search) {
          return res.status(200).json({ success: true, data: [] });
        }
        const data = await findPublishableJobs({ ids, search });
        return res.status(200).json({ success: true, data });
      }

      if (id) {
        // Get Single Bundle
        const result = await neonHelper.query(
          'SELECT * FROM job_bundles WHERE id = $1',
          [id]
        );
        if (!result || result.length === 0) {
          return res.status(404).json({ error: 'Bundle not found' });
        }

        // Enrich with job details? Maybe not for admin list, but for edit view yes.
        // For simplicity, we just return the bundle. The frontend can fetch job details separately if needed.
        return res.status(200).json({ success: true, data: await hydrateAllowedUsers(result[0]) });
      }

      // List Bundles
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

      query += ' ORDER BY priority ASC, created_at DESC'; // Priority first, then newest

      const result = await neonHelper.query(query, params);
      return res.status(200).json({ success: true, data: await hydrateAllowedUsersForList(result || []) });
    }

    // POST: Create Bundle
    if (req.method === 'POST') {
      const { title, subtitle, content, job_ids, priority, start_time, end_time, visibility, is_active, allowed_user_ids, allowed_emails, career_items } = req.body;

      if (!String(title || '').trim()) {
        return res.status(400).json({ success: false, error: '请填写组合标题' });
      }

      const normalizedVisibility = ['public', 'member', 'specified', 'admin'].includes(String(visibility || 'public')) ? String(visibility || 'public') : 'public';
      const selectedUsers = await resolveAllowedUsers(allowed_user_ids, allowed_emails);
      if (normalizedVisibility === 'specified' && selectedUsers.length === 0) {
        return res.status(400).json({ success: false, error: '请通过站内搜索添加至少一位已注册用户' });
      }
      if (start_time && end_time && new Date(start_time) > new Date(end_time)) {
        return res.status(400).json({ success: false, error: '结束时间需要晚于开始时间' });
      }
      const publishableJobIds = await assertPublishableJobIds(job_ids);

      const result = await neonHelper.query(
        `INSERT INTO job_bundles 
        (title, subtitle, content, job_ids, priority, start_time, end_time, visibility, is_active, allowed_user_ids, allowed_emails, career_items)
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
        RETURNING *`,
        [
          String(title).trim().slice(0, 255),
          subtitle || '',
          content || '',
          JSON.stringify(publishableJobIds),
          Math.min(10, Math.max(1, Number(priority) || 10)),
          start_time || null,
          end_time || null,
          normalizedVisibility,
          is_active !== undefined ? is_active : true,
          JSON.stringify(selectedUsers.map((user) => user.user_id)),
          JSON.stringify(selectedUsers.map((user) => user.email)),
          JSON.stringify(normalizeCareerItems(career_items))
        ]
      );

      return res.status(201).json({ success: true, data: await hydrateAllowedUsers(result[0]) });
    }

    // PUT: Update Bundle
    if (req.method === 'PUT') {
      const { id, title, subtitle, content, job_ids, priority, start_time, end_time, visibility, is_active, allowed_user_ids, allowed_emails, career_items } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, error: '缺少组合 ID' });
      }

      const previous = await neonHelper.query('SELECT * FROM job_bundles WHERE id = $1', [id]);
      if (!previous?.[0]) return res.status(404).json({ success: false, error: '职位组合不存在' });
      const normalizedVisibility = visibility === undefined
        ? String(previous[0].visibility || 'public')
        : ['public', 'member', 'specified', 'admin'].includes(String(visibility)) ? String(visibility) : 'public';
      const selectedUsers = allowed_user_ids === undefined && allowed_emails === undefined
        ? await resolveAllowedUsers(previous[0].allowed_user_ids, previous[0].allowed_emails)
        : await resolveAllowedUsers(allowed_user_ids, allowed_emails);
      if (normalizedVisibility === 'specified' && selectedUsers.length === 0) {
        return res.status(400).json({ success: false, error: '请通过站内搜索添加至少一位已注册用户' });
      }
      const nextStart = start_time === undefined ? previous[0].start_time : start_time;
      const nextEnd = end_time === undefined ? previous[0].end_time : end_time;
      if (nextStart && nextEnd && new Date(nextStart) > new Date(nextEnd)) {
        return res.status(400).json({ success: false, error: '结束时间需要晚于开始时间' });
      }
      const publishableJobIds = job_ids === undefined ? undefined : await assertPublishableJobIds(job_ids);

      // Build dynamic update query
      const fields = [];
      const values = [];
      let idx = 1;

      if (title !== undefined) { fields.push(`title = $${idx++}`); values.push(title); }
      if (subtitle !== undefined) { fields.push(`subtitle = $${idx++}`); values.push(subtitle); }
      if (content !== undefined) { fields.push(`content = $${idx++}`); values.push(content); }
      if (publishableJobIds !== undefined) { fields.push(`job_ids = $${idx++}`); values.push(JSON.stringify(publishableJobIds)); }
      if (priority !== undefined) { fields.push(`priority = $${idx++}`); values.push(priority); }
      if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
      if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
      if (visibility !== undefined) { fields.push(`visibility = $${idx++}`); values.push(normalizedVisibility); }
      if (is_active !== undefined) { fields.push(`is_active = $${idx++}`); values.push(is_active); }
      if (allowed_user_ids !== undefined || allowed_emails !== undefined) {
        fields.push(`allowed_user_ids = $${idx++}::jsonb`); values.push(JSON.stringify(selectedUsers.map((user) => user.user_id)));
        fields.push(`allowed_emails = $${idx++}::jsonb`); values.push(JSON.stringify(selectedUsers.map((user) => user.email)));
      }
      if (career_items !== undefined) { fields.push(`career_items = $${idx++}::jsonb`); values.push(JSON.stringify(normalizeCareerItems(career_items))); }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(id);

      const query = `UPDATE job_bundles SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;

      const result = await neonHelper.query(query, values);

      if (!result || result.length === 0) {
        return res.status(404).json({ error: 'Bundle not found' });
      }

      return res.status(200).json({ success: true, data: await hydrateAllowedUsers(result[0]) });
    }

    // DELETE: Delete Bundle
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID is required' });

      await neonHelper.query('DELETE FROM job_bundles WHERE id = $1', [id]);
      return res.status(200).json({ success: true, id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[JobBundles] API Error:', error);
    return res.status(error.statusCode || 500).json({ success: false, error: error.message });
  }
}
