import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, CheckCircle, Info, Star, ArrowDown, Loader2 } from 'lucide-react';
import { ProcessedJobData } from '../services/data-management-service';
import { JobCategory } from '../types/rss-types';

interface EditJobModalProps {
  job: ProcessedJobData;
  onSave: (updatedJob: Partial<ProcessedJobData>, shouldClose?: boolean) => void;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
  hasPrev?: boolean;
  hasNext?: boolean;
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
    isApproved: (job as any).isApproved || false
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
      isApproved: (job as any).isApproved || false
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
        benefits: formData.benefits.split('\n').filter(Boolean)
      }, false); // Keep modal open for bulk editing
    } finally {
      setIsSaving(false);
    }
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
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-slate-900">编辑职位信息</h2>
              {/* 导航按钮 */}
              {onNavigate && (
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => onNavigate('prev')}
                    disabled={!hasPrev}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="上一条 (←)"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div className="w-px h-4 bg-slate-300 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => onNavigate('next')}
                    disabled={!hasNext}
                    className="p-1 hover:bg-white rounded shadow-sm disabled:opacity-30 disabled:hover:bg-transparent disabled:shadow-none transition-all"
                    title="下一条 (→)"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  取消
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 text-sm font-medium"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      保存中...
                    </>
                  ) : '保存'}
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-slate-100 rounded-lg transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Approval Action Bar */}
          <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                formData.isApproved 
                  ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
              }`}
            >
              {formData.isApproved ? '撤销审核' : '通过审核'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位名称</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
              {(formData as any).translations?.title && (
                <div className="mt-1.5 flex items-center justify-between bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                   <span className="text-xs text-slate-600 truncate mr-2" title={(formData as any).translations.title}>
                     翻译: {(formData as any).translations.title}
                   </span>
                   <button 
                     type="button"
                     onClick={() => {
                        const newTrans = { ...(formData as any).translations };
                        delete newTrans.title;
                        setFormData({ ...formData, translations: newTrans });
                     }}
                     className="text-xs text-red-600 hover:text-red-700 font-medium whitespace-nowrap"
                   >
                     清除翻译
                   </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">企业名称</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">工作地点</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">时区</label>
              <input
                type="text"
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: UTC+8, PST, America/New_York"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">发布时间</label>
              <input
                type="datetime-local"
                value={formData.publishedAt}
                onChange={(e) => setFormData({ ...formData, publishedAt: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">薪资</label>
              <input
                type="text"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如: $80,000 - $120,000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位类型</label>
              <select
                value={formData.jobType}
                onChange={(e) => setFormData({ ...formData, jobType: e.target.value as 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="full-time">全职</option>
                <option value="part-time">兼职</option>
                <option value="contract">合同</option>
                <option value="freelance">自由职业</option>
                <option value="internship">实习</option>
              </select>
            </div>

            <div className="hidden">
              <label className="block text-sm font-medium text-slate-700 mb-2">区域分类</label>
              <select
                value={formData.region || ''}
                onChange={(e) => setFormData({ ...formData, region: (e.target.value || undefined) as 'domestic' | 'overseas' | undefined })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">未设置</option>
                <option value="domestic">国内</option>
                <option value="overseas">海外</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位级别</label>
              <select
                value={formData.experienceLevel}
                onChange={(e) => setFormData({ ...formData, experienceLevel: e.target.value as 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="Entry">初级</option>
                <option value="Mid">中级</option>
                <option value="Senior">高级</option>
                <option value="Lead">专家</option>
                <option value="Executive">管理层</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位分类</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as JobCategory })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isFeatured}
                  onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                />
                <span className="text-sm font-medium text-slate-700">设为精选岗位 (Featured)</span>
                <Star className={`w-4 h-4 ${formData.isFeatured ? 'text-yellow-500 fill-current' : 'text-slate-400'}`} />
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">技能标签（用逗号分隔）</label>
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例如: React, TypeScript, Node.js"
                />
                {/* Use currentSuggestedTags instead of generic availableTags if available */}
                {(currentSuggestedTags.length > 0 ? currentSuggestedTags : availableTags).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-xs text-slate-500 flex items-center">推荐标签:</span>
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
                        className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs rounded transition-colors"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              {(job as any).translations?.description && (
                <div className="mb-4 bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-indigo-800 font-medium">
                      <span className="text-xs bg-indigo-200 px-2 py-0.5 rounded text-indigo-800">中文翻译 (参考)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, description: (job as any).translations.description })}
                      className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-2 py-1 rounded border border-indigo-200 hover:border-indigo-300 shadow-sm"
                      title="使用翻译替换当前描述"
                    >
                      <ArrowDown className="w-3 h-3" />
                      填入描述
                    </button>
                  </div>
                  <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                    {(job as any).translations.description}
                  </div>
                </div>
              )}
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">岗位要求（每行一个）</label>
              <textarea
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如:&#10;3+ years React experience&#10;TypeScript proficiency"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">福利待遇（每行一个）</label>
              <textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={4}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="例如:&#10;Remote work&#10;Health insurance"
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
