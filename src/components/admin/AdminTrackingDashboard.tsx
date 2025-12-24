
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MousePointer, 
  Target, 
  TrendingUp, 
  Calendar,
  ArrowRight,
  RefreshCcw,
  Activity,
  CreditCard,
  FileText,
  Heart
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface DashboardData {
  funnel: { event: string; uv: number; pv: number }[];
  pages: { name: string; uv: number; pv: number }[];
  metrics: {
    totalUV: number;
    registrationRate: number;
    avgJobViews: number;
    applyConversion: number;
    favoriteRate: number;
    memberApplyRate: number;
    retention: { day1: number; day7: number; day30: number };
  };
  trend: { date: string; uv: number; pv: number }[];
}

export default function AdminTrackingDashboard() {
  const { token } = useAuth();
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/analytics-stats?period=${period}`, { headers });
      const json = await res.json();
      
      if (json.success) {
        setData(json.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatNum = (val: number) => val.toLocaleString();

  // Simple SVG Line Chart Component
  const SimpleLineChart = ({ data, dataKey, color }: { data: any[], dataKey: string, color: string }) => {
    if (!data || data.length === 0) return <div className="h-32 flex items-center justify-center text-slate-400">暂无数据</div>;
    
    const height = 100;
    const width = 100; // percent
    const maxVal = Math.max(...data.map(d => Number(d[dataKey]) || 0), 1);
    
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - ((Number(d[dataKey]) || 0) / maxVal) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative h-32 w-full overflow-hidden">
             <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Grid lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="#e2e8f0" strokeWidth="0.5" strokeDasharray="2" />
                
                {/* Line */}
                <polyline
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    points={points}
                    vectorEffect="non-scaling-stroke"
                />
             </svg>
             {/* Tooltip hint could go here but skipping for simplicity */}
        </div>
    );
  };

  if (loading && !data) {
    return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800">核心数据看板</h2>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
            {(['day', 'week', 'month'] as const).map(p => (
                <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                        period === p 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                >
                    {p === 'day' ? '今日' : p === 'week' ? '本周' : '本月'}
                </button>
            ))}
            <button onClick={fetchData} className="ml-2 p-1.5 text-slate-400 hover:text-indigo-600">
                <RefreshCcw className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* 1. Key Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard 
            label="活跃用户 (UV)" 
            value={formatNum(data?.metrics.totalUV || 0)} 
            icon={<Users className="w-4 h-4 text-blue-500" />} 
            trend="+0%" 
        />
        <MetricCard 
            label="次日留存" 
            value={formatPercent(data?.metrics.retention.day1 || 0)} 
            icon={<RefreshCcw className="w-4 h-4 text-green-500" />} 
        />
        <MetricCard 
            label="注册转化率" 
            value={formatPercent(data?.metrics.registrationRate || 0)} 
            icon={<UserCheckIcon className="w-4 h-4 text-purple-500" />} 
        />
        <MetricCard 
            label="人均浏览岗位" 
            value={data?.metrics.avgJobViews.toFixed(1) || '0.0'} 
            icon={<FileText className="w-4 h-4 text-orange-500" />} 
        />
        <MetricCard 
            label="投递转化率" 
            value={formatPercent(data?.metrics.applyConversion || 0)} 
            icon={<Target className="w-4 h-4 text-red-500" />} 
        />
        <MetricCard 
            label="会员申请率" 
            value={formatPercent(data?.metrics.memberApplyRate || 0)} 
            icon={<CreditCard className="w-4 h-4 text-yellow-500" />} 
        />
      </div>

      {/* 2. Core Funnel */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-6 flex items-center">
            <Target className="w-5 h-5 mr-2 text-indigo-600" />
            核心转化漏斗 (Core Funnel)
        </h3>
        
        <div className="relative">
            {/* Visual Funnel */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 relative z-10">
                {data?.funnel.map((step, index) => {
                    // Calculate drop-off from previous step
                    const prev = data.funnel[index - 1];
                    const conversion = prev && prev.uv > 0 ? (step.uv / prev.uv) * 100 : 100;
                    
                    const labels = {
                        'view_landing': '浏览访问',
                        'signup_success': '激活/注册',
                        'view_job_detail': '浏览岗位',
                        'click_apply_init': '简历/申请',
                        'submit_membership_application': '会员订阅'
                    };

                    return (
                        <div key={step.event} className="flex-1 w-full md:w-auto relative group">
                            {index > 0 && (
                                <div className="hidden md:block absolute top-1/2 -left-6 -translate-y-1/2 text-slate-300">
                                    <ArrowRight className="w-5 h-5" />
                                </div>
                            )}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center hover:border-indigo-300 transition-colors">
                                <div className="text-xs text-slate-500 mb-1">{labels[step.event as keyof typeof labels] || step.event}</div>
                                <div className="text-2xl font-bold text-slate-900">{step.uv}</div>
                                <div className="text-xs text-slate-400 mt-1">PV: {step.pv}</div>
                                
                                {index > 0 && (
                                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-[10px] text-slate-600 font-medium">
                                        转化率 {conversion.toFixed(1)}%
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3. Page Traffic Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <MousePointer className="w-5 h-5 mr-2 text-blue-600" />
                页面访问排行
            </h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">页面名称</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">UV (访客)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">PV (浏览)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {data?.pages.map((page) => (
                            <tr key={page.name} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm text-slate-900 font-medium">{page.name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{page.uv}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{page.pv}</td>
                            </tr>
                        ))}
                        {(!data?.pages || data.pages.length === 0) && (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">暂无数据</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* 4. Trend Chart */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
                访问趋势 (UV)
            </h3>
            <div className="flex-1 min-h-[200px] flex items-end pb-4">
                <SimpleLineChart data={data?.trend || []} dataKey="uv" color="#4f46e5" />
            </div>
            <div className="flex justify-between text-xs text-slate-400 px-2 border-t pt-2">
                {data?.trend && data.trend.length > 0 && (
                    <>
                        <span>{new Date(data.trend[0].date).toLocaleDateString()}</span>
                        <span>{new Date(data.trend[data.trend.length - 1].date).toLocaleDateString()}</span>
                    </>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, icon, trend }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-full">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <div className="p-1.5 bg-slate-50 rounded-lg">{icon}</div>
            </div>
            <div>
                <div className="text-xl font-bold text-slate-900">{value}</div>
                {trend && <div className="text-xs text-green-600 font-medium mt-1">{trend}</div>}
            </div>
        </div>
    );
}

// Icon helper
function UserCheckIcon(props: any) {
    return (
        <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="24" height="24" viewBox="0 0 24 24" 
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
            {...props}
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <polyline points="16 11 18 13 22 9"></polyline>
        </svg>
    )
}
