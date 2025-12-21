
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
    'job', 'career', 'opportunity', 'position', 'role'
]);

/**
 * Clean and normalize text
 */
function cleanText(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ') // Remove special chars but keep hyphens for some terms
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
        if (token.length > 2 && !STOP_WORDS.has(token) && !/^\d+$/.test(token)) {
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
    
    // Heuristic for Star Label (Most frequent skill or role)
    // We try to find a bigram first
    let starLabel = "Rising Star";
    const topBigram = keywords.find(k => k.text.includes(' '));
    if (topBigram) {
        starLabel = topBigram.text;
    } else if (keywords.length > 0) {
        starLabel = keywords[0].text; // Removed "Expert" suffix to be cleaner
    }

    // Heuristic for Trunk (Core Role)
    // Find a keyword that sounds like a role (often ends in 'er', 'or', 'ist') or is a major tech stack
    // For simplicity, take the 2nd highest weighted keyword if available, or just the top one again
    let trunkLabel = "Dreamer";
    if (keywords.length > 1) {
        // Try to find a single word that is different from starLabel
        const core = keywords.find(k => k.text !== starLabel && k.text.length < 12); // Short word for trunk
        if (core) trunkLabel = core.text;
    }

    // Heuristic for Top Title (Summary)
    // Combine top 2 distinct keywords e.g. "Java Developer" or "Design & UX"
    let topTitle = starLabel;
    if (keywords.length > 2) {
         const second = keywords.find(k => k.text !== starLabel && k.text !== trunkLabel);
         if (second) {
             topTitle = `${starLabel} & ${second.text}`;
         }
    }

    // Heuristic for Style
    // Check for engineering keywords
    const engKeywords = ['Java', 'Python', 'Code', 'Engineer', 'Developer', 'System', 'Data', 'Cloud'];
    const creativeKeywords = ['Design', 'Art', 'Creative', 'Ui', 'Ux', 'Visual', 'Media', 'Writer'];
    
    let style = 'growth';
    let engCount = 0;
    let creativeCount = 0;

    keywords.forEach(k => {
        if (engKeywords.some(e => k.text.includes(e))) engCount++;
        if (creativeKeywords.some(c => k.text.includes(c))) creativeCount++;
    });

    if (engCount > creativeCount && engCount > 2) style = 'engineering';
    else if (creativeCount > engCount && creativeCount > 2) style = 'creative';

    // Distribute into layers (Randomly for now, or sorted by weight)
    // We want heavier words at the bottom? No, mixed is better for tree.
    // Let's just put them all in one layer for the renderer to handle, 
    // or split them fake-ly.
    
    return {
        trunk_core_role: trunkLabel, 
        top_title: topTitle,
        layers: [
            { category: "Core", keywords: keywords }
        ],
        star_label: starLabel,
        style: style
    };
}
