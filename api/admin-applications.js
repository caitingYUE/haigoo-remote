import neonHelper from '../server-utils/dal/neon-helper.js'
import { verifyToken, extractToken } from '../server-utils/auth-helpers.js'

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    const token = extractToken(req)
    if (!token || !verifyToken(token)) {
        return res.status(401).json({ success: false, error: 'Unauthorized' })
    }

    const { action, type, page = 1, limit = 20, search } = req.query
    const offset = (parseInt(page) - 1) * parseInt(limit)

    try {
        // === 1. Stats ===
        if (action === 'stats') {
            if (!neonHelper.isConfigured) {
                 return res.status(200).json({ 
                    success: true, 
                    stats: { referral_count: 0, official_count: 0, platform_count: 0, member_count: 0 } 
                })
            }

            // Job Application Stats
            // referral: interaction_type = 'referral'
            // official: interaction_type = 'apply_redirect' AND job is from official source (is_trusted=true)
            // platform: interaction_type = 'apply_redirect' AND job is from platform source (is_trusted=false)
            const jobStatsRes = await neonHelper.query(`
                SELECT 
                  COUNT(*) FILTER (WHERE uji.interaction_type = 'referral') as referral_count,
                  COUNT(*) FILTER (WHERE uji.interaction_type = 'apply_redirect' AND j.is_trusted = true) as official_count,
                  COUNT(*) FILTER (WHERE uji.interaction_type = 'apply_redirect' AND (j.is_trusted = false OR j.is_trusted IS NULL)) as platform_count
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
            `)
            
            // Member Application Stats (Pending)
            const memberStatsRes = await neonHelper.query(`
                SELECT COUNT(*) as count FROM club_applications WHERE status = 'pending'
            `)

            return res.status(200).json({ 
                success: true, 
                stats: { 
                    referral_count: parseInt(jobStatsRes[0]?.referral_count || 0),
                    official_count: parseInt(jobStatsRes[0]?.official_count || 0),
                    platform_count: parseInt(jobStatsRes[0]?.platform_count || 0),
                    member_count: parseInt(memberStatsRes[0]?.count || 0)
                } 
            })
        }
        
        // === 2. Update Status ===
        if (action === 'update_status' && req.method === 'POST') {
             const { id, status, userId, jobId, interactionType } = req.body;

             // Member Application Update
             if (type === 'member') {
                 if (!id) return res.status(400).json({ success: false, error: 'Missing ID' });
                 await neonHelper.query(
                     'UPDATE club_applications SET status = $1, updated_at = NOW() WHERE id = $2',
                     [status, id]
                 );
                 return res.status(200).json({ success: true });
             }
             
             // Job Application Update (Referral usually)
             if (type === 'referral' || type === 'job') {
                 if (!userId || !jobId) return res.status(400).json({ success: false, error: 'Missing userId or jobId' });
                 // interactionType defaults to 'referral' if not provided, but better be safe
                 const iType = interactionType || 'referral';
                 
                 await neonHelper.query(
                     `UPDATE user_job_interactions 
                      SET status = $1, updated_at = NOW() 
                      WHERE user_id = $2 AND job_id = $3 AND interaction_type = $4`,
                     [status, userId, jobId, iType]
                 );
                 return res.status(200).json({ success: true });
             }
        }

        // === 3. List Applications ===
        
        // Case A: Member Applications
        if (type === 'member') {
            const countRes = await neonHelper.query('SELECT COUNT(*) as total FROM club_applications');
            const total = parseInt(countRes[0]?.total || 0);
            
            const listRes = await neonHelper.query(`
                SELECT ca.*, u.email, u.username, u.avatar, u.profile
                FROM club_applications ca
                LEFT JOIN users u ON ca.user_id = u.user_id
                ORDER BY ca.created_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset]);
            
            return res.status(200).json({ 
                success: true, 
                data: listRes, 
                pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } 
            });
        }

        // Case B: Job Applications (Referral, Official, Platform)
        let countQuery = '';
        let listQuery = '';
        let queryParams = [];

        if (type === 'referral') {
             // Referral
             const countRes = await neonHelper.query(
                "SELECT COUNT(*) as total FROM user_job_interactions WHERE interaction_type = 'referral'"
             );
             const total = parseInt(countRes[0]?.total || 0);

             listQuery = `
                SELECT uji.*, u.email, u.username, u.avatar,
                       j.title as job_title, j.company as job_company, j.job_id,
                       r.file_name as resume_name, r.id as resume_pk
                FROM user_job_interactions uji
                LEFT JOIN users u ON uji.user_id = u.user_id
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                LEFT JOIN resumes r ON uji.resume_id = r.resume_id
                WHERE uji.interaction_type = 'referral'
                ORDER BY uji.updated_at DESC
                LIMIT $1 OFFSET $2
             `;
             
             const listRes = await neonHelper.query(listQuery, [limit, offset]);
             
             return res.status(200).json({ 
                success: true, 
                data: listRes, 
                pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } 
             });
        } else if (type === 'official') {
             // Official (apply_redirect + is_trusted=true)
             const countRes = await neonHelper.query(`
                SELECT COUNT(*) as total 
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                WHERE uji.interaction_type = 'apply_redirect' AND j.is_trusted = true
             `);
             const total = parseInt(countRes[0]?.total || 0);

             listQuery = `
                SELECT uji.*, u.email, u.username, u.avatar,
                       j.title as job_title, j.company as job_company, j.job_id
                FROM user_job_interactions uji
                LEFT JOIN users u ON uji.user_id = u.user_id
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                WHERE uji.interaction_type = 'apply_redirect' AND j.is_trusted = true
                ORDER BY uji.updated_at DESC
                LIMIT $1 OFFSET $2
             `;
             
             const listRes = await neonHelper.query(listQuery, [limit, offset]);
             
             return res.status(200).json({ 
                success: true, 
                data: listRes, 
                pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } 
             });
        } else if (type === 'trusted_platform') {
             // Platform (apply_redirect + is_trusted=false)
             const countRes = await neonHelper.query(`
                SELECT COUNT(*) as total 
                FROM user_job_interactions uji
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                WHERE uji.interaction_type = 'apply_redirect' AND (j.is_trusted = false OR j.is_trusted IS NULL)
             `);
             const total = parseInt(countRes[0]?.total || 0);

             listQuery = `
                SELECT uji.*, u.email, u.username, u.avatar,
                       j.title as job_title, j.company as job_company, j.job_id
                FROM user_job_interactions uji
                LEFT JOIN users u ON uji.user_id = u.user_id
                LEFT JOIN jobs j ON uji.job_id = j.job_id
                WHERE uji.interaction_type = 'apply_redirect' AND (j.is_trusted = false OR j.is_trusted IS NULL)
                ORDER BY uji.updated_at DESC
                LIMIT $1 OFFSET $2
             `;
             
             const listRes = await neonHelper.query(listQuery, [limit, offset]);
             
             return res.status(200).json({ 
                success: true, 
                data: listRes, 
                pagination: { total, page: parseInt(page), totalPages: Math.ceil(total / limit) } 
             });
        }

        return res.status(400).json({ success: false, error: 'Invalid type' });

    } catch (error) {
        console.error('[Admin Applications API] Error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
}
