import { verifyToken, extractToken } from '../../server-utils/auth-helpers.js';

// 安全加载 Vercel KV
let kv = null;
try {
    const kvModule = require('@vercel/kv');
    kv = kvModule?.kv || null;
} catch (e) {
    console.warn('[companies] Vercel KV module not available');
}

const COMPANIES_KEY = 'haigoo:all_companies';
const JOBS_KEY = 'haigoo:processed_jobs';

// 获取所有企业
async function getAllCompanies() {
    try {
        if (!kv) return [];
        const companies = await kv.get(COMPANIES_KEY);
        return companies ? (typeof companies === 'string' ? JSON.parse(companies) : companies) : [];
    } catch (error) {
        console.error('[companies] Error loading companies:', error);
        return [];
    }
}

// 保存所有企业
async function saveAllCompanies(companies) {
    try {
        if (!kv) {
            console.warn('[companies] KV not available, cannot save');
            return false;
        }
        await kv.set(COMPANIES_KEY, companies);
        return true;
    } catch (error) {
        console.error('[companies] Error saving companies:', error);
        return false;
    }
}

// 从岗位数据中提取企业
function extractCompanyFromJob(job) {
    // 从描述中提取企业URL
    const extractUrl = (description) => {
        if (!description) return '';
        const urlMatch = description.match(/\*\*URL:\*\*\s*(https?:\/\/[^\s\n]+)/i);
        return urlMatch ? urlMatch[1].trim() : '';
    };

    const companyUrl = job.companyWebsite || extractUrl(job.description || '');

    return {
        name: job.company,
        url: companyUrl,
        description: '',
        logo: job.companyLogo,
        industry: job.companyIndustry || '其他',
        tags: job.companyTags || [],
        source: job.source || 'rss',
        jobCount: 1
    };
}

// 标准化URL
function normalizeUrl(url) {
    if (!url) return '';
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
        return url.toLowerCase();
    }
}

// 标准化公司名称
function normalizeCompanyName(name) {
    return (name || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[,.\-_]/g, '');
}

// 去重企业
function deduplicateCompanies(companies) {
    const companyMap = new Map();

    for (const company of companies) {
        const key = company.url
            ? normalizeUrl(company.url)
            : normalizeCompanyName(company.name);

        if (!key) continue;

        const existing = companyMap.get(key);
        if (existing) {
            // 合并数据
            companyMap.set(key, {
                ...existing,
                description: (company.description?.length || 0) > (existing.description?.length || 0)
                    ? company.description
                    : existing.description,
                logo: company.logo || existing.logo,
                url: company.url || existing.url,
                tags: Array.from(new Set([...(existing.tags || []), ...(company.tags || [])])),
                jobCount: (existing.jobCount || 0) + (company.jobCount || 0),
                updatedAt: new Date().toISOString()
            });
        } else {
            companyMap.set(key, {
                ...company,
                id: company.id || `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                createdAt: company.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }

    return Array.from(companyMap.values());
}

/**
 * API Handler for Company Management
 */
export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // GET: List all companies or get single company
        if (req.method === 'GET') {
            const { id, action } = req.query;

            // Extract companies from jobs
            if (action === 'extract') {
                try {
                    const jobs = await kv.get(JOBS_KEY);
                    const jobsArray = jobs ? (typeof jobs === 'string' ? JSON.parse(jobs) : jobs) : [];

                    if (!Array.isArray(jobsArray) || jobsArray.length === 0) {
                        return res.status(200).json({
                            success: true,
                            companies: [],
                            message: '没有找到岗位数据'
                        });
                    }

                    // 从岗位中提取企业
                    const extractedCompanies = jobsArray.map(job => extractCompanyFromJob(job));
                    const deduplicated = deduplicateCompanies(extractedCompanies);

                    // 保存到数据库
                    await saveAllCompanies(deduplicated);

                    return res.status(200).json({
                        success: true,
                        companies: deduplicated,
                        message: `成功提取 ${deduplicated.length} 个企业`
                    });
                } catch (error) {
                    console.error('[companies] Extract error:', error);
                    return res.status(500).json({ success: false, error: 'Failed to extract companies' });
                }
            }

            const companies = await getAllCompanies();

            // Get single company
            if (id) {
                const company = companies.find(c => c.id === id);
                if (!company) {
                    return res.status(404).json({ success: false, error: 'Company not found' });
                }
                return res.status(200).json({ success: true, company });
            }

            // List all companies with pagination
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 50;
            const search = req.query.search || '';
            const industry = req.query.industry || '';

            let filteredCompanies = companies;

            // Apply filters
            if (search) {
                const searchLower = search.toLowerCase();
                filteredCompanies = filteredCompanies.filter(c =>
                    c.name.toLowerCase().includes(searchLower) ||
                    (c.description || '').toLowerCase().includes(searchLower)
                );
            }

            if (industry) {
                filteredCompanies = filteredCompanies.filter(c => c.industry === industry);
            }

            // Sort by job count (descending)
            filteredCompanies.sort((a, b) => (b.jobCount || 0) - (a.jobCount || 0));

            // Pagination
            const total = filteredCompanies.length;
            const totalPages = Math.ceil(total / pageSize);
            const startIndex = (page - 1) * pageSize;
            const paginatedCompanies = filteredCompanies.slice(startIndex, startIndex + pageSize);

            return res.status(200).json({
                success: true,
                companies: paginatedCompanies,
                total,
                page,
                pageSize,
                totalPages
            });
        }

        // Auth Check for Write Operations
        const token = extractToken(req);
        const payload = verifyToken(token);
        if (!payload) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // POST: Create or update company
        if (req.method === 'POST') {
            const body = req.body || {};
            const companies = await getAllCompanies();

            if (body.id) {
                // Update existing company
                const index = companies.findIndex(c => c.id === body.id);
                if (index === -1) {
                    return res.status(404).json({ success: false, error: 'Company not found' });
                }
                companies[index] = {
                    ...companies[index],
                    ...body,
                    updatedAt: new Date().toISOString()
                };
            } else {
                // Create new company
                const newCompany = {
                    ...body,
                    id: `company_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                companies.push(newCompany);
            }

            await saveAllCompanies(companies);
            return res.status(200).json({ success: true, message: 'Company saved successfully' });
        }

        // DELETE: Delete company
        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id) {
                return res.status(400).json({ success: false, error: 'Company ID required' });
            }

            const companies = await getAllCompanies();
            const filteredCompanies = companies.filter(c => c.id !== id);

            if (filteredCompanies.length === companies.length) {
                return res.status(404).json({ success: false, error: 'Company not found' });
            }

            await saveAllCompanies(filteredCompanies);
            return res.status(200).json({ success: true, message: 'Company deleted successfully' });
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });
    } catch (error) {
        console.error('[companies] Error:', error);
        return res.status(500).json({ success: false, error: 'Server error' });
    }
}
