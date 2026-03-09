import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Crown, RefreshCw, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface PreviewJob {
  id: string;
  title: string;
  company: string;
  metaLine: string;
  applyLine: string;
  sourceBucketLabel: string;
}

interface AudiencePreview {
  key: 'public' | 'member';
  groupLabel: string;
  title: string;
  repeatWindowDays: number;
  ruleSummary: string;
  recentExcludedCount: number;
  preferredCount: number;
  fallbackCount: number;
  jobCount: number;
  copyText: string;
  jobs: PreviewJob[];
}

interface PreviewResponse {
  success: boolean;
  batchDate: string;
  batchLabel: string;
  subject: string;
  audiences: {
    public: AudiencePreview;
    member: AudiencePreview;
  };
}

const AdminSocialPush: React.FC = () => {
  const { token } = useAuth();
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchPreview = useCallback(async (silent = false) => {
    try {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const res = await fetch('/api/cron/admin-daily-featured-email?action=preview', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || '加载社群推送预览失败');
      }

      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载社群推送预览失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => current === key ? null : current), 2000);
    } catch (err) {
      console.error('Failed to copy social push text:', err);
      alert('复制失败，请检查浏览器权限');
    }
  };

  const renderAudienceCard = (audience: AudiencePreview, accentClasses: { border: string; badge: string; button: string; icon: React.ReactNode }) => (
    <section
      key={audience.key}
      className={`rounded-3xl border bg-white shadow-sm ${accentClasses.border}`}
    >
      <div className="flex flex-col gap-4 p-6 border-b border-slate-100">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${accentClasses.badge}`}>
                {accentClasses.icon}
                {audience.groupLabel}
              </span>
              <span className="text-xs text-slate-500">近 {audience.repeatWindowDays} 天不重复</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">{audience.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{audience.ruleSummary}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(audience.key, audience.copyText)}
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${accentClasses.button}`}
          >
            {copiedKey === audience.key ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedKey === audience.key ? '已复制' : '一键复制'}
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">岗位数</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{audience.jobCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">优先池命中</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{audience.preferredCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">补位数</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{audience.fallbackCount}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">避开重复</div>
            <div className="mt-1 text-lg font-bold text-slate-900">{audience.recentExcludedCount}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">可直接复制的群发文案</h3>
            <span className="text-xs text-slate-400">邮件和后台保持一致</span>
          </div>
          <textarea
            readOnly
            value={audience.copyText}
            className="min-h-[360px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800 outline-none"
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">本次入选岗位</h3>
          <div className="space-y-3">
            {audience.jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                当前没有符合条件的岗位。
              </div>
            ) : audience.jobs.map((job) => (
              <article key={`${audience.key}-${job.id}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-slate-900">{job.title}</h4>
                    <p className="mt-1 text-sm font-medium text-slate-700">{job.company}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {job.sourceBucketLabel}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500">{job.metaLine}</p>
                <p className="mt-2 text-xs leading-6 text-slate-600">{job.applyLine}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
        正在加载社群推送预览...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8">
        <div className="text-sm font-semibold text-rose-700">社群推送预览加载失败</div>
        <div className="mt-2 text-sm text-rose-600">{error}</div>
        <button
          type="button"
          onClick={() => fetchPreview()}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Social Push Preview</div>
            <h1 className="mt-2 text-2xl font-bold">{preview.batchLabel} 社群推送</h1>
            <p className="mt-2 text-sm leading-6 text-white/80">
              当前邮件已按管理员转发场景生成双版本文案。可分别复制到微信群、企业微信或小红书群。
            </p>
            <p className="mt-2 text-xs text-white/60">邮件标题：{preview.subject}</p>
          </div>

          <button
            type="button"
            onClick={() => fetchPreview(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/18"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? '刷新中...' : '刷新预览'}
          </button>
        </div>
      </div>

      {renderAudienceCard(preview.audiences.public, {
        border: 'border-emerald-200',
        badge: 'bg-emerald-50 text-emerald-700',
        button: 'bg-emerald-600 text-white hover:bg-emerald-700',
        icon: <Users className="h-3.5 w-3.5" />
      })}

      {renderAudienceCard(preview.audiences.member, {
        border: 'border-indigo-200',
        badge: 'bg-indigo-50 text-indigo-700',
        button: 'bg-indigo-600 text-white hover:bg-indigo-700',
        icon: <Crown className="h-3.5 w-3.5" />
      })}
    </div>
  );
};

export default AdminSocialPush;
