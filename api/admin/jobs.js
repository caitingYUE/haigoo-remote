
import processedJobsHandler from '../../lib/api-handlers/processed-jobs.js';
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';

export default async function handler(req, res) {
    // 权限校验 (管理员权限)
    const token = extractToken(req);
    const user = await verifyToken(token);
    
    // 转发给现有的 handler
    return await processedJobsHandler(req, res);
}
