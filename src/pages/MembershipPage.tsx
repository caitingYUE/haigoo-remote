
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, Gift, Users, ChevronRight } from 'lucide-react';
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
         const token = localStorage.getItem('haigoo_auth_token');
         if (!token) return;

         const res = await axios.get('/api/membership?action=status', {
            headers: { Authorization: `Bearer ${token}` }
         });
         if (res.data.success) {
            setCurrentMembership(res.data.membership);
         }
      } catch (error) {
         console.error('Failed to fetch status', error);
      }
   };

   const handleSubscribe = (plan: Plan) => {
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
      return (
         <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-slate-50 font-sans">
         {/* Hero Section */}
         <div className="relative overflow-hidden bg-slate-900 text-white pt-24 pb-32 px-4 sm:px-6 lg:px-8">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20">
               <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-600 blur-3xl mix-blend-screen animate-blob"></div>
               <div className="absolute top-32 right-10 w-72 h-72 rounded-full bg-purple-600 blur-3xl mix-blend-screen animate-blob animation-delay-2000"></div>
               {/* Noise texture overlay */}
               <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center">
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-sm font-medium mb-8 backdrop-blur-sm">
                  <Crown className="w-4 h-4" /> 会员权益全新升级
               </div>
               <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight mb-8 leading-tight">
                  加入 <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Haigoo Member</span> <br className="hidden sm:block" />
                  开启您的全球远程职业生涯
               </h1>
               <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                  解锁海量内推机会，获取 AI 智能简历优化，加入精英远程工作者社区。<br className="hidden sm:block" />让找工作不再是一个人的战斗。
               </p>

               {currentMembership?.isActive && (
                  <div className="inline-block bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30 px-6 py-4 rounded-2xl backdrop-blur-md">
                     <div className="flex items-center gap-4">
                        <div className="bg-emerald-500/20 p-2 rounded-full">
                           <Check className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div className="text-left">
                           <p className="text-xs text-emerald-400 uppercase font-bold tracking-wider mb-0.5">Current Status</p>
                           <p className="font-bold text-white text-lg flex items-center gap-2">
                              {currentMembership.level === 'club_go' ? 'Haigoo Member' : 'Haigoo Pro Member'}
                              <span className="text-sm font-normal text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-md">
                                 有效期至 {new Date(currentMembership.expireAt).toLocaleDateString()}
                              </span>
                           </p>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Pricing Section */}
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 -mt-20 relative z-20">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
               {plans.map((plan) => {
                  // Logic to highlight popular plan
                  const isPopular = plan.id.includes('quarterly') || plan.name.includes('季度') || plan.id === 'club_membership_quarterly';

                  return (
                     <div
                        key={plan.id}
                        className={`relative bg-white rounded-[2rem] transition-all duration-300 flex flex-col h-full overflow-hidden group ${isPopular
                           ? 'shadow-2xl shadow-indigo-200 ring-2 ring-indigo-500 scale-105 z-10'
                           : 'shadow-xl hover:shadow-2xl border border-slate-100 hover:-translate-y-1'
                           }`}
                     >
                        {isPopular && (
                           <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                        )}
                        {isPopular && (
                           <div className="absolute top-6 right-6">
                              <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100 uppercase tracking-wide">
                                 Most Popular
                              </span>
                           </div>
                        )}

                        <div className="p-8 flex-1">
                           <h3 className="text-xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                           <div className="flex items-baseline gap-1 mb-4">
                              <span className="text-4xl font-extrabold text-slate-900">¥{plan.price}</span>
                              <span className="text-slate-500 font-medium">/{plan.duration_days >= 30 ? (plan.duration_days >= 90 ? '季度' : '月') : '天'}</span>
                           </div>

                           <p className="text-slate-500 text-sm mb-8 min-h-[40px] leading-relaxed">
                              {plan.id.includes('go') ? '体验核心功能，开始您的远程之旅' : '全方位服务，加速您的求职进程，享受完整的社群支持'}
                           </p>

                           <div className="space-y-4 mb-8">
                              {plan.features.map((feature, index) => (
                                 <div key={index} className="flex items-start gap-3 group-hover:transform group-hover:translate-x-1 transition-transform duration-300">
                                    <div className={`mt-0.5 rounded-full p-1 shrink-0 ${isPopular ? 'bg-indigo-100' : 'bg-slate-100'}`}>
                                       <Check className={`w-3 h-3 ${isPopular ? 'text-indigo-600' : 'text-slate-600'}`} />
                                    </div>
                                    <span className="text-slate-600 text-sm flex-1">{feature}</span>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div className="p-8 pt-0 mt-auto">
                           <button
                              onClick={() => handleSubscribe(plan)}
                              className={`w-full py-4 rounded-xl font-bold text-lg transition-all shadow-md hover:shadow-lg active:scale-95 ${isPopular
                                 ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25'
                                 : 'bg-slate-900 text-white hover:bg-slate-800'
                                 }`}
                           >
                              立即订阅
                              {isPopular && <ArrowRight className="w-4 h-4 inline-block ml-2" />}
                           </button>
                           <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
                              <ShieldCheck className="w-3 h-3" />
                              7天无理由退款保障
                           </div>
                        </div>
                     </div>
                  )
               })}
            </div>

            {/* FAQ / Trust Section */}
            <div className="mt-24 max-w-4xl mx-auto">
               <div className="text-center mb-12">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">常见问题解答</h2>
                  <p className="text-slate-500">了解更多关于会员权益的细节</p>
               </div>

               <div className="grid md:grid-cols-2 gap-6">
                  {[
                     { q: "什么是内推直达？", a: "我们会将您的简历直接发送给合作伙伴企业的HR或招聘负责人，跳过简历初筛环节，大大提高面试概率。" },
                     { q: "如果没找到工作可以退款吗？", a: "我们提供7天无理由退款。如果您在7天内觉得服务不满意，可以申请全额退款。超过7天后，虽然主要是为了筛选优质信息，但我们也会尽力协助解决问题。" },
                     { q: "海外岗位支持工签吗？", a: "部分岗位支持工签（Visa Sponsorship），我们在职位筛选时会特别标注。对于远程岗位，通常通过Contractor签约，无需工签也能合法工作。" },
                     { q: "会员有效期如何计算？", a: "从您支付成功的即刻起算。例如月度会员，有效期为支付当日起的30天，系统会自动提醒续费。" }
                  ].map((faq, i) => (
                     <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                        <h3 className="font-bold text-slate-900 mb-3 flex items-start gap-2">
                           <span className="text-indigo-600 text-lg">Q.</span>
                           {faq.q}
                        </h3>
                        <p className="text-slate-500 text-sm leading-relaxed pl-6 border-l-2 border-slate-100">{faq.a}</p>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Payment Modal */}
         {showPaymentModal && selectedPlan && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setShowPaymentModal(false)}></div>

               <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-300 scale-100">
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                     <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-indigo-500 fill-indigo-500" />
                        确认订单
                     </h3>
                     <button
                        onClick={() => setShowPaymentModal(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                     >
                        <span className="text-xl leading-none">&times;</span>
                     </button>
                  </div>

                  <div className="p-6 md:p-8">
                     {/* Order Summary Card */}
                     <div className="flex justify-between items-center mb-8 bg-gradient-to-br from-indigo-50 to-slate-50 p-5 rounded-2xl border border-indigo-100/50">
                        <div>
                           <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">订阅方案</p>
                           <p className="font-bold text-slate-900 text-lg">{selectedPlan.name}</p>
                        </div>
                        <div className="text-right">
                           <p className="text-xs text-slate-500 mb-1">支付金额</p>
                           <p className="text-3xl font-bold text-indigo-600">¥{selectedPlan.price}</p>
                        </div>
                     </div>

                     {!paymentInfo ? (
                        <div className="space-y-6">
                           <div>
                              <p className="font-medium text-slate-900 mb-3 text-sm">选择支付方式</p>
                              <div className="grid grid-cols-2 gap-4">
                                 <button
                                    onClick={() => setPaymentMethod('xiaohongshu')}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${paymentMethod === 'xiaohongshu'
                                       ? 'border-red-500 bg-red-50/30'
                                       : 'border-slate-100 hover:border-red-100 hover:bg-red-50/10'
                                       }`}
                                 >
                                    {paymentMethod === 'xiaohongshu' && (
                                       <div className="absolute top-2 right-2 text-red-500">
                                          <Check className="w-4 h-4" />
                                       </div>
                                    )}
                                    <span className="w-10 h-10 rounded-full bg-red-100 text-red-500 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                       <Gift className="w-5 h-5" />
                                    </span>
                                    <span className="text-slate-900 font-bold text-sm">小红书店铺</span>
                                    <span className="text-xs text-slate-400">担保交易 · 安全快捷</span>
                                 </button>

                                 <button
                                    onClick={() => setPaymentMethod('wechat_transfer')}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${paymentMethod === 'wechat_transfer'
                                       ? 'border-green-500 bg-green-50/30'
                                       : 'border-slate-100 hover:border-green-100 hover:bg-green-50/10'
                                       }`}
                                 >
                                    {paymentMethod === 'wechat_transfer' && (
                                       <div className="absolute top-2 right-2 text-green-500">
                                          <Check className="w-4 h-4" />
                                       </div>
                                    )}
                                    <span className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                       <ShieldCheck className="w-5 h-5" />
                                    </span>
                                    <span className="text-slate-900 font-bold text-sm">微信支付</span>
                                    <span className="text-xs text-slate-400">人工核销 · 即时开通</span>
                                 </button>
                              </div>
                           </div>

                           <button
                              onClick={handleCreatePayment}
                              className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-slate-200 hover:shadow-indigo-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                              立即支付 <span className="text-indigo-200">¥{selectedPlan.price}</span>
                           </button>
                        </div>
                     ) : (
                        <div className="text-center">
                           <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              {paymentInfo.imageUrl ? (
                                 <>
                                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 inline-block mb-4">
                                       <img src={paymentInfo.imageUrl} alt="Payment QR" className="w-40 h-40 object-contain rounded-lg" />
                                    </div>
                                    <p className="text-xs text-slate-400 mb-4">请使用{paymentMethod === 'xiaohongshu' ? '小红书' : '微信'}扫码支付</p>
                                 </>
                              ) : null}

                              <p className="text-slate-800 font-medium mb-2">{paymentInfo.instruction}</p>

                              {paymentInfo.url && (
                                 <a
                                    href={paymentInfo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-indigo-600 font-bold hover:underline hover:text-indigo-700 transition-colors"
                                 >
                                    点击跳转支付链接 <ArrowRight className="w-4 h-4" />
                                 </a>
                              )}
                           </div>

                           {/* Dev Helper - Only show in dev */}
                           {currentPaymentId && process.env.NODE_ENV === 'development' && (
                              <button onClick={() => currentPaymentId && handleDevConfirm(currentPaymentId)} className="mb-4 text-xs text-amber-500 hover:text-amber-600 underline">Dev Only: Auto Confirm Payment</button>
                           )}

                           <div className="space-y-3">
                              <button
                                 onClick={handlePaymentComplete}
                                 className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2"
                              >
                                 <Check className="w-5 h-5" />
                                 我已完成支付
                              </button>
                              <button
                                 onClick={() => setPaymentInfo(null)}
                                 className="text-slate-400 text-sm hover:text-slate-600 py-2 transition-colors"
                              >
                                 返回重新选择支付方式
                              </button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default MembershipPage;
