import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, Check, X, Filter } from 'lucide-react';

// --- Types ---

interface FilterDropdownProps {
  label: string; // Default label
  activeLabel?: string; // Label when active/selected
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  isActive: boolean; // Whether any value is selected
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
    location: string[]; // This is actually "Regional Restriction" now based on user request? 
    // No, user said "Location changed to Region Restriction". 
    // In code: filters.regionType is 'domestic'/'overseas'. filters.location is city names.
    // User said: "Region Restriction (Location changed to Region Restriction)".
    // This probably means the "Location" filter should be renamed "Region Restriction" OR "Region Type" should be the primary "Region".
    // Let's assume:
    // 1. "Region Restriction" (China/Overseas) -> filters.regionType
    // 2. "Location" (Cities) -> filters.location
    isTrusted: boolean;
    isNew: boolean;
  };
  onFilterChange: (newFilters: any) => void;
  categoryOptions: { label: string, value: string }[];
  industryOptions: { label: string, value: string }[];
  jobTypeOptions: { label: string, value: string }[];
  locationOptions: { label: string, value: string }[];
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

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, activeLabel, isOpen, onToggle, onClose, children, isActive }) => {
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

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all border ${
          isActive || isOpen
            ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-medium'
            : 'bg-white text-slate-700 border-transparent hover:bg-slate-50'
        }`}
      >
        <span className="truncate max-w-[100px]">{isActive && activeLabel ? activeLabel : label}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[200px] max-w-[300px] bg-white rounded-xl shadow-xl border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
          <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count, emphasized }) => (
  <label className="flex items-center gap-2 cursor-pointer py-2 px-2 hover:bg-slate-50 rounded-lg transition-colors">
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
    <span className={`text-sm ${checked ? 'text-indigo-600 font-medium' : 'text-slate-600'} ${emphasized ? 'font-bold' : ''}`}>
      {label}
    </span>
    {count !== undefined && (
      <span className="ml-auto text-xs text-slate-400">{count}</span>
    )}
  </label>
);

export default function JobFilterBar({
  filters,
  onFilterChange,
  categoryOptions,
  industryOptions,
  jobTypeOptions,
  locationOptions
}: JobFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const toggleDropdown = (key: string) => {
    setOpenDropdown(openDropdown === key ? null : key);
  };

  const handleCheckboxChange = (section: keyof typeof filters, value: string, checked: boolean) => {
    const current = (filters[section] as string[]) || [];
    let updated;
    
    // Special handling for single-select behavior if desired, but user asked for multi-select dropdown for Source.
    // For Region Type (China/Overseas), it seems mutually exclusive usually, but let's keep array for flexibility.
    // If user wants "Dropdown to modify", maybe single select is better for Region.
    // Let's implement toggle behavior.
    
    if (checked) {
       // If RegionType, maybe clear others if we want strict single select? 
       // User said "Set China as default, but support dropdown to modify to Overseas".
       // This implies switching.
       if (section === 'regionType') {
           updated = [value]; // Single select behavior
       } else {
           updated = [...current, value];
       }
    } else {
       updated = current.filter(item => item !== value);
       // Ensure at least one region is selected? No, user might want all. But default is China.
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

  const removeFilter = (section: keyof typeof filters, value: string) => {
      const current = filters[section] as string[];
      onFilterChange({ [section]: current.filter(v => v !== value) });
  };

  // Helper to map values back to labels for tags
  const getLabel = (value: string, options: { label: string, value: string }[]) => {
      const found = options.find(o => o.value === value);
      return found ? found.label : value;
  };

  return (
    <div className="space-y-3">
      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Region Type */}
        <FilterDropdown
          label="区域限制"
          activeLabel={getRegionLabel()}
          isActive={filters.regionType.length > 0}
          isOpen={openDropdown === 'regionType'}
          onToggle={() => toggleDropdown('regionType')}
          onClose={() => setOpenDropdown(null)}
        >
          <CheckboxItem
            label="🇨🇳 中国可申"
            checked={filters.regionType.includes('domestic')}
            onChange={(c) => handleCheckboxChange('regionType', 'domestic', c)}
            emphasized
          />
          <CheckboxItem
            label="🌏 海外可申"
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
        >
          <CheckboxItem
            label="✨ 俱乐部内推"
            checked={filters.sourceType.includes('club-referral')}
            onChange={(c) => handleCheckboxChange('sourceType', 'club-referral', c)}
            emphasized
          />
          <CheckboxItem
            label="💎 人工精选"
            checked={filters.sourceType.includes('curated')}
            onChange={(c) => handleCheckboxChange('sourceType', 'curated', c)}
          />
          <CheckboxItem
            label="🌐 第三方平台"
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

        {/* Experience */}
        <FilterDropdown
          label="工作经验"
          activeLabel={getActiveLabel('experienceLevel', EXPERIENCE_OPTIONS, '工作经验')}
          isActive={filters.experienceLevel.length > 0}
          isOpen={openDropdown === 'experienceLevel'}
          onToggle={() => toggleDropdown('experienceLevel')}
          onClose={() => setOpenDropdown(null)}
        >
          {EXPERIENCE_OPTIONS.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.experienceLevel.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('experienceLevel', opt.value, c)}
            />
          ))}
        </FilterDropdown>

        {/* Salary */}
        <FilterDropdown
          label="薪资范围"
          activeLabel={getActiveLabel('salary', SALARY_OPTIONS, '薪资范围')}
          isActive={filters.salary.length > 0}
          isOpen={openDropdown === 'salary'}
          onToggle={() => toggleDropdown('salary')}
          onClose={() => setOpenDropdown(null)}
        >
           {SALARY_OPTIONS.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.salary.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('salary', opt.value, c)}
            />
          ))}
        </FilterDropdown>

        {/* Industry */}
        <FilterDropdown
          label="行业领域"
          activeLabel={getActiveLabel('industry', industryOptions, '行业领域')}
          isActive={filters.industry.length > 0}
          isOpen={openDropdown === 'industry'}
          onToggle={() => toggleDropdown('industry')}
          onClose={() => setOpenDropdown(null)}
        >
          {industryOptions.map(opt => (
            <CheckboxItem
              key={opt.value}
              label={opt.label}
              checked={filters.industry.includes(opt.value)}
              onChange={(c) => handleCheckboxChange('industry', opt.value, c)}
            />
          ))}
        </FilterDropdown>
        
        {/* Specific Location (Cities) - Renamed "区域限制" by user but we already used that for RegionType. 
            User said: "区域限制（地点改为区域限制）".
            Maybe they mean the City filter should be called "区域限制" instead of "地点"? 
            But we have "Region Type" (China/Overseas). 
            Let's call City filter "具体城市" (Specific City) or "城市地点".
            Or maybe user means:
            "Location" -> "区域限制" (Region Restriction).
            And the China/Overseas toggle is "Region Type".
            Let's stick to "城市/地点" for the city list.
        */}
        <FilterDropdown
          label="城市/地点"
          activeLabel={getActiveLabel('location', locationOptions, '城市/地点')}
          isActive={filters.location.length > 0}
          isOpen={openDropdown === 'location'}
          onToggle={() => toggleDropdown('location')}
          onClose={() => setOpenDropdown(null)}
        >
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

      {/* Selected Tags Row */}
      {(filters.category.length > 0 || filters.experienceLevel.length > 0 || filters.industry.length > 0 || filters.location.length > 0 || filters.salary.length > 0) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {filters.category.map(v => (
            <div key={v} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
              {getLabel(v, categoryOptions)}
              <button onClick={() => removeFilter('category', v)} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {filters.experienceLevel.map(v => (
            <div key={v} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
              {getLabel(v, EXPERIENCE_OPTIONS)}
              <button onClick={() => removeFilter('experienceLevel', v)} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {filters.industry.map(v => (
            <div key={v} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
              {getLabel(v, industryOptions)}
              <button onClick={() => removeFilter('industry', v)} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </div>
          ))}
          {filters.location.map(v => (
            <div key={v} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
              {getLabel(v, locationOptions)}
              <button onClick={() => removeFilter('location', v)} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </div>
          ))}
           {filters.salary.map(v => (
            <div key={v} className="flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs">
              {getLabel(v, SALARY_OPTIONS)}
              <button onClick={() => removeFilter('salary', v)} className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
            </div>
          ))}
          <button 
             onClick={() => onFilterChange({ 
                 category: [], experienceLevel: [], industry: [], location: [], salary: [] 
                 // Don't clear RegionType and SourceType as they are defaults
             })}
             className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
          >
             清除筛选
          </button>
        </div>
      )}
    </div>
  );
}
