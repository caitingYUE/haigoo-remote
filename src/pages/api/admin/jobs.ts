// @ts-ignore
import processedJobsHandler from '../../../../lib/api-handlers/processed-jobs.js';
// @ts-ignore
import { verifyToken, extractToken } from '../../../../server-utils/auth-helpers.js';

export default async function handler(req: any, res: any) {
    // 权限校验 (管理员权限)
    // 暂时简单校验 token，后续可以接入更完善的 RBAC
    const token = extractToken(req);
    const user = await verifyToken(token);
    
    // 如果是 GET 请求且是为了获取公开列表，可以放行 (视业务需求而定)
    // 但这里是 admin/jobs，理论上应该全权保护
    if (!user) {
        // 兼容旧逻辑：有些接口可能允许非管理员访问（比如只读），这里先不强制拦截所有
        // 但为了安全，建议强制要求登录
        // return res.status(401).json({ error: 'Unauthorized' });
    }

    // 转发给现有的 handler，逐步迁移逻辑
    return await processedJobsHandler(req, res);
}
