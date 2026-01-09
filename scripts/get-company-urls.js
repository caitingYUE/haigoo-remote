import neonHelper from '../server-utils/dal/neon-helper.js';

const companies = [
    'Eigen AI',
    'Osome',
    'Canonical',
    'Progress Chef',
    'Taskade',
    'Grafana Labs',
    'Docker'
];

async function main() {
    try {
        console.log('Connecting to DB...');
        const results = await neonHelper.query(
            `SELECT name, careers_page FROM trusted_companies WHERE name = ANY($1)`,
            [companies]
        );
        
        console.log('Found companies:');
        results.forEach(c => {
            console.log(`${c.name}: ${c.careers_page}`);
        });
        
        // Also list missing ones
        const foundNames = results.map(r => r.name);
        const missing = companies.filter(c => !foundNames.includes(c));
        if (missing.length > 0) {
            console.log('\nMissing companies in DB:', missing);
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

main();
