
import React, { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Mail, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const email = searchParams.get('email')
  
  const [status, setStatus] = useState<'confirm' | 'processing' | 'success' | 'error'>('confirm')
  const [message, setMessage] = useState('')

  const handleUnsubscribe = async () => {
    if (!email) return
    
    setStatus('processing')
    try {
      const resp = await fetch('/api/auth?action=unsubscribe-by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const data = await resp.json()
      
      if (data.success) {
        setStatus('success')
      } else {
        setStatus('error')
        setMessage(data.error || '取消订阅失败，请稍后重试')
      }
    } catch (e) {
      setStatus('error')
      setMessage('网络错误，请稍后重试')
    }
  }

  if (!email) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">无效的链接</h2>
          <p className="text-slate-500 mb-6">链接中缺少邮箱参数，无法进行操作。</p>
          <button 
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center border border-slate-100">
        {status === 'confirm' && (
          <>
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">确认取消订阅？</h2>
            <p className="text-slate-500 mb-8">
              您将取消 <strong>{email}</strong> 的所有岗位推送订阅。
              <br/>取消后您将不再收到每日精选职位邮件。
            </p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleUnsubscribe}
                className="w-full px-6 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-semibold border border-red-100"
              >
                确认取消订阅
              </button>
              <button 
                onClick={() => navigate('/jobs')}
                className="w-full px-6 py-3 bg-white text-slate-600 rounded-xl hover:bg-slate-50 transition-colors font-medium border border-slate-200"
              >
                保留订阅，返回首页
              </button>
            </div>
          </>
        )}

        {status === 'processing' && (
          <div className="py-12">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600">正在处理...</p>
          </div>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">已取消订阅</h2>
            <p className="text-slate-500 mb-8">
              您已成功退订。如果这是一次误操作，您可以随时重新订阅。
            </p>
            <button 
              onClick={() => navigate('/')}
              className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold flex items-center justify-center gap-2"
            >
              返回 Haigoo 首页
              <ArrowRight className="w-4 h-4" />
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">操作失败</h2>
            <p className="text-slate-500 mb-8">{message}</p>
            <button 
              onClick={() => setStatus('confirm')}
              className="w-full px-6 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors font-medium"
            >
              重试
            </button>
          </>
        )}
      </div>
      
      <p className="mt-8 text-sm text-slate-400">
        &copy; {new Date().getFullYear()} Haigoo. All rights reserved.
      </p>
    </div>
  )
}
