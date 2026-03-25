import React, { useEffect, useMemo, useState } from 'react';
import {
    Activity,
    Brain,
    Crown,
    DollarSign,
    HelpCircle,
    MousePointerClick,
    RefreshCcw,
    Target,
    TrendingUp,
    Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

type Period = 'day' | 'week' | 'month';
type Segment = 'all' | 'guest' | 'free' | 'member';
type MetricMode = 'total' | 'per_capita';
type ViewKey = 'core' | 'copilot' | 'membership';

interface FunnelStep {
    stepId: string;
    label: string;
    uv: number;
    pv: number;
    previousConversion: number;
    cumulativeConversion: number;
    dropoffUv: number;
}

interface CopilotItem {
    label: string;
    uv: number;
    pv: number;
}

interface CopilotMatrixItem {
    jobDirection: string;
    positionType: string;
    uv: number;
    pv: number;
}

interface TrendPoint {
    date: string;
    uv: number;
    pv: number;
}

interface CopilotTrendPoint {
    date: string;
    submitUv: number;
    submitPv: number;
}

interface MembershipFeature {
    featureKey: string;
    label: string;
    exposureUv: number;
    clickUv: number;
    clickPv: number;
    consumePv: number;
    successUv: number;
    limitReachedUv: number;
    upgradeModalUv: number;
    upgradeCtaUv: number;
    payClickUv: number;
    payClickPv: number;
    avgClicksPerExposedUser: number;
    avgClicksPerClickUser: number;
    displayValue: number;
}

interface PaymentTruthItem {
    planId: string;
    completedOrders: number;
    completedUsers: number;
}

interface DashboardData {
    overview: {
        totalUv: number;
        totalPv: number;
        guestUv: number;
        freeUv: number;
        memberUv: number;
        copilotSubmitUv: number;
        paymentSuccessUv: number;
        paymentSuccessOrders: number;
        metricMode: MetricMode;
        segment: Segment;
    };
    coreFunnels: {
        job: FunnelStep[];
        monetization: FunnelStep[];
    };
    copilotDemand: {
        summary: {
            submitUv: number;
            submitPv: number;
            successUv: number;
            guestUv: number;
            loggedInUv: number;
            withResumeUv: number;
        };
        topDirections: CopilotItem[];
        positionTypes: CopilotItem[];
        matrix: CopilotMatrixItem[];
        trend: CopilotTrendPoint[];
    };
    membershipExperience: {
        summary: {
            exposureUv: number;
            clickUv: number;
            clickPv: number;
            paymentCompletedUsers: number;
        };
        features: MembershipFeature[];
    };
    resumeAssistant: {
        openUv: number;
        frameworkClickUv: number;
        frameworkClickPv: number;
        frameworkSuccessUv: number;
        refreshUv: number;
        interviewUv: number;
        upgradeModalUv: number;
        upgradeClickUv: number;
        polishUv: number;
        mockAnswerUv: number;
        paymentSuccessUv: number;
    };
    trend: TrendPoint[];
    paymentTruth: PaymentTruthItem[];
}

const VIEW_OPTIONS: { key: ViewKey; label: string; description: string }[] = [
    { key: 'core', label: '核心漏斗', description: '求职链路 + 免费转会员漏斗' },
    { key: 'copilot', label: 'Copilot需求', description: '岗位方向与类型需求洞察' },
    { key: 'membership', label: '会员体验', description: '免费功能体验与付费转化' },
];

const SEGMENT_LABELS: Record<Segment, string> = {
    all: '全部用户',
    guest: '游客',
    free: '免费用户',
    member: '会员',
};

const PLAN_LABELS: Record<string, string> = {
    trial_week_lite: '体验会员卡',
    club_go_quarterly: '季度会员卡',
    goo_plus_yearly: '年度会员卡',
};

const FUNNEL_DEFINITIONS: Record<string, string> = {
    landing_home_visit: '首页访问 UV，事件为首页 page_view。',
    jobs_intent: '进入求职意图阶段，包含 Copilot 提交、职位列表访问、职位卡点击。',
    job_detail_view: '进入岗位详情页的 UV。',
    apply_init_click: '点击申请入口的 UV。',
    apply_path_selected: '选择邮箱直申、内推、外链等申请路径的 UV。',
    apply_success_like: '申请成功信号，包含外链跳转、邮箱直申成功、内推提交成功。',
    free_feature_exposure: '免费体验功能入口曝光 UV。',
    free_feature_click: '免费体验功能点击 UV。',
    consume_or_limit: '成功消耗免费额度，或触达免费上限的 UV。',
    upgrade_modal_view: '升级弹窗曝光 UV。',
    membership_page_view: '进入会员中心页 UV。',
    membership_plan_click: '点击任一会员卡 CTA 的 UV。',
    membership_payment_success: '支付完成真值，以 payment_records.completed 对账。',
};

const PERIOD_LABELS: Record<Period, string> = {
    day: '今日',
    week: '本周',
    month: '本月',
};

function formatNum(value: number) {
    return Number(value || 0).toLocaleString();
}

function formatPercent(value: number) {
    return `${((value || 0) * 100).toFixed(1)}%`;
}

function formatCompact(value: number, metricMode: MetricMode) {
    if (metricMode === 'per_capita') {
        return `${(value || 0).toFixed(2)}`;
    }
    return formatNum(value);
}

function formatDateLabel(value: string) {
    const date = new Date(value);
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default function AdminTrackingDashboard() {
    const { token } = useAuth();
    const [period, setPeriod] = useState<Period>('week');
    const [segment, setSegment] = useState<Segment>('all');
    const [metricMode, setMetricMode] = useState<MetricMode>('total');
    const [activeView, setActiveView] = useState<ViewKey>('core');
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DashboardData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setLoading(true);
            setError(null);
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const params = new URLSearchParams({
                period,
                segment,
                metricMode,
                view: activeView,
            });
            const res = await fetch(`/api/analytics-stats?${params.toString()}`, { headers });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to load analytics dashboard');
            }

            setData(json.data);
        } catch (fetchError: any) {
            console.error('Failed to fetch analytics:', fetchError);
            setError(fetchError?.message || '数据加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [period, segment, metricMode, activeView, token]);

    const overviewCards = useMemo(() => {
        if (!data) return [];
        return [
            {
                label: '活跃用户 UV',
                value: formatNum(data.overview.totalUv),
                description: `PV ${formatNum(data.overview.totalPv)}，当前筛选：${SEGMENT_LABELS[segment]}`,
                footnote: `游客 ${formatNum(data.overview.guestUv)} / 免费 ${formatNum(data.overview.freeUv)} / 会员 ${formatNum(data.overview.memberUv)}`,
                icon: <Users className="w-4 h-4 text-sky-600" />,
            },
            {
                label: 'Copilot 提交 UV',
                value: formatNum(data.overview.copilotSubmitUv),
                description: '首页 Hero 需求输入去重人数',
                footnote: `覆盖率 ${formatPercent(data.overview.totalUv > 0 ? data.overview.copilotSubmitUv / data.overview.totalUv : 0)}`,
                icon: <Brain className="w-4 h-4 text-violet-600" />,
            },
            {
                label: '支付完成用户',
                value: formatNum(data.overview.paymentSuccessUv),
                description: `支付订单 ${formatNum(data.overview.paymentSuccessOrders)}`,
                footnote: '以后端 completed 订单为准',
                icon: <DollarSign className="w-4 h-4 text-emerald-600" />,
            },
        ];
    }, [data, segment]);

    const membershipSummaryCards = useMemo(() => {
        if (!data) return [];
        return [
            {
                label: '免费功能曝光 UV',
                value: formatNum(data.membershipExperience.summary.exposureUv),
                description: '仅统计免费用户',
                footnote: '分母为免费功能曝光 UV',
                icon: <MousePointerClick className="w-4 h-4 text-blue-600" />,
            },
            {
                label: metricMode === 'per_capita' ? '人均点击次数' : '功能点击 PV',
                value: formatCompact(
                    metricMode === 'per_capita'
                        ? (data.membershipExperience.summary.exposureUv > 0
                            ? data.membershipExperience.summary.clickPv / data.membershipExperience.summary.exposureUv
                            : 0)
                        : data.membershipExperience.summary.clickPv,
                    metricMode
                ),
                description: metricMode === 'per_capita' ? '点击 PV / 曝光 UV' : '免费体验功能点击总次数',
                footnote: `点击 UV ${formatNum(data.membershipExperience.summary.clickUv)}`,
                icon: <Target className="w-4 h-4 text-fuchsia-600" />,
            },
            {
                label: '支付完成用户',
                value: formatNum(data.membershipExperience.summary.paymentCompletedUsers),
                description: '免费体验后进入支付完成的人数',
                footnote: '按 completed 订单对账',
                icon: <Crown className="w-4 h-4 text-amber-600" />,
            },
        ];
    }, [data, metricMode]);

    const copilotSummaryCards = useMemo(() => {
        if (!data) return [];
        const summary = data.copilotDemand.summary;
        return [
            {
                label: 'Copilot 输入 UV',
                value: formatNum(summary.submitUv),
                description: `提交 PV ${formatNum(summary.submitPv)}`,
                footnote: '包含游客与登录用户',
                icon: <Brain className="w-4 h-4 text-violet-600" />,
            },
            {
                label: '结果成功 UV',
                value: formatNum(summary.successUv),
                description: '返回推荐岗位结果的用户数',
                footnote: `成功率 ${formatPercent(summary.submitUv > 0 ? summary.successUv / summary.submitUv : 0)}`,
                icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
            },
            {
                label: '登录占比',
                value: formatPercent(summary.submitUv > 0 ? summary.loggedInUv / summary.submitUv : 0),
                description: `游客 ${formatNum(summary.guestUv)} / 登录 ${formatNum(summary.loggedInUv)}`,
                footnote: `带简历输入 ${formatNum(summary.withResumeUv)}`,
                icon: <Users className="w-4 h-4 text-sky-600" />,
            },
        ];
    }, [data]);

    const resumeAssistantCards = useMemo(() => {
        if (!data) return [];
        return [
            {
                label: '框架生成 UV',
                value: formatNum(data.resumeAssistant.frameworkSuccessUv),
                description: `点击 UV ${formatNum(data.resumeAssistant.frameworkClickUv)} / PV ${formatNum(data.resumeAssistant.frameworkClickPv)}`,
                footnote: `访问 UV ${formatNum(data.resumeAssistant.openUv)} / 刷新 UV ${formatNum(data.resumeAssistant.refreshUv)}`,
                icon: <Brain className="w-4 h-4 text-violet-600" />,
            },
            {
                label: '深度打磨 UV',
                value: formatNum(data.resumeAssistant.polishUv),
                description: `英文面试拓展 ${formatNum(data.resumeAssistant.interviewUv)} / 模拟回答 ${formatNum(data.resumeAssistant.mockAnswerUv)}`,
                footnote: '固定统计免费用户触发的体验与升级引导',
                icon: <Target className="w-4 h-4 text-sky-600" />,
            },
            {
                label: '升级引导 UV',
                value: formatNum(data.resumeAssistant.upgradeClickUv),
                description: `锁卡曝光 ${formatNum(data.resumeAssistant.upgradeModalUv)}`,
                footnote: `支付完成 ${formatNum(data.resumeAssistant.paymentSuccessUv)}`,
                icon: <Crown className="w-4 h-4 text-amber-600" />,
            },
        ];
    }, [data]);

    if (loading && !data) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.28)]">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-slate-900">
                            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                                <Activity className="h-5 w-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">核心数据看板</h2>
                                <p className="text-sm text-slate-500">统一查看求职主漏斗、Copilot 需求与免费转会员链路</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={fetchData}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            刷新
                        </button>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            <HelpCircle className="h-4 w-4 text-slate-400" />
                            漏斗展示 UV，转化率按上一步 UV 计算，会员支付以后端 completed 为准
                        </div>
                    </div>
                </div>

                <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="inline-flex rounded-2xl bg-slate-100 p-1">
                        {VIEW_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                onClick={() => setActiveView(option.key)}
                                className={`rounded-2xl px-4 py-2 text-sm font-medium transition-all ${activeView === option.key
                                        ? 'bg-white text-indigo-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-900'
                                    }`}
                                title={option.description}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <SegmentedControl
                            value={period}
                            onChange={(value) => setPeriod(value as Period)}
                            options={[
                                { value: 'day', label: '今日' },
                                { value: 'week', label: '本周' },
                                { value: 'month', label: '本月' },
                            ]}
                        />
                        <SegmentedControl
                            value={segment}
                            onChange={(value) => setSegment(value as Segment)}
                            options={[
                                { value: 'all', label: '全部' },
                                { value: 'guest', label: '游客' },
                                { value: 'free', label: '免费' },
                                { value: 'member', label: '会员' },
                            ]}
                        />
                        <SegmentedControl
                            value={metricMode}
                            onChange={(value) => setMetricMode(value as MetricMode)}
                            options={[
                                { value: 'total', label: '总数' },
                                { value: 'per_capita', label: '人均' },
                            ]}
                        />
                    </div>
                </div>
            </section>

            {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </div>
            )}

            <div className="grid gap-4 lg:grid-cols-3">
                {overviewCards.map((card) => (
                    <MetricCard key={card.label} {...card} />
                ))}
            </div>

            {activeView === 'core' && data && (
                <div className="space-y-6">
                    <div className="grid gap-6 xl:grid-cols-2">
                        <Panel
                            title="求职主漏斗"
                            subtitle={`${PERIOD_LABELS[period]} · ${SEGMENT_LABELS[segment]} · 真实申请链路`}
                            icon={<Target className="h-5 w-5 text-indigo-600" />}
                        >
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {data.coreFunnels.job.map((step) => (
                                    <FunnelCard key={step.stepId} step={step} />
                                ))}
                            </div>
                        </Panel>

                        <Panel
                            title="免费转会员漏斗"
                            subtitle="固定统计免费用户，查看免费体验到支付完成的流转"
                            icon={<Crown className="h-5 w-5 text-amber-600" />}
                        >
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {data.coreFunnels.monetization.map((step) => (
                                    <FunnelCard key={step.stepId} step={step} />
                                ))}
                            </div>
                        </Panel>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
                        <Panel
                            title="访问趋势"
                            subtitle="UV 趋势可辅助判断漏斗异常是否来自流量波动"
                            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                        >
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatDateLabel}
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                            formatter={(value: any, name?: string) => [value, name === 'uv' ? 'UV' : 'PV']}
                                            contentStyle={{ borderRadius: '16px', borderColor: '#e2e8f0' }}
                                        />
                                        <Line type="monotone" dataKey="uv" stroke="#4f46e5" strokeWidth={3} dot={false} />
                                        <Line type="monotone" dataKey="pv" stroke="#14b8a6" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>

                        <Panel
                            title="支付真值对账"
                            subtitle="会员支付以 payment_records.completed 为唯一真值"
                            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
                        >
                            <div className="space-y-3">
                                {data.paymentTruth.length === 0 && (
                                    <EmptyState text="当前周期暂无支付完成订单" />
                                )}
                                {data.paymentTruth.map((item) => (
                                    <div key={item.planId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {PLAN_LABELS[item.planId] || item.planId}
                                                </div>
                                                <div className="text-xs text-slate-500">{item.planId}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-slate-900">{formatNum(item.completedUsers)}</div>
                                                <div className="text-xs text-slate-500">用户数 / 订单 {formatNum(item.completedOrders)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            {activeView === 'copilot' && data && (
                <div className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {copilotSummaryCards.map((card) => (
                            <MetricCard key={card.label} {...card} />
                        ))}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        <Panel
                            title="岗位方向 Top 榜"
                            subtitle="帮助反推岗位供给与运营投放方向"
                            icon={<Brain className="h-5 w-5 text-violet-600" />}
                        >
                            <RankList items={data.copilotDemand.topDirections} emptyText="当前暂无方向输入数据" />
                        </Panel>

                        <Panel
                            title="岗位类型分布"
                            subtitle="观察全职 / 兼职 / 实习等类型需求"
                            icon={<Target className="h-5 w-5 text-sky-600" />}
                        >
                            <RankList items={data.copilotDemand.positionTypes} emptyText="当前暂无岗位类型数据" />
                        </Panel>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                        <Panel
                            title="方向 x 类型矩阵"
                            subtitle="高频组合可直接指导岗位拓展优先级"
                            icon={<MousePointerClick className="h-5 w-5 text-indigo-600" />}
                        >
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-slate-200 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-medium text-slate-500">岗位方向</th>
                                            <th className="px-4 py-3 text-left font-medium text-slate-500">岗位类型</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-500">UV</th>
                                            <th className="px-4 py-3 text-right font-medium text-slate-500">PV</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {data.copilotDemand.matrix.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">暂无数据</td>
                                            </tr>
                                        )}
                                        {data.copilotDemand.matrix.map((item, index) => (
                                            <tr key={`${item.jobDirection}-${item.positionType}-${index}`} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-medium text-slate-900">{item.jobDirection}</td>
                                                <td className="px-4 py-3 text-slate-600">{item.positionType}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatNum(item.uv)}</td>
                                                <td className="px-4 py-3 text-right text-slate-600">{formatNum(item.pv)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </Panel>

                        <Panel
                            title="Copilot 输入趋势"
                            subtitle="观察需求波动与输入量稳定性"
                            icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                        >
                            <div className="h-[280px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={data.copilotDemand.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={formatDateLabel}
                                            tick={{ fontSize: 12, fill: '#64748b' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                        <Tooltip
                                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                            formatter={(value: any, name?: string) => [value, name === 'submitUv' ? '提交 UV' : '提交 PV']}
                                            contentStyle={{ borderRadius: '16px', borderColor: '#e2e8f0' }}
                                        />
                                        <Line type="monotone" dataKey="submitUv" stroke="#7c3aed" strokeWidth={3} dot={false} />
                                        <Line type="monotone" dataKey="submitPv" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            {activeView === 'membership' && data && (
                <div className="space-y-6">
                    <div className="grid gap-4 lg:grid-cols-3">
                        {membershipSummaryCards.map((card) => (
                            <MetricCard key={card.label} {...card} />
                        ))}
                    </div>

                    <div className="grid gap-4 lg:grid-cols-3">
                        {resumeAssistantCards.map((card) => (
                            <MetricCard key={card.label} {...card} />
                        ))}
                    </div>

                    <Panel
                        title="简历助手需求与会员引导"
                        subtitle="看免费用户从生成框架到点击升级的关键行为，便于评估简历助手价值与会员引导效率。"
                        icon={<Brain className="h-5 w-5 text-violet-600" />}
                    >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {[
                                { label: '访问 UV', value: data.resumeAssistant.openUv, note: '进入简历助手的免费用户' },
                                { label: '框架生成 UV', value: data.resumeAssistant.frameworkSuccessUv, note: '成功生成双模块框架' },
                                { label: '刷新 UV', value: data.resumeAssistant.refreshUv, note: '免费用户再次查看建议' },
                                { label: '深度打磨 UV', value: data.resumeAssistant.polishUv, note: '会员深度打磨点击' },
                                { label: '英文面试拓展 UV', value: data.resumeAssistant.interviewUv, note: '继续扩展英文面试题' },
                                { label: '模拟回答 UV', value: data.resumeAssistant.mockAnswerUv, note: '生成双语模拟回答' },
                                { label: '锁卡曝光 UV', value: data.resumeAssistant.upgradeModalUv, note: '免费用户看到会员引导' },
                                { label: '升级点击 UV', value: data.resumeAssistant.upgradeClickUv, note: '从简历助手触发升级' },
                                { label: '支付完成 UV', value: data.resumeAssistant.paymentSuccessUv, note: '后续完成支付的人数' },
                            ].map((item) => (
                                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                                    <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-400">{item.label}</div>
                                    <div className="mt-2 text-2xl font-bold text-slate-900">{formatNum(item.value)}</div>
                                    <div className="mt-1 text-xs text-slate-500">{item.note}</div>
                                </div>
                            ))}
                        </div>
                    </Panel>

                    <Panel
                        title="会员体验功能表现"
                        subtitle={`统计模式：${metricMode === 'per_capita' ? '人均' : '总数'}。会员体验看板固定统计免费用户 UUID 级事件流。`}
                        icon={<Crown className="h-5 w-5 text-amber-600" />}
                    >
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200 text-sm">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-slate-500">功能</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">曝光 UV</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">点击 PV</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">点击 UV</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">
                                            {metricMode === 'per_capita' ? '人均点击' : '额度消耗 PV'}
                                        </th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">触顶 UV</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">升级弹窗 UV</th>
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">支付点击 UV</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {data.membershipExperience.features.length === 0 && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-8 text-center text-slate-400">暂无免费体验事件数据</td>
                                        </tr>
                                    )}
                                    {data.membershipExperience.features.map((feature) => (
                                        <tr key={feature.featureKey} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <div className="font-medium text-slate-900">{feature.label}</div>
                                                <div className="text-xs text-slate-500">{feature.featureKey}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNum(feature.exposureUv)}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNum(feature.clickPv)}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNum(feature.clickUv)}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">
                                                {metricMode === 'per_capita'
                                                    ? feature.avgClicksPerExposedUser.toFixed(2)
                                                    : formatNum(feature.consumePv)}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNum(feature.limitReachedUv)}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNum(feature.upgradeModalUv)}</td>
                                            <td className="px-4 py-3 text-right text-slate-600">{formatNum(feature.payClickUv)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>
                </div>
            )}

            {loading && data && (
                <div className="fixed bottom-6 right-6 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 shadow-lg">
                    正在刷新数据...
                </div>
            )}
        </div>
    );
}

function Panel({
    title,
    subtitle,
    icon,
    children,
}: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-24px_rgba(15,23,42,0.22)]">
            <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2 text-slate-900">
                        {icon}
                        <h3 className="text-lg font-bold">{title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function MetricCard({
    label,
    value,
    description,
    footnote,
    icon,
}: {
    label: string;
    value: string;
    description: string;
    footnote: string;
    icon: React.ReactNode;
}) {
    return (
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-18px_rgba(15,23,42,0.22)]">
            <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500">{label}</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-50">{icon}</div>
            </div>
            <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
            <div className="mt-2 text-sm text-slate-600">{description}</div>
            <div className="mt-3 text-xs text-slate-400">{footnote}</div>
        </div>
    );
}

function FunnelCard({ step }: { step: FunnelStep }) {
    return (
        <div
            className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4 transition-colors hover:border-indigo-200 hover:bg-white"
            title={FUNNEL_DEFINITIONS[step.stepId] || step.label}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{step.stepId}</div>
                    <div className="mt-1 text-base font-semibold text-slate-900">{step.label}</div>
                </div>
                <HelpCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-300" />
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
                <div>
                    <div className="text-3xl font-bold text-slate-900">{formatNum(step.uv)}</div>
                    <div className="mt-1 text-xs text-slate-500">UV {formatNum(step.uv)} / PV {formatNum(step.pv)}</div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
                    <div className="text-[11px] text-slate-400">上一步转化</div>
                    <div className="text-sm font-semibold text-slate-900">{formatPercent(step.previousConversion)}</div>
                </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <div className="text-slate-400">累计转化</div>
                    <div className="mt-1 font-semibold text-slate-700">{formatPercent(step.cumulativeConversion)}</div>
                </div>
                <div className="rounded-2xl bg-white px-3 py-2 shadow-sm">
                    <div className="text-slate-400">流失人数</div>
                    <div className="mt-1 font-semibold text-slate-700">{formatNum(step.dropoffUv)}</div>
                </div>
            </div>
        </div>
    );
}

function RankList({ items, emptyText }: { items: CopilotItem[]; emptyText: string }) {
    const maxUv = Math.max(...items.map((item) => item.uv), 1);

    if (!items.length) {
        return <EmptyState text={emptyText} />;
    }

    return (
        <div className="space-y-3">
            {items.map((item, index) => (
                <div key={`${item.label}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-500 shadow-sm">
                                {index + 1}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">{item.label}</div>
                                <div className="text-xs text-slate-500">PV {formatNum(item.pv)}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-slate-900">{formatNum(item.uv)}</div>
                            <div className="text-xs text-slate-400">UV</div>
                        </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                        <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
                            style={{ width: `${Math.max((item.uv / maxUv) * 100, 8)}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return (
        <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-400">
            {text}
        </div>
    );
}

function SegmentedControl({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`rounded-2xl px-3 py-2 text-sm font-medium transition-all ${value === option.value
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
