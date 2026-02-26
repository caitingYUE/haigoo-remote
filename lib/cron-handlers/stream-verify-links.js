import axios from 'axios';
import neonHelper from '../../server-utils/dal/neon-helper.js';
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';
import userHelper from '../../server-utils/user-helper.js';
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js';

// 多语言职位失效/报废提示词字典 (ATS 下线常见文案)
const DEAD_PHRASES = [
    // English
    'this position has been closed',
    'this job is no longer available',
    'no longer accepting applications',
    'job not found',
    'this role has been filled',
    '404 not found',
    // 中文
    '此岗位已下线',
    '该职位已关闭',
    '该职位已下线',
    '职位已停止招聘',
    '找不到该职位'
];

export async function checkUrlStatus(url) {
    if (!url || !url.startsWith('http')) {
        return { status: 'dead', reason: 'Invalid URL format' };
    }

    try {
        const response = await axios.get(url, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            },
            // 防止针对 3xx 直接抛错，手动控制跳转以便甄别 Homepage Redirect
            maxRedirects: 5,
            validateStatus: function (status) {
                return status < 500; // 只在 500 时进入 catch，404 会留在 then 中处理
            }
        });

        const statusCode = response.status;
        const finalUrl = response.request?.res?.responseUrl || url;

        // 1. 明确的 404 Not Found -> 判定为 Dead
        if (statusCode === 404 || statusCode === 410) {
            return { status: 'dead', reason: `HTTP ${statusCode}` };
        }

        // 2. 403 Forbidden 封禁、或者是需要登录的墙 -> 判定为 Ambiguous (待人工审核)
        if (statusCode === 403 || statusCode === 401 || url.includes('linkedin.com') || finalUrl.includes('linkedin.com/authwall')) {
            return { status: 'ambiguous', reason: `Blocked or Authwall (HTTP ${statusCode})` };
        }

        // 3. 301/302 重定向到了企业首页 (没有原岗位 Path 了) -> 判定为 Ambiguous
        const origUrlObj = new URL(url);
        const finalUrlObj = new URL(finalUrl);
        if (finalUrlObj.pathname === '/' && origUrlObj.pathname !== '/') {
            return { status: 'ambiguous', reason: 'Redirected to Homepage' };
        }

        // 4. 正文内容嗅探 (DOM/JSON 字典匹配)
        if (typeof response.data === 'string') {
            // 抛弃 cheerio 构建 DOM，直接对原始 HTML (前 15000 字符) 变小写做暴搜
            // 这样能穿透 CSR 单页应用，提取包裹在 <script> JSON 里的关闭标识
            const rawText = response.data.substring(0, 15000).toLowerCase().replace(/\s+/g, ' ');

            for (const phrase of DEAD_PHRASES) {
                if (rawText.includes(phrase.toLowerCase())) {
                    return { status: 'dead', reason: `Matched dead phrase: "${phrase}"` };
                }
            }
        }

        // 5. 其他情况视为存活
        return { status: 'alive', reason: 'Verified OK' };
    } catch (error) {
        // 网络超时、DNS 错误、500 服务端异常等 -> 实施「弹性包容」重试策略，避免误杀
        return { status: 'error_retry', reason: `Network/Server Error: ${error.message}` };
    }
}

export default async function handler(req, res) {
    // Auth Check
    const token = extractToken(req)
    const payload = token ? verifyToken(token) : null
    let isAdmin = false

    if (payload && payload.userId) {
        const requester = await userHelper.getUserById(payload.userId)
        isAdmin = !!(requester?.roles?.admin || SUPER_ADMIN_EMAILS.includes(requester?.email))
    }

    const isCron = process.env.CRON_SECRET && req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`

    if (!isAdmin && !isCron) {
        return res.status(403).json({ success: false, error: 'Forbidden' })
    }

    try {
        console.log('[Cron:VerifyLinks] Starting active link liveliness verification...');

        // SSE Response setup
        const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:5173',
            'https://haigoo-admin.vercel.app',
            'https://www.haigooremote.com'
        ];
        const origin = req.headers.origin;
        const allowOrigin = allowedOrigins.includes(origin) ? origin : '';

        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': allowOrigin
        });

        res.write(`event: start\ndata: ${JSON.stringify({
            type: 'start',
            message: '开始线上岗位链接存活性检测',
            timestamp: new Date().toISOString()
        })}\n\n`);

        if (!neonHelper.isConfigured) {
            res.write(`event: verify_error\ndata: ${JSON.stringify({ type: 'verify_error', message: 'DB not configured' })}\n\n`);
            return res.end();
        }

        // --- 1. 获取需要重检的链接 ---
        // 获取 `last_verified_at` 最久远的前 30 个有效岗位 (未审核的 / 已经下线的不考虑)
        const QUERY_LIMIT = 30;
        const jobsResult = await neonHelper.query(`
            SELECT job_id, title, company, url, status, is_approved 
            FROM jobs 
            WHERE status = 'active' AND is_approved = true
            ORDER BY last_verified_at ASC NULLS FIRST
            LIMIT $1
        `, [QUERY_LIMIT]);

        const jobs = jobsResult || [];

        if (jobs.length === 0) {
            res.write(`event: no_jobs\ndata: ${JSON.stringify({ type: 'no_jobs', message: '没有任何活跃状态的岗位需要排查' })}\n\n`);
            return res.end();
        }

        res.write(`event: verify_progress\ndata: ${JSON.stringify({
            type: 'verify_progress',
            message: `成功提取到 ${jobs.length} 条岗位链接准备发起探针`,
            timestamp: new Date().toISOString()
        })}\n\n`);

        // --- 2. 并发探测 ---
        const BATCH_SIZE = 5; // 每次并发 5 个 axios 请求，防内存爆炸
        const results = [];
        let checkedCount = 0;

        for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
            const batch = jobs.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(async (job) => {
                const result = await checkUrlStatus(job.url);
                return { ...job, verifyResult: result };
            });

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            checkedCount += batchResults.length;
            res.write(`event: batch_done\ndata: ${JSON.stringify({
                type: 'batch_done',
                message: `已探测 ${checkedCount}/${jobs.length} 条岗位...`
            })}\n\n`);
        }

        // --- 3. 结果处理入库 ---
        const actions = {
            alive: 0,
            dead: 0,
            ambiguous: 0,
            error_retry: 0
        };

        for (const job of results) {
            const v = job.verifyResult;
            try {
                if (v.status === 'dead') {
                    // Update state to inactive
                    await neonHelper.query(`
                        UPDATE jobs 
                        SET status = 'inactive', last_verified_at = NOW(), haigoo_comment = $1 
                        WHERE job_id = $2
                    `, [`[自动巡查] 判定链接彻底死亡并下线，原因: ${v.reason}`, job.job_id]);
                    actions.dead++;
                } else if (v.status === 'ambiguous') {
                    // Turn off approval, need manual review
                    await neonHelper.query(`
                        UPDATE jobs 
                        SET is_approved = false, last_verified_at = NOW(), haigoo_comment = $1 
                        WHERE job_id = $2
                    `, [`[自动巡查] 触发模糊风控转为待审核，原因: ${v.reason}`, job.job_id]);
                    actions.ambiguous++;
                } else if (v.status === 'error_retry') {
                    // 遇到网络抖动/502等，实施「弹性包容」：保持 active 但刷新验证时间延后复测
                    await neonHelper.query(`UPDATE jobs SET last_verified_at = NOW() WHERE job_id = $1`, [job.job_id]);
                    actions.error_retry++;
                } else {
                    // Update heartbeat timestamp
                    await neonHelper.query(`UPDATE jobs SET last_verified_at = NOW() WHERE job_id = $1`, [job.job_id]);
                    actions.alive++;
                }
            } catch (err) {
                console.error(`[Cron:VerifyLinks] DB UPDATE FAILED for ${job.job_id}:`, err);
            }
        }

        // --- 4. 自动清理超期 30 天以上的“待审核”岗位 (GC 回收) ---
        let gcCount = 0;
        try {
            const gcResult = await neonHelper.query(`
                DELETE FROM jobs
                WHERE is_approved = false 
                  AND status = 'active'
                  AND haigoo_comment LIKE '[自动巡查] 触发模糊风控%'
                  AND last_verified_at < NOW() - INTERVAL '30 days'
            `);
            // DELETE statements sometimes return array or specific object in @neondatabase/serverless
            gcCount = Array.isArray(gcResult) ? gcResult.length : 0; // fallback indication
        } catch (gcErr) {
            console.error(`[Cron:VerifyLinks] Auto GC error:`, gcErr);
        }

        const reportMsg = `验证完成！共扫 ${jobs.length} 岗位。存活: ${actions.alive}, 永久剔除: ${actions.dead}, 模糊转待审: ${actions.ambiguous}, 网络抖动容错: ${actions.error_retry}。 (GC回收完成)`;

        console.log(`[Cron:VerifyLinks] ${reportMsg}`);
        res.write(`event: verify_complete\ndata: ${JSON.stringify({
            type: 'verify_complete',
            message: reportMsg,
            stats: actions,
            timestamp: new Date().toISOString()
        })}\n\n`);

        res.end();
    } catch (e) {
        console.error(`[Cron:VerifyLinks] Fatal Error:`, e);
        if (!res.headersSent) {
            res.status(500).json({ error: e.message || String(e) });
        } else {
            res.write(`event: fatal_error\ndata: ${JSON.stringify({ type: 'fatal_error', message: String(e) })}\n\n`);
            res.end();
        }
    }
}
