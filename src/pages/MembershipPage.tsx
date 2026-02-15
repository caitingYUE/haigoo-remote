
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, Gift, Users, ChevronRight, Loader2, Send, CheckCircle2, Calendar, Download, X, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import JobCardNew from '../components/JobCardNew';
import { processedJobsService } from '../services/processed-jobs-service';
import { trackingService } from '../services/tracking-service';
import { MembershipCertificateModal } from '../components/MembershipCertificateModal';

interface Plan {
   id: string;
   name: string;
   price: number;
   currency: string;
   features: string[];
   duration_days: number;
   description?: string;
   isPlus?: boolean;
}

interface PaymentInfo {
   type: string;
   url?: string;
   imageUrl?: string;
   instruction: string;
}

const STATIC_PLANS: Plan[] = [
    {
        id: 'club_go_yearly',
        name: '俱乐部Go会员',
        price: 299,
        currency: 'CNY',
        duration_days: 365,
        features: [
            '全部岗位的内推机会',
            'AI简历优化工具无限使用',
            '加入精英远程工作者社区',
            '参与俱乐部所有线上活动',
            '获取独家远程工作指南'
        ],
        description: '适合正在寻找远程工作的求职者，全方位助力上岸'
    },
    {
        id: 'goo_plus_yearly',
        name: 'Goo+ 尊享会员',
        price: 999,
        currency: 'CNY',
        duration_days: 365,
        isPlus: true,
        features: [
            '包含Go会员所有权益',
            '1对1 职业生涯规划咨询 (1次)',
            '支持成为俱乐部城市主理人',
            '通过举办活动、分享帖子获得收入',
            '优先获取高薪内推岗位'
        ],
        description: '适合希望通过社区获得更多机会、建立个人品牌的专业人士'
    }
];

const MembershipPage: React.FC = () => {
   const { user, isAuthenticated } = useAuth();
   const navigate = useNavigate();
   const [plans, setPlans] = useState<Plan[]>(STATIC_PLANS);
   const [loading, setLoading] = useState(true);
   const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
   const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('alipay');
   const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [currentMembership, setCurrentMembership] = useState<any>(null);
   const [showCertificateModal, setShowCertificateModal] = useState(false);
   const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

   // Application Logic (Deprecated, but kept for legacy data display if needed)
   const [applicationStatus, setApplicationStatus] = useState<string | null>(null);

   useEffect(() => {
      // Use static plans immediately, but try to fetch in background if needed
      // setPlans(STATIC_PLANS); 
      setLoading(false);

      if (isAuthenticated) {
         fetchStatus();
         fetchApplicationStatus();
      }
      trackingService.track('view_membership_page');
   }, [isAuthenticated]);

   const fetchApplicationStatus = async () => {
      try {
          const token = localStorage.getItem('haigoo_auth_token');
          if (!token) return;
          const res = await fetch('/api/applications?action=my_status', {
               headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success) {
               setApplicationStatus(data.status);
          }
      } catch (e) { console.error(e) }
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
      setPaymentInfo(null); // Reset previous payment info
      setShowPaymentModal(true);
      trackingService.track('click_subscribe', {
          plan_id: plan.id,
          plan_name: plan.name,
          price: plan.price
      });
   };

   const handleCreatePayment = () => {
      if (!selectedPlan) return;
      if (!user?.email) {
          alert('请先完善您的邮箱信息');
          return;
      }

      // Manual Payment Flow - Display QR Code directly
      const info: PaymentInfo = {
          type: 'qrcode',
          imageUrl: paymentMethod === 'alipay' ? '/alipay.jpg' : '/wechatpay.png',
          instruction: `请使用${paymentMethod === 'alipay' ? '支付宝' : '微信'}扫码支付`
      };
      
      setPaymentInfo(info);
      trackingService.track('initiate_payment_manual', {
          plan_id: selectedPlan.id,
          payment_method: paymentMethod,
          amount: selectedPlan.price
      });
   };

   const handlePaymentComplete = async () => {
      // Optional: Notify server about the payment claim
      try {
          const token = localStorage.getItem('haigoo_auth_token');
          if (token) {
              await axios.post('/api/membership?action=claim_payment', {
                  planId: selectedPlan?.id,
                  paymentMethod,
                  amount: selectedPlan?.price,
                  email: user?.email
              }, { headers: { Authorization: `Bearer ${token}` } });
          }
      } catch (e) {
          console.error('Failed to report payment claim', e);
      }

      setShowPaymentModal(false);
      alert('感谢您的支付！请务必确保您在支付备注中留下了邮箱。管理员将在24小时内为您开通权益。');
      fetchStatus(); // Refresh status
      trackingService.track('complete_payment_client_claim', {
          plan_id: selectedPlan?.id
      });
   };

   // Fetch Recommended Jobs for Members
   useEffect(() => {
      const fetchRecommended = async () => {
         // Check user membership status correctly
         const isMember = (currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date()) || !!user?.roles?.admin;
         
         if (isMember) {
            try {
               const referralRes = await processedJobsService.getProcessedJobs(1, 6, { 
                  sourceFilter: 'referral',
                  sortBy: 'relevance'
               });

               let finalJobs = referralRes.jobs;

               if (finalJobs.length < 6) {
                   const needed = 6 - finalJobs.length;
                   const trustedRes = await processedJobsService.getProcessedJobs(1, needed, {
                       sourceFilter: 'trusted',
                       sortBy: 'relevance'
                   });
                   
                   const existingIds = new Set(finalJobs.map(j => j.id));
                   const newJobs = trustedRes.jobs.filter(j => !existingIds.has(j.id));
                   
                   finalJobs = [...finalJobs, ...newJobs];
               }

               if (finalJobs.length > 6) {
                   finalJobs = finalJobs.slice(0, 6);
               }

               setRecommendedJobs(finalJobs);
            } catch (error) {
               console.error('Failed to fetch recommended jobs:', error);
            }
         }
      };

      if (isAuthenticated && user) {
         fetchRecommended();
      }
   }, [isAuthenticated, user, currentMembership]);

   const isMember = (currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date()) || !!user?.roles?.admin;

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
         <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 text-white pt-24 pb-32 px-4 sm:px-6 lg:px-8">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
               <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-400/20 rounded-full blur-[100px] animate-pulse"></div>
               <div className="absolute top-40 right-1/4 w-80 h-80 bg-teal-400/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
               <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-bold tracking-widest uppercase mb-8 shadow-lg backdrop-blur-md">
                  <Crown className="w-3.5 h-3.5 fill-white/80" /> 
                  Upgrade to Premium
               </div>

               <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                  <span className="block text-white/80 text-2xl sm:text-3xl font-medium mb-3 tracking-normal">Join the Elite</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-teal-100 drop-shadow-sm">
                     Haigoo Member
                  </span>
               </h1>

               <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                  开启您的全球远程职业生涯。<br className="hidden sm:block" />
                  解锁海量内推机会，获取 AI 智能简历优化，加入精英远程工作者社区。
               </p>

               {/* Current Status Card */}
               {isMember && (
                  <div className="inline-flex items-center gap-4 bg-white/10 border border-white/20 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl">
                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-white" />
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Current Status</p>
                        <p className="font-bold text-white text-base flex items-center gap-3">
                           Haigoo Member
                           <span className="text-xs font-normal text-teal-100 bg-teal-500/20 px-2 py-0.5 rounded border border-teal-400/30">
                              Active
                           </span>
                           <button
                              onClick={() => setShowCertificateModal(true)}
                              className="text-xs flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded border border-white/20 transition-colors"
                              title="下载会员证书"
                           >
                              <Download className="w-3 h-3" />
                              证书
                           </button>
                        </p>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Pricing Plans Section */}
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 -mt-20 relative z-20">
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
               {plans.map((plan) => {
                  return (
                     <div 
                        key={plan.id}
                        className={`relative rounded-[2rem] p-8 border transition-all duration-300 hover:-translate-y-2 flex flex-col ${
                           plan.isPlus 
                              ? 'bg-slate-900 text-white border-slate-800 shadow-2xl shadow-indigo-500/20' 
                              : 'bg-white text-slate-900 border-slate-100 shadow-xl'
                        }`}
                     >
                        {plan.isPlus && (
                           <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-200 to-yellow-400 text-amber-900 text-xs font-bold px-4 py-1.5 rounded-full shadow-lg">
                              MOST POPULAR
                           </div>
                        )}

                        <div className="mb-8">
                           <h3 className={`text-lg font-bold mb-2 ${plan.isPlus ? 'text-indigo-300' : 'text-slate-500'}`}>
                              {plan.name}
                           </h3>
                           <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold">¥{plan.price}</span>
                              <span className={`text-sm ${plan.isPlus ? 'text-slate-400' : 'text-slate-500'}`}>/年</span>
                           </div>
                           <p className={`text-sm mt-4 ${plan.isPlus ? 'text-slate-400' : 'text-slate-500'}`}>
                              {plan.description}
                           </p>
                        </div>

                        <ul className="space-y-4 mb-8 flex-1">
                           {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-3">
                                 <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                    plan.isPlus ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-600'
                                 }`}>
                                    <Check className="w-3 h-3" />
                                 </div>
                                 <span className={`text-sm ${plan.isPlus ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {feature}
                                 </span>
                              </li>
                           ))}
                        </ul>

                        <button
                           onClick={() => handleSubscribe(plan)}
                           disabled={isMember}
                           className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                              isMember
                                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                 : plan.isPlus
                                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-200'
                           }`}
                        >
                           {isMember ? (
                              <>
                                 <CheckCircle2 className="w-5 h-5" />
                                 当前会员
                              </>
                           ) : (
                              <>
                                 立即升级
                                 <ArrowRight className="w-5 h-5" />
                              </>
                           )}
                        </button>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Member Dashboard */}
         {isAuthenticated && isMember && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 relative z-20">
               <div className="space-y-8">
                  {/* Status Info */}
                  <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden p-8 md:p-10">
                     <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200">
                           <Crown className="w-6 h-6 text-white" />
                        </div>
                        <div>
                           <h2 className="text-2xl font-bold text-slate-900">尊贵会员</h2>
                           <p className="text-slate-500">Haigoo Member</p>
                        </div>
                     </div>

                     <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
                        <div className="flex items-center gap-3 text-slate-700">
                           <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                           </div>
                           <span className="font-medium">申请已通过，会员权益已生效</span>
                        </div>
                        
                        <div className="flex items-center gap-3 text-slate-700">
                           <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                              <Calendar className="w-4 h-4 text-blue-600" />
                           </div>
                           <span className="font-medium">
                              有效期至：
                              {currentMembership?.expireAt 
                                 ? new Date(currentMembership.expireAt).toLocaleDateString() 
                                 : (user?.memberExpireAt ? new Date(user.memberExpireAt).toLocaleDateString() : '永久有效')}
                           </span>
                        </div>
                     </div>
                     
                     <div className="mt-6 flex gap-3">
                        <button 
                           onClick={() => navigate('/jobs')}
                           className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors inline-flex items-center gap-2 shadow-lg shadow-slate-200"
                        >
                           直通全站岗位
                           <ArrowRight className="w-4 h-4" />
                        </button>
                     </div>
                  </div>

                  {/* Recommended Jobs */}
                  <div>
                     <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                           <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                           会员专属推荐
                        </h3>
                        <button 
                           onClick={() => navigate('/jobs')}
                           className="text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1"
                        >
                           查看更多 <ChevronRight className="w-4 h-4" />
                        </button>
                     </div>
                     
                     <div className="flex flex-col gap-4">
                        {recommendedJobs.length > 0 ? (
                           recommendedJobs.map(job => (
                              <JobCardNew 
                                 key={job.id} 
                                 job={job} 
                                 variant="list"
                                 matchScore={job.matchScore || undefined}
                                 onClick={() => navigate(`/jobs?jobId=${job.id}`)}
                              />
                           ))
                        ) : (
                           <div className="w-full text-center py-12 bg-white rounded-2xl border border-slate-100 border-dashed">
                              <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-2" />
                              <p className="text-slate-500">正在为您生成推荐...</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* FAQ Section */}
         <div className="mt-24 max-w-4xl mx-auto pb-24 px-4">
            <div className="text-center mb-12">
               <h2 className="text-2xl font-bold text-slate-900 mb-4">常见问题解答</h2>
               <p className="text-slate-500">了解更多关于会员权益的细节</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
               {[
                  { q: "什么是内推直达？", a: "您可以在岗位申请页面选择邮箱直申，包括招聘邮箱、高管邮箱等（已经过认证的企业内部邮箱），让您的简历超过90%+候选人更快一步到达企业。" },
                  { q: "怎么加入会员？", a: "您可以选择上方的会员方案直接订阅，支付完成后，管理员将在24小时内为您开通权益。" },
                  { q: "这里的岗位可靠吗？", a: "当前所有岗位都经过了人工审核，对于会员用户还会通过历史申请记录的追踪来增强岗位可信度的判断。" },
                  { q: "远程岗位的薪资如何保障", a: "远程岗位里有全职、实习、合同工等多种情况，会依据具体企业、具体岗位来定，有些会在岗位详情页说明，有些需要在面试中沟通。" }
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

         {/* Certificate Modal */}
         {user && (
            <MembershipCertificateModal
               isOpen={showCertificateModal}
               onClose={() => setShowCertificateModal(false)}
               user={user}
            />
         )}

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
                                    onClick={() => setPaymentMethod('alipay')}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${paymentMethod === 'alipay'
                                       ? 'border-blue-500 bg-blue-50/30'
                                       : 'border-slate-100 hover:border-blue-100 hover:bg-blue-50/10'
                                       }`}
                                 >
                                    {paymentMethod === 'alipay' && (
                                       <div className="absolute top-2 right-2 text-blue-500">
                                          <Check className="w-4 h-4" />
                                       </div>
                                    )}
                                    <span className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                       <Zap className="w-5 h-5" />
                                    </span>
                                    <span className="text-slate-900 font-bold text-sm">支付宝</span>
                                 </button>

                                 <button
                                    onClick={() => setPaymentMethod('wechat')}
                                    className={`relative p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${paymentMethod === 'wechat'
                                       ? 'border-green-500 bg-green-50/30'
                                       : 'border-slate-100 hover:border-green-100 hover:bg-green-50/10'
                                       }`}
                                 >
                                    {paymentMethod === 'wechat' && (
                                       <div className="absolute top-2 right-2 text-green-500">
                                          <Check className="w-4 h-4" />
                                       </div>
                                    )}
                                    <span className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform">
                                       <ShieldCheck className="w-5 h-5" />
                                    </span>
                                    <span className="text-slate-900 font-bold text-sm">微信支付</span>
                                 </button>
                              </div>
                           </div>

                           <button
                              onClick={handleCreatePayment}
                              className="w-full py-4 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-slate-200 hover:shadow-indigo-200 transition-all transform active:scale-[0.98] flex items-center justify-center gap-2"
                           >
                              下一步 <ArrowRight className="w-5 h-5" />
                           </button>
                        </div>
                     ) : (
                        <div className="text-center">
                           <div className="mb-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                              {paymentInfo.imageUrl && (
                                 <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 inline-block mb-4">
                                    <img src={paymentInfo.imageUrl} alt="Payment QR" className="w-48 h-auto object-contain rounded-lg" />
                                 </div>
                              )}

                              <p className="text-slate-800 font-bold mb-2 text-lg">{paymentInfo.instruction}</p>
                              
                              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 mb-2 text-left">
                                 <p className="font-bold mb-1">⚠️ 重要提示：</p>
                                 <p>付款时请务必在【添加备注】处填入您的注册邮箱：</p>
                                 <div className="mt-2 flex items-center gap-2 bg-white p-2 rounded border border-amber-200">
                                    <code className="flex-1 font-mono text-slate-700 break-all">{user?.email || '您的邮箱'}</code>
                                    <button 
                                        onClick={() => {
                                            navigator.clipboard.writeText(user?.email || '');
                                            alert('邮箱已复制');
                                        }}
                                        className="text-amber-600 hover:text-amber-700"
                                        title="复制邮箱"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                 </div>
                              </div>
                           </div>

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
                                 返回重新选择
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
