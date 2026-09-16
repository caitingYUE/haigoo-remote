// One statement keeps the company, current jobs and historical availability atomic.
// Same-name jobs already assigned to another company must not be touched.
export const DEACTIVATE_COMPANY_SQL = `
    WITH deactivated AS (
        UPDATE trusted_companies SET status = 'inactive', job_count = 0, updated_at = NOW()
        WHERE company_id = $1 RETURNING company_id, name
    ), hidden_jobs AS (
        UPDATE jobs j SET status = 'inactive', updated_at = NOW()
        FROM deactivated c
        WHERE j.company_id = c.company_id OR (j.company_id IS NULL AND j.company = c.name)
        RETURNING j.job_id
    ), closed_history AS (
        UPDATE company_job_history h
        SET is_public_opportunity = FALSE, closed_at = COALESCE(h.closed_at, NOW()), updated_at = NOW()
        FROM deactivated c WHERE h.company_id = c.company_id
        RETURNING h.history_id
    )
    SELECT company_id, (SELECT COUNT(*)::int FROM hidden_jobs) AS hidden_jobs
    FROM deactivated
`

export async function deactivateCompany(db, id) {
    const rows = await db.query(DEACTIVATE_COMPANY_SQL, [id])
    return rows?.[0] || null
}
