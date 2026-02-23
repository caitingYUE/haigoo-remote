import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

/**
 * Test script for verifying 10 target company crawlers
 * Usage: node scripts/test-target-companies.js
 */

// Target companies with their career URLs
const TARGET_COMPANIES = [
    { name: 'Kraken', url: 'https://jobs.ashbyhq.com/kraken.com', ats: 'Ashby', priority: 'P1' },
    { name: 'AlphaSights', url: 'https://www.alphasights.com/careers/open-roles/', ats: 'Custom', priority: 'P1' },
    { name: 'Whitespectre', url: 'https://apply.workable.com/whitespectre/', ats: 'Workable', priority: 'P2' },
    { name: 'ChainLink Labs', url: 'https://chainlinklabs.com/open-roles', ats: 'Custom', priority: 'P2' },
    { name: 'Yandex', url: 'https://yandex.com/jobs/vacancies?work_modes=remote', ats: 'Custom', priority: 'P2' },
    { name: 'Taskade', url: 'https://www.taskade.com/jobs', ats: 'Custom', priority: 'P3' },
    { name: 'Igalia', url: 'https://www.igalia.com/jobs/open/', ats: 'Custom', priority: 'P3' },
    { name: 'MixRank', url: 'https://www.ycombinator.com/companies/mixrank/jobs', ats: 'YC', priority: 'P3' },
    { name: 'Safetywing', url: 'https://safetywing.pinpointhq.com/', ats: 'Pinpoint', priority: 'P3' },
    { name: 'Osome', url: 'https://careers.osome.com/jobs', ats: 'Teamtailor', priority: 'P3' },
];

async function fetchPage(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.text();
}

async function testAshbyPage(company) {
    console.log(`\n=== Testing ${company.name} (Ashby) ===`);
    console.log(`URL: ${company.url}`);

    try {
        const html = await fetchPage(company.url);

        // Extract __appData
        const appDataMatch = html.match(/window\.__appData\s*=\s*({[^;]+});/);
        if (!appDataMatch) {
            console.log('❌ No __appData found');
            return { success: false, error: 'No __appData' };
        }

        const appData = JSON.parse(appDataMatch[1]);
        const jobs = appData.jobBoard?.jobPostings || [];

        console.log(`✅ Found ${jobs.length} jobs in __appData`);

        if (jobs.length > 0) {
            const firstJob = jobs[0];
            console.log('\n📋 Sample job structure:');
            console.log(`  - id: ${firstJob.id}`);
            console.log(`  - title: ${firstJob.title}`);
            console.log(`  - department: ${firstJob.departmentName}`);
            console.log(`  - location: ${firstJob.locationName}`);
            console.log(`  - employmentType: ${firstJob.employmentType}`);
            console.log(`  - workplaceType: ${firstJob.workplaceType}`);
            console.log(`  - isListed: ${firstJob.isListed}`);
            console.log(`  - descriptionHtml: ${firstJob.descriptionHtml ? `(${firstJob.descriptionHtml.length} chars)` : 'NOT PRESENT'}`);
            console.log(`  - descriptionPlain: ${firstJob.descriptionPlain ? `(${firstJob.descriptionPlain.length} chars)` : 'NOT PRESENT'}`);

            // Check all available keys
            console.log(`  - All keys: ${Object.keys(firstJob).join(', ')}`);
        }

        return { success: true, jobCount: jobs.length };
    } catch (error) {
        console.log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('Starting Target Company Crawler Tests...\n');
    console.log('Testing P1 priority first: Kraken (Ashby)');

    // Test Kraken (Ashby) first
    const kraken = TARGET_COMPANIES.find(c => c.name === 'Kraken');
    await testAshbyPage(kraken);
}

main().catch(console.error);
