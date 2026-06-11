
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, ChevronRight, Loader2, CheckCircle2, Calendar, Download, Copy, Sparkles, Landmark, Building, GraduationCap, HardDrive, CircuitBoard, Quote, Users, Eye, Mail, Headphones, Gift, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import JobCardNew from '../components/JobCardNew';
import { trackingService } from '../services/tracking-service';
import { MembershipCertificateModal } from '../components/MembershipCertificateModal';
import WeChatCommunityPanel from '../components/WeChatCommunityPanel';
import { deriveMembershipCapabilities } from '../utils/membership';
import { fetchDailyMemberRecommendations } from '../utils/member-recommendations';

const MEMBERSHIP_COMPARISON_ROWS = [
   {
      label: '解锁全部高价值岗位信息',
      free: '有限开放',
      trial_week: true,
      quarter: true,
      year: false
   },
   {
      label: '解锁全部企业联系人信息',
      free: '有限体验',
      trial_week: true,
      quarter: true,
      year: false
   },
   {
      label: '解锁全部企业直申机会',
      free: '有限体验',
      trial_week: true,
      quarter: true,
      year: false
   },
   {
      label: '优先人工支持和服务',
      free: false,
      trial_week: false,
      quarter: true,
      year: false
   },
   {
      label: '解锁会员专属推荐和 AI 简历优化',
      free: false,
      trial_week: true,
      quarter: true,
      year: false
   },
   {
      label: '开放精选企业完整名单',
      free: false,
      trial_week: false,
      quarter: true,
      year: false
   },
   {
      label: '解答关于远程工作的任何疑问',
      free: false,
      trial_week: false,
      quarter: false,
      year: true
   },
   {
      label: '英文简历、求职信、定向岗位匹配',
      free: false,
      trial_week: false,
      quarter: false,
      year: true
   },
   {
      label: '针对个人背景提供职业发展分析',
      free: false,
      trial_week: false,
      quarter: false,
      year: true
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
         '20 次免费网络直申',
         '3 次内推信息解锁',
         '高价值岗位无法申请'
      ]
   },
   trial_week: {
      title: '7 天会员',
      price: '¥29.9',
      unit: '/ 7 天',
      tagline: '适合短期集中投递',
      highlights: [
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化'
      ]
   },
   quarter: {
      title: '季度会员',
      price: '¥199',
      unit: '/ 季度',
      tagline: '适合持续推进远程求职',
      highlights: [
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化',
         '优先人工支持和服务'
      ]
   },
   year: {
      title: '远程工作个性化咨询',
      price: '¥299-¥599',
      unit: '',
      tagline: '适合希望提高效率的你',
      highlights: [
         '解答关于远程工作的任何疑问',
         '针对个人背景提供职业发展分析',
         '英文简历、求职信、定向岗位匹配'
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

const PLAN_TOP_LABELS: Record<MembershipPlanColumnKey, string> = {
   free: '基础体验',
   trial_week: '集中冲刺',
   quarter: '在职友好',
   year: '量身定制'
};

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
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化'
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
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化',
         '优先人工支持和服务'
      ],
      description: '适合持续推进远程求职，在一个完整周期里系统提升申请效率。'
   },
   {
      id: 'goo_plus_yearly',
      memberType: 'year',
      name: '远程工作个性化咨询',
      shortLabel: '线上咨询',
      price: 299,
      currency: 'CNY',
      duration_days: 0,
      isPlus: true,
      tier: 'full',
      features: [
         '解答关于远程工作的任何疑问',
         '针对个人背景提供职业发展分析',
         '英文简历、求职信、定向岗位匹配'
      ],
      description: '适合希望提高效率的你'
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
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化'
      ],
      ctaHint: '适合先集中推进一轮申请'
   },
   quarter: {
      name: '季度会员',
      shortLabel: '季度会员',
      discountLabel: '适合 1-3 个月认真找工作',
      description: '适合正在持续推进远程求职的用户，把申请效率、企业线索和人工支持一起拉满。',
      features: [
         '解锁全部高价值岗位信息',
         '解锁全部企业联系人信息',
         '解锁全部企业直申机会',
         '解锁会员专属推荐和 AI 简历优化',
         '优先人工支持和服务'
      ],
      ctaHint: '适合持续推进远程求职',
      isPlus: true
   },
   year: {
      name: '远程工作个性化咨询',
      shortLabel: '线上咨询',
      discountLabel: '¥299-¥599',
      description: '适合希望提高效率的你。',
      features: [
         '解答关于远程工作的任何疑问',
         '针对个人背景提供职业发展分析',
         '英文简历、求职信、定向岗位匹配'
      ],
      ctaHint: '添加小助手了解详情',
      isPlus: true
   }
};

const MEMBERSHIP_DECOR = {
   beach: '/pic_lists/About_pics/about_bg.webp',
   sun: '/pic_lists/Jobs_pics/sun-transparent.webp',
   grass: '/pic_lists/Home_pics/grass_icon-transparent.webp',
   grass2: '/pic_lists/Home_pics/grass_icon2-transparent.webp',
   love: '/pic_lists/Home_pics/love-transparent.webp',
   mascot: '/pic_lists/Home_pics/Haigoo_hi-transparent.webp',
   tips: '/pic_lists/Home_pics/tips-transparent.webp'
};

const MEMBERSHIP_FEATURE_STRIP = [
   { title: '精准岗位推荐', text: '智能匹配优质远程岗位', icon: Eye },
   { title: '无限机会与资源', text: '优先获得全部稀缺岗位与企业联系人资源', icon: Mail },
   { title: '个性化咨询', text: '为你一对一解答远程求职疑惑', icon: Users },
   { title: '优先体验新功能', text: '抢先体验产品新能力与活动', icon: Gift },
   { title: '专属客服支持', text: '会员专属通道，快速响应', icon: Headphones }
];

const MEMBERSHIP_SIDE_NAV = [
   { href: '#membership-hero', label: '会员权益', icon: Star },
   { href: '#pricing-plans', label: '会员方案', icon: Crown },
   { href: '#member-promise', label: '服务承诺', icon: ShieldCheck },
   { href: '#member-stories', label: '用户反馈', icon: MessageCircle }
];

const LoveIcon = ({ className = '', imageClassName = '' }: { className?: string; imageClassName?: string }) => (
   <span className={`relative inline-block overflow-visible ${className}`} aria-hidden="true">
      <img
         src={MEMBERSHIP_DECOR.love}
         alt=""
         className={`absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 scale-[2.8] object-contain ${imageClassName}`}
      />
   </span>
);

const MembershipPage: React.FC = () => {
   const { user, isAuthenticated } = useAuth();
   const navigate = useNavigate();
   const [plans, setPlans] = useState<Plan[]>(STATIC_PLANS);
   const [loading, setLoading] = useState(true);
   const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
   const [paymentMethod, setPaymentMethod] = useState<'wechat' | 'alipay'>('alipay');
   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [showAssistantModal, setShowAssistantModal] = useState(false);
   const modalRoot = typeof document !== 'undefined' ? document.body : null;
   const [currentMembership, setCurrentMembership] = useState<any>(null);
   const [showCertificateModal, setShowCertificateModal] = useState(false);
   const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);
   const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

   const membershipCapabilities = deriveMembershipCapabilities(user);
   const isMember = (currentMembership?.isActive) || membershipCapabilities.isActive || !!user?.roles?.admin;
   const activeMemberType = (currentMembership?.memberType || membershipCapabilities.memberType);
   const isTrialMember = activeMemberType === 'trial_week';
   const membershipExpiresAt = currentMembership?.expireAt || user?.memberExpireAt || null;
   const membershipStatusTitle = isMember ? (isTrialMember ? '体验会员' : '已开通') : '未开通';
   const membershipStatusSubtitle = isMember ? (isTrialMember ? '7 天体验中' : '当前会员状态') : '当前会员状态';
   const membershipExpiryLabel = isMember
      ? (membershipExpiresAt ? new Date(membershipExpiresAt).toLocaleDateString() : '长期有效')
      : '开通后生效';
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
   const primaryPlan = displayPlans.find((plan) => plan.memberType === 'quarter') || displayPlans[0];

   useEffect(() => {
      setPlans(STATIC_PLANS);
      setLoading(false);

      fetchPlans();

      if (isAuthenticated) {
         fetchStatus();
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

   const scrollToPricingPlans = () => {
      const el = document.getElementById('pricing-plans');
      el?.scrollIntoView({ behavior: 'smooth' });
   };

   const handleCertificateClick = () => {
      if (isMember && user) {
         setShowCertificateModal(true);
         return;
      }
      if (!isAuthenticated) {
         navigate('/login?redirect=/membership');
         return;
      }
      scrollToPricingPlans();
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
      alert('感谢您的支付！权益通常在3min内生效（深夜除外）。如有疑问请联系 hi@haigooremote.com');
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
               const finalJobs = await fetchDailyMemberRecommendations(6);
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
      <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#fffdf8_0%,#f7fbff_50%,#fffefb_100%)] font-sans selection:bg-[#8f83ff]/25">
         <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[720px]">
            <img src={MEMBERSHIP_DECOR.beach} alt="" className="h-full w-full object-cover object-[58%_22%] opacity-[0.26] saturate-[0.94]" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,248,0.98)_0%,rgba(255,253,248,0.75)_45%,rgba(255,253,248,0.34)_100%),linear-gradient(180deg,rgba(255,253,248,0.5)_0%,#fffdf8_90%)]" />
         </div>
         <div className="pointer-events-none fixed inset-x-0 bottom-0 z-0 hidden h-[440px] lg:block">
            <img src={MEMBERSHIP_DECOR.grass} alt="" className="absolute bottom-12 left-5 w-44 opacity-70" />
            <img src={MEMBERSHIP_DECOR.tips} alt="" className="absolute bottom-0 left-0 w-72 opacity-80" />
         </div>

         {/* Hero Section (Visible to EVERYONE) */}
         <div className="relative z-10 overflow-hidden px-4 pb-6 pt-24 sm:px-6 md:pt-28 lg:px-8">
            <div className="relative mx-auto max-w-[1600px]">
               <aside className="absolute left-0 top-0 hidden min-h-[620px] w-[190px] flex-col justify-between overflow-hidden rounded-[22px] border border-slate-200/70 bg-white/82 shadow-[0_24px_70px_-56px_rgba(15,23,42,0.32)] backdrop-blur-xl xl:flex">
                  <nav className="space-y-1 p-2">
                     {MEMBERSHIP_SIDE_NAV.map((item, index) => {
                        const Icon = item.icon
                        return (
                           <a
                              key={item.href}
                              href={item.href}
                              className={`flex items-center gap-3 rounded-2xl px-4 py-4 text-sm font-semibold no-underline transition hover:bg-[#f2ecff] hover:text-[#6f63f6] ${index === 1 ? 'bg-[#f2ecff] text-[#6f63f6]' : 'text-slate-500'}`}
                           >
                              <Icon className="h-5 w-5" />
                              {item.label}
                           </a>
                        )
                     })}
                  </nav>
                  <div className="relative min-h-[250px] p-5">
                     <img src={MEMBERSHIP_DECOR.grass} alt="" className="absolute bottom-16 left-3 w-28 opacity-70" />
                     <img src={MEMBERSHIP_DECOR.tips} alt="" className="absolute bottom-0 left-0 w-52 opacity-75" />
                     <div className="relative" aria-label="Be free. Work anywhere. Live fully.">
                        <span className="sr-only">Be free. Work anywhere. Live fully.</span>
                        <img
                           src="/pic_lists/Handwriting/hand-be-free.webp"
                           alt=""
                           loading="lazy"
                           decoding="async"
                           className="h-auto w-[190px] max-w-full opacity-80"
                        />
                     </div>
                  </div>
               </aside>

               <div className="min-w-0 xl:ml-[217px]">
               <section id="membership-hero" className="relative overflow-hidden rounded-[30px] border border-[#eadfc8] bg-white/72 px-5 py-8 shadow-[0_34px_96px_-76px_rgba(102,82,48,0.38)] backdrop-blur sm:px-9 lg:px-12 lg:py-12">
                  <div className="pointer-events-none absolute inset-0">
                     <img src={MEMBERSHIP_DECOR.beach} alt="" className="absolute inset-0 h-full w-full scale-[1.08] object-cover object-[72%_46%] opacity-[0.58] blur-[0.2px] saturate-[0.9]" />
                     <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,253,249,0.98)_0%,rgba(255,253,249,0.92)_38%,rgba(255,253,249,0.42)_72%,rgba(255,253,249,0.78)_100%),linear-gradient(180deg,rgba(255,255,255,0.28)_0%,rgba(255,255,255,0.92)_100%)]" />
                     <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,rgba(255,253,249,0)_0%,rgba(255,253,249,0.96)_100%)]" />
                  </div>
                  <img src={MEMBERSHIP_DECOR.sun} alt="" className="pointer-events-none absolute right-7 top-6 hidden h-20 opacity-45 lg:block" />
                  <img src={MEMBERSHIP_DECOR.grass2} alt="" className="pointer-events-none absolute bottom-4 left-3 hidden h-24 opacity-16 lg:block" />

                  <div className="relative grid gap-8 lg:grid-cols-[1fr_420px] lg:items-center">
                     <div className="max-w-3xl">
                        <h1 className="max-w-3xl text-4xl font-black leading-[1.08] tracking-normal text-slate-950 sm:text-5xl lg:text-[3.55rem]">
                           更多机会，更灵活的工作方式
                           <LoveIcon className="ml-3 h-10 w-10 translate-y-1 align-baseline sm:h-12 sm:w-12" />
                        </h1>
                        <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">
                           Haigoo 为你提供专属资源支持，会员类岗位优中选优，国内申请成功概率更高。
                        </p>
                        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                           {!(isAuthenticated && isMember) && (
                              <button
                                 onClick={scrollToPricingPlans}
                                 className="inline-flex items-center justify-center gap-2 rounded-full bg-[#7b74ff] px-7 py-3 text-sm font-bold text-white shadow-[0_18px_40px_-24px_rgba(123,116,255,0.38)] transition hover:bg-[#6f63f6]"
                              >
                                 查看会员方案
                                 <ArrowRight className="h-4 w-4" />
                              </button>
                           )}
                           <button
                              onClick={() => navigate('/jobs')}
                              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/85 px-7 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                           >
                              先浏览岗位
                           </button>
                        </div>
                     </div>

                     <div className="relative overflow-hidden rounded-[28px] border border-[#e8d8be] bg-white/90 p-6 shadow-[0_28px_80px_-58px_rgba(102,82,48,0.32)] transition hover:-translate-y-0.5 hover:bg-white">
                        <div className="relative flex items-start gap-4">
                           <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] ${isMember ? 'bg-[#f1efff] text-[#6f63f6]' : 'bg-[#f3eefc] text-[#7b74ff]'} shadow-[0_16px_30px_-22px_rgba(111,99,246,0.45)]`}>
                              <Crown className="h-8 w-8" />
                           </div>
                           <div className="min-w-0">
                              <div className="text-2xl font-black leading-tight text-slate-950">{membershipStatusTitle}</div>
                              <div className="mt-1 text-sm font-semibold text-slate-400">{membershipStatusSubtitle}</div>
                           </div>
                        </div>

                        <div className="relative mt-7 rounded-[22px] border border-[#eadfc8] bg-[#fffdf8]/90 px-5 py-5">
                           <div className="text-sm font-bold text-slate-400">有效期至</div>
                           <div className="mt-3 text-3xl font-black tracking-tight text-slate-950">{membershipExpiryLabel}</div>
                           {!isMember ? (
                              <div className="mt-3 text-sm leading-6 text-slate-500">开通后即可查看会员岗位和联系人线索。</div>
                           ) : null}
                        </div>

                        <div className={`relative mt-6 grid gap-3 ${isMember ? 'sm:grid-cols-2' : ''}`}>
                           <button
                              type="button"
                              onClick={() => handleSubscribe(primaryPlan)}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#7b74ff] px-5 text-sm font-black text-white shadow-[0_18px_36px_-24px_rgba(123,116,255,0.46)] transition hover:bg-[#6f63f6]"
                           >
                              {isMember ? '续费/升级权益' : '加入会员'}
                              <ArrowRight className="h-4 w-4" />
                           </button>
                           {isMember ? (
                              <button
                                 type="button"
                                 onClick={handleCertificateClick}
                                 className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[#d8d2ff] bg-white/90 px-5 text-sm font-black text-[#6f63f6] shadow-[0_16px_30px_-26px_rgba(111,99,246,0.28)] transition hover:bg-[#f7f4ff]"
                              >
                                 证书
                                 <Download className="h-4 w-4" />
                              </button>
                           ) : null}
                        </div>
                     </div>
                  </div>
               </section>

               <div className="mt-5 grid overflow-hidden rounded-[24px] border border-[#e6edf3] bg-white p-3 shadow-[0_26px_72px_-58px_rgba(64,78,102,0.28)] md:grid-cols-5">
                  {MEMBERSHIP_FEATURE_STRIP.map((item) => {
                     const Icon = item.icon
                     return (
                        <div key={item.title} className="group relative flex items-center gap-4 rounded-[18px] px-4 py-4 transition hover:bg-[#fbfdff] md:after:absolute md:after:right-0 md:after:top-5 md:after:h-12 md:after:w-px md:after:bg-[linear-gradient(180deg,transparent,rgba(148,163,184,0.2),transparent)] md:last:after:hidden">
                           <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f3f0ff] text-[#7b74ff] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                              <Icon className="h-6 w-6 transition group-hover:scale-110" />
                           </div>
                           <div>
                              <div className="font-bold text-slate-900">{item.title}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">{item.text}</div>
                           </div>
                        </div>
                     )
                  })}
               </div>
               </div>
            </div>
         </div>

         {/* The old gradient status bar has been permanently removed based on user feedback. */}

         {/* Member Dashboard (Prioritized for Members) */}
         {isAuthenticated && isMember && (
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-20">
               <div className="space-y-8">
                  {/* Member Status Card — 2-column: info left, QR right */}
                  <div className="bg-white/88 rounded-[28px] border border-[#dfe8ef] shadow-[0_24px_70px_-58px_rgba(64,78,102,0.24)] p-8 md:p-10 flex flex-col sm:flex-row gap-8 lg:gap-12 relative overflow-hidden">
                     <div className="flex flex-col sm:flex-row gap-8 lg:gap-12 w-full">
                        {/* Left: member info */}
                        <div className="flex-1 flex flex-col">
                           {/* Title */}
                           <div className="flex items-center gap-3 mb-5">
                              <div className="w-12 h-12 bg-[#7b74ff] rounded-full flex items-center justify-center shadow-md shrink-0">
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
                                 className="px-6 py-2.5 bg-[#2b3448] text-white text-sm font-bold rounded-full hover:bg-slate-800 transition-all inline-flex items-center gap-2 shadow-sm"
                              >
                                 去看今日岗位 <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                              <button
                                 onClick={handleCertificateClick}
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
                                 job={{ ...job, memberOnly: true }}
                                 variant="list"
                                 matchScore={job.displayMatchScore || job.matchScore || job.recommendationScore || undefined}
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


         {/* Plan Cards */}
         <div id="pricing-plans" className="relative z-20 mx-auto max-w-[1500px] px-4 pb-12 pt-8 sm:px-6 lg:px-8">
            <div className="mb-8 flex flex-col gap-3 text-left sm:mb-10 lg:flex-row lg:items-end lg:justify-between">
               <div>
               <h2 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">按你的求职节奏选择方案</h2>
               <p className="text-slate-500 text-base sm:text-lg">先选择适合你的开通方式，下方再看完整权益对比</p>
               </div>
               <button
                  onClick={() => {
                     const el = document.getElementById('member-help');
                     el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-[#dfe8ef] bg-white/84 px-5 py-3 text-sm font-bold text-slate-700 shadow-[0_18px_46px_-40px_rgba(64,78,102,0.26)] transition hover:bg-white"
               >
                  需要帮助
                  <ArrowRight className="h-4 w-4" />
               </button>
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
                  const isConsultationPlan = column.key === 'year'
                  const isDisabled = false
                  const cardTone = column.featured
                     ? 'border-[#cdc7ff] bg-[linear-gradient(180deg,rgba(250,249,255,0.98),rgba(255,255,255,0.98))] shadow-[0_30px_76px_-48px_rgba(123,116,255,0.26)]'
                     : column.accent === 'emerald'
                        ? 'border-[#bee8cf] bg-[linear-gradient(180deg,rgba(248,255,251,0.98),rgba(255,255,255,0.99))] shadow-[0_26px_66px_-50px_rgba(73,169,130,0.22)]'
                        : column.accent === 'amber'
                           ? 'border-[#efd5a7] bg-[linear-gradient(180deg,rgba(255,253,248,0.98),rgba(255,255,255,0.99))] shadow-[0_26px_66px_-50px_rgba(194,137,50,0.2)]'
                           : 'border-[#dfe8ef] bg-white/98 shadow-[0_22px_58px_-48px_rgba(64,78,102,0.16)]'
                  const ctaLabel = isCurrentPlan
                     ? '当前方案'
                     : column.key === 'free'
                        ? '继续浏览岗位'
                           : isConsultationPlan
                              ? '微信咨询了解详情'
                           : column.featured
                              ? '立即开通'
                              : '立即体验'

                  return (
                     <div
                        key={column.key}
                        className={`group relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[26px] border p-7 transition-all hover:-translate-y-1 hover:shadow-[0_34px_86px_-54px_rgba(64,78,102,0.28)] ${cardTone}`}
                     >
                        {column.featured && (
                           <div className="absolute right-6 top-16 inline-flex items-center gap-1 rounded-full bg-[#7b74ff] px-3 py-1 text-xs font-bold text-white shadow-[0_12px_26px_-18px_rgba(123,116,255,0.65)]">
                              推荐
                           </div>
                        )}
                        <div className="relative mb-6">
                           <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-black ${
                              column.key === 'free' ? 'bg-slate-100 text-slate-500'
                                 : column.accent === 'emerald' ? 'bg-emerald-50 text-emerald-700'
                                    : column.featured ? 'bg-[#f1efff] text-[#6f63f6]'
                                       : 'bg-[#fff5df] text-[#b47319]'
                           }`}>
                              {PLAN_TOP_LABELS[column.key]}
                           </div>
                           <div className="max-w-[82%] text-[1.65rem] font-extrabold leading-tight text-slate-900">{summary.title}</div>
                           <p className="mt-4 min-h-[56px] text-base leading-7 text-slate-600">{summary.tagline}</p>
                           {column.key === 'quarter' ? (
                              <div className="mt-6">
                                 <div className="text-sm font-black text-slate-400 line-through decoration-2">¥399 /季度</div>
                                 <div className="mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap">
                                    <span className="shrink-0 text-[42px] font-extrabold leading-none tracking-tight text-slate-900">¥199</span>
                                    <span className="shrink-0 text-sm font-semibold text-slate-500">/季度</span>
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2.5 py-1 text-[11px] font-black text-[#c26b00]">
                                       🔥 限时 5 折
                                    </span>
                                 </div>
                              </div>
                           ) : (
                              <div className="mt-6 flex items-end gap-2">
                                 <span className="text-5xl font-extrabold tracking-tight text-slate-900">{summary.price}</span>
                                 {summary.unit ? <span className="pb-1 text-base font-semibold text-slate-500">{summary.unit}</span> : null}
                              </div>
                           )}
                        </div>

                        <div className="relative flex-1 space-y-3.5">
                           {summary.highlights.map((item: string) => (
                              <div key={item} className="flex items-start gap-3 text-sm leading-relaxed text-slate-700">
                                 <Check className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${column.featured ? 'text-indigo-600' : column.accent === 'emerald' ? 'text-emerald-600' : column.accent === 'amber' ? 'text-amber-600' : 'text-slate-700'}`} strokeWidth={3} />
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
                              if (isConsultationPlan) {
                                 setShowAssistantModal(true)
                                 return
                              }
                              if (plan && !isDisabled) handleSubscribe(plan)
                           }}
                           disabled={isCurrentPlan}
                           className={`mt-8 inline-flex w-full items-center justify-center rounded-full px-5 py-3.5 text-base font-bold transition-all ${
                              isCurrentPlan
                                 ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                                 : column.featured
                                       ? 'bg-[#7b74ff] text-white shadow-[0_18px_38px_-24px_rgba(123,116,255,0.38)] hover:bg-[#6f63f6]'
                                       : column.accent === 'emerald'
                                          ? 'bg-emerald-600 text-white shadow-[0_18px_38px_-24px_rgba(5,150,105,0.36)] hover:bg-emerald-500'
                                          : column.accent === 'amber'
                                             ? 'bg-amber-500 text-white shadow-[0_18px_38px_-24px_rgba(245,158,11,0.32)] hover:bg-amber-400'
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
            <div className="mb-6 mt-12 sm:mt-14 text-center">
               <h3 className="text-2xl font-bold text-slate-900">会员权益与咨询服务对比</h3>
            </div>
            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
               <div className="min-w-[860px] overflow-hidden rounded-[24px] border border-[#dfe8ef] bg-white shadow-[0_30px_80px_-50px_rgba(64,78,102,0.22)]">
               <div className="grid grid-cols-[1.35fr_repeat(4,minmax(0,1fr))] border-b border-slate-200 bg-[linear-gradient(180deg,rgba(247,248,255,0.98),rgba(255,255,255,0.96))]">
                  <div className="px-6 py-6 text-left">
                     <div className="text-sm font-semibold text-slate-400">价值点</div>
                     <div className="mt-2 text-xl font-bold text-slate-900">方案对比</div>
                  </div>
                     {[
                        { key: 'free', title: '免费版', meta: '浏览岗位、有限尝试' },
                        { key: 'trial_week', title: '7 天会员', meta: '¥29.9 / 7 天' },
                        { key: 'quarter', title: '季度会员', meta: '¥199 / 季度', featured: true },
                        { key: 'year', title: '线上咨询', meta: '¥299-¥599' }
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
                                 <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
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
         </div>

         {/* Product Layers Section */}
         <div id="member-promise" className="relative z-20 mx-auto max-w-[1500px] px-4 pb-10 sm:px-6 lg:px-8">
            <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
               <div className="relative overflow-hidden rounded-[26px] border border-[#e7d8bd] bg-white/86 p-7 shadow-[0_26px_72px_-58px_rgba(102,82,48,0.22)] backdrop-blur sm:p-8">
                  <div className="pointer-events-none absolute inset-0">
                     <img src="/pic_lists/About_pics/thanks_bg.webp" alt="" className="absolute inset-y-0 right-0 h-full w-[58%] object-cover object-right opacity-[0.14]" />
                     <img src={MEMBERSHIP_DECOR.grass} alt="" className="absolute -bottom-8 left-2 h-36 opacity-18" />
                     <img src={MEMBERSHIP_DECOR.sun} alt="" className="absolute right-8 top-8 h-16 w-16 object-contain opacity-35" />
                     <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.98)_0%,rgba(255,253,248,0.9)_55%,rgba(255,255,255,0.68)_100%)]" />
                  </div>
                  <div className="relative flex flex-col gap-7 md:flex-row md:items-center">
                     <div className="min-w-0 flex-1">
                        <h2 className="text-2xl font-bold text-slate-950">我们的承诺</h2>
                        <p className="mt-3 text-base leading-8 text-slate-600">
                           让每一位远程工作者，都拥有更多选择与可能。我们会持续更新岗位资源、优化信息质量，减少你在求职中的重复试错。
                        </p>
                     </div>
                     <div className="grid gap-4 sm:grid-cols-3 md:w-[520px]">
                        {[
                           { title: '信息安全', text: '严谨保护你的隐私与数据', icon: ShieldCheck },
                           { title: '持续更新', text: '不断优化与新增优质资源', icon: Sparkles },
                           { title: '透明可靠', text: '真实岗位与企业，安心申请', icon: CheckCircle2 }
                        ].map((item) => {
                           const Icon = item.icon
                           return (
                              <div key={item.title} className="rounded-[18px] border border-[#edf1e8] bg-[#fffdf8]/82 p-4 shadow-[0_16px_34px_-30px_rgba(102,82,48,0.2)]">
                                 <div className="mb-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f3fbf6] text-[#49a982]">
                                    <Icon className="h-4 w-4" />
                                 </div>
                                 <div>
                                    <div className="font-bold text-slate-900">{item.title}</div>
                                    <div className="mt-1 text-xs leading-5 text-slate-500">{item.text}</div>
                                 </div>
                              </div>
                           )
                        })}
                     </div>
                  </div>
               </div>

               <div id="member-help" className="relative overflow-hidden rounded-[26px] border border-[#dfe8ef] bg-white/88 p-6 shadow-[0_24px_70px_-60px_rgba(64,78,102,0.2)] backdrop-blur">
                  <img src="/pic_lists/Home_pics/background03.webp" alt="" className="pointer-events-none absolute inset-x-0 bottom-0 h-36 w-full object-cover object-bottom opacity-[0.1]" />
                  <img src={MEMBERSHIP_DECOR.grass2} alt="" className="pointer-events-none absolute bottom-1 left-3 w-16 opacity-18" />
                  <div className="relative flex h-full flex-col gap-5">
                     <div>
                        <h2 className="text-xl font-bold text-slate-950">需要帮助？</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                           关于支付、权益或岗位疑惑，可以通过微信或邮件咨询。
                        </p>
                     </div>
                     <div className="mx-auto w-full max-w-[156px] rounded-[1.35rem] border border-[#f3e7c8] bg-white/92 p-3 text-center shadow-sm">
                        <img src="/series_assistant.png" alt="微信咨询二维码" className="mx-auto h-28 w-28 object-contain" />
                        <div className="mt-2 text-xs font-bold text-slate-600">微信扫一扫添加</div>
                     </div>
                     <div>
                        <a href="mailto:hi@haigooremote.com" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#6f63f6] px-5 py-2.5 text-sm font-bold text-white no-underline shadow-[0_16px_34px_-24px_rgba(111,99,246,0.65)] transition hover:-translate-y-0.5 hover:no-underline">
                           或试试 邮件联系
                           <ArrowRight className="h-4 w-4" />
                        </a>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Social Proof: Success Stories */}
         <div id="member-stories" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="text-center mb-10 sm:mb-12">
               <h2 className="text-3xl font-extrabold text-slate-900 mb-3">来自用户的真实反馈</h2>
               <p className="text-slate-500 text-base sm:text-lg">看看其他用户怎么说</p>
            </div>

            <div className="grid gap-5 sm:gap-8 md:grid-cols-2 xl:grid-cols-3 max-w-6xl mx-auto">
               {[
                  {
                     quote: '“在这里遇到了自己非常喜欢的工作，跟专业背景对口，薪资很满意，还帮我拓展了海外客户。非常感谢海狗远程俱乐部。”',
                     name: 'Flora',
                     title: '心理咨询师',
                     avatar: '/flora.webp',
                     tone: 'text-[#d8f0e4] fill-[#edf9f2]'
                  },
                  {
                     quote: '“很满意通过这个找到了工作，也顺利入职了。如果遇到和自己匹配的岗位，各位不妨试一试及时出手。”',
                     name: '福多多',
                     title: '粤语客服',
                     avatar: '/fuduoduo.webp',
                     tone: 'text-[#d8eaf7] fill-[#f1f8fd]'
                  },
                  {
                     quote: '“从海狗远程俱乐部刚发起时我就关注了，算是早期粉丝了，终于等到了中国人自己的远程工作网站，太棒了！”',
                     name: 'JoJo',
                     title: '产品经理',
                     avatar: '/jojo.webp',
                     tone: 'text-[#f4dfb8] fill-[#fff7e8]'
                  }
               ].map((item) => (
                  <div key={item.name} className="relative flex h-full flex-col bg-white/90 p-8 rounded-[24px] border border-[#dfe8ef] shadow-[0_24px_64px_-52px_rgba(64,78,102,0.24)]">
                     <Quote className={`absolute top-6 left-6 w-10 h-10 ${item.tone}`} />
                     <p className="relative z-10 flex-1 pl-6 pt-2 text-slate-700 leading-relaxed font-medium">
                        {item.quote}
                     </p>
                     <div className="mt-8 flex items-center gap-4">
                        <img src={item.avatar} alt={item.name} className="w-12 h-12 rounded-full object-cover bg-slate-100" />
                        <div>
                           <div className="font-bold text-slate-900">{item.name}</div>
                           <div className="text-sm text-slate-500">{item.title}</div>
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Trusted Partners */}
         <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16 text-center mt-6 sm:mt-8 mb-12 sm:mb-16">
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
         <div className="max-w-4xl mx-auto pb-24 sm:pb-32 px-4">
            <div className="text-center mb-12 sm:mb-16">
               <h2 className="text-3xl font-bold text-slate-900 mb-4">常见问题解答</h2>
               <p className="text-slate-500 text-base sm:text-lg">了解更多关于会员方案、联系方式和线上咨询的细节</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 sm:gap-6">
               {[
                  { q: "这里的岗位可靠吗？", a: "岗位会优先经过人工审核与筛选，重点帮你减少不值得投入时间的无效岗位。" },
                  { q: "会员版主要多了什么？", a: "会员版核心是解锁全部高价值岗位信息、企业联系人信息、企业直申机会，以及会员专属推荐和 AI 简历优化。季度会员会额外获得优先人工支持和服务。" },
                  { q: "线上咨询也包含在会员里吗？", a: "线上咨询是单独服务，适合希望提高远程求职效率的用户。可以通过小助手了解详情，咨询内容包括远程求职答疑、职业发展分析、英文简历和求职信建议、定向岗位匹配。" },
                  { q: "方案是否可以变更或退款？", a: "支付后 48 小时内可以申请变更方案或退款。你可以发邮件到「hi@haigooremote.com」写明原因，我们会在 3 个工作日内联系处理。" }
               ].map((faq, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-slate-100 bg-white/92 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
                     <button
                        type="button"
                        onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                        className="flex w-full items-start gap-3 p-6 text-left"
                        aria-expanded={openFaqIndex === i}
                     >
                        <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-600">?</span>
                        <span className="min-w-0 flex-1 text-lg font-bold text-slate-900">{faq.q}</span>
                        <ChevronRight className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${openFaqIndex === i ? 'rotate-90 text-indigo-600' : ''}`} />
                     </button>
                     <div className={`grid transition-[grid-template-rows] duration-300 ${openFaqIndex === i ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                        <div className="overflow-hidden">
                           <p className="px-6 pb-6 pl-[60px] text-slate-500 leading-relaxed">{faq.a}</p>
                        </div>
                     </div>
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

         {/* Assistant QR Modal */}
         {modalRoot && showAssistantModal && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-center justify-center p-4">
               <button
                  type="button"
                  aria-label="关闭咨询弹窗"
                  className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md"
                  onClick={() => setShowAssistantModal(false)}
               />
               <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-[2rem] border border-white/10 bg-white p-7 text-center shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)]">
                  <button
                     type="button"
                     onClick={() => setShowAssistantModal(false)}
                     className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xl leading-none text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800"
                     aria-label="关闭"
                  >
                     ×
                  </button>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                     <MessageCircle className="h-7 w-7" />
                  </div>
                  <h3 className="text-2xl font-extrabold text-slate-950">微信咨询</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">
                     扫码咨询，了解远程工作个性化咨询的适配方案与价格。
                  </p>
                  <div className="mx-auto mt-5 w-56 rounded-[1.5rem] border border-slate-100 bg-slate-50 p-4">
                     <img src="/series_assistant.png" alt="微信咨询二维码" className="h-full w-full object-contain" />
                  </div>
               </div>
            </div>
         ), modalRoot)}

         {/* Payment Modal */}
         {modalRoot && showPaymentModal && selectedPlan && createPortal((
            <div className="fixed inset-0 z-[10000] isolate flex items-start justify-center overflow-y-auto p-2 sm:items-center sm:p-4">
               <button
                  type="button"
                  aria-label="关闭支付弹窗"
                  className="fixed inset-0 z-0 cursor-default bg-slate-950/65 backdrop-blur-md transition-opacity"
                  onClick={() => setShowPaymentModal(false)}
               />

               <div className="relative z-10 my-2 flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl scale-100 animate-in flex-col overflow-y-auto rounded-2xl border border-white/10 bg-white shadow-[0_30px_90px_-40px_rgba(15,23,42,0.75)] fade-in zoom-in duration-300 sm:my-4 sm:rounded-3xl md:max-h-[600px] md:flex-row md:overflow-hidden">
                  {/* Left Side: Order Details */}
                  <div className="flex w-full flex-shrink-0 flex-col border-b border-slate-100 bg-slate-50 p-4 sm:p-6 md:w-5/12 md:overflow-y-auto md:border-b-0 md:border-r md:p-8">
                     <div className="mb-5 flex items-center justify-between md:hidden">
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

                     <div className="mb-5 md:mb-10">
                        <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">订阅方案</p>
                        <h4 className="mb-3 text-2xl font-bold leading-tight text-slate-900 md:text-3xl">{selectedPlan.name}</h4>
                        {selectedPlan.memberType === 'quarter' ? (
                           <div>
                              <div className="text-sm font-black text-slate-400 line-through decoration-2">¥399 /季度</div>
                              <div className="mt-1 flex min-w-0 items-center gap-2 whitespace-nowrap">
                                 <span className="shrink-0 text-3xl font-bold leading-none text-slate-900 md:text-4xl">¥199</span>
                                 <span className="shrink-0 text-sm font-medium text-slate-500">/季度</span>
                                 <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#ffd6a6] bg-[#fff7e8] px-2.5 py-1 text-[11px] font-black text-[#c26b00]">
                                    🔥 限时 5 折
                                 </span>
                              </div>
                           </div>
                        ) : (
                           <div className="flex items-baseline gap-1">
                              <span className="text-3xl font-bold text-slate-900 md:text-4xl">¥{selectedPlan.price}</span>
                              <span className="text-sm font-medium text-slate-500">/{selectedPlan.memberType === 'trial_week' ? '周' : (selectedPlan.duration_days > 90 ? '年' : '季度')}</span>
                           </div>
                        )}
                        {selectedPlan.description ? (
                           <p className="mt-4 text-sm leading-7 text-slate-500">{selectedPlan.description}</p>
                        ) : null}
                        <div className="mt-5 space-y-2.5">
                           {selectedPlan.features.map((feature) => (
                              <div key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                                 <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#6f63f6]" strokeWidth={3} />
                                 <span>{feature}</span>
                              </div>
                           ))}
                        </div>
                     </div>

                     <div className="md:flex-1">
                        <p className="font-bold text-slate-900 mb-4 text-sm">选择支付方式</p>
                        <div className="grid grid-cols-2 gap-2 md:block md:space-y-3">
                           <button
                              onClick={() => setPaymentMethod('alipay')}
                              className={`w-full rounded-xl border-2 p-3 transition-all flex items-center gap-2 group md:gap-3 md:p-4 ${paymentMethod === 'alipay'
                                 ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                                 : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                                 }`}
                           >
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1677FF] text-white shadow-sm transition-transform group-hover:scale-110 md:h-10 md:w-10">
                                 <Zap className="w-5 h-5 fill-current" />
                              </span>
                              <span className="text-slate-900 font-bold text-sm flex-1 text-left">支付宝</span>
                              {paymentMethod === 'alipay' && <CheckCircle2 className="w-5 h-5 text-blue-500" />}
                           </button>

                           <button
                              onClick={() => setPaymentMethod('wechat')}
                              className={`w-full rounded-xl border-2 p-3 transition-all flex items-center gap-2 group md:gap-3 md:p-4 ${paymentMethod === 'wechat'
                                 ? 'border-green-500 bg-green-50/50 shadow-sm'
                                 : 'border-slate-200 bg-white hover:border-green-200 hover:bg-slate-50'
                                 }`}
                           >
                              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#07C160] text-white shadow-sm transition-transform group-hover:scale-110 md:h-10 md:w-10">
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
                  <div className="relative flex w-full flex-col items-center justify-start overflow-visible bg-white p-4 text-center sm:p-6 md:w-7/12 md:justify-center md:overflow-y-auto md:p-10">
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
                              className="h-36 w-36 rounded-lg object-contain sm:h-40 sm:w-40"
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

                        <div className="sticky bottom-0 -mx-4 bg-white/95 px-4 pb-1 pt-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:p-0 md:backdrop-blur-0">
                           <button
                              onClick={handlePaymentComplete}
                              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] text-base"
                           >
                              <CheckCircle2 className="w-5 h-5" />
                              我已完成支付
                           </button>
                           <p className="text-[10px] text-slate-400 mt-3 font-medium">
                              * 支付后通常在3min内生效（深夜除外）
                           </p>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100 md:hidden text-center">
                           <p className="text-xs text-slate-400">
                              客服邮箱：<a href="mailto:hi@haigooremote.com" className="text-indigo-600 font-medium">hi@haigooremote.com</a>
                           </p>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         ), modalRoot)}
      </div>
   );
};

export default MembershipPage;
