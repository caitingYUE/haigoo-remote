
import * as cheerio from 'cheerio';
// Note: dns module might not be available in Edge runtime, but usually fine in Node.js serverless functions.
// If deployment fails, we might need to remove dns check or use a different validation method.
import dns from 'dns';
import { promisify } from 'util';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { callBailianAPI, isAiAvailable } from '../bailian-parser.js';

const resolveMx = promisify(dns.resolveMx);

// Configuration
const TIMEOUT_MS = 20000; // Increased timeout for deeper crawling
const MAX_PAGES_TO_CRAWL = 20; // Increased limit for better coverage
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Email Regex (Enhanced to handle some obfuscation)
// Matches standard emails
const EMAIL_REGEX = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
// Matches "name [at] domain . com" or "name (at) domain . com"
const OBFUSCATED_EMAIL_REGEX = /([a-zA-Z0-9._-]+)\s*[\(\[]\s*at\s*[\)\]]\s*([a-zA-Z0-9.-]+)\s*[\(\[]\s*dot\s*[\)\]]\s*([a-zA-Z]{2,})/gi;
const OBFUSCATED_EMAIL_SIMPLE_REGEX = /([a-zA-Z0-9._-]+)\s*[\(\[]\s*at\s*[\)\]]\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;

// Social Media Regex
const SOCIAL_PLATFORMS = {
    linkedin: /linkedin\.com\/(in|company)/i,
    twitter: /(twitter\.com|x\.com)/i,
    facebook: /facebook\.com/i,
    instagram: /instagram\.com/i,
    github: /github\.com/i,
    youtube: /youtube\.com/i,
    tiktok: /tiktok\.com/i
};

// External Whitelisted Domains for Cross-Domain Crawling
const EXTERNAL_DOMAINS = [
    // ATS
    'boards.greenhouse.io', 'jobs.lever.co', 'jobs.ashbyhq.com', 'apply.workable.com', 
    'breezy.hr', 'recruitee.com', 'myworkdayjobs.com', 'smartrecruiters.com',
    'careers.page', 'join.com', 'jobs.personio.de', 'jobs.personio.com',
    // Content/Blog
    'medium.com', 'substack.com', 'notion.site', 'notion.so', 'docsend.com',
    'dev.to', 'hashnode.com', 'hubspot.com',
    // PR & News
    'businesswire.com', 'prnewswire.com', 'globenewswire.com', 'prweb.com',
    'accesswire.com', 'newswire.com', 'techcrunch.com', 'forbes.com',
    // Funding/Company Profile
    'crunchbase.com', 'pitchbook.com', 'angel.co', 'wellfound.com',
    'linkedin.com'
];

// Role Keywords
const ROLES = {
    HR: ['hr', 'career', 'careers', 'job', 'jobs', 'talent', 'recruit', 'recruiting', 'people', 'hiring', 'join'],
    Sales: ['sales', 'bd', 'business', 'partnership', 'partners', 'growth'],
    Support: ['support', 'help', 'service', 'care', 'customer'],
    Info: ['info', 'contact', 'hello', 'hi', 'office', 'admin', 'enquiry', 'inquiry', 'general'],
    Executive: ['ceo', 'founder', 'cto', 'co-founder', 'owner', 'principal'],
    Tech: ['tech', 'engineering', 'dev', 'developer', 'it', 'security', 'webmaster'],
    Legal: ['legal', 'privacy', 'compliance', 'security'],
    PR: ['press', 'media', 'pr', 'communication', 'publicity'],
    Finance: ['finance', 'billing', 'accounts', 'invoice']
};

/**
 * Google Custom Search Helper
 */
async function searchGoogle(query, num = 10) {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_CX;

    if (!apiKey || !cx) return null;

    try {
        const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${num}`;
        const res = await fetch(url);
        if (!res.ok) {
            console.warn(`[ContactMiner] Google Search failed: ${res.status}`);
            return null;
        }
        const data = await res.json();
        return data.items || [];
    } catch (e) {
        console.error('[ContactMiner] Google Search error:', e.message);
        return null;
    }
}

/**
 * Classify email role based on local part
 */
function classifyRole(email) {
    const localPart = email.split('@')[0].toLowerCase();
    
    for (const [role, keywords] of Object.entries(ROLES)) {
        if (keywords.some(k => localPart.includes(k) || localPart === k)) {
            return role;
        }
    }
    return 'General'; // Default
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(email, domain, contextText = '', isGuessed = false) {
    let score = 60; // Base score

    if (isGuessed) {
        score = 30; // Guessed emails start low
    }

    // Domain match bonus
    if (domain && email.endsWith('@' + domain)) {
        score += 20;
    } else {
        // Penalty for generic domains unless explicitly found on official site
        const genericDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com', 'qq.com', '163.com'];
        if (genericDomains.some(d => email.endsWith(d))) {
            score -= 10;
        }
    }

    // Role detection bonus (specific roles are usually more reliable/intended for contact)
    const role = classifyRole(email);
    if (role !== 'General') {
        score += 10;
    }

    // Context bonus (if found near "Email us" or "Contact")
    if (contextText && /email|contact|reach|send|apply|cv|resume/i.test(contextText)) {
        score += 10;
    }

    return Math.min(score, 100);
}

/**
 * Helper to fetch content with timeout
 * Returns { text: string, type: 'html' | 'pdf' } or null
 */
async function fetchContent(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': USER_AGENT },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) return null;

        const contentType = res.headers.get('content-type') || '';
        
        // Handle PDF
        if (contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            try {
                const data = await pdf(buffer);
                return { text: data.text, type: 'pdf' };
            } catch (e) {
                console.warn(`[ContactMiner] PDF parse failed for ${url}:`, e.message);
                return null;
            }
        }

        // Handle HTML
        const text = await res.text();
        return { text, type: 'html' };

    } catch (e) {
        clearTimeout(timeout);
        console.warn(`[ContactMiner] Failed to fetch ${url}:`, e.message);
        return null;
    }
}

/**
 * Check MX records to validate domain can receive email
 */
async function checkMxRecords(domain) {
    try {
        const records = await resolveMx(domain);
        return records && records.length > 0;
    } catch (e) {
        console.warn(`[ContactMiner] MX check failed for ${domain}:`, e.message);
        return false;
    }
}

/**
 * Fetch and parse sitemap to find relevant pages
 */
async function findPagesFromSitemap(baseUrl, domain) {
    const sitemapUrls = [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap_index.xml`,
        `${baseUrl}/sitemap/sitemap.xml`
    ];

    const foundPages = [];
    const priorityKeywords = ['contact', 'about', 'team', 'people', 'career', 'job', 'connect', 'support', 'help', 'press', 'media', 'legal', 'privacy'];

    for (const url of sitemapUrls) {
        try {
            const content = await fetchContent(url);
            if (!content || content.type !== 'html') continue;

            const $ = cheerio.load(content.text, { xmlMode: true });
            $('loc').each((_, el) => {
                const loc = $(el).text().trim();
                if (loc && loc.includes(domain)) {
                    if (priorityKeywords.some(kw => loc.toLowerCase().includes(kw))) {
                        foundPages.push(loc);
                    }
                }
            });
            
            if (foundPages.length > 0) break; // Stop if we found a valid sitemap
        } catch (e) {
            // Ignore sitemap errors
        }
    }
    return foundPages;
}

/**
 * Main Mining Function
 * @param {string} input - Company URL or Domain
 */
export async function mineCompanyContacts(input) {
    console.log(`[ContactMiner] Starting mining for: ${input}`);
    
    // 1. Normalize Input to URL
    let baseUrl = input.trim();
    if (!baseUrl.startsWith('http')) {
        baseUrl = 'https://' + baseUrl;
    }
    
    let domain = '';
    try {
        const urlObj = new URL(baseUrl);
        domain = urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
        return { success: false, error: 'Invalid URL or Domain provided' };
    }

    // 0. Validate Domain MX Records (Optimization: Fail fast if domain is dead)
    const hasMx = await checkMxRecords(domain);
    if (!hasMx) {
        console.warn(`[ContactMiner] No MX records found for ${domain}. Emails might be invalid.`);
    }

    const foundEmails = new Map(); // Key: email, Value: { role, source, confidence, context }
    const visitedUrls = new Set();
    const socialLinks = new Set(); // Store unique social links
    let urlsToCrawl = [baseUrl];

    // 1.1 Sitemap Discovery (Optimization)
    try {
        const sitemapPages = await findPagesFromSitemap(baseUrl, domain);
        if (sitemapPages.length > 0) {
            console.log(`[ContactMiner] Found ${sitemapPages.length} relevant pages from sitemap`);
            // Prioritize sitemap pages
            urlsToCrawl = [...urlsToCrawl, ...sitemapPages].slice(0, MAX_PAGES_TO_CRAWL + 2); 
        }
    } catch (e) {}

    // 2. Crawling Loop
    let pagesCrawled = 0;
    
    // 2.1 Google Search Expansion (New Feature)
    // If keys are present, use Google to find hidden contact pages or direct emails
    const googleResults = await searchGoogle(`site:${domain} (contact OR about OR team OR "email us")`, 5);
    if (googleResults && googleResults.length > 0) {
        console.log(`[ContactMiner] Found ${googleResults.length} pages via Google Search`);
        googleResults.forEach(item => {
            if (item.link && !visitedUrls.has(item.link)) {
                // Prioritize Google results
                urlsToCrawl.unshift(item.link);
                
                // Also extract from snippet immediately
                if (item.snippet) {
                    const snippetEmails = item.snippet.match(EMAIL_REGEX) || [];
                    snippetEmails.forEach(email => {
                         const clean = email.toLowerCase().trim();
                         if (!foundEmails.has(clean)) {
                            foundEmails.set(clean, {
                                email: clean,
                                role: classifyRole(clean),
                                source: 'Google Search Snippet',
                                confidence: 75,
                                context: `Found in search snippet for ${item.title}`
                            });
                         }
                    });
                }
            }
        });
    }

    // 2.2 AI-driven Pattern Discovery (New Feature)
    // If AI is available, ask it to predict patterns
    if (isAiAvailable() && pagesCrawled === 0) {
        const aiPrompt = `Given the company domain "${domain}", predict 3 likely email addresses for:
        1. General inquiry (e.g. info@, hello@)
        2. Press/Media (e.g. press@, media@)
        3. Recruitment (e.g. careers@, jobs@)
        
        Return ONLY a JSON array of strings (e.g. ["info@example.com", ...]). Do not include explanations.`;
        
        try {
            const { content } = await callBailianAPI(aiPrompt);
            const predictedEmails = JSON.parse(content.match(/\[.*\]/s)?.[0] || '[]');
            predictedEmails.forEach(email => {
                if (email.includes('@') && !foundEmails.has(email)) {
                     foundEmails.set(email, {
                        email,
                        role: classifyRole(email),
                        source: 'AI Prediction',
                        confidence: 40, // Low confidence until verified
                        context: 'AI Predicted Pattern'
                    });
                }
            });
            console.log(`[ContactMiner] AI predicted ${predictedEmails.length} patterns`);
        } catch (e) {
            // Ignore AI errors
        }
    }

    while (urlsToCrawl.length > 0 && pagesCrawled < MAX_PAGES_TO_CRAWL) {
        const currentUrl = urlsToCrawl.shift();
        
        if (visitedUrls.has(currentUrl)) continue;
        visitedUrls.add(currentUrl);
        
        pagesCrawled++;

        const content = await fetchContent(currentUrl);
        if (!content) continue;

        let bodyText = '';
        let $ = null;

        if (content.type === 'pdf') {
            bodyText = content.text;
        } else {
            $ = cheerio.load(content.text);
            bodyText = $('body').text();
        }

        // A. Extract Emails from Text (Standard)
        const matches = bodyText.match(EMAIL_REGEX) || [];
        
        matches.forEach(email => {
            email = email.toLowerCase().trim();
            // Filter invalid extensions (images disguised as emails or other noise)
            if (/\.(png|jpg|jpeg|gif|css|js|svg|webp|woff)$/.test(email)) return;

            if (!foundEmails.has(email)) {
                foundEmails.set(email, {
                    email,
                    role: classifyRole(email),
                    source: currentUrl,
                    confidence: calculateConfidence(email, domain, ''),
                    context: content.type === 'pdf' ? 'Found in PDF Document' : 'Found in page text'
                });
            }
        });

        // A.2 Extract Obfuscated Emails (Optimization)
        // Handle "name [at] domain . com"
        let obfuscatedMatch;
        // Reset regex state
        OBFUSCATED_EMAIL_REGEX.lastIndex = 0;
        while ((obfuscatedMatch = OBFUSCATED_EMAIL_REGEX.exec(bodyText)) !== null) {
            const email = `${obfuscatedMatch[1]}@${obfuscatedMatch[2]}.${obfuscatedMatch[3]}`.toLowerCase();
            if (!foundEmails.has(email)) {
                foundEmails.set(email, {
                    email,
                    role: classifyRole(email),
                    source: currentUrl,
                    confidence: calculateConfidence(email, domain, 'De-obfuscated'),
                    context: 'Found as obfuscated text'
                });
            }
        }
        
        // Handle "name [at] domain.com"
        OBFUSCATED_EMAIL_SIMPLE_REGEX.lastIndex = 0;
        while ((obfuscatedMatch = OBFUSCATED_EMAIL_SIMPLE_REGEX.exec(bodyText)) !== null) {
             const email = `${obfuscatedMatch[1]}@${obfuscatedMatch[2]}`.toLowerCase();
             // Simple validation
             if (!email.includes(' ') && email.includes('.')) {
                 if (!foundEmails.has(email)) {
                    foundEmails.set(email, {
                        email,
                        role: classifyRole(email),
                        source: currentUrl,
                        confidence: calculateConfidence(email, domain, 'De-obfuscated'),
                        context: 'Found as obfuscated text'
                    });
                }
             }
        }

        // If not HTML, skip link extraction
        if (!$) continue;

        // B. Extract Emails from mailto: links (Higher confidence)
        $('a[href^="mailto:"]').each((_, el) => {
            const href = $(el).attr('href');
            const email = href.replace(/^mailto:/, '').split('?')[0].toLowerCase().trim();
            if (email && EMAIL_REGEX.test(email)) {
                const context = $(el).text().trim().substring(0, 50);
                foundEmails.set(email, {
                    email,
                    role: classifyRole(email),
                    source: currentUrl,
                    confidence: Math.min(calculateConfidence(email, domain, context) + 15, 100), // Boost for mailto
                    context: `Link text: ${context}`
                });
            }
        });

        // C. Extract Social Media Links (Optimization)
        $('a').each((_, el) => {
            const href = $(el).attr('href');
            if (!href) return;
            
            for (const [platform, regex] of Object.entries(SOCIAL_PLATFORMS)) {
                if (regex.test(href)) {
                    // Normalize or just keep the full URL
                    socialLinks.add(href);
                }
            }
        });

        // D. JSON-LD Extraction (Optimization)
        $('script[type="application/ld+json"]').each((_, el) => {
            try {
                const jsonContent = $(el).html();
                if (!jsonContent) return;
                
                const data = JSON.parse(jsonContent);
                // Handle array or object
                const items = Array.isArray(data) ? data : [data];
                
                items.forEach(item => {
                    // Check direct email field
                    if (item.email) {
                        const emails = Array.isArray(item.email) ? item.email : [item.email];
                        emails.forEach(email => {
                            if (typeof email === 'string' && email.includes('@')) {
                                const cleanEmail = email.toLowerCase().trim();
                                if (!foundEmails.has(cleanEmail)) {
                                    foundEmails.set(cleanEmail, {
                                        email: cleanEmail,
                                        role: classifyRole(cleanEmail),
                                        source: currentUrl,
                                        confidence: calculateConfidence(cleanEmail, domain, 'Structured Data'),
                                        context: 'Found in JSON-LD Schema'
                                    });
                                }
                            }
                        });
                    }
                    
                    // Check contactPoint
                    if (item.contactPoint) {
                        const points = Array.isArray(item.contactPoint) ? item.contactPoint : [item.contactPoint];
                        points.forEach(cp => {
                            if (cp.email) {
                                const cleanEmail = cp.email.toLowerCase().trim();
                                if (!foundEmails.has(cleanEmail)) {
                                    foundEmails.set(cleanEmail, {
                                        email: cleanEmail,
                                        role: classifyRole(cleanEmail),
                                        source: currentUrl,
                                        confidence: calculateConfidence(cleanEmail, domain, 'Structured Data'),
                                        context: 'Found in JSON-LD Schema (ContactPoint)'
                                    });
                                }
                            }
                        });
                    }
                    
                    // Check Social Links in sameAs
                    if (item.sameAs) {
                        const links = Array.isArray(item.sameAs) ? item.sameAs : [item.sameAs];
                        links.forEach(link => {
                            for (const [platform, regex] of Object.entries(SOCIAL_PLATFORMS)) {
                                if (regex.test(link)) {
                                    socialLinks.add(link);
                                }
                            }
                        });
                    }
                });
            } catch (e) {
                // JSON parse error
            }
        });


        // E. Find relevant sub-pages to crawl (Only from homepage or if queue is empty)
        // Also look for external links to ATS/Blogs/PR
        if (pagesCrawled === 1 && urlsToCrawl.length < 8) { // Only if we haven't found enough from sitemap
            $('a').each((_, el) => {
                const href = $(el).attr('href');
                if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

                try {
                    const nextUrl = new URL(href, currentUrl).toString();
                    const nextUrlObj = new URL(nextUrl);

                    // 1. Same Domain Crawling
                    if (nextUrlObj.hostname.includes(domain)) {
                        const path = nextUrlObj.pathname.toLowerCase();
                        // Heuristic: Prioritize Contact, About, Team, Careers, Press, Legal pages
                        const priorityKeywords = ['contact', 'about', 'team', 'people', 'career', 'job', 'connect', 'support', 'help', 'press', 'media', 'legal', 'privacy', 'news'];
                        
                        if (priorityKeywords.some(kw => path.includes(kw))) {
                            if (!visitedUrls.has(nextUrl) && !urlsToCrawl.includes(nextUrl)) {
                                urlsToCrawl.push(nextUrl);
                            }
                        }
                    } 
                    // 2. Whitelisted External Domain Crawling (New Feature)
                    else {
                        const isWhitelisted = EXTERNAL_DOMAINS.some(d => nextUrlObj.hostname.includes(d));
                        if (isWhitelisted) {
                            if (!visitedUrls.has(nextUrl) && !urlsToCrawl.includes(nextUrl)) {
                                console.log(`[ContactMiner] Found external source: ${nextUrl}`);
                                urlsToCrawl.push(nextUrl);
                            }
                        }
                    }
                } catch (e) {}
            });
        }
    }

    // 3. Pattern Guessing (Optimization)
    // If we have verified the domain exists (via MX or finding at least one valid email), we can guess standard roles.
    const hasVerifiedEmails = Array.from(foundEmails.values()).some(e => e.email.endsWith(domain));
    
    if (hasMx || hasVerifiedEmails) {
        const standardRoles = ['careers', 'jobs', 'hr', 'hello', 'contact', 'press', 'media', 'sales', 'info', 'team', 'support'];
        
        standardRoles.forEach(prefix => {
            const guessEmail = `${prefix}@${domain}`;
            if (!foundEmails.has(guessEmail)) {
                // Only add if we don't have a contact for this role yet? 
                // Or just add as low confidence option.
                foundEmails.set(guessEmail, {
                    email: guessEmail,
                    role: classifyRole(guessEmail),
                    source: 'Pattern Guessing',
                    confidence: 35, // Low confidence
                    context: 'Common role pattern (Unverified)'
                });
            }
        });
    }

    // 4. Format Results
    const results = Array.from(foundEmails.values())
        .sort((a, b) => b.confidence - a.confidence); // Highest confidence first

    return {
        success: true,
        company: domain,
        stats: {
            pagesCrawled,
            emailsFound: results.length,
            socialLinksFound: socialLinks.size
        },
        contacts: results,
        socialLinks: Array.from(socialLinks)
    };
}
