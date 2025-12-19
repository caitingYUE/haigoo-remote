import { generateChristmasTree } from '../../lib/services/christmas-service.js';
import { createRequire } from 'module';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

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

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        let text = '';

        // Handle Multipart Upload
        const contentType = req.headers['content-type'] || '';
        console.log('[Christmas] Incoming request content-type:', contentType);

        if (contentType.includes('multipart/form-data')) {
            try {
                const { buffer, filename } = await parseMultipartSimple(req);
                console.log(`[Christmas] Parsed file: ${filename}, size: ${buffer.length}`);

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
                console.log(`[Christmas] Extracted text length: ${text?.length}`);
            } catch (err) {
                console.error('[Christmas] Multipart parse failed:', err);
                throw err;
            }
        }
        // Handle JSON Body (Raw text paste)
        else {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            if (chunks.length > 0) {
                const body = JSON.parse(Buffer.concat(chunks).toString());
                text = body.text || '';
            }
        }

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
        return res.status(500).json({ success: false, error: error.message || 'Internal Server Error' });
    }
}
