import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Info, Star, ArrowDown, Loader2, Sparkles } from 'lucide-react';
import { ProcessedJobData } from '../services/data-management-service';
import { JobCategory } from '../types/rss-types';
import { ReferralContact } from '../services/trusted-companies-service';

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
    salary: job.salary || '',
    jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
    experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
    category: job.category,
    description: job.description,
    tags: job.tags?.join(', ') || '',
    requirements: job.requirements?.join('\n') || '',
    benefits: job.benefits?.join('\n') || '',
    region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
    isFeatured: job.isFeatured || false,
    isApproved: (job as any).isApproved || false,
    url: job.url || '',
    referralContactMode: ((job as any).referralContactMode === 'custom' ? 'custom' : 'inherit_all') as 'inherit_all' | 'custom',
    selectedReferralContactIds: Array.isArray((job as any).selectedReferralContactIds) ? [...(job as any).selectedReferralContactIds] : []
  });

  const [isSaving, setIsSaving] = useState(false);

  // 监听job变化，更新表单数据 (当导航切换时)
  useEffect(() => {
    setFormData({
      title: job.title,
      translations: (job as any).translations || {},
      company: job.company,
      location: job.location,
      timezone: job.timezone || '',
      publishedAt: formatDateForInput(job.publishedAt),
      salary: job.salary || '',
      jobType: job.jobType as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship',
      experienceLevel: job.experienceLevel as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive',
      category: job.category,
      description: job.description,
      tags: job.tags?.join(', ') || '',
      requirements: job.requirements?.join('\n') || '',
      benefits: job.benefits?.join('\n') || '',
      region: (job.region as 'domestic' | 'overseas' | undefined) || undefined,
      isFeatured: job.isFeatured || false,
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
      await onSave({
        ...formData,
        publishedAt: formData.publishedAt ? new Date(formData.publishedAt).toISOString() : undefined,
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
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

  // Tag suggestions based on category
  const getSuggestedTags = (category: string) => {
    const commonTags = ['Remote', 'English', 'Communication'];
    const categoryTags: Record<string, string[]> = {
      '前端开发': ['React', 'Vue', 'TypeScript', 'JavaScript', 'HTML/CSS', 'Next.js', 'TailwindCSS'],
      '后端开发': ['Java', 'Python', 'Node.js', 'Go', 'Spring Boot', 'Django', 'SQL', 'Microservices'],
      '全栈开发': ['React', 'Node.js', 'TypeScript', 'Full Stack', 'AWS', 'GraphQL'],
      '移动开发': ['iOS', 'Android', 'Flutter', 'React Native', 'Swift', 'Kotlin'],
      'UI/UX设计': ['Figma', 'Sketch', 'UI Design', 'UX Research', 'Prototyping', 'Adobe XD'],
      '产品经理': ['Product Management', 'Agile', 'Scrum', 'User Stories', 'Roadmap', 'Jira'],
      '数据分析': ['SQL', 'Python', 'Tableau', 'Power BI', 'Data Analysis', 'Excel'],
      '运维/SRE': ['AWS', 'Docker', 'Kubernetes', 'CI/CD', 'Linux', 'Terraform'],
      '市场营销': ['SEO', 'Content Marketing', 'Social Media', 'Growth Hacking', 'Google Analytics', 'Copywriting'],
      '人工智能': ['Machine Learning', 'Deep Learning', 'PyTorch', 'TensorFlow', 'NLP', 'Computer Vision'],
      'Web3/区块链': ['Solidity', 'Smart Contracts', 'Ethereum', 'DeFi', 'Web3.js', 'Rust']
    };

    return [...(categoryTags[category] || []), ...commonTags];
  };

  const currentSuggestedTags = getSuggestedTags(formData.category);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-xl">
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Approval Action Bar */}
          <div className="flex items-center justify-between bg-indigo-50/50 p-3 rounded-lg border border-indigo-100">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${formData.isApproved ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'}`}>
                {formData.isApproved ? <CheckCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">
                  {formData.isApproved ? '已通过审核' : '待审核'}
                </h3>
                <p className="text-sm text-slate-500">
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

          <div className="border border-slate-200 rounded-xl p-4 bg-white">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">内推联系人关联</h3>
                <p className="text-[12px] text-slate-500 mt-1">
                  默认不指定时，该企业下全部联系人都对当前岗位生效；切换到自定义后可多选 0-N 个联系人。
                </p>
              </div>
              <span className="text-[11px] text-slate-400 whitespace-nowrap">
                企业联系人 {availableReferralContacts.length} 个
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className={`rounded-lg border px-3 py-3 cursor-pointer transition-colors ${formData.referralContactMode === 'inherit_all' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
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
                    <div className="text-[12px] text-slate-500 mt-1">不额外指定时，企业当前所有联系人都可用于该岗位。</div>
                  </div>
                </div>
              </label>

              <label className={`rounded-lg border px-3 py-3 cursor-pointer transition-colors ${formData.referralContactMode === 'custom' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'}`}>
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
                    <div className="text-[12px] text-slate-500 mt-1">仅让当前岗位使用选中的联系人，可多选，也可显式设置为 0 个。</div>
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
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位名称</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {(formData as any).translations?.title && (
                <div className="mt-1 flex items-center justify-between bg-slate-50 px-2 py-1 rounded border border-slate-200">
                  <span className="text-[11px] text-slate-500 truncate mr-2" title={(formData as any).translations.title}>
                    翻译: {(formData as any).translations.title}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const newTrans = { ...(formData as any).translations };
                      delete newTrans.title;
                      setFormData({ ...formData, translations: newTrans });
                    }}
                    className="text-[10px] text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                  >
                    清除翻译
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">企业名称</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
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

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">时区</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: UTC+8, PST, America/New_York"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">发布时间</label>
              <input
                type="datetime-local"
                value={formData.publishedAt}
                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">薪资</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: $80,000 - $120,000"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-slate-700 mb-1.5">申请链接 (URL)</label>
              <input
                type="url"
                value={(formData as any).url || ''}
                onChange={(e) => setFormData({ ...formData, url: e.target.value } as any)}
                className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="https://..."
              />
            </div>

            <div>
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

            <div>
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

            <div>
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

            <div className="md:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  className="w-3.5 h-3.5 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-[13px] font-medium text-slate-700">设为精选岗位 (Featured)</span>
                <Star className={`w-3.5 h-3.5 ${formData.isFeatured ? 'text-yellow-500 fill-current' : 'text-slate-400'}`} />
              </label>
            </div>

            <div className="md:col-span-2 mt-4 space-y-3 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[13px] font-medium text-slate-700 text-sm">技能标签 <span className="text-[11px] text-slate-400 font-normal">（用逗号分隔）</span></label>
                <button
                  type="button"
                  onClick={() => {
                    // Extract text source
                    const sourceText = String((formData as any).translations?.description || formData.description || '').toLowerCase();
                    if (!sourceText) return;

                    // Simple local dictionary
                    const dictionary = [
                      'React', 'Vue', 'Angular', 'Node.js', 'Python', 'Java', 'Go', 'Golang', 'Rust',
                      'AWS', 'Docker', 'Kubernetes', 'CI/CD', 'SQL', 'MongoDB', 'Redis', 'API', 'REST', 'GraphQL',
                      'DevOps', 'Agile', 'Scrum', 'Jira', 'Git', 'Linux', 'Windows', 'MacOS', 'iOS', 'Android',
                      'Flutter', 'React Native', 'TypeScript', 'JavaScript', 'HTML', 'CSS', 'SASS', 'TailwindCSS',
                      'Webpack', 'Next.js', 'Nuxt.js', 'Nest.js', 'Express', 'Spring Boot', 'Django', 'Flask', 'FastAPI',
                      'C#', 'C++', 'PHP', 'Ruby', 'Swift', 'Kotlin', 'Scala', 'TensorFlow', 'PyTorch', 'Machine Learning', 'AI', 'NLP',
                      'Data Analysis', 'Tableau', 'Excel', 'Figma', 'Sketch', 'UI/UX', 'Product Management', 'SEO',
                      'Solidity', 'Smart Contracts', 'Web3', 'Ethereum', 'DeFi',
                      '双语', '英语', 'English', '沟通', 'Communication', '远程', 'Remote', '独立', 'Proactive'
                    ];

                    const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
                    const newTags = new Set(currentTags);
                    let addedCount = 0;

                    for (const dictWord of dictionary) {
                      const lowerDict = dictWord.toLowerCase();
                      if (sourceText.includes(lowerDict)) {
                        // Avoid duplicates case-insensitively before adding true case version
                        if (!currentTags.some(t => t.toLowerCase() === lowerDict)) {
                          newTags.add(dictWord);
                          addedCount++;
                        }
                      }
                    }

                    if (addedCount > 0) {
                      setFormData({ ...formData, tags: Array.from(newTags).join(', ') });
                    }
                  }}
                  className="flex items-center gap-1 text-[10px] text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors font-medium border border-indigo-50"
                  title="自动扫描职位描述并提取常见关键词"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  从详情智能提取
                </button>
              </div>
              <div className="space-y-1.5">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如: React, TypeScript, Node.js"
                />
                {/* Use currentSuggestedTags instead of generic availableTags if available */}
                {(currentSuggestedTags.length > 0 ? currentSuggestedTags : availableTags).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 items-center">
                    <span className="text-[10px] text-slate-400 pr-1">推荐:</span>
                    {(currentSuggestedTags.length > 0 ? currentSuggestedTags : availableTags).map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          const currentTags = formData.tags.split(',').map(t => t.trim()).filter(Boolean);
                          if (!currentTags.includes(tag)) {
                            const newTags = [...currentTags, tag].join(', ');
                            setFormData({ ...formData, tags: newTags });
                          }
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

            <div className="md:col-span-2 mt-4 space-y-4 pt-4 border-t border-slate-100">
              {(job as any).translations?.description && (
                <div className="mb-3 bg-indigo-50/50 border border-indigo-100/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 text-indigo-700 font-medium">
                      <span className="text-[10px] bg-indigo-100 px-1.5 py-0.5 rounded text-indigo-800">中文翻译 (参考)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, description: (job as any).translations.description })}
                      className="text-[10px] flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-1.5 py-0.5 rounded shadow-sm border border-indigo-100"
                      title="使用翻译替换当前描述"
                    >
                      <ArrowDown className="w-2.5 h-2.5" />
                      填入描述
                    </button>
                  </div>
                  <div className="text-[13px] text-slate-700 whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                    {(job as any).translations.description}
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">岗位要求（每行一个）</label>
                <textarea
                  value={formData.requirements}
                  onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                  placeholder="例如:&#10;3+ years React experience&#10;TypeScript proficiency"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium text-slate-700 mb-1.5">福利待遇（每行一个）</label>
                <textarea
                  value={formData.benefits}
                  onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                  rows={3}
                  className="w-full px-2.5 py-2 text-[13px] border border-slate-300 rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 leading-relaxed"
                  placeholder="例如:&#10;Remote work&#10;Health insurance"
                />
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
