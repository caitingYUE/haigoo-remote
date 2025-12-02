import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
import neonHelper from '../server-utils/dal/neon-helper.js';

const TAG_CONFIG_KEY = 'haigoo:tag_config';

const INITIAL_CONFIG = {
    jobCategories: [
        '前端开发', '后端开发', '全栈开发', '移动开发',
        '算法工程师', '数据开发', '数据分析', '服务器开发',
        '运维/SRE', '网络安全', '操作系统/内核', '技术支持',
        '硬件开发', '架构师', 'CTO/技术管理', '软件开发',
        '产品经理', '产品设计', '用户研究', '项目管理',
        'UI/UX设计', '平面设计', '视觉设计', '商业分析',
        '运营', '市场营销', '销售', '客户经理', '客户服务',
        '内容创作', '增长黑客', '人力资源', '招聘', '财务',
        '法务', '行政', '管理', '教育培训', '咨询', '投资',
        '其他'
    ],
    companyIndustries: [
        '人工智能', 'Web3/区块链', '企业服务/SaaS', '金融/Fintech',
        '电子商务', '游戏/娱乐', '大健康/医疗', '教育',
        '硬件/物联网', '互联网/软件', '其他'
    ],
    companyTags: [
        'AI+陪伴', 'AI+健康', 'AI基础设施', 'AI Agent',
        '远程优先', '全球招聘', '初创公司', '独角兽', '出海',
        'SaaS', 'Software', 'Fintech', 'E-commerce', 'Gaming',
        'Healthcare', 'EdTech', 'Web3', 'Blockchain', 'Data'
    ]
};

async function initTags() {
    console.log('Starting tag configuration initialization...');

    if (!neonHelper.isConfigured) {
        console.error('Neon database is not configured.');
        process.exit(1);
    }

    try {
        const configStr = JSON.stringify(INITIAL_CONFIG);

        await neonHelper.query(`
            INSERT INTO tag_config (config_type, config_data, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (config_type) 
            DO UPDATE SET config_data = EXCLUDED.config_data, updated_at = NOW()
        `, [TAG_CONFIG_KEY, configStr]);

        console.log('Successfully initialized tag configuration!');
        console.log('Job Categories:', INITIAL_CONFIG.jobCategories.length);
        console.log('Company Industries:', INITIAL_CONFIG.companyIndustries.length);
        console.log('Company Tags:', INITIAL_CONFIG.companyTags.length);

    } catch (error) {
        console.error('Failed to initialize tags:', error);
        process.exit(1);
    }
}

initTags();
