
import trustedCompaniesHandler from '../../lib/api-handlers/trusted-companies.js';
import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';

export default async function handler(req, res) {
    const token = extractToken(req);
    const user = await verifyToken(token);
    
    // 权限校验逻辑可在此扩展
    
    // 注入 query 参数以适配旧 handler 的 switch-case 逻辑
    if (!req.query.target) {
        req.query.target = 'companies';
    }

    return await trustedCompaniesHandler(req, res);
}
