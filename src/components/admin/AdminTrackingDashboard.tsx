import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity,
    BookOpen,
    Briefcase,
    Brain,
    Crown,
    DollarSign,
    HelpCircle,
    MousePointerClick,
    RefreshCcw,
    Search,
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
type ViewKey = 'core' | 'search' | 'copilot' | 'membership';
type SearchSort = 'searchPv' | 'searchUv' | 'emptyRate' | 'lastSearchedAt';

interface FunnelStep {
    stepId: string;
    label: string;
    uv: number;
    pv: number;
    previousConversion: number;
    cumulativeConversion: number;
    dropoffUv: number;
    moduleKey?: string;
    moduleLabel?: string;
    sourceLabel?: string;
    entityId?: string;
    detailUv?: number;
    detailPv?: number;
    metricKind?: string;
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

interface SearchTrendPoint {
    date: string;
    searchPv: number;
    searchUv: number;
    emptyPv: number;
}

interface SearchTermInsight {
    key: string;
    term: string;
    group: string;
    normalized: string | null;
    hash: string | null;
    searchPv: number;
    searchUv: number;
    emptyPv: number;
    emptyRate: number;
    avgResultCount: number;
    lastSearchedAt: string | null;
    guestUv: number;
    loggedInUv: number;
    sampleFilters: string[];
    recentSearches: Array<{
        created_at?: string;
        event_name?: string;
        outcome?: string;
        result_count?: number | null;
    }>;
    suggestion: string;
}

interface SearchInsightsData {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    summary: {
        searchPv: number;
        searchUv: number;
        emptyPv: number;
        emptyRate: number;
        termCount: number;
        emptyTermCount: number;
    };
    terms: SearchTermInsight[];
    trend: SearchTrendPoint[];
    topEmptyTerms: Array<{
        term: string;
        group: string;
        emptyPv: number;
        searchPv: number;
    }>;
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

interface MembershipActivationItem {
    memberType: string;
    activatedUsers: number;
    currentActiveUsers: number;
}

interface DashboardData {
    period?: Period;
    view?: ViewKey;
    dateRange?: {
        label: string;
        timeZone: string;
    };
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
    experienceQuality: {
        searchResultPv: number;
        searchEmptyPv: number;
        apiRequestPv: number;
        apiFailedPv: number;
        apiP95DurationMs: number;
        clientErrorUv: number;
        applicationBlockedPv: number;
    };
    coreFunnels: {
        job: FunnelStep[];
        jobBundle: FunnelStep[];
        corporateEnglish: FunnelStep[];
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
    membershipActivation: {
        activatedUsers: number;
        currentActiveUsers: number;
        byType: MembershipActivationItem[];
    };
}

const VIEW_OPTIONS: { key: ViewKey; label: string; description: string }[] = [
    { key: 'core', label: '核心漏斗', description: '求职链路 + 免费转会员漏斗' },
    { key: 'search', label: '搜索洞察', description: '搜索词、无结果词和供给缺口' },
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
    trial_week_lite: '体验会员（周）',
    club_starter_monthly: 'Club Starter',
    club_go_quarterly: '季度会员',
    quarter_pro_quarterly: 'Pro会员',
    goo_plus_yearly: '年度会员',
    club_half_year: 'Club Member',
    club_annual: 'Club Partner',
};

const MEMBER_TYPE_LABELS: Record<string, string> = {
    trial_week: '体验会员（周）',
    starter: 'Club Starter',
    quarter: '季度会员',
    quarter_pro: 'Pro会员',
    year: '年度会员',
    half_year: 'Club Member',
    annual: 'Club Partner',
};

const FUNNEL_DEFINITIONS: Record<string, string> = {
    landing_home_visit: '首页访问 UV，事件为首页 page_view。',
    jobs_intent: '进入求职意图阶段，包含 Copilot 提交、职位列表访问、职位卡点击。',
    job_detail_view: '进入岗位详情页的 UV。',
    apply_init_click: '点击申请入口的 UV。',
    apply_path_selected: '选择邮箱直申、内推、外链等申请路径的 UV。',
    apply_success_like: '申请成功信号，包含外链跳转、邮箱直申成功、内推提交成功。',
    bundle_visit: '岗位合集详情页访问 UV/PV，以 view_job_bundle 为准。',
    bundle_job_click: '在岗位合集页点击岗位卡片的 UV/PV。',
    bundle_detail_view: '从合集页打开岗位详情弹窗或详情视图的 UV/PV。',
    bundle_apply_click: '在合集链路内点击岗位申请入口的 UV/PV。',
    bundle_apply_success: '合集链路内产生外链跳转、邮箱直申或内推提交的 UV/PV。',
    corporate_english_visit: '外企英语页面访问 UV/PV，包含首页与详情页 page_view。',
    corporate_english_detail_view: '外企英语三个详情页访问汇总 UV/PV，按 CEO访谈、英语面试、外企会议详情访问事件合并。',
    corporate_english_video_play: '外企英语视频播放或打开 UV/PV。腾讯视频 iframe 无法直接读取内部播放状态，前台以已解锁视频打开作为播放信号。',
    corporate_english_clip_play: '外企英语跟读音频播放 UV/PV。',
    corporate_english_ceo_module_view: 'CEO访谈模块曝光 UV/PV，新 module_view 口径，兼容旧 section_view。',
    corporate_english_ceo_detail_view: 'CEO访谈详情页访问 UV/PV，包含锁定详情页访问。',
    corporate_english_ceo_video_play: 'CEO访谈视频播放或打开 UV/PV。',
    corporate_english_ceo_clip_play: 'CEO访谈跟读音频播放 UV/PV。',
    corporate_english_interview_module_view: '英语面试模块曝光 UV/PV，新 module_view 口径，兼容旧 section_view。',
    corporate_english_interview_detail_view: '英语面试详情页访问 UV/PV，包含锁定详情页访问。',
    corporate_english_interview_video_play: '英语面试视频播放或打开 UV/PV。',
    corporate_english_meeting_module_view: '外企会议模块曝光 UV/PV，新 module_view 口径，兼容旧 section_view。',
    corporate_english_meeting_detail_view: '外企会议详情页访问 UV/PV，包含锁定详情页访问。',
    corporate_english_meeting_video_play: '外企会议视频播放或打开 UV/PV。',
    free_feature_exposure: '免费体验功能入口曝光 UV。',
    free_feature_click: '免费体验功能点击 UV。',
    consume_or_limit: '成功消耗免费额度，或触达免费上限的 UV。',
    upgrade_modal_view: '在免费体验链路中触发升级弹窗的 UV。',
    membership_page_view: '沿服务咨询链路进入 Club 权益页的 UV，不等于权益页总访问 UV；总访问请看会员体验里的“Club 权益页”。',
    membership_plan_click: '沿升级链路点击任一会员卡 CTA 的 UV。',
    membership_payment_success: '权益开通确认数据，以记录状态对账。',
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

function formatDateTime(value?: string | null) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
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
    const [searchInsights, setSearchInsights] = useState<SearchInsightsData | null>(null);
    const [searchInsightsLoading, setSearchInsightsLoading] = useState(false);
    const [searchInsightsError, setSearchInsightsError] = useState<string | null>(null);
    const [searchOnlyEmpty, setSearchOnlyEmpty] = useState(false);
    const [searchSort, setSearchSort] = useState<SearchSort>('searchPv');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchPage, setSearchPage] = useState(1);
    const [expandedSearchTerm, setExpandedSearchTerm] = useState<string | null>(null);
    const requestSeqRef = useRef(0);
    const searchRequestSeqRef = useRef(0);

    const fetchData = async ({ preserveData = false }: { preserveData?: boolean } = {}) => {
        const requestSeq = requestSeqRef.current + 1;
        requestSeqRef.current = requestSeq;
        try {
            setLoading(true);
            setError(null);
            if (!preserveData) {
                setData(null);
            }
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const params = new URLSearchParams({
                period,
                segment,
                metricMode,
                view: activeView === 'search' ? 'core' : activeView,
            });
            const res = await fetch(`/api/analytics-stats?${params.toString()}`, { headers });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.error || 'Failed to load analytics dashboard');
            }

            if (requestSeq !== requestSeqRef.current) return;
            setData(json.data);
        } catch (fetchError: any) {
            if (requestSeq !== requestSeqRef.current) return;
            console.error('Failed to fetch analytics:', fetchError);
            setError(fetchError?.message || '数据加载失败');
        } finally {
            if (requestSeq === requestSeqRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchData({ preserveData: false });
    }, [period, segment, metricMode, activeView, token]);

    const fetchSearchInsights = async ({ preserveData = false }: { preserveData?: boolean } = {}) => {
        if (activeView !== 'search') return;
        const requestSeq = searchRequestSeqRef.current + 1;
        searchRequestSeqRef.current = requestSeq;
        try {
            setSearchInsightsLoading(true);
            setSearchInsightsError(null);
            if (!preserveData) {
                setSearchInsights(null);
            }
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            const params = new URLSearchParams({
                period,
                segment,
                sort: searchSort,
                page: String(searchPage),
                limit: '20',
            });
            if (searchOnlyEmpty) params.set('onlyEmpty', 'true');
            if (searchQuery.trim()) params.set('q', searchQuery.trim());
            const response = await fetch(`/api/admin/search-insights?${params.toString()}`, { headers });
            const json = await response.json();
            if (!response.ok || !json.success) {
                throw new Error(json.error || '搜索洞察加载失败');
            }
            if (requestSeq !== searchRequestSeqRef.current) return;
            setSearchInsights(json.data);
        } catch (fetchError: any) {
            if (requestSeq !== searchRequestSeqRef.current) return;
            console.error('Failed to fetch search insights:', fetchError);
            setSearchInsightsError(fetchError?.message || '搜索洞察加载失败');
        } finally {
            if (requestSeq === searchRequestSeqRef.current) {
                setSearchInsightsLoading(false);
            }
        }
    };

    useEffect(() => {
        if (activeView !== 'search') return;
        fetchSearchInsights({ preserveData: false });
    }, [activeView, period, segment, searchOnlyEmpty, searchSort, searchPage, token]);

    useEffect(() => {
        if (activeView !== 'search') return;
        const timer = window.setTimeout(() => {
            setSearchPage(1);
            fetchSearchInsights({ preserveData: true });
        }, 350);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

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
                label: '会员成功用户',
                value: formatNum(data.overview.paymentSuccessUv),
                description: `开通记录 ${formatNum(data.overview.paymentSuccessOrders)} / 状态变更 ${formatNum(data.membershipActivation?.activatedUsers || 0)}`,
                footnote: '权益记录与用户会员状态综合参考',
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
                label: '权益确认用户',
                value: formatNum(data.membershipExperience.summary.paymentCompletedUsers),
                description: '免费体验后完成权益确认的人数',
                footnote: '按 completed 记录对账',
                icon: <Crown className="w-4 h-4 text-amber-600" />,
            },
        ];
    }, [data, metricMode]);

    const experienceQualityCards = useMemo(() => {
        if (!data) return [];
        const quality = data.experienceQuality;
        return [
            {
                label: '搜索无结果率',
                value: formatPercent(quality.searchResultPv > 0 ? quality.searchEmptyPv / quality.searchResultPv : 0),
                description: `无结果 ${formatNum(quality.searchEmptyPv)} / 搜索结果 ${formatNum(quality.searchResultPv)}`,
                footnote: '用于识别搜索供给与筛选体验问题',
                icon: <Search className="w-4 h-4 text-amber-600" />,
            },
            {
                label: '核心接口失败率',
                value: formatPercent(quality.apiRequestPv > 0 ? quality.apiFailedPv / quality.apiRequestPv : 0),
                description: `失败/拦截 ${formatNum(quality.apiFailedPv)} / 请求 ${formatNum(quality.apiRequestPv)}`,
                footnote: `P95 耗时 ${formatNum(quality.apiP95DurationMs)}ms`,
                icon: <Activity className="w-4 h-4 text-rose-600" />,
            },
            {
                label: '前端异常用户',
                value: formatNum(quality.clientErrorUv),
                description: `申请阻断 ${formatNum(quality.applicationBlockedPv)} 次`,
                footnote: '可在用户管理的操作日志中按用户回溯',
                icon: <Target className="w-4 h-4 text-violet-600" />,
            },
        ];
    }, [data]);

    const searchInsightCards = useMemo(() => {
        if (!searchInsights) return [];
        const summary = searchInsights.summary;
        return [
            {
                label: '搜索 UV',
                value: formatNum(summary.searchUv),
                description: `搜索 PV ${formatNum(summary.searchPv)}`,
                footnote: `聚合词 ${formatNum(summary.termCount)} 个`,
                icon: <Users className="w-4 h-4 text-sky-600" />,
            },
            {
                label: '搜索 PV',
                value: formatNum(summary.searchPv),
                description: `${PERIOD_LABELS[period]} · ${SEGMENT_LABELS[segment]}`,
                footnote: '仅统计已通过脱敏校验的搜索词',
                icon: <Search className="w-4 h-4 text-indigo-600" />,
            },
            {
                label: '无结果率',
                value: formatPercent(summary.emptyRate),
                description: `无结果 ${formatNum(summary.emptyPv)} 次`,
                footnote: '用于判断岗位供给和搜索召回问题',
                icon: <Activity className="w-4 h-4 text-amber-600" />,
            },
            {
                label: '无结果词',
                value: formatNum(summary.emptyTermCount),
                description: '至少出现过一次无结果的词组',
                footnote: '优先查看“无结果搜索”列表',
                icon: <Target className="w-4 h-4 text-rose-600" />,
            },
        ];
    }, [period, searchInsights, segment]);

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
                footnote: `权益确认 ${formatNum(data.resumeAssistant.paymentSuccessUv)}`,
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
                            onClick={() => fetchData({ preserveData: true })}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            刷新
                        </button>
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                            <HelpCircle className="h-4 w-4 text-slate-400" />
                            {data?.dateRange
                                ? `${data.dateRange.label} · ${data.dateRange.timeZone} 自然周期；漏斗 UV / PV 按同一链路口径统计`
                                : '漏斗卡片的 UV / PV 均按同一链路口径统计，会员成功参考权益记录与用户会员状态'}
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
                    <Panel
                        title="体验质量"
                        subtitle="搜索、关键接口与申请阻断信号；单个用户的细节请从用户管理中的操作日志查看。"
                        icon={<Activity className="h-5 w-5 text-rose-600" />}
                    >
                        <div className="grid gap-4 lg:grid-cols-3">
                            {experienceQualityCards.map((card) => (
                                <MetricCard key={card.label} {...card} />
                            ))}
                        </div>
                    </Panel>
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
                            title="岗位合集漏斗"
                            subtitle={`${PERIOD_LABELS[period]} · ${SEGMENT_LABELS[segment]} · 合集访问与申请`}
                            icon={<Briefcase className="h-5 w-5 text-sky-600" />}
                        >
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {data.coreFunnels.jobBundle.map((step) => (
                                    <FunnelCard key={step.stepId} step={step} />
                                ))}
                            </div>
                        </Panel>

                        <Panel
                            title="免费转会员漏斗"
                            subtitle="固定统计免费用户；权益页总访问请看会员体验里的“Club 权益页”"
                            icon={<Crown className="h-5 w-5 text-amber-600" />}
                        >
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                {data.coreFunnels.monetization.map((step) => (
                                    <FunnelCard key={step.stepId} step={step} />
                                ))}
                            </div>
                        </Panel>
                    </div>

                    <Panel
                        title="外企英语视频播放"
                        subtitle={`${PERIOD_LABELS[period]} · ${SEGMENT_LABELS[segment]} · 按视频统计播放 UV/PV，兼看详情访问`}
                        icon={<BookOpen className="h-5 w-5 text-violet-600" />}
                    >
                        <CorporateEnglishVideoTable steps={data.coreFunnels.corporateEnglish || []} />
                    </Panel>

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
                            title="会员成功对账"
                            subtitle="权益记录 + 用户会员状态变更，用于覆盖手动处理会员的场景"
                            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
                        >
                            <div className="space-y-3">
                                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-emerald-950">用户会员状态变更</div>
                                            <div className="text-xs text-emerald-700">按会员生效/状态更新时间计入当前周期</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-emerald-950">{formatNum(data.membershipActivation?.activatedUsers || 0)}</div>
                                            <div className="text-xs text-emerald-700">当前有效 {formatNum(data.membershipActivation?.currentActiveUsers || 0)}</div>
                                        </div>
                                    </div>
                                </div>
                                {(data.membershipActivation?.byType || []).map((item) => (
                                    <div key={`member-${item.memberType}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {MEMBER_TYPE_LABELS[item.memberType] || item.memberType}
                                                </div>
                                                <div className="text-xs text-slate-500">{item.memberType}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-slate-900">{formatNum(item.activatedUsers)}</div>
                                                <div className="text-xs text-slate-500">状态变更 / 有效 {formatNum(item.currentActiveUsers)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {data.paymentTruth.length === 0 && (data.membershipActivation?.byType || []).length === 0 && (
                                    <EmptyState text="当前周期暂无会员成功数据" />
                                )}
                                {data.paymentTruth.map((item) => (
                                    <div key={`payment-${item.planId}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">
                                                    {PLAN_LABELS[item.planId] || item.planId}
                                                </div>
                                                <div className="text-xs text-slate-500">{item.planId}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-lg font-bold text-slate-900">{formatNum(item.completedUsers)}</div>
                                                <div className="text-xs text-slate-500">用户数 / 开通记录 {formatNum(item.completedOrders)}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Panel>
                    </div>
                </div>
            )}

            {activeView === 'search' && (
                <div className="space-y-6">
                    <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.22)] xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                            <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
                            <input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="搜索词组，例如 产品经理 / frontend"
                                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={searchOnlyEmpty}
                                    onChange={(event) => {
                                        setSearchOnlyEmpty(event.target.checked);
                                        setSearchPage(1);
                                    }}
                                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                仅看无结果
                            </label>
                            <select
                                value={searchSort}
                                onChange={(event) => {
                                    setSearchSort(event.target.value as SearchSort);
                                    setSearchPage(1);
                                }}
                                className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
                            >
                                <option value="searchPv">按搜索次数</option>
                                <option value="searchUv">按搜索人数</option>
                                <option value="emptyRate">按无结果率</option>
                                <option value="lastSearchedAt">按最近搜索</option>
                            </select>
                            <button
                                onClick={() => fetchSearchInsights({ preserveData: true })}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-200 hover:text-indigo-600"
                            >
                                <RefreshCcw className="h-4 w-4" />
                                刷新搜索
                            </button>
                        </div>
                    </div>

                    {searchInsightsError && (
                        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {searchInsightsError}
                        </div>
                    )}

                    {searchInsightsLoading && !searchInsights ? (
                        <div className="flex h-48 items-center justify-center rounded-[28px] border border-slate-200 bg-white">
                            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                        </div>
                    ) : searchInsights ? (
                        <>
                            <div className="grid gap-4 lg:grid-cols-4">
                                {searchInsightCards.map((card) => (
                                    <MetricCard key={card.label} {...card} />
                                ))}
                            </div>

                            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
                                <Panel
                                    title="热门搜索方向"
                                    subtitle="按规范化词组聚合，同义词已合并；用于判断用户正在关注的岗位方向。"
                                    icon={<Search className="h-5 w-5 text-indigo-600" />}
                                >
                                    <SearchInsightTable
                                        terms={searchInsights.terms}
                                        expandedKey={expandedSearchTerm}
                                        onToggle={(key) => setExpandedSearchTerm(expandedSearchTerm === key ? null : key)}
                                    />
                                    <SearchPagination
                                        page={searchPage}
                                        total={searchInsights.total}
                                        limit={searchInsights.limit}
                                        hasMore={searchInsights.hasMore}
                                        onPageChange={setSearchPage}
                                    />
                                </Panel>

                                <Panel
                                    title="无结果搜索"
                                    subtitle="优先关注高频且无结果率高的词，用于补岗位、调召回或检查标签。"
                                    icon={<Target className="h-5 w-5 text-rose-600" />}
                                >
                                    <div className="space-y-3">
                                        {searchInsights.topEmptyTerms.length === 0 && (
                                            <EmptyState text="当前周期暂无无结果搜索词" />
                                        )}
                                        {searchInsights.topEmptyTerms.map((item, index) => (
                                            <div key={`${item.group}-${index}`} className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="font-semibold text-slate-900">{item.term}</div>
                                                        <div className="mt-1 text-xs text-slate-500">{item.group}</div>
                                                    </div>
                                                    <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-rose-600">
                                                        无结果 {formatNum(item.emptyPv)}
                                                    </div>
                                                </div>
                                                <div className="mt-3 text-xs text-slate-500">
                                                    总搜索 {formatNum(item.searchPv)} 次，建议优先检查岗位供给和标签召回。
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </Panel>
                            </div>

                            <Panel
                                title="搜索趋势"
                                subtitle="搜索 PV 与无结果 PV 的每日变化，可用于观察运营活动或岗位供给调整后的变化。"
                                icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
                            >
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={searchInsights.trend} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
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
                                                formatter={(value: any, name?: string) => [
                                                    value,
                                                    name === 'emptyPv' ? '无结果 PV' : name === 'searchUv' ? '搜索 UV' : '搜索 PV',
                                                ]}
                                                contentStyle={{ borderRadius: '16px', borderColor: '#e2e8f0' }}
                                            />
                                            <Line type="monotone" dataKey="searchPv" stroke="#4f46e5" strokeWidth={3} dot={false} />
                                            <Line type="monotone" dataKey="searchUv" stroke="#0ea5e9" strokeWidth={2} dot={false} />
                                            <Line type="monotone" dataKey="emptyPv" stroke="#f97316" strokeWidth={2} dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </Panel>
                        </>
                    ) : (
                        <EmptyState text="暂无搜索洞察数据" />
                    )}
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
                                { label: '权益确认 UV', value: data.resumeAssistant.paymentSuccessUv, note: '后续完成权益确认的人数' },
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
                                        <th className="px-4 py-3 text-right font-medium text-slate-500">权益咨询 UV</th>
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

function CorporateEnglishSummaryCard({ step }: { step: FunnelStep }) {
    const tone = step.stepId.includes('_detail_view')
        ? 'bg-sky-50 text-sky-700 border-sky-100'
        : step.stepId.includes('_video_play')
            ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
            : step.stepId.includes('_clip_play')
                ? 'bg-amber-50 text-amber-700 border-amber-100'
                : 'bg-violet-50 text-violet-700 border-violet-100';
    const tag = step.stepId.includes('_detail_view')
        ? '详情'
        : step.stepId.includes('_video_play')
            ? '播放'
            : step.stepId.includes('_clip_play')
                ? '跟读'
                : '访问';
    return (
        <div
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.25)]"
            title={FUNNEL_DEFINITIONS[step.stepId] || step.label}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="truncate text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{step.stepId}</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">{step.label}</div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>{tag}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-400">UV</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{formatNum(step.uv)}</div>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="text-xs text-slate-400">PV</div>
                    <div className="mt-1 text-xl font-bold text-slate-900">{formatNum(step.pv)}</div>
                </div>
            </div>
        </div>
    );
}

function CorporateEnglishVideoTable({ steps }: { steps: FunnelStep[] }) {
    const summarySteps = steps.filter((step) => step.metricKind !== 'video_play');
    const videoSteps = steps.filter((step) => step.metricKind === 'video_play');

    if (!steps.length) {
        return <EmptyState text="当前筛选下暂无外企英语统计数据" />;
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {summarySteps.map((step) => (
                    <CorporateEnglishSummaryCard key={step.stepId} step={step} />
                ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                        <div className="text-sm font-semibold text-slate-900">视频播放排行</div>
                        <div className="mt-0.5 text-xs text-slate-500">按播放 UV、播放 PV 排序；最多展示前 12 条</div>
                    </div>
                    <div className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                        {formatNum(videoSteps.length)} 条视频
                    </div>
                </div>

                {videoSteps.length ? (
                    <div className="max-h-[460px] overflow-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="sticky top-0 z-10 bg-slate-50/95 text-left text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 backdrop-blur">
                                <tr>
                                    <th className="px-4 py-3">视频</th>
                                    <th className="px-4 py-3">模块</th>
                                    <th className="px-4 py-3 text-right">播放 UV</th>
                                    <th className="px-4 py-3 text-right">播放 PV</th>
                                    <th className="px-4 py-3 text-right">详情 UV</th>
                                    <th className="px-4 py-3 text-right">详情 PV</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {videoSteps.map((step, index) => (
                                    <tr key={step.stepId} className="hover:bg-slate-50">
                                        <td className="max-w-[360px] px-4 py-3">
                                            <div className="flex items-start gap-3">
                                                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="line-clamp-2 font-semibold leading-snug text-slate-900">{step.label}</div>
                                                    <div className="mt-1 truncate text-xs text-slate-500">{step.sourceLabel || step.entityId || '外企英语'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                                {step.moduleLabel || '外企英语'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNum(step.uv)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{formatNum(step.pv)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{formatNum(step.detailUv || 0)}</td>
                                        <td className="px-4 py-3 text-right text-slate-700">{formatNum(step.detailPv || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState text="当前筛选下暂无视频播放数据" />
                )}
            </div>
        </div>
    );
}

function SearchInsightTable({
    terms,
    expandedKey,
    onToggle,
}: {
    terms: SearchTermInsight[];
    expandedKey: string | null;
    onToggle: (key: string) => void;
}) {
    if (!terms.length) {
        return <EmptyState text="当前筛选下暂无搜索词数据" />;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">搜索词组</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">搜索 PV</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">UV</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">无结果率</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">平均结果</th>
                        <th className="px-4 py-3 text-left font-medium text-slate-500">建议</th>
                        <th className="px-4 py-3 text-right font-medium text-slate-500">最近搜索</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                    {terms.map((term) => {
                        const isExpanded = expandedKey === term.key;
                        return (
                            <React.Fragment key={term.key}>
                                <tr
                                    className="cursor-pointer hover:bg-slate-50"
                                    onClick={() => onToggle(term.key)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="font-semibold text-slate-900">{term.term}</div>
                                        <div className="mt-1 text-xs text-slate-500">
                                            {term.normalized || term.group}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatNum(term.searchPv)}</td>
                                    <td className="px-4 py-3 text-right text-slate-600">{formatNum(term.searchUv)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${term.emptyRate >= 0.5
                                            ? 'bg-rose-50 text-rose-600'
                                            : term.emptyRate > 0
                                                ? 'bg-amber-50 text-amber-600'
                                                : 'bg-emerald-50 text-emerald-600'
                                            }`}>
                                            {formatPercent(term.emptyRate)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600">{term.avgResultCount.toFixed(1)}</td>
                                    <td className="px-4 py-3">
                                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${term.suggestion === '补岗位'
                                            ? 'bg-rose-50 text-rose-600'
                                            : term.suggestion === '调搜索'
                                                ? 'bg-amber-50 text-amber-600'
                                                : term.suggestion === '检查标签'
                                                    ? 'bg-sky-50 text-sky-600'
                                                    : 'bg-slate-100 text-slate-500'
                                            }`}>
                                            {term.suggestion}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500">{formatDateTime(term.lastSearchedAt)}</td>
                                </tr>
                                {isExpanded && (
                                    <tr>
                                        <td colSpan={7} className="bg-slate-50 px-4 py-4">
                                            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">用户分布</div>
                                                    <div className="mt-3 grid grid-cols-2 gap-3">
                                                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                            <div className="text-xs text-slate-400">游客 UV</div>
                                                            <div className="mt-1 text-lg font-bold text-slate-900">{formatNum(term.guestUv)}</div>
                                                        </div>
                                                        <div className="rounded-xl bg-slate-50 px-3 py-2">
                                                            <div className="text-xs text-slate-400">登录 UV</div>
                                                            <div className="mt-1 text-lg font-bold text-slate-900">{formatNum(term.loggedInUv)}</div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">关联筛选项</div>
                                                    <div className="mt-2 flex flex-wrap gap-2">
                                                        {term.sampleFilters.length === 0 ? (
                                                            <span className="text-xs text-slate-400">暂无筛选项记录</span>
                                                        ) : term.sampleFilters.map((filter, index) => (
                                                            <span key={`${filter}-${index}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                                                {filter}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">最近事件</div>
                                                    <div className="mt-3 space-y-2">
                                                        {term.recentSearches.length === 0 ? (
                                                            <div className="text-xs text-slate-400">暂无最近事件</div>
                                                        ) : term.recentSearches.map((event, index) => (
                                                            <div key={`${event.created_at}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-800">{event.event_name || 'search_event'}</div>
                                                                    <div className="text-xs text-slate-400">{formatDateTime(event.created_at)}</div>
                                                                </div>
                                                                <div className="text-right text-xs text-slate-500">
                                                                    <div>{event.outcome || 'succeeded'}</div>
                                                                    <div>结果 {event.result_count ?? '-'}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function SearchPagination({
    page,
    total,
    limit,
    hasMore,
    onPageChange,
}: {
    page: number;
    total: number;
    limit: number;
    hasMore: boolean;
    onPageChange: (page: number) => void;
}) {
    if (total <= limit && page <= 1) return null;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
            <button
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
                上一页
            </button>
            <span className="text-slate-500">
                {page} / {totalPages}
            </span>
            <button
                onClick={() => onPageChange(page + 1)}
                disabled={!hasMore}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
                下一页
            </button>
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
