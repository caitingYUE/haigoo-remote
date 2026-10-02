const RELATED_TERMS: Record<string, string[]> = {
  '后端开发': ['backend', 'server', 'api', '服务端'],
  '前端开发': ['frontend', 'web', 'ui', '前端'],
  '全栈开发': ['fullstack', 'full stack', '全栈'],
  '移动开发': ['mobile', 'ios', 'android', 'app', '移动端'],
  '数据分析': ['data analyst', 'analytics', 'bi', '数据'],
  '数据科学': ['data science', 'machine learning', 'ml', 'ai', '数据'],
  '产品经理': ['product manager', 'product', 'pm', '产品'],
  '产品设计': ['product design', 'product designer'],
  '用户研究': ['user research', 'ux research', '用户调研'],
  '测试/QA': ['qa', 'quality assurance', 'testing'],
  '算法工程师': ['algorithm', 'machine learning', 'ml', 'ai'],
  '项目管理': ['project manager', 'project', '项目'],
  'UI/UX设计': ['ui', 'ux', 'user experience', '交互', '设计'],
  '市场营销': ['marketing', 'growth', '市场', '营销'],
  '销售': ['sales', 'business development', 'bd', '销售'],
  '人力资源': ['hr', 'human resources', 'people', '人事'],
  '财务': ['finance', 'accounting', '财务'],
  '法务': ['legal', 'law', '法务'],
  '客户服务': ['customer service', 'support', '客服'],
  '运维/SRE': ['devops', 'sre', 'operations', '运维'],
  '网络安全': ['cybersecurity', 'security', 'infosec', '安全'],
  '技术支持': ['technical support', 'support', 'tech support'],
  '语言翻译': ['translation', 'translator', 'language', '翻译']
};

const normalize = (value: string) => value.normalize('NFKC').trim().toLowerCase();
const compact = (value: string) => value.replace(/[\s/_-]+/g, '');

// Short Latin aliases must match a word: "ai" must not match "chair".
const matchesAlias = (alias: string, query: string) => {
  if (/^[a-z]{1,3}$/.test(alias)) return query.split(/[^a-z]+/).includes(alias);
  return alias.includes(query);
};

/** Returns existing categories ranked for a search query; it never creates values. */
export function rankJobCategories(options: string[], query: string): string[] {
  const values = [...new Set(options.map(value => String(value || '').trim()).filter(Boolean))];
  const needle = normalize(query);
  if (!needle) return values;

  return values
    .map((label, index) => {
      const normalizedLabel = normalize(label);
      const aliases = (RELATED_TERMS[label] || []).map(normalize);
      let score = 1000 + index;
      if (normalizedLabel === needle) score = 0;
      else if (normalizedLabel.startsWith(needle)) score = 100;
      else if (normalizedLabel.includes(needle)) score = 200;
      else if (compact(needle) && compact(normalizedLabel).includes(compact(needle))) score = 250;
      else {
        const queryTokens = needle.split(/[\s/_-]+/).filter(Boolean);
        const overlap = queryTokens.length > 1 && queryTokens.every(token =>
          [normalizedLabel, ...aliases].some(value => value.includes(token)));
        const related = queryTokens.length > 0 && queryTokens.every(token => aliases.some(alias => matchesAlias(alias, token)));
        if (related) score = 300;
        else if (overlap) score = 400;
        else if (/^[\u4e00-\u9fff]{2,}$/.test(needle)) {
          // Ordered Chinese fragments, e.g. 产品经 → 产品经理, 产经 → 产品经理.
          let cursor = 0;
          for (const char of normalizedLabel) if (char === needle[cursor]) cursor++;
          score = cursor === needle.length ? 500 : 1000;
        }
        else score = 1000;
      }
      return { label, score, index };
    })
    .filter(item => item.score < 1000)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(item => item.label);
}
