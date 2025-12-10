import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, Check, Search, SortAsc, Sparkles, SlidersHorizontal } from 'lucide-react';

// --- Types ---

interface FilterDropdownProps {
  label: string; // Default label
  activeLabel?: string; // Label when active/selected
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  isActive: boolean; // Whether any value is selected
  variant?: 'default' | 'solid-blue' | 'solid-purple'; // Added variant
  icon?: React.ReactNode;
}

interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  emphasized?: boolean;
}

interface JobFilterBarProps {
  filters: {
    category: string[];
    experienceLevel: string[];
    industry: string[];
    regionType: string[];
    sourceType: string[];
    jobType: string[];
    salary: string[];
    location: string[];
    isTrusted: boolean;
    isNew: boolean;
  };
  onFilterChange: (newFilters: any) => void;
  categoryOptions: { label: string, value: string }[];
  industryOptions: { label: string, value: string }[];
  jobTypeOptions: { label: string, value: string }[];
  locationOptions: { label: string, value: string }[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'recent' | 'relevance';
  onSortChange: () => void;
  onOpenTracking: () => void;
}

// --- Constants ---

const EXPERIENCE_OPTIONS = [
  { label: '在校/应届', value: 'Intern/Junior' },
  { label: '1-3年', value: '1-3 years' },
  { label: '3-5年', value: '3-5 years' },
  { label: '5-10年', value: '5-10 years' },
  { label: '10年以上', value: '10+ years' }
];

const SALARY_OPTIONS = [
  { label: '15k以下', value: '0-15000' },
  { label: '15k-30k', value: '15000-30000' },
  { label: '30k-50k', value: '30000-50000' },
  { label: '50k-80k', value: '50000-80000' },
  { label: '80k以上', value: '80000-999999' }
];

// --- Components ---

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, activeLabel, isOpen, onToggle, onClose, children, isActive, variant = 'default', icon }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Determine button styles based on variant and active state
  let buttonClass = "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all border whitespace-nowrap ";
  
  if (isActive || isOpen) {
    if (variant === 'solid-blue') {
       buttonClass += "bg-indigo-600 text-white border-indigo-600 font-medium shadow-sm hover:bg-indigo-700";
    } else if (variant === 'solid-purple') {
       buttonClass += "bg-indigo-600 text-white border-indigo-600 font-medium shadow-sm hover:bg-indigo-700";
    } else {
       buttonClass += "bg-indigo-50 text-indigo-600 border-indigo-200 font-medium";
    }
  } else {
    buttonClass += "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300";
  }

  // Chevron color adjustment for solid variants
  const chevronClass = `w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${
    (isActive || isOpen) && (variant === 'solid-blue' || variant === 'solid-purple') ? 'text-white' : 'text-slate-400'
  }`;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={buttonClass}
      >
        {icon && <span className={isActive && (variant === 'solid-blue' || variant === 'solid-purple') ? 'text-white' : 'text-slate-500'}>{icon}</span>}
        <span className="truncate max-w-[100px]">{isActive && activeLabel ? activeLabel : label}</span>
        <ChevronDown className={chevronClass} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[240px] max-w-[300px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count, emphasized }) => (
  <label className="flex items-center gap-2 cursor-pointer py-2 px-2 hover:bg-slate-50 rounded-lg transition-colors w-full">
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${
       checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
      }`}>
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
    <input
      type="checkbox"
      className="hidden"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className={`text-sm flex-1 ${checked ? 'text-indigo-600 font-medium' : 'text-slate-600'} ${emphasized ? 'font-bold' : ''}`}>
      {label}
    </span>
    {count !== undefined && (
      <span className="ml-auto text-xs text-slate-400">{count}</span>
    )}
  </label>
);

const FilterSectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-2 py-1.5 mt-2 first:mt-0 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/50 rounded-md">
    {title}
  </div>
);

export default function JobFilterBar({
  filters,
  onFilterChange,
  categoryOptions,
  industryOptions,
  jobTypeOptions,
  locationOptions,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  onOpenTracking
}: JobFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdown(openDropdown === key ? null : key);
  };

  const handleCheckboxChange = (section: keyof typeof filters, value: string, checked: boolean) => {
    const current = (filters[section] as string[]) || [];
    let updated;
    
    if (checked) {
       if (section === 'regionType') {
           updated = [value]; // Single select behavior
       } else {
           updated = [...current, value];
       }
    } else {
       updated = current.filter(item => item !== value);
    }

    onFilterChange({ [section]: updated });
  };

  const getActiveLabel = (section: keyof typeof filters, options: { label: string, value: string }[], defaultLabel: string) => {
    const current = filters[section] as string[];
    if (!current || current.length === 0) return defaultLabel;
    if (current.length === 1) {
      const found = options.find(o => o.value === current[0]);
      return found ? found.label : current[0];
    }
    return `${defaultLabel} (${current.length})`;
  };
  
  // Custom label logic for Region
  const getRegionLabel = () => {
      if (filters.regionType.includes('domestic')) return '中国可申';
      if (filters.regionType.includes('overseas')) return '海外可申';
      return '区域限制';
  };

  // Custom label logic for Source
  const getSourceLabel = () => {
      if (filters.sourceType.length === 0) return '岗位来源';
      if (filters.sourceType.length === 1) {
          if (filters.sourceType[0] === 'club-referral') return '俱乐部内推';
          if (filters.sourceType[0] === 'curated') return '人工精选';
          if (filters.sourceType[0] === 'third-party') return '第三方平台';
      }
      return `岗位来源 (${filters.sourceType.length})`;
  };
  
  const getMoreFiltersCount = () => {
    const count = 
      filters.experienceLevel.length + 
      filters.salary.length + 
      filters.industry.length + 
      filters.location.length;
    return count > 0 ? `更多筛选 (${count})` : '更多筛选';
  };
  
  const hasMoreFilters = 
    filters.experienceLevel.length > 0 || 
    filters.salary.length > 0 || 
    filters.industry.length > 0 || 
    filters.location.length > 0;

  const clearAllFilters = () => {
    onFilterChange({
      category: [],
      experienceLevel: [],
      industry: [],
      regionType: [],
      sourceType: [],
      jobType: [],
      salary: [],
      location: [],
      isTrusted: false,
      isNew: false
    });
    onSearchChange('');
  };

  return (
    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-3">
      {/* Search Input - Compact */}
      <div className="relative flex-1 xl:max-w-xs min-w-[240px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索职位、公司、技能..."
          className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 placeholder-slate-400 text-sm transition-all"
        />
      </div>

      <div className="h-px xl:h-auto xl:w-px bg-slate-100 xl:mx-1"></div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2 flex-1">
        {/* Reset Button */}
        {(filters.category.length > 0 || filters.experienceLevel.length > 0 || filters.industry.length > 0 || filters.regionType.length > 0 || filters.sourceType.length > 0 || filters.jobType.length > 0 || filters.salary.length > 0 || filters.location.length > 0 || filters.isTrusted || filters.isNew || searchTerm) && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all border bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-700 whitespace-nowrap"
            title="重置所有筛选"
          >
            <span className="text-xs font-medium">重置</span>
          </button>
        )}

        {/* Region Type */}
        <FilterDropdown
          label="区域限制"
          activeLabel={getRegionLabel()}
          isActive={filters.regionType.length > 0}
          isOpen={openDropdown === 'regionType'}
          onToggle={() => toggleDropdown('regionType')}
          onClose={() => setOpenDropdown(null)}
          variant="solid-blue"
        >
          <CheckboxItem
            label="中国可申"
            checked={filters.regionType.includes('domestic')}
            onChange={(c) => handleCheckboxChange('regionType', 'domestic', c)}
            emphasized
          />
          <CheckboxItem
            label="海外可申"
            checked={filters.regionType.includes('overseas')}
            onChange={(c) => handleCheckboxChange('regionType', 'overseas', c)}
          />
        </FilterDropdown>

        {/* Source Type */}
        <FilterDropdown
          label="岗位来源"
          activeLabel={getSourceLabel()}
          isActive={filters.sourceType.length > 0}
          isOpen={openDropdown === 'sourceType'}
          onToggle={() => toggleDropdown('sourceType')}
          onClose={() => setOpenDropdown(null)}
          variant="solid-purple"
        >
          <CheckboxItem
            label="俱乐部内推"
            checked={filters.sourceType.includes('club-referral')}
            onChange={(c) => handleCheckboxChange('sourceType', 'club-referral', c)}
            emphasized
          />
          <CheckboxItem
            label="人工精选"
            checked={filters.sourceType.includes('curated')}
            onChange={(c) => handleCheckboxChange('sourceType', 'curated', c)}
          />
          <CheckboxItem
            label="第三方平台"
            checked={filters.sourceType.includes('third-party')}
            onChange={(c) => handleCheckboxChange('sourceType', 'third-party', c)}
          />
        </FilterDropdown>

        {/* Category */}
        <FilterDropdown
          label="岗位分类"
          activeLabel={getActiveLabel('category', categoryOptions, '岗位分类')}
          isActive={filters.category.length > 0}
          isOpen={openDropdown === 'category'}
          onToggle={() => toggleDropdown('category')}
          onClose={() => setOpenDropdown(null)}
        >
          {categoryOptions.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.category.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('category', opt.value, c)}
            />
          ))}
        </FilterDropdown>

        {/* More Filters */}
        <FilterDropdown
          label="更多筛选"
          activeLabel={getMoreFiltersCount()}
          isActive={hasMoreFilters}
          isOpen={openDropdown === 'more'}
          onToggle={() => toggleDropdown('more')}
          onClose={() => setOpenDropdown(null)}
          icon={<SlidersHorizontal className="w-3.5 h-3.5" />}
        >
          {/* Experience Section */}
          <FilterSectionHeader title="岗位级别" />
          {EXPERIENCE_OPTIONS.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.experienceLevel.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('experienceLevel', opt.value, c)}
            />
          ))}

          {/* Salary Section */}
          <FilterSectionHeader title="薪资范围" />
          {SALARY_OPTIONS.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.salary.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('salary', opt.value, c)}
            />
          ))}

          {/* Industry Section */}
          <FilterSectionHeader title="行业领域" />
          {industryOptions.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.industry.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('industry', opt.value, c)}
            />
          ))}

          {/* Location Section */}
          <FilterSectionHeader title="城市/地点" />
          {locationOptions.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.location.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('location', opt.value, c)}
            />
          ))}
        </FilterDropdown>
      </div>

      <div className="h-px xl:h-auto xl:w-px bg-slate-100 xl:mx-1"></div>

      {/* Actions */}
      <div className="flex items-center gap-2 justify-end">
        <button
           onClick={onSortChange}
           className={`flex items-center gap-2 px-3 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all whitespace-nowrap ${
             sortBy === 'recent'
               ? 'bg-slate-900 border-slate-900 text-white'
               : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
           }`}
           title={sortBy === 'recent' ? '当前：最新发布' : '当前：相关度排序'}
        >
           <SortAsc className="w-4 h-4" />
           <span className="hidden sm:inline">{sortBy === 'recent' ? '最新' : '相关'}</span>
        </button>

        <button
          onClick={onOpenTracking}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white border border-indigo-600 rounded-lg shadow-sm text-sm font-bold hover:bg-indigo-700 transition-all whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-indigo-100" />
          <span className="hidden sm:inline">追踪</span>
        </button>
      </div>
    </div>
  );
}