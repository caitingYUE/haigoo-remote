
import * as cheerio from 'cheerio'

// Helper to clean text
const cleanText = (text) => text ? text.replace(/\s+/g, ' ').trim() : ''

// Helper to check if a job is restricted to non-China regions
function isJobAllowedForChina(title, location, countryCode = null) {
    const text = (title + ' ' + location).toLowerCase()

    // 0. Check Country Code (ISO 2)
    // Block US/North America/Europe if country code is explicit
    const restrictedCountries = [
        'US', 'CA', 'MX', // North America
        'GB', 'IE', 'DE', 'FR', 'ES', 'IT', 'PT', 'NL', 'BE', 'SE', 'NO', 'DK', 'FI', 'AT', 'CH', 'PL', 'UA', 'RU', // Europe
        'AU', 'NZ', // Oceania
        'BR', 'AR', 'CO', 'PE', 'CL' // LatAm
    ]

    if (countryCode && restrictedCountries.includes(countryCode.toUpperCase())) {
        // BUT check if it explicitly says "Global" or "Anywhere" or "China"
        const allowedOverrides = [/global/, /worldwide/, /anywhere/, /china/, /asia/, /apac/]
        if (!allowedOverrides.some(p => p.test(text))) {
            return false
        }
    }

    // 1. Explicitly allowed for China/Asia or Global
    // 'china', 'chinese', 'mandarin', 'asia', 'apac' are strong indicators of China-friendliness
    // 'global', 'worldwide', 'anywhere' imply no restrictions
    const allowedPatterns = [
        /china/, /chinese/, /mandarin/,
        /asia/, /apac/,
        /global/, /worldwide/, /anywhere/
    ]

    if (allowedPatterns.some(p => p.test(text))) {
        return true // Explicitly allowed
    }

    // 2. Explicitly restricted regions (excluding China)
    // Filter out jobs that mention these regions without mentioning allowed patterns
    const restrictedPatterns = [
        /\blatam\b/, /latin america/, /south america/, /north america/, /americas/,
        /\busa?\b/, /united states/, /\bcanad[a|ian]\b/, /mexic[o|an]/,
        /\beurope\b/, /\beu\b/, /\bemea\b/, /\buk\b/, /united kingdom/, /ireland/, /dublin/, /london/,
        /germany/, /france/, /spain/, /italy/, /portugal/, /poland/, /ukraine/,
        /sweden/, /stockholm/, /norway/, /oslo/, /denmark/, /copenhagen/, /finland/, /helsinki/, // Nordics
        /netherlands/, /amsterdam/, /belgium/, /brussels/, /switzerland/, /zurich/, /austria/, /vienna/,
        /australia/, /new zealand/,
        /brazil/, /argentina/, /colombia/, /peru/, /chile/
    ]

    if (restrictedPatterns.some(p => p.test(text))) {
        return false // Restricted to non-China region
    }

    // 3. Default: Keep (Unspecified, or just "Remote" without qualification)
    return true
}

/**
 * Specialized crawler for Red Hat (Workday)
 */
export async function crawlRedHatJobs(url) {
    console.log('[SpecialCrawler] Crawling Red Hat (Workday)...')
    try {
        // Workday API endpoint
        // URL pattern: https://redhat.wd5.myworkdayjobs.com/jobs/
        // API pattern: https://redhat.wd5.myworkdayjobs.com/wday/cxs/redhat/jobs/jobs

        // Extract tenant and site from URL if possible, otherwise hardcode for known Red Hat
        const apiEndpoint = 'https://redhat.wd5.myworkdayjobs.com/wday/cxs/redhat/jobs/jobs'

        const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({
                "limit": 20, // Reduced from 50 to match working debug payload
                "offset": 0,
                "searchText": ""
            })
        })

        if (!response.ok) {
            throw new Error(`Workday API error: ${response.status}`)
        }

        const data = await response.json()
        if (!data.jobPostings) return []

        return data.jobPostings.map(job => ({
            title: job.title,
            url: `https://redhat.wd5.myworkdayjobs.com/jobs${job.externalPath}`,
            location: job.locationsText || 'Remote',
            type: 'Full-time', // Workday usually implies full-time or lists it
            sourceType: 'trusted',
            isTrusted: true
        }))

    } catch (e) {
        console.error('[SpecialCrawler] Red Hat error:', e)
        return []
    }
}

/**
 * Specialized crawler for SafetyWing (Pinpoint)
 */
export async function crawlSafetyWingJobs(url) {
    console.log('[SpecialCrawler] Crawling SafetyWing (Pinpoint)...')
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        })

        if (!response.ok) {
            console.log(`[SpecialCrawler] SafetyWing request failed: ${response.status}`)
            return []
        }

        const html = await response.text()
        const $ = cheerio.load(html)
        const jobs = []

        // Pinpoint HTML parser strategies
        // Strategy 1: Look for job cards (based on CSS in page)
        $('.careers-card-block, .pinpoint-job-card, .job-listing').each((i, el) => {
            const title = $(el).find('h3, .job-title, .title').first().text().trim()
            let link = $(el).find('a').attr('href')
            const location = $(el).find('.location, .job-location').text().trim() || 'Remote'

            if (title && link) {
                if (!link.startsWith('http')) {
                    link = new URL(link, url).href
                }

                jobs.push({
                    title,
                    url: link,
                    location,
                    type: 'Full-time', // Default
                    description: '',
                    sourceType: 'trusted',
                    isTrusted: true
                })
            }
        })

        // Strategy 2: Look for JSON data embedded in script tags (React props)
        if (jobs.length === 0) {
            console.log('[SpecialCrawler] No HTML job cards found, checking for embedded JSON...')
            // Sometimes Pinpoint puts data in a script tag like we saw in the dump (though it was empty of jobs there)
            // We can check if future updates bring data back
        }

        console.log(`[SpecialCrawler] SafetyWing parser found ${jobs.length} jobs`)
        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] SafetyWing error:', e)
        return []
    }
}

/**
 * Specialized crawler for Automattic
 */
export async function crawlAutomatticJobs(url) {
    console.log('[SpecialCrawler] Crawling Automattic...')
    try {
        // Automattic jobs are on https://automattic.com/work-with-us/ usually
        // But the user provided https://automattic.com/jobs/
        // We will fetch the provided URL, and if no jobs found, try /work-with-us/

        const urlsToTry = [url];
        if (!url.includes('work-with-us')) {
            urlsToTry.push('https://automattic.com/work-with-us/');
        }

        const jobs = [];
        const seenUrls = new Set();

        for (const targetUrl of urlsToTry) {
            console.log(`[SpecialCrawler] Fetching ${targetUrl}...`);
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            })

            if (!response.ok) continue;

            const html = await response.text()
            const $ = cheerio.load(html)

            // Automattic often puts job links in encoded HTML entities inside the body or scripts
            // Example: href="https://automattic.com/work-with-us/job/..." or with escaped slashes
            // We search for this specific pattern in the raw HTML
            const rawJobMatches = html.matchAll(/automattic\.com\\?\/work-with-us\\?\/job\\?\/([^"&]+)/g);
            for (const match of rawJobMatches) {
                const slug = match[1];
                // Construct clean URL
                const fullUrl = `https://automattic.com/work-with-us/job/${slug.replace(/\\/g, '')}`;

                if (!seenUrls.has(fullUrl)) {
                    seenUrls.add(fullUrl);
                    // Extract title from slug
                    let title = slug.replace(/\\/g, '').replace(/\/$/, '').replace(/-/g, ' ');
                    title = title.charAt(0).toUpperCase() + title.slice(1);

                    jobs.push({
                        title: title,
                        url: fullUrl,
                        location: 'Remote',
                        type: 'Full-time',
                        sourceType: 'trusted',
                        isTrusted: true
                    });
                }
            }

            // Standard link scanner (fallback)
            const keywords = ['Engineer', 'Designer', 'Wrangler', 'Developer', 'Lead', 'Head', 'Director', 'Support', 'Marketer']

            $('a').each((i, el) => {
                const $el = $(el)
                const text = cleanText($el.text())
                const href = $el.attr('href')

                if (!href || href.startsWith('#') || href.startsWith('mailto:')) return

                // Check if text matches a job title pattern
                if (keywords.some(k => text.includes(k)) && text.length < 100) {
                    // Exclude some common false positives
                    if (text.includes('Blog') || text.includes('About') || text.includes('Contact')) return

                    const fullUrl = href.startsWith('http') ? href : new URL(href, targetUrl).toString()

                    if (!seenUrls.has(fullUrl)) {
                        seenUrls.add(fullUrl)
                        jobs.push({
                            title: text,
                            url: fullUrl,
                            location: 'Remote', // Automattic is fully remote
                            type: 'Full-time',
                            sourceType: 'trusted',
                            isTrusted: true
                        })
                    }
                }
            })

            if (jobs.length > 0) break; // If we found jobs, stop trying other URLs
        }

        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] Automattic error:', e)
        return []
    }
}

/**
 * Specialized crawler for X-Team
 */
export async function crawlXTeamJobs(url) {
    console.log('[SpecialCrawler] Crawling X-Team...')
    try {
        // X-Team is a dynamic SPA (Gatsby) with a protected API (jobs-bh.x-team.com returns 403).
        // The page-data.json files do not contain job data.
        // We will fall back to creating a "General Application" job since specific roles are not crawlable.

        const jobs = [];
        const baseUrl = 'https://jobs.x-team.com';

        // 1. Verify the site is up
        try {
            const res = await fetch(baseUrl, { method: 'HEAD' });
            if (res.ok) {
                jobs.push({
                    title: 'Join X-Team (General Application)',
                    url: baseUrl,
                    location: 'Remote',
                    type: 'Full-time',
                    description: 'X-Team is a community of developers. Apply to join the network and get matched with opportunities.',
                    sourceType: 'trusted',
                    isTrusted: true
                });
            }
        } catch (e) {
            console.error('[SpecialCrawler] X-Team connectivity check failed:', e);
        }

        return jobs;

    } catch (e) {
        console.error('[SpecialCrawler] X-Team error:', e)
        return []
    }
}

export async function crawlBraintrustJobs(url) {
    console.log(`[SpecialCrawler] Crawling Braintrust with URL: ${url}`)
    try {
        let nextUrl = ''
        let employerId = '2' // Default

        // 1. Direct API URL provided
        if (url.includes('api/jobs')) {
            nextUrl = url
            // Append limit if not present
            if (!nextUrl.includes('limit=')) {
                nextUrl += (nextUrl.includes('?') ? '&' : '?') + 'limit=100'
            }
        } else {
            // 2. Try to extract from URL path: /employers/123/
            const matchPath = url.match(/employers\/(\d+)/)
            if (matchPath) {
                employerId = matchPath[1]
            } else {
                // 3. Try to extract from query param: ?employer_id=123
                try {
                    const urlObj = new URL(url)
                    const paramId = urlObj.searchParams.get('employer_id')
                    if (paramId) {
                        employerId = paramId
                    }
                } catch (e) {
                    console.warn('[SpecialCrawler] Failed to parse URL for Braintrust employer_id:', e)
                }
            }
            nextUrl = `https://app.usebraintrust.com/api/jobs/?employer_id=${employerId}&limit=100`
        }

        const jobs = []
        let pageCount = 0
        const MAX_PAGES = 50 // Safety limit to prevent infinite loops

        while (nextUrl && pageCount < MAX_PAGES) {
            pageCount++
            console.log(`[SpecialCrawler] Fetching page ${pageCount}: ${nextUrl}...`)

            // Add 15s timeout for robustness
            const controller = new AbortController()
            const timeoutId = setTimeout(() => controller.abort(), 15000)

            try {
                const response = await fetch(nextUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    signal: controller.signal
                })
                clearTimeout(timeoutId)

                if (!response.ok) {
                    console.error(`[SpecialCrawler] Braintrust API error: ${response.status} ${response.statusText}`)
                    break
                }

                const data = await response.json()
                const results = data.results || []

                if (results.length === 0) {
                    // If empty results, stop
                    break
                }

                // Filter jobs first
                const validJobs = []
                for (const job of results) {
                    const employerName = job.employer ? job.employer.name : 'Unknown'
                    const title = job.title

                    // Prepare location string for filtering
                    let locationStr = (job.locations && job.locations.length > 0) ? job.locations.map(l => l.location).join(', ') : 'Remote'

                    // Extract Country Code
                    let countryCode = null
                    if (job.locations && job.locations.length > 0) {
                        const firstLoc = job.locations.find(l => l.country)
                        if (firstLoc) countryCode = firstLoc.country
                    }

                    // Filter out jobs restricted to non-China regions
                    if (!isJobAllowedForChina(title, locationStr, countryCode)) {
                        console.log(`[SpecialCrawler] Filtered out restricted job: ${title} (${locationStr}) [${countryCode}]`)
                        continue
                    }

                    validJobs.push({ job, employerName, locationStr, title })
                }

                // Fetch details for valid jobs in batches (concurrency: 5)
                const BATCH_SIZE = 5;
                for (let i = 0; i < validJobs.length; i += BATCH_SIZE) {
                    const batch = validJobs.slice(i, i + BATCH_SIZE);
                    console.log(`[SpecialCrawler] Fetching details for batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validJobs.length / BATCH_SIZE)}...`);

                    await Promise.all(batch.map(async (item) => {
                        const { job, employerName, locationStr, title } = item;

                        // Fetch Full Description
                        let fullDescription = '';
                        try {
                            const detailUrl = `https://app.usebraintrust.com/api/jobs/${job.id}/`;
                            const detailRes = await fetch(detailUrl, {
                                headers: { 'User-Agent': 'Mozilla/5.0' }
                            });
                            if (detailRes.ok) {
                                const detailData = await detailRes.json();
                                fullDescription = detailData.description || '';
                                // Basic cleanup
                                fullDescription = fullDescription.replace(/ style="[^"]*"/g, ''); // Remove inline styles
                            }
                        } catch (err) {
                            console.warn(`[SpecialCrawler] Failed to fetch details for job ${job.id}:`, err.message);
                        }

                        // Prepend employer name to title for clarity
                        const fullTitle = employerName !== 'Freelance Labs, Inc.' && employerName !== 'Braintrust'
                            ? `${title} (@${employerName})`
                            : job.title

                        const jobUrl = `https://app.usebraintrust.com/jobs/${job.id}/`

                        // Construct a rich description
                        const skills = job.main_skills ? job.main_skills.map(s => s.name).join(', ') : ''
                        const roleName = job.role ? job.role.name : ''

                        let description = `<p><strong>Employer:</strong> ${employerName}</p>`
                        if (job.budget_minimum_usd) {
                            description += `<p><strong>Budget:</strong> $${job.budget_minimum_usd} - $${job.budget_maximum_usd} / ${job.payment_type}</p>`
                        }
                        if (skills) {
                            description += `<p><strong>Skills:</strong> ${skills}</p>`
                        }
                        if (roleName) {
                            description += `<p><strong>Role Category:</strong> ${roleName}</p>`
                        }
                        if (job.expected_hours_per_week) {
                            description += `<p><strong>Expected Hours:</strong> ${job.expected_hours_per_week} hrs/week</p>`
                        }

                        // Append the fetched full description
                        if (fullDescription) {
                            description += `<hr /><h3>Job Description</h3>${fullDescription}`;
                        }

                        description += `<p><a href="${jobUrl}">View full job details on Braintrust</a></p>`

                        let safeLocation = locationStr;
                        if (safeLocation.length > 190) {
                            safeLocation = safeLocation.substring(0, 190) + '...'
                        }

                        jobs.push({
                            title: fullTitle,
                            url: jobUrl,
                            location: safeLocation,
                            type: job.job_type === 'freelance' ? 'freelance' : 'full-time',
                            description: description,
                            salary: job.budget_minimum_usd ? `$${job.budget_minimum_usd} - $${job.budget_maximum_usd} / ${job.payment_type}` : null,
                            publishedAt: job.created,
                            sourceType: 'trusted',
                            isTrusted: true,
                            company: 'Braintrust' // Ensure it maps to the trusted company record
                        })
                    }));
                }

                // Handle pagination (ensure HTTPS)
                nextUrl = data.next
                if (nextUrl && nextUrl.startsWith('http:')) {
                    nextUrl = nextUrl.replace('http:', 'https:')
                }
            } catch (fetchErr) {
                clearTimeout(timeoutId)
                if (fetchErr.name === 'AbortError') {
                    console.error(`[SpecialCrawler] Timeout fetching page ${pageCount}`)
                } else {
                    console.error(`[SpecialCrawler] Error fetching page ${pageCount}:`, fetchErr)
                }
                break // Stop on error to avoid partial/corrupt data loops
            }
        }

        console.log(`[SpecialCrawler] Braintrust found ${jobs.length} jobs`)
        return jobs

    } catch (e) {
        console.error('[SpecialCrawler] Braintrust error:', e)
        return []
    }
}

export async function crawlAutoArkJobs(url) {
    console.log('[SpecialCrawler] Crawling AutoArk...')
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return [];

        const html = await response.text();
        // Since AutoArk is a Next.js app, we can try to extract data from __next_f scripts
        // But parsing raw script content is fragile.
        // Let's use Cheerio to find the job blocks if they are rendered (SSR)
        // Based on analysis, the content IS in the HTML (SSR)
        
        const $ = cheerio.load(html);
        const jobs = [];

        // Analysis of HTML:
        // Structure: div with text-muted-foreground -> h3 (Title) -> div (Responsibilities) -> div (Requirements)
        // We can iterate over the h3 elements that look like job titles
        
        $('h3.fontsize-responsive-30').each((i, el) => {
            const $title = $(el);
            const title = cleanText($title.text());
            
            // Skip non-job titles (like "JOIN US" parts if any)
            if (title.length < 2 || title.includes('欢迎') || title.includes('JOIN')) return;

            // The job details are in the sibling/parent container
            // The structure is: 
            // div.text-muted-foreground
            //   h3 (Title)
            //   div (Responsibilities)
            //   div (Requirements)
            
            const container = $title.parent();
            
            // Extract Description
            // We want to capture the whole container content except the title
            let description = '';
            
            container.find('div').each((j, div) => {
                const $div = $(div);
                // Convert to markdown-like text
                const sectionTitle = $div.find('h4').text();
                const items = $div.find('li').map((k, li) => '- ' + $(li).text()).get().join('\n');
                
                if (sectionTitle && items) {
                    description += `### ${sectionTitle}\n${items}\n\n`;
                }
            });

            // If no structured divs found, try raw text
            if (!description) {
                description = cleanText(container.text().replace(title, ''));
            }

            // Generate a unique anchor/ID for the URL
            // e.g. https://autoarkai.com/join-us#cmo
            const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const jobUrl = `${url}#${slug}`;

            jobs.push({
                title,
                url: jobUrl,
                location: 'Shenzhen, China', // AutoArk is based in Shenzhen/Hong Kong usually, default to China
                type: 'Full-time',
                description: description.trim(),
                sourceType: 'trusted',
                isTrusted: true
            });
        });

        console.log(`[SpecialCrawler] AutoArk found ${jobs.length} jobs`);
        return jobs;

    } catch (e) {
        console.error('[SpecialCrawler] AutoArk error:', e);
        return [];
    }
}

export async function crawlZohoRecruitJobs(url) {
    console.log('[SpecialCrawler] Crawling Zoho Recruit...');
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const jobs = [];

        // Zoho Recruit often embeds data in a hidden input with id="jobs"
        // The value is a JSON string of job objects
        const jobsInput = $('#jobs');
        if (jobsInput.length > 0) {
            try {
                const rawValue = jobsInput.val();
                if (rawValue) {
                    const jobsData = JSON.parse(rawValue);
                    
                    if (Array.isArray(jobsData)) {
                        for (const job of jobsData) {
                            if (!job.Publish) continue; // Skip unpublished

                            // Construct URL
                            // Pattern: ${baseUrl}/${id}/${slug}?source=CareerSite
                            // We need to clean the base URL (remove trailing slash)
                            const baseUrl = url.replace(/\/$/, '');
                            // Slugify the Job_Opening_Name or Posting_Title
                            const slugName = (job.Job_Opening_Name || job.Posting_Title || 'job')
                                .replace(/[^a-zA-Z0-9]+/g, '-')
                                .replace(/^-+|-+$/g, '');
                            
                            const jobUrl = `${baseUrl}/${job.id}/${slugName}?source=CareerSite`;

                            // Extract Location
                            let location = 'Remote';
                            if (job.Remote_Job) {
                                location = 'Remote';
                            } else if (job.City || job.Country) {
                                location = [job.City, job.State, job.Country].filter(Boolean).join(', ');
                            }

                            // Description is often in HTML format in Job_Description
                            // We might need to decode HTML entities if it's double encoded, but usually JSON parse handles the first layer.
                            const description = job.Job_Description || '';

                            jobs.push({
                                title: job.Posting_Title || job.Job_Opening_Name,
                                url: jobUrl,
                                location: location,
                                type: job.Job_Type || 'Full-time',
                                description: description,
                                publishedAt: job.Date_Opened,
                                sourceType: 'trusted',
                                isTrusted: true
                            });
                        }
                    }
                }
            } catch (parseErr) {
                console.error('[SpecialCrawler] Error parsing Zoho Recruit JSON:', parseErr);
            }
        }

        console.log(`[SpecialCrawler] Zoho Recruit found ${jobs.length} jobs`);
        return jobs;

    } catch (e) {
        console.error('[SpecialCrawler] Zoho Recruit error:', e);
        return [];
    }
}

export async function dispatchSpecialCrawler(url) {
    if (url.includes('redhat.wd5.myworkdayjobs.com')) {
        return crawlRedHatJobs(url)
    }
    if (url.includes('safetywing.pinpointhq.com')) {
        return crawlSafetyWingJobs(url)
    }
    // Match ANY Braintrust URL (employers page OR direct API)
    if (url.includes('usebraintrust.com') && (url.includes('employers') || url.includes('api/jobs'))) {
        return crawlBraintrustJobs(url)
    }
    if (url.includes('automattic.com')) {
        return crawlAutomatticJobs(url)
    }
    if (url.includes('jobs.x-team.com')) {
        return crawlXTeamJobs(url)
    }
    if (url.includes('autoarkai.com')) {
        return crawlAutoArkJobs(url)
    }
    if (url.includes('zohorecruit.com')) {
        return crawlZohoRecruitJobs(url)
    }
    return null
}
