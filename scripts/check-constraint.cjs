const neonHelper = require('../server-utils/neon-helper.js');

async function checkConstraint() {
    try {
        const query = `
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'trusted_companies'::regclass;
        `;
        const result = await neonHelper.default.query(query); // Check neonHelper export format if undefined
        console.log('Constraints on trusted_companies:', result);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkConstraint();
