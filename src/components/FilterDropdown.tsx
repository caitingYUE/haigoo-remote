import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

interface FilterDropdownProps {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
  multiple?: boolean;
  disabled?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  options,
  selectedValues,
  onChange,
  placeholder = "选择选项",
  className = "",
  multiple = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 生成唯一 ID
  const dropdownId = `filter-dropdown-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const listboxId = `${dropdownId}-listbox`;
  const buttonId = `${dropdownId}-button`;

  // 处理点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setFocusedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // 键盘导航处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else if (focusedIndex >= 0) {
          handleOptionToggle(options[focusedIndex].value);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(0);
        } else {
          setFocusedIndex(prev => (prev + 1) % options.length);
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setFocusedIndex(options.length - 1);
        } else {
          setFocusedIndex(prev => prev <= 0 ? options.length - 1 : prev - 1);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setFocusedIndex(-1);
        buttonRef.current?.focus();
        break;
      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setFocusedIndex(0);
        }
        break;
      case 'End':
        if (isOpen) {
          e.preventDefault();
          setFocusedIndex(options.length - 1);
        }
        break;
    }
  };

  const handleOptionToggle = (value: string) => {
    if (multiple) {
      const newValues = selectedValues.includes(value)
        ? selectedValues.filter(v => v !== value)
        : [...selectedValues, value];
      onChange(newValues);
    } else {
      onChange([value]);
      setIsOpen(false);
      setFocusedIndex(-1);
      buttonRef.current?.focus();
    }
  };

  const handleButtonClick = () => {
    if (disabled) return;
    setIsOpen(!isOpen);
    setFocusedIndex(isOpen ? -1 : 0);
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      const option = options.find(opt => opt.value === selectedValues[0]);
      return option?.label || selectedValues[0];
    }
    return `已选择 ${selectedValues.length} 项`;
  };

  const getAriaLabel = () => {
    const baseLabel = `${label}筛选器`;
    if (selectedValues.length === 0) {
      return `${baseLabel}，未选择任何选项`;
    }
    const selectedLabels = selectedValues
      .map(value => options.find(opt => opt.value === value)?.label || value)
      .join('、');
    return `${baseLabel}，已选择：${selectedLabels}`;
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* 筛选按钮 - 将标题集成到按钮内 */}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        onClick={handleButtonClick}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          inline-flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium rounded-lg border transition-all duration-200 focus-ring min-w-[140px]
          ${selectedValues.length > 0 
            ? 'bg-haigoo-primary/10 text-haigoo-primary border-haigoo-primary/30 hover:bg-haigoo-primary/20' 
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-owns={isOpen ? listboxId : undefined}
        aria-label={getAriaLabel()}
        aria-describedby={`${dropdownId}-help`}
      >
        <span className="truncate text-left">
          {getDisplayText()}
        </span>
        
        {/* 选中数量指示器 */}
        {selectedValues.length > 0 && (
          <span 
            className="ml-2 px-1.5 py-0.5 text-xs font-medium bg-haigoo-primary text-white rounded-full"
            aria-hidden="true"
          >
            {selectedValues.length}
          </span>
        )}
        
        <ChevronDown 
          className={`ml-2 h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* 帮助文本（屏幕阅读器） */}
      <div id={`${dropdownId}-help`} className="sr-only">
        {multiple ? '使用空格键或回车键选择多个选项' : '使用空格键或回车键选择选项'}，使用方向键导航，ESC 键关闭
      </div>

      {/* 下拉选项列表 */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 animate-slideUp">
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={`${label}选项列表`}
            aria-multiselectable={multiple}
            className="py-1 max-h-64 overflow-y-auto scrollbar-thin"
          >
            {options.map((option, index) => {
              const isSelected = selectedValues.includes(option.value);
              const isFocused = focusedIndex === index;
              
              return (
                <li key={option.value} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleOptionToggle(option.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={`
                      w-full text-left px-3 py-2 text-sm flex items-center justify-between transition-colors duration-200
                      ${isFocused ? 'bg-gray-50 dark:bg-gray-700' : ''}
                      ${isSelected ? 'text-haigoo-primary bg-haigoo-primary/5' : 'text-gray-700 dark:text-gray-300'}
                      hover:bg-gray-50 dark:hover:bg-gray-700
                    `}
                  >
                    <div className="flex items-center gap-2">
                      {/* 选中状态指示器 */}
                      <div 
                        className={`
                          w-3.5 h-3.5 rounded border-2 flex items-center justify-center transition-all duration-200
                          ${isSelected 
                            ? 'bg-haigoo-primary border-haigoo-primary' 
                            : 'border-gray-300 dark:border-gray-600'
                          }
                        `}
                        aria-hidden="true"
                      >
                        {isSelected && (
                          <Check className="w-2 h-2 text-white" strokeWidth={3} />
                        )}
                      </div>
                      
                      <span className="text-sm">{option.label}</span>
                    </div>
                    
                    {/* 数量显示 */}
                    {option.count !== undefined && (
                      <span 
                        className="text-sm text-gray-500 dark:text-gray-400 font-medium"
                        aria-label={`${option.count} 个结果`}
                      >
                        {option.count}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
            
            {/* 无选项提示 */}
            {options.length === 0 && (
              <li role="presentation" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <p>暂无可选项</p>
              </li>
            )}
          </ul>
          
          {/* 多选模式下的操作按钮 */}
          {multiple && options.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex gap-2">
              <button
                type="button"
                onClick={() => onChange([])}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors focus-ring"
                aria-label="清除所有选择"
              >
                清除全部
              </button>
              <button
                type="button"
                onClick={() => onChange(options.map(opt => opt.value))}
                className="flex-1 px-3 py-2 text-sm font-medium text-haigoo-primary hover:text-haigoo-primary-dark hover:bg-haigoo-primary/10 rounded-lg transition-colors focus-ring"
                aria-label="选择所有选项"
              >
                全选
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterDropdown;