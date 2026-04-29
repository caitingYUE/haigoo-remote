import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Crown,
  Mail,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { encodeJobId } from '../../utils/share-link-helper';
import AdminXiaohongshuPush from './AdminXiaohongshuPush';

interface PreviewJob {
  id: string;
  title: string;
  company: string;
  metaLine: string;
  shareUrl?: string;
  applicationUrl?: string;
  companyInfoLine?: string;
  referralInfoLines?: string[];
  recommendationScore?: number;
}

interface AudienceCardPreview {
  key: 'public' | 'member';
  audienceLabel: string;
  title: string;
  ruleSummary: string;
  repeatWindowDays: number;
  jobCount: number;
  copyText: string;
  jobs: PreviewJob[];
  generatedAt: string | null;
  batchDate: string;
  groupMeta: {
    id: number;
    internalName: string;
    selectedRoles: string[];
  };
}

interface PreviewGroup {
  id: number;
  internalName: string;
  sortOrder: number;
  selectedRoles: string[];
  generatedAt: string | null;
  publicCard: AudienceCardPreview;
  memberCard: AudienceCardPreview;
}

interface PreviewResponse {
  success: boolean;
  timeZone: string;
  batchDate: string;
  batchLabel: string;
  generatedAt: number | null;
  schedule: {
    timeZone: string;
    refreshHour: number;
    refreshMinute: number;
    currentBatchDate: string;
    currentBatchLabel: string;
    displayBatchDate: string;
    displayBatchLabel: string;
    hasReachedRefreshTime: boolean;
  };
  groups: PreviewGroup[];
}

interface GroupSettingItem {
  id: number;
  internalName: string;
  sortOrder: number;
  isActive: boolean;
  currentRoles: string[];
  currentInternalName: string;
  currentSortOrder: number;
  currentIsActive: boolean;
  currentEffectiveDate: string;
  pendingRoles: string[];
  pendingInternalName: string;
  pendingSortOrder: number;
  pendingIsActive: boolean;
  pendingEffectiveDate: string;
}

interface GroupSettingsResponse {
  success: boolean;
  roleOptions: string[];
  today: string;
  tomorrow: string;
  groups: GroupSettingItem[];
}

type ContentPushTab = 'community' | 'xiaohongshu';

interface GroupFormState {
  id?: number;
  internalName: string;
  isActive: boolean;
  selectedRoles: string[];
}

const EMPTY_GROUP_FORM: GroupFormState = {
  internalName: '',
  isActive: true,
  selectedRoles: []
};

const DEFAULT_GROUP_NAME = '默认分组';

const normalizeShareUrl = (jobId: string, shareUrl?: string) => {
  const fallback = `https://haigooremote.com/job/${encodeJobId(jobId)}?source=share`;
  const normalized = String(shareUrl || '').trim();
  if (!normalized) return fallback;
  if (/\/job\/E-[^/?#]+(?:\?source=share)?$/i.test(normalized)) {
    return normalized.includes('?source=share') ? normalized : `${normalized}?source=share`;
  }
  return fallback;
};

const normalizeAudienceCard = (audience: AudienceCardPreview): AudienceCardPreview => {
  const jobs = audience.jobs.map((job) => ({
    ...job,
    shareUrl: normalizeShareUrl(job.id, job.shareUrl)
  }));

  let copyText = String(audience.copyText || '');
  jobs.forEach((job, index) => {
    const originalShareUrl = String(audience.jobs[index]?.shareUrl || '').trim();
    if (originalShareUrl && originalShareUrl !== job.shareUrl) {
      copyText = copyText.split(originalShareUrl).join(job.shareUrl || '');
    }
  });

  return {
    ...audience,
    jobs,
    copyText
  };
};

const normalizePreviewResponse = (preview: PreviewResponse): PreviewResponse => ({
  ...preview,
  groups: preview.groups.map((group) => ({
    ...group,
    publicCard: normalizeAudienceCard(group.publicCard),
    memberCard: normalizeAudienceCard(group.memberCard)
  }))
});

const SocialPushPreviewContent: React.FC<{ token?: string | null }> = ({ token }) => {
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [settings, setSettings] = useState<GroupSettingsResponse | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [replacingKey, setReplacingKey] = useState<string | null>(null);
  const [groupForm, setGroupForm] = useState<GroupFormState>(EMPTY_GROUP_FORM);

  const fetchPreview = useCallback(async (silent = false) => {
    try {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetch('/api/cron/admin-daily-featured-email?action=preview', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '加载社群推送失败');
      }

      setPreview(normalizePreviewResponse(data));
      setSelectedGroupId((current) => {
        if (data.groups.some((group: PreviewGroup) => group.id === current)) return current;
        return data.groups[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载社群推送失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  const fetchSettings = useCallback(async () => {
    const res = await fetch('/api/admin/content-push/social-push/groups', {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    const data = await res.json();
    if (!res.ok || !data?.success) {
      throw new Error(data?.error || '加载分组设置失败');
    }

    setSettings(data);
    return data as GroupSettingsResponse;
  }, [token]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchPreview(false), fetchSettings()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载社群推送失败');
      setLoading(false);
    }
  }, [fetchPreview, fetchSettings]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!settingsOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [settingsOpen]);

  const selectedGroup = useMemo(
    () => preview?.groups.find((group) => group.id === selectedGroupId) || preview?.groups[0] || null,
    [preview, selectedGroupId]
  );

  const visibleSettingsGroups = useMemo(() => {
    return (settings?.groups || []).filter((group) => {
      const groupName = group.pendingInternalName || group.currentInternalName || group.internalName;
      if (groupName === DEFAULT_GROUP_NAME) return false;
      return group.pendingIsActive || (!group.pendingEffectiveDate && group.currentIsActive);
    });
  }, [settings]);

  const latestGeneratedAt = useMemo(() => {
    const timestamps = (preview?.groups || [])
      .map((group) => new Date(group.generatedAt || group.publicCard.generatedAt || group.memberCard.generatedAt || 0).getTime())
      .filter((value) => Number.isFinite(value) && value > 0);

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps)).toLocaleString('zh-CN', { hour12: false });
  }, [preview]);

  const openCreateGroup = () => {
    setGroupForm(EMPTY_GROUP_FORM);
    setSettingsOpen(true);
  };

  const openEditGroup = (group: GroupSettingItem) => {
    setGroupForm({
      id: group.id,
      internalName: group.pendingInternalName || group.currentInternalName || group.internalName,
      isActive: group.pendingInternalName ? group.pendingIsActive : group.currentIsActive,
      selectedRoles: group.pendingRoles.length > 0 ? group.pendingRoles : group.currentRoles
    });
    setSettingsOpen(true);
  };

  const closeSettingsModal = () => {
    setGroupForm(EMPTY_GROUP_FORM);
    setSettingsOpen(false);
  };

  const formatDateTime = (value: string | null | undefined) => {
    if (!value) return '暂无';
    try {
      return new Date(value).toLocaleString('zh-CN', { hour12: false });
    } catch (_error) {
      return value;
    }
  };

  const handleCopy = async (copyKey: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(copyKey);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === copyKey ? null : current));
      }, 1800);
    } catch (err) {
      console.error('Failed to copy social push text:', err);
      alert('复制失败，请检查浏览器权限');
    }
  };

  const handleRefreshToday = async () => {
    try {
      setRefreshing(true);
      setError(null);

      const res = await fetch('/api/cron/admin-daily-featured-email?action=refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '刷新当天结果失败');
      }

      setPreview(normalizePreviewResponse(data));
      setSelectedGroupId((current) => {
        if (data.groups.some((group: PreviewGroup) => group.id === current)) return current;
        return data.groups[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '刷新当天结果失败');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleRole = (role: string) => {
    setGroupForm((current) => ({
      ...current,
      selectedRoles: current.selectedRoles.includes(role)
        ? current.selectedRoles.filter((item) => item !== role)
        : current.selectedRoles.concat(role)
    }));
  };

  const handleSaveGroup = async () => {
    try {
      setSaving(true);
      setError(null);

      const method = groupForm.id ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/content-push/social-push/groups', {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(groupForm)
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '保存分组失败');
      }

      setSettings(data);
      setSettingsOpen(false);
      setGroupForm(EMPTY_GROUP_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存分组失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: GroupSettingItem) => {
    const groupName = group.pendingInternalName || group.currentInternalName || group.internalName;
    if (!group.id || groupName === DEFAULT_GROUP_NAME) return;

    const confirmed = window.confirm(`删除分组“${groupName}”后，将从次日推荐中移除。是否继续？`);
    if (!confirmed) return;

    try {
      setSaving(true);
      setError(null);

      const res = await fetch(`/api/admin/content-push/social-push/groups?id=${group.id}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '删除分组失败');
      }

      setSettings(data);
      setGroupForm(EMPTY_GROUP_FORM);
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除分组失败');
    } finally {
      setSaving(false);
    }
  };

  const handleReplaceJob = async (groupId: number, audienceKey: 'public' | 'member', jobId: string) => {
    const replaceKey = `${groupId}-${audienceKey}-${jobId}`;
    try {
      setReplacingKey(replaceKey);
      setError(null);

      const res = await fetch('/api/admin/content-push/social-push/replace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          groupId,
          audienceKey,
          jobId,
          batchDate: preview?.batchDate
        })
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '更换岗位失败');
      }

      setPreview((current) => {
        if (!current) return current;
        return normalizePreviewResponse({
          ...current,
          groups: current.groups.map((group) => {
            if (group.id !== groupId) return group;
            return {
              ...group,
              generatedAt: data.card.generatedAt || group.generatedAt,
              [audienceKey === 'public' ? 'publicCard' : 'memberCard']: data.card
            };
          })
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '更换岗位失败');
    } finally {
      setReplacingKey(null);
    }
  };

  const renderAudienceCard = (
    groupId: number,
    audience: AudienceCardPreview,
    accent: {
      badge: string;
      border: string;
      button: string;
      icon: React.ReactNode;
    }
  ) => {
    const copyKey = `${groupId}-${audience.key}`;
    const jobsShortage = audience.jobCount < 3;

    return (
      <section className={`rounded-3xl border bg-white p-5 shadow-sm ${accent.border}`}>
        <div className="flex flex-col gap-4 border-b border-slate-100 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${accent.badge}`}>
                  {accent.icon}
                  {audience.audienceLabel}
                </span>
                <span className="text-xs text-slate-500">近 {audience.repeatWindowDays} 天不重复</span>
                {jobsShortage ? (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    岗位不足
                  </span>
                ) : null}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{audience.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">{audience.ruleSummary}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleCopy(copyKey, audience.copyText)}
              className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${accent.button}`}
            >
              {copiedKey === copyKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedKey === copyKey ? '已复制' : '一键复制'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>当前推荐 {audience.jobCount} 个岗位</span>
            <span>最近生成 {formatDateTime(audience.generatedAt)}</span>
          </div>
          {jobsShortage ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
              当前仅推荐 {audience.jobCount} 个岗位，请补充该类型岗位数据。
            </div>
          ) : null}
        </div>

        <div className="mt-5 space-y-4">
          {audience.jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              当前没有符合条件的岗位。
            </div>
          ) : audience.jobs.map((job) => {
            const replaceKey = `${groupId}-${audience.key}-${job.id}`;
            return (
              <article key={replaceKey} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div>
                      <h4 className="truncate text-base font-semibold text-slate-900">{job.title}</h4>
                      <p className="mt-1 text-sm font-medium text-slate-700">{job.company}</p>
                    </div>
                    <p className="text-xs leading-6 text-slate-500">{job.metaLine}</p>
                    <div className="space-y-1 text-xs leading-6 text-slate-600">
                      {job.applicationUrl ? (
                        <div className="truncate">原始申请链接：{job.applicationUrl}</div>
                      ) : (
                        <div>原始申请链接：待补充</div>
                      )}
                      {job.shareUrl ? (
                        <div className="truncate">海狗分享链接：{job.shareUrl}</div>
                      ) : null}
                      {audience.key === 'member' ? (
                        <>
                          <div>企业信息：{job.companyInfoLine || '待补充'}</div>
                          {(job.referralInfoLines || []).length > 0 ? (
                            job.referralInfoLines?.map((line) => (
                              <div key={`${replaceKey}-${line}`}>内推信息：{line}</div>
                            ))
                          ) : (
                            <div>内推信息：待补充</div>
                          )}
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-2 lg:items-end">
                    <span className="rounded-full bg-slate-200/80 px-3 py-1 text-xs font-semibold text-slate-700">
                      推荐分 {Number(job.recommendationScore || 0).toFixed(1)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleReplaceJob(groupId, audience.key, job.id)}
                      disabled={replacingKey === replaceKey}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${replacingKey === replaceKey ? 'animate-spin' : ''}`} />
                      {replacingKey === replaceKey ? '更换中...' : '更换'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        正在加载社群推送...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Social Push</div>
            <h2 className="text-2xl font-bold text-slate-900">{preview?.schedule.displayBatchLabel} 社群推送</h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>当前批次：{preview?.schedule.displayBatchLabel}</span>
              <span>最近生成：{latestGeneratedAt || '暂无'}</span>
              <span>组合设置次日生效</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (visibleSettingsGroups.length > 0) {
                  openEditGroup(visibleSettingsGroups[0]);
                  return;
                }
                openCreateGroup();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <Settings className="h-4 w-4" />
              分组设置
            </button>
            <button
              type="button"
              onClick={handleRefreshToday}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? '刷新中...' : '手动刷新当天'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(preview?.groups || []).map((group) => {
            const active = (selectedGroup?.id || preview?.groups[0]?.id) === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setSelectedGroupId(group.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {group.internalName}
              </button>
            );
          })}
        </div>

        {selectedGroup ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            当前角色组合：{selectedGroup.selectedRoles.join('、')}
          </div>
        ) : null}
      </div>

      {selectedGroup ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {renderAudienceCard(selectedGroup.id, selectedGroup.publicCard, {
            badge: 'bg-emerald-50 text-emerald-700',
            border: 'border-emerald-200',
            button: 'bg-emerald-600 text-white hover:bg-emerald-700',
            icon: <Users className="h-3.5 w-3.5" />
          })}
          {renderAudienceCard(selectedGroup.id, selectedGroup.memberCard, {
            badge: 'bg-indigo-50 text-indigo-700',
            border: 'border-indigo-200',
            button: 'bg-indigo-600 text-white hover:bg-indigo-700',
            icon: <Crown className="h-3.5 w-3.5" />
          })}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
          当前没有可用的社群推荐分组。
        </div>
      )}

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 px-4 py-6">
          <div className="flex min-h-full items-start justify-center">
            <div className="flex max-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">社群推荐分组设置</h3>
                  <p className="mt-1 text-sm text-slate-500">保存后次日生效，今天推荐不变。</p>
                </div>
                <button
                  type="button"
                  onClick={closeSettingsModal}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[0.9fr,1.35fr]">
              <div className="min-h-0 overflow-y-auto border-r border-slate-100 p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">次日生效分组</div>
                    <div className="mt-1 text-xs text-slate-400">今天：{settings?.today} ｜ 次日：{settings?.tomorrow}</div>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateGroup}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    新建分组
                  </button>
                </div>

                {visibleSettingsGroups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm leading-6 text-slate-500">
                    还没有自定义分组。当前会按全部岗位角色推荐，创建分组后会在次日生效。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleSettingsGroups.map((group) => {
                      const nextRoles = group.pendingRoles.length > 0 ? group.pendingRoles : group.currentRoles;
                      const groupName = group.pendingInternalName || group.currentInternalName || group.internalName;
                      const active = groupForm.id === group.id;

                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => openEditGroup(group)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${
                            active
                              ? 'border-indigo-200 bg-indigo-50'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{groupName}</div>
                              <div className="mt-1 text-xs text-slate-500">已选 {nextRoles.length} 个岗位角色</div>
                            </div>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              次日生效
                            </span>
                          </div>
                          <div className="mt-3 line-clamp-3 text-xs leading-6 text-slate-500">
                            {nextRoles.join('、') || '未配置'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="min-h-0 overflow-y-auto p-6">
                <div className="space-y-5">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-slate-900">内部名称</span>
                    <input
                      value={groupForm.internalName}
                      onChange={(event) => setGroupForm((current) => ({ ...current, internalName: event.target.value }))}
                      placeholder="例如：产品/运营组"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-300"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={groupForm.isActive}
                      onChange={(event) => setGroupForm((current) => ({ ...current, isActive: event.target.checked }))}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    启用该分组
                  </label>

                  <div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">岗位角色</div>
                        <div className="mt-1 text-xs text-slate-500">可多选，保存后次日生效。</div>
                      </div>
                      <div className="text-xs text-slate-400">已选 {groupForm.selectedRoles.length} 项</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(settings?.roleOptions || []).map((role) => {
                        const active = groupForm.selectedRoles.includes(role);
                        return (
                          <button
                            key={role}
                            type="button"
                            onClick={() => handleToggleRole(role)}
                            className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                              active
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            {role}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
                    当前修改只影响次日推荐。若该分组可推荐岗位不足 3 个，页面会提示补充对应类型数据。
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      {groupForm.id ? (
                        <button
                          type="button"
                          onClick={() => {
                            const target = visibleSettingsGroups.find((group) => group.id === groupForm.id);
                            if (target) handleDeleteGroup(target);
                          }}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          删除分组
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={handleSaveGroup}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Check className="h-4 w-4" />
                        {saving ? '保存中...' : '保存分组'}
                      </button>
                      <button
                        type="button"
                        onClick={closeSettingsModal}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

const AdminSocialPush: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<ContentPushTab>('community');

  const tabs: Array<{ id: ContentPushTab; label: string; icon: React.ReactNode; description: string }> = [
    {
      id: 'community',
      label: '社群推送',
      icon: <Mail className="h-4 w-4" />,
      description: '按自定义分组查看非会员群和会员群推荐结果。'
    },
    {
      id: 'xiaohongshu',
      label: '小红书推送',
      icon: <Sparkles className="h-4 w-4" />,
      description: '面向运营同学的单岗位筛选、复制与配图导出工作台。'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Content Push</div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900">内容推送工作台</h1>
            <p className="mt-2 text-sm text-slate-500">
              同一入口下维护社群推送与社媒内容推送，便于营销运营统一处理岗位传播素材。
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-2xl border px-4 py-3 text-left transition ${
                  activeTab === tab.id
                    ? 'border-rose-200 bg-rose-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <span className={activeTab === tab.id ? 'text-rose-600' : 'text-slate-500'}>{tab.icon}</span>
                  {tab.label}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-500">{tab.description}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {activeTab === 'community' ? (
        <SocialPushPreviewContent token={token} />
      ) : (
        <AdminXiaohongshuPush token={token} />
      )}
    </div>
  );
};

export default AdminSocialPush;
