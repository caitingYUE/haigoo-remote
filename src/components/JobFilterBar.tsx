import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Briefcase, Check, ChevronDown, Crown, MapPin, SlidersHorizontal, X } from 'lucide-react';

interface FilterDropdownProps {
  label: string;
  activeLabel?: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  children: React.ReactNode;
  isActive: boolean;
  colorTheme?: 'indigo' | 'emerald' | 'slate';
  icon?: React.ReactNode;
  onApply?: () => void;
  onClear?: () => void;
  panelWidthClassName?: string;
}

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  tone?: 'indigo' | 'emerald' | 'slate';
}

type ListMode = 'jobs' | 'favorites' | 'applications';

interface JobFilterBarProps {
  filters: {
    category: string[];
    experienceLevel: string[];
    industry: string[];
    regionType: string[];
    sourceType: string[];
    type?: string[];
    jobType: string[];
    salary: string[];
    location: string[];
    timezone: string[];
    isTrusted: boolean;
    isNew: boolean;
    memberOnly?: boolean;
    aiRecommended?: boolean;
  };
  onFilterChange: (newFilters: any) => void;
  categoryOptions: { label: string; value: string; count?: number }[];
  industryOptions: { label: string; value: string; count?: number }[];
  jobTypeOptions: { label: string; value: string; count?: number }[];
  experienceLevelOptions?: { label: string; value: string; count?: number }[];
  locationOptions: { label: string; value: string; count?: number }[];
  timezoneOptions: { label: string; value: string; count?: number }[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'recent' | 'relevance';
  onSortChange: () => void;
  onOpenTracking: () => void;
  listMode: ListMode;
  favoriteCount?: number;
  applicationCount?: number;
  onListModeChange: (mode: ListMode) => void;
  isAuthenticated?: boolean;
  isMember?: boolean;
}

const EXPERIENCE_OPTIONS = [
  { label: '初级', value: 'Entry' },
  { label: '中级', value: 'Mid' },
  { label: '高级', value: 'Senior' },
  { label: '专家/负责人', value: 'Lead' },
  { label: '管理层', value: 'Executive' }
];

const ROLE_GROUPS = [
  {
    title: '技术研发类',
    keywords: ['前端', '后端', '全栈', '移动', '算法', '数据开发', '测试', 'QA', '运维', 'SRE', '安全', '架构', '技术', '工程', '开发', 'CTO', '内核', '硬件', '数据库', '平台', '服务器']
  },
  {
    title: '产品 / 项目类',
    keywords: ['产品经理', '产品设计', '营销设计', '视觉设计', '平面设计', '创意设计', 'UI', 'UX', '项目', '增长', '用户研究']
  },
  {
    title: '市场 / 销售类',
    keywords: ['市场', '品牌', '销售', '商务', '客户经理', '营销']
  },
  {
    title: '运营 / 客服类',
    keywords: ['运营', '产品运营', '活动运营', '客户服务', '内容']
  },
  {
    title: '职能 / 服务类',
    keywords: ['人力', '招聘', '财务', '会计', '法务', '行政', '管理']
  },
  {
    title: '数据 / 教育 / 其他',
    keywords: ['数据分析', '商业分析', '数据科学', '教育', '培训', '投资', '游戏', '其他']
  }
];

const LOCATION_GROUPS = [
  {
    label: '中国远程',
    value: 'china',
    filterValue: 'China',
    keywords: ['china', '中国', '香港', 'hong kong', '台湾', 'taiwan', '上海', '北京', '深圳', '广州', '杭州', '成都', '国内']
  },
  {
    label: '亚太远程',
    value: 'apac',
    filterValue: 'APAC',
    keywords: ['apac', 'asia', 'pacific', '亚太', '亚洲', '新加坡', 'singapore', '日本', 'japan', '韩国', 'korea', '澳洲', 'australia']
  },
  {
    label: '全球远程',
    value: 'global',
    filterValue: 'Global',
    keywords: ['global', 'worldwide', 'remote', 'anywhere', '全球', '不限', 'world']
  }
] as const;

type LocationGroupValue = typeof LOCATION_GROUPS[number]['value'];

const THEME_STYLES = {
  indigo: {
    active: 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm',
    icon: 'text-indigo-500',
    checkbox: 'bg-indigo-600 border-indigo-600',
    textChecked: 'text-indigo-700'
  },
  emerald: {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm',
    icon: 'text-emerald-500',
    checkbox: 'bg-emerald-600 border-emerald-600',
    textChecked: 'text-emerald-700'
  },
  slate: {
    active: 'bg-slate-100 text-slate-900 border-slate-200 shadow-sm',
    icon: 'text-slate-500',
    checkbox: 'bg-slate-700 border-slate-700',
    textChecked: 'text-slate-900'
  }
};

const FilterDropdown: React.FC<FilterDropdownProps> = ({
  label,
  activeLabel,
  isOpen,
  onToggle,
  onClose,
  children,
  isActive,
  colorTheme = 'slate',
  icon,
  onApply,
  onClear,
  panelWidthClassName = 'md:w-[430px]'
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        if (onApply) onApply();
        else onClose();
      }
    };

    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, onApply]);

  const theme = THEME_STYLES[colorTheme];
  const buttonClass = `inline-flex h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
    isActive || isOpen
      ? theme.active
      : 'border-slate-200/90 bg-white text-slate-600 shadow-[0_12px_26px_-20px_rgba(15,23,42,0.35)] hover:border-slate-300 hover:text-slate-900'
  }`;

  return (
    <div className="relative z-[120] inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => {
          if (isOpen && onApply) onApply();
          else onToggle();
        }}
        className={buttonClass}
      >
        {icon ? <span className={isActive || isOpen ? theme.icon : 'text-slate-400'}>{icon}</span> : null}
        <span className="max-w-[86px] truncate">{isActive && activeLabel ? activeLabel : label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''} ${isActive || isOpen ? theme.icon : 'text-slate-400'}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[9990] bg-black/20 backdrop-blur-sm md:bg-transparent md:backdrop-blur-none"
            onClick={(event) => {
              event.stopPropagation();
              if (onApply) onApply();
              else onClose();
            }}
          />
          <div
            className={`fixed bottom-0 left-0 right-0 z-[9999] w-full overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-200 md:absolute md:bottom-auto md:left-0 md:right-auto md:top-full md:mt-2 ${panelWidthClassName} md:rounded-2xl md:border md:border-slate-100 md:shadow-xl md:animate-in md:fade-in md:zoom-in-95`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[60vh] overflow-y-auto p-2 pb-8 custom-scrollbar md:max-h-[460px] md:pb-2">
              <div className="flex justify-center pb-2 pt-1 md:hidden">
                <div className="h-1 w-12 rounded-full bg-slate-200" />
              </div>
              {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                  return React.cloneElement(child as React.ReactElement<any>, { colorTheme });
                }
                return child;
              })}
            </div>

            {(onApply || onClear) && (
              <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 p-3">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onClear?.();
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-200/50 hover:text-slate-800"
                >
                  清空
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onApply?.();
                  }}
                  className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
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

const FilterSectionHeader: React.FC<{ title: string; description?: string }> = ({ title }) => (
  <div className="px-2 pb-1 pt-2 first:pt-0">
    <div className="text-[12px] font-bold text-slate-900">{title}</div>
  </div>
);

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onClick, count, tone = 'slate' }) => {
  const activeClass = tone === 'emerald'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : tone === 'indigo'
      ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
      : 'border-slate-300 bg-slate-100 text-slate-900';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-8 max-w-full items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
        active ? activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
      title={label}
    >
      <span className="truncate">{label}</span>
      {typeof count === 'number' ? <span className="text-[10px] opacity-60">{count}</span> : null}
    </button>
  );
};

const normalizeText = (value: string) => value.toLowerCase().replace(/\s+/g, '');

const optionMatches = (option: { label: string; value: string }, keywords: string[]) => {
  const text = normalizeText(`${option.label} ${option.value}`);
  return keywords.some(keyword => text.includes(normalizeText(keyword)));
};

export default function JobFilterBar({
  filters,
  onFilterChange,
  categoryOptions,
  industryOptions,
  jobTypeOptions,
  experienceLevelOptions = EXPERIENCE_OPTIONS,
  locationOptions,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
  listMode,
  favoriteCount = 0,
  applicationCount = 0,
  onListModeChange,
  isAuthenticated = false,
  isMember = false
}: JobFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tempFilters, setTempFilters] = useState(filters);
  const [activeRoleGroup, setActiveRoleGroup] = useState(0);
  const [activeLocationGroup, setActiveLocationGroup] = useState<LocationGroupValue>('china');

  useEffect(() => {
    if (openDropdown === null) setTempFilters(filters);
  }, [filters, openDropdown]);
  const previousOpenDropdownRef = useRef<string | null>(null);

  const groupedCategories = useMemo(() => {
    const used = new Set<string>();
    const groups = ROLE_GROUPS.map(group => {
      const options = categoryOptions.filter(option => optionMatches(option, group.keywords));
      options.forEach(option => used.add(option.value));
      return { ...group, options };
    }).filter(group => group.options.length > 0);

    const remaining = categoryOptions.filter(option => !used.has(option.value));
    if (remaining.length > 0) groups.push({ title: '更多角色', keywords: [], options: remaining });
    return groups;
  }, [categoryOptions]);

  const visibleLocationGroups = useMemo(() => {
    if (!locationOptions.length) return LOCATION_GROUPS;
    const optionText = locationOptions.map(option => `${option.value} ${option.label}`.toLowerCase());
    return LOCATION_GROUPS.filter(group => {
      if (filters.location?.includes(group.filterValue)) return true;
      const terms = [group.filterValue, group.label, ...group.keywords].map(item => item.toLowerCase());
      return optionText.some(text => terms.some(term => text.includes(term)));
    });
  }, [filters.location, locationOptions]);

  useEffect(() => {
    if (openDropdown !== 'category') return;
    if (previousOpenDropdownRef.current === 'category') return;
    const selectedCategories = filters.category || [];
    if (selectedCategories.length === 0) return;
    const targetIndex = groupedCategories.findIndex(group =>
      group.options.some(option => selectedCategories.includes(option.value))
    );
    if (targetIndex >= 0 && targetIndex !== activeRoleGroup) {
      setActiveRoleGroup(targetIndex);
    }
  }, [openDropdown, groupedCategories, filters.category]);

  useEffect(() => {
    previousOpenDropdownRef.current = openDropdown;
  }, [openDropdown]);

  const applyFilters = (keys: Array<keyof typeof filters>) => {
    const updates: any = {};
    keys.forEach(key => {
      const currentVal = filters[key];
      const newVal = tempFilters[key];
      if (JSON.stringify(currentVal) !== JSON.stringify(newVal)) updates[key] = newVal;
    });
    if (Object.keys(updates).length > 0) onFilterChange(updates);
    setOpenDropdown(null);
  };

  const clearTempFilters = (keys: Array<keyof typeof filters>) => {
    setTempFilters(prev => {
      const next: any = { ...prev };
      keys.forEach(key => {
        next[key] = typeof prev[key] === 'boolean' ? false : [];
      });
      return next;
    });
  };

  const handleCheckboxChange = (section: keyof typeof filters, value: string, checked: boolean) => {
    setTempFilters(prev => {
      const current = (prev[section] as string[]) || [];
      let updated: string[];

      if (checked) {
        updated = section === 'regionType' ? [value] : Array.from(new Set([...current, value]));
      } else {
        updated = current.filter(item => item !== value);
      }

      return { ...prev, [section]: updated };
    });
  };

  const handleLocationGroupChange = (value: LocationGroupValue, checked: boolean) => {
    const group = LOCATION_GROUPS.find(option => option.value === value);
    if (!group) return;
    setTempFilters(prev => {
      return {
        ...prev,
        regionType: [],
        location: checked ? [group.filterValue] : []
      };
    });
  };

  const toggleLocationOption = (value: string) => {
    setTempFilters(prev => {
      const current = prev.location || [];
      const nextLocation = current.includes(value) ? current.filter(item => item !== value) : [value];
      return {
        ...prev,
        regionType: [],
        location: nextLocation
      };
    });
  };

  const setRoleGroup = (index: number) => {
    setActiveRoleGroup(index);
  };

  const selectRoleGroup = (index: number) => {
    const group = groupedCategories[index];
    if (!group) return;
    const groupValues = group.options.map(option => option.value);
    setTempFilters(prev => {
      const current = prev.category || [];
      const allSelected = groupValues.length > 0 && groupValues.every(value => current.includes(value));
      return {
        ...prev,
        category: allSelected
          ? current.filter(value => !groupValues.includes(value))
          : Array.from(new Set([...current, ...groupValues]))
      };
    });
  };

  const toggleRoleOption = (value: string) => {
    setTempFilters(prev => {
      const current = prev.category || [];
      return {
        ...prev,
        category: current.includes(value) ? current.filter(item => item !== value) : [...current, value]
      };
    });
  };

  const getActiveLabel = (section: keyof typeof filters, options: { label: string; value: string }[], defaultLabel: string) => {
    const current = filters[section] as string[];
    if (!current || current.length === 0) return defaultLabel;
    if (current.length === 1) return options.find(option => option.value === current[0])?.label || current[0];
    return `${defaultLabel} (${current.length})`;
  };

  const getLocationActiveLabel = () => {
    const selectedGroup = LOCATION_GROUPS.find(option => filters.location?.includes(option.filterValue));
    if (selectedGroup) return selectedGroup.label;
    return getActiveLabel('location', locationOptions, '地点');
  };

  const moreFilterCount =
    (filters.jobType?.length || 0) +
    (filters.experienceLevel?.length || 0) +
    (filters.industry?.length || 0);

  const hasActiveFilters =
    (filters.category?.length || 0) > 0 ||
    (filters.experienceLevel?.length || 0) > 0 ||
    (filters.industry?.length || 0) > 0 ||
    (filters.regionType?.length || 0) > 0 ||
    (filters.jobType?.length || 0) > 0 ||
    (filters.location?.length || 0) > 0 ||
    Boolean(filters.memberOnly) ||
    filters.isTrusted ||
    filters.isNew;

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
      isNew: false,
      memberOnly: false
    });
    onSearchChange('');
  };

  const navClass = (active: boolean) => `relative inline-flex h-8 items-center gap-1.5 px-1 text-[13px] font-bold transition-colors ${
    active ? 'text-[#2b3448]' : 'text-slate-500 hover:text-slate-900'
  }`;

  return (
    <div className={`relative z-30 mb-2 overflow-visible rounded-[24px] border p-3.5 shadow-[0_22px_54px_-46px_rgba(64,78,102,0.28)] backdrop-blur-sm ${
      isMember
        ? 'border-[#e6d8bd] bg-white/88'
        : 'border-[#dfe8ef] bg-white/88'
    }`}>
      {isMember ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[24px]">
          <img
            src="/pic_lists/Home_pics/background04.webp"
            alt=""
            className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-[74%_44%] opacity-[0.34] saturate-[0.86]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.98)_0%,rgba(255,253,248,0.9)_58%,rgba(255,253,248,0.58)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-[linear-gradient(180deg,rgba(255,253,248,0)_0%,rgba(255,253,248,0.88)_100%)]" />
        </div>
      ) : (
        <img src="/pic_lists/Home_pics/grass_icon2-transparent.webp" alt="" className="pointer-events-none absolute -bottom-5 right-6 h-20 w-20 opacity-20" />
      )}
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:gap-5">
          <div className="min-w-0 xl:shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="haigoo-hand-bold font-haigoo-hand text-[30px] leading-none tracking-normal text-slate-950">远程工作</h2>
              {isMember ? (
                <span className="pointer-events-none inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full border border-white bg-[#6f63ff] px-1.5 text-white shadow-[0_10px_18px_-12px_rgba(79,70,229,0.8)]">
                  <Crown className="h-2.5 w-2.5 fill-current" />
                  <span className="text-[8px] font-black leading-none tracking-wide">VIP</span>
                </span>
              ) : (
                <img src="/pic_lists/Jobs_pics/sun-transparent.webp" alt="" className="h-7 w-7 opacity-80" />
              )}
              <ChevronDown className="-rotate-90 h-4 w-4 text-slate-300" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-5 xl:pt-0.5">
            <button
              type="button"
              className={navClass(listMode === 'jobs')}
              onClick={() => {
                if (listMode === 'jobs') {
                  onSortChange();
                  return;
                }
                onListModeChange('jobs');
              }}
              title={sortBy === 'recent' ? '当前：最新排序，点击切换推荐' : '当前：推荐排序，点击切换最新'}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === 'recent' ? '最新' : '推荐'}
              {listMode === 'jobs' ? <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#8f83ff]" /> : null}
            </button>
            <button type="button" className={navClass(listMode === 'favorites')} onClick={() => onListModeChange('favorites')}>
              收藏
              <span className="rounded-full bg-[#2b3448] px-1.5 py-0.5 text-[10px] text-white">{favoriteCount}</span>
              {listMode === 'favorites' ? <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#8f83ff]" /> : null}
            </button>
            <button type="button" className={navClass(listMode === 'applications')} onClick={() => onListModeChange('applications')}>
              申请中
              <span className="rounded-full bg-[#2b3448] px-1.5 py-0.5 text-[10px] text-white">{applicationCount}</span>
              {listMode === 'applications' ? <span className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full bg-[#8f83ff]" /> : null}
            </button>
          </div>

          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="ml-auto inline-flex h-9 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              清除搜索
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        <div className="-mx-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          <FilterDropdown
            label="角色"
            activeLabel={getActiveLabel('category', categoryOptions, '角色')}
            isActive={(filters.category?.length || 0) > 0}
            isOpen={openDropdown === 'category'}
            onToggle={() => setOpenDropdown('category')}
            onClose={() => applyFilters(['category'])}
            onApply={() => applyFilters(['category'])}
            onClear={() => clearTempFilters(['category'])}
            icon={<Briefcase className="h-3.5 w-3.5" />}
            colorTheme="indigo"
          >
            <div className="grid gap-3 md:grid-cols-[128px_minmax(0,1fr)]">
              <div className="flex flex-col gap-1 rounded-2xl bg-slate-50 p-1.5">
                {groupedCategories.map((group, index) => (
                  <button
                    key={group.title}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setRoleGroup(index);
                    }}
                    className={`rounded-xl px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                      activeRoleGroup === index ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
                    }`}
                  >
                    {group.title.replace('类', '')}
                  </button>
                ))}
              </div>
              <div className="min-w-0">
                <FilterSectionHeader title={groupedCategories[activeRoleGroup]?.title || '角色'} />
                <div className="flex flex-wrap gap-2 px-2 pb-2">
                  {groupedCategories[activeRoleGroup]?.options?.length ? (
                    <FilterChip
                      label={`全部${groupedCategories[activeRoleGroup].title.replace('类', '')}`}
                      active={groupedCategories[activeRoleGroup].options.every(option => tempFilters.category?.includes(option.value))}
                      tone="indigo"
                      onClick={() => selectRoleGroup(activeRoleGroup)}
                    />
                  ) : null}
                  {(groupedCategories[activeRoleGroup]?.options || []).map(option => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      count={option.count}
                      active={tempFilters.category?.includes(option.value) || false}
                      tone="indigo"
                      onClick={() => toggleRoleOption(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </FilterDropdown>

          <FilterDropdown
            label="地点"
            activeLabel={getLocationActiveLabel()}
            isActive={(filters.regionType?.length || 0) > 0 || (filters.location?.length || 0) > 0}
            isOpen={openDropdown === 'location'}
            onToggle={() => setOpenDropdown('location')}
            onClose={() => applyFilters(['regionType', 'location'])}
            onApply={() => applyFilters(['regionType', 'location'])}
            onClear={() => clearTempFilters(['regionType', 'location'])}
            icon={<MapPin className="h-3.5 w-3.5" />}
            colorTheme="emerald"
            panelWidthClassName="md:w-[292px]"
          >
            <div className="space-y-2 px-1 py-1">
              <div className="grid gap-2">
                {visibleLocationGroups.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveLocationGroup(option.value);
                      handleLocationGroupChange(option.value, !tempFilters.location?.includes(option.filterValue));
                    }}
                    className={`flex items-center justify-between rounded-2xl border px-3 py-3 text-left text-xs font-bold transition-colors ${
                      tempFilters.location?.includes(option.filterValue)
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm'
                        : 'border-slate-100 bg-white text-slate-600 hover:border-emerald-100 hover:bg-emerald-50/40 hover:text-slate-900'
                    }`}
                  >
                    <span>{option.label}</span>
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      tempFilters.location?.includes(option.filterValue) ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
                    }`}>
                      {tempFilters.location?.includes(option.filterValue) ? <Check className="h-3 w-3 text-white" /> : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </FilterDropdown>

          <FilterDropdown
            label="更多筛选"
            activeLabel={moreFilterCount > 0 ? `更多筛选 (${moreFilterCount})` : '更多筛选'}
            isActive={moreFilterCount > 0}
            isOpen={openDropdown === 'more'}
            onToggle={() => setOpenDropdown('more')}
            onClose={() => applyFilters(['jobType', 'experienceLevel', 'industry'])}
            onApply={() => applyFilters(['jobType', 'experienceLevel', 'industry'])}
            onClear={() => clearTempFilters(['jobType', 'experienceLevel', 'industry'])}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            colorTheme="slate"
            panelWidthClassName="md:w-[720px]"
          >
            <FilterSectionHeader title="工作类型" />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {jobTypeOptions.map(option => (
                <FilterChip key={option.value} label={option.label} active={tempFilters.jobType?.includes(option.value) || false} onClick={() => handleCheckboxChange('jobType', option.value, !tempFilters.jobType?.includes(option.value))} />
              ))}
            </div>

            <FilterSectionHeader title="级别" />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {experienceLevelOptions.map(option => (
                <FilterChip key={option.value} label={option.label} active={tempFilters.experienceLevel?.includes(option.value) || false} onClick={() => handleCheckboxChange('experienceLevel', option.value, !tempFilters.experienceLevel?.includes(option.value))} />
              ))}
            </div>

            <FilterSectionHeader title="行业" />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {industryOptions.map(option => (
                <FilterChip key={option.value} label={option.label} active={tempFilters.industry?.includes(option.value) || false} onClick={() => handleCheckboxChange('industry', option.value, !tempFilters.industry?.includes(option.value))} />
              ))}
            </div>
          </FilterDropdown>

          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => onFilterChange({ memberOnly: !filters.memberOnly })}
              className={`inline-flex h-9 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-all whitespace-nowrap ${
                filters.memberOnly
                  ? 'border-[#d8d2ff] bg-[#f1efff] text-[#6f63ff] shadow-sm'
                  : 'border-slate-200/90 bg-white text-slate-600 shadow-[0_12px_26px_-20px_rgba(15,23,42,0.35)] hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${filters.memberOnly ? 'border-[#6f63ff] bg-[#6f63ff]' : 'border-slate-300 bg-white'}`}>
                {filters.memberOnly ? <Check className="h-3 w-3 text-white" /> : null}
              </span>
              仅会员
            </button>
          ) : null}

          {hasActiveFilters || searchTerm ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              清空筛选
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
