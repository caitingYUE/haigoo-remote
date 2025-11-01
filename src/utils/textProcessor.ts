/**
 * 海狗招聘平台 - 专业文本处理工具
 * 
 * 功能特性：
 * 1. Markdown/HTML标签白名单过滤机制
 * 2. 特殊字符自动转义处理
 * 3. 文本预处理函数确保输出纯净文本
 * 4. 支持50+种特殊字符的测试用例
 * 
 * @author Haigoo Tech Team
 * @version 2.0.0
 */

// HTML标签白名单 - 仅允许安全的格式化标签
const HTML_WHITELIST = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'code', 'pre',
  'a', 'img'
]);

// 允许的HTML属性白名单
const ATTRIBUTE_WHITELIST: Record<string, Set<string>> = {
  'a': new Set(['href', 'title', 'target']),
  'img': new Set(['src', 'alt', 'title', 'width', 'height']),
  'span': new Set(['class']),
  'p': new Set(['class']),
  'div': new Set(['class'])
};

// 特殊字符映射表 - 50+种特殊字符处理
const SPECIAL_CHAR_MAP: Record<string, string> = {
  // Markdown特殊字符
  '**': '',
  '*': '',
  '__': '',
  '_': '',
  '~~': '',
  '`': '',
  '```': '',
  '#': '',
  '##': '',
  '###': '',
  '####': '',
  '#####': '',
  '######': '',
  
  // HTML实体
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  
  // 特殊符号
  '&bull;': '•',
  '&middot;': '·',
  '&hellip;': '…',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  
  // 数学符号
  '&plusmn;': '±',
  '&times;': '×',
  '&divide;': '÷',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾',
  
  // 货币符号
  '&euro;': '€',
  '&pound;': '£',
  '&yen;': '¥',
  '&cent;': '¢',
  
  // 箭头符号
  '&larr;': '←',
  '&uarr;': '↑',
  '&rarr;': '→',
  '&darr;': '↓',
  '&harr;': '↔',
  
  // 其他常见符号
  '&deg;': '°',
  '&para;': '¶',
  '&sect;': '§',
  '&dagger;': '†',
  '&Dagger;': '‡',
  '&permil;': '‰',
  '&prime;': '′',
  '&Prime;': '″',
  
  // 编程相关
  '&lt;/': '</',
  '&lt;=': '<=',
  '&gt;=': '>=',
  '!=': '≠',
  '===': '=',
  '!==': '≠'
};

// 危险HTML标签列表
const DANGEROUS_TAGS = new Set([
  'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea',
  'button', 'select', 'option', 'link', 'meta', 'style', 'title',
  'base', 'head', 'html', 'body'
]);

/**
 * 文本处理器接口
 */
export interface TextProcessorOptions {
  /** 是否允许HTML标签 */
  allowHtml?: boolean;
  /** 是否允许Markdown语法 */
  allowMarkdown?: boolean;
  /** 是否保留换行符 */
  preserveLineBreaks?: boolean;
  /** 最大文本长度 */
  maxLength?: number;
  /** 是否移除多余空白字符 */
  trimWhitespace?: boolean;
  /** 自定义字符映射 */
  customCharMap?: Record<string, string>;
}

/**
 * 文本处理结果
 */
export interface ProcessedText {
  /** 处理后的文本 */
  text: string;
  /** 是否包含被过滤的内容 */
  hasFilteredContent: boolean;
  /** 被移除的标签数量 */
  removedTagsCount: number;
  /** 被转义的字符数量 */
  escapedCharsCount: number;
  /** 原始文本长度 */
  originalLength: number;
  /** 处理后文本长度 */
  processedLength: number;
}

/**
 * 主要文本处理函数
 * 
 * @param text 原始文本
 * @param options 处理选项
 * @returns 处理结果
 */
export function processText(text: string, options: TextProcessorOptions = {}): ProcessedText {
  const {
    allowHtml = false,
    allowMarkdown = false,
    preserveLineBreaks = true,
    maxLength = 10000,
    trimWhitespace = true,
    customCharMap = {}
  } = options;

  let processedText = text;
  let removedTagsCount = 0;
  let escapedCharsCount = 0;
  const originalLength = text.length;

  // 1. 移除危险HTML标签
  const dangerousTagRegex = new RegExp(`<\\/?(?:${Array.from(DANGEROUS_TAGS).join('|')})[^>]*>`, 'gi');
  const dangerousMatches = processedText.match(dangerousTagRegex);
  if (dangerousMatches) {
    removedTagsCount += dangerousMatches.length;
    processedText = processedText.replace(dangerousTagRegex, '');
  }

  // 2. 处理HTML标签
  if (!allowHtml) {
    // 移除所有HTML标签
    const htmlTagRegex = /<[^>]*>/g;
    const htmlMatches = processedText.match(htmlTagRegex);
    if (htmlMatches) {
      removedTagsCount += htmlMatches.length;
      processedText = processedText.replace(htmlTagRegex, '');
    }
  } else {
    // 仅保留白名单中的HTML标签
    processedText = sanitizeHtml(processedText);
  }

  // 3. 处理Markdown语法
  if (!allowMarkdown) {
    processedText = removeMarkdownSyntax(processedText);
  }

  // 4. 转义特殊字符
  const charMap = { ...SPECIAL_CHAR_MAP, ...customCharMap };
  for (const [from, to] of Object.entries(charMap)) {
    const regex = new RegExp(escapeRegExp(from), 'g');
    const matches = processedText.match(regex);
    if (matches) {
      escapedCharsCount += matches.length;
      processedText = processedText.replace(regex, to);
    }
  }

  // 5. 处理换行符
  if (preserveLineBreaks) {
    processedText = normalizeLineBreaks(processedText);
  } else {
    processedText = processedText.replace(/\r?\n/g, ' ');
  }

  // 6. 清理多余空白字符
  if (trimWhitespace) {
    processedText = processedText
      .replace(/\s+/g, ' ')  // 多个空格合并为一个
      .replace(/\n\s*\n/g, '\n\n')  // 多个换行合并为两个
      .trim();
  }

  // 7. 限制文本长度
  if (maxLength > 0 && processedText.length > maxLength) {
    processedText = processedText.substring(0, maxLength) + '...';
  }

  return {
    text: processedText,
    hasFilteredContent: removedTagsCount > 0 || escapedCharsCount > 0,
    removedTagsCount,
    escapedCharsCount,
    originalLength,
    processedLength: processedText.length
  };
}

/**
 * 清理HTML内容，仅保留白名单标签
 */
function sanitizeHtml(html: string): string {
  return html.replace(/<(\/?)([\w-]+)([^>]*)>/g, (match, slash, tagName, attributes) => {
    const tag = tagName.toLowerCase();
    
    if (!HTML_WHITELIST.has(tag)) {
      return '';
    }

    // 处理属性
    const allowedAttrs = ATTRIBUTE_WHITELIST[tag] || new Set();
    const cleanAttributes = attributes.replace(/(\w+)=["']([^"']*)["']/g, (attrMatch: string, name: string, value: string) => {
      if (allowedAttrs.has(name.toLowerCase())) {
        // 清理属性值中的危险内容
        const cleanValue = value
          .replace(/javascript:/gi, '')
          .replace(/on\w+=/gi, '')
          .replace(/data:/gi, '');
        return `${name}="${cleanValue}"`;
      }
      return '';
    });

    return `<${slash}${tag}${cleanAttributes}>`;
  });
}

/**
 * 移除Markdown语法
 */
function removeMarkdownSyntax(text: string): string {
  return text
    // 移除标题语法
    .replace(/^#{1,6}\s+/gm, '')
    // 移除粗体和斜体
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // 移除删除线
    .replace(/~~([^~]+)~~/g, '$1')
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // 移除链接
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除图片
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 移除引用
    .replace(/^>\s+/gm, '')
    // 移除列表标记
    .replace(/^[\s]*[-*+]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '');
}

/**
 * 标准化换行符
 */
function normalizeLineBreaks(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // Windows换行符
    .replace(/\r/g, '\n')    // Mac换行符
    .replace(/\n{3,}/g, '\n\n');  // 多个换行符合并为两个
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 快速文本清理 - 用于简单场景
 */
export function quickCleanText(text: string): string {
  return processText(text, {
    allowHtml: false,
    allowMarkdown: false,
    preserveLineBreaks: true,
    trimWhitespace: true
  }).text;
}

/**
 * 保留格式的文本清理 - 用于富文本场景
 */
export function cleanRichText(text: string): string {
  return processText(text, {
    allowHtml: true,
    allowMarkdown: true,
    preserveLineBreaks: true,
    trimWhitespace: false
  }).text;
}

/**
 * 严格文本清理 - 用于安全要求高的场景
 */
export function strictCleanText(text: string, maxLength: number = 1000): string {
  return processText(text, {
    allowHtml: false,
    allowMarkdown: false,
    preserveLineBreaks: false,
    trimWhitespace: true,
    maxLength
  }).text;
}

/**
 * 验证文本是否安全
 */
export function isTextSafe(text: string): boolean {
  const result = processText(text, { allowHtml: false, allowMarkdown: false });
  return !result.hasFilteredContent;
}

/**
 * 获取文本统计信息
 */
export function getTextStats(text: string): {
  length: number;
  words: number;
  lines: number;
  paragraphs: number;
  hasHtml: boolean;
  hasMarkdown: boolean;
} {
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  const lines = text.split(/\r?\n/).length;
  const paragraphs = text.split(/\r?\n\s*\r?\n/).filter(p => p.trim().length > 0).length;
  const hasHtml = /<[^>]+>/.test(text);
  const hasMarkdown = /[*_`#\[\]()~]/.test(text);

  return {
    length: text.length,
    words,
    lines,
    paragraphs,
    hasHtml,
    hasMarkdown
  };
}

// 导出默认处理函数
export default processText;