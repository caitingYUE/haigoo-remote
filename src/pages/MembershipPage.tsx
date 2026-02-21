
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, Gift, Users, ChevronRight, Loader2, Send, CheckCircle2, Calendar, Download, X, Copy, FileText, Briefcase, Target, Globe, Award, Quote, Sparkles, Landmark, Building, GraduationCap, Bot, Cpu, Brain, HardDrive, CircuitBoard } from 'lucide-react';
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
   originalPrice?: number;
   discountLabel?: string;
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
      id: 'club_go_quarterly',
      name: '海狗远程俱乐部会员 (季度)',
      price: 199,
      currency: 'CNY',
      duration_days: 90,
      features: [
         '解锁全部高薪远程职位（含内推）',
         'AI 远程工作助手 (无限次)',
         'AI 简历优化（无限次）',
         '加入精英远程工作者社区',
         '获取独家远程工作指南'
      ],
      description: '适合短期冲刺的求职者，快速获得内推机会'
   },
   {
      id: 'goo_plus_yearly',
      name: '海狗远程俱乐部会员 (年度)',
      price: 999,
      originalPrice: 1999,
      discountLabel: '早鸟价 · 6月1日恢复原价',
      currency: 'CNY',
      duration_days: 365,
      isPlus: true,
      features: [
         '包含季度会员所有权益',
         '1V1 远程求职咨询（1次，60分钟以内）',
         '专家简历精修 或 模拟面试 (二选一)',
         '优先成为俱乐部城市主理人，共享收益',
         '合作企业优先定向直推'
      ],
      description: '适合致力于长期职业发展的专业人士，建立个人品牌'
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
      setPaymentMethod('alipay'); // Reset default
      setShowPaymentModal(true);
      trackingService.track('click_subscribe', {
         plan_id: plan.id,
         plan_name: plan.name,
         price: plan.price
      });
   };

   // Simplified flow: Payment info is derived directly from state
   const currentPaymentInfo: PaymentInfo = {
      type: 'qrcode',
      imageUrl: (() => {
         if (selectedPlan?.price === 999) {
            return paymentMethod === 'alipay' ? '/alipay_999.jpg' : '/wechatpay_999.png';
         }
         return paymentMethod === 'alipay' ? '/alipay.jpg' : '/wechatpay.png';
      })(),
      instruction: `请使用${paymentMethod === 'alipay' ? '支付宝' : '微信'}扫码支付`
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
      alert('感谢您的支付！权益将在24小时内开通。如有疑问请联系 hi@haigooremote.com');
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
      <div className="min-h-screen bg-[#F8F9FC] font-sans selection:bg-indigo-500/30">
         {/* Hero Section */}
         <div className="relative overflow-hidden pt-28 pb-0 px-4 sm:px-6 lg:px-8">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
               <img 
                  src="/members.webp?v=2" 
                  alt="Membership Hero Background" 
                  className="w-full h-full object-cover object-center opacity-30"
               />
               <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 via-white/60 to-[#F8F9FC]"></div>
            </div>

            <div className="relative z-10 max-w-5xl mx-auto text-center flex flex-col items-center">
               <h1 className="text-5xl sm:text-6xl md:text-[72px] font-extrabold tracking-tight mb-6 leading-[1.1] text-slate-900 drop-shadow-sm">
                  <span className="block mb-2">解锁全球远程机遇</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600">
                     开启无界职业生涯
                  </span>
               </h1>

               <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                  AI 驱动的求职工具、经人工核验的优质机会、互助成长的精英社区。<br className="hidden md:block" />
                  打破地域限制，您的全球职业生涯从这里起航。
               </p>

               <button
                  onClick={() => {
                     const el = document.getElementById('pricing-plans');
                     el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold rounded-full shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all text-base flex items-center gap-2 group"
               >
                  探索会员方案
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
               </button>

               {/* Current Status Card */}
               {isMember && (
                  <div className="mt-12 inline-flex items-center gap-5 bg-white/80 backdrop-blur-md border border-white/50 px-8 py-4 rounded-2xl shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all cursor-default ring-1 ring-white">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Crown className="w-6 h-6 text-white" />
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">当前状态</p>
                        <div className="flex items-center gap-3">
                           <p className="font-bold text-slate-900 text-lg">海狗会员</p>
                           <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                              生效中
                           </span>
                        </div>
                     </div>
                     <div className="h-8 w-px bg-slate-200 mx-2"></div>
                     <button
                        onClick={() => setShowCertificateModal(true)}
                        className="text-xs font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-all group"
                     >
                        <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                        下载证书
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* Benefits Section */}
         <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 mt-12">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-bold text-slate-900 mb-3">会员权益 & 职业加速</h2>
               <p className="text-slate-500 text-lg">专享俱乐部核心权益，为您铺展成功之路</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
               {/* Benefit 1 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                     <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">AI 远程工作助手<br /><span className="text-base text-slate-700 font-semibold mt-1 block">智能求职 Copilot</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     AI 驱动的远程求职助手，为您提供简历诊断、模拟面试、职位匹配等全方位智能辅助。
                  </p>
               </div>
               {/* Benefit 2 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                     <Briefcase className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">精选高薪岗位直达<br /><span className="text-base text-slate-700 font-semibold mt-1 block">高薪岗位直达通道</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     优先获取未公开的高薪全球远程职位。专注于经过验证的远程机会，拒绝低质量信息。
                  </p>
               </div>
               {/* Benefit 3 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-6">
                     <Target className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">个性化职业规划<br /><span className="text-base text-slate-700 font-semibold mt-1 block">专家级 1V1 职业规划</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     1对1 指导，明确您的远程职业路径，驾驭全球招聘文化，打造个人全球品牌。
                  </p>
               </div>
            </div>
         </div>

         {/* Pricing Plans Section */}
         <div id="pricing-plans" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-20">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">选择您的全球成功之路</h2>
               <p className="text-slate-500 text-lg">选择最适合您的探索方案，即刻启程</p>
            </div>
            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto items-center">
               {plans.map((plan) => {
                  return (
                     <div
                        key={plan.id}
                        className={`relative rounded-[2.5rem] p-10 transition-all duration-500 group flex flex-col bg-white ${plan.isPlus
                              ? 'border-2 border-indigo-200 shadow-2xl shadow-indigo-200/50 hover:-translate-y-2 z-10 md:scale-105'
                              : 'border shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/80 hover:-translate-y-1 border-slate-200'
                           }`}
                     >
                        {plan.isPlus && (
                           <div className="absolute -top-4 right-8 bg-gradient-to-r from-indigo-600 to-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 tracking-widest uppercase flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 fill-white" />
                              最受欢迎
                           </div>
                        )}

                        <div className="mb-8 text-center border-b border-slate-100 pb-8">
                           <h3 className={`text-2xl font-extrabold mb-3 text-slate-900`}>
                              {plan.name}
                           </h3>
                           <div className="flex justify-center items-baseline gap-1 mb-2">
                              {plan.originalPrice && (
                                 <span className="text-lg text-slate-400 line-through mr-1 font-medium">
                                    ¥{plan.originalPrice}
                                 </span>
                              )}
                              <span className="text-5xl font-extrabold tracking-tight text-slate-900">¥{plan.price}</span>
                              <span className="text-sm font-bold text-slate-500">
                                 /{plan.duration_days > 90 ? '年' : '季度'}
                              </span>
                           </div>
                           
                           <div className="mb-4 flex flex-col items-center gap-2 min-h-[3.5rem]">
                              {plan.discountLabel && (
                                 <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-50 text-slate-500 text-xs font-medium border border-slate-200">
                                    {plan.discountLabel}
                                 </span>
                              )}
                              {plan.originalPrice && plan.originalPrice > plan.price && (
                                 <span className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    限时立省 ¥{plan.originalPrice - plan.price}
                                 </span>
                              )}
                           </div>

                           <p className="text-sm text-slate-500 font-medium px-4">
                              {plan.isPlus ? '适合致力于长期职业发展与个人品牌建设' : '适合专注短期成长与快速求职'}
                           </p>
                           <p className="text-xs text-slate-400 mt-2 px-4 line-clamp-2 min-h-8">
                              {plan.description}
                           </p>
                        </div>

                        <ul className="space-y-4 mb-10 flex-1 px-2">
                           {plan.features.map((feature, idx) => (
                              <li key={idx} className="flex items-start gap-4">
                                 <div className="mt-0.5 w-6 h-6 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-5 h-5 text-indigo-500" strokeWidth={3} />
                                 </div>
                                 <span className="text-[15px] font-medium leading-relaxed text-slate-700">
                                    {feature}
                                 </span>
                              </li>
                           ))}
                        </ul>

                        <button
                           onClick={() => handleSubscribe(plan)}
                           disabled={isMember}
                           className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 relative overflow-hidden group/btn ${isMember
                                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                 : plan.isPlus
                                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xl shadow-indigo-500/30'
                                    : 'bg-[#0F172A] hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                              }`}
                        >
                           {isMember ? (
                              <>
                                 <CheckCircle2 className="w-5 h-5" />
                                 当前会员 (生效中)
                              </>
                           ) : plan.isPlus ? (
                              <>
                                 解锁高级权益
                                 <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                              </>
                           ) : (
                              <>
                                 立即加入
                                 <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                              </>
                           )}
                        </button>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* Social Proof: Success Stories */}
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-extrabold text-slate-900 mb-3">来自社区的成功故事</h2>
               <p className="text-slate-500 text-lg">来自海狗远程俱乐部的一线反馈</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
               <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative">
                  <Quote className="absolute top-6 left-6 w-10 h-10 text-indigo-100 fill-indigo-50" />
                  <p className="text-slate-700 leading-relaxed font-medium mb-8 relative z-10 pl-6 pt-2">
                     "在这里遇到了自己非常喜欢的工作，跟专业背景对口，薪资很满意，还帮我拓展了海外客户。非常感谢海狗远程俱乐部。"
                  </p>
                  <div className="flex items-center gap-4">
                     <img src="/flora.jpg" alt="Flora" className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                     <div>
                        <div className="font-bold text-slate-900">Flora</div>
                        <div className="text-sm text-slate-500">心理咨询师</div>
                     </div>
                  </div>
               </div>

               <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative">
                  <Quote className="absolute top-6 left-6 w-10 h-10 text-blue-100 fill-blue-50" />
                  <p className="text-slate-700 leading-relaxed font-medium mb-8 relative z-10 pl-6 pt-2">
                     "很满意通过这个找到了工作，也顺利入职了。如果遇到和自己匹配的岗位，各位不妨试一试及时出手。"
                  </p>
                  <div className="flex items-center gap-4">
                     <img src="/fuduoduo.jpg" alt="福多多" className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                     <div>
                        <div className="font-bold text-slate-900">福多多</div>
                        <div className="text-sm text-slate-500">粤语客服</div>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Trusted Partners */}
         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center mt-8 mb-16">
            <h3 className="text-base font-bold text-slate-400 uppercase tracking-widest mb-10">全球合作伙伴信赖</h3>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><HardDrive className="w-6 h-6" /> Red Mountain</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><Building className="w-6 h-6" /> Bodhitree Group</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><GraduationCap className="w-6 h-6" /> VitaStep</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><CircuitBoard className="w-6 h-6" /> ClarityInfra</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><Landmark className="w-6 h-6" /> Fintech社区</div>
            </div>
         </div>

         {/* Member Dashboard */}
         {isAuthenticated && isMember && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 relative z-20">
               <div className="space-y-8">
                  {/* Status Info */}
                  <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden p-8 md:p-12 relative group">
                     <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Crown className="w-32 h-32 text-indigo-500 transform rotate-12" />
                     </div>

                     <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-8">
                           <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30 rotate-3">
                              <Crown className="w-7 h-7 text-white" />
                           </div>
                           <div>
                              <h2 className="text-2xl font-bold text-slate-900">尊贵会员权益已生效</h2>
                              <p className="text-slate-500 font-medium">Haigoo Premium Member</p>
                           </div>
                        </div>

                        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 mb-8">
                           <div className="flex items-center gap-3 text-slate-700">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                 <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              </div>
                              <span className="font-medium">您的会员申请已通过，所有高级权益已解锁</span>
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

                        <div className="flex flex-wrap gap-4">
                           <button
                              onClick={() => navigate('/jobs')}
                              className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2 shadow-lg shadow-slate-900/20"
                           >
                              直通全站岗位
                              <ArrowRight className="w-4 h-4" />
                           </button>
                           <button
                              onClick={() => setShowCertificateModal(true)}
                              className="px-8 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-all hover:-translate-y-0.5 inline-flex items-center gap-2"
                           >
                              <Download className="w-4 h-4" />
                              下载会员证书
                           </button>
                        </div>
                     </div>
                  </div>

                  {/* Recommended Jobs */}
                  <div>
                     <div className="flex items-center justify-between mb-8">
                        <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                           <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                           会员专属推荐
                        </h3>
                        <button
                           onClick={() => navigate('/jobs')}
                           className="text-sm text-indigo-600 font-bold hover:text-indigo-700 hover:underline flex items-center gap-1 transition-colors"
                        >
                           查看更多 <ChevronRight className="w-4 h-4" />
                        </button>
                     </div>

                     <div className="grid gap-4">
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
                           <div className="w-full text-center py-16 bg-white rounded-3xl border border-slate-100 border-dashed">
                              <Loader2 className="w-10 h-10 text-slate-300 animate-spin mx-auto mb-4" />
                              <p className="text-slate-500 font-medium">正在利用 AI 为您匹配最适合的岗位...</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* FAQ Section */}
         <div className="max-w-4xl mx-auto pb-32 px-4">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold text-slate-900 mb-4">常见问题解答</h2>
               <p className="text-slate-500 text-lg">了解更多关于会员权益的细节</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
               {[
                  { q: "什么是内推直达？", a: "您可以在岗位申请页面选择邮箱直申，包括招聘邮箱、高管邮箱等（已经过认证的企业内部邮箱），让您的简历超过90%+候选人更快一步到达企业。" },
                  { q: "怎么加入会员？", a: "您可以选择上方的会员方案直接订阅，支付完成后，管理员将在24小时内为您开通权益。" },
                  { q: "这里的岗位可靠吗？", a: "当前所有岗位都经过了人工审核，对于会员用户还会通过历史申请记录的追踪来增强岗位可信度的判断。" },
                  { q: "远程岗位的薪资如何保障", a: "远程岗位里有全职、实习、合同工等多种情况，会依据具体企业、具体岗位来定，有些会在岗位详情页说明，有些需要在面试中沟通。" }
               ].map((faq, i) => (
                  <div key={i} className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm hover:shadow-md transition-all hover:-translate-y-1">
                     <h3 className="font-bold text-slate-900 mb-4 flex items-start gap-3 text-lg">
                        <span className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm flex-shrink-0 mt-0.5">?</span>
                        {faq.q}
                     </h3>
                     <p className="text-slate-500 leading-relaxed pl-9">{faq.a}</p>
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

               <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-300 scale-100 flex flex-col md:flex-row max-h-[90vh] md:max-h-[600px]">
                  {/* Left Side: Order Details */}
                  <div className="w-full md:w-5/12 bg-slate-50 border-r border-slate-100 p-8 flex flex-col">
                     <div className="flex justify-between items-center mb-8 md:hidden">
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

                     <div className="mb-10">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">订阅方案</p>
                        <h4 className="font-bold text-slate-900 text-3xl mb-3 leading-tight">{selectedPlan.name}</h4>
                        <div className="flex items-baseline gap-1">
                           <span className="text-4xl font-bold text-slate-900">¥{selectedPlan.price}</span>
                           <span className="text-sm font-medium text-slate-500">/{selectedPlan.duration_days > 90 ? '年' : '季度'}</span>
                        </div>
                     </div>

                     <div className="flex-1">
                        <p className="font-bold text-slate-900 mb-4 text-sm">选择支付方式</p>
                        <div className="space-y-3">
                           <button
                              onClick={() => setPaymentMethod('alipay')}
                              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 group ${paymentMethod === 'alipay'
                                 ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                 : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                                 }`}
                           >
                              <span className="w-10 h-10 rounded-full bg-[#1677FF] text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                 <Zap className="w-5 h-5 fill-current" />
                              </span>
                              <span className="text-slate-900 font-bold text-sm flex-1 text-left">支付宝</span>
                              {paymentMethod === 'alipay' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                           </button>

                           <button
                              onClick={() => setPaymentMethod('wechat')}
                              className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 group ${paymentMethod === 'wechat'
                                 ? 'border-green-500 bg-green-50/50 shadow-sm'
                                 : 'border-slate-200 bg-white hover:border-green-200 hover:bg-slate-50'
                                 }`}
                           >
                              <span className="w-10 h-10 rounded-full bg-[#07C160] text-white flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                 <ShieldCheck className="w-5 h-5" />
                              </span>
                              <span className="text-slate-900 font-bold text-sm flex-1 text-left">微信支付</span>
                              {paymentMethod === 'wechat' && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                           </button>
                        </div>
                     </div>

                     <div className="mt-8 pt-6 border-t border-slate-200 hidden md:block">
                        <p className="text-xs text-slate-400 leading-relaxed">
                           如有任何支付问题，请联系客服邮箱：<br />
                           <a href="mailto:hi@haigooremote.com" className="text-indigo-600 font-medium hover:underline">hi@haigooremote.com</a>
                        </p>
                     </div>
                  </div>

                  {/* Right Side: QR Code */}
                  <div className="w-full md:w-7/12 bg-white p-8 md:p-12 flex flex-col items-center justify-center text-center relative overflow-y-auto">
                     <button
                        onClick={() => setShowPaymentModal(false)}
                        className="absolute top-6 right-6 w-8 h-8 hidden md:flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                     >
                        <span className="text-xl leading-none">&times;</span>
                     </button>

                     <div className="mb-8 w-full max-w-xs mx-auto">
                        <div className="bg-white p-4 rounded-3xl shadow-xl border border-slate-100 inline-block mb-6 transform transition-transform hover:scale-105 duration-300">
                           <img
                              src={currentPaymentInfo.imageUrl}
                              alt="Payment QR"
                              className="w-48 h-48 object-contain rounded-xl"
                           />
                        </div>
                        <p className="text-slate-900 font-bold text-xl mb-2">{currentPaymentInfo.instruction}</p>
                        <p className="text-slate-500 text-sm">请使用手机扫码完成支付</p>
                     </div>

                     <div className="w-full max-w-sm">
                        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-sm text-amber-900 mb-8 text-left shadow-sm">
                           <p className="font-bold mb-3 flex items-center gap-2 text-amber-700">
                              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                              重要：付款备注说明
                           </p>
                           <p className="mb-3 text-amber-800/80 leading-relaxed">付款时请务必在【添加备注】处填入您的注册邮箱，以便系统自动核销：</p>
                           <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-amber-200 shadow-sm group cursor-pointer hover:border-amber-300 transition-all hover:shadow-md"
                              onClick={() => {
                                 navigator.clipboard.writeText(user?.email || '');
                                 alert('邮箱已复制');
                              }}
                           >
                              <code className="flex-1 font-mono text-slate-700 break-all font-bold select-all text-base">{user?.email || '您的邮箱'}</code>
                              <Copy className="w-4 h-4 text-amber-400 group-hover:text-amber-600" />
                           </div>
                        </div>

                        <button
                           onClick={handlePaymentComplete}
                           className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-lg"
                        >
                           <CheckCircle2 className="w-5 h-5" />
                           我已完成支付
                        </button>
                        <p className="text-xs text-slate-400 mt-4 font-medium">
                           * 支付后权益将在 24 小时内开通
                        </p>

                        <div className="mt-6 pt-6 border-t border-slate-100 md:hidden text-center">
                           <p className="text-xs text-slate-400">
                              客服邮箱：<a href="mailto:hi@haigooremote.com" className="text-indigo-600 font-medium">hi@haigooremote.com</a>
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
};

export default MembershipPage;
