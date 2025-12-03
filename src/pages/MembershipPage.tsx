
import React, { useState, useEffect } from 'react';
import { Check, Star, Crown, Zap } from 'lucide-react';
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    // In a real scenario, this might poll for status or just tell user to wait.
    setShowPaymentModal(false);
    alert('如果您已完成支付，请等待管理员确认开通，或联系客服。');
    fetchStatus(); // Refresh status
  };

  // Development helper to auto-confirm
  const handleDevConfirm = async (paymentId: string) => {
      try {
          await axios.post('/api/membership?action=confirm-payment', { paymentId }, {
             headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          加入俱乐部，开启远程工作之旅
        </h2>
        <p className="mt-4 text-xl text-gray-500">
          选择最适合您的会员计划，解锁更多权益
        </p>
        
        {currentMembership?.isActive && (
           <div className="mt-6 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative inline-block">
              当前会员状态: <span className="font-bold">{currentMembership.level === 'club_go' ? '俱乐部Go会员' : 'Goo+会员'}</span> 
              (有效期至: {new Date(currentMembership.expireAt).toLocaleDateString()})
           </div>
        )}
      </div>

      <div className="mt-12 space-y-12 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-x-8 max-w-5xl mx-auto">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className={`relative p-8 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col ${
              plan.id === 'goo_plus_yearly' ? 'ring-2 ring-indigo-500' : ''
            }`}
          >
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center justify-center gap-2">
                 {plan.id === 'goo_plus_yearly' ? <Crown className="w-6 h-6 text-yellow-500"/> : <Star className="w-6 h-6 text-indigo-500"/>}
                 {plan.name}
              </h3>
              <p className="mt-4 flex items-baseline justify-center text-gray-900">
                <span className="text-5xl font-extrabold tracking-tight">¥{plan.price}</span>
                <span className="ml-1 text-xl font-semibold text-gray-500">/年</span>
              </p>
              <p className="mt-6 text-gray-500">包含以下权益：</p>

              <ul role="list" className="mt-6 space-y-6">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex">
                    <Check className="flex-shrink-0 w-6 h-6 text-green-500" aria-hidden="true" />
                    <span className="ml-3 text-gray-500">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              onClick={() => handleSubscribe(plan)}
              className={`mt-8 block w-full py-3 px-6 border border-transparent rounded-md text-center font-medium text-white 
                ${plan.id === 'goo_plus_yearly' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-500 hover:bg-blue-600'}
                transition duration-150 ease-in-out`}
            >
              {currentMembership?.isActive ? '续费/升级' : '立即开通'}
            </button>
          </div>
        ))}
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedPlan && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowPaymentModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 sm:mx-0 sm:h-10 sm:w-10">
                    <Zap className="h-6 w-6 text-indigo-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      开通 {selectedPlan.name}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        支付金额: <span className="text-lg font-bold text-red-600">¥{selectedPlan.price}</span>
                      </p>
                      
                      {!paymentInfo ? (
                        <div className="mt-4 space-y-3">
                          <label className="block text-sm font-medium text-gray-700">选择支付方式</label>
                          <div className="flex gap-4">
                            <button 
                              onClick={() => setPaymentMethod('xiaohongshu')}
                              className={`flex-1 py-2 px-4 border rounded-md ${paymentMethod === 'xiaohongshu' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300'}`}
                            >
                              小红书店铺
                            </button>
                            <button 
                              onClick={() => setPaymentMethod('wechat_transfer')}
                              className={`flex-1 py-2 px-4 border rounded-md ${paymentMethod === 'wechat_transfer' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-300'}`}
                            >
                              微信转账
                            </button>
                          </div>
                        </div>
                      ) : (
                         <div className="mt-4 p-4 bg-gray-50 rounded-md text-center">
                            <p className="text-sm text-gray-700 mb-4">{paymentInfo.instruction}</p>
                            {paymentInfo.type === 'link' && (
                                <a href={paymentInfo.url} target="_blank" rel="noreferrer" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700">
                                    前往小红书支付
                                </a>
                            )}
                            {paymentInfo.type === 'qrcode' && (
                                <div className="flex justify-center">
                                    <div className="w-48 h-48 bg-gray-200 flex items-center justify-center text-gray-400 border border-dashed border-gray-400">
                                        [微信收款码占位]
                                        {/* In real implementation, use <img src={paymentInfo.imageUrl} /> */}
                                    </div>
                                </div>
                            )}
                         </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                {!paymentInfo ? (
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                    onClick={handleCreatePayment}
                  >
                    下一步
                  </button>
                ) : (
                   <>
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={handlePaymentComplete}
                    >
                        我已完成支付
                    </button>
                    {/* Dev Helper */}
                     <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-yellow-100 text-base font-medium text-yellow-700 hover:bg-yellow-200 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        onClick={() => currentPaymentId && handleDevConfirm(currentPaymentId)}
                    >
                        Dev: 模拟支付成功
                    </button>
                   </>
                )}
                <button
                  type="button"
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  onClick={() => setShowPaymentModal(false)}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPage;
