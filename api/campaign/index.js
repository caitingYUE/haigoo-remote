import { generateChristmasTree } from '../../lib/services/christmas-service.js';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import neonHelper from '../../server-utils/dal/neon-helper.js';
import Busboy from 'busboy';
import { saveUserResume } from '../../server-utils/resume-storage.js';
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js';

const require = createRequire(import.meta.url);

export const config = {
    api: {
        bodyParser: false,
    },
};

// Helper: Parse JSON Body manually (since bodyParser is disabled)
async function parseJsonBody(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length === 0) return {};
    try {
        return JSON.parse(Buffer.concat(chunks).toString());
    } catch (e) {
        return {};
    }
}

// Lazy load dependencies
let pdfParse, mammoth;
async function loadDependencies() {
    console.log('[Christmas] Loading dependencies...');
    if (!pdfParse) {
        try {
            pdfParse = require('pdf-parse');
            console.log('[Christmas] pdf-parse loaded');
        } catch (e) {
            console.error('[Christmas] Failed to load pdf-parse:', e);
        }
    }
    if (!mammoth) {
        try {
            mammoth = (await import('mammoth')).default;
            console.log('[Christmas] mammoth loaded');
        } catch (e) {
            console.error('[Christmas] Failed to load mammoth:', e);
        }
    }
}

// Helper: Parse Multipart Body with Busboy
async function parseMultipartWithBusboy(req) {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        let fileBuffer = null;
        let filename = '';

        busboy.on('file', (name, file, info) => {
            const { filename: fName } = info;
            filename = fName;
            const chunks = [];
            file.on('data', (data) => chunks.push(data));
            file.on('end', () => {
                fileBuffer = Buffer.concat(chunks);
            });
        });

        busboy.on('finish', () => {
            if (fileBuffer) {
                resolve({ buffer: fileBuffer, filename });
            } else {
                reject(new Error('No file found in multipart request'));
            }
        });

        busboy.on('error', (err) => reject(err));
        req.pipe(busboy);
    });
}

// Forest Handler Logic
async function handleForest(req, res) {
    if (!neonHelper.isConfigured) {
        return res.status(503).json({ error: 'Database not configured' });
    }

    // GET: Fetch forest trees (paginated)
    if (req.method === 'GET') {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 12;
        const offset = (page - 1) * limit;

        try {
            const trees = await neonHelper.query(`
                SELECT id, tree_id, tree_data, star_label, user_nickname, created_at, likes
                FROM campaign_forest
                WHERE is_public = true
                ORDER BY created_at DESC
                LIMIT $1 OFFSET $2
            `, [limit, offset]);

            // Get total count for pagination
            const countResult = await neonHelper.query(`
                SELECT COUNT(*) as total FROM campaign_forest WHERE is_public = true
            `);
            const total = parseInt(countResult[0]?.total || '0');

            return res.status(200).json({
                success: true,
                data: trees,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('[Forest API] Fetch error:', error);
            return res.status(500).json({ error: 'Failed to fetch forest' });
        }
    }

    // POST: Plant a tree (Publish)
    if (req.method === 'POST') {
        // Since we disabled bodyParser globally, we need to parse JSON manually for this specific route if it's JSON
        let body = {};
        if (req.headers['content-type']?.includes('application/json')) {
             body = await parseJsonBody(req);
        } else {
             // Should verify if req.body is already populated (it won't be due to config)
             body = req.body || {}; 
        }

        const { tree_id, tree_data, star_label, user_nickname } = body;

        if (!tree_id || !tree_data) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // Check if already exists
            const existing = await neonHelper.query(`
                SELECT id FROM campaign_forest WHERE tree_id = $1
            `, [tree_id]);

            if (existing.length > 0) {
                return res.status(409).json({ error: 'Tree already planted' });
            }

            // Create table if not exists (Lazy migration)
            await neonHelper.query(`
                CREATE TABLE IF NOT EXISTS campaign_forest (
                    id SERIAL PRIMARY KEY,
                    tree_id VARCHAR(255) UNIQUE NOT NULL,
                    tree_data JSONB NOT NULL,
                    star_label VARCHAR(100),
                    user_nickname VARCHAR(100) DEFAULT 'Anonymous',
                    is_public BOOLEAN DEFAULT true,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    likes INTEGER DEFAULT 0
                )
            `);

            // Insert
            await neonHelper.query(`
                INSERT INTO campaign_forest (tree_id, tree_data, star_label, user_nickname, is_public)
                VALUES ($1, $2, $3, $4, true)
                ON CONFLICT DO NOTHING
            `, [tree_id, JSON.stringify(tree_data), star_label || 'Christmas Star', user_nickname || 'Anonymous']);

            return res.status(201).json({ success: true, message: 'Tree planted successfully' });
        } catch (error) {
            console.error('[Forest API] Plant error:', error);
            return res.status(500).json({ error: 'Failed to plant tree' });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

// Christmas Handler Logic
async function handleChristmas(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Route: Lead capture
    if (req.url?.includes('action=lead')) {
        if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
        try {
            const body = await parseJsonBody(req);
            const { email, tree_id } = body;

            if (!email || !email.includes('@')) {
                return res.status(400).json({ success: false, error: 'Invalid email' });
            }

            // Save to database (create table if needed)
            if (neonHelper.isConfigured) {
                try {
                    // Create table if not exists
                    await neonHelper.query(`
                        CREATE TABLE IF NOT EXISTS campaign_leads (
                            id SERIAL PRIMARY KEY,
                            email VARCHAR(255) NOT NULL,
                            tree_id VARCHAR(255),
                            source VARCHAR(50) DEFAULT 'christmas_download',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `);

                    // Insert lead
                    await neonHelper.query(`
                        INSERT INTO campaign_leads (email, tree_id, source)
                        VALUES ($1, $2, $3)
                        ON CONFLICT DO NOTHING
                    `, [email, tree_id || null, 'christmas_download']);

                    console.log(`[ChristmasLead] Saved email: ${email}`);
                } catch (dbErr) {
                    console.error('[ChristmasLead] DB error:', dbErr);
                }
            }

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error('[ChristmasLead] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // Main Route: Tree Generation
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    let tempFilePath = null;

    try {
        let text = '';

        // 1. Resolve User ID (Auth or Random Lead)
        let userId = null;
        let isAnonymous = false;

        try {
            const token = extractToken(req);
            if (token) {
                const payload = await verifyToken(token);
                if (payload && payload.userId) {
                    userId = payload.userId;
                    console.log(`[Christmas] User authenticated: ${userId}`);
                }
            }
        } catch (e) { console.warn('[Christmas] Auth check failed:', e.message); }

        // If no authenticated user, generate random Lead ID
        if (!userId) {
            isAnonymous = true;
            userId = `lead_xmas_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
            console.log(`[Christmas] Generated Lead ID: ${userId}`);
        }

        // Handle Multipart Upload
        const contentType = req.headers['content-type'] || '';
        console.log('[Christmas] Incoming request content-type:', contentType);

        if (contentType.includes('multipart/form-data')) {
            const { buffer, filename } = await parseMultipartWithBusboy(req);

            // Sanitize filename to avoid encoding issues with temp files
            const safeFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            console.log(`[Christmas] Parsed file with Busboy: ${safeFilename} (orig: ${filename}), size: ${buffer.length}`);

            // 3. Node.js Parsing (Primary method now)
            await loadDependencies();
            const ext = path.extname(safeFilename).toLowerCase().replace('.', '');
            console.log(`[Christmas] Processing file: ${safeFilename} (ext: ${ext}), buffer size: ${buffer.length}`);

            try {
                if (ext === 'pdf' && pdfParse) {
                    try {
                        const data = await pdfParse(buffer);
                        text = data.text;
                        console.log(`[Christmas] PDF parsed. Pages: ${data.numpages}, Info: ${JSON.stringify(data.info)}, Text length: ${text?.length}`);

                        if (data.text && data.text.length < 50) {
                            console.warn('[Christmas] PDF text overly short.');
                        }
                    } catch (pdfErr) {
                        console.error('[Christmas] PDF Parse Error:', pdfErr.message);
                        if (pdfErr.message.includes('Password')) {
                            throw new Error('PDF已加密，请上传无密码版本或直接粘贴文本。');
                        }
                        throw new Error('PDF文件损坏或格式不兼容，请尝试其他文件或粘贴文本。');
                    }
                }
                else if (ext === 'docx' && mammoth) {
                    try {
                        const result = await mammoth.extractRawText({ buffer });
                        text = result.value;
                        console.log(`[Christmas] DOCX parsed text length: ${text?.length}`);
                    } catch (docxErr) {
                        console.error('[Christmas] DOCX Parse Error:', docxErr);
                        throw new Error('Word文档解析失败，可能是格式复杂。请尝试粘贴文本。');
                    }
                }
                else if (ext === 'doc') {
                    throw new Error('不支持旧版 .doc 格式。请另存为 .docx 格式后上传，或直接粘贴文本。');
                }
                else if (ext === 'txt') {
                    text = buffer.toString('utf-8');
                } else {
                    console.warn(`[Christmas] Unsupported extension or missing parser for: ${ext}`);
                    throw new Error('不支持的文件格式。仅支持 PDF, DOCX, TXT。');
                }

                // Final validation
                if (!text || text.trim().length < 50) {
                    console.warn(`[Christmas] Parsed text is too short. Length: ${text?.length}`);
                    throw new Error('无法识别简历内容。如果是图片/扫描件PDF，请先转换为文字版Word或直接粘贴文本。');
                }

            } catch (parseErr) {
                console.error(`[Christmas] Parsing validation failed:`, parseErr.message);
                throw parseErr; // Re-throw to be caught by main handler
            }

            // --- Persistence Logic ---
            if (userId && text && text.length > 50) {
                try {
                    console.log(`[Christmas] Saving resume for user: ${userId} (Anonymous: ${isAnonymous})`);
                    const saveResult = await saveUserResume(userId, {
                        fileName: filename,
                        size: buffer.length,
                        fileType: path.extname(filename).toLowerCase().replace('.', ''),
                        contentText: text,
                        fileContent: buffer, // Save actual file
                        metadata: {
                            source: 'christmas_campaign',
                            user_type: isAnonymous ? 'lead' : 'registered',
                            is_lead: isAnonymous
                        },
                        parseStatus: 'success'
                    });
                    console.log(`[Christmas] Resume saved: ${saveResult.success}`);
                } catch (saveErr) {
                    console.error('[Christmas] Save failed:', saveErr);
                }
            }
        }
        else {
            // JSON Paste flow
            const body = await parseJsonBody(req);
            text = body.text || '';
        }

        console.log(`[Christmas] Final Text length: ${text?.length}`);

        if (!text || text.trim().length < 50) {
            return res.status(400).json({ success: false, error: '简历内容过短，请提供更详细的简历。' });
        }

        // Generate Tree
        const treeData = await generateChristmasTree(text);


        return res.status(200).json({
            success: true,
            data: treeData
        });

    } catch (error) {
        console.error('[ChristmasAPI] Error:', error);

        // Return 400 for validation errors, 500 for actual crashes
        if (error.message.includes('无法识别简历内容') ||
            error.message.includes('too short') ||
            error.message.includes('不支持的文件格式') ||
            error.message.includes('不支持旧版') ||
            error.message.includes('Word文档解析失败') ||
            error.message.includes('PDF已加密') ||
            error.message.includes('PDF文件损坏')
        ) {
            return res.status(400).json({ success: false, error: error.message });
        }

        return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
}


export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Dispatch based on 'type' query parameter or URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const type = url.searchParams.get('type');
    
    // Forest: type=forest OR /api/campaign/forest (if rewrite didn't work but we merge manually)
    if (type === 'forest') {
        return await handleForest(req, res);
    }
    
    // Christmas: default or type=christmas
    return await handleChristmas(req, res);
}
