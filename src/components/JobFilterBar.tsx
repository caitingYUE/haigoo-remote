import React, { useRef, useEffect, useState } from 'react';
import { ChevronDown, Check, Search, SortAsc, Sparkles, SlidersHorizontal, Gem, MapPin, Clock, Banknote, BarChart2, Globe, Building2, X, Briefcase, Calendar, TrendingUp } from 'lucide-react';

// --- Types ---

interface FilterDropdownProps {
  label: string; // Default label
  activeLabel?: string; // Label when active/selected
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  isActive: boolean; // Whether any value is selected
  colorTheme?: 'indigo' | 'amber' | 'emerald' | 'purple' | 'slate';
  icon?: React.ReactNode;
  onApply?: () => void;
  onClear?: () => void;
}

interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  emphasized?: boolean;
  colorTheme?: 'indigo' | 'amber' | 'emerald' | 'purple' | 'slate';
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

// --- Theme Configuration ---
const THEME_STYLES = {
  indigo: {
    active: 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm',
    icon: 'text-indigo-500',
    checkbox: 'bg-indigo-600 border-indigo-600',
    textChecked: 'text-indigo-700'
  },
  amber: {
    active: 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm',
    icon: 'text-amber-500',
    checkbox: 'bg-amber-500 border-amber-500',
    textChecked: 'text-amber-700'
  },
  emerald: {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm',
    icon: 'text-emerald-500',
    checkbox: 'bg-emerald-600 border-emerald-600',
    textChecked: 'text-emerald-700'
  },
  purple: {
    active: 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm',
    icon: 'text-purple-500',
    checkbox: 'bg-purple-600 border-purple-600',
    textChecked: 'text-purple-700'
  },
  slate: {
    active: 'bg-slate-100 text-slate-900 border-slate-200 shadow-sm',
    icon: 'text-slate-500',
    checkbox: 'bg-slate-600 border-slate-600',
    textChecked: 'text-slate-900'
  }
};

// --- Components ---

const FilterDropdown: React.FC<FilterDropdownProps> = ({ label, activeLabel, isOpen, onToggle, onClose, children, isActive, colorTheme = 'slate', icon, onApply, onClear }) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        // If clicking outside, trigger apply if available, otherwise just close
        if (onApply) {
            onApply();
        } else {
            onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, onApply]);

  const theme = THEME_STYLES[colorTheme];

  // Button Styles
  let buttonClass = "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-all border whitespace-nowrap ";

  if (isActive || isOpen) {
    buttonClass += theme.active + " font-semibold";
  } else {
    // Default state: Clean white background with subtle border
    buttonClass += "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-900 shadow-sm hover:shadow";
  }

  // Chevron Style
  const chevronClass = `w-3.5 h-3.5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''} ${isActive || isOpen ? theme.icon : 'text-slate-400'}`;

  // Icon Style (Input icon)
  const iconClass = isActive || isOpen ? theme.icon : 'text-slate-400 group-hover:text-slate-500';

  return (
    <div className="relative inline-block text-left group" ref={dropdownRef}>
      <button
        onClick={(e) => {
          console.log(`[FilterDropdown] Button clicked: ${label}`);
          if (isOpen && onApply) {
             onApply(); // Apply on toggle close
          } else {
             onToggle();
          }
        }}
        className={buttonClass}
      >
        {icon && <span className={iconClass}>{icon}</span>}
        <span className="truncate max-w-[100px]">{isActive && activeLabel ? activeLabel : label}</span>
        <ChevronDown className={chevronClass} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop Overlay - Handles 'click outside' reliably */}
          <div
            className="fixed inset-0 z-[9990] bg-black/20 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none cursor-default"
            onClick={(e) => {
               console.log('[FilterDropdown] Backdrop clicked');
               e.stopPropagation();
               if (onApply) onApply(); else onClose();
            }}
          />

          <div className="
            z-[9999] overflow-hidden bg-white
            
            /* Mobile Styles */
            fixed bottom-0 left-0 right-0 w-full rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.1)] border-t border-slate-200
            animate-in slide-in-from-bottom duration-200
            
            /* Desktop Styles */
            md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-auto md:min-w-[240px] md:max-w-[300px] md:rounded-xl md:shadow-xl md:border md:border-slate-100
             md:animate-in md:fade-in md:zoom-in-95
           "
           style={{ pointerEvents: 'auto' }}
           onClick={(e) => {
             console.log('[FilterDropdown] Content container clicked (propagation stopped)');
             e.stopPropagation();
           }} 
           >
            <div className="p-2 pb-8 md:pb-2 max-h-[60vh] md:max-h-[320px] overflow-y-auto custom-scrollbar">
              {/* Mobile Handle */}
              <div className="md:hidden flex justify-center pb-2 pt-1" onClick={onApply || onClose}>
                <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
              </div>
              {/* Pass theme to children (CheckboxItems) */}
              {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                  return React.cloneElement(child as React.ReactElement<any>, { colorTheme });
                }
                return child;
              })}
            </div>
            
            {/* Action Footer */}
            {(onApply || onClear) && (
                <div className="p-3 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm flex justify-between items-center gap-4">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onClear) onClear();
                        }}
                        className="text-xs text-slate-500 hover:text-slate-800 font-medium px-2 py-1 rounded hover:bg-slate-200/50 transition-colors"
                    >
                        清空
                    </button>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onApply) onApply();
                        }}
                        className={`flex-1 px-3 py-1.5 text-xs font-semibold text-white rounded-md shadow-sm shadow-${colorTheme}-500/20 hover:shadow-md transition-all ${
                            colorTheme === 'indigo' ? 'bg-indigo-600 hover:bg-indigo-700' :
                            colorTheme === 'amber' ? 'bg-amber-500 hover:bg-amber-600' :
                            colorTheme === 'emerald' ? 'bg-emerald-600 hover:bg-emerald-700' :
                            colorTheme === 'purple' ? 'bg-purple-600 hover:bg-purple-700' :
                            'bg-slate-800 hover:bg-slate-900'
                        }`}
                    >
                        应用筛选
                    </button>
                </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count, emphasized, colorTheme = 'slate' }) => {
  const theme = THEME_STYLES[colorTheme];
  
  return (
    <div
      className="flex items-center gap-2 cursor-pointer py-2 px-2 hover:bg-slate-50 rounded-lg transition-colors w-full select-none"
      onClick={(e) => {
        // P0 Debug: Explicitly handle label click to ensure event propagation
        console.log(`[JobFilterBar] Container clicked for: ${label}`);
        e.preventDefault(); // Prevent default label behavior
        e.stopPropagation(); // Stop bubbling
        onChange(!checked); // Manually toggle
      }}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 ${checked ? theme.checkbox : 'border-slate-300 bg-white'
        }`}>
        {checked && <Check className="w-3 h-3 text-white" />}
      </div>
      <span className={`text-sm flex-1 ${checked ? `${theme.textChecked} font-medium` : 'text-slate-600'} ${emphasized ? 'font-bold' : ''}`}>
        {label}
      </span>
      {count !== undefined && (
        <span className="ml-auto text-xs text-slate-400">{count}</span>
      )}
    </div>
  );
};

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
  
  // Temp filters for deferred application
  const [tempFilters, setTempFilters] = useState(filters);

  // Sync temp filters when dropdown is closed or filters change externally
  useEffect(() => {
    if (openDropdown === null) {
      setTempFilters(filters);
    }
  }, [filters, openDropdown]);

  const applyFilters = (key: string) => {
    // Only trigger update if changed
    // Simple deep check for the specific key
    const currentVal = filters[key as keyof typeof filters];
    const newVal = tempFilters[key as keyof typeof filters];
    
    if (JSON.stringify(currentVal) !== JSON.stringify(newVal)) {
        onFilterChange({ [key]: newVal });
    }
    setOpenDropdown(null);
  };

  const clearTempFilter = (key: string) => {
      setTempFilters(prev => ({ ...prev, [key]: [] }));
  };

  const toggleDropdown = (key: string) => {
    if (openDropdown === key) {
      // Closing: Apply
      applyFilters(key);
    } else {
      // Opening: Sync temp with real (just in case)
      setTempFilters(prev => ({ ...prev, [key]: filters[key as keyof typeof filters] }));
      setOpenDropdown(key);
    }
  };

  const handleCheckboxChange = (section: keyof typeof filters, value: string, checked: boolean) => {
    console.log(`[JobFilterBar] Checkbox changed: section=${section}, value=${value}, checked=${checked}`);
    
    // Update TEMP state only
    setTempFilters(prev => {
        const current = (prev[section] as string[]) || [];
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
        
        return { ...prev, [section]: updated };
    });
  };

  const getActiveLabel = (section: keyof typeof filters, options: { label: string, value: string }[], defaultLabel: string) => {
    // Use REAL filters for label display when closed, TEMP when open?
    // Actually better to use REAL filters for the button label always, 
    // but maybe TEMP when open to show live count?
    // Let's stick to REAL filters for the button label to avoid jumping during edit before apply.
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
        <div className="flex flex-wrap items-center gap-2 flex-1 w-full pb-1 xl:pb-0">
          
          {/* Job Type (Renamed from Commitment) */}
          <FilterDropdown
            label="工作类型"
            activeLabel={getActiveLabel('jobType', jobTypeOptions, '工作类型')}
            isActive={(filters.jobType?.length || 0) > 0}
            isOpen={openDropdown === 'jobType'}
            onToggle={() => toggleDropdown('jobType')}
            onClose={() => applyFilters('jobType')}
            onApply={() => applyFilters('jobType')}
            onClear={() => clearTempFilter('jobType')}
            icon={<Calendar className="w-3.5 h-3.5" />}
            colorTheme="amber"
          >
            {jobTypeOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={tempFilters.jobType?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('jobType', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Experience Level (New) */}
          <FilterDropdown
            label="级别"
            activeLabel={getActiveLabel('experienceLevel', EXPERIENCE_OPTIONS, '级别')}
            isActive={(filters.experienceLevel?.length || 0) > 0}
            isOpen={openDropdown === 'experienceLevel'}
            onToggle={() => toggleDropdown('experienceLevel')}
            onClose={() => applyFilters('experienceLevel')}
            onApply={() => applyFilters('experienceLevel')}
            onClear={() => clearTempFilter('experienceLevel')}
            icon={<TrendingUp className="w-3.5 h-3.5" />}
            colorTheme="emerald"
          >
            {EXPERIENCE_OPTIONS.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={tempFilters.experienceLevel?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('experienceLevel', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Industry - Moved before Role */}
           <FilterDropdown
            label="行业"
            activeLabel={getActiveLabel('industry', industryOptions, '行业')}
            isActive={(filters.industry?.length || 0) > 0}
            isOpen={openDropdown === 'industry'}
            onToggle={() => toggleDropdown('industry')}
            onClose={() => applyFilters('industry')}
            onApply={() => applyFilters('industry')}
            onClear={() => clearTempFilter('industry')}
            icon={<Building2 className="w-3.5 h-3.5" />}
            colorTheme="purple"
          >
            {industryOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={tempFilters.industry?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('industry', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Role (Category) -> Renamed to '角色' (Role) to match backend 'category' better */}
          <FilterDropdown
            label="角色"
            activeLabel={getActiveLabel('category', categoryOptions, '角色')}
            isActive={(filters.category?.length || 0) > 0}
            isOpen={openDropdown === 'category'}
            onToggle={() => toggleDropdown('category')}
            onClose={() => applyFilters('category')}
            onApply={() => applyFilters('category')}
            onClear={() => clearTempFilter('category')}
            icon={<Briefcase className="w-3.5 h-3.5" />}
            colorTheme="indigo"
          >
            {categoryOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={tempFilters.category?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('category', opt.value, c)}
              />
            ))}
          </FilterDropdown>

          {/* Location */}
          <FilterDropdown
            label="地点"
            activeLabel={getActiveLabel('location', locationOptions, '地点')}
            isActive={(filters.location?.length || 0) > 0}
            isOpen={openDropdown === 'location'}
            onToggle={() => toggleDropdown('location')}
            onClose={() => applyFilters('location')}
            onApply={() => applyFilters('location')}
            onClear={() => clearTempFilter('location')}
            icon={<MapPin className="w-3.5 h-3.5" />}
            colorTheme="slate"
          >
            {locationOptions.map(opt => (
              <CheckboxItem
                key={opt.value}
                label={opt.label}
                checked={tempFilters.location?.includes(opt.value) || false}
                onChange={(c) => handleCheckboxChange('location', opt.value, c)}
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