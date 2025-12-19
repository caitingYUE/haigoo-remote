import { generateChristmasTree } from '../../lib/services/christmas-service.js';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import neonHelper from '../../server-utils/dal/neon-helper.js';

const require = createRequire(import.meta.url);

// Lazy load dependencies
let pdfParse, mammoth;
async function loadDependencies() {
    if (!pdfParse) {
        try { pdfParse = require('pdf-parse/lib/pdf-parse.js'); } catch (e) { }
    }
    if (!mammoth) {
        try { mammoth = (await import('mammoth')).default; } catch (e) { }
    }
}

// Simple multipart parser (reused logic)
async function parseMultipartSimple(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const boundary = req.headers['content-type']?.split('boundary=')[1];
                if (!boundary) return reject(new Error('No boundary found'));

                const boundaryBuffer = Buffer.from(`--${boundary}`);
                let start = buffer.indexOf(boundaryBuffer) + boundaryBuffer.length;

                while (start < buffer.length) {
                    const end = buffer.indexOf(boundaryBuffer, start);
                    if (end === -1) break;

                    const part = buffer.slice(start, end);
                    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
                    if (headerEnd !== -1) {
                        const header = part.slice(0, headerEnd).toString();
                        if (header.includes('filename=')) {
                            const filenameMatch = header.match(/filename="([^"]+)"/);
                            const filename = filenameMatch ? filenameMatch[1] : 'file';
                            let fileBuffer = part.slice(headerEnd + 4);
                            if (fileBuffer.slice(-2).toString() === '\r\n') fileBuffer = fileBuffer.slice(0, -2);
                            resolve({ buffer: fileBuffer, filename });
                            return;
                        }
                    }
                    start = end + boundaryBuffer.length;
                }
                reject(new Error('No file found'));
            } catch (err) { reject(err); }
        });
        req.on('error', reject);
    });
}

import { saveUserResume } from '../../lib/server-utils/resume-storage.js';
import { extractToken, verifyToken } from '../../lib/server-utils/auth-helpers.js';

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
            const { email, tree_id } = req.body;

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
            const { buffer, filename } = await parseMultipartSimple(req);
            console.log(`[Christmas] Parsed file: ${filename}, size: ${buffer.length}`);

            // 1. Save to temp file for Python
            const tempDir = os.tmpdir();
            tempFilePath = path.join(tempDir, `christmas-${Date.now()}-${filename.replace(/\s+/g, '_')}`);
            await fs.writeFile(tempFilePath, buffer);
            console.log(`[Christmas] Saved temp file: ${tempFilePath}`);

            // 2. Try Python Parsing
            const pythonResult = await parseWithPython(tempFilePath);

            if (pythonResult && pythonResult.success && pythonResult.data && pythonResult.data.content) {
                console.log('[Christmas] Python parse success');
                text = pythonResult.data.content;
            } else {
                console.log('[Christmas] Python parse failed or empty, using Node.js fallback');
                // 3. Fallback to Node.js
                await loadDependencies();
                const ext = path.extname(filename).toLowerCase().replace('.', '');

                if (ext === 'pdf' && pdfParse) {
                    const data = await pdfParse(buffer);
                    text = data.text;
                } else if ((ext === 'docx' || ext === 'doc') && mammoth) {
                    const result = await mammoth.extractRawText({ buffer });
                    text = result.value;
                } else if (ext === 'txt') {
                    text = buffer.toString('utf-8');
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
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            if (chunks.length > 0) {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                text = body.text || '';
            }
        }

        // Clean up temp file
        if (tempFilePath) {
            try { await fs.unlink(tempFilePath); } catch (e) { }
        }

        console.log(`[Christmas] Final Text length: ${text?.length}`);

        if (!text || text.trim().length < 50) {
            return res.status(400).json({ success: false, error: 'Resume content too short or empty' });
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
        return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
}
