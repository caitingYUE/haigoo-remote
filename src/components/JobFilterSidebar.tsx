
import React from 'react';
import { ChevronDown, ChevronUp, Check, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FilterSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const FilterSection: React.FC<FilterSectionProps> = ({ title, isOpen, onToggle, children }) => (
  <div className="border-b border-gray-200 py-4">
    <button 
      className="flex items-center justify-between w-full text-left mb-2 group"
      onClick={onToggle}
    >
      <span className="font-bold text-gray-900 text-sm">{title}</span>
      {isOpen ? (
        <ChevronUp className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
      ) : (
        <ChevronDown className="w-4 h-4 text-gray-400 group-hover:text-gray-600" />
      )}
    </button>
    {isOpen && (
      <div className="mt-2 space-y-2 animate-in slide-in-from-top-1 duration-200">
        {children}
      </div>
    )}
  </div>
);

interface CheckboxItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  count?: number;
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count }) => (
  <label className="flex items-center gap-2 cursor-pointer py-1 hover:bg-gray-50 rounded px-1 -mx-1 transition-colors">
    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
      checked ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'
    }`}>
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
    <input 
      type="checkbox" 
      className="hidden" 
      checked={checked} 
      onChange={(e) => onChange(e.target.checked)} 
    />
    <span className={`text-sm ${checked ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{label}</span>
    {count !== undefined && (
      <span className="ml-auto text-xs text-gray-400">{count}</span>
    )}
  </label>
);

interface JobFilterSidebarProps {
  filters: {
    industry: string[];
    jobType: string[];
    salary: string[]; // Simple range buckets
    location: string[];
    isTrusted: boolean;
    isNew: boolean;
  };
  onFilterChange: (newFilters: any) => void;
}

export default function JobFilterSidebar({ filters, onFilterChange }: JobFilterSidebarProps) {
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    industry: true,
    jobType: true,
    salary: true,
    location: true
  });
  
  const navigate = useNavigate();

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleIndustryChange = (industry: string, checked: boolean) => {
    const newIndustries = checked 
      ? [...filters.industry, industry]
      : filters.industry.filter(i => i !== industry);
    onFilterChange({ ...filters, industry: newIndustries });
  };

  const handleJobTypeChange = (type: string, checked: boolean) => {
    const newTypes = checked 
      ? [...filters.jobType, type]
      : filters.jobType.filter(t => t !== type);
    onFilterChange({ ...filters, jobType: newTypes });
  };

  const handleSalaryChange = (range: string, checked: boolean) => {
    const newSalaries = checked 
      ? [...filters.salary, range]
      : filters.salary.filter(s => s !== range);
    onFilterChange({ ...filters, salary: newSalaries });
  };

  // Hardcoded options based on provided constraints (existing data)
  const INDUSTRIES = [
    '互联网/IT', '市场营销', '设计', '产品', '运营', '销售', '人事/行政', '金融'
  ];

  const JOB_TYPES = [
    { label: '全职 (Full-time)', value: 'full-time' },
    { label: '兼职 (Part-time)', value: 'part-time' },
    { label: '合同 (Contract)', value: 'contract' },
    { label: '实习 (Internship)', value: 'internship' }
  ];
  
  const SALARY_RANGES = [
    { label: '< 10k', value: '0-10000' },
    { label: '10k - 20k', value: '10000-20000' },
    { label: '20k - 50k', value: '20000-50000' },
    { label: '> 50k', value: '50000-999999' }
  ];

  const LOCATIONS = [
    { label: '远程 (Remote)', value: 'Remote' },
    { label: '全球 (Worldwide)', value: 'Worldwide' },
    { label: '中国 (China)', value: 'China' },
    { label: '美国 (USA)', value: 'USA' },
    { label: '欧洲 (Europe)', value: 'Europe' },
    { label: '亚太 (APAC)', value: 'APAC' }
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="text-lg font-bold text-gray-900 mb-4">筛选职位 (Filter Jobs)</h2>
        
        <FilterSection 
          title="行业分类 (Industry)" 
          isOpen={openSections.industry} 
          onToggle={() => toggleSection('industry')}
        >
          {INDUSTRIES.map(ind => (
            <CheckboxItem 
              key={ind} 
              label={ind} 
              checked={filters.industry.includes(ind)}
              onChange={(c) => handleIndustryChange(ind, c)}
            />
          ))}
        </FilterSection>

        <FilterSection 
          title="工作类型 (Job Type)" 
          isOpen={openSections.jobType} 
          onToggle={() => toggleSection('jobType')}
        >
          {JOB_TYPES.map(type => (
            <CheckboxItem 
              key={type.value} 
              label={type.label} 
              checked={filters.jobType.includes(type.value)}
              onChange={(c) => handleJobTypeChange(type.value, c)}
            />
          ))}
        </FilterSection>

        <FilterSection 
          title="薪资范围 (Salary)" 
          isOpen={openSections.salary} 
          onToggle={() => toggleSection('salary')}
        >
          {SALARY_RANGES.map(range => (
            <CheckboxItem 
              key={range.value} 
              label={range.label} 
              checked={filters.salary.includes(range.value)}
              onChange={(c) => handleSalaryChange(range.value, c)}
            />
          ))}
        </FilterSection>

        <div className="border-b border-gray-200 py-4 space-y-3">
            <CheckboxItem 
              label="俱乐部认证 (Club Verified)" 
              checked={filters.isTrusted}
              onChange={(c) => onFilterChange({ ...filters, isTrusted: c })}
            />
             <CheckboxItem 
              label="最新发布 (New Postings)" 
              checked={filters.isNew}
              onChange={(c) => onFilterChange({ ...filters, isNew: c })}
            />
        </div>

        <button 
          onClick={() => onFilterChange({ industry: [], jobType: [], salary: [], location: [], isTrusted: false, isNew: false })}
          className="w-full mt-6 bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-md shadow-slate-200"
        >
          Apply Filters
        </button>
      </div>

      {/* AI Resume Optimization Promo Card */}
      <div className="bg-orange-50 rounded-xl border border-orange-100 p-5 shadow-sm relative overflow-hidden">
         <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-orange-200 rounded-full opacity-20 blur-xl"></div>
         <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
               <Zap className="w-5 h-5 text-orange-500 fill-orange-500" />
               <h3 className="font-bold text-gray-900 text-sm">简历还在被动等待?</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
               试试我们的 AI 简历优化建议 (Try our AI optimization suggestions).
            </p>
            <button 
              onClick={() => navigate('/profile?tab=resume')}
              className="w-full py-2 bg-white border border-orange-200 text-orange-600 font-medium text-sm rounded-lg hover:bg-orange-50 transition-colors"
            >
               优化简历 (Optimize Resume)
            </button>
         </div>
      </div>
    </div>
  );
}
