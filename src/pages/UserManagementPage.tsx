/**
 * 用户管理后台页面
 * 用于管理员查看和管理所有注册用户
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Download,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle,
  Calendar,
  Mail,
  User as UserIcon,
  Activity,
  Users,
  TrendingUp,
  Clock,
  Bookmark,
  XCircle
} from 'lucide-react'
import type { User } from '../types/auth-types'
import { useAuth } from '../contexts/AuthContext'

interface UserStats {
  total: number
  active: number
  suspended: number
  newToday: number
  newThisWeek: number
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('all')
  const [providerFilter, setProviderFilter] = useState<'all' | 'email' | 'google'>('all')
  const [stats, setStats] = useState<UserStats>({
    total: 0,
    active: 0,
    suspended: 0,
    newToday: 0,
    newThisWeek: 0
  })
  const { token } = useAuth()
  const SUPER_ADMIN_EMAIL = 'caitlinyct@gmail.com'
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editAdmin, setEditAdmin] = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/users', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await response.json()
      if (data.success) {
        setUsers(data.users)
        calculateStats(data.users)
      }
    } catch (error) {
      console.error('[UserManagement] Failed to fetch users:', error)
    } finally {
      setLoading(false)
    }
  }, [token])

  // 加载用户列表
  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  // 过滤用户
  useEffect(() => {
    let filtered = [...users]

    // 搜索过滤
    if (searchTerm) {
      filtered = filtered.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.id.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 状态过滤
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter)
    }

    // 认证方式过滤
    if (providerFilter !== 'all') {
      filtered = filtered.filter(user => user.authProvider === providerFilter)
    }

    setFilteredUsers(filtered)
  }, [users, searchTerm, statusFilter, providerFilter])



  const calculateStats = (userList: User[]) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)

    const stats = {
      total: userList.length,
      active: userList.filter(u => u.status === 'active').length,
      suspended: userList.filter(u => u.status === 'suspended').length,
      newToday: userList.filter(u => new Date(u.createdAt) >= today).length,
      newThisWeek: userList.filter(u => new Date(u.createdAt) >= weekAgo).length
    }

    setStats(stats)
  }

  const updateUserStatus = async (userId: string, nextStatus: 'active' | 'suspended') => {
    try {
      setUpdatingId(userId)
      const resp = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: userId, status: nextStatus })
      })
      const data = await resp.json()
      if (!data.success) {
        console.error('[UserManagement] 更新状态失败:', data.error)
        return
      }
      // 局部更新并重算统计
      setUsers(prev => {
        const next = prev.map(u => (u.id === userId ? { ...u, status: nextStatus, updatedAt: new Date().toISOString() } : u))
        calculateStats(next)
        return next
      })
    } catch (err) {
      console.error('[UserManagement] 调用 PATCH /api/users 失败:', err)
    } finally {
      setUpdatingId(null)
    }
  }

  const openEdit = (user: User) => {
    setEditingUser(user)
    setEditUsername(user.username)
    setEditAdmin(!!user.roles?.admin)
  }

  const saveEdit = async () => {
    if (!editingUser) return
    try {
      setUpdatingId(editingUser.id)
      const resp = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: editingUser.id, username: editUsername, roles: { admin: editAdmin } })
      })
      const data = await resp.json()
      if (data.success && data.user) {
        setUsers(prev => prev.map(u => (u.id === editingUser.id ? { ...u, ...data.user } as User : u)))
      }
    } finally {
      setUpdatingId(null)
      setEditingUser(null)
    }
  }

  const deleteUser = async (userId: string) => {
    if (!confirm('确认删除该用户？')) return
    try {
      setUpdatingId(userId)
      const resp = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      })
      const data = await resp.json()
      if (data.success) {
        setUsers(prev => prev.filter(u => u.id !== userId))
        calculateStats(users.filter(u => u.id !== userId))
      }
    } finally {
      setUpdatingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const exportUsers = () => {
    const csv = [
      ['UUID', '用户名', '邮箱', '认证方式', '邮箱验证', '注册时间', '最后登录', '状态'].join(','),
      ...filteredUsers.map(user => [
        user.id,
        user.username,
        user.email,
        user.authProvider,
        user.emailVerified ? '是' : '否',
        user.createdAt,
        user.lastLoginAt || '-',
        user.status
      ].join(','))
    ].join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `users_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">用户管理</h1>
          <p className="text-slate-600">管理和监控平台所有注册用户</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">总用户数</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <Users className="w-10 h-10 text-indigo-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">活跃用户</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-10 h-10 text-green-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">已停用</p>
                <p className="text-2xl font-bold text-red-600">{stats.suspended}</p>
              </div>
              <Ban className="w-10 h-10 text-red-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">今日新增</p>
                <p className="text-2xl font-bold text-purple-600">{stats.newToday}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-purple-500 opacity-20" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600 mb-1">本周新增</p>
                <p className="text-2xl font-bold text-orange-600">{stats.newThisWeek}</p>
              </div>
              <Activity className="w-10 h-10 text-orange-500 opacity-20" />
            </div>
          </div>
        </div>

        {/* 筛选和操作栏 */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6 border border-slate-200">
          <div className="flex flex-col md:flex-row gap-4">
            {/* 搜索框 */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="搜索用户（邮箱、用户名、UUID）"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* 状态过滤 */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="all">全部状态</option>
              <option value="active">活跃</option>
              <option value="suspended">已停用</option>
            </select>

            {/* 认证方式过滤 */}
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value as any)}
              className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="all">全部方式</option>
              <option value="email">邮箱登录</option>
              <option value="google">Google</option>
            </select>

            {/* 操作按钮 */}
            <button
              onClick={fetchUsers}
              className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              刷新
            </button>

            <button
              onClick={exportUsers}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              导出CSV
            </button>
          </div>
        </div>

        {/* 用户列表 */}
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">加载中...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <UserIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">暂无用户数据</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">用户信息</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">UUID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">认证方式</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">注册时间</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">最后登录</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">收藏岗位</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.username} className="w-10 h-10 rounded-full" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-violet-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                              {user.username[0]?.toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-900">{user.username}</p>
                            <div className="flex items-center gap-1 text-sm text-slate-600">
                              <Mail className="w-3 h-3" />
                              {user.email}
                            </div>
                            {user.profile?.title && (
                              <p className="text-xs text-slate-500">{user.profile.title}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-700">
                          {user.id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${user.authProvider === 'google' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                          {user.authProvider === 'google' ? 'Google' : '邮箱'}
                        </span>
                        {user.emailVerified && (
                          <CheckCircle className="inline-block w-4 h-4 text-green-500 ml-2" />
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          {formatDate(user.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <Bookmark className="w-4 h-4 text-slate-400" />
                            <span className="font-medium">{(user as any).favoritesCount || 0}</span>
                          </div>
                          {(user as any).favorites && (user as any).favorites.length > 0 && (
                            <div className="text-xs text-slate-400 max-w-[150px] truncate" title={(user as any).favorites.join(', ')}>
                              {(user as any).favorites.join(', ')}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.status === 'active' ? 'bg-green-100 text-green-700' :
                          user.status === 'suspended' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                          {user.status === 'active' ? '活跃' : user.status === 'suspended' ? '已停用' : user.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.status === 'active' ? (
                            <button
                              disabled={updatingId === user.id}
                              onClick={() => updateUserStatus(user.id, 'suspended')}
                              className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1 transition-colors ${updatingId === user.id ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'hover:bg-red-50 border-red-200 text-red-600'
                                }`}
                            >
                              <Ban className="w-4 h-4" /> 停用
                            </button>
                          ) : (
                            <button
                              disabled={updatingId === user.id}
                              onClick={() => updateUserStatus(user.id, 'active')}
                              className={`px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1 transition-colors ${updatingId === user.id ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'hover:bg-green-50 border-green-200 text-green-600'
                                }`}
                            >
                              <CheckCircle className="w-4 h-4" /> 启用
                            </button>
                          )}
                          <button
                            disabled={updatingId === user.id}
                            onClick={() => openEdit(user)}
                            className="px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1 hover:bg-slate-50"
                          >
                            <Eye className="w-4 h-4" /> 编辑
                          </button>
                          {user.email !== SUPER_ADMIN_EMAIL && (
                            <button
                              disabled={updatingId === user.id}
                              onClick={() => deleteUser(user.id)}
                              className="px-3 py-1.5 rounded-lg border text-sm flex items-center gap-1 hover:bg-red-50 border-red-200 text-red-600"
                            >
                              <XCircle className="w-4 h-4" /> 删除
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 分页信息 */}
        <div className="mt-4 text-center text-sm text-slate-600">
          显示 {filteredUsers.length} / {users.length} 个用户
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">编辑用户</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 mb-2">用户名</label>
                <input
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" disabled={editingUser?.email === SUPER_ADMIN_EMAIL} checked={editAdmin} onChange={(e) => setEditAdmin(e.target.checked)} />
                <span>{editingUser?.email === SUPER_ADMIN_EMAIL ? '超级管理员（不可更改）' : '管理员权限'}</span>
              </label>

              {/* 求职期望展示 */}
              <div className="mt-4 pt-4 border-t border-slate-100">
                <h4 className="font-semibold text-sm mb-3 text-slate-900">求职期望</h4>
                {editingUser?.jobPreferences ? (
                  <div className="space-y-3 text-sm">
                    {editingUser.jobPreferences.jobTypes?.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">职位类型</span>
                        <div className="flex flex-wrap gap-1">
                          {editingUser.jobPreferences.jobTypes.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editingUser.jobPreferences.industries?.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">行业类型</span>
                        <div className="flex flex-wrap gap-1">
                          {editingUser.jobPreferences.industries.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editingUser.jobPreferences.locations?.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">地点偏好</span>
                        <div className="flex flex-wrap gap-1">
                          {editingUser.jobPreferences.locations.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editingUser.jobPreferences.levels?.length > 0 && (
                      <div>
                        <span className="text-slate-500 block mb-1">级别偏好</span>
                        <div className="flex flex-wrap gap-1">
                          {editingUser.jobPreferences.levels.map(t => (
                            <span key={t} className="px-2 py-0.5 bg-orange-50 text-orange-700 rounded text-xs">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {editingUser.preferencesUpdatedAt && (
                      <div className="text-xs text-slate-400 mt-2">
                        更新于：{new Date(editingUser.preferencesUpdatedAt).toLocaleString('zh-CN')}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 italic">未设置求职期望</p>
                )}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 border rounded-lg">取消</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-violet-600 text-white rounded-lg">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
