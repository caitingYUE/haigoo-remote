
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, Gift, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  features: string[];
  duration_days: number;
}

interface PaymentInfo {
  type: string;
  url?: string;
  imageUrl?: string;
  instruction: string;
}

const MembershipPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'xiaohongshu' | 'wechat_transfer'>('xiaohongshu');
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<any>(null);

  useEffect(() => {
    fetchPlans();
    if (isAuthenticated) {
      fetchStatus();
    }
  }, [isAuthenticated]);

  const fetchPlans = async () => {
    try {
      const res = await axios.get('/api/membership?action=plans');
      if (res.data.success) {
        setPlans(res.data.plans);
      }
    } catch (error) {
      console.error('Failed to fetch plans', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await axios.get('/api/membership?action=status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token')}` }
      });
      if (res.data.success) {
        setCurrentMembership(res.data.membership);
      }
    } catch (error) {
      console.error('Failed to fetch status', error);
    }
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!isAuthenticated) {
      navigate('/login?redirect=/membership');
      return;
    }
    setSelectedPlan(plan);
    setShowPaymentModal(true);
    setPaymentInfo(null); // Reset previous info
  };

  const handleCreatePayment = async () => {
    if (!selectedPlan) return;
    
    try {
      const res = await axios.post('/api/membership?action=checkout', {
        planId: selectedPlan.id,
        paymentMethod
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token')}` }
      });

      if (res.data.success) {
        setPaymentInfo(res.data.paymentInfo);
        setCurrentPaymentId(res.data.paymentId);
      }
    } catch (error) {
      console.error('Payment creation failed', error);
      alert('创建支付订单失败，请重试');
    }
  };

  const handlePaymentComplete = () => {
    setShowPaymentModal(false);
    alert('感谢您的支付！请等待管理员确认开通，或联系客服加快处理。');
    fetchStatus(); // Refresh status
  };

  // Development helper to auto-confirm
  const handleDevConfirm = async (paymentId: string) => {
      try {
          await axios.post('/api/membership?action=confirm-payment', { paymentId }, {
             headers: { Authorization: `Bearer ${localStorage.getItem('haigoo_auth_token')}` }
          });
          alert('Dev: Membership activated!');
          handlePaymentComplete();
      } catch (e) {
          console.error(e);
      }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 text-white pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
           <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600 blur-3xl mix-blend-screen animate-blob"></div>
           <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-purple-600 blur-3xl mix-blend-screen animate-blob animation-delay-2000"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-sm font-medium mb-6">
             <Crown className="w-4 h-4" /> 会员权益全新升级
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-6">
             加入 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Haigoo Member</span> <br/>
             开启您的全球远程职业生涯
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-10">
             解锁海量内推机会，获取 AI 智能简历优化，加入精英远程工作者社区。让找工作不再是一个人的战斗。
          </p>
          
          {currentMembership?.isActive && (
             <div className="inline-block bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/50 text-green-300 px-6 py-3 rounded-xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                   <Check className="w-5 h-5 text-green-400" />
                   <div className="text-left">
                      <p className="text-xs text-green-400 uppercase font-bold tracking-wider">Current Status</p>
                      <p className="font-bold text-white text-lg">{currentMembership.level === 'club_go' ? '俱乐部Go会员' : 'Goo+会员'} <span className="text-sm font-normal opacity-70 ml-1">(有效期至 {new Date(currentMembership.expireAt).toLocaleDateString()})</span></p>
                   </div>
                </div>
             </div>
          )}
        </div>
      </div>

      {/* Trust / Social Proof Strip */}
      <div className="bg-slate-50 border-b border-slate-200 py-8">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
               <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-slate-900 mb-1">500+</div>
                  <div className="text-sm text-slate-500">合作内推企业</div>
               </div>
               <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-slate-900 mb-1">3x</div>
                  <div className="text-sm text-slate-500">面试邀请率提升</div>
               </div>
               <div className="flex flex-col items-center">
                  <div className="text-3xl font-bold text-slate-900 mb-1">24h</div>
                  <div className="text-sm text-slate-500">平均简历反馈时间</div>
               </div>
            </div>
         </div>
      </div>

      {/* Pricing Cards */}
      <div className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
           <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">选择适合您的成长计划</h2>
              <p className="mt-4 text-lg text-slate-500">透明定价，无隐形消费。7天无理由退款保障。</p>
           </div>

           <div className="flex justify-center max-w-5xl mx-auto">
              {/* Plan 1: Haigoo Member */}
              {plans.map((plan) => {
                 const isPro = true; // Always highlight the single plan
                 return (
                    <div 
                      key={plan.id}
                      className={`relative flex flex-col p-8 rounded-3xl transition-all duration-300 w-full max-w-md ${
                         isPro 
                         ? 'bg-slate-900 text-white shadow-2xl ring-1 ring-slate-900 scale-105 z-10' 
                         : 'bg-white border border-slate-200 text-slate-900 shadow-lg hover:shadow-xl'
                      }`}
                    >
                       {isPro && (
                          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                             <Star className="w-3 h-3 fill-current" /> 最受欢迎
                          </div>
                       )}

                       <div className="mb-6">
                          <h3 className="text-xl font-semibold flex items-center gap-2">
                             {isPro ? <Crown className="w-6 h-6 text-yellow-400" /> : <Zap className="w-6 h-6 text-indigo-500" />}
                             {plan.name}
                          </h3>
                          <div className="mt-4 flex items-baseline">
                             <span className="text-5xl font-extrabold tracking-tight">¥{plan.price}</span>
                             <span className={`ml-2 text-lg ${isPro ? 'text-slate-400' : 'text-slate-500'}`}>/年</span>
                          </div>
                          <p className={`mt-2 text-sm ${isPro ? 'text-indigo-300' : 'text-indigo-600 font-medium'}`}>
                             相当于 ¥{(plan.price / 12).toFixed(0)} / 月
                          </p>
                       </div>

                       <ul className="space-y-4 mb-8 flex-1">
                          {plan.features.map((feature, idx) => (
                             <li key={idx} className="flex items-start gap-3">
                                <div className={`mt-1 p-0.5 rounded-full ${isPro ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                                   <Check className={`w-3 h-3 ${isPro ? 'text-indigo-300' : 'text-indigo-600'}`} />
                                </div>
                                <span className={`text-sm ${isPro ? 'text-slate-300' : 'text-slate-600'}`}>{feature}</span>
                             </li>
                          ))}
                       </ul>

                       <button
                          onClick={() => handleSubscribe(plan)}
                          className={`w-full py-4 px-6 rounded-xl font-bold text-lg transition-all duration-200 transform hover:-translate-y-1 ${
                             isPro
                             ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-900/20'
                             : 'bg-slate-100 hover:bg-slate-200 text-slate-900'
                          }`}
                       >
                          {currentMembership?.isActive ? '续费/升级' : '立即开通'}
                       </button>
                    </div>
                 )
              })}
           </div>
        </div>
      </div>

      {/* Features Grid / Value Prop */}
      <div className="py-20 bg-slate-50 px-4 sm:px-6 lg:px-8">
         <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-3 gap-12">
               <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center mb-6">
                     <Gift className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">独家内推渠道</h3>
                  <p className="text-slate-600">
                     与数百家远程友好型企业建立直接联系，简历直达 Hiring Manager 邮箱，跳过海选环节。
                  </p>
               </div>
               <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
                     <Zap className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">AI 简历深度优化</h3>
                  <p className="text-slate-600">
                     针对不同岗位 JD，AI 智能生成定制化简历建议，优化关键词匹配度，提升 ATS 通过率。
                  </p>
               </div>
               <div className="text-center">
                  <div className="w-16 h-16 mx-auto bg-pink-100 rounded-2xl flex items-center justify-center mb-6">
                     <Users className="w-8 h-8 text-pink-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">高端人脉社区</h3>
                  <p className="text-slate-600">
                     加入高净值远程工作者社群，定期举办线上线下交流会，拓展行业人脉，共享前沿信息。
                  </p>
               </div>
            </div>
         </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setShowPaymentModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-middle bg-white rounded-2xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-lg font-bold text-slate-900">
                    确认订单
                 </h3>
                 <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
              </div>

              <div className="px-6 py-6">
                 {/* Order Summary */}
                 <div className="flex items-center justify-between mb-6 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                       <div className={`p-2 rounded-lg ${selectedPlan.id === 'goo_plus_yearly' ? 'bg-slate-900 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                          {selectedPlan.id === 'goo_plus_yearly' ? <Crown className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                       </div>
                       <div>
                          <p className="font-bold text-slate-900">{selectedPlan.name}</p>
                          <p className="text-xs text-slate-500">365天有效期</p>
                       </div>
                    </div>
                    <div className="text-xl font-bold text-slate-900">¥{selectedPlan.price}</div>
                 </div>

                 {!paymentInfo ? (
                    <div className="space-y-4">
                       <p className="text-sm font-medium text-slate-700">选择支付方式</p>
                       <div className="grid grid-cols-2 gap-4">
                          <button 
                             onClick={() => setPaymentMethod('xiaohongshu')}
                             className={`relative flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${paymentMethod === 'xiaohongshu' ? 'border-red-500 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                             <span className="font-bold text-slate-900">小红书店铺</span>
                             <span className="text-xs text-slate-500 mt-1">担保交易</span>
                             {paymentMethod === 'xiaohongshu' && <div className="absolute top-2 right-2 text-red-500"><Check className="w-4 h-4" /></div>}
                          </button>
                          <button 
                             onClick={() => setPaymentMethod('wechat_transfer')}
                             className={`relative flex flex-col items-center justify-center p-4 border-2 rounded-xl transition-all ${paymentMethod === 'wechat_transfer' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:border-slate-300'}`}
                          >
                             <span className="font-bold text-slate-900">微信转账</span>
                             <span className="text-xs text-slate-500 mt-1">人工核销</span>
                             {paymentMethod === 'wechat_transfer' && <div className="absolute top-2 right-2 text-green-500"><Check className="w-4 h-4" /></div>}
                          </button>
                       </div>

                       <button
                          onClick={handleCreatePayment}
                          className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-200 transition-all"
                       >
                          立即支付 ¥{selectedPlan.price}
                       </button>
                       <p className="text-center text-xs text-slate-400 mt-2 flex items-center justify-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> 安全加密支付，保障您的信息安全
                       </p>
                    </div>
                 ) : (
                    <div className="text-center py-4">
                       <div className="mb-6">
                          {paymentInfo.type === 'link' ? (
                             <div className="space-y-4">
                                <div className="w-16 h-16 mx-auto bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                                   <ArrowRight className="w-8 h-8" />
                                </div>
                                <p className="text-slate-600 px-4">{paymentInfo.instruction}</p>
                                <a 
                                   href={paymentInfo.url} 
                                   target="_blank" 
                                   rel="noreferrer" 
                                   className="inline-flex items-center justify-center w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-md transition-all"
                                >
                                   前往小红书支付
                                </a>
                             </div>
                          ) : (
                             <div className="space-y-4">
                                <p className="text-slate-600 mb-4">{paymentInfo.instruction}</p>
                                <div className="mx-auto w-48 h-48 bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400">
                                   {/* Placeholder for QR Code */}
                                   <div className="w-32 h-32 bg-white p-2">
                                      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=HaigooMembershipPayment" alt="Payment QR" className="w-full h-full opacity-80" />
                                   </div>
                                   <span className="text-xs mt-2">示例二维码</span>
                                </div>
                                <p className="text-xs text-slate-500">支付时请备注：{user?.email}</p>
                             </div>
                          )}
                       </div>

                       <div className="space-y-3 border-t border-slate-100 pt-6">
                          <button
                             onClick={handlePaymentComplete}
                             className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-md transition-all"
                          >
                             我已完成支付
                          </button>
                          
                          {/* Dev Helper */}
                          {currentPaymentId && (
                              <button
                                 type="button"
                                 className="w-full py-2 text-xs font-medium text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors"
                                 onClick={() => handleDevConfirm(currentPaymentId)}
                              >
                                 [开发环境] 模拟支付成功回调
                              </button>
                          )}
                       </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
