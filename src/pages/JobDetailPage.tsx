
import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Share2, AlertCircle } from 'lucide-react'
import { Job } from '../types'
import { JobDetailPanel } from '../components/JobDetailPanel'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { token, isAuthenticated } = useAuth()
  const { showSuccess, showError, showWarning } = useNotificationHelpers()

  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return
      setLoading(true)
      try {
        // Fetch job details
        const resp = await fetch(`/api/data/processed-jobs?id=${id}`)
        if (!resp.ok) throw new Error('职位不存在或已下线')
        const data = await resp.json()
        if (data.jobs && data.jobs.length > 0) {
          setJob(data.jobs[0])
        } else {
          setError('职位不存在或已下线')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败')
      } finally {
        setLoading(false)
      }
    }

    fetchJob()
  }, [id])

  // Check if saved
  useEffect(() => {
    const checkSaved = async () => {
      if (!id || !isAuthenticated || !token) return
      try {
        const resp = await fetch('/api/user-profile?action=favorites', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (resp.ok) {
          const data = await resp.json()
          const savedIds = (data.favorites || []).map((f: any) => f.id)
          setIsSaved(savedIds.includes(id))
        }
      } catch (e) {
        console.warn('Failed to check saved status', e)
      }
    }
    checkSaved()
  }, [id, isAuthenticated, token])

  const handleSave = async () => {
    if (!isAuthenticated || !token) {
      showWarning('请先登录', '登录后可以收藏职位')
      navigate(`/login?redirect=/job/${id}`)
      return
    }

    try {
      const action = isSaved ? 'favorites_remove' : 'favorites_add'
      const resp = await fetch(`/api/user-profile?action=${action}&jobId=${id}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ jobId: id })
      })
      
      if (resp.ok) {
        setIsSaved(!isSaved)
        showSuccess(isSaved ? '已取消收藏' : '收藏成功')
      } else {
        throw new Error('操作失败')
      }
    } catch (e) {
      showError('操作失败，请重试')
    }
  }

  const handleApply = () => {
    if (job?.url) {
      window.open(job.url, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">无法加载职位</h2>
          <p className="text-slate-500 mb-6">{error || '职位可能已过期或被删除'}</p>
          <button 
            onClick={() => navigate('/jobs')}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            查看其他职位
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-50 rounded-full">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </button>
        <div className="font-semibold text-slate-900 truncate max-w-[200px]">{job.title}</div>
        <button className="p-2 -mr-2 hover:bg-slate-50 rounded-full">
          <Share2 className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-4 lg:p-8">
        <div className="lg:mb-6 hidden lg:block">
          <button 
            onClick={() => navigate('/jobs')}
            className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回职位列表
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden min-h-[600px]">
          <JobDetailPanel 
            job={job}
            isSaved={isSaved}
            onSave={handleSave}
            onApply={handleApply}
            showCloseButton={false}
          />
        </div>
      </div>
    </div>
  )
}
