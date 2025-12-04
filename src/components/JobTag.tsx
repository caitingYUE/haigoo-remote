/**
 * 海狗招聘标签组件 v2.0
 * 
 * 功能特性：
 * 1. 统一的视觉规范
 * 2. 标准化的交互效果
 * 3. 无障碍访问支持
 * 4. 响应式设计
 * 5. 主题适配
 */

import React, { useState } from 'react';
import { JobTag as JobTagType, tagUtils } from '../utils/tagSystem';

// 单个标签组件属性
interface JobTagProps {
  tag: JobTagType;
  onClick?: (tag: JobTagType) => void;
  onRemove?: (tag: JobTagType) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'solid';
  interactive?: boolean;
  removable?: boolean;
  className?: string;
  'aria-label'?: string;
}

// 标签容器组件属性
interface JobTagsProps {
  tags: JobTagType[] | string[];
  maxTags?: number;
  onTagClick?: (tag: JobTagType) => void;
  onTagRemove?: (tag: JobTagType) => void;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'outline' | 'solid';
  interactive?: boolean;
  removable?: boolean;
  showMore?: boolean;
  className?: string;
  'aria-label'?: string;
}

// 尺寸配置
const SIZE_CONFIG = {
  small: {
    height: '24px',
    padding: '0 8px',
    fontSize: '11px',
    gap: '3px'
  },
  medium: {
    height: '28px',
    padding: '0 10px',
    fontSize: '12px',
    gap: '4px'
  },
  large: {
    height: '32px',
    padding: '0 12px',
    fontSize: '13px',
    gap: '5px'
  }
};

// 单个标签组件
export const JobTag: React.FC<JobTagProps> = ({
  tag,
  onClick,
  onRemove,
  size = 'medium',
  variant = 'default',
  interactive = false,
  removable = false,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const sizeConfig = SIZE_CONFIG[size];
  
  // 基础样式
  const baseStyle: React.CSSProperties = {
    height: sizeConfig.height,
    padding: sizeConfig.padding,
    fontSize: sizeConfig.fontSize,
    fontWeight: '500',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: sizeConfig.gap,
    transition: 'all 0.15s ease-out',
    cursor: interactive ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    border: '1px solid',
    ...tagUtils.generateStyle(tag)
  };
  
  // 悬停样式
  const hoverStyle: React.CSSProperties = isHovered && interactive ? {
    ...tagUtils.generateHoverStyle(tag),
    transform: 'translateY(-1px)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
  } : {};
  
  // 变体样式调整
  const variantStyle: React.CSSProperties = variant === 'outline' ? {
    backgroundColor: 'transparent',
    borderWidth: '1px'
  } : variant === 'solid' ? {
    backgroundColor: tag.color.text,
    color: '#FFFFFF',
    borderColor: tag.color.text
  } : {};
  
  const finalStyle = {
    ...baseStyle,
    ...variantStyle,
    ...hoverStyle
  };
  
  const handleClick = () => {
    if (interactive && onClick) {
      onClick(tag);
    }
  };
  
  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(tag);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (removable && onRemove) {
        e.preventDefault();
        onRemove(tag);
      }
    }
  };
  
  return (
    <span
      style={finalStyle}
      className={`job-tag ${className}`}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onKeyDown={handleKeyDown}
      tabIndex={interactive ? 0 : -1}
      role={interactive ? 'button' : 'text'}
      aria-label={ariaLabel || `${tag.category === 'job_type' ? '岗位类型' : 
                                tag.category === 'work_mode' ? '工作模式' : 
                                tag.category === 'experience' ? '经验要求' : 
                                tag.category === 'urgency' ? '紧急程度' : '标签'}: ${tag.label}`}
      title={tag.description || tag.label}
      {...props}
    >
      {/* 标签图标（可选） */}
      {tag.id === 'remote' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      )}
      
      {tag.id === 'urgent' && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
        </svg>
      )}
      
      {/* 标签文本 */}
      <span>{tag.label}</span>
      
      {/* 移除按钮 */}
      {removable && (
        <button
          type="button"
          onClick={handleRemove}
          className="ml-1 hover:bg-black/10 rounded-full p-0.5 transition-colors"
          aria-label={`移除标签: ${tag.label}`}
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      )}
    </span>
  );
};

// 标签容器组件
export const JobTags: React.FC<JobTagsProps> = ({
  tags,
  maxTags = 8,
  onTagClick,
  onTagRemove,
  size = 'medium',
  variant = 'default',
  interactive = false,
  removable = false,
  showMore = true,
  className = '',
  'aria-label': ariaLabel,
  ...props
}) => {
  const [showAll, setShowAll] = useState(false);
  
  // 处理标签数据
  const processedTags = React.useMemo(() => {
    const tagList = tags.map(tag => {
      if (typeof tag === 'string') {
        return tagUtils.normalize(tag);
      }
      return tag;
    }).filter(Boolean) as JobTagType[];
    
    return tagUtils.generateLayout(tagList, showAll ? undefined : maxTags);
  }, [tags, maxTags, showAll]);
  
  const hasMoreTags = tags.length > maxTags;
  const hiddenCount = tags.length - maxTags;
  
  const containerStyle = {
    ...tagUtils.generateContainerStyle(),
    gap: size === 'small' ? '6px' : size === 'large' ? '10px' : '8px'
  };
  
  return (
    <div
      style={containerStyle}
      className={`job-tags-container ${className}`}
      role="list"
      aria-label={ariaLabel || '职位标签列表'}
      {...props}
    >
      {processedTags.map((tag, index) => (
        <JobTag
          key={`${tag.id}-${index}`}
          tag={tag}
          onClick={onTagClick}
          onRemove={onTagRemove}
          size={size}
          variant={variant}
          interactive={interactive}
          removable={removable}
        />
      ))}
      
      {/* 显示更多按钮 */}
      {showMore && hasMoreTags && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          style={{ height: SIZE_CONFIG[size].height }}
          aria-label={`显示更多标签 (还有${hiddenCount}个)`}
        >
          +{hiddenCount}
        </button>
      )}
      
      {/* 收起按钮 */}
      {showMore && showAll && hasMoreTags && (
        <button
          type="button"
          onClick={() => setShowAll(false)}
          className="inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
          style={{ height: SIZE_CONFIG[size].height }}
          aria-label="收起标签"
        >
          收起
        </button>
      )}
    </div>
  );
};

// 标签编辑器组件
interface JobTagEditorProps {
  tags: JobTagType[];
  onTagsChange: (tags: JobTagType[]) => void;
  suggestions?: JobTagType[];
  placeholder?: string;
  maxTags?: number;
  className?: string;
}

export const JobTagEditor: React.FC<JobTagEditorProps> = ({
  tags,
  onTagsChange,
  suggestions = [],
  placeholder = '输入标签...',
  maxTags = 10,
  className = ''
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const filteredSuggestions = React.useMemo(() => {
    const existingIds = new Set(tags.map(tag => tag.id));
    if (!inputValue.trim()) {
      const base = (suggestions && suggestions.length > 0)
        ? suggestions
        : tagUtils.getRecommended(tags, 5);
      return base
        .filter(tag => !existingIds.has(tag.id))
        .slice(0, 8);
    }
    const searchResults = tagUtils.search(inputValue);
    const suggestionMatches = (suggestions || [])
      .filter(s => s.label.toLowerCase().includes(inputValue.toLowerCase()));
    const merged = [...searchResults, ...suggestionMatches];
    const unique: JobTagType[] = [];
    const seen = new Set<string>();
    for (const t of merged) {
      if (!seen.has(t.id) && !existingIds.has(t.id)) {
        seen.add(t.id);
        unique.push(t);
      }
    }
    return unique.slice(0, 8);
  }, [inputValue, tags, suggestions]);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowSuggestions(true);
  };
  
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTag(inputValue.trim());
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };
  
  const addTag = (tagText: string) => {
    if (tags.length >= maxTags) return;
    
    const normalizedTag = tagUtils.normalize(tagText);
    if (normalizedTag && !tags.some(tag => tag.id === normalizedTag.id)) {
      onTagsChange([...tags, normalizedTag]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };
  
  const removeTag = (tagToRemove: JobTagType) => {
    onTagsChange(tags.filter(tag => tag.id !== tagToRemove.id));
  };
  
  const handleSuggestionClick = (suggestion: JobTagType) => {
    addTag(suggestion.label);
  };
  
  return (
    <div className={`job-tag-editor ${className}`}>
      {/* 已选标签 */}
      <JobTags
        tags={tags}
        removable
        onTagRemove={removeTag}
        className="mb-2"
      />
      
      {/* 输入框 */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={tags.length >= maxTags ? `最多${maxTags}个标签` : placeholder}
          disabled={tags.length >= maxTags}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
        />
        
        {/* 建议列表 */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
            {filteredSuggestions.map(suggestion => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center gap-2 transition-colors"
              >
                <JobTag tag={suggestion} size="small" />
                {suggestion.description && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {suggestion.description}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* 标签计数 */}
      <div className="mt-2 text-xs text-slate-500">
        {tags.length}/{maxTags} 个标签
      </div>
    </div>
  );
};

export default JobTags;
