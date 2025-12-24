
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap, ShieldCheck, ArrowRight, Gift, Users, ChevronRight, Loader2, Send, CheckCircle2, Calendar, Download, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import JobCardNew from '../components/JobCardNew';
import { processedJobsService } from '../services/processed-jobs-service';
import { trackingService } from '../services/tracking-service';

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

import { MembershipApplicationModal } from '../components/MembershipApplicationModal';
import { MembershipCertificateModal } from '../components/MembershipCertificateModal';

const MembershipPage: React.FC = () => {
   const { user, isAuthenticated, isMember } = useAuth();
   const navigate = useNavigate();
   const [plans, setPlans] = useState<Plan[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
   const [paymentMethod, setPaymentMethod] = useState<'xiaohongshu' | 'wechat_transfer'>('xiaohongshu');
   const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
   const [currentPaymentId, setCurrentPaymentId] = useState<string | null>(null);
   const [showPaymentModal, setShowPaymentModal] = useState(false);
   const [currentMembership, setCurrentMembership] = useState<any>(null);
   const [showApplicationModal, setShowApplicationModal] = useState(false);
   const [showCertificateModal, setShowCertificateModal] = useState(false);
   const [recommendedJobs, setRecommendedJobs] = useState<any[]>([]);

   // Application Logic
   const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
   const [formData, setFormData] = useState({
      nickname: '',
      contact: '',
      experience: '',
      career_ideal: '',
      contact_type: 'wechat'
   });
   const [submitting, setSubmitting] = useState(false);
   const [submitSuccess, setSubmitSuccess] = useState(false);
   const [error, setError] = useState('');

   useEffect(() => {
      if (user) {
         setFormData(prev => ({
            ...prev,
            nickname: user.username || user.profile?.fullName || prev.nickname
         }));
      }
   }, [user]);

   useEffect(() => {
      fetchPlans();
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

   const handleApplicationSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.nickname || !formData.contact || !formData.experience || !formData.career_ideal) {
        setError('请填写所有必填项');
        return;
      }
      setSubmitting(true);
      setError('');
      try {
         const token = localStorage.getItem('haigoo_auth_token');
         const res = await fetch('/api/user-profile?action=submit_application', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
             body: JSON.stringify(formData)
         });
         const data = await res.json();
         if (data.success) {
             setSubmitSuccess(true);
             setApplicationStatus('pending');
             trackingService.track('submit_membership_application', {
                 nickname: formData.nickname,
                 career_ideal_length: formData.career_ideal.length
             });
         } else {
             setError(data.error || '提交失败');
         }
      } catch (err) { setError('网络错误'); } finally { setSubmitting(false); }
  };


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
      // Beta Phase: Show Application Modal instead of direct payment
      setShowApplicationModal(true);
      trackingService.track('click_subscribe', {
          plan_id: plan.id,
          plan_name: plan.name,
          price: plan.price
      });
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
            trackingService.track('initiate_payment', {
                plan_id: selectedPlan.id,
                payment_method: paymentMethod,
                amount: selectedPlan.price
            });
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
      trackingService.track('complete_payment_client_claim', {
          plan_id: selectedPlan?.id
      });
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

   // Fetch Recommended Jobs for Members
   useEffect(() => {
      const fetchRecommended = async () => {
         // Check user membership status correctly
         const isMember = (currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date()) || !!user?.roles?.admin;
         
         if (isMember) {
            try {
               // 1. Get Member Exclusive Referral Jobs sorted by Relevance (High Priority)
               const referralRes = await processedJobsService.getProcessedJobs(1, 6, { 
                  sourceFilter: 'referral',
                  sortBy: 'relevance'
               });

               let finalJobs = referralRes.jobs;

               // 2. If less than 6, fill with Trusted Jobs (Fallback)
               if (finalJobs.length < 6) {
                   const needed = 6 - finalJobs.length;
                   const trustedRes = await processedJobsService.getProcessedJobs(1, needed, {
                       sourceFilter: 'trusted',
                       sortBy: 'relevance'
                   });
                   
                   // Avoid duplicates
                   const existingIds = new Set(finalJobs.map(j => j.id));
                   const newJobs = trustedRes.jobs.filter(j => !existingIds.has(j.id));
                   
                   finalJobs = [...finalJobs, ...newJobs];
               }

               // Strict limit enforcement to ensure UI consistency
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
      <div className="min-h-screen bg-slate-50 font-sans">
         {/* Hero Section */}
         <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-blue-800 to-teal-700 text-white pt-24 pb-32 px-4 sm:px-6 lg:px-8">
            {/* Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none">
               {/* Main spotlight */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
               
               {/* Accent orbs */}
               <div className="absolute top-20 left-1/4 w-96 h-96 bg-indigo-400/20 rounded-full blur-[100px] animate-pulse"></div>
               <div className="absolute top-40 right-1/4 w-80 h-80 bg-teal-400/20 rounded-full blur-[100px] animate-pulse delay-1000"></div>
               
               {/* Grid pattern overlay */}
               <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
               <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
            </div>

            <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
               {/* Premium Badge */}
               <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/90 text-xs font-bold tracking-widest uppercase mb-8 shadow-lg backdrop-blur-md">
                  <Crown className="w-3.5 h-3.5 fill-white/80" /> 
                  Invite Only · Global Access
               </div>

               {/* Main Headline */}
               <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
                  <span className="block text-white/80 text-2xl sm:text-3xl font-medium mb-3 tracking-normal">Join the Elite</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-teal-100 drop-shadow-sm">
                     Haigoo Member
                  </span>
               </h1>

               {/* Subtitle */}
               <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                  开启您的全球远程职业生涯。<br className="hidden sm:block" />
                  解锁海量内推机会，获取 AI 智能简历优化，加入精英远程工作者社区。
               </p>

               {/* Current Status Card (if member) */}
               {((currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date())) && (
                  <div className="inline-flex items-center gap-4 bg-white/10 border border-white/20 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl">
                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-white" />
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Current Status</p>
                        <p className="font-bold text-white text-base flex items-center gap-3">
                           {currentMembership?.level === 'club_go' ? 'Haigoo Member' : 'Haigoo Member'}
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

               {/* Pending Status Card (if application is pending) */}
               {!((currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date())) && applicationStatus === 'pending' && (
                  <div className="inline-flex items-center gap-4 bg-white/10 border border-white/20 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-700">
                     <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                     </div>
                     <div className="text-left">
                        <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">Current Status</p>
                        <p className="font-bold text-white text-base flex items-center gap-3">
                           Haigoo Member
                           <span className="text-xs font-normal text-amber-100 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-400/30">
                              Under Review
                           </span>
                        </p>
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Application Flow Section */}
         <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 -mt-20 relative z-20">
            
            {/* Case 1: Not Authenticated */}
            {!isAuthenticated && (
               <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 p-8 md:p-12 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                     <Users className="w-8 h-8 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">登录以申请会员</h2>
                  <p className="text-slate-500 max-w-lg mx-auto mb-8">
                     Haigoo 会员目前处于内测阶段，仅限邀请加入。请先登录您的账户，然后填写申请表单。
                  </p>
                  <button
                     onClick={() => navigate('/login?redirect=/membership')}
                     className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200"
                  >
                     立即登录 / 注册
                  </button>
               </div>
            )}

            {/* Case 2: Authenticated but Not Member */}
            {isAuthenticated && (!((currentMembership?.isActive) || (user?.memberStatus === 'active' && user.memberExpireAt && new Date(user.memberExpireAt) > new Date()) || !!user?.roles?.admin)) && (
               <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                  <div className="p-8 md:p-12">
                     <div className="text-center mb-10">
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">申请加入 Haigoo Member</h2>
                        <p className="text-slate-500">
                           当前处于内测阶段，会员资格需人工审核。请填写以下信息，我们将在 3 个工作日内反馈。
                        </p>
                     </div>

                     {/* Application Status Check */}
                     {submitSuccess || applicationStatus === 'pending' ? (
                        <div className="text-center py-10 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                           <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Loader2 className="w-8 h-8 animate-spin" />
                           </div>
                           <h3 className="text-xl font-bold text-slate-900 mb-2">申请审核中</h3>
                           <p className="text-slate-500 max-w-xs mx-auto">
                              您的申请已提交，正在排队审核中。结果将通过邮件或短信通知您。
                           </p>
                        </div>
                     ) : (
                        <form onSubmit={handleApplicationSubmit} className="space-y-6 max-w-lg mx-auto">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">昵称 / 称呼 *</label>
                                <input
                                    type="text"
                                    value={formData.nickname}
                                    onChange={e => setFormData({ ...formData, nickname: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    placeholder="怎么称呼您"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">联系方式 *</label>
                                <div className="flex gap-2 mb-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contact_type: 'wechat' })}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg border ${formData.contact_type === 'wechat' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        微信
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contact_type: 'email' })}
                                        className={`flex-1 py-2 text-sm font-medium rounded-lg border ${formData.contact_type === 'email' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        邮箱
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={formData.contact}
                                    onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                    placeholder={formData.contact_type === 'wechat' ? '请输入微信号' : '请输入邮箱地址'}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">职业背景 *</label>
                                <textarea
                                    value={formData.experience}
                                    onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[100px]"
                                    placeholder="例如：3年全栈开发经验，熟悉 React/Node.js..."
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">求职方向 *</label>
                                <textarea
                                    value={formData.career_ideal}
                                    onChange={e => setFormData({ ...formData, career_ideal: e.target.value })}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all min-h-[80px]"
                                    placeholder="例如：希望寻找海外远程全职工作，期望薪资..."
                                    required
                                />
                            </div>

                            {error && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        提交中...
                                    </>
                                ) : (
                                    <>
                                        提交申请
                                        <Send className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </form>
                     )}
                  </div>
               </div>
            )}
            
            {/* Case 3: Is Member - Show Dashboard / Benefits */}
            {isAuthenticated && ((currentMembership?.isActive) || isMember) && (
               <div className="space-y-8">
                  {/* 1. Member Status & Group */}
                  <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                     <div className="p-8 md:p-10">
                        <div className="flex flex-col md:flex-row gap-8 items-start">
                           {/* Status Info */}
                           <div className="flex-1">
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

                                 <div className="flex items-center gap-3 text-slate-700">
                                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                       <Zap className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <span className="font-medium">今日剩余翻译次数：无限次</span>
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

                           {/* Group QR Code */}
                           <div className="w-full md:w-auto flex flex-col items-center bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100">
                              <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                 <Users className="w-5 h-5 text-indigo-600" />
                                 会员专属服务群
                              </h3>
                              <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 mb-3">
                                 {/* Feishu Group QR */}
                                 <img 
                                    src="/feishu.png" 
                                    alt="Feishu Group QR" 
                                    className="w-32 h-32 object-contain rounded-lg"
                                 />
                              </div>
                              <p className="text-xs text-slate-500 text-center max-w-[160px]">
                                 请使用飞书扫码加入<br/>获取一手内推资讯
                              </p>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* 2. Recommended Jobs */}
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
            )}


            {/* FAQ / Trust Section */}
            <div className="mt-24 max-w-4xl mx-auto">
               <div className="text-center mb-12">
                  <h2 className="text-2xl font-bold text-slate-900 mb-4">常见问题解答</h2>
                  <p className="text-slate-500">了解更多关于会员权益的细节</p>
               </div>

               <div className="grid md:grid-cols-2 gap-6">
                  {[
                     { q: "什么是内推直达？", a: "我们会将您的简历直接发送给合作伙伴企业的HR或招聘负责人，跳过简历初筛环节，大大提高面试概率。" },
                     { q: "怎么加入会员？", a: "当前处于内测阶段，会员仅限邀请，在当前页面填写申请后，我们将在3天内回复，请注意填写正确的联系方式。" },
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
         </div>

         {/* Application Modal */}
         <MembershipApplicationModal
            isOpen={showApplicationModal}
            onClose={() => setShowApplicationModal(false)}
         />

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
