import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { crawlCompanyJobs } from '../lib/job-crawler.js';

/**
 * Comprehensive test of all 10 target companies
 * Usage: node scripts/test-all-companies.js
 */

const TARGET_COMPANIES = [
    { name: 'Kraken', url: 'https://jobs.ashbyhq.com/kraken.com', ats: 'Ashby', priority: 'P1' },
    { name: 'Whitespectre', url: 'https://apply.workable.com/whitespectre/', ats: 'Workable', priority: 'P2' },
    { name: 'Safetywing', url: 'https://safetywing.pinpointhq.com/', ats: 'Pinpoint', priority: 'P3' },
    { name: 'Osome', url: 'https://careers.osome.com/jobs', ats: 'Teamtailor', priority: 'P3' },
    { name: 'MixRank', url: 'https://www.ycombinator.com/companies/mixrank/jobs', ats: 'YC', priority: 'P3' },
    { name: 'Igalia', url: 'https://www.igalia.com/jobs/open/', ats: 'Custom', priority: 'P3' },
    { name: 'Taskade', url: 'https://www.taskade.com/jobs', ats: 'Custom', priority: 'P3' },
    // These need custom parsers to be created
    { name: 'ChainLink Labs', url: 'https://chainlinklabs.com/open-roles', ats: 'Custom', priority: 'P2' },
    { name: 'Yandex', url: 'https://yandex.com/jobs/vacancies?work_modes=remote', ats: 'Custom', priority: 'P2' },
];

async function testCompany(company) {
    console.log(`\n=== ${company.name} (${company.ats}) [${company.priority}] ===`);
    console.log(`URL: ${company.url}`);

    try {
        // Use crawlCompanyJobs to test the full pipeline
        const result = await crawlCompanyJobs(
            company.name.toLowerCase().replace(/\s+/g, '-'),
            company.name,
            company.url,
            { maxJobs: 5 }
        );

        if (!result || !result.jobs) {
            console.log('❌ No result returned from parser');
            return { name: company.name, status: 'FAIL', reason: 'No result', jobs: 0 };
        }

        const jobCount = result.jobs.length;
        console.log(`Jobs found: ${jobCount}`);

        if (jobCount === 0) {
            return { name: company.name, status: 'FAIL', reason: 'No jobs found', jobs: 0 };
        }

        // Check job quality
        const firstJob = result.jobs[0];
        const hasTitle = !!firstJob.title;
        const hasUrl = !!firstJob.url;
        const descLen = firstJob.description?.length || 0;
        const hasDesc = descLen > 50;

        console.log(`Sample: "${firstJob.title?.substring(0, 50)}..."`);
        console.log(`Description: ${descLen} chars`);

        if (hasDesc) {
            console.log('✅ PASS');
            return { name: company.name, status: 'PASS', jobs: jobCount, descLength: descLen };
        } else {
            console.log('⚠️ PARTIAL');
            return { name: company.name, status: 'PARTIAL', jobs: jobCount, descLength: descLen, desc: firstJob.description };
        }

    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
        return { name: company.name, status: 'ERROR', reason: error.message, jobs: 0 };
    }
}

async function main() {
    console.log('=== Comprehensive Company Crawler Test ===\n');

    const results = [];

    for (const company of TARGET_COMPANIES) {
        const result = await testCompany(company);
        results.push(result);
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log('Company              | Status      | Jobs | Desc Length');
    console.log('-'.repeat(60));

    for (const r of results) {
        const status = r.status === 'PASS' ? '✅ PASS   ' : r.status === 'PARTIAL' ? '⚠️ PARTIAL' : '❌ FAIL   ';
        const info = r.descLength ?? r.reason ?? '';
        console.log(`${r.name.padEnd(20)} | ${status} | ${String(r.jobs).padEnd(4)} | ${info}`);
    }
}

main().catch(console.error);
