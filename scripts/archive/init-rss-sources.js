
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Dynamic import to ensure env is loaded first
const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

async function initRssSourcesTable() {
    console.log('Initializing rss_sources table...');
    
    if (!neonHelper.isConfigured) {
        console.error('Neon is not configured');
        return;
    }

    try {
        await neonHelper.query(`
            CREATE TABLE IF NOT EXISTS rss_sources (
              id SERIAL PRIMARY KEY,
              name VARCHAR(255) NOT NULL,
              url VARCHAR(2000) NOT NULL,
              category VARCHAR(100) DEFAULT '其他',
              is_active BOOLEAN DEFAULT true,
              last_sync_at TIMESTAMP,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('rss_sources table created (if not exists).');
        
        // Seed initial data if empty
        const count = await neonHelper.query('SELECT COUNT(*) FROM rss_sources');
        if (count[0].count === '0') {
             console.log('Seeding initial RSS sources...');
             const initialSources = [
                { name: 'WeWorkRemotely', category: '全部', url: 'https://weworkremotely.com/remote-jobs.rss' },
                { name: 'WeWorkRemotely', category: '客户支持', url: 'https://weworkremotely.com/categories/remote-customer-support-jobs.rss' },
                { name: 'WeWorkRemotely', category: '产品职位', url: 'https://weworkremotely.com/categories/remote-product-jobs.rss' },
                { name: 'WeWorkRemotely', category: '全栈编程', url: 'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss' },
                { name: 'WeWorkRemotely', category: '后端编程', url: 'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss' },
                { name: 'WeWorkRemotely', category: '前端编程', url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss' },
                { name: 'WeWorkRemotely', category: '所有编程', url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss' },
                { name: 'WeWorkRemotely', category: '销售和市场营销', url: 'https://weworkremotely.com/categories/remote-sales-and-marketing-jobs.rss' },
                { name: 'WeWorkRemotely', category: '管理和财务', url: 'https://weworkremotely.com/categories/remote-management-and-finance-jobs.rss' },
                { name: 'WeWorkRemotely', category: '设计', url: 'https://weworkremotely.com/categories/remote-design-jobs.rss' },
                { name: 'WeWorkRemotely', category: 'DevOps和系统管理员', url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss' },
                { name: 'WeWorkRemotely', category: '其他', url: 'https://weworkremotely.com/categories/all-other-remote-jobs.rss' },
                { name: 'Remotive', category: '全部', url: 'https://remotive.com/remote-jobs/feed' },
                { name: 'Remotive', category: '软件开发', url: 'https://remotive.com/remote-jobs/feed/software-dev' },
                { name: 'Remotive', category: '客户服务', url: 'https://remotive.com/remote-jobs/feed/customer-support' },
                { name: 'Remotive', category: '设计', url: 'https://remotive.com/remote-jobs/feed/design' },
                { name: 'Remotive', category: '营销', url: 'https://remotive.com/remote-jobs/feed/marketing' },
                { name: 'Remotive', category: '销售/业务', url: 'https://remotive.com/remote-jobs/feed/sales-business' },
                { name: 'Remotive', category: '产品', url: 'https://remotive.com/remote-jobs/feed/product' },
                { name: 'Remotive', category: '项目管理', url: 'https://remotive.com/remote-jobs/feed/project-management' },
                { name: 'Remotive', category: '数据分析', url: 'https://remotive.com/remote-jobs/feed/data' },
                { name: 'Remotive', category: 'DevOps/系统管理员', url: 'https://remotive.com/remote-jobs/feed/devops' },
                { name: 'Remotive', category: '金融/法律', url: 'https://remotive.com/remote-jobs/feed/finance-legal' },
                { name: 'Remotive', category: '人力资源', url: 'https://remotive.com/remote-jobs/feed/hr' },
                { name: 'Remotive', category: '质量保证', url: 'https://remotive.com/remote-jobs/feed/qa' },
                { name: 'Remotive', category: '写作', url: 'https://remotive.com/remote-jobs/feed/writing' },
                { name: 'Remotive', category: '所有其他', url: 'https://remotive.com/remote-jobs/feed/all-others' },
                { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' }
             ];

             for (const source of initialSources) {
                 await neonHelper.query(
                     'INSERT INTO rss_sources (name, category, url, is_active) VALUES ($1, $2, $3, $4)',
                     [source.name, source.category, source.url, true]
                 );
             }
             console.log('Seeded ' + initialSources.length + ' RSS sources.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

initRssSourcesTable();
