
import React from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

interface FilterDropdownProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  selectedCount: number;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({ title, isOpen, onToggle, onClose, children, selectedCount }) => {
   const dropdownRef = React.useRef<HTMLDivElement>(null);

   React.useEffect(() => {
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
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
               isOpen || selectedCount > 0
                  ? 'bg-indigo-50 text-indigo-600'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
         >
            {title}
            {selectedCount > 0 && (
               <span className="bg-indigo-600 text-white text-[10px] px-1.5 rounded-full h-4 min-w-[16px] flex items-center justify-center">
                  {selectedCount}
               </span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
         </button>

         {isOpen && (
            <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-100 z-50 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                  {children}
               </div>
            </div>
         )}
      </div>
   );
};

interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
  emphasized?: boolean;
}

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
    <span className={`text-sm truncate ${checked ? 'text-indigo-600 font-medium' : 'text-slate-600'} ${emphasized ? 'font-bold' : ''}`}>
      {label}
    </span>
    {count !== undefined && (
      <span className="ml-auto text-xs text-slate-400">{count}</span>
    )}
  </label>
);

interface JobFilterSidebarProps {
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
  categoryOptions?: { label: string, value: string }[];
  industryOptions?: { label: string, value: string }[];
  jobTypeOptions?: { label: string, value: string }[];
  locationOptions?: { label: string, value: string }[];
}

export default function JobFilterSidebar({
  filters,
  onFilterChange,
  categoryOptions,
  industryOptions,
  jobTypeOptions,
  locationOptions
}: JobFilterSidebarProps) {
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  const toggleDropdown = (key: string) => {
     setOpenDropdown(openDropdown === key ? null : key);
  };

  const handleCheckboxChange = (section: keyof typeof filters, value: string, checked: boolean) => {
    const current = (filters[section] as string[]) || [];
    const updated = checked
      ? [...current, value]
      : current.filter(item => item !== value);
    onFilterChange({ [section]: updated });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 区域限制 */}
      <FilterDropdown
         title="区域限制"
         isOpen={openDropdown === 'region'}
         onToggle={() => toggleDropdown('region')}
         onClose={() => setOpenDropdown(null)}
         selectedCount={filters.regionType.length}
      >
         <CheckboxItem
            label="🇨🇳 中国可申 (China Friendly)"
            checked={filters.regionType.includes('domestic')}
            onChange={(c) => handleCheckboxChange('regionType', 'domestic', c)}
            emphasized
         />
         <CheckboxItem
            label="🌏 海外可申 (Global Remote)"
            checked={filters.regionType.includes('overseas')}
            onChange={(c) => handleCheckboxChange('regionType', 'overseas', c)}
         />
      </FilterDropdown>

      {/* 岗位来源 */}
      <FilterDropdown
         title="岗位来源"
         isOpen={openDropdown === 'source'}
         onToggle={() => toggleDropdown('source')}
         onClose={() => setOpenDropdown(null)}
         selectedCount={filters.sourceType.length}
      >
         <CheckboxItem
            label="俱乐部内推"
            checked={filters.sourceType.includes('club-referral')}
            onChange={(c) => handleCheckboxChange('sourceType', 'club-referral', c)}
         />
         <CheckboxItem
            label="人工精选"
            checked={filters.sourceType.includes('curated')}
            onChange={(c) => handleCheckboxChange('sourceType', 'curated', c)}
         />
         <CheckboxItem
            label="第三方"
            checked={filters.sourceType.includes('third-party')}
            onChange={(c) => handleCheckboxChange('sourceType', 'third-party', c)}
         />
      </FilterDropdown>

      {/* 岗位分类 */}
      {categoryOptions && categoryOptions.length > 0 && (
         <FilterDropdown
            title="岗位分类"
            isOpen={openDropdown === 'category'}
            onToggle={() => toggleDropdown('category')}
            onClose={() => setOpenDropdown(null)}
            selectedCount={filters.category.length}
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
      )}

      {/* 工作经验 */}
      <FilterDropdown
         title="工作经验"
         isOpen={openDropdown === 'exp'}
         onToggle={() => toggleDropdown('exp')}
         onClose={() => setOpenDropdown(null)}
         selectedCount={filters.experienceLevel.length}
      >
         {['Entry', 'Mid', 'Senior', 'Lead', 'Executive'].map(level => (
            <CheckboxItem
               key={level}
               label={level}
               checked={filters.experienceLevel.includes(level)}
               onChange={(c) => handleCheckboxChange('experienceLevel', level, c)}
            />
         ))}
      </FilterDropdown>

      {/* 薪资范围 */}
      <FilterDropdown
         title="薪资范围"
         isOpen={openDropdown === 'salary'}
         onToggle={() => toggleDropdown('salary')}
         onClose={() => setOpenDropdown(null)}
         selectedCount={filters.salary.length}
      >
         {[
            { label: '< 10k', value: '0-10000' },
            { label: '10k - 20k', value: '10000-20000' },
            { label: '20k - 40k', value: '20000-40000' },
            { label: '> 40k', value: '40000-9999999' }
         ].map(opt => (
            <CheckboxItem
               key={opt.value}
               label={opt.label}
               checked={filters.salary.includes(opt.value)}
               onChange={(c) => handleCheckboxChange('salary', opt.value, c)}
            />
         ))}
      </FilterDropdown>
      
      {/* 行业类型 */}
      {industryOptions && industryOptions.length > 0 && (
         <FilterDropdown
            title="行业类型"
            isOpen={openDropdown === 'industry'}
            onToggle={() => toggleDropdown('industry')}
            onClose={() => setOpenDropdown(null)}
            selectedCount={filters.industry.length}
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
      )}

      {/* 工作类型 */}
       {jobTypeOptions && jobTypeOptions.length > 0 && (
          <FilterDropdown
             title="工作类型"
             isOpen={openDropdown === 'jobType'}
             onToggle={() => toggleDropdown('jobType')}
             onClose={() => setOpenDropdown(null)}
             selectedCount={filters.jobType.length}
          >
             {jobTypeOptions.map(opt => (
                <CheckboxItem
                   key={opt.value}
                   label={opt.label}
                   checked={filters.jobType.includes(opt.value)}
                   onChange={(c) => handleCheckboxChange('jobType', opt.value, c)}
                />
             ))}
          </FilterDropdown>
       )}

      {/* 地点 */}
      {locationOptions && locationOptions.length > 0 && (
         <FilterDropdown
            title="地点"
            isOpen={openDropdown === 'location'}
            onToggle={() => toggleDropdown('location')}
            onClose={() => setOpenDropdown(null)}
            selectedCount={filters.location.length}
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
      )}
      
      {/* Clear Filters Button */}
      {Object.values(filters).some(v => Array.isArray(v) ? v.length > 0 : v) && (
         <button
            onClick={() => onFilterChange({
               category: [], experienceLevel: [], industry: [], regionType: [], sourceType: [],
               jobType: [], salary: [], location: [], isTrusted: false, isNew: false
            })}
            className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 ml-2 transition-colors"
         >
            <X className="w-3 h-3" />
            清空筛选
         </button>
      )}
    </div>
  );
}
