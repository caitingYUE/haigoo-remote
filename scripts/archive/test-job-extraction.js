import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });
import { fetchJobDetails } from '../lib/job-crawler.js';

async function testExtraction() {
    const testCases = [
        {
            name: 'Himalayas (Dynamic Content)',
            url: 'https://himalayas.app/companies/highnote/jobs/solutions-engineer-13038670868',
            expected: (details) => details.description && details.description.length > 100
        },
        {
            name: 'AlphaSights (Custom Parser)',
            url: 'https://www.alphasights.com/job/associate-client-service-2026/',
            expected: (details) => details.description && details.description.length > 100 && details.company.name.toLowerCase().includes('alphasights')
        }
    ];

    console.log('Starting Job Extraction Tests...\n');

    for (const test of testCases) {
        console.log(`Testing: ${test.name}`);
        console.log(`URL: ${test.url}`);
        
        try {
            const startTime = Date.now();
            // Use AI fallback if selectors fail (second param true)
            const details = await fetchJobDetails(test.url, true);
            const duration = Date.now() - startTime;

            console.log(`Status: ${details.description ? 'Success' : 'Failed'}`);
            console.log(`Time: ${duration}ms`);
            console.log(`Title: ${details.title}`);
            console.log(`Company: ${details.company?.name}`);
            console.log(`Apply URL: ${details.applyUrl}`);
            console.log(`Description Length: ${details.description?.length}`);
            
            if (test.expected(details)) {
                console.log('✅ PASS');
            } else {
                console.log('❌ FAIL: Criteria not met');
                if (!details.description) console.log('   Reason: Description is empty');
                
                // Hint for AI fallback
                if (!process.env.VITE_ALIBABA_BAILIAN_API_KEY && !process.env.ALIBABA_BAILIAN_API_KEY) {
                    console.log('   ⚠️ HINT: This test might require AI fallback which needs VITE_ALIBABA_BAILIAN_API_KEY in .env');
                }
            }
        } catch (e) {
            console.error(`❌ ERROR: ${e.message}`);
        }
        console.log('----------------------------------------\n');
    }
}

testExtraction();
