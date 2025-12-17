
import neonHelper from '../server-utils/dal/neon-helper.js';
import userHelper from '../server-utils/user-helper.js';
import { extractToken, verifyToken } from '../server-utils/auth-helpers.js';
import { SUPER_ADMIN_EMAILS } from '../server-utils/admin-config.js';
import { systemSettingsService } from '../lib/services/system-settings-service.js';
import subscriptionsHandler from './admin/subscriptions.js';

async function checkUserData(req, res) {
    try {
        // Get user ID from query
        const userId = req.query.userId || '0659b622-35aa-4e16-b75b-10ea243fb255'; // Default test user

        const results = {
            userId,
            resumes: null,
            userProfile: null,
            error: null
        };

        // Check resumes table
        const resumesResult = await neonHelper.query(
            'SELECT * FROM resumes WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        results.resumes = resumesResult;

        // Check users table profile
        const usersResult = await neonHelper.query(
            'SELECT profile FROM users WHERE user_id = $1',
            [userId]
        );
        results.userProfile = usersResult?.[0]?.profile;

        res.status(200).json(results);
    } catch (error) {
        res.status(500).json({ error: error.message, stack: error.stack });
    }
}

async function handleSystemSettings(req, res) {
  try {
    if (req.method === 'GET') {
      const settings = await systemSettingsService.getAllSettings();
      return res.status(200).json({ success: true, data: settings });
    }

    if (req.method === 'POST') {
      const { key, value } = req.body;
      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }
      
      const success = await systemSettingsService.setSetting(key, value);
      if (success) {
        return res.status(200).json({ success: true });
      } else {
        return res.status(500).json({ error: 'Failed to save setting' });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('System settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function diagnoseDb(req, res) {
    const results = {
        env: {
            NODE_ENV: process.env.NODE_ENV,
            HAS_DB_URL: !!process.env.DATABASE_URL || !!process.env.NEON_DATABASE_URL,
        },
        tables: {},
        error: null
    };

    try {
        // Check tables
        const tables = ['users', 'resumes', 'user_job_matches', 'resume_stats'];

        for (const table of tables) {
            const exists = await neonHelper.tableExists(table);
            const count = exists ? await neonHelper.count(table) : null;
            results.tables[table] = { exists, count };
        }

        // Check connection by running a simple query
        const now = await neonHelper.query('SELECT NOW()');
        results.dbTime = now?.[0]?.now;

    } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
    }

    res.status(200).json(results);
}

async function runMigration(req, res) {
    const results = {
        success: false,
        message: '',
        logs: [],
        error: null
    };

    try {
        // Migration 1: user_job_matches table (Keep existing)
        const createMatchesTableSQL = `
      CREATE TABLE IF NOT EXISTS user_job_matches (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        job_id TEXT NOT NULL,
        match_score DOUBLE PRECISION NOT NULL,
        match_details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(user_id, job_id)
      );
    `;
        await neonHelper.query(createMatchesTableSQL);
        results.logs.push('Checked/Created user_job_matches table');

        // Migration 2: jobs table - Add featured, trusted, company_id columns
        // Use separate ALTER TABLE statements to handle potential failures cleanly
        const jobsColumns = [
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS can_refer BOOLEAN DEFAULT false',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_id VARCHAR(255)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_logo VARCHAR(2000)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_website VARCHAR(2000)',
            'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_description TEXT'
        ];

        for (const sql of jobsColumns) {
            await neonHelper.query(sql);
            results.logs.push(`Executed: ${sql}`);
        }

        // Migration 3: club_applications table
        const createApplicationsTableSQL = `
            CREATE TABLE IF NOT EXISTS club_applications (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255),
                experience TEXT,
                career_ideal TEXT,
                portfolio VARCHAR(2000),
                expectations TEXT,
                contribution TEXT,
                contact TEXT,
                contact_type VARCHAR(50) DEFAULT 'wechat',
                status VARCHAR(50) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await neonHelper.query(createApplicationsTableSQL);
        results.logs.push('Checked/Created club_applications table');

        // Migration 4: notifications table
        const createNotificationsTableSQL = `
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(200) NOT NULL,
                content TEXT,
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await neonHelper.query(createNotificationsTableSQL);
        // Add index safely
        try {
            await neonHelper.query('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)');
        } catch (e) { console.warn('Index creation skipped/failed', e.message); }
        
        results.logs.push('Checked/Created notifications table');

        // Migration 5: Add reply fields to feedbacks table
        try {
            await neonHelper.query('ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS reply_content TEXT');
            await neonHelper.query('ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP');
            results.logs.push('Checked/Added reply columns to feedbacks table');
        } catch (e) {
            results.logs.push(`Error adding columns: ${e.message}`);
        }

        results.success = true;
        results.message = 'Migration completed successfully';

    } catch (error) {
        results.error = error.message;
        results.stack = error.stack;
    }

    res.status(200).json(results);
}

async function getStats(req, res) {
    try {
        // Parallel queries for efficiency
        const [jobsCount, domesticJobsResult, companiesCount, usersCount, dailyJobsResult] = await Promise.all([
            neonHelper.count('jobs', { status: 'active' }),
            neonHelper.query("SELECT COUNT(*) as count FROM jobs WHERE status = 'active' AND (region = 'domestic' OR region = 'both')"),
            neonHelper.count('trusted_companies', { status: 'active' }),
            neonHelper.count('users'),
            neonHelper.query("SELECT COUNT(*) as count FROM jobs WHERE status = 'active' AND published_at >= NOW() - INTERVAL '24 hours'")
        ])

        const domesticJobsCount = domesticJobsResult && domesticJobsResult[0]
            ? parseInt(domesticJobsResult[0].count, 10)
            : 0
        
        const dailyJobsCount = dailyJobsResult && dailyJobsResult[0]
            ? parseInt(dailyJobsResult[0].count, 10)
            : 0

        return res.status(200).json({
            success: true,
            stats: {
                totalJobs: jobsCount || 0,
                domesticJobs: domesticJobsCount || 0,
                companiesCount: companiesCount || 0,
                activeUsers: usersCount || 0,
                dailyJobs: dailyJobsCount || 0
            }
        })
    } catch (error) {
        console.error('[AdminOps:Stats] Error fetching stats:', error)
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        })
    }
}

export default async function handler(req, res) {
    // CORS
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).json({});
    }

    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    const { action } = req.query;

    if (action === 'system-settings') {
        return await handleSystemSettings(req, res);
    }

    if (action === 'subscriptions') {
        return await subscriptionsHandler(req, res);
    }

    // Verify Admin Access
    const token = extractToken(req);
    const payload = token ? verifyToken(token) : null;
    const requester = payload?.userId ? await userHelper.getUserById(payload.userId) : null;
    
    const isSuperAdmin = requester?.email && SUPER_ADMIN_EMAILS.includes(requester.email);
    const isAdmin = !!(requester?.roles?.admin || isSuperAdmin);
    
    if (!isAdmin) {
        return res.status(403).json({ success: false, error: 'Forbidden: Admin access required' });
    }

    switch (action) {
        case 'check-user':
            return await checkUserData(req, res);
        case 'diagnose':
            return await diagnoseDb(req, res);
        case 'migrate':
            return await runMigration(req, res);
        case 'stats':
            return await getStats(req, res);
        case 'list_applications':
            try {
                const applications = await neonHelper.query(
                    'SELECT * FROM club_applications ORDER BY created_at DESC'
                );
                return res.status(200).json({ success: true, applications });
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        case 'delete_application':
            if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Forbidden: Super Admin only' });
            try {
                const { id } = req.body || {};
                if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
                await neonHelper.query('DELETE FROM club_applications WHERE id = $1', [id]);
                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        case 'delete_feedback':
            if (!isSuperAdmin) return res.status(403).json({ success: false, error: 'Forbidden: Super Admin only' });
            try {
                const { id } = req.body || {};
                if (!id) return res.status(400).json({ success: false, error: 'Missing id' });
                await neonHelper.query('DELETE FROM feedbacks WHERE id = $1', [id]);
                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        case 'update_application_status':
            try {
                const { id, status } = req.body || {};
                if (!id || !status) {
                    return res.status(400).json({ success: false, error: 'Missing id or status' });
                }
                
                // 1. Update status
                await neonHelper.query(
                    'UPDATE club_applications SET status = $1 WHERE id = $2',
                    [status, id]
                );

                // 2. Fetch application to get user_id
                const appResult = await neonHelper.query('SELECT user_id FROM club_applications WHERE id = $1', [id]);
                if (appResult && appResult.length > 0) {
                    const userId = appResult[0].user_id;
                    if (userId) {
                        // 2.5 Upgrade User Membership if approved
                        if (status === 'approved') {
                            const nextYear = new Date();
                            nextYear.setFullYear(nextYear.getFullYear() + 1);
                            
                            // Check if membership fields exist first (or use safe update logic)
                            // We assume fields exist as per previous migrations or we should ensure them.
                            // The DDL says: membership_level, membership_start_at, membership_expire_at were added.
                            
                            await neonHelper.query(`
                                UPDATE users 
                                SET membership_level = 'club_go', 
                                    membership_start_at = NOW(), 
                                    membership_expire_at = $1 
                                WHERE user_id = $2
                            `, [nextYear.toISOString(), userId]);
                            
                            console.log(`[AdminOps] Upgraded user ${userId} to club_go membership`);
                        }

                        // 3. Create notification
                        let title = '会员申请状态更新';
                        let content = '';
                        if (status === 'approved') {
                            content = '恭喜！您的会员申请已通过。欢迎加入海狗远程俱乐部！';
                        } else if (status === 'rejected') {
                            content = '很遗憾，您的会员申请未通过。您可以完善资料后再次尝试。';
                        } else if (status === 'contacted') {
                            content = '管理员已查看您的申请并会尽快与您联系。';
                        }

                        if (content) {
                             await neonHelper.query(
                                'INSERT INTO notifications (user_id, type, title, content) VALUES ($1, $2, $3, $4)',
                                [userId, 'application_update', title, content]
                            );
                        }
                    }
                }

                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        case 'reply_feedback':
            try {
                const { feedbackId, replyContent } = req.body || {};
                if (!feedbackId || !replyContent) {
                    return res.status(400).json({ success: false, error: 'Missing feedbackId or replyContent' });
                }

                // 1. Update feedback with reply
                await neonHelper.query(
                    'UPDATE feedbacks SET reply_content = $1, replied_at = NOW() WHERE id = $2',
                    [replyContent, feedbackId]
                );

                // 2. Fetch feedback to get user_id
                const fbResult = await neonHelper.query('SELECT user_id FROM feedbacks WHERE id = $1', [feedbackId]);
                if (fbResult && fbResult.length > 0) {
                    const userId = fbResult[0].user_id;
                    if (userId) {
                        // 3. Create notification
                        await neonHelper.query(
                            'INSERT INTO notifications (user_id, type, title, content) VALUES ($1, $2, $3, $4)',
                            [userId, 'feedback_reply', '反馈回复', `管理员回复了您的反馈：${replyContent}`]
                        );
                    }
                }

                return res.status(200).json({ success: true });
            } catch (error) {
                return res.status(500).json({ success: false, error: error.message });
            }
        default:
            return res.status(400).json({ error: 'Invalid action' });
    }
}
