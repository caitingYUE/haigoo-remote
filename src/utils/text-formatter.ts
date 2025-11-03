/**
 * 文本格式化工具函数
 * 用于处理职位描述中的Markdown符号和特殊字符
 */

/**
 * 清理Markdown符号，返回纯文本
 */
export function cleanMarkdownSymbols(text: string): string {
  if (!text) return '';
  
  let cleaned = text;
  
  // 移除Markdown粗体符号 **text** -> text
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '$1');
  
  // 移除Markdown斜体符号 *text* -> text
  cleaned = cleaned.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '$1');
  
  // 移除其他常见的Markdown符号
  cleaned = cleaned.replace(/~~(.*?)~~/g, '$1'); // 删除线
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1'); // 行内代码
  
  // 处理多余的星号和特殊符号
  cleaned = cleaned.replace(/\*{3,}/g, ''); // 移除3个或更多连续的星号
  cleaned = cleaned.replace(/_{3,}/g, ''); // 移除3个或更多连续的下划线
  
  // 处理多余的空白字符
  cleaned = cleaned.replace(/\s+/g, ' '); // 合并多个空格
  cleaned = cleaned.replace(/\n\s*\n/g, '\n\n'); // 保留段落间距
  
  // 清理开头和结尾的空白
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * 清理和格式化文本，处理Markdown符号
 */
export function formatJobDescription(text: string): string {
  if (!text) return '';
  
  let formatted = text;
  
  // 处理Markdown粗体符号 **text** -> <strong>text</strong>
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // 处理Markdown斜体符号 *text* -> <em>text</em>
  formatted = formatted.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  
  // 处理其他常见的Markdown符号
  formatted = formatted.replace(/~~(.*?)~~/g, '<del>$1</del>'); // 删除线
  formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>'); // 行内代码
  
  // 处理多余的星号和特殊符号
  formatted = formatted.replace(/\*{3,}/g, ''); // 移除3个或更多连续的星号
  formatted = formatted.replace(/_{3,}/g, ''); // 移除3个或更多连续的下划线
  
  // 处理多余的空白字符
  formatted = formatted.replace(/\s+/g, ' '); // 合并多个空格
  formatted = formatted.replace(/\n\s*\n/g, '\n\n'); // 保留段落间距
  
  // 清理开头和结尾的空白
  formatted = formatted.trim();
  
  return formatted;
}

/**
 * 去除HTML标签，保留纯文本
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // 创建临时DOM元素来解析HTML
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  
  // 获取纯文本内容
  return tmp.textContent || tmp.innerText || '';
}

/**
 * 截断文本到指定长度
 */
export function truncateText(text: string, maxLength: number = 150): string {
  if (!text) return '';
  
  const plainText = stripHtmlTags(text);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  // 在单词边界处截断
  const truncated = plainText.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.8) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
}

/**
 * 处理职位描述的完整格式化流程
 */
export function processJobDescription(description: string, options: {
  formatMarkdown?: boolean;
  maxLength?: number;
  preserveHtml?: boolean;
} = {}): string {
  const {
    formatMarkdown = true,
    maxLength,
    preserveHtml = true
  } = options;
  
  if (!description) return '';
  
  let processed = description;
  
  // 处理Markdown符号
  if (formatMarkdown) {
    processed = formatJobDescription(processed);
  } else {
    // 如果不需要HTML格式，则清理Markdown符号
    processed = cleanMarkdownSymbols(processed);
  }
  
  // 如果需要截断
  if (maxLength) {
    if (preserveHtml && formatMarkdown) {
      // 保留HTML的情况下，先截断纯文本，然后重新格式化
      const plainText = stripHtmlTags(processed);
      const truncated = truncateText(plainText, maxLength);
      processed = formatJobDescription(truncated);
    } else {
      processed = truncateText(processed, maxLength);
    }
  }
  
  return processed;
}

/**
 * 清理HTML实体
 */
export function decodeHtmlEntities(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"'
  };
  
  let decoded = text;
  Object.entries(htmlEntities).forEach(([entity, char]) => {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  });
  
  return decoded;
}