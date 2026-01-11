import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';

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
      className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white cursor-pointer shadow-md hover:shadow-lg transition-all transform hover:-translate-y-1 mb-4 flex flex-col justify-between min-h-[180px]"
    >
      <div>
        <div className="flex items-center gap-2 mb-3">
            <span className="bg-white/20 px-2 py-1 rounded text-xs font-medium backdrop-blur-sm flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> 精选合集
            </span>
        </div>
        <h3 className="text-2xl font-bold mb-2">{bundle.title}</h3>
        <p className="text-indigo-100 line-clamp-2 text-sm md:text-base">{bundle.subtitle}</p>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm font-medium bg-white/10 px-3 py-1.5 rounded-lg">
            包含 {bundle.job_ids?.length || 0} 个精选职位
        </div>
        <div className="bg-white text-indigo-600 p-2 rounded-full hover:bg-indigo-50 transition-colors">
            <ArrowRight className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
