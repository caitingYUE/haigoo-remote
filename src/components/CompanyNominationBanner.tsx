import React from 'react';
import { ThumbsUp, ArrowRight, ShieldCheck, Briefcase } from 'lucide-react';

interface CompanyNominationBannerProps {
    onClick: () => void;
    className?: string;
}

export const CompanyNominationBanner: React.FC<CompanyNominationBannerProps> = ({ onClick, className = '' }) => {
    return (
        <div
            className={`bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 relative group cursor-pointer ${className}`}
            onClick={onClick}
        >
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                <Briefcase className="w-24 h-24 text-violet-600 -rotate-12 translate-x-4 -translate-y-4" />
            </div>

            <div className="p-4 flex items-start gap-4 relative z-10 h-full">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 shadow-md shadow-violet-200 mt-1">
                    <Briefcase className="w-5 h-5 text-white" />
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-bold text-slate-900 text-base">我要招聘</h4>
                            <span className="px-2 py-0.5 bg-white/60 text-violet-700 text-xs font-bold rounded-full border border-violet-100 whitespace-nowrap">Hire Remote</span>
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed mb-2">
                            有远程招聘需求？提交企业信息和岗位要求，我们将为您对接优质人才。
                        </p>
                    </div>

                    <div className="flex items-center text-xs text-violet-600 font-bold group-hover:translate-x-1 transition-transform mt-auto">
                        立即发布 <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                </div>
            </div>
        </div>
    );
};
