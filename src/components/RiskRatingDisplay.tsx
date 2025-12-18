import React from 'react';
import { Crown, Star, Clock, AlertTriangle, Lock, TrendingUp, Sparkles, MessageSquare, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RiskRating {
    friendly_score?: number; // 1-5
    reply_rate?: 'low' | 'mid' | 'high';
    avg_feedback_days?: number;
    risk_tags?: string[];
}

interface HiddenFields {
    timezone_pref?: string;
    english_req?: string;
    contract_type?: string;
}

interface RiskRatingDisplayProps {
    riskRating?: RiskRating;
    haigooComment?: string;
    hiddenFields?: HiddenFields;
    isMember: boolean;
    className?: string;
}

export const RiskRatingDisplay: React.FC<RiskRatingDisplayProps> = ({
    riskRating,
    haigooComment,
    hiddenFields,
    isMember,
    className = ''
}) => {
    const navigate = useNavigate();

    // 如果没有任何评估数据，不显示此组件
    if (!riskRating && !haigooComment && !hiddenFields) {
        return null;
    }

    // 免费用户看到的蒙版版本
    if (!isMember) {
        return (
            <div className={`bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 rounded-xl p-6 border border-white/10 shadow-xl shadow-indigo-900/20 relative overflow-hidden group ${className}`}>
                {/* Noise & Background Effects */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-[40px] animate-pulse"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-white/10 border border-white/10 backdrop-blur-sm shadow-sm">
                            <Crown className="w-5 h-5 text-teal-300" />
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-tight">会员专属 - 企业风险评估</h3>
                    </div>

                    <div className="relative">
                        {/* Blurred Content Preview */}
                        <div className="filter blur-sm select-none pointer-events-none opacity-40">
                            <div className="space-y-3 text-sm text-white/80">
                                <div className="flex items-center gap-2">
                                    <Star className="w-4 h-4 text-white/50" />
                                    <span className="font-medium">中国候选人友好度:</span>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4].map(i => <Star key={i} className="w-3 h-3 text-white/50 fill-white/50" />)}
                                        <Star className="w-3 h-3 text-white/20" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-white/50" />
                                    <span className="font-medium">历史回复率:</span>
                                    <span>高 (72%回复率)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-white/50" />
                                    <span className="font-medium">平均反馈周期:</span>
                                    <span>5-7个工作日</span>
                                </div>
                            </div>
                        </div>

                        {/* Unlock Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <button
                                onClick={() => navigate('/membership')}
                                className="bg-white text-indigo-900 hover:bg-indigo-50 px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all flex items-center gap-2 group/btn"
                            >
                                <Lock className="w-5 h-5 text-indigo-600 group-hover/btn:scale-110 transition-transform" />
                                解锁会员查看完整评估
                            </button>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/10">
                        <p className="text-xs text-center text-white/60 flex items-center justify-center gap-1.5 font-light">
                            <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                            升级会员，获取企业友好度、回复率、风险提示等深度评估信息
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 会员用户看到的完整版本
    const replyRateText = {
        low: '低 (<40%回复率)',
        mid: '中 (40-70%回复率)',
        high: '高 (>70%回复率)'
    };

    const replyRateColor = {
        low: 'text-red-600',
        mid: 'text-yellow-600',
        high: 'text-green-600'
    };

    return (
        <div className={`bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-200 ${className}`}>
            <div className="flex items-center gap-3 mb-5">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 rounded-lg">
                    <Crown className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    会员专属 - 企业风险评估
                </h3>
            </div>

            {/* Risk Rating */}
            {riskRating && (
                <div className="bg-white rounded-lg p-4 mb-4 space-y-3 shadow-sm">
                    {riskRating.friendly_score !== undefined && (
                        <div className="flex items-start gap-3">
                            <Star className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-slate-900 mb-1">中国候选人友好度</p>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-4 h-4 ${star <= riskRating.friendly_score!
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-gray-300'
                                                }`}
                                        />
                                    ))}
                                    <span className="text-sm text-slate-600 ml-1">
                                        ({riskRating.friendly_score}/5)
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {riskRating.reply_rate && (
                        <div className="flex items-start gap-3">
                            <TrendingUp className={`w-5 h-5 mt-0.5 flex-shrink-0 ${replyRateColor[riskRating.reply_rate]}`} />
                            <div className="flex-1">
                                <p className="font-semibold text-slate-900 mb-1">历史回复率</p>
                                <p className={`text-sm font-medium ${replyRateColor[riskRating.reply_rate]}`}>
                                    {replyRateText[riskRating.reply_rate]}
                                </p>
                            </div>
                        </div>
                    )}

                    {riskRating.avg_feedback_days !== undefined && (
                        <div className="flex items-start gap-3">
                            <Clock className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-slate-900 mb-1">平均反馈周期</p>
                                <p className="text-sm text-slate-700">
                                    {riskRating.avg_feedback_days > 14
                                        ? `${Math.round(riskRating.avg_feedback_days / 7)} 周+`
                                        : `${riskRating.avg_feedback_days} 个工作日`}
                                </p>
                            </div>
                        </div>
                    )}

                    {riskRating.risk_tags && riskRating.risk_tags.length > 0 && (
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="font-semibold text-slate-900 mb-2">风险提示</p>
                                <div className="flex flex-wrap gap-2">
                                    {riskRating.risk_tags.map((tag, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Haigoo Comment */}
            {haigooComment && (
                <div className="bg-white rounded-lg p-4 mb-4 shadow-sm">
                    <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-indigo-500" />
                        Haigoo 人工点评
                    </p>
                    <p className="text-sm text-slate-700 leading-relaxed italic border-l-4 border-indigo-300 pl-3">
                        "{haigooComment}"
                    </p>
                </div>
            )}

            {/* Hidden Fields */}
            {hiddenFields && Object.keys(hiddenFields).length > 0 && (
                <div className="bg-white rounded-lg p-4 shadow-sm">
                    <p className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-500" />
                        会员解锁信息
                    </p>
                    <div className="space-y-2 text-sm">
                        {hiddenFields.timezone_pref && (
                            <div className="flex gap-2">
                                <span className="text-slate-500 min-w-[80px]">• 时区偏好:</span>
                                <span className="text-slate-700 font-medium">{hiddenFields.timezone_pref}</span>
                            </div>
                        )}
                        {hiddenFields.english_req && (
                            <div className="flex gap-2">
                                <span className="text-slate-500 min-w-[80px]">• 英文要求:</span>
                                <span className="text-slate-700 font-medium">{hiddenFields.english_req}</span>
                            </div>
                        )}
                        {hiddenFields.contract_type && (
                            <div className="flex gap-2">
                                <span className="text-slate-500 min-w-[80px]">• 合同类型:</span>
                                <span className="text-slate-700 font-medium">{hiddenFields.contract_type}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
