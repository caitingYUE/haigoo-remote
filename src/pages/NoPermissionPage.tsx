import { Link } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'

export default function NoPermissionPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
          <ShieldAlert className="h-8 w-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          无访问权限
        </h1>
        
        <p className="text-slate-600 mb-8">
          抱歉，您没有权限访问此页面。该区域仅限管理员访问。
          <br />
          如需访问，请联系管理员开通权限。
        </p>
        
        <div className="flex flex-col gap-3">
          <Link 
            to="/" 
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-haigoo-primary hover:bg-haigoo-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-haigoo-primary"
          >
            返回首页
          </Link>
          
          <Link 
            to="/profile" 
            className="inline-flex justify-center items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-haigoo-primary"
          >
            个人中心
          </Link>
        </div>
      </div>
    </div>
  )
}
