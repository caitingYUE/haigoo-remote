import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Info, Star, ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { ProcessedJobData } from '../services/data-management-service';
import { JobCategory } from '../types/rss-types';
import { ReferralContact } from '../services/trusted-companies-service';
import {
  formatSalaryForDisplay,
  normalizeSalary,
  serializeSalaryForStorage,
  SALARY_CURRENCY_OPTIONS,
  SALARY_PERIOD_OPTIONS,
  type SupportedSalaryCurrency,
  type SupportedSalaryPeriod,
  type SupportedSalaryValueMode
} from '../utils/salary-display';
import { extractJobSkillKeywords } from '../utils/job-skill-extractor';
import { appendTagInput, joinTagInput, splitTagInput } from '../utils/tag-input';

const APPLICATION_GUIDE_LIMIT = 1200;

interface EditJobModalProps {
  job: ProcessedJobData;
  onSave: (updatedJob: Partial<ProcessedJobData>, shouldClose?: boolean) => void;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  availableReferralContacts?: ReferralContact[];
  availableCategories?: string[];
  availableTags?: string[];
}

export const EditJobModal: React.FC<EditJobModalProps> = ({
  job,
  onSave,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
  availableReferralContacts = [],
  availableCategories = [],
  availableTags = []
}) => {
  const buildSalaryState = (salary: ProcessedJobData['salary']) => {
    const normalized = normalizeSalary(salary);
    if (normalized.kind === 'structured' && normalized.structured) {
      return {
        salary: normalized.raw,
        salaryEditorMode: 'structured' as const,
        salaryCurrency: normalized.structured.currency as SupportedSalaryCurrency,
        salaryPeriod: normalized.structured.period as SupportedSalaryPeriod,
        salaryValueMode: normalized.structured.valueMode as SupportedSalaryValueMode,
        salaryMin: normalized.structured.min ? String(normalized.structured.min) : '',
        salaryMax: normalized.structured.max ? String(normalized.structured.max) : '',
      };
    }

    return {
      salary: typeof salary === 'string' ? salary : '',
      salaryEditorMode: 'legacy' as const,
      salaryCurrency: 'USD' as SupportedSalaryCurrency,
      salaryPeriod: 'yearly' as SupportedSalaryPeriod,
      salaryValueMode: 'range' as SupportedSalaryValueMode,
      salaryMin: '',
      salaryMax: '',
    };
  };

  // Helper to format date for datetime-local input
  const formatDateForInput = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      // Adjust for timezone offset to get correct local time string for input
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    title: job.title,
    translations: (job as any).translations || {},
    company: job.company,
    location: job.location,
    timezone: job.timezone || '',
    publishedAt: formatDateForInput(job.publishedAt),
    ...buildSalaryState(job.salary),
    jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
    experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
    category: job.category,
    description: job.description,
    tags: job.tags?.join(', ') || '',
    requirements: job.requirements?.join('\n') || '',
    benefits: job.benefits?.join('\n') || '',
    region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
    isFeatured: job.isFeatured || false,
    featuredReason: (job as any).featuredReason || '',
    isApproved: (job as any).isApproved || false,
    url: job.url || '',
    referralContactMode: ((job as any).referralContactMode === 'custom' ? 'custom' : 'inherit_all') as 'inherit_all' | 'custom',
    selectedReferralContactIds: Array.isArray((job as any).selectedReferralContactIds) ? [...(job as any).selectedReferralContactIds] : []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isGuideEditorExpanded, setIsGuideEditorExpanded] = useState(false);

  const updateTranslationField = (field: 'title' | 'description', value: string) => {
    setFormData(prev => ({
      ...prev,
      translations: {
        ...((prev as any).translations || {}),
        [field]: value
      }
    }));
  };

  const salaryPreview = formData.salaryEditorMode === 'structured'
    ? formatSalaryForDisplay({
      min: formData.salaryMin ? Number(formData.salaryMin) : undefined,
      max: formData.salaryValueMode === 'fixed'
        ? (formData.salaryMin ? Number(formData.salaryMin) : undefined)
        : (formData.salaryMax ? Number(formData.salaryMax) : undefined),
      currency: formData.salaryCurrency,
      period: formData.salaryPeriod,
      valueMode: formData.salaryValueMode
    }, '薪资Open')
    : formatSalaryForDisplay(formData.salary, '薪资Open');

  // 监听job变化，更新表单数据 (当导航切换时)
  useEffect(() => {
    setFormData({
      title: job.title,
      translations: (job as any).translations || {},
      company: job.company,
      location: job.location,
      timezone: job.timezone || '',
      publishedAt: formatDateForInput(job.publishedAt),
      ...buildSalaryState(job.salary),
      jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
      experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
      category: job.category,
      description: job.description,
      tags: job.tags?.join(', ') || '',
      requirements: job.requirements?.join('\n') || '',
      benefits: job.benefits?.join('\n') || '',
      region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
      isFeatured: job.isFeatured || false,
      featuredReason: (job as any).featuredReason || '',
      isApproved: (job as any).isApproved || false,
      url: job.url || '',
      referralContactMode: ((job as any).referralContactMode === 'custom' ? 'custom' : 'inherit_all') as 'inherit_all' | 'custom',
      selectedReferralContactIds: Array.isArray((job as any).selectedReferralContactIds) ? [...(job as any).selectedReferralContactIds] : []
    });
  }, [job]);

  // 监听键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 避免在输入框中触发
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowLeft' && hasPrev && onNavigate) {
        onNavigate('prev');
      } else if (e.key === 'ArrowRight' && hasNext && onNavigate) {
        onNavigate('next');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasPrev, hasNext, onNavigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const {
        salaryEditorMode,
        salaryCurrency,
        salaryPeriod,
        salaryValueMode,
        salaryMin,
        salaryMax,
        ...restFormData
      } = formData as typeof formData & {
        salaryEditorMode: 'structured' | 'legacy'
        salaryCurrency: SupportedSalaryCurrency
        salaryPeriod: SupportedSalaryPeriod
        salaryValueMode: SupportedSalaryValueMode
        salaryMin: string
        salaryMax: string
      }

      const normalizedSalary = formData.salaryEditorMode === 'structured'
        ? serializeSalaryForStorage({
          min: formData.salaryMin ? Number(formData.salaryMin) : undefined,
          max: formData.salaryValueMode === 'fixed'
            ? (formData.salaryMin ? Number(formData.salaryMin) : undefined)
            : (formData.salaryMax ? Number(formData.salaryMax) : undefined),
          currency: formData.salaryCurrency,
          period: formData.salaryPeriod,
          valueMode: formData.salaryValueMode
        })
        : String(formData.salary || '').trim();
      const normalizedTranslations = { ...(((restFormData as any).translations || {}) as Record<string, any>) };
      if (typeof normalizedTranslations.title === 'string') {
        normalizedTranslations.title = normalizedTranslations.title.trim();
      }
      if (typeof normalizedTranslations.description === 'string') {
        normalizedTranslations.description = normalizedTranslations.description.trim();
      }
      Object.keys(normalizedTranslations).forEach((key) => {
        if (normalizedTranslations[key] === '') delete normalizedTranslations[key];
      });
      const hasAnyTranslation = Object.keys(normalizedTranslations).length > 0;

      await onSave({
        ...restFormData,
        translations: normalizedTranslations,
        isTranslated: hasAnyTranslation,
        salary: normalizedSalary,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt).toISOString() : undefined,
        tags: splitTagInput(formData.tags),
        requirements: formData.requirements.split('\n').filter(Boolean),
        benefits: formData.benefits.split('\n').filter(Boolean),
        referralContactMode: formData.referralContactMode,
        selectedReferralContactIds: formData.referralContactMode === 'custom' ? formData.selectedReferralContactIds : []
      }, false); // Keep modal open for bulk editing
    } finally {
      setIsSaving(false);
    }
  };

  const toggleReferralContact = (contactId: string) => {
    setFormData(prev => {
      const selected = Array.isArray(prev.selectedReferralContactIds) ? [...prev.selectedReferralContactIds] : [];
      const exists = selected.includes(contactId);
      return {
        ...prev,
        selectedReferralContactIds: exists
          ? selected.filter(id => id !== contactId)
          : [...selected, contactId]
      };
    });
  };

  const formatReferralContactLabel = (contact: ReferralContact) => {
    const name = String(contact?.name || '').trim() || '未命名联系人';
    const title = String(contact?.title || '').trim() || '未填写 title';
    const emailType = String(contact?.emailType || '').trim() || '通用邮箱';
    const email = String(contact?.hiringEmail || '').trim() || '未填写邮箱';
    return `${name}｜${title}｜${emailType}｜${email}`;
  };

  const jdSuggestedTags = extractJobSkillKeywords({
    title: formData.title,
    category: formData.category,
    description: formData.description,
    requirements: formData.requirements,
    benefits: formData.benefits,
    translations: (formData as any).translations,
    limit: 10
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="shrink-0 p-4 border-b border-slate-200 bg-slate-50/70 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-900">编辑职位信息</h2>
              {/* 导航按钮 */}
              {onNavigate && (
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => onNavigate('prev')}
                    disabled={!hasPrev}
                    className="p-1 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="上一条 (←)"
                  >
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                  <div className="w-px h-3 bg-slate-200 mx-0.5"></div>
                  <button
                    type="button"
                    onClick={() => onNavigate('next')}
                    disabled={!hasNext}
                    className="p-1 hover:bg-slate-50 rounded disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                    title="下一条 (→)"
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 bg-white border border-slate-200 text-slate-700 rounded hover:bg-slate-50 transition-colors text-[11px] font-medium shadow-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-1.5 text-[11px] font-medium shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      保存中...
                    </>
                  ) : '保存'}
                </button>
              </div>
              <div className="w-px h-4 bg-slate-200"></div>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-200/50 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          {/* Approval Action Bar */}
          <div className="flex items-center justify-between gap-4 bg-indigo-50/50 px-3 py-2.5 rounded-lg border border-indigo-100">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${formData.isApproved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                {formData.isApproved ? <CheckCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-[13px] font-semibold text-slate-900">
                  {formData.isApproved ? '已通过审核' : '待审核'}
                </h3>
                <p className="text-[12px] text-slate-500">
                  {formData.isApproved ? '该岗位已对外展示' : '该岗位尚未通过人工审核，仅管理员可见'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const newStatus = !formData.isApproved;
                setFormData(prev => ({ ...prev, isApproved: newStatus }));
              }}
              className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors flex items-center gap-2 ${formData.isApproved
                ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                }`}
            >
              {formData.isApproved ? '撤销审核' : '通过审核'}
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl p-3 bg-white">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">内推联系人关联</h3>
                <p className="text-[12px] text-slate-500 mt-1">默认全部通用，也可为当前岗位单独指定联系人。</p>
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                企业联系人 {availableReferralContacts.length} 个
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`rounded-lg border px-3 py-2 cursor-pointer transition-colors ${formData.referralContactMode === 'inherit_all' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="referralContactMode"
                    checked={formData.referralContactMode === 'inherit_all'}
                    onChange={() => setFormData(prev => ({ ...prev, referralContactMode: 'inherit_all' }))}
                    className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-slate-900">默认全部通用</div>
                    <div className="text-[12px] text-slate-500 mt-1">企业当前所有联系人都可用于该岗位。</div>
                  </div>
                </div>
              </label>

              <label className={`rounded-lg border px-3 py-2 cursor-pointer transition-colors ${formData.referralContactMode === 'custom' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="referralContactMode"
                    checked={formData.referralContactMode === 'custom'}
                    onChange={() => setFormData(prev => ({ ...prev, referralContactMode: 'custom' }))}
                    className="mt-1 w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <div className="text-[13px] font-medium text-slate-900">自定义关联</div>
                    <div className="text-[12px] text-slate-500 mt-1">仅使用选中的联系人，也可设置为 0 个。</div>
                  </div>
                </div>
              </label>
            </div>

            {formData.referralContactMode === 'custom' && (
              <div className="mt-4">
                {availableReferralContacts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[12px] text-slate-500">
                    当前企业还没有录入联系人，可以先回到企业编辑页补录；当前岗位保持自定义 0 个联系人也可直接保存。
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[12px] font-medium text-slate-700">选择当前岗位可用联系人</span>
                      <span className="text-[11px] text-slate-400">
                        已选 {formData.selectedReferralContactIds.length} 个
                      </span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {availableReferralContacts.map((contact) => {
                        const contactId = String(contact?.id || '').trim();
                        if (!contactId) return null;

                        return (
                          <label
                            key={contactId}
                            className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${formData.selectedReferralContactIds.includes(contactId) ? 'border-indigo-300 bg-indigo-50/70' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.selectedReferralContactIds.includes(contactId)}
                              onChange={() => toggleReferralContact(contactId)}
                              className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] text-slate-800 break-words">{formatReferralContactLabel(contact)}</div>
                              {contact.linkedin && (
                                <div className="text-[11px] text-slate-400 mt-1 break-all">{contact.linkedin}</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 text-[11px] text-slate-400">
                      保持 0 个勾选并保存，表示当前岗位显式不使用任何企业联系人。
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位名称</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">企业名称</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">翻译后标题</label>
              <input
                type="text"
                value={(formData as any).translations?.title || ''}
                onChange={(e) => updateTranslationField('title', e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="前台中文标题"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">工作地点</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 mb-1.5"
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {['全球远程', '中国远程', '亚太远程', '香港远程', '台湾远程'].map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setFormData({ ...formData, location: loc })}
                    className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">时区</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: UTC+8, PST, America/New_York"
              />
            </div>

            <div className="lg:col-span-3">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">发布时间</label>
              <input
                type="datetime-local"
                value={formData.publishedAt}
                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="lg:col-span-5 lg:row-span-3">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">薪资</label>
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                  <div>
                    <div className="text-[12px] font-semibold text-slate-800">薪资</div>
                    <div className="text-[11px] text-slate-500">规范格式优先</div>
                  </div>
                  <div className="inline-flex rounded-full bg-white p-1 shadow-sm border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, salaryEditorMode: 'structured' }))}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        formData.salaryEditorMode === 'structured'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      规范格式
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, salaryEditorMode: 'legacy' }))}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                        formData.salaryEditorMode === 'legacy'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      原文保留
                    </button>
                  </div>
                </div>

                <div className="p-3 space-y-2.5">
                  <div className="rounded-lg border border-indigo-100 bg-[linear-gradient(135deg,rgba(238,242,255,0.72),rgba(248,250,252,0.92))] px-3 py-2 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-medium text-slate-500">前台展示预览</div>
                      <div className="mt-0.5 text-[15px] font-semibold text-slate-900">{salaryPreview}</div>
                    </div>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      formData.salaryEditorMode === 'structured'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {formData.salaryEditorMode === 'structured' ? '规范存储' : '原文直存'}
                    </span>
                  </div>

                  {formData.salaryEditorMode === 'structured' ? (
                    <div className="space-y-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">货币单位</label>
                          <select
                            value={formData.salaryCurrency}
                            onChange={(e) => setFormData({ ...formData, salaryCurrency: e.target.value as SupportedSalaryCurrency })}
                            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          >
                            {SALARY_CURRENCY_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">计薪方式</label>
                          <select
                            value={formData.salaryPeriod}
                            onChange={(e) => setFormData({ ...formData, salaryPeriod: e.target.value as SupportedSalaryPeriod })}
                            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          >
                            {SALARY_PERIOD_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">数值类型</label>
                          <div className="grid grid-cols-2 gap-2">
                            {[
                              { value: 'fixed', label: '固定值' },
                              { value: 'range', label: '范围值' }
                            ].map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => setFormData({ ...formData, salaryValueMode: option.value as SupportedSalaryValueMode })}
                                className={`rounded-md border px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                                  formData.salaryValueMode === option.value
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-200 bg-white text-slate-600'
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className={`grid ${formData.salaryValueMode === 'fixed' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-2`}>
                        <div>
                          <label className="mb-1 block text-[11px] font-medium text-slate-500">
                            {formData.salaryValueMode === 'fixed' ? '金额' : '最低值'}
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={formData.salaryMin}
                            onChange={(e) => setFormData({ ...formData, salaryMin: e.target.value })}
                            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            placeholder="例如 45000"
                          />
                        </div>
                        {formData.salaryValueMode === 'range' && (
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-500">最高值</label>
                            <input
                              type="number"
                              min="0"
                              value={formData.salaryMax}
                              onChange={(e) => setFormData({ ...formData, salaryMax: e.target.value })}
                              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-[13px] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              placeholder="例如 65000"
                            />
                          </div>
                        )}
                      </div>

                      <p className="text-[11px] leading-4 text-slate-500">
                        推荐用于新录入和人工修正。前台会自动展示为紧凑格式，例如 <span className="font-semibold text-slate-700">$45k–$65k/yr</span>。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.salary}
                        onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                        className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                        placeholder="例如: $80,000 - $120,000 / year"
                      />
                      <p className="text-[11px] leading-5 text-slate-500">
                        仅用于暂时无法识别的历史薪资文本，系统会尽量按原文展示。
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">申请链接 (URL)</label>
              <input
                type="url"
                value={(formData as any).url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value } as any)}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位类型</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
                <option value="contract">合同</option>
                <option value="freelance">自由职业</option>
                <option value="internship">实习</option>
              </select>
            </div>

            <div className="hidden">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">区域分类</label>
              <select
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: (e.target.value || undefined) as 'domestic' | 'overseas' | undefined })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">未设置</option>
                <option value="domestic">国内</option>
                <option value="overseas">海外</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位级别</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Entry">初级</option>
                <option value="Mid">中级</option>
                <option value="Senior">高级</option>
                <option value="Lead">专家</option>
                <option value="Executive">管理层</option>
              </select>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {/* Dynamically populated categories or fallback */}
                {availableCategories.length > 0 ? (
                  availableCategories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))
                ) : (
                  <>
                    <option value="全栈开发">全栈开发</option>
                    <option value="前端开发">前端开发</option>
                    <option value="后端开发">后端开发</option>
                    <option value="UI/UX设计">UI/UX设计</option>
                    <option value="数据分析">数据分析</option>
                    <option value="DevOps">DevOps</option>
                    <option value="产品管理">产品管理</option>
                    <option value="市场营销">市场营销</option>
                  </>
                )}
              </select>
            </div>

            <div className="lg:col-span-12 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <div className="grid gap-3 md:grid-cols-[190px,minmax(0,1fr)] md:items-start">
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <span className="text-[13px] font-medium text-slate-700">首页精选展示</span>
                  <Star className={`w-3.5 h-3.5 ${formData.isFeatured ? 'text-yellow-500 fill-current' : 'text-slate-400'}`} />
                </label>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[13px] font-medium text-slate-700">岗位申请指南</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsGuideEditorExpanded(value => !value)}
                        className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:border-indigo-200 hover:text-indigo-600"
                      >
                        {isGuideEditorExpanded ? '收起' : '展开'}
                      </button>
                      <span className="text-[11px] text-slate-400">{formData.featuredReason.length}/{APPLICATION_GUIDE_LIMIT}</span>
                    </div>
                  </div>
                  <textarea
                    value={formData.featuredReason}
                    maxLength={APPLICATION_GUIDE_LIMIT}
                    onChange={(e) => setFormData({ ...formData, featuredReason: e.target.value.slice(0, APPLICATION_GUIDE_LIMIT) })}
                    className={`${isGuideEditorExpanded ? 'min-h-[180px]' : 'min-h-[72px]'} w-full resize-y rounded-md border border-slate-300 bg-white px-2.5 py-2 text-[13px] leading-5 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500`}
                    placeholder="填写投递重点、申请路径、邮件/官网申请注意事项。"
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-12 mt-1 space-y-3 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[13px] font-medium text-slate-700 text-sm">技能标签 <span className="text-[11px] text-slate-400 font-normal">（用逗号分隔）</span></label>
                <button
                  type="button"
                  onClick={() => {
                    const extractedTags = extractJobSkillKeywords({
                      title: formData.title,
                      category: formData.category,
                      description: formData.description,
                      requirements: formData.requirements,
                      benefits: formData.benefits,
                      translations: (formData as any).translations
                    });
                    if (extractedTags.length === 0) return;

                    setFormData({ ...formData, tags: joinTagInput([...splitTagInput(formData.tags), ...extractedTags]) });
                  }}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors font-medium border border-indigo-50"
                  title="自动扫描职位描述并提取岗位关键词"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  从详情智能提取
                </button>
              </div>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: joinTagInput(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如: React, TypeScript, Node.js"
                />
                {jdSuggestedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 items-center">
                    <span className="text-[10px] text-slate-400 pr-1">从 JD 识别:</span>
                    {jdSuggestedTags.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, tags: appendTagInput(formData.tags, tag) });
                        }}
                        className="px-1.5 py-0.5 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 text-[10px] rounded transition-colors border border-slate-100 hover:border-indigo-100 shadow-sm"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-12 mt-1 pt-3 border-t border-slate-100">
              <div className="grid gap-3 xl:grid-cols-2">
                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位描述</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={8}
                    className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label className="block text-[13px] font-medium text-slate-700">翻译后正文</label>
                    <button
                      type="button"
                      onClick={() => updateTranslationField('description', formData.description)}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-100 bg-white px-2 py-1 text-[10px] font-semibold text-indigo-600 transition hover:bg-indigo-50"
                      title="使用原始正文覆盖翻译正文"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                      用原始正文填入
                    </button>
                  </div>
                  <textarea
                    value={(formData as any).translations?.description || ''}
                    onChange={(e) => updateTranslationField('description', e.target.value)}
                    rows={8}
                    className="w-full rounded-md border border-indigo-100 bg-white px-2.5 py-2 text-[13px] leading-relaxed text-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    placeholder="人工修正后的中文岗位正文"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位要求（每行一个）</label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    rows={4}
                    className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                    placeholder="例如:&#10;3+ years React experience&#10;TypeScript proficiency"
                  />
                </div>

                <div>
                  <label className="block text-[13px] font-medium text-slate-700 mb-1.5">福利待遇（每行一个）</label>
                  <textarea
                    value={formData.benefits}
                    onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                    rows={4}
                    className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                    placeholder="例如:&#10;Remote work&#10;Health insurance"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
