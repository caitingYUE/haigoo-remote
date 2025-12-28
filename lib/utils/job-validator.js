
/**
 * Job Validation Rules and Logic
 */

export const JOB_VALIDATION_RULES = {
    // Description must be at least this long (cleaned text) to be considered a real JD
    MIN_DESC_LENGTH: 200,

    // Regex patterns that indicate a non-JD content (e.g. footer links, cookie consent)
    // These should be matched against cleaner text
    BAD_CONTENT_PATTERNS: [
        /^privacy policy$/i,
        /^terms of use$/i,
        /^measure measure$/i,         // Common placeholder
        /read mongodb's website terms of use/i, // Specific bad case found in review
        /accept.*cookie/i,            // Cookie consent banners
        /^loading\.\.\.$/i,
        /^enable javascript/i,
    ],

    // Invalid company names
    INVALID_COMPANIES: [
        'Unknown Company',
        'null',
        'undefined'
    ]
};

/**
 * Validates a job object.
 * @param {Object} job - The job object (must have title, company, description)
 * @param {string} [sourceType='official'] - 'official' (Trusted) or 'third-party' (RSS)
 * @returns {Object} { isValid: boolean, reason: string | null }
 */
export function validateJob(job, sourceType = 'official') {
    // 1. Check Company Name (Global Rule)
    if (!job.company || JOB_VALIDATION_RULES.INVALID_COMPANIES.includes(job.company.trim())) {
        return { isValid: false, reason: 'INVALID_COMPANY_NAME' };
    }

    // 2. Check Description Existence (Global Rule)
    if (!job.description || typeof job.description !== 'string') {
        return { isValid: false, reason: 'MISSING_DESCRIPTION' };
    }

    // 3. Clean Description (Strip HTML for validation)
    const cleanDesc = job.description.replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // 4. Check Description Length (Context Aware)
    // Trusted Jobs: Must have substantial content (bad crawl check) -> 200 chars
    // RSS Jobs: Often just snippets, so be lenient -> 50 chars
    const minLength = sourceType === 'official' ? JOB_VALIDATION_RULES.MIN_DESC_LENGTH : 50;

    if (cleanDesc.length < minLength) {
        return { isValid: false, reason: `DESCRIPTION_TOO_SHORT (${cleanDesc.length} < ${minLength})` };
    }

    // 5. Check Bad Patterns
    for (const pattern of JOB_VALIDATION_RULES.BAD_CONTENT_PATTERNS) {
        if (pattern.test(cleanDesc)) {
            return { isValid: false, reason: `INVALID_DESCRIPTION_CONTENT (Matched: ${pattern})` };
        }
    }

    return { isValid: true, reason: null };
}
