import React, { useState } from 'react';
import { X, Check, Loader2, Send, Crown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface MembershipApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MembershipApplicationModal: React.FC<MembershipApplicationModalProps> = ({
  isOpen,
  onClose
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    // nickname removed
    contact: '',
    experience: '',
    career_ideal: '',
    contact_type: 'wechat'
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact || !formData.experience || !formData.career_ideal) {
      setError('请填写所有必填项');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const token = localStorage.getItem('haigoo_auth_token');
      // Construct payload without nickname
      const payload = {
        contact: formData.contact,
        experience: formData.experience,
        career_ideal: formData.career_ideal,
        contact_type: formData.contact_type
      };
      
      const res = await fetch('/api/user-profile?action=submit_application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(true);
      } else {
        setError(data.error || '提交失败，请稍后重试');
      }
    } catch (err) {
      setError('提交失败，请检查网络连接');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity cursor-pointer" 
        onClick={onClose}
      />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 relative overflow-hidden">
          {/* Decorative background elements */}
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
          
          <h3 className="text-xl font-bold text-white relative z-10 flex items-center gap-2">
            <span className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
               <Crown className="w-5 h-5 text-white" />
            </span>
            申请加入 Haigoo Member
          </h3>
          <button 
            onClick={onClose}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors relative z-10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto custom-scrollbar">
          {success ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-14 h-14 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                <Check className="w-7 h-7" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">申请已提交</h4>
              <p className="text-sm text-slate-500 max-w-xs mx-auto mb-6">
                感谢您的申请！我们要人工审核每一位会员，结果将通过邮件或微信通知您。
              </p>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 transition-colors text-sm"
              >
                关闭
              </button>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-5">
                <p className="text-xs text-amber-800 leading-relaxed">
                  当前产品处于内测期，会员采用<strong>特邀制</strong>。请填写以下信息，我们将审核您的背景与远程工作的匹配度。
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-2.5 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100">
                    {error}
                  </div>
                )}

                {/* Nickname field removed */}

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    联系方式 (微信号) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={e => setFormData({...formData, contact: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                    placeholder="方便我们联系你"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    职业背景 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.experience}
                    onChange={e => setFormData({...formData, experience: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
                    placeholder="例如：5年全栈开发经验，熟悉 React/Node.js，曾在大厂任职..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    在申请的远程工作方向 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.career_ideal}
                    onChange={e => setFormData({...formData, career_ideal: e.target.value})}
                    rows={2}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none text-sm"
                    placeholder="例如：寻找海外 Web3 初创公司的前端岗位，期望薪资..."
                  />
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transform transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        提交中...
                      </>
                    ) : (
                      <>
                        发送申请 <Send className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
