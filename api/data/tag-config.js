const { getKV } = require('../../server-utils/kv-client');

const TAG_CONFIG_KEY = 'haigoo:tag_config';

// Default tag configurations
const DEFAULT_CONFIG = {
    jobCategories: [
        '全栈开发', '前端开发', '后端开发', '移动开发', '算法工程师', '数据开发',
        '服务器开发', '运维/SRE', '测试/QA', '网络安全', '操作系统/内核', '技术支持',
        '硬件开发', '架构师', 'CTO/技术管理', '软件开发', '产品经理', '产品设计',
        '用户研究', '项目管理', 'UI/UX设计', '平面设计', '视觉设计', '数据分析',
        '数据科学', '商业分析', '运营', '市场营销', '销售', '客户经理', '客户服务',
        '内容创作', '增长黑客', '人力资源', '招聘', '财务', '法务', '行政', '管理',
        '教育培训', '咨询', '投资', '其他', '全部'
    ],
    companyIndustries: [
        '互联网/软件', '人工智能', '大健康/医疗', '教育', '金融/Fintech',
        '电子商务', 'Web3/区块链', '游戏', '媒体/娱乐', '企业服务/SaaS',
        '硬件/物联网', '消费生活', '其他'
    ],
    companyTags: [
        'AI+陪伴', 'AI+健康', 'AI基础设施', '医药', '远程优先', '全球招聘',
        '初创公司', '独角兽', '外企', '出海'
    ]
};

/**
 * API Handler for Tag Configuration Management
 * GET: Retrieve tag configuration
 * POST: Update tag configuration
 */
export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const kv = getKV();

        if (req.method === 'GET') {
            // Get tag configuration
            const config = await kv.get(TAG_CONFIG_KEY);

            if (!config) {
                // Return default config if not found
                return res.status(200).json({
                    success: true,
                    config: DEFAULT_CONFIG
                });
            }

            return res.status(200).json({
                success: true,
                config: typeof config === 'string' ? JSON.parse(config) : config
            });
        }

        if (req.method === 'POST') {
            // Verify authentication
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { action, type, value, index } = req.body;

            // Get current config
            let config = await kv.get(TAG_CONFIG_KEY);
            if (!config) {
                config = DEFAULT_CONFIG;
            } else {
                config = typeof config === 'string' ? JSON.parse(config) : config;
            }

            // Determine which array to modify
            let targetArray;
            if (type === 'jobCategory') {
                targetArray = 'jobCategories';
            } else if (type === 'companyIndustry') {
                targetArray = 'companyIndustries';
            } else if (type === 'companyTag') {
                targetArray = 'companyTags';
            } else {
                return res.status(400).json({ error: 'Invalid type' });
            }

            // Perform action
            if (action === 'add') {
                if (!value || typeof value !== 'string') {
                    return res.status(400).json({ error: 'Invalid value' });
                }
                if (!config[targetArray].includes(value)) {
                    config[targetArray].push(value);
                }
            } else if (action === 'delete') {
                if (typeof index !== 'number') {
                    return res.status(400).json({ error: 'Invalid index' });
                }
                config[targetArray].splice(index, 1);
            } else if (action === 'update') {
                if (typeof index !== 'number' || !value || typeof value !== 'string') {
                    return res.status(400).json({ error: 'Invalid parameters' });
                }
                config[targetArray][index] = value;
            } else {
                return res.status(400).json({ error: 'Invalid action' });
            }

            // Save updated config
            await kv.set(TAG_CONFIG_KEY, JSON.stringify(config));

            return res.status(200).json({
                success: true,
                config
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Tag config API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
