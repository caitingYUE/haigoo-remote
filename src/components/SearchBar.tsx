import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSearch,
  placeholder = "搜索职位、公司或技能...",
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches] = useState<string[]>(['React 开发', 'Python 工程师', '前端开发']);
  const [hotSearches] = useState<string[]>(['AI 工程师', '全栈开发', '数据分析师', 'UI/UX 设计师']);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  // 模拟搜索建议
  useEffect(() => {
    if (value.trim()) {
      const mockSuggestions = [
        `${value} 开发工程师`,
        `${value} 技术专家`,
        `${value} 项目经理`,
        `${value} 产品经理`
      ].filter(suggestion => 
        suggestion.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(mockSuggestions.slice(0, 4));
    } else {
      setSuggestions([]);
    }
  }, [value]);

  // 键盘导航处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = suggestions.length + (value.trim() ? 0 : recentSearches.length + hotSearches.length);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % totalItems);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev <= 0 ? totalItems - 1 : prev - 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          const allItems = value.trim() ? suggestions : [...recentSearches, ...hotSearches];
          const selectedItem = allItems[selectedIndex];
          if (selectedItem) {
            handleSuggestionClick(selectedItem);
          }
        } else if (value.trim()) {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsExpanded(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        if (isExpanded) {
          setIsExpanded(false);
          setSelectedIndex(-1);
        }
        break;
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    onSearch(suggestion);
    setIsExpanded(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleSearch = () => {
    if (value.trim()) {
      onSearch(value.trim());
      setIsExpanded(false);
      setSelectedIndex(-1);
    }
  };

  const handleClear = () => {
    onChange('');
    setIsExpanded(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    setIsExpanded(true);
    setSelectedIndex(-1);
  };

  const handleBlur = (_e: React.FocusEvent) => {
    // 延迟关闭以允许点击建议项
    setTimeout(() => {
      if (!suggestionsRef.current?.contains(document.activeElement)) {
        setIsExpanded(false);
        setSelectedIndex(-1);
      }
    }, 150);
  };

  // 生成唯一 ID
  const searchId = 'search-input';
  const listboxId = 'search-listbox';
  const suggestionIdPrefix = 'search-suggestion';

  return (
    <div className={`relative w-full max-w-2xl ${className}`}>
      {/* 搜索输入框 */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search 
            className="h-5 w-5 text-gray-400" 
            aria-hidden="true"
          />
        </div>
        
        <input
          ref={inputRef}
          id={searchId}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="input pl-12 pr-12 py-3 text-base focus-ring"
          role="combobox"
          aria-expanded={isExpanded}
          aria-haspopup="listbox"
          aria-owns={isExpanded ? listboxId : undefined}
          aria-activedescendant={selectedIndex >= 0 ? `${suggestionIdPrefix}-${selectedIndex}` : undefined}
          aria-label="搜索职位"
          aria-describedby="search-help"
        />
        
        {/* 清除按钮 */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-12 flex items-center pr-2 text-gray-400 hover:text-gray-600 focus-ring rounded-full p-1"
            aria-label="清除搜索内容"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
        
        {/* 搜索按钮 */}
        <button
          type="button"
          onClick={handleSearch}
          className="absolute inset-y-0 right-0 flex items-center pr-4 text-haigoo-primary hover:text-haigoo-primary-dark focus-ring rounded-full p-1"
          aria-label="执行搜索"
          disabled={!value.trim()}
        >
          <Search className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* 搜索帮助文本（屏幕阅读器） */}
      <div id="search-help" className="sr-only">
        使用方向键导航建议项，回车键选择，ESC 键关闭建议列表
      </div>

      {/* 搜索建议下拉框 */}
      {isExpanded && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 animate-slideUp"
          role="region"
          aria-label="搜索建议"
        >
          <ul
            ref={listboxRef}
            id={listboxId}
            role="listbox"
            aria-label="搜索建议列表"
            className="py-2 max-h-80 overflow-y-auto scrollbar-thin"
          >
            {/* 搜索建议 */}
            {suggestions.length > 0 && (
              <>
                <li role="presentation" className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  搜索建议
                </li>
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion} role="presentation">
                    <button
                      id={`${suggestionIdPrefix}-${index}`}
                      role="option"
                      aria-selected={selectedIndex === index}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors ${
                        selectedIndex === index ? 'bg-haigoo-primary/10 text-haigoo-primary' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                      <span>{suggestion}</span>
                    </button>
                  </li>
                ))}
              </>
            )}

            {/* 最近搜索和热门搜索（仅在无输入时显示） */}
            {!value.trim() && (
              <>
                {/* 最近搜索 */}
                {recentSearches.length > 0 && (
                  <>
                    <li role="presentation" className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-t border-gray-100 dark:border-gray-700 mt-2">
                      最近搜索
                    </li>
                    {recentSearches.map((search, index) => {
                      const globalIndex = suggestions.length + index;
                      return (
                        <li key={search} role="presentation">
                          <button
                            id={`${suggestionIdPrefix}-${globalIndex}`}
                            role="option"
                            aria-selected={selectedIndex === globalIndex}
                            onClick={() => handleSuggestionClick(search)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors ${
                              selectedIndex === globalIndex ? 'bg-haigoo-primary/10 text-haigoo-primary' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <Clock className="h-4 w-4 text-gray-400" aria-hidden="true" />
                            <span>{search}</span>
                          </button>
                        </li>
                      );
                    })}
                  </>
                )}

                {/* 热门搜索 */}
                {hotSearches.length > 0 && (
                  <>
                    <li role="presentation" className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide border-t border-gray-100 dark:border-gray-700 mt-2">
                      热门搜索
                    </li>
                    {hotSearches.map((search, index) => {
                      const globalIndex = suggestions.length + recentSearches.length + index;
                      return (
                        <li key={search} role="presentation">
                          <button
                            id={`${suggestionIdPrefix}-${globalIndex}`}
                            role="option"
                            aria-selected={selectedIndex === globalIndex}
                            onClick={() => handleSuggestionClick(search)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors ${
                              selectedIndex === globalIndex ? 'bg-haigoo-primary/10 text-haigoo-primary' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            <TrendingUp className="h-4 w-4 text-gray-400" aria-hidden="true" />
                            <span>{search}</span>
                          </button>
                        </li>
                      );
                    })}
                  </>
                )}
              </>
            )}

            {/* 无结果提示 */}
            {value.trim() && suggestions.length === 0 && (
              <li role="presentation" className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <Search className="h-8 w-8 text-gray-300" aria-hidden="true" />
                  <p>未找到相关搜索建议</p>
                  <p className="text-sm">按回车键搜索 "{value}"</p>
                </div>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
