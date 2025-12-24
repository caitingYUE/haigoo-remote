
// Dictionary for bilingual search expansion
const KEYWORD_DICTIONARY = {
  // Roles
  '前端': ['frontend', 'front-end', 'web developer', 'react', 'vue', 'angular'],
  'frontend': ['前端', '界面', 'react', 'vue'],
  '后端': ['backend', 'back-end', 'server', 'java', 'golang', 'python', 'node', 'c++'],
  'backend': ['后端', '服务端', '后台'],
  '全栈': ['fullstack', 'full-stack', 'full stack'],
  'fullstack': ['全栈'],
  '移动端': ['mobile', 'ios', 'android', 'flutter', 'react native'],
  'mobile': ['移动端', '安卓', '苹果'],
  '算法': ['algorithm', 'ai', 'machine learning', 'deep learning', 'nlp', 'cv'],
  'algorithm': ['算法', '人工智能'],
  '产品经理': ['product manager', 'pm'],
  'pm': ['产品经理', '项目经理'],
  '设计师': ['designer', 'ui', 'ux', 'product design'],
  'designer': ['设计', '美工'],
  '运维': ['devops', 'sre', 'ops', 'maintenance'],
  'devops': ['运维', 'sre'],
  '测试': ['qa', 'test', 'testing', 'quality assurance'],
  'qa': ['测试', '质量保证'],
  '网络安全': ['security', 'cybersecurity', 'network security', 'infosec'],
  'security': ['安全', '网络安全'],
  '数据': ['data', 'analytics', 'analyst', 'scientist'],
  'data': ['数据'],
  
  // Locations
  '美国': ['usa', 'united states', 'us', 'america'],
  'usa': ['美国', '美帝'],
  '日本': ['japan', 'tokyo'],
  'japan': ['日本'],
  '新加坡': ['singapore', 'sg'],
  'singapore': ['新加坡'],
  '远程': ['remote', 'wfh', 'work from home'],
  'remote': ['远程', '在家办公'],
  
  // Industries
  '金融': ['finance', 'fintech', 'banking', 'trading'],
  'finance': ['金融'],
  '游戏': ['game', 'gaming'],
  'game': ['游戏'],
  '电商': ['e-commerce', 'ecommerce', 'retail'],
  'e-commerce': ['电商', '电子商务'],
  '区块链': ['blockchain', 'web3', 'crypto'],
  'web3': ['区块链', '加密货币']
};

/**
 * Expands a search query into a list of related terms (bilingual)
 * @param {string} query - The original search query
 * @returns {string[]} - Array of unique search terms including original and expansions
 */
export function expandSearchTerms(query) {
  if (!query || typeof query !== 'string') return [];
  
  const terms = new Set();
  const lowerQuery = query.toLowerCase().trim();
  
  // Add original query
  terms.add(lowerQuery);
  
  // 1. Direct dictionary match (whole phrase)
  if (KEYWORD_DICTIONARY[lowerQuery]) {
    KEYWORD_DICTIONARY[lowerQuery].forEach(t => terms.add(t));
  }
  
  // 2. Tokenize and expand individual words
  const tokens = lowerQuery.split(/\s+/);
  if (tokens.length > 1) {
    tokens.forEach(token => {
      terms.add(token);
      if (KEYWORD_DICTIONARY[token]) {
        KEYWORD_DICTIONARY[token].forEach(t => terms.add(t));
      }
    });
  }
  
  return Array.from(terms);
}

/**
 * Generates SQL condition for expanded search
 * @param {string} field - Database column name
 * @param {string[]} terms - Expanded terms
 * @param {number} paramStartIndex - Starting index for SQL parameters
 * @returns {object} { condition: string, params: any[] }
 */
export function buildSearchCondition(fields, terms, paramStartIndex) {
  const conditions = [];
  const params = [];
  let currentIndex = paramStartIndex;

  // Logic: (field1 LIKE %t1% OR field1 LIKE %t2%) OR (field2 LIKE %t1%...)
  // Actually better: (field1 LIKE %t1% OR field2 LIKE %t1%) AND (field1 LIKE %t2% OR field2 LIKE %t2%) 
  // Wait, usually "frontend developer" means AND logic between tokens, but OR logic between synonyms.
  // Current implementation uses simple OR for everything which is weak.
  // Let's stick to "Any term matches Any field" for now to maximize recall, but rank by matches.
  
  // New Logic: 
  // For each expanded set of synonyms (concept), at least one must match?
  // No, `expandSearchTerms` returns a flat list. "前端" -> ["前端", "frontend", "react"...]
  // We want to find rows where ANY of these appear.
  
  const orConditions = [];
  
  terms.forEach(term => {
    const fieldConditions = fields.map(field => `${field} ILIKE $${currentIndex}`);
    orConditions.push(`(${fieldConditions.join(' OR ')})`);
    params.push(`%${term}%`);
    currentIndex++;
  });
  
  return {
    condition: `(${orConditions.join(' OR ')})`,
    params,
    nextIndex: currentIndex
  };
}
