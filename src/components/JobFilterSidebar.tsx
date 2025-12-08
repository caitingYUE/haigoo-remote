
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
  <div className="border-b border-slate-200 py-4">
    <button
      className="flex items-center justify-between w-full text-left mb-2 group"
      onClick={onToggle}
    >
      <span className="font-bold text-slate-900 text-sm">{title}</span>
      {isOpen ? (
        <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
      ) : (
        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
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
  emphasized?: boolean; // 用于"中国可申"加粗
}

const CheckboxItem: React.FC<CheckboxItemProps> = ({ label, checked, onChange, count, emphasized }) => (
  <label className="flex items-center gap-2 cursor-pointer py-1 hover:bg-slate-50 rounded px-1 -mx-1 transition-colors">
    <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${checked ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'
      }`}>
      {checked && <Check className="w-3 h-3 text-white" />}
    </div>
    <input
      type="checkbox"
      className="hidden"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className={`text-sm ${checked ? 'text-slate-900 font-medium' : 'text-slate-600'} ${emphasized ? 'font-bold' : ''}`}>
      {label}
    </span>
    {count !== undefined && (
      <span className="ml-auto text-xs text-slate-400">{count}</span>
    )}
  </label>
);

interface JobFilterSidebarProps {
  filters: {
    category: string[];        // 岗位分类
    experienceLevel: string[]; // 岗位级别
    industry: string[];        // 行业类型（企业）
    regionType: string[];      // 区域限制
    sourceType: string[];      // 岗位来源
    jobType: string[];         // 工作类型
    salary: string[];
    location: string[];
    isTrusted: boolean;
    isNew: boolean;
  };
  onFilterChange: (newFilters: any) => void;
  // Optional dynamic options
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
  const [openSections, setOpenSections] = React.useState<Record<string, boolean>>({
    category: true,
    experienceLevel: true,
    industry: true,
    regionType: true,
    sourceType: true,
    jobType: false,
    salary: false,
    location: false
  });

  const navigate = useNavigate();

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleArrayFilterChange = (filterKey: string, value: string, checked: boolean) => {
    const currentArray = filters[filterKey as keyof typeof filters] as string[];
    const newArray = checked
      ? [...currentArray, value]
      : currentArray.filter(v => v !== value);
    onFilterChange({ ...filters, [filterKey]: newArray });
  };

  // 岗位分类选项
  const CATEGORIES = categoryOptions && categoryOptions.length > 0
    ? categoryOptions
    : [
      { label: '全栈开发', value: '全栈开发' },
      { label: '前端开发', value: '前端开发' },
      { label: '后端开发', value: '后端开发' },
      { label: '产品经理', value: '产品经理' },
      { label: 'UI/UX设计', value: 'UI/UX设计' },
      { label: '数据分析', value: '数据分析' },
      { label: '运营', value: '运营' },
      { label: '市场营销', value: '市场营销' }
    ];

  // 岗位级别选项
  const EXPERIENCE_LEVELS = [
    { label: '实习生 (Intern)', value: 'Entry' },
    { label: '初级 (Junior)', value: 'Mid' },
    { label: '中级 (Mid-level)', value: 'Senior' },
    { label: '高级 (Senior)', value: 'Lead' },
    { label: '专家 (Expert)', value: 'Executive' }
  ];

  // 行业类型选项（从企业获取）
  const INDUSTRIES = industryOptions && industryOptions.length > 0
    ? industryOptions
    : [
      { label: '互联网/软件', value: '互联网/软件' },
      { label: '人工智能', value: '人工智能' },
      { label: '金融/Fintech', value: '金融/Fintech' },
      { label: '教育', value: '教育' },
      { label: 'Web3/区块链', value: 'Web3/区块链' }
    ];

  // 区域限制选项（两级）
  const REGION_TYPES = [
    { label: '🇨🇳 中国可申', value: 'domestic', emphasized: true },
    { label: '🌏 海外可申', value: 'overseas', emphasized: false }
  ];

  // 岗位来源选项
  const SOURCE_TYPES = [
    { label: '俱乐部内推', value: 'club-referral' },
    { label: '人工精选', value: 'curated' },
    { label: '第三方', value: 'third-party' }
  ];

  // 工作类型选项
  const JOB_TYPES = jobTypeOptions && jobTypeOptions.length > 0
    ? jobTypeOptions
    : [
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

  const LOCATIONS = locationOptions && locationOptions.length > 0
    ? locationOptions
    : [
      { label: '远程 (Remote)', value: 'Remote' },
      { label: '全球 (Worldwide)', value: 'Worldwide' },
      { label: '中国 (China)', value: 'China' },
      { label: '美国 (USA)', value: 'USA' }
    ];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span>筛选职位</span>
          <span className="text-slate-400 text-sm font-normal">(Filter Jobs)</span>
        </h2>

        {/* 区域限制 */}
        <FilterSection
          title="区域限制 (Region)"
          isOpen={openSections.regionType}
          onToggle={() => toggleSection('regionType')}
        >
          {REGION_TYPES.map(region => (
            <CheckboxItem
              key={region.value}
              label={region.label}
              checked={filters.regionType.includes(region.value)}
              onChange={(c) => handleArrayFilterChange('regionType', region.value, c)}
              emphasized={region.emphasized}
            />
          ))}
        </FilterSection>

        {/* 岗位来源 */}
        <FilterSection
          title="岗位来源 (Source)"
          isOpen={openSections.sourceType}
          onToggle={() => toggleSection('sourceType')}
        >
          {SOURCE_TYPES.map(source => (
            <CheckboxItem
              key={source.value}
              label={source.label}
              checked={filters.sourceType.includes(source.value)}
              onChange={(c) => handleArrayFilterChange('sourceType', source.value, c)}
            />
          ))}
        </FilterSection>

        {/* 岗位分类 */}
        <FilterSection
          title="岗位分类 (Job Category)"
          isOpen={openSections.category}
          onToggle={() => toggleSection('category')}
        >
          <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {CATEGORIES.map(cat => (
              <CheckboxItem
                key={cat.value}
                label={cat.label}
                checked={filters.category.includes(cat.value)}
                onChange={(c) => handleArrayFilterChange('category', cat.value, c)}
              />
            ))}
          </div>
        </FilterSection>

        {/* 岗位级别 */}
        <FilterSection
          title="岗位级别 (Experience Level)"
          isOpen={openSections.experienceLevel}
          onToggle={() => toggleSection('experienceLevel')}
        >
          {EXPERIENCE_LEVELS.map(level => (
            <CheckboxItem
              key={level.value}
              label={level.label}
              checked={filters.experienceLevel.includes(level.value)}
              onChange={(c) => handleArrayFilterChange('experienceLevel', level.value, c)}
            />
          ))}
        </FilterSection>

        {/* 行业类型 */}
        <FilterSection
          title="行业类型 (Industry)"
          isOpen={openSections.industry}
          onToggle={() => toggleSection('industry')}
        >
          <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {INDUSTRIES.map(ind => (
              <CheckboxItem
                key={ind.value}
                label={ind.label}
                checked={filters.industry.includes(ind.value)}
                onChange={(c) => handleArrayFilterChange('industry', ind.value, c)}
              />
            ))}
          </div>
        </FilterSection>

        {/* 工作类型 */}
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
              onChange={(c) => handleArrayFilterChange('jobType', type.value, c)}
            />
          ))}
        </FilterSection>

        {/* 薪资范围 */}
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
              onChange={(c) => handleArrayFilterChange('salary', range.value, c)}
            />
          ))}
        </FilterSection>

        {/* 地点/时区 */}
        <FilterSection
          title="地点/时区 (Location)"
          isOpen={openSections.location}
          onToggle={() => toggleSection('location')}
        >
          <div className="max-h-60 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
            {LOCATIONS.map(loc => (
              <CheckboxItem
                key={loc.value}
                label={loc.label}
                checked={filters.location.includes(loc.value)}
                onChange={(c) => handleArrayFilterChange('location', loc.value, c)}
              />
            ))}
          </div>
        </FilterSection>

        <button
          onClick={() => onFilterChange({
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
          })}
          className="w-full mt-6 bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors shadow-md shadow-slate-200"
        >
          清除筛选 (Clear Filters)
        </button>
      </div>

      {/* AI Resume Optimization Promo Card */}
      <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-5 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-indigo-200 rounded-full opacity-20 blur-xl"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500" />
            <h3 className="font-bold text-slate-900 text-sm">简历还在被动等待?</h3>
          </div>
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            试试我们的 AI 简历优化建议 (Try our AI optimization suggestions).
          </p>
          <button
            onClick={() => navigate('/profile?tab=resume')}
            className="w-full py-2 bg-white border border-indigo-200 text-indigo-600 font-medium text-sm rounded-lg hover:bg-indigo-50 transition-colors"
          >
            优化简历 (Optimize Resume)
          </button>
        </div>
      </div>
    </div>
  );
}
