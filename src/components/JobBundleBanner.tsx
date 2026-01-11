import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles, Layers } from 'lucide-react';

interface JobBundle {
  id: number;
  title: string;
  subtitle: string;
  job_ids: string[];
}

interface JobBundleBannerProps {
  bundle: JobBundle;
}

export default function JobBundleBanner({ bundle }: JobBundleBannerProps) {
  const navigate = useNavigate();

  return (
    <div 
      onClick={() => navigate(`/job-bundles/${bundle.id}`)}
      className="group relative overflow-hidden bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer mb-6"
    >
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-500" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-50/50 rounded-full translate-y-1/3 -translate-x-1/4 blur-3xl group-hover:bg-purple-100/50 transition-colors duration-500" />
      
      <div className="relative p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Sparkles className="w-3 h-3" /> 精选合集
            </span>
            <span className="text-xs text-slate-400 font-medium">
                {bundle.job_ids?.length || 0} 个职位
            </span>
          </div>
          
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">
            {bundle.title}
          </h3>
          
          <p className="text-sm text-slate-500 line-clamp-1">
            {bundle.subtitle}
          </p>
        </div>

        <div className="flex items-center self-end sm:self-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 transform group-hover:translate-x-0.5 transition-transform" />
            </div>
        </div>
      </div>
    </div>
  );
}
