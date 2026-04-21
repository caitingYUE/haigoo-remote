
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, ChevronRight, Loader2, CheckCircle2, Calendar, Download, Copy, Sparkles, Landmark, Building, GraduationCap, HardDrive, CircuitBoard, Target, Quote, Briefcase, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import JobCardNew from '../components/JobCardNew';
import { processedJobsService } from '../services/processed-jobs-service';
import { trackingService } from '../services/tracking-service';
import { MembershipCertificateModal } from '../components/MembershipCertificateModal';
import WeChatCommunityPanel from '../components/WeChatCommunityPanel';
import { deriveMembershipCapabilities } from '../utils/membership';

const MEMBERSHIP_VALUE_PILLS = [
   '无限申请次数',
   '无限内推次数',
   '岗位匹配分析',
   '全站岗位解锁',
   '精选企业解锁'
];

const MEMBERSHIP_COMPARISON_ROWS = [
   {
      label: '获得全站所有岗位信息',
      free: '有限开放',
      trial_week: true,
      quarter: true,
      year: true
   },
   {
      label: '获得企业关键联系人、邮箱直申机会',
      free: '有限体验',
      trial_week: true,
      quarter: true,
      year: true
   },
   {
      label: '获得更完整的岗位匹配建议',
      free: '有限体验',
      trial_week: true,
      quarter: true,
      year: true
   },
   {
      label: '获得优先的需求响应和人工支持',
      free: false,
      trial_week: false,
      quarter: true,
      year: true
   },
   {
      label: '获得会员群的人工精选岗位推荐',
      free: false,
      trial_week: true,
      quarter: true,
      year: true
   },
   {
      label: '开放精选企业完整名单',
      free: false,
      trial_week: false,
      quarter: true,
      year: true
   },
   {
      label: '1 次 1 对 1 求职策略诊断',
      free: false,
      trial_week: false,
      quarter: false,
      year: '筹备中'
   },
   {
      label: '简历精修或模拟面试 1 次',
      free: false,
      trial_week: false,
      quarter: false,
      year: '筹备中'
   },
   {
      label: '重点机会跟进建议',
      free: false,
      trial_week: false,
      quarter: false,
      year: '筹备中'
   }
] as const;

const PLAN_CARD_SUMMARIES: Record<'free' | 'trial_week' | 'quarter' | 'year', {
   title: string;
   price: string;
   unit: string;
   tagline: string;
   highlights: string[];
}> = {
   free: {
      title: '免费版',
      price: '¥0',
      unit: '/ 当前',
      tagline: '先看看岗位，体验基础能力',
      highlights: [
         '浏览岗位与基础申请',
         '20 次申请机会',
         '3 次内推/联系人体验'
      ]
   },
   trial_week: {
      title: '7 天会员',
      price: '¥29.9',
      unit: '/ 7 天',
      tagline: '适合短期集中投递',
      highlights: [
         '无限申请次数',
         '无限内推次数',
         '邮箱直申 + 关键联系人'
      ]
   },
   quarter: {
      title: '季度会员',
      price: '¥199',
      unit: '/ 季度',
      tagline: '适合持续推进远程求职',
      highlights: [
         '全站岗位解锁',
         '精选企业完整名单',
         '优先人工支持'
      ]
   },
   year: {
      title: '1 对 1 服务',
      price: '筹备中',
      unit: '',
      tagline: '更深一层的人工求职支持',
      highlights: [
         '策略诊断',
         '简历精修或模拟面试',
         '重点机会跟进建议'
      ]
   }
};

interface Plan {
   id: string;
   memberType: 'trial_week' | 'quarter' | 'year';
   name: string;
   shortLabel?: string;
   liteLabel?: string;
   price: number;
   originalPrice?: number;
   discountLabel?: string;
   currency: string;
   features: string[];
   duration_days: number;
   description?: string;
   ctaHint?: string;
   isPlus?: boolean;
   tier?: 'trial' | 'full';
   wechat_qr?: string;
   alipay_qr?: string;
   comingSoon?: boolean;
}

interface PaymentInfo {
   type: string;
   url?: string;
   imageUrl?: string;
   instruction: string;
}

type MembershipPlanColumnKey = 'free' | 'trial_week' | 'quarter' | 'year';

const STATIC_PLANS: Plan[] = [
   {
      id: 'trial_week_lite',
      memberType: 'trial_week',
      name: '海狗远程俱乐部体验会员（周）',
      shortLabel: '体验会员',
      liteLabel: 'Lite',
      price: 29.9,
      currency: 'CNY',
      duration_days: 7,
      discountLabel: '7 天体验',
      tier: 'trial',
      alipay_qr: '/alipay_mini.jpg',
      wechat_qr: '/Wechatpay_mini.png',
      features: [
         '解锁全部高薪远程职位（含内推）',
         '无限申请次数与高价值投递入口',
         '无限内推次数',
         '查看岗位相关 HR / 负责人联系方式',
         'AI 远程工作助手（无限次）',
         'AI 简历优化（无限次）',
         '高价值邮箱直申与内推通道',
         '加入精英远程工作者社区'
      ],
      description: '适合短期集中推进申请，快速打开岗位、联系人和邮箱直申能力。'
   },
   {
      id: 'club_go_quarterly',
      memberType: 'quarter',
      name: '海狗远程俱乐部会员 (季度)',
      shortLabel: '季度会员',
      price: 199,
      currency: 'CNY',
      duration_days: 90,
      discountLabel: '适合 1-3 个月认真找工作',
      tier: 'full',
      features: [
         '解锁全部高薪远程职位（含内推）',
         '无限申请次数与高价值投递入口',
         '无限内推次数',
         '查看岗位相关 HR / 负责人联系方式',
         'AI 远程工作助手 (无限次)',
         'AI 简历优化（无限次）',
         '高价值邮箱直申与内推通道',
         '加入精英远程工作者社区',
         '解锁精选企业完整名单',
         '人工 1 对 1 咨询优先服务'
      ],
      description: '适合持续推进远程求职，在一个完整周期里系统提升申请效率。'
   },
   {
      id: 'goo_plus_yearly',
      memberType: 'year',
      name: '海狗远程俱乐部会员 (年度)',
      shortLabel: '年度会员',
      price: 999,
      currency: 'CNY',
      duration_days: 365,
      comingSoon: true,
      isPlus: true,
      tier: 'full',
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

const PLAN_MARKETING_COPY: Record<Plan['memberType'], {
   name: string;
   shortLabel: string;
   discountLabel: string;
   description: string;
   features: string[];
   ctaHint: string;
   comingSoon?: boolean;
   isPlus?: boolean;
}> = {
   trial_week: {
      name: '体验会员（7天）',
      shortLabel: '体验会员',
      discountLabel: '7 天体验',
      description: '适合短期集中推进申请，快速打开岗位、联系人和邮箱直申能力。',
      features: [
         '获得全站所有岗位信息',
         '获得企业关键联系人、邮箱直申机会',
         '获得更完整的岗位匹配建议',
         '获得会员群的人工精选岗位推荐'
      ],
      ctaHint: '适合先集中推进一轮申请'
   },
   quarter: {
      name: '季度会员',
      shortLabel: '季度会员',
      discountLabel: '适合 1-3 个月认真找工作',
      description: '适合正在持续推进远程求职的用户，把申请效率、企业线索和人工支持一起拉满。',
      features: [
         '获得全站所有岗位信息',
         '获得企业关键联系人、邮箱直申机会',
         '获得更完整的岗位匹配建议',
         '获得优先的需求响应和人工支持',
         '获得会员群的人工精选岗位推荐',
         '开放精选企业完整名单',
         '人工 1 对 1 咨询优先服务'
      ],
      ctaHint: '适合持续推进远程求职',
      isPlus: true
   },
   year: {
      name: '1 对 1 服务（筹备中）',
      shortLabel: '1 对 1 服务',
      discountLabel: '单独开放 · 另行说明',
      description: '简历精修、策略诊断、模拟面试等服务会单独开放，不和会员方案混在一起。',
      features: [
         '包含季度会员全部权益',
         '1 次 1 对 1 求职策略诊断',
         '简历精修或模拟面试 1 次',
         '重点机会跟进建议'
      ],
      ctaHint: '当前正在筹备中',
      comingSoon: true
   }
};

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

   const membershipCapabilities = deriveMembershipCapabilities(user);
   const isMember = (currentMembership?.isActive) || membershipCapabilities.isActive || !!user?.roles?.admin;
   const activeMemberType = (currentMembership?.memberType || membershipCapabilities.memberType);
   const isTrialMember = activeMemberType === 'trial_week';
   const displayPlans = ['trial_week', 'quarter', 'year'].map((memberType) => {
      const basePlan = plans.find((plan) => plan.memberType === memberType) || STATIC_PLANS.find((plan) => plan.memberType === memberType)!
      const marketingCopy = PLAN_MARKETING_COPY[memberType as Plan['memberType']]
      return {
         ...basePlan,
         name: marketingCopy.name,
         shortLabel: marketingCopy.shortLabel,
         discountLabel: marketingCopy.discountLabel,
         description: marketingCopy.description,
         features: marketingCopy.features,
         ctaHint: marketingCopy.ctaHint,
         comingSoon: marketingCopy.comingSoon ?? basePlan.comingSoon,
         isPlus: marketingCopy.isPlus ?? basePlan.isPlus
      }
   });

   useEffect(() => {
      setPlans(STATIC_PLANS);
      setLoading(false);

      fetchPlans();

      if (isAuthenticated) {
         fetchStatus();
         fetchApplicationStatus();
      }
      trackingService.track('view_membership_page', {
         page_key: 'membership',
         module: 'membership_page',
         feature_key: 'membership_center',
         source_key: 'membership_page'
      });
      trackingService.featureExposure('membership_center', {
         page_key: 'membership',
         module: 'membership_page',
         source_key: 'membership_page'
      });
   }, [isAuthenticated]);

   const fetchPlans = async () => {
      try {
         const res = await axios.get('/api/membership?action=plans');
         if (res.data?.success && Array.isArray(res.data.plans) && res.data.plans.length > 0) {
            setPlans(res.data.plans);
         }
      } catch (error) {
         console.error('Failed to fetch membership plans', error);
      }
   };

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
      const planFeatureKey = plan.memberType === 'trial_week'
         ? 'membership_plan_trial_week'
         : plan.memberType === 'quarter'
            ? 'membership_plan_quarter'
            : 'membership_plan_year';
      trackingService.track('membership_plan_click', {
         page_key: 'membership',
         module: 'membership_pricing',
         feature_key: planFeatureKey,
         source_key: 'membership_page',
         entity_type: 'plan',
         entity_id: plan.id,
         plan_id: plan.id,
         plan_name: plan.name,
         price: plan.price
      });
      trackingService.track('click_subscribe', {
         plan_id: plan.id,
         plan_name: plan.name,
         price: plan.price
      });
   };

   // Simplified flow: Payment info is derived directly from state
   const currentPaymentInfo: PaymentInfo = {
      type: 'qrcode',
      imageUrl: paymentMethod === 'alipay'
         ? (selectedPlan?.alipay_qr || (selectedPlan?.price === 999 ? '/alipay_999.jpg' : '/alipay.jpg'))
         : (selectedPlan?.wechat_qr || (selectedPlan?.price === 999 ? '/wechatpay_999.png' : '/wechatpay.png')),
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
               email: user?.email,
               page_key: 'membership',
               source_key: 'membership_page',
               flow_id: selectedPlan?.id,
            }, { headers: { Authorization: `Bearer ${token}` } });
         }
      } catch (e) {
         console.error('Failed to report payment claim', e);
      }

      setShowPaymentModal(false);
      alert('感谢您的支付！权益将在24小时内开通。如有疑问请联系 hi@haigooremote.com');
      fetchStatus(); // Refresh status
      trackingService.track('complete_payment_client_claim', {
         page_key: 'membership',
         module: 'membership_payment',
         source_key: 'membership_page',
         entity_type: 'plan',
         entity_id: selectedPlan?.id,
         plan_id: selectedPlan?.id
      });
   };

   // Fetch Recommended Jobs for Members
   useEffect(() => {
      const fetchRecommended = async () => {
         // Check user membership status correctly
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

   if (loading) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
         </div>
      );
   }

   return (
      <div className="min-h-screen bg-[#F8F9FC] font-sans selection:bg-indigo-500/30">
         {/* Hero Section (Visible to EVERYONE) */}
         <div className="relative overflow-hidden pt-24 md:pt-32 pb-0 px-4 sm:px-6 lg:px-8">
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
                  <span className="block mb-2">少走弯路</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600">
                     更快拿到有效结果
                  </span>
               </h1>

               {!(isAuthenticated && isMember) && (
                  <button
                     onClick={() => {
                        const el = document.getElementById('pricing-plans');
                        el?.scrollIntoView({ behavior: 'smooth' });
                     }}
                     className="px-10 py-4 bg-gradient-to-r from-indigo-600 to-indigo-600 text-white font-bold rounded-full shadow-xl shadow-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/40 hover:-translate-y-1 transition-all text-base flex items-center gap-2 group"
                  >
                     查看会员方案
                     <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
               )}

               <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  {MEMBERSHIP_VALUE_PILLS.map((pill) => (
                     <span
                        key={pill}
                        className="inline-flex items-center rounded-full border border-white/80 bg-white/85 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur"
                     >
                        {pill}
                     </span>
                  ))}
               </div>
            </div>
         </div>

         {/* The old gradient status bar has been permanently removed based on user feedback. */}

         {/* Member Dashboard (Prioritized for Members) */}
         {isAuthenticated && isMember && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-20">
               <div className="space-y-8">
                  {/* Member Status Card — 2-column: info left, QR right */}
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 md:p-10 flex flex-col sm:flex-row gap-8 lg:gap-12 relative overflow-hidden">
                     <div className="flex flex-col sm:flex-row gap-8 lg:gap-12 w-full">
                        {/* Left: member info */}
                        <div className="flex-1 flex flex-col">
                           {/* Title */}
                           <div className="flex items-center gap-3 mb-5">
                              <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-500 rounded-full flex items-center justify-center shadow-md shrink-0">
                                 <Crown className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                 <div className="text-xl font-bold text-slate-900">{isTrialMember ? '体验会员' : '会员用户'}</div>
                                 <div className="text-sm text-slate-400">{isTrialMember ? '7 天体验中' : '会员有效期内'}</div>
                              </div>
                           </div>

                           {/* Status rows */}
                           <div className="bg-slate-50/80 rounded-xl p-4 space-y-3 mb-5 border border-slate-100">
                              <div className="flex items-center gap-3 text-sm text-slate-700">
                                 <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                 </div>
                                 {isTrialMember ? '体验会员权益已生效' : '会员权益已生效'}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-700">
                                 <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                    <Calendar className="w-3.5 h-3.5 text-blue-500" />
                                 </div>
                                 有效期至：{currentMembership?.expireAt
                                    ? new Date(currentMembership.expireAt).toLocaleDateString()
                                    : (user?.memberExpireAt ? new Date(user.memberExpireAt).toLocaleDateString() : '永久有效')}
                              </div>
                              <div className="flex items-center gap-3 text-sm text-slate-700">
                                 <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                 </div>
                                 今日剩余翻译次数：无限次
                              </div>
                           </div>

                           {/* Actions */}
                           <div className="flex items-center gap-3">
                              <button
                                 onClick={() => navigate('/jobs')}
                                 className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-slate-800 transition-all inline-flex items-center gap-2 shadow-sm"
                              >
                                 去看今日岗位 <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                 onClick={() => setShowCertificateModal(true)}
                                 className="px-4 py-2.5 bg-white border border-slate-200 text-slate-500 text-sm rounded-full hover:bg-slate-50 transition-all inline-flex items-center gap-1.5"
                              >
                                 <Download className="w-3.5 h-3.5" />
                                 证书
                              </button>
                           </div>
                        </div>

                        <div className="w-full max-w-[360px] shrink-0 hidden sm:block">
                           <WeChatCommunityPanel
                              isMember
                              variant="compact"
                              showActions={false}
                           />
                        </div>
                     </div>
                  </div>

                  {/* Recommended Jobs — single-column list format */}
                  <div>
                     <div className="flex items-center justify-between mb-5">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                           <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                           会员推荐
                        </h3>
                        <button
                           onClick={() => navigate('/jobs')}
                           className="text-sm text-indigo-600 font-medium hover:text-indigo-700 hover:underline flex items-center gap-1 transition-colors"
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
                              <Loader2 className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-3" />
                              <p className="text-slate-500 text-sm">正在利用 AI 为您匹配最适合的岗位...</p>
                           </div>
                        )}
                     </div>
                  </div>
               </div>
            </div>
         )}


         {/* Product Layers Section */}
         <div className="relative z-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 mt-12">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-bold text-slate-900 mb-3">加入会员是什么体验</h2>
               <p className="text-slate-500 text-lg">无限申请、无限内推，全站畅通的尊享服务</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
               {/* Benefit 1 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                     <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">免费版<br /><span className="text-base text-slate-700 font-semibold mt-1 block">浏览岗位、基础申请</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     面向所有用户开放。可浏览岗位，使用基础筛选，并提供 20 次企业网申和 3 次查看企业信息（含联系人）的机会。
                  </p>
               </div>
               {/* Benefit 2 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6">
                     <Sparkles className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">会员版<br /><span className="text-base text-slate-700 font-semibold mt-1 block">信息更完整，求职更省时间</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     适合正在认真找远程工作的用户。除了更完整的信息和求职工具，一些岗位还会提供直招 HR、负责人等联系方式，帮助你更快推进申请。
                  </p>
               </div>
               {/* Benefit 3 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                     <Target className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">1 对 1 服务<br /><span className="text-base text-slate-700 font-semibold mt-1 block">可单独咨询</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     如果你需要简历精修、策略诊断、模拟面试等服务，可以通过
                     {' '}<a href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">小红书私信我们</a>
                     {' '}或发送邮件到
                     {' '}<a href="mailto:hi@haigooremote.com" className="font-medium text-indigo-600 hover:underline">hi@haigooremote.com</a>。
                  </p>
               </div>
            </div>
         </div>

         {/* Plan Cards */}
         <div id="pricing-plans" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-20">
            <div className="text-center mb-14">
               <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">按你的求职节奏选择方案</h2>
               <p className="text-slate-500 text-lg">先选择适合你的开通方式，下方再看完整权益对比</p>
            </div>

            <div className="grid xl:grid-cols-4 md:grid-cols-2 gap-6">
               {([
                  { key: 'free', accent: 'slate' as const, featured: false },
                  { key: 'trial_week', accent: 'emerald' as const, featured: false },
                  { key: 'quarter', accent: 'indigo' as const, featured: true },
                  { key: 'year', accent: 'amber' as const, featured: false }
               ] as const).map((column: { key: MembershipPlanColumnKey; accent: 'slate' | 'emerald' | 'indigo' | 'amber'; featured: boolean }) => {
                  const summary = PLAN_CARD_SUMMARIES[column.key]
                  const plan = displayPlans.find((item) => item.memberType === column.key)
                  const isCurrentPlan = column.key !== 'free' && isMember && activeMemberType === column.key
                  const isDisabled = column.key === 'year'
                  const cardTone = column.featured
                     ? 'border-indigo-300 bg-[linear-gradient(180deg,rgba(241,244,255,0.96),rgba(255,255,255,0.98))] shadow-[0_28px_70px_-42px_rgba(79,70,229,0.28)]'
                     : column.accent === 'emerald'
                        ? 'border-emerald-200 bg-[linear-gradient(180deg,rgba(240,253,248,0.92),rgba(255,255,255,0.98))] shadow-[0_22px_56px_-44px_rgba(5,150,105,0.2)]'
                        : column.accent === 'amber'
                           ? 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.92),rgba(255,255,255,0.98))] shadow-[0_22px_56px_-44px_rgba(245,158,11,0.18)]'
                           : 'border-slate-200 bg-white/96 shadow-[0_18px_48px_-42px_rgba(15,23,42,0.12)]'
                  const ctaLabel = isCurrentPlan
                     ? '当前方案'
                     : column.key === 'free'
                        ? '继续浏览岗位'
                        : isDisabled
                           ? '筹备中'
                           : column.featured
                              ? '立即开通'
                              : '立即体验'

                  return (
                     <div
                        key={column.key}
                        className={`relative flex h-full flex-col rounded-[2rem] border p-8 transition-all hover:-translate-y-1 ${cardTone}`}
                     >
                        <div className="mb-6">
                           <div className="text-[2rem] font-extrabold leading-none text-slate-900">{summary.title}</div>
                           <div className="mt-6 flex items-end gap-2">
                              <span className="text-5xl font-extrabold tracking-tight text-slate-900">{summary.price}</span>
                              {summary.unit ? <span className="pb-1 text-base font-semibold text-slate-500">{summary.unit}</span> : null}
                           </div>
                           <p className="mt-5 text-base leading-relaxed text-slate-600">{summary.tagline}</p>
                        </div>

                        <div className="space-y-3.5 flex-1">
                           {summary.highlights.map((item: string) => (
                              <div key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                                 <Check className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${column.featured ? 'text-indigo-600' : column.accent === 'emerald' ? 'text-emerald-600' : column.accent === 'amber' ? 'text-amber-600' : 'text-slate-700'}`} strokeWidth={3} />
                                 <span>{item}</span>
                              </div>
                           ))}
                        </div>

                        <button
                           onClick={() => {
                              if (column.key === 'free') {
                                 navigate('/jobs')
                                 return
                              }
                              if (plan && !isDisabled) handleSubscribe(plan)
                           }}
                           disabled={isCurrentPlan || isDisabled}
                           className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-bold transition-all ${
                              isCurrentPlan
                                 ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                 : isDisabled
                                    ? 'cursor-default border border-slate-200 bg-slate-50 text-slate-400'
                                    : column.featured
                                       ? 'bg-indigo-600 text-white shadow-[0_18px_38px_-24px_rgba(79,70,229,0.42)] hover:bg-indigo-700'
                                       : column.accent === 'emerald'
                                          ? 'bg-emerald-600 text-white shadow-[0_18px_38px_-24px_rgba(5,150,105,0.36)] hover:bg-emerald-500'
                                          : 'bg-slate-900 text-white hover:bg-slate-800'
                           }`}
                        >
                           {ctaLabel}
                        </button>
                     </div>
                  )
               })}
            </div>

            {/* Comparison Section */}
            <div className="mb-6 mt-14 text-center">
               <h3 className="text-2xl font-bold text-slate-900">完整权益对比</h3>
            </div>
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_30px_80px_-46px_rgba(15,23,42,0.22)]">
               <div className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-200 bg-[linear-gradient(180deg,rgba(247,248,255,0.98),rgba(255,255,255,0.96))]">
                  <div className="px-6 py-6 text-left">
                     <div className="text-sm font-semibold text-slate-400">价值点</div>
                     <div className="mt-2 text-xl font-bold text-slate-900">会员方案对比</div>
                  </div>
                     {[
                        { key: 'free', title: '免费版', meta: '浏览岗位、有限尝试' },
                        { key: 'trial_week', title: '7 天会员', meta: '¥29.9 / 7 天' },
                        { key: 'quarter', title: '季度会员', meta: '¥199 / 季度', featured: true },
                        { key: 'year', title: '1 对 1 服务', meta: '筹备中' }
                      ].map((column) => {
                     return (
                        <div
                           key={column.key}
                           className={`border-l border-slate-200 px-4 py-6 text-center ${column.featured ? 'bg-[linear-gradient(180deg,rgba(238,242,255,0.85),rgba(255,255,255,0.98))]' : ''}`}
                        >
                           <div className={`text-base font-bold ${column.featured ? 'text-indigo-700' : 'text-slate-900'}`}>{column.title}</div>
                           <div className="mt-2 text-sm text-slate-500">{column.meta}</div>
                        </div>
                     )
                  })}
               </div>

               <div className="divide-y divide-slate-100">
                  {MEMBERSHIP_COMPARISON_ROWS.map((row) => (
                     <div key={row.label} className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] items-center">
                        <div className="px-6 py-4 text-sm font-medium text-slate-700">{row.label}</div>
                        {(['free', 'trial_week', 'quarter', 'year'] as const).map((columnKey) => {
                           const value = row[columnKey]
                           const renderCell = () => {
                              if (value === true) {
                                 return <Check className="h-5 w-5 text-indigo-600" strokeWidth={3} />
                              }
                              if (value === false) {
                                 return <span className="text-slate-300">—</span>
                              }
                              return (
                                 <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    value === '筹备中'
                                       ? 'bg-amber-50 text-amber-700'
                                       : 'bg-slate-100 text-slate-600'
                                 }`}>
                                    {value}
                                 </span>
                              )
                           }
                           return (
                              <div key={columnKey} className="flex items-center justify-center border-l border-slate-100 px-4 py-4">
                                 {renderCell()}
                              </div>
                           )
                        })}
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Social Proof: Success Stories */}
         <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center mb-12">
               <h2 className="text-3xl font-extrabold text-slate-900 mb-3">来自用户的真实反馈</h2>
               <p className="text-slate-500 text-lg">看看其他用户怎么说</p>
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
            <h3 className="text-base font-bold text-slate-400 uppercase tracking-widest mb-10">我们合作过的企业/社区</h3>
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><HardDrive className="w-6 h-6" /> Red Mountain</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><Building className="w-6 h-6" /> Bodhitree Group</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><GraduationCap className="w-6 h-6" /> VitaStep</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><CircuitBoard className="w-6 h-6" /> ClarityInfra</div>
               <div className="flex items-center gap-2 font-bold text-xl text-slate-600"><Landmark className="w-6 h-6" /> Fintech社区</div>
            </div>
         </div>

         {/* FAQ Section */}
         <div className="max-w-4xl mx-auto pb-32 px-4">
            <div className="text-center mb-16">
               <h2 className="text-3xl font-bold text-slate-900 mb-4">常见问题解答</h2>
               <p className="text-slate-500 text-lg">了解更多关于会员方案、联系方式和 1 对 1 服务的细节</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
               {[
                  { q: "这里的岗位可靠吗？", a: "岗位会优先经过人工审核与筛选，重点帮你减少不值得投入时间的无效岗位。" },
                  { q: "会员版主要多了什么？", a: "会员版核心是无限申请次数、无限内推次数，并解锁全部岗位、邮箱直申、关键联系人信息和更完整的岗位匹配建议。季度会员还开放精选企业完整名单。" },
                  { q: "1 对 1 服务也包含在会员里吗？", a: "1 对 1 服务正在筹备中，方向包含求职策略诊断、简历精修或模拟面试，以及重点机会跟进建议。当前如需人工支持，可通过小红书私信我们，或发送邮件到 hi@haigooremote.com 咨询。" },
                  { q: "方案是否可以变更或退款？", a: "支付后 48 小时内可以申请变更方案或退款。你可以发邮件到「hi@haigooremote.com」写明原因，我们会在 3 个工作日内联系处理。" }
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
                           <span className="text-sm font-medium text-slate-500">/{selectedPlan.memberType === 'trial_week' ? '周' : (selectedPlan.duration_days > 90 ? '年' : '季度')}</span>
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
                  <div className="w-full md:w-7/12 bg-white p-6 md:p-10 flex flex-col items-center justify-center text-center relative overflow-y-auto">
                     <button
                        onClick={() => setShowPaymentModal(false)}
                        className="absolute top-4 right-4 w-8 h-8 hidden md:flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                     >
                        <span className="text-xl leading-none">&times;</span>
                     </button>

                     <div className="mb-6 w-full max-w-xs mx-auto flex-shrink-0">
                        <div className="bg-white p-3 rounded-2xl shadow-lg border border-slate-100 inline-block mb-4">
                           <img
                              src={currentPaymentInfo.imageUrl}
                              alt="Payment QR"
                              className="w-40 h-40 object-contain rounded-lg"
                           />
                        </div>
                        <p className="text-slate-900 font-bold text-lg mb-1">{currentPaymentInfo.instruction}</p>
                        <p className="text-slate-400 text-xs">请使用手机扫码完成支付</p>
                     </div>

                     <div className="w-full max-w-sm flex-shrink-0">
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-900 mb-6 text-left shadow-sm">
                           <p className="font-bold mb-2 flex items-center gap-2 text-amber-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              重要：付款备注说明
                           </p>
                           <p className="mb-2 text-amber-800/80 leading-relaxed">付款时请务必在【添加备注】处填入您的注册邮箱，以便系统自动核销：</p>
                           <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-amber-200 shadow-sm group cursor-pointer hover:border-amber-300 transition-all hover:shadow-md"
                              onClick={() => {
                                 navigator.clipboard.writeText(user?.email || '');
                                 alert('邮箱已复制');
                              }}
                           >
                              <code className="flex-1 font-mono text-slate-700 break-all font-bold select-all text-sm">{user?.email || '您的邮箱'}</code>
                              <Copy className="w-3.5 h-3.5 text-amber-400 group-hover:text-amber-600" />
                           </div>
                        </div>

                        <button
                           onClick={handlePaymentComplete}
                           className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-base"
                        >
                           <CheckCircle2 className="w-5 h-5" />
                           我已完成支付
                        </button>
                        <p className="text-[10px] text-slate-400 mt-3 font-medium">
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
