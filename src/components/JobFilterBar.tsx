import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, Check, Search, SortAsc, Sparkles, SlidersHorizontal, Gem, MapPin, Clock, Banknote, BarChart2, Globe, Building2, X } from 'lucide-react';

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
    timezone: string[];
    isTrusted: boolean;
    isNew: boolean;
  };
  onFilterChange: (newFilters: any) => void;
  categoryOptions: { label: string, value: string }[];
  industryOptions: { label: string, value: string }[];
  jobTypeOptions: { label: string, value: string }[];
  locationOptions: { label: string, value: string }[];
  timezoneOptions: { label: string, value: string }[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'recent' | 'relevance';
  onSortChange: () => void;
  onOpenTracking: () => void;
}

// --- Constants ---

const EXPERIENCE_OPTIONS = [
  { label: '初级/Entry Level', value: 'Entry' },
  { label: '中级/Mid Level', value: 'Mid' },
  { label: '高级/Senior', value: 'Senior' },
  { label: '专家/Lead', value: 'Lead' },
  { label: '高管/Executive', value: 'Executive' }
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
    } else {
      // Cleaner active state: subtle bg, colored text
      buttonClass += "bg-indigo-50 text-indigo-700 border-indigo-200 font-semibold shadow-sm";
    }
  } else {
    // Default state: Clean white background with subtle border
    buttonClass += "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-sm hover:shadow";
  }

  // Chevron color adjustment for solid variants
  const chevronClass = `w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${(isActive || isOpen) && (variant === 'solid-blue' || variant === 'solid-purple') ? 'text-white' : 'text-slate-400'
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
        <>
          {/* Mobile Overlay */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            onClick={onClose}
          />

          <div className="
            z-50 overflow-hidden bg-white
            
            /* Mobile Styles */
            fixed bottom-0 left-0 right-0 w-full rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.1)] border-t border-slate-200
            animate-in slide-in-from-bottom duration-200
            
            /* Desktop Styles */
            md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-auto md:min-w-[240px] md:max-w-[300px] md:rounded-xl md:shadow-xl md:border md:border-slate-100
             md:animate-in md:fade-in md:zoom-in-95
           ">
            <div className="p-2 pb-8 md:pb-2 max-h-[60vh] md:max-h-[400px] overflow-y-auto custom-scrollbar">
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center pb-2 pt-1" onClick={onClose}>
                <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
              </div>
              {children}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count, emphasized }) => (
  <label className="flex items-center gap-2 cursor-pointer py-2 px-2 hover:bg-slate-50 rounded-lg transition-colors w-full">
    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
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
  timezoneOptions,
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
      timezone: [],
      isTrusted: false,
      isNew: false
    });
    onSearchChange('');
  };

  const hasActiveFilters = 
    (filters.category?.length || 0) > 0 ||
    (filters.experienceLevel?.length || 0) > 0 ||
    (filters.industry?.length || 0) > 0 ||
    (filters.regionType?.length || 0) > 0 ||
    (filters.jobType?.length || 0) > 0 ||
    (filters.salary?.length || 0) > 0 ||
    (filters.location?.length || 0) > 0 ||
    (filters.timezone?.length || 0) > 0 ||
    filters.isTrusted || 
    filters.isNew;

  return (
    <div className="flex flex-col gap-4 mb-2">
      <div className="flex flex-col xl:flex-row gap-3 items-start xl:items-center">
        {/* Search Input - Adjusted Width */}
        <div className="relative w-full xl:w-72 flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search jobs..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-slate-900 placeholder-slate-400 text-sm font-medium transition-all"
          />
          {searchTerm && (
             <button 
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
             >
                <X className="w-3 h-3" />
             </button>
          )}
        </div>

        {/* Filter Row - Scrollable on mobile, wrap on desktop */}
        <div className="flex flex-wrap items-center gap-2 flex-1 w-full overflow-x-auto pb-1 xl:pb-0 no-scrollbar">
          
          {/* Role (Category) */}
          <FilterDropdown
            label="Role"
            activeLabel={getActiveLabel('category', categoryOptions, 'Role')}
            isActive={(filters.category?.length || 0) > 0}
            isOpen={openDropdown === 'category'}
            onToggle={() => toggleDropdown('category')}
            onClose={() => setOpenDropdown(null)}
            icon={<Gem className="w-3.5 h-3.5" />}
          >
            {categoryOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.category?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('category', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Salary (Renamed from Rate) */}
          {/* 
          <FilterDropdown
            label="Salary"
            activeLabel={getActiveLabel('salary', SALARY_OPTIONS, 'Salary')}
            isActive={(filters.salary?.length || 0) > 0}
            isOpen={openDropdown === 'salary'}
            onToggle={() => toggleDropdown('salary')}
            onClose={() => setOpenDropdown(null)}
            icon={<Banknote className="w-3.5 h-3.5" />}
          >
            {SALARY_OPTIONS.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.salary?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('salary', opt.value, c)}
              />
            ))}
          </FilterDropdown>
          */}

          {/* Location */}
          <FilterDropdown
            label="Location"
            activeLabel={getActiveLabel('location', locationOptions, 'Location')}
            isActive={(filters.location?.length || 0) > 0}
            isOpen={openDropdown === 'location'}
            onToggle={() => toggleDropdown('location')}
            onClose={() => setOpenDropdown(null)}
            icon={<MapPin className="w-3.5 h-3.5" />}
          >
            {locationOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.location?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('location', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Job Type (Renamed from Commitment) */}
          <FilterDropdown
            label="Job Type"
            activeLabel={getActiveLabel('jobType', jobTypeOptions, 'Job Type')}
            isActive={(filters.jobType?.length || 0) > 0}
            isOpen={openDropdown === 'jobType'}
            onToggle={() => toggleDropdown('jobType')}
            onClose={() => setOpenDropdown(null)}
            icon={<Clock className="w-3.5 h-3.5" />}
          >
            {jobTypeOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.jobType?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('jobType', opt.value, c)}
              />
            ))}
          </FilterDropdown>

           {/* Industry */}
           <FilterDropdown
            label="Industry"
            activeLabel={getActiveLabel('industry', industryOptions, 'Industry')}
            isActive={(filters.industry?.length || 0) > 0}
            isOpen={openDropdown === 'industry'}
            onToggle={() => toggleDropdown('industry')}
            onClose={() => setOpenDropdown(null)}
            icon={<Building2 className="w-3.5 h-3.5" />}
          >
            {industryOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={filters.industry?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('industry', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Clear All Button */}
          {(hasActiveFilters || searchTerm) && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors ml-auto xl:ml-0"
            >
              Clear all
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 ml-auto hidden xl:flex">
          <button
            onClick={onSortChange}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg shadow-sm text-sm font-medium transition-all whitespace-nowrap ${sortBy === 'recent'
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
            <span className="hidden sm:inline">岗位追踪</span>
          </button>
        </div>
      </div>
    </div>
  );
}