
import natural from 'natural';

// Common English Stop Words (Expanded)
const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what',
    'when', 'where', 'how', 'which', 'who', 'whom', 'this', 'that', 'these',
    'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might',
    'must', 'ought', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'me', 'him', 'her', 'us', 'them', 'my', 'mine', 'your', 'yours',
    'his', 'hers', 'its', 'our', 'ours', 'their', 'theirs',
    'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about', 'against',
    'between', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'under', 'up', 'down', 'out', 'off', 'over', 'under',
    'again', 'further', 'then', 'once', 'here', 'there', 'why', 'how',
    'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should',
    'now', 'work', 'experience', 'year', 'years', 'month', 'months',
    'responsible', 'responsibility', 'duties', 'include', 'included',
    'team', 'project', 'projects', 'use', 'using', 'used', 'make',
    'made', 'making', 'help', 'helped', 'helping', 'lead', 'led',
    'leading', 'manage', 'managed', 'managing', 'create', 'created',
    'creating', 'develop', 'developed', 'developing', 'support',
    'supported', 'supporting', 'provide', 'provided', 'providing',
    'ensure', 'ensured', 'ensuring', 'maintain', 'maintained',
    'maintaining', 'assist', 'assisted', 'assisting', 'require',
    'required', 'requiring', 'perform', 'performed', 'performing',
    'participate', 'participated', 'participating', 'follow',
    'followed', 'following', 'com', 'www', 'http', 'https', 'gmail',
    'yahoo', 'outlook', 'hotmail', 'email', 'phone', 'mobile',
    'address', 'location', 'city', 'state', 'zip', 'code', 'date',
    'time', 'name', 'title', 'company', 'organization', 'school',
    'university', 'college', 'degree', 'education', 'reference',
    'references', 'skill', 'skills', 'language', 'languages',
    'certification', 'certifications', 'award', 'awards', 'honor',
    'honors', 'interest', 'interests', 'summary', 'objective',
    'profile', 'contact', 'info', 'information', 'resume', 'cv',
    'vitae', 'curriculum', 'page', 'pages', 'january', 'february',
    'march', 'april', 'may', 'june', 'july', 'august', 'september',
    'october', 'november', 'december', 'present', 'current',
    'job', 'career', 'opportunity', 'position', 'role',
    'tel', 'fax', 'cell', 'mob', 'telephone', 'mobile', 'mail', 'e-mail',
    'street', 'road', 'avenue', 'suite', 'apt', 'apartment', 'floor',
    'block', 'district', 'province', 'country', 'nationality', 'gender',
    'sex', 'birth', 'birthday', 'marital', 'status', 'single', 'married',
    'linkedin', 'github', 'portfolio', 'website', 'http', 'https', 'com', 'org', 'net'
]);

/**
 * Positive Abstract Titles for Star Label
 */
const POSITIVE_TITLES = {
    engineering: ['Architect', 'Builder', 'Innovator', 'Solver', 'Maker', 'Tech Wizard', 'Pioneer', 'Creator'],
    creative: ['Visionary', 'Artist', 'Dreamer', 'Storyteller', 'Muse', 'Designer', 'Poet', 'Soul'],
    growth: ['Achiever', 'Explorer', 'Leader', 'Challenger', 'Warrior', 'Rising Star', 'Hero', 'Winner'],
    general: ['Professional', 'Expert', 'Talent', 'Master', 'Specialist', 'Pro', 'Ace', 'Star']
};

/**
 * Clean and normalize text
 */
function cleanText(text) {
    // Aggressive privacy scrubbing before tokenization
    let scrubbed = text.toLowerCase();
    
    // Remove Emails
    scrubbed = scrubbed.replace(/[\w.-]+@[\w.-]+\.\w+/g, ' ');
    
    // Remove Phone Numbers (various formats)
    // Matches: +86 123..., 123-456-7890, (123) 456-7890, 13912345678
    scrubbed = scrubbed.replace(/(?:(?:\+|00)86)?1[3-9]\d{9}/g, ' '); // CN Mobile
    scrubbed = scrubbed.replace(/(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/g, ' '); // US/General
    scrubbed = scrubbed.replace(/\d{3}[- ]?\d{4}[- ]?\d{4}/g, ' '); // Other formats
    
    // Remove Dates / Years
    // Matches: 2020-2023, 1990, 01/2020
    scrubbed = scrubbed.replace(/\b(19|20)\d{2}\b/g, ' '); // Years 19xx, 20xx
    scrubbed = scrubbed.replace(/\b\d{1,2}\/\d{4}\b/g, ' '); // MM/YYYY

    // Remove Salary / Money
    // Matches: 40k, 30w, 10000, 50,000, 20k-40k
    scrubbed = scrubbed.replace(/\b\d+(?:,\d{3})*[kwKW]?\b/g, ' '); 
    scrubbed = scrubbed.replace(/[\$￥¥]\d+/g, ' ');
    
    return scrubbed
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove special chars but keep hyphens
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract Keywords using TF (Term Frequency)
 * @param {string} text 
 * @param {number} maxKeywords 
 */
export function extractKeywordsLocal(text, maxKeywords = 80) {
    const cleaned = cleanText(text);
    const tokenizer = new natural.WordTokenizer();
    const tokens = tokenizer.tokenize(cleaned);
    
    // Frequency Map
    const frequency = {};
    
    // Single words
    tokens.forEach(token => {
        // Filter out:
        // 1. Short words (<= 2 chars)
        // 2. Stop words
        // 3. Any token containing a digit (Years, Phone numbers, Mixed codes like 'h2o')
        if (token.length > 2 && !STOP_WORDS.has(token) && !/\d/.test(token)) {
            // Extra privacy check: Skip if it looks like part of a phone/email/url not caught by regex
            if (token.includes('@') || token.includes('.com')) return;
            
            frequency[token] = (frequency[token] || 0) + 1;
        }
    });

    // Bigrams (Two-word phrases) - Give them higher initial weight
    const bigrams = natural.NGrams.bigrams(tokens);
    bigrams.forEach(bigram => {
        const phrase = bigram.join(' ');
        if (!STOP_WORDS.has(bigram[0]) && !STOP_WORDS.has(bigram[1])) {
             // Basic heuristic: Boost phrase if it appears multiple times
             // We store it in the same map, or separate?
             // Let's store in same map but give weight bonus later
             // Actually, for simplicity, let's just count phrases that appear > 1 time
             const phraseKey = phrase;
             // Only count if both words are valid
             if (bigram[0].length > 2 && bigram[1].length > 2) {
                 frequency[phraseKey] = (frequency[phraseKey] || 0) + 2; // Phrases are worth more
             }
        }
    });

    // Convert to array
    let sorted = Object.keys(frequency).map(key => ({
        text: key.charAt(0).toUpperCase() + key.slice(1), // Capitalize
        weight: frequency[key]
    }));

    // Sort by weight desc
    sorted.sort((a, b) => b.weight - a.weight);

    // Filter top N
    sorted = sorted.slice(0, maxKeywords);

    // Normalize weights to 1-10 range
    if (sorted.length > 0) {
        const maxWt = sorted[0].weight;
        const minWt = sorted[sorted.length - 1].weight;
        
        sorted = sorted.map(item => ({
            text: item.text,
            weight: Math.max(1, Math.round(((item.weight - minWt) / (maxWt - minWt || 1)) * 9) + 1)
        }));
    }
    
    // --- ENHANCEMENT: Add positive filler keywords if list is short ---
    // Expanded list for denser trees
    const POSITIVE_FILLERS = [
        'Growth', 'Passion', 'Focus', 'Impact', 'Value', 
        'Future', 'Dream', 'Trust', 'Power', 'Smart',
        'Active', 'Bold', 'Calm', 'Drive', 'Energy',
        'Flow', 'Glow', 'Hero', 'Idea', 'Joy',
        'Lead', 'Learn', 'Light', 'Logic', 'Love',
        'Magic', 'Mind', 'Move', 'Open', 'Path',
        'Plan', 'Pure', 'Real', 'Rise', 'Safe',
        'Seek', 'Shine', 'Soul', 'Spark', 'Star',
        'Step', 'Team', 'Time', 'True', 'View',
        'Vision', 'Warm', 'Will', 'Wise', 'Wish',
        'Work', 'Zeal', 'Zen', 'Zoom', 'Aim'
    ];
    
    // Ensure we have at least 60 keywords for a dense tree
    const targetCount = 60;
    
    if (sorted.length < targetCount) {
        // Shuffle fillers
        const shuffled = POSITIVE_FILLERS.sort(() => 0.5 - Math.random());
        
        for (const filler of shuffled) {
            if (sorted.length >= targetCount) break;
            // Avoid duplicates
            if (!sorted.some(k => k.text.toLowerCase() === filler.toLowerCase())) {
                sorted.push({
                    text: filler,
                    weight: Math.floor(Math.random() * 2) + 1 // Low weight 1-2 for fillers
                });
            }
        }
    }

    return sorted;
}

/**
 * Generate Tree Structure locally
 */
export function generateTreeStructureLocal(text) {
    const keywords = extractKeywordsLocal(text, 80);
    
    // Heuristic for Style
    // Check for engineering keywords
    const engKeywords = ['java', 'python', 'code', 'engineer', 'developer', 'system', 'data', 'cloud', 'tech', 'api', 'backend', 'frontend'];
    const creativeKeywords = ['design', 'art', 'creative', 'ui', 'ux', 'visual', 'media', 'writer', 'content', 'brand', 'marketing'];
    
    let style = 'growth';
    let engCount = 0;
    let creativeCount = 0;

    keywords.forEach(k => {
        const t = k.text.toLowerCase();
        if (engKeywords.some(e => t.includes(e))) engCount++;
        if (creativeKeywords.some(c => t.includes(c))) creativeCount++;
    });

    if (engCount > creativeCount && engCount > 2) style = 'engineering';
    else if (creativeCount > engCount && creativeCount > 2) style = 'creative';

    // Heuristic for Star Label (Abstract Positive Title)
    // Pick a random positive title based on style
    let possibleTitles = POSITIVE_TITLES[style] || POSITIVE_TITLES['general'];
    // Use a hash of text length to pick "randomly" but consistently for same text
    const seed = text.length;
    let starLabel = possibleTitles[seed % possibleTitles.length];

    // Heuristic for Trunk (Core Role)
    // Find a keyword that sounds like a role (often ends in 'er', 'or', 'ist') or is a major tech stack
    // For simplicity, take the 2nd highest weighted keyword if available, or just the top one again
    // Ensure NO NUMBERS
    let trunkLabel = "Dreamer";
    if (keywords.length > 0) {
        // Find top keyword that is NOT the star label (though star label is abstract now so collision unlikely)
        // And strictly no numbers
        const core = keywords.find(k => k.text.length < 12 && !/\d/.test(k.text)); 
        if (core) trunkLabel = core.text;
    }

    // Heuristic for Top Title (Summary) - Replaced by Abstract Star Label
    // The user wants "Abstract positive professional label" at the top star.
    // So we use starLabel for both if needed, or just return starLabel.
    
    return {
        trunk_core_role: trunkLabel, 
        top_title: starLabel, // Use abstract title for top
        layers: [
            { category: "Core", keywords: keywords }
        ],
        star_label: starLabel,
        style: style
    };
}
