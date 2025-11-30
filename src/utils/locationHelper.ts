
// Standard list of countries and major regions for normalization
const STANDARD_LOCATIONS = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 
    'France', 'Netherlands', 'Sweden', 'Spain', 'Poland', 'Brazil', 
    'India', 'Singapore', 'Japan', 'China', 'Remote', 'Europe', 'Asia', 
    'Latin America', 'Africa', 'Worldwide', 'Philippines', 'Vietnam', 'Thailand', 'Indonesia', 'Malaysia'
];

const LOCATION_ALIASES: Record<string, string> = {
    'US': 'United States',
    'USA': 'United States',
    'U.S.': 'United States',
    'U.S.A.': 'United States',
    'UK': 'United Kingdom',
    'U.K.': 'United Kingdom',
    'Great Britain': 'United Kingdom',
    'DE': 'Germany',
    'Deutschland': 'Germany',
    'FR': 'France',
    'ES': 'Spain',
    'BR': 'Brazil',
    'IN': 'India',
    'SG': 'Singapore',
    'JP': 'Japan',
    'CN': 'China',
    'PL': 'Poland',
    'NL': 'Netherlands',
    'The Netherlands': 'Netherlands',
    'SE': 'Sweden',
    'AU': 'Australia',
    'CA': 'Canada',
    'EU': 'Europe',
    'APAC': 'Asia',
    'LATAM': 'Latin America',
    'EMEA': 'Europe', // Broad simplification
    'Global': 'Worldwide',
    'Anywhere': 'Worldwide',
    'Everywhere': 'Worldwide'
};

/**
 * Extracts standardized locations from a raw location string.
 * Returns an array of unique standardized location names.
 */
export function extractLocations(rawLocation: string): string[] {
    if (!rawLocation) return [];
    
    const normalizedRaw = rawLocation.trim();
    const results = new Set<string>();

    // Check for Worldwide/Remote first
    if (/worldwide|anywhere|everywhere|global|remote only|work from anywhere/i.test(normalizedRaw)) {
        results.add('Worldwide');
    }

    // Check against standard list
    STANDARD_LOCATIONS.forEach(loc => {
        // Word boundary check to avoid partial matches (e.g. "India" in "Indiana")
        // But "India" is unique enough. "China" in "Indochina"? No.
        // Simple includes check with some boundaries is safer.
        const regex = new RegExp(`\\b${loc}\\b`, 'i');
        if (regex.test(normalizedRaw)) {
            results.add(loc);
        }
    });

    // Check aliases
    Object.entries(LOCATION_ALIASES).forEach(([alias, target]) => {
        const regex = new RegExp(`\\b${alias.replace('.', '\\.')}\\b`, 'i'); // Escape dots
        if (regex.test(normalizedRaw)) {
            results.add(target);
        }
    });

    // If simple Chinese detection (since we are a Chinese app)
    if (normalizedRaw.includes('美国')) results.add('United States');
    if (normalizedRaw.includes('英国')) results.add('United Kingdom');
    if (normalizedRaw.includes('加拿大')) results.add('Canada');
    if (normalizedRaw.includes('澳大利亚') || normalizedRaw.includes('澳洲')) results.add('Australia');
    if (normalizedRaw.includes('德国')) results.add('Germany');
    if (normalizedRaw.includes('法国')) results.add('France');
    if (normalizedRaw.includes('日本')) results.add('Japan');
    if (normalizedRaw.includes('新加坡')) results.add('Singapore');
    if (normalizedRaw.includes('中国') || normalizedRaw.includes('国内')) results.add('China');

    // If no specific country found but string exists, maybe add "Other" or just keep empty
    // Ideally we want to return at least one valid location if possible.
    // If "Remote" is mentioned without specific country, and no "Worldwide", it might be "Remote (US)" usually.
    // But let's stick to what we found.

    return Array.from(results);
}

/**
 * Checks if a job's location matches selected filters
 */
export function matchesLocationFilter(jobLocation: string, selectedFilters: string[]): boolean {
    if (selectedFilters.length === 0) return true;
    const jobLocs = extractLocations(jobLocation);
    
    // If job is Worldwide, it should theoretically match almost any country filter if the user wants "jobs available in X"
    // But usually "Worldwide" means "Anywhere".
    // If I select "United States", should I see "Worldwide" jobs? Yes, usually.
    const isWorldwide = jobLocs.includes('Worldwide');
    
    return selectedFilters.some(filter => {
        if (isWorldwide) return true; // Worldwide jobs match any location filter
        return jobLocs.includes(filter);
    });
}
