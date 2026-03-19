import neonHelper from '../server-utils/dal/neon-helper.js';

async function checkConstraint() {
    try {
        const query = `
            SELECT conname, pg_get_constraintdef(c.oid)
            FROM pg_constraint c
            JOIN pg_namespace n ON n.oid = c.connamespace
            WHERE conrelid = 'trusted_companies'::regclass AND conname = 'valid_email_type';
        `;
        const result = await neonHelper.query(query);
        console.log('Constraint valid_email_type:', result);
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

checkConstraint();
