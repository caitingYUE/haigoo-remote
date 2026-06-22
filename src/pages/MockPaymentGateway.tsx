
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import axios from 'axios';

const MockPaymentGateway: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const amount = searchParams.get('amount');

  useEffect(() => {
    axios.get('/api/health').catch(() => undefined);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/20"></div>
          <div className="relative z-10">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-indigo-300" />
            <h1 className="text-xl font-bold">顾问协助开通</h1>
            <p className="text-indigo-200 text-xs mt-1">Haigoo Remote Club</p>
          </div>
        </div>

        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-slate-500 text-sm mb-1">参考方案</p>
            <div className="text-4xl font-bold text-slate-900">
              <span className="text-2xl align-top mr-1">¥</span>
              {amount}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Haigoo Remote Club 会员服务通过顾问协助确认方案并开通网站权限。
            </p>
          </div>

          <div className="mx-auto mb-6 w-48 border border-slate-100 bg-slate-50 p-4">
            <img src="/series_assistant.png" alt="企业微信顾问二维码" className="h-full w-full object-contain" />
          </div>

          <div className="mb-6 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            <div>添加顾问后，可发送注册邮箱和想了解的会员方案。</div>
            <div>顾问确认后开通对应网站权限。</div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/profile?tab=membership#club-service-plans')}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-5 h-5" />
              我已添加顾问
            </button>

            <button
              onClick={() => navigate('/profile?tab=membership#club-service-plans')}
              className="w-full py-4 bg-white hover:bg-slate-50 text-slate-500 font-medium rounded-xl border border-slate-200 transition-colors"
            >
              返回 Club 权益页
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            <p>网站权限为 Haigoo Remote Club 会员服务的配套工具，不单独作为在线商品售卖。</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockPaymentGateway;
