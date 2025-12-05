
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3002;

// Ensure SITE_URL is set for services that rely on it (like translation-service)
if (!process.env.SITE_URL) {
    process.env.SITE_URL = `http://localhost:${PORT}`;
    console.log(`Set SITE_URL to ${process.env.SITE_URL}`);
}

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

async function startServer() {
    try {
        console.log('Importing auth handler...');
        const authHandler = (await import('./api/auth.js')).default;
        app.all('/api/auth', async (req, res) => { await authHandler(req, res); });
        console.log('Auth handler imported.');

        console.log('Importing users handler...');
        const usersHandler = (await import('./api/users.js')).default;
        app.all('/api/users', async (req, res) => { await usersHandler(req, res); });
        console.log('Importing user-profile handler...');
        const userProfileHandler = (await import('./lib/api-handlers/user-profile.js')).default;
        app.all('/api/user-profile', async (req, res) => { await userProfileHandler(req, res); });
        console.log('User-profile handler imported.');

        console.log('Importing membership handler...');
        const membershipHandler = (await import('./lib/api-handlers/membership.js')).default;
        app.all('/api/membership', async (req, res) => { await membershipHandler(req, res); });
        console.log('Membership handler imported.');

        console.log('Importing data handler...');
        const dataHandler = (await import('./api/data.js')).default;
        app.all(/^\/api\/data/, async (req, res) => { await dataHandler(req, res); });
        console.log('Data handler imported.');

        console.log('Importing admin-ops handler...');
        const adminOpsHandler = (await import('./api/admin-ops.js')).default;
        app.all('/api/admin-ops', async (req, res) => { await adminOpsHandler(req, res); });
        // Map legacy admin routes
        app.all('/api/check-user-data', async (req, res) => { req.query.action = 'check-user'; await adminOpsHandler(req, res); });
        app.all('/api/diagnose-db', async (req, res) => { req.query.action = 'diagnose'; await adminOpsHandler(req, res); });
        app.all('/api/run-migration', async (req, res) => { req.query.action = 'migrate'; await adminOpsHandler(req, res); });

        console.log('Importing parse-resume handler...');
        const resumesHandler = (await import('./api/resumes.js')).default;
        // Map legacy route to new handler
        app.all('/api/parse-resume-new', async (req, res) => { await resumesHandler(req, res); });
        // Also map standard resumes route if not already done (it wasn't in the original file?)
        app.all('/api/resumes', async (req, res) => { await resumesHandler(req, res); });
        console.log('Resumes handler imported.');

        console.log('Importing process-image handler...');
        const processImageHandler = (await import('./api/process-image.js')).default;
        app.all('/api/process-image', async (req, res) => { await processImageHandler(req, res); });
        console.log('Process-image handler imported.');

        console.log('Importing cron handlers...');
        const crawlTrustedJobsHandler = (await import('./lib/cron-handlers/crawl-trusted-jobs.js')).default;
        // sync-jobs usually refers to translate-jobs in this context or process-rss
        // But translate-jobs is the one user cares about
        // I'll map sync-jobs to translate-jobs.js as it seems most relevant
        const syncJobsHandler = (await import('./lib/cron-handlers/translate-jobs.js')).default;

        app.all('/api/cron/crawl-trusted-jobs', async (req, res) => { await crawlTrustedJobsHandler(req, res); });
        app.all('/api/cron/sync-jobs', async (req, res) => { await syncJobsHandler(req, res); });
        console.log('Cron handlers imported.');

        console.log('Importing translation handlers...');
        // Mock /api/translate using google-translate-api for local dev
        // Note: In production this is handled by api/translate.js Edge Function
        const { translate } = await import('@vitalets/google-translate-api');

        app.post('/api/translate', async (req, res) => {
            try {
                const { texts, targetLanguage = 'zh-CN', sourceLanguage = 'auto' } = req.body;
                if (!texts || !Array.isArray(texts)) {
                    return res.status(400).json({ success: false, error: 'Missing texts array' });
                }

                console.log(`[LocalTranslate] Translating ${texts.length} texts to ${targetLanguage}...`);
                const results = [];

                // Simple sequential translation to avoid rate limits locally
                for (const text of texts) {
                    if (!text || !text.trim()) {
                        results.push(text || '');
                        continue;
                    }
                    try {
                        // Map language codes if necessary (zh-CN -> zh-CN works for google)
                        const { text: translated } = await translate(text, {
                            to: targetLanguage,
                            from: sourceLanguage === 'auto' ? undefined : sourceLanguage
                        });
                        results.push(translated);
                    } catch (e) {
                        console.error('[LocalTranslate] Item error:', e.message);
                        results.push(text); // Fallback
                    }
                    // Small delay
                    await new Promise(r => setTimeout(r, 100));
                }

                res.json({ success: true, data: results });
            } catch (error) {
                console.error('[LocalTranslate] Global error:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // /api/translate-jobs -> lib/cron-handlers/translate-jobs.js
        // Note: In production this is routed via vercel.json rewrites
        const translateJobsHandler = (await import('./lib/cron-handlers/translate-jobs.js')).default;
        app.all('/api/translate-jobs', async (req, res) => {
            console.log('[LocalServer] Route /api/translate-jobs hit');
            await translateJobsHandler(req, res);
        });

        console.log('Translation handlers imported.');

        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', env: 'local' });
        });

        app.listen(PORT, () => {
            console.log(`Local API server running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();
