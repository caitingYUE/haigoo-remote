import { generateChristmasTree } from '../../lib/services/christmas-service.js';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import neonHelper from '../../server-utils/dal/neon-helper.js';

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

import Busboy from 'busboy';

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

import { saveUserResume } from '../../server-utils/resume-storage.js';
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js';

// Python Parser Helper
async function parseWithPython(filePath) {
    // ... existing python logic ...
    return new Promise((resolve, reject) => {
        // Adjust path: api/campaign/christmas.js -> ../../server-utils/resume-parser.py
        const pythonScript = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../server-utils/resume-parser.py');
        console.log(`[Christmas] Spawning python: ${pythonScript} ${filePath}`);

        const pythonProcess = spawn('python3', [pythonScript, filePath]);

        const timeout = setTimeout(() => {
            console.warn('[Christmas] Python parsing timed out, killing process...');
            pythonProcess.kill();
            resolve(null);
        }, 8000); // 8s timeout

        let stdout = '';
        let stderr = '';

        pythonProcess.stdout.on('data', (data) => stdout += data.toString());
        pythonProcess.stderr.on('data', (data) => stderr += data.toString());

        pythonProcess.on('close', (code) => {
            clearTimeout(timeout);
            if (code !== 0 && code !== null) {
                console.error(`[Christmas] Python exited with code ${code}: ${stderr}`);
                return resolve(null);
            }
            try {
                const result = JSON.parse(stdout);
                resolve(result);
            } catch (e) {
                console.error(`[Christmas] Failed to parse Python output: ${stdout}`);
                resolve(null);
            }
        });
        pythonProcess.on('error', (err) => {
            clearTimeout(timeout);
            console.error('[Christmas] Failed to start Python process:', err);
            resolve(null);
        });
    });
}


export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Route: /api/campaign/christmas?action=lead (Email capture)
    if (req.url?.includes('action=lead')) {
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
                    // Non-blocking - continue even if DB fails
                }
            }

            return res.status(200).json({ success: true });

        } catch (error) {
            console.error('[ChristmasLead] Error:', error);
            return res.status(500).json({ success: false, error: error.message });
        }
    }

    // Main Route: Tree Generation
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

            // Log Magic Bytes for debugging
            if (buffer.length > 4) {
                const magic = buffer.slice(0, 4).toString('hex');
                console.log(`[Christmas] File magic bytes: ${magic}`);
            }

            // 1. Save to temp file for Python (if needed, but skipping Python on Vercel is better optimization)
            const tempDir = os.tmpdir();
            tempFilePath = path.join(tempDir, `christmas-${Date.now()}-${safeFilename}`);

            // Optimization: Skip Python if we know it will fail (Vercel)
            // But for now, we'll keep the logic but expect fallback.
            await fs.writeFile(tempFilePath, buffer);
            console.log(`[Christmas] Saved temp file: ${tempFilePath}`);

            // 2. Try Python Parsing
            let pythonResult = null;
            try {
                // Fast fail for Vercel environment could be added here
                pythonResult = await parseWithPython(tempFilePath);
            } catch (pyErr) {
                console.warn('[Christmas] Python invocation failed, moving to fallback.');
            }

            if (pythonResult && pythonResult.success && pythonResult.data && pythonResult.data.content) {
                console.log('[Christmas] Python parse success');
                text = pythonResult.data.content;
            } else {
                console.log('[Christmas] Python parse failed or empty, using Node.js fallback');
                // 3. Fallback to Node.js
                await loadDependencies();
                const ext = path.extname(safeFilename).toLowerCase().replace('.', '');
                console.log(`[Christmas] Processing file: ${safeFilename} (ext: ${ext}), buffer size: ${buffer.length}`);

                try {
                    if (ext === 'pdf' && pdfParse) {
                        const data = await pdfParse(buffer);
                        text = data.text;
                        console.log(`[Christmas] PDF parsed. Pages: ${data.numpages}, Info: ${JSON.stringify(data.info)}, Text length: ${text?.length}`);
                    } else if ((ext === 'docx' || ext === 'doc') && mammoth) {
                        const result = await mammoth.extractRawText({ buffer });
                        text = result.value;
                        console.log(`[Christmas] DOCX parsed text length: ${text?.length}`);
                    } else if (ext === 'txt') {
                        text = buffer.toString('utf-8');
                    } else {
                        console.warn(`[Christmas] Unsupported extension or missing parser for: ${ext}`);
                    }

                    if (!text || text.trim().length < 50) {
                        console.warn(`[Christmas] Parsed text is too short. Length: ${text?.length}`);
                        // Return simpler error for user
                        throw new Error('无法识别简历内容。如果是图片/扫描件PDF，请先转换为文字版Word或直接粘贴文本。');
                    }
                } catch (parseErr) {
                    console.error(`[Christmas] Parsing failed for ${ext}:`, parseErr);
                    // Propagate specific error message if it's the one we threw
                    if (parseErr.message.includes('无法识别简历内容')) throw parseErr;
                }
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

        // Clean up temp file
        if (tempFilePath) {
            try { await fs.unlink(tempFilePath); } catch (e) { }
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
        if (tempFilePath) {
            try { await fs.unlink(tempFilePath); } catch (e) { }
        }

        // Return 400 for validation errors, 500 for actual crashes
        if (error.message.includes('无法识别简历内容') || error.message.includes('too short')) {
            return res.status(400).json({ success: false, error: error.message });
        }

        return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
}
