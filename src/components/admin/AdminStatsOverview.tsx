import React from 'react';
import { Briefcase, Eye, TrendingUp, Globe, Database, AlertCircle } from 'lucide-react';
import { JobStats, SyncStatus } from '../../types/rss-types';

interface AdminStatsOverviewProps {
    stats: JobStats | null;
    rssSourcesCount: number;
    syncStatus: SyncStatus | null;
}

const AdminStatsOverview: React.FC<AdminStatsOverviewProps> = ({ stats, rssSourcesCount, syncStatus }) => {
    if (!stats) return null;

    const formatDate = (date: Date | string | null | undefined) => {
        if (!date) return '从未同步';
        try {
            const dateObj = date instanceof Date ? date : new Date(date);
            if (isNaN(dateObj.getTime())) return '无效日期';
            return new Intl.DateTimeFormat('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }).format(dateObj);
        } catch (e) {
            return '无效日期';
        }
    };

    return (
        <div className="mb-8">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                {/* 总岗位数 */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Briefcase className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-slate-500">总岗位数</p>
                            <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
                        </div>
                    </div>
                </div>

                {/* 活跃岗位 */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Eye className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-slate-500">活跃岗位</p>
                            <p className="text-2xl font-semibold text-slate-900">{stats.activeJobs}</p>
                        </div>
                    </div>
                </div>

                {/* 今日新增 */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <TrendingUp className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-slate-500">今日新增</p>
                            <p className="text-2xl font-semibold text-slate-900">{stats.recentlyAdded}</p>
                        </div>
                    </div>
                </div>

                {/* RSS数据源 */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Globe className="h-8 w-8 text-indigo-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-slate-500">RSS数据源</p>
                            <p className="text-2xl font-semibold text-slate-900">{rssSourcesCount}</p>
                        </div>
                    </div>
                </div>

                {/* 存储容量卡片 */}
                <div className="bg-white rounded-lg shadow p-6">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <Database className="h-8 w-8 text-orange-600" />
                        </div>
                        <div className="ml-4">
                            <p className="text-sm font-medium text-slate-500">存储容量</p>
                            <div className="flex items-baseline space-x-2">
                                <p className="text-lg font-semibold text-slate-900">
                                    {Math.round((stats.total * 2) / 1024 * 100) / 100}MB
                                </p>
                                <p className="text-xs text-slate-500">/ 20MB</p>
                            </div>
                            <div className="mt-2">
                                <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full ${(stats.total * 2) / 1024 / 20 > 0.8 ? 'bg-red-500' :
                                            (stats.total * 2) / 1024 / 20 > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                        style={{ width: `${Math.min(((stats.total * 2) / 1024 / 20) * 100, 100)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 同步状态 */}
            {syncStatus && (
                <div className="bg-white rounded-lg shadow mb-6 p-6">
                    <h3 className="text-lg font-medium text-slate-900 mb-4">同步状态</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <p className="text-sm text-slate-500">上次同步</p>
                            <p className="text-sm font-medium">
                                {formatDate(syncStatus.lastSync)}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">成功/总数</p>
                            <p className="text-sm font-medium">
                                {syncStatus.successfulSources}/{syncStatus.totalSources}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">处理岗位数</p>
                            <p className="text-sm font-medium">{syncStatus.totalJobsProcessed}</p>
                        </div>
                    </div>
                    {syncStatus.errors.length > 0 && (
                        <div className="mt-4">
                            <p className="text-sm text-red-600">同步错误 ({syncStatus.errors.length})</p>
                            <div className="mt-2 max-h-32 overflow-y-auto">
                                {syncStatus.errors.map((error, index) => (
                                    <div key={`error-${index}-${error.source}`} className="text-xs text-red-500 bg-red-50 p-2 rounded mb-1">
                                        {error.source}: {error.error}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminStatsOverview;
