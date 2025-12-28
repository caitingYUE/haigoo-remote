/**
 * 时间格式化工具
 * 近2天内发布的改用今天、昨天表示，3天以前的用日期
 */

export class DateFormatter {
  /**
   * 格式化发布时间
   * @param dateString 日期字符串或ISO字符串
   * @returns 格式化后的时间字符串
   */
  static formatPublishTime(dateString: string): string {
    // Guard: Return fallback for null/undefined/empty dates
    if (!dateString) {
      return '未知';
    }

    try {
      const date = new Date(dateString);

      // Guard: Check if date is valid
      if (isNaN(date.getTime())) {
        return '未知';
      }

      const now = new Date();

      // 按“日历日”判断今天/昨天，避免仅按小时差导致跨午夜显示错误
      if (this.isToday(dateString)) {
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours === 0) {
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return diffMinutes <= 0 ? '刚刚' : `${diffMinutes}分钟前`;
        }
        return '今天';
      }

      if (this.isYesterday(dateString)) {
        return '昨天';
      }

      // 其余情况用具体日期（MM-DD）
      return this.formatDate(date);

    } catch (error) {
      console.error('日期格式化失败:', error);
      return dateString;
    }
  }

  /**
   * 格式化具体日期
   * @param date Date对象
   * @returns 格式化的日期字符串 (MM-DD)
   */
  static formatDate(date: Date): string {
    // Guard: Check if date is valid
    if (!date || isNaN(date.getTime())) {
      return '--';
    }
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day}`;
  }

  /**
   * 格式化完整日期时间
   * @param dateString 日期字符串
   * @returns 完整的日期时间字符串
   */
  static formatFullDateTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}`;
    } catch (error) {
      console.error('完整日期时间格式化失败:', error);
      return dateString;
    }
  }

  /**
   * 判断是否为今天
   * @param dateString 日期字符串
   * @returns 是否为今天
   */
  static isToday(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const today = new Date();

      return date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();
    } catch (error) {
      return false;
    }
  }

  /**
   * 判断是否为昨天
   * @param dateString 日期字符串
   * @returns 是否为昨天
   */
  static isYesterday(dateString: string): boolean {
    try {
      const date = new Date(dateString);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear();
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取相对时间描述
   * @param dateString 日期字符串
   * @returns 相对时间描述
   */
  static getRelativeTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return '刚刚';
      if (diffMinutes < 60) return `${diffMinutes}分钟前`;
      if (diffHours < 24) return `${diffHours}小时前`;
      if (diffDays < 7) return `${diffDays}天前`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)}个月前`;

      return `${Math.floor(diffDays / 365)}年前`;
    } catch (error) {
      console.error('相对时间计算失败:', error);
      return dateString;
    }
  }
}