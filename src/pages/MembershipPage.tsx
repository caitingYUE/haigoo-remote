
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
      discountLabel: '轻量试用 · 7天体验',
      tier: 'trial',
      alipay_qr: '/alipay_mini.jpg',
      wechat_qr: '/Wechatpay_mini.png',
      features: [
         '解锁全部高薪远程职位（含内推）',
         '解锁全部企业认证信息及联系方式',
         'AI 远程工作助手（无限次）',
         'AI 简历优化（无限次）',
         '岗位收藏、直接翻译等功能（无限次）',
         '加入精英远程工作者社区',
         '解锁精选企业名单'
      ],
      description: '适合先体验海狗核心岗位权益，快速验证匹配度与使用价值。'
   },
   {
      id: 'club_go_quarterly',
      memberType: 'quarter',
      name: '海狗远程俱乐部会员 (季度)',
      shortLabel: '季度会员',
      price: 199,
      currency: 'CNY',
      duration_days: 90,
      discountLabel: '灵活订阅 · 适合短期冲刺',
      tier: 'full',
      features: [
         '解锁全部高薪远程职位（含内推）',
         '解锁全部企业认证信息及联系方式',
         'AI 远程工作助手 (无限次)',
         'AI 简历优化（无限次）',
         '岗位收藏、直接翻译等功能（无限次）',
         '加入精英远程工作者社区',
         '解锁精选企业名单'
      ],
      description: '适合短期冲刺的求职者，快速获得内推机会'
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
      discountLabel: '先验证价值 · 7 天体验',
      description: '适合先体验 Haigoo 是否能帮你更快筛到靠谱岗位，并减少无效投递。',
      features: [
         '查看更完整的岗位和企业信息',
         '部分岗位可查看直招 HR 或负责人联系方式',
         '获得更完整的岗位匹配建议',
         '使用投递管理、收藏与翻译能力',
         '加入会员群，接收更聚焦的交流'
      ],
      ctaHint: '适合先体验这些功能是否真的对你有帮助'
   },
   quarter: {
      name: '季度会员',
      shortLabel: '季度会员',
      discountLabel: '适合 1-3 个月认真找工作',
      description: '适合正在认真找工作的用户，在一个完整周期里持续获得更完整的信息、工具和推荐。',
      features: [
         '持续查看更完整的岗位与企业信息',
         '部分岗位可查看直招 HR 或负责人联系方式',
         '持续收到更贴合你的岗位推荐和提醒',
         '更完整的求职助手与简历打磨能力',
         '投递管理 + 会员群支持'
      ],
      ctaHint: '适合未来 1-3 个月认真找远程工作的用户',
      isPlus: true
   },
   year: {
      name: '1 对 1 服务（筹备中）',
      shortLabel: '1 对 1 服务',
      discountLabel: '单独开放 · 另行说明',
      description: '简历精修、策略诊断、模拟面试等服务会单独开放，不和会员方案混在一起。',
      features: [
         '1 次 1V1 求职策略诊断',
         '简历精修或模拟面试 1 次',
         '重点机会跟进建议',
         '适合有明确求职窗口的高意向用户'
      ],
      ctaHint: '当前还在筹备中，后续开放时会单独说明',
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

               <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed font-medium">
                  会员版可以查看更完整的岗位信息、部分岗位的直招联系方式，并使用更多求职工具和持续更新的岗位推荐。<br className="hidden md:block" />
                  如需 1 对 1 指导或咨询服务，可以通过
                  {' '}<a href="https://www.xiaohongshu.com/user/profile/67d43c60000000000e02c1c9" target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline">小红书私信我们</a>
                  {' '}或发送邮件到
                  {' '}<a href="mailto:hi@haigooremote.com" className="font-medium text-indigo-600 hover:underline">hi@haigooremote.com</a>。
               </p>

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
               <h2 className="text-3xl font-bold text-slate-900 mb-3">先免费体验，再按需要开通</h2>
               <p className="text-slate-500 text-lg">先免费使用，确认适合你，再决定是否开通会员；如需 1 对 1 指导或咨询服务，也可以单独联系我们</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
               {/* Benefit 1 */}
               <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2rem] border border-white shadow-xl shadow-slate-200/40 hover:-translate-y-1 transition-transform">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6">
                     <ShieldCheck className="w-7 h-7" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">免费版<br /><span className="text-base text-slate-700 font-semibold mt-1 block">浏览岗位、基础申请</span></h3>
                  <p className="text-slate-500 leading-relaxed text-sm">
                     面向所有用户开放。先浏览岗位、使用基础筛选、查看申请方式，并进入交流群获得基础信息与反馈。
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
                     如果你需要简历精修、策略诊断、模拟面试等服务，可以通过小红书私信或邮件联系我们，我们会单独和你沟通。
                  </p>
               </div>
            </div>
         </div>

         {/* Pricing Plans Section */}
         <div id="pricing-plans" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 relative z-20">
            <div className="text-center mb-16">
               <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">当前可开通的方案</h2>
               <p className="text-slate-500 text-lg">建议先用 7 天体验，确认适合你，再决定是否开通季度会员</p>
            </div>
            <div className="grid xl:grid-cols-3 md:grid-cols-2 gap-6 max-w-7xl mx-auto items-stretch">
               {displayPlans.map((plan) => {
                  const isTrialPlan = plan.memberType === 'trial_week';
                  const isCurrentPlan = isMember && activeMemberType === plan.memberType;
                  const isComingSoon = Boolean(plan.comingSoon);
                  const cycleLabel = plan.memberType === 'trial_week'
                     ? '7天'
                     : plan.memberType === 'quarter'
                        ? '季度'
                        : '期';
                  return (
                     <div
                        key={plan.id}
                        className={`relative rounded-[2rem] p-7 lg:p-8 transition-all duration-500 group flex flex-col bg-white ${plan.isPlus && plan.id !== 'goo_plus_yearly'
                           ? 'border-2 border-indigo-200 shadow-2xl shadow-indigo-200/50 hover:-translate-y-2 z-10'
                           : isTrialPlan
                              ? 'border border-emerald-200 shadow-xl shadow-emerald-100/50 hover:-translate-y-1'
                           : 'border shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-200/80 hover:-translate-y-1 border-slate-200'
                           }`}
                     >
                        {isTrialPlan && (
                           <div className="absolute -top-3 right-6 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg shadow-emerald-500/20 tracking-wider uppercase flex items-center gap-1.5">
                              <Zap className="w-3.5 h-3.5" />
                              推荐体验
                           </div>
                        )}

                        {plan.isPlus && plan.id !== 'goo_plus_yearly' && (
                           <div className="absolute -top-4 right-8 bg-gradient-to-r from-indigo-600 to-blue-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/30 tracking-widest uppercase flex items-center gap-1.5">
                              <Star className="w-3.5 h-3.5 fill-white" />
                              最受欢迎
                           </div>
                        )}

                        <div className="mb-8 text-center border-b border-slate-100 pb-8">
                           <h3 className={`text-[1.75rem] font-extrabold mb-3 text-slate-900 leading-tight`}>
                              {plan.name}
                           </h3>
                           <div className="flex justify-center items-baseline gap-1 mb-2">
                              <span className="text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900">¥{plan.price}</span>
                              <span className="text-sm font-bold text-slate-500">
                                 /{cycleLabel}
                              </span>
                           </div>

                           <div className="mb-4 flex flex-col items-center gap-2 min-h-[3rem]">
                              {plan.discountLabel && (
                                 <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${isTrialPlan ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                                    {plan.discountLabel}
                                 </span>
                              )}
                           </div>

                           <p className="text-sm text-slate-500 font-medium px-4">
                              {plan.ctaHint}
                           </p>
                           <p className="text-xs text-slate-400 mt-2 px-4 line-clamp-2 min-h-8">
                              {plan.description}
                           </p>
                        </div>

                        <ul className="space-y-3.5 mb-8 flex-1 px-1">
                           {plan.features.map((feature, idx) => {
                              return (
                              <li key={idx} className="flex items-start gap-4">
                                 <div className="mt-0.5 w-6 h-6 flex items-center justify-center flex-shrink-0">
                                    <Check className="w-5 h-5 text-indigo-500" strokeWidth={3} />
                                 </div>
                                 <span className="text-[14px] font-medium leading-relaxed text-slate-700">
                                    {feature}
                                 </span>
                              </li>
                           )})}
                        </ul>

                        <button
                           onClick={() => handleSubscribe(plan)}
                           disabled={isCurrentPlan || isComingSoon}
                           className={`w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 relative overflow-hidden group/btn ${isCurrentPlan
                              ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : isComingSoon
                                 ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                              : plan.isPlus
                                 ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-xl shadow-indigo-500/30'
                                 : isTrialPlan
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                 : 'bg-[#0F172A] hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                              }`}
                        >
                           {isCurrentPlan ? (
                              <>
                                 <CheckCircle2 className="w-5 h-5" />
                                 当前会员方案
                              </>
                           ) : isComingSoon ? (
                              <>
                                 筹备中
                              </>
                           ) : plan.isPlus ? (
                              <>
                                 开通会员
                                 <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
                              </>
                           ) : (
                              <>
                                 {isTrialPlan ? '立即体验' : '立即开通'}
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
               <h2 className="text-3xl font-extrabold text-slate-900 mb-3">来自用户的真实反馈</h2>
               <p className="text-slate-500 text-lg">看看大家为什么愿意继续用下去</p>
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
            <h3 className="text-base font-bold text-slate-400 uppercase tracking-widest mb-10">我们持续关注的企业与方向</h3>
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
                  { q: "会员版主要多了什么？", a: "会员版可以查看更完整的岗位与企业信息、使用更多求职工具、持续收到岗位推荐，也能进入更聚焦的会员群交流。一些岗位还会提供直招 HR 或负责人联系方式，帮助你更快推进申请。" },
                  { q: "1 对 1 服务也包含在会员里吗？", a: "不包含。如果你需要简历精修、策略诊断、模拟面试等 1 对 1 服务，可以通过小红书私信我们，或发送邮件到 hi@haigooremote.com 单独咨询。" },
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
