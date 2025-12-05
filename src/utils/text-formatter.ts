
/**
 * Removes Markdown formatting symbols from text
 */
export function stripMarkdown(text: string): string {
  if (!text) return ''

  return text
    // Remove headers (# Header)
    .replace(/^#+\s+/gm, '')
    // Remove bold/italic (**text**, *text*, __text__, _text_)
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove images ![alt](url) -> alt
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove blockquotes (> text)
    .replace(/^>\s+/gm, '')
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, '$1')
    // Remove lists (- item, * item, 1. item)
    .replace(/^[\s\t]*[-*+]\s+/gm, '')
    .replace(/^[\s\t]*\d+\.\s+/gm, '')
    // Remove horizontal rules (---, ***)
    .replace(/^(?:[-*_]\s*){3,}$/gm, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}
