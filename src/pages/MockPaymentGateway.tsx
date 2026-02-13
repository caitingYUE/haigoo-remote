
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import axios from 'axios';

const MockPaymentGateway: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'failed'>('idle');
  const [error, setError] = useState('');

  const paymentId = searchParams.get('paymentId');
  const amount = searchParams.get('amount');
  const method = searchParams.get('method');

  // Check validity
  useEffect(() => {
    if (!paymentId) {
      setStatus('failed');
      setError('Invalid payment session');
      return;
    }
  }, [paymentId]);

  const handleConfirmPayment = async () => {
    try {
      setStatus('processing');
      // Call backend to confirm payment
      // Note: In real world, this happens server-to-server via webhook.
      // Here we simulate the gateway notifying our backend.
      const token = localStorage.getItem('haigoo_auth_token');
      await axios.post('/api/membership?action=confirm-payment', 
        { paymentId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setStatus('success');
      
      // Redirect back after short delay
      setTimeout(() => {
        navigate('/membership');
      }, 2000);
    } catch (err: any) {
      console.error(err);
      setStatus('failed');
      setError(err.response?.data?.error || 'Payment failed');
    }
  };

  const getMethodName = (m: string | null) => {
    if (m === 'wechat') return '微信支付';
    if (m === 'alipay') return '支付宝';
    return '在线支付';
  };

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">支付成功</h2>
          <p className="text-slate-500 mb-6">正在跳转回商户页面...</p>
          <Loader2 className="w-6 h-6 text-green-500 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-600/20"></div>
          <div className="relative z-10">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-indigo-300" />
            <h1 className="text-xl font-bold">安全支付收银台</h1>
            <p className="text-indigo-200 text-xs mt-1">Mock Payment Gateway (Staging)</p>
          </div>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-slate-500 text-sm mb-1">支付金额</p>
            <div className="text-4xl font-bold text-slate-900">
              <span className="text-2xl align-top mr-1">¥</span>
              {amount}
            </div>
            <div className="inline-flex items-center gap-2 mt-4 px-3 py-1 bg-slate-100 rounded-full text-xs font-medium text-slate-600">
              <span>{getMethodName(method)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleConfirmPayment}
              disabled={status === 'processing' && !!error} // Only disable if processing and no error? Logic check: if processing, button usually shows loading. 
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {status === 'processing' && !error ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  处理中...
                </>
              ) : (
                '确认支付 (模拟成功)'
              )}
            </button>
            
            <button
              onClick={() => navigate('/membership')}
              className="w-full py-4 bg-white hover:bg-slate-50 text-slate-500 font-medium rounded-xl border border-slate-200 transition-colors"
            >
              取消支付
            </button>
          </div>

          <div className="mt-8 text-center text-xs text-slate-400">
            <p>本页面仅用于测试环境模拟支付流程</p>
            <p>实际生产环境将调用微信/支付宝官方接口</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MockPaymentGateway;
