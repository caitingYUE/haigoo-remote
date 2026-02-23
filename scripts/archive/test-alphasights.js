import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { fetchJobDetails } from '../lib/job-crawler.js';

/**
 * Test script to verify AlphaSights JD extraction
 * Usage: node scripts/test-alphasights.js
 */

const ALPHASIGHTS_CAREERS_URL = 'https://www.alphasights.com/careers/open-roles/';

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

async function main() {
    console.log('=== Testing AlphaSights Parser ===\n');

    try {
        // First, fetch the careers page to find job links
        console.log(`Fetching careers page: ${ALPHASIGHTS_CAREERS_URL}`);
        const html = await fetchPage(ALPHASIGHTS_CAREERS_URL);

        // Look for job links
        const jobLinkMatch = html.match(/href="(\/careers\/[^"]+\/job\/[^"]+)"/);
        if (!jobLinkMatch) {
            // Try alternative pattern
            const altMatch = html.match(/href="(https:\/\/www\.alphasights\.com\/[^"]*job[^"]+)"/i);
            if (altMatch) {
                console.log(`Found job link (alternate): ${altMatch[1]}`);
            } else {
                console.log('No job links found on page');
                console.log('Page preview:', html.substring(0, 2000));
                return;
            }
        }

        // Use a known working job URL from the existing test
        const testUrl = 'https://www.alphasights.com/careers/open-roles/associate-client-service-2026/';
        console.log(`\nTesting job URL: ${testUrl}\n`);

        // Test fetchJobDetails
        const details = await fetchJobDetails(testUrl, false);

        console.log('--- Job Details ---');
        console.log(`Title: ${details.title}`);
        console.log(`Company: ${details.company?.name}`);
        console.log(`Description Length: ${details.description?.length || 0} chars`);
        console.log(`Apply URL: ${details.applyUrl}`);

        if (details.description && details.description.length > 100) {
            console.log(`\nDescription Preview: ${details.description.substring(0, 300)}...`);
            console.log('\n✅ SUCCESS: Got full description');
        } else {
            console.log(`\nDescription: "${details.description}"`);
            console.log('\n❌ FAIL: Description is empty or too short');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
    }
}

main().catch(console.error);
