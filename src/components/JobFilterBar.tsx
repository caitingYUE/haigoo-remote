import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Briefcase, Check, ChevronDown, MapPin, SlidersHorizontal, X } from 'lucide-react';
import { buildRoleOptionGroups } from '../constants/job-role-groups';
import { useLanguage } from '../contexts/LanguageContext';
import { JOB_LOCATION_TAXONOMY } from '../../lib/shared/job-location-taxonomy.js';
import { COMPLIANCE_FEATURES } from '../config/compliance';

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
  onRestrictedAction?: (actionLabel: string) => void;
  isAuthenticated?: boolean;
  isMember?: boolean;
  verificationRequired?: boolean;
  availableLocationFilterValues?: string[];
}

const EXPERIENCE_OPTIONS = [
  { label: '初级', value: 'Entry' },
  { label: '中级', value: 'Mid' },
  { label: '高级', value: 'Senior' },
  { label: '专家/负责人', value: 'Lead' },
  { label: '管理层', value: 'Executive' }
];

type LocationGroupValue = typeof JOB_LOCATION_TAXONOMY[number]['key'];
const ALL_LOCATION_FILTER_VALUES = JOB_LOCATION_TAXONOMY.map(option => option.value);

const THEME_STYLES = {
  indigo: {
    active: 'bg-[var(--hg-accent-50)] text-[var(--hg-accent-700)] border-[var(--hg-accent-300)]',
    icon: 'text-[var(--hg-accent-600)]',
    checkbox: 'bg-[var(--hg-accent-600)] border-[var(--hg-accent-600)]',
    textChecked: 'text-[var(--hg-accent-700)]'
  },
  emerald: {
    active: 'bg-[var(--hg-accent-50)] text-[var(--hg-accent-700)] border-[var(--hg-accent-300)]',
    icon: 'text-[var(--hg-accent-600)]',
    checkbox: 'bg-[var(--hg-accent-600)] border-[var(--hg-accent-600)]',
    textChecked: 'text-[var(--hg-accent-700)]'
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
  const { text } = useLanguage();
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
  const buttonClass = `inline-flex h-11 items-center gap-1 border px-3 text-xs font-semibold transition-[border-color,background-color,color] whitespace-nowrap md:h-9 md:px-2.5 ${
    isActive || isOpen
      ? theme.active
      : 'border-slate-200/90 bg-white text-slate-600 shadow-none hover:border-slate-400 hover:text-slate-900'
  }`;

  return (
    <div className="relative z-[120] inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
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
            role="dialog"
            aria-label={`${label}筛选`}
            className={`fixed bottom-0 left-0 right-0 z-[9999] w-full overflow-hidden border-t border-slate-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom duration-200 md:absolute md:bottom-auto md:left-0 md:right-auto md:top-full md:mt-2 ${panelWidthClassName} md:border md:border-slate-200 md:shadow-[0_18px_42px_-28px_rgba(15,23,42,0.24)] md:animate-in md:fade-in md:zoom-in-95`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="max-h-[60vh] overflow-y-auto p-2 pb-8 custom-scrollbar md:max-h-[460px] md:pb-2">
              <div className="flex justify-center pb-2 pt-1 md:hidden">
                <div className="h-1 w-12 rounded-full bg-slate-200" />
              </div>
              {children}
            </div>

            {(onApply || onClear) && (
              <div className="flex items-center justify-between gap-3 border-t border-[#deddd7] bg-[#f7f6f1] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onClear?.();
                  }}
                  className="inline-flex h-10 items-center px-3 text-xs font-semibold text-[#64748b] transition-colors hover:bg-[var(--hg-accent-50)] hover:text-[var(--hg-accent-700)]"
                >
                  {text('清空', 'Clear')}
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    onApply?.();
                  }}
                  className="h-10 flex-1 bg-[#101829] px-3 text-xs font-semibold text-white transition-colors hover:bg-[var(--hg-accent-600)]"
                >
                  {text('应用筛选', 'Apply filters')}
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
  void tone;
  const activeClass = 'border-[var(--hg-accent-300)] bg-[var(--hg-accent-50)] text-[var(--hg-accent-700)]';

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
      className={`inline-flex h-11 max-w-full items-center gap-1 border px-3 text-xs font-semibold transition-colors md:h-8 md:px-2.5 ${
        active ? activeClass : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
      }`}
      title={label}
    >
      <span className="truncate">{label}</span>
      {typeof count === 'number' ? <span className="text-[10px] opacity-60">{count}</span> : null}
    </button>
  );
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
  onRestrictedAction,
  isAuthenticated = false,
  isMember = false,
  verificationRequired = false,
  availableLocationFilterValues = []
}: JobFilterBarProps) {
  const { isEnglish, text } = useLanguage();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [tempFilters, setTempFilters] = useState(filters);
  const [activeRoleGroup, setActiveRoleGroup] = useState(0);

  useEffect(() => {
    if (openDropdown === null) setTempFilters(filters);
  }, [filters, openDropdown]);
  const previousOpenDropdownRef = useRef<string | null>(null);

  const toggleFilterDropdown = (name: string) => {
    setOpenDropdown(current => current === name ? null : name);
  };

  const groupedCategories = useMemo(() => buildRoleOptionGroups(categoryOptions), [categoryOptions]);
  const showRoleCounts = Boolean(isAuthenticated);

  const availableLocationValueSet = useMemo(
    () => new Set(availableLocationFilterValues),
    [availableLocationFilterValues]
  );
  const visibleLocationGroups = useMemo(() => (
    JOB_LOCATION_TAXONOMY
      .filter(group => availableLocationValueSet.has(group.value))
  ), [availableLocationValueSet]);
  const visibleParentFilterValues = useMemo(
    () => visibleLocationGroups.map(group => group.value),
    [visibleLocationGroups]
  );
  const visibleLocationFilterValueSet = useMemo(
    () => new Set(visibleParentFilterValues),
    [visibleParentFilterValues]
  );

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

  const getEffectiveLocationSelection = (locations?: string[]) => {
    const selected = (locations || []).filter(value => (
      ALL_LOCATION_FILTER_VALUES.includes(value) && visibleLocationFilterValueSet.has(value)
    ));
    return selected.length > 0 ? selected : visibleParentFilterValues;
  };

  const collapseLocationSelection = (locations: string[]) => {
    const selected = Array.from(new Set(locations.filter(value => (
      ALL_LOCATION_FILTER_VALUES.includes(value) && visibleLocationFilterValueSet.has(value)
    ))));
    const isAllVisibleParents = selected.length === visibleParentFilterValues.length &&
      visibleParentFilterValues.every(value => selected.includes(value));
    return selected.length === 0 || isAllVisibleParents ? [] : selected;
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
    const group = visibleLocationGroups.find(option => option.key === value);
    if (!group) return;
    setTempFilters(prev => {
      const current = getEffectiveLocationSelection(prev.location);
      const withoutGroup = current.filter(item => item !== group.value);
      const nextLocation = checked
        ? Array.from(new Set([...withoutGroup, group.value]))
        : withoutGroup;
      return {
        ...prev,
        regionType: [],
        location: collapseLocationSelection(nextLocation)
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
    const current = filters.location || [];
    if (current.length === 1) {
      const selectedOption = JOB_LOCATION_TAXONOMY.find(option => option.value === current[0]);
      if (selectedOption) return isEnglish ? selectedOption.labelEn : selectedOption.label;
    }
    if (current.length > 1) return `${text('地点', 'Location')} (${current.length})`;
    return getActiveLabel('location', locationOptions, text('地点', 'Location'));
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

  const navClass = (active: boolean) => `relative inline-flex h-11 items-center gap-1.5 px-1 text-[13px] font-bold transition-colors md:h-8 ${
    active ? 'text-[#101829]' : 'text-slate-500 hover:text-[var(--hg-accent-700)]'
  }`;

  return (
    <div
      className="hg-job-filter-bar relative z-30 overflow-visible border-y border-[#deddd7] bg-[#fffdf8] px-4 pb-4 pt-5 sm:px-5 sm:pt-6"
    >
      <div className="relative flex flex-col gap-3">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-5">
          <div className="min-w-0">
            <div className="hg-product-kicker">{text('GLOBAL REMOTE WORK', 'GLOBAL REMOTE WORK')}</div>
            <h2 className="mt-2 font-[var(--font-display)] text-[30px] font-semibold leading-none tracking-[-0.035em] text-[#101829]" aria-label={text('远程工作', 'Remote jobs')}>
              {text('远程工作', 'Remote jobs')}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-5 border-b border-[#deddd7] xl:border-b-0 xl:pb-1">
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
              title={sortBy === 'recent' ? text('当前：最新排序，点击切换默认', 'Sorted by newest; click for default') : text('当前：默认排序，点击切换最新', 'Sorted by default; click for newest')}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === 'recent' ? text('最新', 'Newest') : text('默认', 'Default')}
              {listMode === 'jobs' ? <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--hg-accent-500)]" /> : null}
            </button>
            <button type="button" className={navClass(listMode === 'favorites')} onClick={() => onListModeChange('favorites')}>
              {text('收藏', 'Saved')}
              <span className="border border-slate-200 bg-white/75 px-1.5 py-0.5 text-[10px] text-slate-600">{favoriteCount}</span>
              {listMode === 'favorites' ? <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--hg-accent-500)]" /> : null}
            </button>
            <button type="button" className={navClass(listMode === 'applications')} onClick={() => onListModeChange('applications')}>
              {text('申请中', 'Applications')}
              <span className="border border-slate-200 bg-white/75 px-1.5 py-0.5 text-[10px] text-slate-600">{applicationCount}</span>
              {listMode === 'applications' ? <span className="absolute -bottom-px left-0 right-0 h-0.5 bg-[var(--hg-accent-500)]" /> : null}
            </button>
          </div>

        </div>

        <div className="-mx-1 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          <FilterDropdown
            label={text('角色', 'Role')}
            activeLabel={getActiveLabel('category', categoryOptions, text('角色', 'Role'))}
            isActive={(filters.category?.length || 0) > 0}
            isOpen={openDropdown === 'category'}
            onToggle={() => toggleFilterDropdown('category')}
            onClose={() => applyFilters(['category'])}
            onApply={isAuthenticated ? () => applyFilters(['category']) : undefined}
            onClear={isAuthenticated ? () => clearTempFilters(['category']) : undefined}
            icon={<Briefcase className="h-3.5 w-3.5" />}
            colorTheme="indigo"
          >
            {isAuthenticated ? (
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
                      className={`px-2.5 py-2 text-left text-xs font-bold transition-colors ${
                        activeRoleGroup === index ? 'bg-white text-[var(--hg-accent-700)]' : 'text-slate-500 hover:bg-white/70 hover:text-slate-900'
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
                        count={showRoleCounts ? option.count : undefined}
                        active={tempFilters.category?.includes(option.value) || false}
                        tone="indigo"
                        onClick={() => toggleRoleOption(option.value)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[160px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#dfe8ef] bg-slate-50/70 px-6 text-center">
                <div className="text-sm font-black text-slate-700">
                  {verificationRequired ? text('验证邮箱后可筛选岗位角色', 'Verify your email to filter roles') : text('登录后可筛选岗位角色', 'Log in to filter roles')}
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setOpenDropdown(null);
                    onRestrictedAction?.('筛选岗位角色');
                  }}
                  className="mt-4 inline-flex h-11 min-w-[132px] items-center justify-center bg-[#101829] px-5 text-sm font-black text-white transition-colors hover:bg-[var(--hg-accent-600)]"
                >
                  {verificationRequired ? text('去验证邮箱', 'Verify email') : text('去登录', 'Log in')}
                </button>
              </div>
            )}
          </FilterDropdown>

          <FilterDropdown
            label={text('地点', 'Location')}
            activeLabel={getLocationActiveLabel()}
            isActive={(filters.regionType?.length || 0) > 0 || (filters.location?.length || 0) > 0}
            isOpen={openDropdown === 'location'}
            onToggle={() => toggleFilterDropdown('location')}
            onClose={() => applyFilters(['regionType', 'location'])}
            onApply={() => applyFilters(['regionType', 'location'])}
            onClear={() => clearTempFilters(['regionType', 'location'])}
            icon={<MapPin className="h-3.5 w-3.5" />}
            colorTheme="emerald"
            panelWidthClassName="md:w-[320px]"
          >
            <div className="grid gap-2 px-1 py-1">
              {visibleLocationGroups.map(option => {
                const selectedLocations = getEffectiveLocationSelection(tempFilters.location);
                const isSelected = selectedLocations.includes(option.value);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      handleLocationGroupChange(option.key, !isSelected);
                    }}
                    className={`flex items-center justify-between border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      isSelected
                        ? 'border-[var(--hg-accent-300)] bg-[var(--hg-accent-50)] text-[var(--hg-accent-700)]'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--hg-accent-300)] hover:bg-[var(--hg-accent-50)] hover:text-slate-900'
                    }`}
                  >
                    <span>{isEnglish ? option.labelEn : option.label}</span>
                    <span className={`flex h-4 w-4 items-center justify-center border ${
                      isSelected ? 'border-[var(--hg-accent-600)] bg-[var(--hg-accent-600)]' : 'border-slate-300 bg-white'
                    }`}>
                      {isSelected ? <Check className="h-3 w-3 text-white" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </FilterDropdown>

          <FilterDropdown
            label={text('更多筛选', 'More filters')}
            activeLabel={moreFilterCount > 0 ? `${text('更多筛选', 'More filters')} (${moreFilterCount})` : text('更多筛选', 'More filters')}
            isActive={moreFilterCount > 0}
            isOpen={openDropdown === 'more'}
            onToggle={() => toggleFilterDropdown('more')}
            onClose={() => applyFilters(['jobType', 'experienceLevel', 'industry'])}
            onApply={() => applyFilters(['jobType', 'experienceLevel', 'industry'])}
            onClear={() => clearTempFilters(['jobType', 'experienceLevel', 'industry'])}
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            colorTheme="slate"
            panelWidthClassName="md:w-[720px]"
          >
            <FilterSectionHeader title={text('工作类型', 'Job type')} />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {jobTypeOptions.map(option => (
                <FilterChip key={option.value} label={isEnglish ? ({ 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', freelance: 'Freelance', internship: 'Internship' }[option.value] || option.value) : option.label} active={tempFilters.jobType?.includes(option.value) || false} onClick={() => handleCheckboxChange('jobType', option.value, !tempFilters.jobType?.includes(option.value))} />
              ))}
            </div>

            <FilterSectionHeader title={text('级别', 'Experience level')} />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {experienceLevelOptions.map(option => (
                <FilterChip key={option.value} label={isEnglish ? ({ Entry: 'Entry', Mid: 'Mid-level', Senior: 'Senior', Lead: 'Lead', Executive: 'Executive' }[option.value] || option.value) : option.label} active={tempFilters.experienceLevel?.includes(option.value) || false} onClick={() => handleCheckboxChange('experienceLevel', option.value, !tempFilters.experienceLevel?.includes(option.value))} />
              ))}
            </div>

            <FilterSectionHeader title={text('行业', 'Industry')} />
            <div className="flex flex-wrap gap-2 px-2 pb-2">
              {industryOptions.map(option => (
                <FilterChip key={option.value} label={option.label} active={tempFilters.industry?.includes(option.value) || false} onClick={() => handleCheckboxChange('industry', option.value, !tempFilters.industry?.includes(option.value))} />
              ))}
            </div>
          </FilterDropdown>

          {COMPLIANCE_FEATURES.memberOnlyJobFilter && isMember ? (
            <button
              type="button"
              onClick={() => onFilterChange({ memberOnly: !filters.memberOnly })}
              className={`inline-flex h-10 items-center gap-1 border px-3 text-xs font-semibold transition-[border-color,background-color,color] whitespace-nowrap md:h-9 md:px-2.5 ${
                filters.memberOnly
                  ? 'border-[var(--hg-accent-300)] bg-[var(--hg-accent-50)] text-[var(--hg-accent-700)]'
                  : 'border-slate-200/90 bg-white text-slate-600 hover:border-[var(--hg-accent-300)] hover:text-[var(--hg-accent-700)]'
              }`}
            >
              <span className={`flex h-4 w-4 items-center justify-center border ${filters.memberOnly ? 'border-[var(--hg-accent-600)] bg-[var(--hg-accent-600)]' : 'border-slate-300 bg-white'}`}>
                {filters.memberOnly ? <Check className="h-3 w-3 text-white" /> : null}
              </span>
              {text('Club 专属岗位', 'Club-only jobs')}
            </button>
          ) : null}

          {hasActiveFilters || searchTerm ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              {text('清空筛选', 'Clear filters')}
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
