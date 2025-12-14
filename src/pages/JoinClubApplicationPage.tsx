import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, CheckCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

export default function JoinClubApplicationPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError } = useNotificationHelpers()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const [formData, setFormData] = useState({
    experience: '',
    careerIdeal: '',
    portfolio: '',
    expectations: '',
    contribution: '',
    contact: '',
    contactType: 'wechat' as 'wechat' | 'phone' | 'email'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.experience || !formData.careerIdeal || !formData.expectations || !formData.contribution || !formData.contact) {
      showError('请填写所有必填项')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Optional: Add authorization header if user is logged in
          ...(user ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
            ...formData,
            userId: user?.user_id
        })
      })

      const data = await response.json()

      if (response.ok && data.success) {
        setIsSuccess(true)
        showSuccess('申请提交成功')
      } else {
        throw new Error(data.error || '提交失败')
      }
    } catch (error) {
      console.error('Application error:', error)
      showError('提交失败', '请稍后重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-4">申请已提交</h2>
          <p className="text-slate-600 mb-8 leading-relaxed">
            感谢您申请加入海狗远程俱乐部！<br/>
            我们会认真评估您的申请内容，并在<span className="font-bold text-slate-900">3个工作日内</span>通过您预留的联系方式与您联系。
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="flex items-center text-slate-500 hover:text-slate-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回首页
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-indigo-600 px-8 py-10 text-center">
            <h1 className="text-3xl font-bold text-white mb-4">加入海狗远程俱乐部</h1>
            <p className="text-indigo-100 max-w-xl mx-auto">
              我们要寻找的不仅仅是求职者，而是愿意探索新生活方式、拥有共同价值观的伙伴。请认真填写以下内容，帮助我们更好地了解你。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            {/* Section 1: Professional Background */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 border-l-4 border-indigo-600 pl-3">职业背景</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  您的职业经历 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-slate-50/50"
                  placeholder="请简要介绍您的核心技能、工作年限及主要成就..."
                  value={formData.experience}
                  onChange={e => setFormData({...formData, experience: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  您的职业理想 <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-slate-50/50"
                  placeholder="您期望在未来3-5年内达成什么样的职业目标？"
                  value={formData.careerIdeal}
                  onChange={e => setFormData({...formData, careerIdeal: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  代表作品 / 个人网站 / LinkedIn
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-slate-50/50"
                  placeholder="https://..."
                  value={formData.portfolio}
                  onChange={e => setFormData({...formData, portfolio: e.target.value})}
                />
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Section 2: Value & Contribution */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 border-l-4 border-indigo-600 pl-3">价值观与共建</h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  您希望通过加入俱乐部获得什么？ <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-slate-50/50"
                  placeholder="例如：寻找合伙人、获取内推机会、交流远程经验..."
                  value={formData.expectations}
                  onChange={e => setFormData({...formData, expectations: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  您能够为俱乐部里的其他伙伴带来什么？ <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-4 bg-slate-50/50"
                  placeholder="例如：分享设计经验、提供法律咨询、组织线下活动..."
                  value={formData.contribution}
                  onChange={e => setFormData({...formData, contribution: e.target.value})}
                />
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Section 3: Contact */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 border-l-4 border-indigo-600 pl-3">联系方式</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    联系方式类型
                  </label>
                  <select
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-slate-50/50"
                    value={formData.contactType}
                    onChange={e => setFormData({...formData, contactType: e.target.value as any})}
                  >
                    <option value="wechat">微信 (WeChat)</option>
                    <option value="phone">电话 (Phone)</option>
                    <option value="email">邮箱 (Email)</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    号码 / 地址 <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-3 bg-slate-50/50"
                    placeholder={formData.contactType === 'wechat' ? '请输入微信号' : formData.contactType === 'email' ? 'example@mail.com' : '13800000000'}
                    value={formData.contact}
                    onChange={e => setFormData({...formData, contact: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    正在提交...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    提交申请
                  </>
                )}
              </button>
              <p className="text-center text-sm text-slate-500 mt-4">
                提交即代表您同意我们的隐私政策，您的信息仅用于审核评估，绝不外泄。
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
