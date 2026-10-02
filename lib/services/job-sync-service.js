
export function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    // Tokenize: lowercase, remove special chars, split by whitespace
    const tokenize = (text) => {
        return new Set(
            text.toLowerCase()
                .replace(/[^\w\s\u4e00-\u9fa5\+\#\.\-]/g, '') // Keep letters, numbers, Chinese, +, #, ., - (for tech stack like C++, C#, Node.js)
                .split(/\s+/)
                .filter(t => t.length > 1) // Ignore single chars
        );
    };

    const set1 = tokenize(str1);
    const set2 = tokenize(str2);

    if (set1.size === 0 || set2.size === 0) return 0;

    // Intersection
    let intersection = 0;
    for (const token of set1) {
        if (set2.has(token)) intersection++;
    }

    // Union
    const union = set1.size + set2.size - intersection;
    
    return intersection / union;
}

// Retired compatibility entry: no legacy caller can enqueue work outside a manual session.
export async function syncCompanyJobs() {
    throw new Error('旧岗位同步已停用，请在可信企业页面手动使用“更新检查”。')
}
