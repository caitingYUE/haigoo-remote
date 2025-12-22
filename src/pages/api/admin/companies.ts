import { NextApiRequest, NextApiResponse } from 'next';
import trustedCompaniesHandler from '../../../../lib/api-handlers/trusted-companies.js';
import { verifyToken, extractToken } from '../../../../server-utils/auth-helpers.js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const token = extractToken(req);
    const user = await verifyToken(token);
    
    // 同样的，这里建议加上权限控制
    // if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // 转发给现有的 trusted-companies handler
    // 注意：原 handler 内部混合了 'tags', 'companies', 'crawl' 等多种 target
    // 这里的重构目标是让前端直接调用 /api/admin/companies，后端自动处理
    
    // 注入 query 参数以适配旧 handler 的 switch-case 逻辑
    // 旧逻辑依赖 req.query.target 或者路径匹配
    if (!req.query.target) {
        req.query.target = 'companies';
    }

    return await trustedCompaniesHandler(req, res);
}
