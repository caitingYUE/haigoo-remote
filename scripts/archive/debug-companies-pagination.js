
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getCompaniesPaginated } from '../lib/api-handlers/trusted-companies.js';

async function debugPagination() {
    console.log('Debugging getCompaniesPaginated for Kraken...');
    try {
        const result = await getCompaniesPaginated({
            page: 1,
            limit: 20,
            search: 'Kraken',
            isTrusted: 'yes' // Admin page usually filters by trusted? Or maybe not.
        });

        console.log('Result total:', result.total);
        if (result.companies.length > 0) {
            const kraken = result.companies.find(c => c.name.includes('Kraken'));
            if (kraken) {
                console.log('Kraken Company Data:');
                console.log('ID:', kraken.id);
                console.log('Name:', kraken.name);
                console.log('Job Count (returned):', kraken.jobCount);
                // We can't see internal row.approved_job_count here, but we can see the final output
            } else {
                console.log('Kraken not found in result list');
            }
        } else {
            console.log('No companies found');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}

debugPagination();
