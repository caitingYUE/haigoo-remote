
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';
import Busboy from 'busboy';
import { parseResume } from '../services/resume-parser.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

const TALENTS_TABLE = 'talents';
const RESUMES_TABLE = 'resumes';

// Initialize table if not exists (Lazy initialization)
async function ensureTable() {
    if (!neonHelper.isConfigured) return;
    try {
        // Check if table exists
        const result = await neonHelper.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = '${TALENTS_TABLE}'
            );
        `);
        
        if (!result || !result[0] || !result[0].exists) {
            console.log(`[talent-pool] Creating ${TALENTS_TABLE} table...`);
            await neonHelper.query(`
                CREATE TABLE IF NOT EXISTS ${TALENTS_TABLE} (
                    id SERIAL PRIMARY KEY,
                    talent_id VARCHAR(255) UNIQUE NOT NULL,
                    name VARCHAR(255),
                    title VARCHAR(255),
                    email VARCHAR(255),
                    phone VARCHAR(50),
                    location VARCHAR(255),
                    years_of_experience INTEGER,
                    education JSONB DEFAULT '[]',
                    skills JSONB DEFAULT '[]',
                    tags JSONB DEFAULT '[]',
                    summary TEXT,
                    resume_id VARCHAR(255),
                    resume_url VARCHAR(2000),
                    source VARCHAR(50) DEFAULT 'admin_upload',
                    status VARCHAR(50) DEFAULT 'active',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
        }
    } catch (e) {
        console.error('[talent-pool] Table initialization failed:', e);
    }
}

// Helper to handle multipart upload
function parseMultipart(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const fields = {};
        const files = [];

        busboy.on('field', (fieldname, val) => {
            fields[fieldname] = val;
        });

        busboy.on('file', (fieldname, file, info) => {
            const { filename, encoding, mimeType } = info;
            const chunks = [];
            
            file.on('data', (data) => {
                chunks.push(data);
            });

            file.on('end', () => {
                files.push({
                    fieldname,
                    filename,
                    encoding,
                    mimeType,
                    buffer: Buffer.concat(chunks)
                });
            });
        });

        busboy.on('finish', () => {
            resolve({ fields, files });
        });

        busboy.on('error', (err) => {
            reject(err);
        });

        if (req.rawBody) {
            busboy.end(req.rawBody);
        } else {
            req.pipe(busboy);
        }
    });
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Auth check
    const token = extractToken(req);
    const payload = verifyToken(token);
    if (!payload) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!neonHelper.isConfigured) {
        return res.status(503).json({ success: false, error: 'Database not configured' });
    }

    // Ensure table exists
    await ensureTable();

    // GET: List talents
    if (req.method === 'GET') {
        try {
            const { page = 1, pageSize = 20, search, tags } = req.query;
            const limit = parseInt(pageSize);
            const offset = (parseInt(page) - 1) * limit;
            
            let whereConditions = [`status = 'active'`];
            let params = [];
            let paramIndex = 1;

            if (search) {
                whereConditions.push(`(name ILIKE $${paramIndex} OR title ILIKE $${paramIndex} OR email ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
                params.push(`%${search}%`);
                paramIndex++;
            }

            // Simple tag filtering (contains any)
            if (tags) {
                // tags is comma separated
                const tagList = tags.split(',');
                whereConditions.push(`tags ?| $${paramIndex}`);
                params.push(tagList);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
            
            const countQuery = `SELECT COUNT(*) FROM ${TALENTS_TABLE} ${whereClause}`;
            const listQuery = `
                SELECT * FROM ${TALENTS_TABLE} 
                ${whereClause} 
                ORDER BY created_at DESC 
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            const [countResult, listResult] = await Promise.all([
                neonHelper.query(countQuery, params),
                neonHelper.query(listQuery, [...params, limit, offset])
            ]);

            const total = parseInt(countResult[0].count);

            return res.status(200).json({
                success: true,
                talents: listResult,
                total,
                page: parseInt(page),
                totalPages: Math.ceil(total / limit)
            });

        } catch (e) {
            console.error('[talent-pool] List error:', e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // POST: Upload resume / Create talent
    if (req.method === 'POST') {
        try {
            // Handle Multipart
            let fields = {};
            let files = [];

            const contentType = req.headers['content-type'] || '';
            if (contentType.includes('multipart/form-data')) {
                const parsed = await parseMultipart(req);
                fields = parsed.fields;
                files = parsed.files;
            } else {
                fields = req.body;
            }

            const { action } = req.query;

            // Batch Upload Action
            if (files.length > 0) {
                const results = [];
                for (const file of files) {
                    const resumeId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const talentId = `tal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    
                    // Parse Resume
                    const { text, metadata } = await parseResume(file.buffer, file.mimeType);
                    
                    // Save to Resumes Table
                    await neonHelper.query(`
                        INSERT INTO ${RESUMES_TABLE} 
                        (resume_id, file_name, file_size, file_type, parse_status, parse_result, content_text, file_content, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
                    `, [
                        resumeId,
                        file.filename,
                        file.buffer.length,
                        file.mimeType,
                        'completed',
                        JSON.stringify(metadata),
                        text,
                        file.buffer.toString('base64') // Store content for preview
                    ]);

                    // Create Talent Entry
                    const talentData = {
                        name: metadata.name || file.filename.split('.')[0],
                        title: '', // Need manual extraction or better parser
                        email: metadata.email || '',
                        phone: metadata.phone || '',
                        skills: metadata.skills || [],
                        resumeId: resumeId
                    };

                    await neonHelper.query(`
                        INSERT INTO ${TALENTS_TABLE}
                        (talent_id, name, email, phone, skills, resume_id, source, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, $6, 'admin_upload', NOW(), NOW())
                    `, [
                        talentId,
                        talentData.name,
                        talentData.email,
                        talentData.phone,
                        JSON.stringify(talentData.skills),
                        talentData.resumeId
                    ]);

                    results.push({ talentId, name: talentData.name });
                }

                return res.status(200).json({ success: true, message: `Uploaded ${results.length} resumes`, results });
            } 
            
            // Manual Create (if no files)
            if (fields.name) {
                const talentId = `tal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                await neonHelper.query(`
                    INSERT INTO ${TALENTS_TABLE}
                    (talent_id, name, title, email, phone, skills, tags, summary, source, created_at, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', NOW(), NOW())
                `, [
                    talentId,
                    fields.name,
                    fields.title || '',
                    fields.email || '',
                    fields.phone || '',
                    JSON.stringify(fields.skills || []),
                    JSON.stringify(fields.tags || []),
                    fields.summary || ''
                ]);
                return res.status(200).json({ success: true, message: 'Talent created', talentId });
            }

            return res.status(400).json({ success: false, error: 'No file or data provided' });

        } catch (e) {
            console.error('[talent-pool] Upload error:', e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // PUT: Update Talent
    if (req.method === 'PUT') {
        try {
            const { id } = req.query; // talent_id
            const updates = req.body;

            if (!id) return res.status(400).json({ success: false, error: 'ID required' });

            // Build dynamic update query
            const allowedFields = ['name', 'title', 'email', 'phone', 'location', 'years_of_experience', 'education', 'skills', 'tags', 'summary', 'status'];
            const setClause = [];
            const params = [];
            let paramIndex = 1;

            for (const key of Object.keys(updates)) {
                if (allowedFields.includes(key)) {
                    setClause.push(`${key} = $${paramIndex}`);
                    let value = updates[key];
                    if (['education', 'skills', 'tags'].includes(key)) {
                        value = JSON.stringify(value);
                    }
                    params.push(value);
                    paramIndex++;
                }
            }
            
            setClause.push(`updated_at = NOW()`);

            if (setClause.length === 1) { // Only updated_at
                return res.status(200).json({ success: true, message: 'No changes' });
            }

            params.push(id);
            await neonHelper.query(`
                UPDATE ${TALENTS_TABLE}
                SET ${setClause.join(', ')}
                WHERE talent_id = $${paramIndex}
            `, params);

            return res.status(200).json({ success: true, message: 'Updated successfully' });

        } catch (e) {
            console.error('[talent-pool] Update error:', e);
            return res.status(500).json({ success: false, error: e.message });
        }
    }

    // DELETE: Delete Talent
    if (req.method === 'DELETE') {
        try {
            const { id } = req.query;
            if (!id) return res.status(400).json({ success: false, error: 'ID required' });

            await neonHelper.query(`DELETE FROM ${TALENTS_TABLE} WHERE talent_id = $1`, [id]);
            // Optional: Delete associated resume? Keep it for now.
            
            return res.status(200).json({ success: true, message: 'Deleted successfully' });
        } catch (e) {
             console.error('[talent-pool] Delete error:', e);
             return res.status(500).json({ success: false, error: e.message });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
}
