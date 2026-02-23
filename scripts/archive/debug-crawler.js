import 'dotenv/config';
import { fetchJobDetails } from '../lib/job-crawler.js';

async function main() {
    const url = 'https://himalayas.app/companies/highnote/jobs/solutions-engineer-13038670868';
    console.log(`Testing enrichment for: ${url}`);
    
    try {
    const details = await fetchJobDetails(url, true); // Enable AI
    console.log('--- Result ---');
        console.log('Title:', details.title);
        console.log('Company:', details.company?.name);
        console.log('Desc Length:', details.description?.length);
        console.log('Desc Preview:', details.description?.substring(0, 200));
        console.log('Logo:', details.company?.logo);
    } catch (e) {
        console.error('Error:', e);
    }
}

main();
