import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

interface SingleLineTagsProps {
  tags: (string | undefined | null)[];
  /** small: 推荐卡片；xs: 岗位卡片 */
  size?: 'xs' | 'sm';
  className?: string;
  /** 当没有任何标签时的兜底文案（仅在长度为0时显示） */
  fallback?: string;
}

/**
 * 单行标签行（带 +N 聚合）
 * - 动态计算在单行内可展示的标签数量，剩余用 +N 表示
 * - 考虑标签文本长度、间距、内边距，保证卡片对齐
 */
export const SingleLineTags: React.FC<SingleLineTagsProps> = ({ tags, size = 'sm', className = '', fallback = 'remote' }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const cleanedTags = useMemo(() => {
    const base = (tags || []).filter(Boolean).map(t => String(t));
    // 兜底：当没有任何标签时，显示 fallback（remote）
    return base.length === 0 ? [fallback] : base;
  }, [tags, fallback]);

  // 样式常量（与现有卡片风格保持一致）
  const badgeBase = size === 'xs'
    ? 'px-2 py-1 bg-haigoo-primary/10 text-haigoo-primary rounded-md text-xs font-medium whitespace-nowrap flex-shrink-0'
    : 'px-3 py-1 bg-haigoo-primary/10 text-haigoo-primary rounded-full text-sm font-medium whitespace-nowrap flex-shrink-0';
  const plusBase = size === 'xs'
    ? 'px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs whitespace-nowrap flex-shrink-0'
    : 'px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-sm whitespace-nowrap flex-shrink-0';
  const GAP = 8; // 与 tailwind gap-2 对齐

  useLayoutEffect(() => {
    const el = containerRef.current;
    const measure = measureRef.current;
    if (!el || !measure) return;

    const compute = () => {
      const available = el.clientWidth;
      // 计算每个标签的宽度
      const spans = Array.from(measure.querySelectorAll<HTMLSpanElement>('span[data-role="tag-measure"]'));
      const widths = spans.map(s => Math.ceil(s.offsetWidth));

      // +N 不同位数的宽度
      const plus1 = measure.querySelector<HTMLSpanElement>('span[data-role="plus-1"]');
      const plus2 = measure.querySelector<HTMLSpanElement>('span[data-role="plus-2"]');
      const plus1Width = Math.ceil(plus1?.offsetWidth || 0);
      const plus2Width = Math.ceil(plus2?.offsetWidth || plus1Width);

      let used = 0;
      let count = 0;

      // 定义最少显示标签数量
      const MIN_VISIBLE_TAGS = 2;

      for (let i = 0; i < widths.length; i++) {
        const w = widths[i];
        const needGapBefore = count > 0 ? GAP : 0;
        const remaining = widths.length - (i + 1);
        const plusWidth = remaining > 0 ? (remaining <= 9 ? plus1Width : plus2Width) : 0;
        const plusGap = remaining > 0 && (count + 1) > 0 ? GAP : 0; // +N 与最后一个标签之间的间距

        // 预留 +N 的空间（如果还有剩余标签）
        const required = used + needGapBefore + w + (remaining > 0 ? plusGap + plusWidth : 0);

        if (required <= available) {
          used += needGapBefore + w;
          count += 1;
        } else {
          // 如果是前几个标签（小于 MIN_VISIBLE_TAGS），强制显示
          if (count < MIN_VISIBLE_TAGS && widths.length > MIN_VISIBLE_TAGS) {
            // 尝试不预留 +N 空间，直接显示标签
            const requiredWithoutPlus = used + needGapBefore + w;
            if (requiredWithoutPlus <= available) {
              used += needGapBefore + w;
              count += 1;
            } else {
              break;
            }
        } else {
          break;
          }
        }
      }

      // 特殊处理：如果只有1-2个标签，全部显示，不折叠
      if (widths.length <= MIN_VISIBLE_TAGS) {
        let totalWidth = 0;
        for (let i = 0; i < widths.length; i++) {
          totalWidth += widths[i] + (i > 0 ? GAP : 0);
        }
        if (totalWidth <= available) {
          setVisibleCount(widths.length);
          return;
        }
      }

      // 容器极窄时，至少显示 +N
      if (count === 0 && widths.length > 0) {
        // 如果一个标签都放不下，就不显示标签，仅显示 +N
        setVisibleCount(0);
      } else {
        setVisibleCount(count);
      }
    };

    compute();
    const RO = (window as any).ResizeObserver;
    const ro = RO ? new RO((entries: any) => compute()) : undefined;
    if (ro) ro.observe(el);
    return () => {
      if (ro) ro.disconnect();
    };
  }, [cleanedTags, size]);

  const hiddenCount = Math.max(0, cleanedTags.length - visibleCount);

  return (
    <div ref={containerRef} className={`flex flex-nowrap items-center gap-2 overflow-hidden ${className}`}>
      {/* 可见标签 */}
      {cleanedTags.slice(0, visibleCount).map((t, idx) => (
        <span key={`${t}-${idx}`} className={badgeBase}>{t}</span>
      ))}

      {/* +N 聚合 */}
      {hiddenCount > 0 && (
        <span className={plusBase}>+{hiddenCount}</span>
      )}

      {/* 隐藏的测量容器 */}
      <div ref={measureRef} className="absolute left-0 top-0 -z-10 invisible opacity-0 pointer-events-none">
        {cleanedTags.map((t, idx) => (
          <span key={`m-${t}-${idx}`} data-role="tag-measure" className={badgeBase}>{t}</span>
        ))}
        <span data-role="plus-1" className={plusBase}>+9</span>
        <span data-role="plus-2" className={plusBase}>+99</span>
      </div>
    </div>
  );
};

export default SingleLineTags;