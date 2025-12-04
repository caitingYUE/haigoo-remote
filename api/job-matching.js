/**
 * 人岗匹配API
 * GET /api/job-matching - 获取个性化推荐
 * POST /api/job-matching - 计算匹配度 / 触发重算
 */

import { verifyToken, extractToken } from '../server-utils/auth-helpers.js';
import matchingEngine from '../lib/services/matching-engine.js';

// CORS headers
function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendJson(res, body, status = 200) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    setCorsHeaders(res);
    res.status(status).json(body);
}

export default async function handler(req, res) {
    console.log('[job-matching] Handler called', { method: req.method, url: req.url });

    setCorsHeaders(res);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 解析查询参数
        const rawQuery = req.url && req.url.includes('?') ? req.url.split('?')[1] : '';
        const params = new URLSearchParams(rawQuery);
        const action = params.get('action') || '';

        // 验证用户身份
        const token = extractToken(req);

        if (!token) {
            return sendJson(res, { success: false, error: '未提供认证令牌' }, 401);
        }

        const payload = verifyToken(token);

        if (!payload || !payload.userId) {
            return sendJson(res, { success: false, error: '认证令牌无效或已过期' }, 401);
        }

        const userId = payload.userId;

        // GET - 获取个性化推荐
        if (req.method === 'GET') {
            const limit = parseInt(params.get('limit') || '20', 10);
            const searchQuery = params.get('search') || '';
            const category = params.get('category') || '';
            const region = params.get('region') || '';

            const result = await matchingEngine.getPersonalizedRecommendations(userId, {
                limit,
                searchQuery,
                filters: { category, region }
            });

            return sendJson(res, {
                success: true,
                ...result
            });
        }

        // POST - 计算匹配度或触发重算
        if (req.method === 'POST') {
            const body = req.body || {};

            // 触发重新计算
            if (action === 'recalculate') {
                const result = await matchingEngine.recalculateUserMatches(userId);
                return sendJson(res, result);
            }

            // 计算单个岗位匹配度
            if (body.jobId) {
                const result = await matchingEngine.calculateMatch(userId, body.jobId);
                return sendJson(res, {
                    success: true,
                    userId,
                    jobId: body.jobId,
                    ...result
                });
            }

            // 批量计算匹配度
            if (body.jobIds && Array.isArray(body.jobIds)) {
                const results = await matchingEngine.batchCalculateMatches(userId, body.jobIds);
                return sendJson(res, {
                    success: true,
                    userId,
                    matches: results
                });
            }

            return sendJson(res, { success: false, error: '缺少必要参数' }, 400);
        }

        return sendJson(res, { success: false, error: 'Method not allowed' }, 405);

    } catch (error) {
        console.error('[job-matching] Error:', error);
        return sendJson(res, { success: false, error: error.message || '服务器错误' }, 500);
    }
}
