import { useState, useEffect } from 'react'
import { Check, X, Clock, Eye, MoreHorizontal, MessageSquare, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotificationHelpers } from '../components/NotificationSystem'

interface Application {
  id: number
  user_id: string
  experience: string
  career_ideal: string
  portfolio: string
  expectations: string
  contribution: string
  contact: string
  contact_type: string
  status: 'pending' | 'approved' | 'rejected' | 'contacted'
  created_at: string
}

export default function AdminApplicationsPage() {
  const { token } = useAuth()
  const { showSuccess, showError } = useNotificationHelpers()
  const [applications, setApplications] = useState<Application[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)

  useEffect(() => {
    fetchApplications()
  }, [])

  const fetchApplications = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/admin-ops?action=list_applications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const data = await response.json()
      if (data.success) {
        setApplications(data.applications)
      } else {
        showError('加载失败', data.error)
      }
    } catch (error) {
      console.error('Failed to fetch applications:', error)
      showError('加载失败', '网络错误')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      const response = await fetch('/api/admin-ops?action=update_application_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id, status })
      })
      const data = await response.json()
      if (data.success) {
        showSuccess('状态更新成功')
        setApplications(apps => apps.map(app => 
          app.id === id ? { ...app, status: status as any } : app
        ))
        if (selectedApp && selectedApp.id === id) {
            setSelectedApp(prev => prev ? { ...prev, status: status as any } : null)
        }
      } else {
        showError('更新失败', data.error)
      }
    } catch (error) {
      showError('操作失败', '网络错误')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-700 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-700 border-red-200'
      case 'contacted': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-yellow-100 text-yellow-700 border-yellow-200'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved': return '已通过'
      case 'rejected': return '已拒绝'
      case 'contacted': return '已联系'
      default: return '待处理'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">会员申请管理</h1>
        <div className="flex gap-2">
            <button onClick={fetchApplications} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <Clock className="w-5 h-5 text-slate-500" />
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : applications.length === 0 ? (
          <div className="p-12 text-center text-slate-500">暂无申请记录</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-slate-700">申请时间</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">联系方式</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">职业背景</th>
                  <th className="px-6 py-4 font-semibold text-slate-700">状态</th>
                  <th className="px-6 py-4 font-semibold text-slate-700 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-600 whitespace-nowrap">
                      {new Date(app.created_at).toLocaleDateString()} <br/>
                      <span className="text-xs text-slate-400">{new Date(app.created_at).toLocaleTimeString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{app.contact}</div>
                      <div className="text-xs text-slate-500 capitalize">{app.contact_type}</div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <div className="truncate text-slate-700" title={app.experience}>{app.experience}</div>
                      <div className="text-xs text-slate-500 mt-1 truncate" title={app.career_ideal}>{app.career_ideal}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(app.status)}`}>
                        {getStatusLabel(app.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedApp(app)}
                        className="text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-slate-900">申请详情 #{selectedApp.id}</h2>
              <button
                onClick={() => setSelectedApp(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Status Actions */}
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedApp.status)}`}>
                    当前状态：{getStatusLabel(selectedApp.status)}
                </span>
                <div className="flex gap-2">
                    {selectedApp.status !== 'contacted' && (
                        <button 
                            onClick={() => handleUpdateStatus(selectedApp.id, 'contacted')}
                            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                        >
                            标记已联系
                        </button>
                    )}
                    {selectedApp.status === 'pending' && (
                        <>
                            <button 
                                onClick={() => handleUpdateStatus(selectedApp.id, 'approved')}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                            >
                                通过
                            </button>
                            <button 
                                onClick={() => handleUpdateStatus(selectedApp.id, 'rejected')}
                                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                                拒绝
                            </button>
                        </>
                    )}
                </div>
              </div>

              {/* Content */}
              <div className="grid grid-cols-1 gap-6">
                <div>
                    <label className="text-sm font-medium text-slate-500 block mb-1">职业经历</label>
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100">
                        {selectedApp.experience}
                    </div>
                </div>
                
                <div>
                    <label className="text-sm font-medium text-slate-500 block mb-1">职业理想</label>
                    <div className="p-4 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100">
                        {selectedApp.career_ideal}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-medium text-slate-500 block mb-1">期望获得</label>
                        <div className="p-4 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100 h-full">
                            {selectedApp.expectations}
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-slate-500 block mb-1">能带来什么</label>
                        <div className="p-4 bg-slate-50 rounded-xl text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100 h-full">
                            {selectedApp.contribution}
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-sm font-medium text-slate-500 block mb-1">代表作品 / 链接</label>
                    {selectedApp.portfolio ? (
                        <a 
                            href={selectedApp.portfolio.startsWith('http') ? selectedApp.portfolio : `https://${selectedApp.portfolio}`} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors w-fit"
                        >
                            <ExternalLink className="w-4 h-4" />
                            {selectedApp.portfolio}
                        </a>
                    ) : (
                        <div className="text-slate-400 italic">未提供</div>
                    )}
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <label className="text-sm font-medium text-slate-500 block mb-1">联系方式 ({selectedApp.contact_type})</label>
                    <div className="text-lg font-bold text-slate-900 select-all">
                        {selectedApp.contact}
                    </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
